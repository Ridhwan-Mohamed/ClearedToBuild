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

    constructor(x, y, angle, teamNumber, weapon, player = null, offset = false, options = null) {
        // Offset the starting position by 25 units in the direction of the angle
        const speed = weapon?.speed ?? 0;
        let offsetX = 0, offsetY = 0;
        if(typeof offset === "number"){
            offsetX = Math.cos(angle) * offset;
            offsetY = Math.sin(angle) * offset;
        }
        else if(offset){
            offsetX = Math.cos(angle) * 25;
            offsetY = Math.sin(angle) * 25;
        }
        const startX = x + offsetX;
        const startY = y + offsetY;

        if(player) AudioManager.playWeaponAttack(player, player.weapon);

        // Create a graphics object for the rectangle
        const textureKey = weapon?.projectileTextureKey ?? 'cube';
        const textureFrame = weapon?.projectileFrame ?? undefined;
        const newCube = Projectile.scene.physics.add.sprite(startX, startY, textureKey, textureFrame);
        Projectile.projectileGroup.add(newCube);
        newCube.body.dontTrack = true;
        newCube.team = teamNumber;
        newCube.weapon = weapon;
        if(player) newCube.player = player;

        const deferImpactUntilEnd =
            !!weapon?.impactAtEndOnly &&
            Number.isFinite(Number(options?.impactX)) &&
            Number.isFinite(Number(options?.impactY));
        newCube.deferImpactUntilEnd = deferImpactUntilEnd;

        // Enable physics for the graphics object
        newCube.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        newCube.setDepth(weapon?.projectileDepth ?? TILE_TYPES.turret.depth);
        newCube.body.dontTrack = true;
        if (deferImpactUntilEnd) {
            newCube.body.checkCollision.none = true;
            Projectile.scheduleImpactResolution(newCube, weapon, options);
        }

        if (weapon?.projectileAnimKey && Projectile.scene.anims.exists(weapon.projectileAnimKey)) {
            newCube.play(weapon.projectileAnimKey, true);
        }

        Projectile.applyTravelScaleArc(newCube, weapon, options);
    }

    static getTravelDurationMs(weapon, options = null) {
        const travelDistance = Number(options?.travelDistance ?? 0);
        if (!travelDistance || !weapon) return 0;
        return Math.max(200, Math.round((travelDistance / Math.max(weapon.speed ?? 1, 1)) * 1000));
    }

    static applyTravelScaleArc(projectile, weapon, options = null) {
        if (!projectile || !weapon) return;

        const startScale = Number.isFinite(options?.startScale)
            ? options.startScale
            : weapon.projectileScaleStart;
        const endScale = Number.isFinite(options?.endScale)
            ? options.endScale
            : weapon.projectileScaleEnd;

        if (Number.isFinite(startScale)) {
            projectile.setScale(startScale);
        }

        const travelDistance = Number(options?.travelDistance ?? 0);
        if (!travelDistance || !Number.isFinite(startScale) || !Number.isFinite(endScale)) return;

        const distanceRatio = Phaser.Math.Clamp(
            Number(options?.distanceRatio ?? (travelDistance / Math.max(weapon.range ?? travelDistance, 1))),
            0,
            1
        );

        const defaultPeakScale = Phaser.Math.Linear(
            Number.isFinite(weapon.projectilePeakScaleMin) ? weapon.projectilePeakScaleMin : startScale,
            Number.isFinite(weapon.projectilePeakScaleMax) ? weapon.projectilePeakScaleMax : Math.max(startScale, endScale),
            distanceRatio
        );
        const peakScale = Number.isFinite(options?.peakScale) ? options.peakScale : defaultPeakScale;
        const travelMs = this.getTravelDurationMs(weapon, options);

        projectile._travelScaleTween?.remove?.();
        projectile._travelScaleTween = Projectile.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: travelMs,
            ease: "Linear",
            onUpdate: (tween) => {
                if (!projectile.active) return;
                const t = tween.getValue();
                const baseScale = Phaser.Math.Linear(startScale, endScale, t);
                const arcT = 4 * t * (1 - t);
                projectile.setScale(baseScale + arcT * (peakScale - Math.max(startScale, endScale)));
            },
            onComplete: () => {
                projectile._travelScaleTween = null;
            },
        });

        projectile.once("destroy", () => {
            projectile._travelScaleTween?.remove?.();
            projectile._travelScaleTween = null;
        });
    }

    static scheduleImpactResolution(projectile, weapon, options = null) {
        if (!projectile?.active || !weapon?.impactAtEndOnly) return;

        const impactX = Number(options?.impactX);
        const impactY = Number(options?.impactY);
        if (!Number.isFinite(impactX) || !Number.isFinite(impactY)) return;

        const travelMs = this.getTravelDurationMs(weapon, options);
        if (!travelMs) return;

        projectile._impactTimer?.remove?.(false);
        projectile._impactTimer = Projectile.scene.time.delayedCall(travelMs, () => {
            projectile._impactTimer = null;
            this.resolveImpactAtPoint(projectile, impactX, impactY, options);
        });

        projectile.once("destroy", () => {
            projectile._impactTimer?.remove?.(false);
            projectile._impactTimer = null;
        });
    }

    static resolveImpactAtPoint(projectile, impactX, impactY, options = null) {
        if (!projectile?.active) return;

        projectile._resolvingImpact = true;
        projectile.body?.setVelocity?.(0, 0);
        projectile.setPosition(impactX, impactY);

        const impactRadius = Math.max(10, Number(options?.impactRadius ?? projectile.weapon?.impactRadius ?? 18));
        const preferredTarget = options?.impactTarget ?? null;

        const target = this.findImpactTarget(projectile, impactX, impactY, impactRadius, preferredTarget);
        if (target) {
            this.handleCollision(target, projectile);
            return;
        }

        const structureHit = this.findImpactStructure(projectile, impactX, impactY, impactRadius);
        if (structureHit) {
            this.handleStructureCollision(projectile, structureHit);
            return;
        }

        showGhostText(
            Projectile.scene,
            impactX,
            impactY - 10,
            "MISS",
            projectile.team,
            false,
            true
        );
        projectile.destroy();
    }

    static findImpactTarget(projectile, impactX, impactY, impactRadius, preferredTarget = null) {
        const radiusSq = impactRadius * impactRadius;
        const isValidEnemy = (target) =>
            !!target?.active &&
            !!target.body &&
            target.body.team != null &&
            target.body.team !== projectile.team &&
            !target.dontTrack &&
            !target.body.dontTrack &&
            (target.health ?? 1) > 0;

        if (isValidEnemy(preferredTarget)) {
            const distSq = Phaser.Math.Distance.Squared(preferredTarget.x, preferredTarget.y, impactX, impactY);
            if (distSq <= radiusSq) return preferredTarget;
        }

        let nearest = null;
        let nearestDistSq = radiusSq;
        for (const target of Player.troops) {
            if (!isValidEnemy(target)) continue;
            const distSq = Phaser.Math.Distance.Squared(target.x, target.y, impactX, impactY);
            if (distSq > nearestDistSq) continue;
            nearest = target;
            nearestDistSq = distSq;
        }
        return nearest;
    }

    static findImpactStructure(projectile, impactX, impactY, impactRadius) {
        const hits = Map.structureBarrier?.getChildren?.() ?? [];
        let nearest = null;
        let nearestDistSq = impactRadius * impactRadius;

        for (const hit of hits) {
            if (!hit?.active) continue;

            const hitTeam = hit.team ?? hit.body?.team;
            if (hitTeam != null && hitTeam === projectile.team) continue;

            const left = Number.isFinite(hit.body?.left) ? hit.body.left : (hit.x - (hit.displayWidth ?? 0) / 2);
            const right = Number.isFinite(hit.body?.right) ? hit.body.right : (hit.x + (hit.displayWidth ?? 0) / 2);
            const top = Number.isFinite(hit.body?.top) ? hit.body.top : (hit.y - (hit.displayHeight ?? 0) / 2);
            const bottom = Number.isFinite(hit.body?.bottom) ? hit.body.bottom : (hit.y + (hit.displayHeight ?? 0) / 2);

            const nearestX = Phaser.Math.Clamp(impactX, left, right);
            const nearestY = Phaser.Math.Clamp(impactY, top, bottom);
            const distSq = Phaser.Math.Distance.Squared(impactX, impactY, nearestX, nearestY);
            if (distSq > nearestDistSq) continue;

            nearest = hit;
            nearestDistSq = distSq;
        }

        return nearest;
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

        const resolveIgnoreRect = (obj) => {
            const building = obj?.buildingRef || obj?.gameObject?.buildingRef || null;
            if (!building) return null;

            const bx = building.x ?? building.gridX ?? building.tilePos?.tileX;
            const by = building.y ?? building.gridY ?? building.tilePos?.tileY;
            const tt = building.type || building.tileType || null;
            const lenX = tt?.lenX ?? 1;
            const lenY = tt?.lenY ?? 1;

            if (!Number.isFinite(bx) || !Number.isFinite(by)) return null;

            return {
                minX: bx,
                minY: by,
                maxX: bx + lenX - 1,
                maxY: by + lenY - 1,
            };
        };

        const ignoreRects = [resolveIgnoreRect(shooter), resolveIgnoreRect(target)].filter(Boolean);

        const line = new Phaser.Geom.Line(x0, y0, x1, y1);
        const points = Phaser.Geom.Line.BresenhamPoints(line);

        for (const p of points) {
            if (ignoreRects.some((rect) =>
                p.x >= rect.minX &&
                p.x <= rect.maxX &&
                p.y >= rect.minY &&
                p.y <= rect.maxY
            )) {
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
                Player.destroyPlayer(target);

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
