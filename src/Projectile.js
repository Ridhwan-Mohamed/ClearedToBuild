import Phaser from "phaser";
import { CONTROL_STATES, showGhostText, SQUARESIZE, TILE_MAP, TILE_TYPES } from "./constants";
import { Map } from "./map";
import { fightManager } from "./Manager/fightManager";
import { Player } from "./players/Player";
import { Teams } from "./Teams";
import { buildingManager } from "./Manager/buildingManager";
import { AudioManager } from "./Manager/AudioManager";

export class Projectile {
    static scene;
    static projectileGroup;

    static init(scene) {
        this.scene = scene;
        this.projectileGroup = this.scene.physics.add.group();
    }

    constructor(x, y, angle, teamNumber, weapon, player = null, offset = false) {
        // Offset the starting position by 25 units in the direction of the angle
        const speed = weapon.speed;
        let offsetX = 5, offsetY = 5;
        if(offset){
            offsetX = Math.cos(angle) * 25;
            offsetY = Math.sin(angle) * 25;
        }
        const startX = x + offsetX;
        const startY = y + offsetY;

        if(player) AudioManager.playWeaponAttack(player, player.weapon);

        // Create a graphics object for the rectangle
        const newCube = Projectile.scene.physics.add.sprite(startX, startY, 'cube');
        Projectile.projectileGroup.add(newCube);
        newCube.body.dontTrack = true;

        // Enable physics for the graphics object
        newCube.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        newCube.team = teamNumber;
        newCube.setDepth(TILE_TYPES.turret.depth);
        newCube.body.dontTrack = true;

        newCube.weapon = weapon;
        if(player) newCube.player = player;
    }

    static leadAndAngle(attacker, target, projectileSpeed) {
        if (!target.body) return { x: target.x, y: target.y };

        const dx = target.x - attacker.x;
        const dy = target.y - attacker.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const time = distance / projectileSpeed;

        return {
            x: target.x + target.body.velocity.x * time,
            y: target.y + target.body.velocity.y * time
        };
    }

    static hasLineOfSight(shooter, target) {
        const x0 = Math.floor(shooter.x / SQUARESIZE);
        const y0 = Math.floor(shooter.y / SQUARESIZE);
        const x1 = Math.floor(target.x / SQUARESIZE);
        const y1 = Math.floor(target.y / SQUARESIZE);

        // --- NEW: compute "ignore rectangle" if target is a multi-tile building ---
        // Works if the sprite has buildingRef with x/y in tile coords (your Tower has this.x/this.y)
        // and TILE_TYPES entry has lenX/lenY.
        let ignoreMinX = null, ignoreMinY = null, ignoreMaxX = null, ignoreMaxY = null;

        const building = target?.buildingRef || null;
        if (building) {
            // tile anchor for the building (top-left)
            const bx = building.x ?? building.tilePos?.tileX;
            const by = building.y ?? building.tilePos?.tileY;

            const tt = building.type || building.tileType || null; // depends on how you store it
            const lenX = tt?.lenX ?? 1;
            const lenY = tt?.lenY ?? 1;

            if (Number.isFinite(bx) && Number.isFinite(by)) {
            ignoreMinX = bx;
            ignoreMinY = by;
            ignoreMaxX = bx + lenX - 1;
            ignoreMaxY = by + lenY - 1;
            }
        }

        const line = new Phaser.Geom.Line(x0, y0, x1, y1);
        const points = Phaser.Geom.Line.BresenhamPoints(line);

        for (const p of points) {
            // --- NEW: don't let target building block itself ---
            if (
            ignoreMinX != null &&
            p.x >= ignoreMinX && p.x <= ignoreMaxX &&
            p.y >= ignoreMinY && p.y <= ignoreMaxY
            ) {
            continue;
            }

            const cell = Map.grid[p.y]?.[p.x];
            if (!Array.isArray(cell)) continue;

            const key = TILE_MAP(cell[1]);
            const type = TILE_TYPES[key];

            // keep your current rule: water doesn't block; walls/doors don't block LOS
            const isWallish =
            type === TILE_TYPES.wall ||
            type === TILE_TYPES.woodWall ||
            type === TILE_TYPES.wall_door ||
            type === TILE_TYPES.woodWall_door;

            if (type && type.block && key !== "water" && !isWallish) {
            return false;
            }
        }

        return true;
    }

    static handleCollision(target, projectile) {
        const result = fightManager.calculateHitResultFromWeapon(projectile.weapon);
        if (result.hit) {
        
            // 🔴 Apply on-hit effects to the victim (flash, timer cancel, knockback team 0)
            const attacker = projectile.player || null;
            fightManager.applyHitReaction(target, attacker, projectile.weapon);

            target.health = Math.max(0, target.health - result.damage);

            if (target.health <= 0) {
                fightManager.checkForKillReward(projectile.team, target);
                target.destroySelf();

                if (projectile.player) {
                    Teams.movePlayerState(projectile.player, CONTROL_STATES.TRACK_MODE);
                    projectile.player.track = null;
                    if (projectile.player.timer) {
                        projectile.player.timer.remove(false);
                        projectile.player.timer = null;
                    }
                    Player.setAnimState(projectile.player, projectile.player.idle);
                }

                // If you still need this removeFromStateArray, keep it:
                // Teams.removeFromStateArray(1, "fightingList", target);
            }

            showGhostText(
                Projectile.scene,
                target.x,
                target.y - 10,
                `${result.isCrit ? 'CRIT ' : ''}${result.damage}`,
                projectile.team,
                result.isCrit
            );
        } else {
            showGhostText(
                Projectile.scene,
                target.x,
                target.y - 10,
                'MISS',
                projectile.team,
                false,
                true
            );
        }

        projectile.destroy();
    }

    static handleStructureCollision(projectile, hit) {
        const weapon = projectile.weapon;
        const result = fightManager.calculateHitResultFromWeapon(weapon);

        // MISS -> text + kill bullet
        if (!result.hit) {
            // best-effort text anchor
            const hx = hit?.x ?? projectile.x;
            const hy = hit?.y ?? projectile.y;

            showGhostText(
            Projectile.scene,
            hx,
            hy - 10,
            "MISS",
            projectile.team,
            false,
            true
            );

            projectile.destroy();
            return;
        }

        const dmg = result.damage;
        const shooter = projectile.player || null;
        const teamNumber = projectile.team;

        // -----------------------
        // WALL HIT (tile task)
        // -----------------------
        if (hit.wallRef) {
            const wall = hit.wallRef;

            // If this shot is coming from a destroy task, decrement the TASK duration/HP
            // rather than random wall HP, so completion uses the same pipeline.
            const t = shooter?.task;

            // fallback: if you have wall HP system, use it
            const destroyed = wall.damage(dmg);
            
            if (destroyed) {
                buildingManager._completeDestroyTile(shooter, t, wall.x, wall.y);
            }

            showGhostText(
                Projectile.scene,
                wall.sprite?.x ?? hit.x,
                (wall.sprite?.y ?? hit.y) - 10,
                `${result.isCrit ? "CRIT " : ""}${dmg}`,
                teamNumber,
                result.isCrit
            );
            

            projectile.destroy();
            return;
        }

        // -----------------------
        // BUILDING HIT (block task)
        // -----------------------
        if (hit.buildingRef) {
            const building = hit.buildingRef;

            // If shooter is on a destroy task, decrement shared task duration and call building.onDamaged
            const t = shooter?.task;

            if (shooter && t) {
            // ensure we have a max for bar math
            t.totalDuration = t.totalDuration ?? t.duration;

            t.duration = Math.max(0, t.duration - dmg);
            // ✅ Keep building HP synced to shared task HP (so UI + later clicks stay correct)
            if (building) {
                building.maxHealth = building.maxHealth ?? t.totalDuration;
                building.health = t.duration;
            }

            // trigger the old animations + red bar behavior (tower already implements this)
            const targetObj = t.value?.buildingRef || t.value; // matches your task pattern :contentReference[oaicite:1]{index=1}
            if (targetObj && typeof targetObj.onDamaged === "function") {
                targetObj.onDamaged(dmg, t.duration, t.totalDuration);
            } else if (building && typeof building.onDamaged === "function") {
                building.onDamaged(dmg, t.duration, t.totalDuration);
            }

            // floating damage text (still useful even if onDamaged has it)
            const bx = building.sprite?.x ?? hit.x;
            const by = building.sprite?.y ?? hit.y;
            showGhostText(
                Projectile.scene,
                bx,
                by - 10,
                `${result.isCrit ? "CRIT " : ""}${dmg}`,
                teamNumber,
                result.isCrit
            );

            // FINISH: complete shared task and cleanup others
            if (t.duration <= 0) {
                buildingManager._completeDestroyBlock(shooter, t);
            }

            projectile.destroy();
            return;
            }

            // No task: treat as normal "damage building health" path if present
            if (typeof building.takeDamage === "function") {
            building.takeDamage(dmg);
            } else if (typeof building.onDamaged === "function") {
            // if you store real health, you’d pass current/max; here best-effort:
            building.onDamaged(dmg, Math.max(0, (building.health ?? 0) - dmg), building.maxHealth ?? building.health ?? 1);
            building.health = Math.max(0, (building.health ?? 0) - dmg);
            if (building.health <= 0 && typeof building.destroy === "function") building.destroy();
            }

            projectile.destroy();
            return;
        }

        // unknown structure collider
        projectile.destroy();
    }
}
