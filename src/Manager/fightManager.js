import { CONTROL_STATES, SQUARESIZE } from "../constants"
import Phaser from "phaser"
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { Manager } from "./Manager";
import { Projectile } from "../Projectile";
import { weapons } from "../weapons";
import { Map } from "../map";
import { AudioManager } from "./AudioManager";

export class fightManager{

    static scene; 

    // 🔴 Common on-hit effects: flash red, cancel target timer, knockback team 0
    static applyHitReaction(target, attacker) {
        if (!target || !target.scene || !target.active) return;

        // 1) Cancel any active timer on the target (interrupt windups, etc.)
        if (target.timer) {
            if (target.timer.remove) {
                target.timer.remove(false);
            }
            target.timer = null;
        }

        const scene = target.scene;

        // 2) Flash red briefly
        const originalTint = target.tintTopLeft; // Phaser sprites expose this
        if (target.setTint) {
            target.setTint(0xff0000);
        }

        scene.time.delayedCall(120, () => {
            if (!target.active || !target.setTint) return;

            if (originalTint !== undefined) {
                target.setTint(originalTint);
            } else {
                // Fall back to default tint logic for players
                if (target.body && typeof Player.applyDefaultTint === "function") {
                    Player.applyDefaultTint(target);
                } else {
                    target.clearTint();
                }
            }
        });

        // 3) Knockback ONLY team 0 units, away from the attacker
        if (!attacker || !target.body || target.body.team !== 0) return;

        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.0001) return;

        const nx = dx / len;
        const ny = dy / len;

        const knockDist = SQUARESIZE * 0.6;
        const proposedX = target.x + nx * knockDist;
        const proposedY = target.y + ny * knockDist;

        const gx = Math.floor(proposedX / SQUARESIZE);
        const gy = Math.floor(proposedY / SQUARESIZE);

        // Respect nav grid if it exists – only knock back into walkable tiles
        if (!Map.navGrid || !Map.navGrid[gy] || Map.navGrid[gy][gx] !== 1) {
            return; // tile blocked or out of bounds → skip knockback
        }

        // Prefer a short velocity impulse over teleporting
        if (target.body.setVelocity) {
            const kbSpeed = 250;
            target.body.setVelocity(nx * kbSpeed, ny * kbSpeed);

            scene.time.delayedCall(120, () => {
                if (target.body) {
                    target.body.setVelocity(0, 0);
                }
            });
        } else {
            // Fallback: directly move the sprite
            target.x = proposedX;
            target.y = proposedY;
        }
    }

    static sendToAttack(){
            const force = Player.selected.length? true : false;
            const troops = Player.selected.length? Player.selected : Teams.teamLists['1'].playerList;
            const fightList = Teams.teamLists['1'].fightingList;
            Manager.assignTroopsToAction(troops, fightList, CONTROL_STATES.TRACK_TARGET, force);
    }

    static attack(sprite) {
        // Always resolve the current tracked target from sprite.track
        const tracked = sprite.track && sprite.track[0];
        if (!tracked || !tracked.gameObject || !tracked.gameObject.active) {
            sprite.track = null;
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
            Player.setAnimState(sprite, sprite.idle);
            return;
        }

        const target = tracked.gameObject;
        const weapon = sprite.weapon;
        if (!weapon) return;

        const inRangeNow = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y) <= weapon.range;
        const hasLoSNow = !weapon.projectile || Projectile.hasLineOfSight(sprite, target);
        if (!inRangeNow || !hasLoSNow) {
            if (sprite.timer) {
                sprite.timer.remove(false);
                sprite.timer = null;
            }
            Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_TARGET);
            Player.setAnimState(sprite, sprite.walk);
            Player.updateTracking(sprite);
            return;
        }

        if (!sprite.timer) {
            Player.setAnimState(sprite, sprite.action);

            sprite.timer = sprite.scene.time.delayedCall(weapon.duration, () => {
                if (!sprite.active) {
                    // attacker died mid-swing
                    return;
                }

                // Re-resolve target in case pointers changed
                const currentTracked = sprite.track && sprite.track[0];
                if (
                    !currentTracked ||
                    !currentTracked.gameObject ||
                    !currentTracked.gameObject.active ||
                    currentTracked.gameObject.health <= 0
                ) {
                    sprite.track = null;
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                    Player.setAnimState(sprite, sprite.idle);
                    sprite.timer = null;
                    return;
                }

                const target = currentTracked.gameObject;
                const inRange = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y) <= weapon.range;
                const hasLoS = !weapon.projectile || Projectile.hasLineOfSight(sprite, target);
                if (!inRange || !hasLoS) {
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_TARGET);
                    Player.setAnimState(sprite, sprite.walk);
                    sprite.timer = null;
                    Player.updateTracking(sprite);
                    return;
                }

                // 🧨 Projectile weapon (gunslinger, etc.)
                if (weapon.projectile) {
                    AudioManager.playWeaponAttack(sprite, weapon, { volume: 0.45, cooldownMs: 60 });
                    const leadPos = Projectile.leadAndAngle(sprite, target, weapon.speed);
                    const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, leadPos.x, leadPos.y);
                    new Projectile(sprite.x, sprite.y, angle, sprite.body.team, weapon, sprite);
                    sprite.timer = null;
                    this.attack(sprite); // chain next shot
                    return;
                }

                // 🎯 Accuracy and crit rolls
                const accuracyRoll = Phaser.Math.Between(0, 100);
                const critRoll = Phaser.Math.Between(0, 100);
                const isHit = accuracyRoll <= weapon.accuracy;
                const isCrit = critRoll <= weapon.critProb;

                // 💥 Ghost text setup
                const textX = target.x || 0;
                const textY = target.y || 0;

                let damage = 0;
                let text = '';
                let color = '#ffffff';

                if (isHit) {
                    AudioManager.playWeaponAttack(sprite, weapon, { volume: 0.32, cooldownMs: 80 });
                    
                    damage = isCrit ? weapon.critDmg : weapon.baseDmg;

                    // 🔴 Apply on-hit effects: flash, cancel timer, knockback team 0
                    fightManager.applyHitReaction(target, sprite);

                    target.health = Math.max(0, target.health - damage);
                    Player.showMiniBarsOnHit(target);

                    text = isCrit ? `CRIT ${damage}` : `HIT ${damage}`;
                    color = sprite.body.team === 1 ? '#00ff00' : '#ff3333';
                } else {
                    text = 'MISS';
                    color = sprite.body.team === 1 ? '#ff3333' : '#aaaaaa';
                }

                // 👻 Ghost text animation
                const scene = sprite.scene;
                if (scene && scene.add) {
                    const ghost = scene.add.text(textX, textY, text, {
                        fontSize: '14px',
                        fill: color,
                        stroke: '#000000',
                        strokeThickness: 2
                    }).setDepth(100).setOrigin(0.5);

                    scene.tweens.add({
                        targets: ghost,
                        y: ghost.y - 20,
                        alpha: 0,
                        duration: 800,
                        ease: 'Cubic.easeOut',
                        onComplete: () => ghost.destroy()
                    });
                }

                // ☠️ Target defeated
                if (target.health <= 0) {
                    this.checkForKillReward(sprite.body.team, target);
                    Player._cleanupCombatTicketForTarget?.(sprite.body.team, target);
                    target.destroySelf();
                    sprite.track = null;
                    sprite.forcedTarget = null;
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE);
                    Player.setAnimState(sprite, sprite.idle);
                    sprite.timer = null;
                } else {
                    // 🔁 Keep swinging as long as target is alive (no more range checks)
                    sprite.timer = null;
                    this.attack(sprite);
                }
            });
        }
    }


    static checkForKillReward(teamNumber, target){
        if(teamNumber && target.killReward){
            this.scene.updateMoney(target.killReward);
        }
    }

    static calculateHitResultFromWeapon(weapon) {
        if (!weapon) {
            return {
                hit: false,
                missed: true,
                isCrit: false,
                damage: 0
            };
        }

        const hitRoll = Phaser.Math.Between(0, 100);
        const hit = hitRoll < weapon.accuracy; // e.g., accuracy = 80 means 80% chance to hit

        if (!hit) {
            return {
                hit: false,
                missed: true,
                isCrit: false,
                damage: 0
            };
        }

        const isCrit = Phaser.Math.Between(0, 100) < weapon.critProb;
        const damage = isCrit ? weapon.critDmg : weapon.baseDmg;

        return {
            hit: true,
            missed: false,
            isCrit,
            damage
        };
    }
}
