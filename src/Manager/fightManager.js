import { CONTROL_STATES } from "../constants"
import Phaser from "phaser"
import { Player } from "../players/Player";
import { Teams } from "../Teams";
import { Manager } from "./Manager";
import { Projectile } from "../Projectile";
import { weapons } from "../weapons";

export class fightManager{

    static scene; 

    static sendToAttack(){
            const force = Player.selected.length? true : false;
            const troops = Player.selected.length? Player.selected : Teams.teamLists['1'].playerList;
            const fightList = Teams.teamLists['1'].fightingList;
            Manager.assignTroopsToAction(troops, fightList, CONTROL_STATES.TRACK_TARGET, force);
    }

    static attack(sprite) {
        const target = sprite.track[0].gameObject;
        if(!target || !target.active){
            sprite.track = null;
            sprite.state = CONTROL_STATES.TRACK_MODE;
            return;
        }
        const weapon = sprite.weapon;

        // Check if target is within weapon range
        const dist = Phaser.Math.Distance.Between(
            sprite.x, sprite.y,
            target.x, target.y
        );

        if (!sprite.track || !sprite.track[0] || !sprite.track[0].gameObject.active || dist > weapon.range) {
            sprite.track = null;
            sprite.state = CONTROL_STATES.TRACK_MODE;
            return;
        }

        if (!weapon) return;
    
        if (!sprite.timer) {
            Player.setAnimState(sprite, sprite.action);
            sprite.timer = sprite.scene.time.delayedCall(weapon.duration, () => {
                if (!sprite.active) {
                    return;
                } // ✅ prevent animation or logic after death
                // Check if target is within weapon range
                const dist = Phaser.Math.Distance.Between(
                    sprite.x, sprite.y,
                    target.x, target.y
                );
                if(!sprite.track || !sprite.track[0] || !sprite.track[0].gameObject || !sprite.track[0].gameObject.active || sprite.track[0].gameObject.health <= 0 || dist > weapon.range){
                    sprite.track = null;
                    Player.setAnimState(sprite, sprite.idle);
                    return;
                }

                if (weapon.projectile) {
                    const leadPos = Projectile.leadAndAngle(sprite, target, weapon.speed);
                    const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, leadPos.x, leadPos.y);
                    new Projectile(sprite.x, sprite.y, angle, sprite.body.team, weapon, sprite);
                    sprite.timer = null;
                    this.attack(sprite); // Recurse after delay
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
                    damage = isCrit ? weapon.critDmg : weapon.baseDmg;
                    target.health = Math.max(0, target.health - damage);
                    Player.updateDetailsTab(target)
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
                    this.checkForKillReward(sprite.body.team,target)
                    Player.destroyPlayer(target);
                    sprite.track = null;
                    Teams.movePlayerState(sprite, CONTROL_STATES.TRACK_MODE)
                    sprite.timer = null;
                    Player.setAnimState(sprite, sprite.idle);
                } else {
                    // 🔁 Continue attacking if target is still alive
                    sprite.timer = null;
                    this.attack(sprite); // Recurse after delay
                }
            });
        }
    }

    static checkForKillReward(teamNumber, target){
        if(teamNumber){
            this.scene.updateMoney(Phaser.Math.Between(1000, 1500));
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


    static showGhostText(scene, x, y, text, teamNumber, isCrit = false, isMiss = false) {
        let color;

        if (isMiss) {
            color = '#888888'; // Gray for MISS
        } else if (teamNumber === 0) {
            color = '#44ff44'; // Green for player/team 0 hit
        } else {
            color = isCrit ? '#ff4444' : '#ffffff'; // Red or white for enemies
        }

        const ghost = scene.add.text(x, y, text, {
            fontSize: '16px',
            fill: color,
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 2
        }).setDepth(1000).setOrigin(0.5);

        scene.tweens.add({
            targets: ghost,
            y: y - 20,
            alpha: 0,
            duration: 600,
            onComplete: () => ghost.destroy()
        });
    }   


}