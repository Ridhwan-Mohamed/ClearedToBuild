import { CONTROL_STATES } from "./constants"
import Phaser from "phaser"
import { Player } from "./Player";

export class fightManager{

    static scene; 

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
            sprite.play('action');
            sprite.timer = sprite.scene.time.delayedCall(weapon.duration, () => {
                if (!sprite.active) return; // ✅ prevent animation or logic after death
                // Check if target is within weapon range
                const dist = Phaser.Math.Distance.Between(
                    sprite.x, sprite.y,
                    target.x, target.y
                );
                if(!sprite.track || !sprite.track[0] || !sprite.track[0].gameObject.active || dist > weapon.range){
                    sprite.track = null;
                    sprite.state = CONTROL_STATES.TRACK_MODE;
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
                    this.checkForKillReward(sprite,target)
                    Player.destroyPlayer(target);
                    sprite.track = null;
                    sprite.state = CONTROL_STATES.TRACK_MODE;
                    sprite.timer = null;
                    sprite.play('idle');
                } else {
                    // 🔁 Continue attacking if target is still alive
                    sprite.timer = null;
                    this.attack(sprite); // Recurse after delay
                }
            });
        }
    }

    static checkForKillReward(sprite, target){
        if(sprite.body.team == 1){
            this.scene.updateMoney(Phaser.Math.Between(1000, 1500));
        }
    }

}