import Phaser from "phaser";
import { CONTROL_STATES, SQUARESIZE, TILE_MAP, TILE_TYPES, UIDEPTH } from "../constants";
import { Player } from "./Player";
import { Teams } from "../Teams";
import { Map } from "../map";
import { Raider } from "./Raider";
import { Wall } from "../buildings/Wall";
import { buildingManager } from "../Manager/buildingManager";
import { fightManager } from "../Manager/fightManager";
import { ZoomMixer } from "../UI/ZoomMixer";
import { attachDirectionalSix } from "./PlayerDirectionalAnimator";
import shockerWalkDown from "url:../assets/Players/shocker/shocker_walk_down.png";
import shockerWalkDownLeft from "url:../assets/Players/shocker/shocker_walk_down_left.png";
import shockerWalkDownRight from "url:../assets/Players/shocker/shocker_walk_down_right.png";
import shockerWalkUp from "url:../assets/Players/shocker/shocker_walk_up.png";
import shockerWalkUpLeft from "url:../assets/Players/shocker/shocker_walk_up_left.png";
import shockerWalkUpRight from "url:../assets/Players/shocker/shocker_walk_up_right.png";
import raiderSwimUp from "url:../assets/players/raider/raider_swim_up.png";
import raiderSwimDown from "url:../assets/players/raider/raider_swim_down.png";
import raiderSwimSidewards from "url:../assets/players/raider/raider_swim_sidewards.png";

const SHOCK_RANGE = SQUARESIZE * 4.8;
const WALL_SHOCK_RANGE = SQUARESIZE * 5.25;
const CHARGE_MS = 170;
const COOLDOWN_MS = 900;
const WALL_DAMAGE_PRIMARY = 72;
const WALL_DAMAGE_CHAIN = 34;
const BUILDING_DAMAGE = 40;
const PLAYER_DAMAGE = 26;

export class Shocker {
    static speed = 66;
    static stamina = 0;
    static awareness = SQUARESIZE * 5.2;
    static tint = 0x9c8cff;

    static preload(scene) {
        scene.load.spritesheet("shocker_walk_down", shockerWalkDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_walk_down_left", shockerWalkDownLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_walk_down_right", shockerWalkDownRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_walk_up", shockerWalkUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_walk_up_left", shockerWalkUpLeft, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_walk_up_right", shockerWalkUpRight, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_swim_up", raiderSwimUp, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_swim_down", raiderSwimDown, { frameWidth: 32, frameHeight: 32 });
        scene.load.spritesheet("shocker_swim_sidewards", raiderSwimSidewards, { frameWidth: 32, frameHeight: 32 });
    }

    constructor(x, y, teamNumber = 0) {
        const shocker = Player.addPlayer(
            x,
            y,
            teamNumber,
            "shocker_walk_down",
            "walk",
            "idle",
            "action",
            {
                name: "Shocker Arc",
                baseDmg: PLAYER_DAMAGE,
                range: SHOCK_RANGE,
                duration: COOLDOWN_MS,
                projectile: false,
            }
        );

        shocker.name = "The Shocker";
        shocker.unitTint = Shocker.tint;
        shocker.type = Shocker;
        shocker.isRaider = true;
        shocker.isShocker = true;
        shocker.isBoss = true;
        shocker.roam = false;
        shocker.maxHealth = 2200;
        shocker.health = shocker.maxHealth;
        shocker.killReward = 0;
        shocker.maxStamina = shocker.maxStamina ?? 100;
        shocker.stamina = shocker.stamina ?? shocker.maxStamina;
        shocker.customDoAction = () => Shocker.handleAction(shocker);
        shocker.destroySelf = (opts = {}) => Shocker.destroy(shocker, opts);
        shocker._bobPhase = Math.random() * Math.PI * 2;
        shocker._bobAppliedOffset = 0;
        shocker._shockerChargeFx = null;
        shocker._shockerChargeEvent = null;
        shocker._shockerLightningSerial = 0;

        attachDirectionalSix(shocker, {
            animPrefix: "shocker",
            defaultDirection: "down",
            walkStateKey: "walk",
            idleStateKey: "idle",
            swimStateKey: "swim",
            idleFrame: 0,
            swimIdleFrame: 1,
            frameRate: 4,
            swimFrameRate: 8,
            frameEnd: 0,
            swimFrameEnd: 2,
            directions: {
                down: "shocker_walk_down",
                down_left: "shocker_walk_down_left",
                down_right: "shocker_walk_down_right",
                up: "shocker_walk_up",
                up_left: "shocker_walk_up_left",
                up_right: "shocker_walk_up_right",
            },
            swimDirections: {
                up: "shocker_swim_up",
                down: "shocker_swim_down",
                side: "shocker_swim_sidewards",
            },
        });

        ZoomMixer.createPlayerMoniker(shocker);
        return shocker;
    }

    static update(troop) {
        return Raider.update(troop);
    }

    static postUpdate(troop) {
        if (!troop?.active) return;
        const now = troop.scene?.getSimulationNow?.() ?? troop.scene?.simNowMs ?? troop.scene?.time?.now ?? 0;
        const baseY = troop.y - Number(troop._bobAppliedOffset || 0);
        const moving = (troop.body?.velocity?.lengthSq?.() ?? 0) > 36;
        const amplitude = moving ? 3.2 : 2.1;
        const bob = Math.sin((now * 0.008) + Number(troop._bobPhase || 0)) * amplitude;
        troop.y = baseY + bob;
        troop._bobAppliedOffset = bob;
    }

    static handleAction(troop) {
        if (!troop?.active || !troop.isShocker) return false;
        const state = troop.state;
        const intercept = (
            state === CONTROL_STATES.ATTACK_MODE
            || state === CONTROL_STATES.DESTROY_MODE
            || state === CONTROL_STATES.DESTROY_MODE_T
            || state === CONTROL_STATES.SIEGE_MODE
        );
        if (!intercept) return false;
        if (troop.timer) return true;

        const plan = Shocker._resolveShockPlan(troop);
        if (!plan) {
            if (state === CONTROL_STATES.ATTACK_MODE) {
                Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);
            }
            return true;
        }

        troop.body?.setVelocity?.(0, 0);
        troop.currentPath?.splice?.(0);
        Player.setAnimState?.(troop, troop.idle);
        Shocker._startShockCycle(troop, plan);
        return true;
    }

    static destroy(troop, opts = {}) {
        if (!troop) return;
        Shocker._clearShockCycle(troop);
        if (!opts?.silentStageCleanup && troop.scene?._activeShockerBoss === troop && !troop._shockerDefeatHandled) {
            troop._shockerDefeatHandled = true;
            troop.scene.handleShockerBossDefeated?.(troop);
        }
        return Raider.destroy(troop, opts);
    }

    static _startShockCycle(troop, plan) {
        const scene = troop.scene;
        const cycleDelay = Shocker._currentCooldownMs(troop);
        const chargeFx = scene.add.circle(troop.x, troop.y, 10, 0x9dd7ff, 0.12)
            .setStrokeStyle(2, 0xe6fbff, 0.8)
            .setDepth((troop.depth ?? UIDEPTH) + 1);
        troop._shockerChargeFx = chargeFx;

        scene.tweens.add({
            targets: chargeFx,
            radius: plan.primary?.kind === "wall" ? 34 : 26,
            alpha: 0,
            duration: CHARGE_MS,
            ease: "Cubic.easeOut",
            onComplete: () => {
                chargeFx.destroy();
                if (troop._shockerChargeFx === chargeFx) troop._shockerChargeFx = null;
            },
        });

        troop.setTint?.(0xdff6ff);
        troop._shockerChargeEvent?.remove?.(false);
        troop._shockerChargeEvent = scene.time.delayedCall(CHARGE_MS, () => {
            troop._shockerChargeEvent = null;
            if (!troop?.active) return;
            troop.clearTint?.();
            Shocker._executeShock(troop, plan);
        });

        troop.timer = scene.time.delayedCall(cycleDelay, () => {
            troop.timer = null;
            if (!troop?.active) return;
            troop.clearTint?.();
            const nextPlan = Shocker._resolveShockPlan(troop);
            if (!nextPlan) {
                if (troop.state === CONTROL_STATES.ATTACK_MODE) {
                    Teams.movePlayerState(troop, CONTROL_STATES.TRACK_TARGET);
                }
                return;
            }
            Shocker._startShockCycle(troop, nextPlan);
        });
    }

    static _clearShockCycle(troop) {
        troop?.timer?.remove?.(false);
        troop.timer = null;
        troop?._shockerChargeEvent?.remove?.(false);
        troop._shockerChargeEvent = null;
        troop?._shockerChargeFx?.destroy?.();
        troop._shockerChargeFx = null;
        troop?.clearTint?.();
    }

    static _resolveShockPlan(troop) {
        const intensity = Shocker._getIntensity(troop);
        const sameRegionTargets = Shocker._collectSameRegionTargets(troop);
        const contextualPrimary = Shocker._resolveContextualPrimary(troop);
        let primary = contextualPrimary;

        if (!primary && sameRegionTargets.length) {
            primary = sameRegionTargets.shift();
        }

        const primaryId = Shocker._descriptorId(primary);
        const chains = sameRegionTargets
            .filter((entry) => Shocker._descriptorId(entry) !== primaryId)
            .slice(0, intensity.chainCount);

        const sideWalls = Shocker._collectNearbyWalls(troop, WALL_SHOCK_RANGE)
            .filter((entry) => Shocker._descriptorId(entry) !== primaryId)
            .slice(0, intensity.sideWallCount);

        if (!primary && sideWalls.length) {
            primary = sideWalls.shift();
        }
        if (!primary) return null;

        return {
            primary,
            chains,
            sideWalls,
        };
    }

    static _resolveContextualPrimary(troop) {
        const target = troop.forcedTarget?.active
            ? troop.forcedTarget
            : troop.track?.[0]?.gameObject;
        if (target?.active && Shocker._canShockSameRegionTarget(troop, target, SHOCK_RANGE)) {
            return Shocker._describeTarget("player", target, troop);
        }

        const wallTask = Shocker._getTaskWall(troop);
        if (wallTask?.wall && Shocker._distanceToWall(troop, wallTask.wall) <= WALL_SHOCK_RANGE) {
            return wallTask;
        }

        const buildingTarget = troop.task?.value?.buildingRef || troop.task?.value || null;
        if (buildingTarget && Shocker._isBuildingActive(buildingTarget) && Shocker._canShockSameRegionTarget(troop, buildingTarget, SHOCK_RANGE)) {
            return Shocker._describeTarget("building", buildingTarget, troop);
        }

        return null;
    }

    static _collectSameRegionTargets(troop) {
        const out = [];
        const pushIfValid = (kind, target) => {
            if (!target?.active) return;
            if (!Shocker._canShockSameRegionTarget(troop, target, SHOCK_RANGE)) return;
            out.push(Shocker._describeTarget(kind, target, troop));
        };

        for (const target of Teams.teamLists?.["1"]?.playerList || []) {
            if (!target?.active) continue;
            pushIfValid("player", target);
        }

        for (const entry of Teams.teamLists?.["1"]?.buildings || []) {
            const building = entry?.[3]?.buildingRef || entry?.[3] || null;
            if (!building || !Shocker._isBuildingActive(building)) continue;
            pushIfValid("building", building);
        }

        out.sort((a, b) => {
            const pa = Shocker._priorityForDescriptor(a);
            const pb = Shocker._priorityForDescriptor(b);
            if (pa !== pb) return pa - pb;
            return a.distance - b.distance;
        });
        return out;
    }

    static _collectNearbyWalls(troop, range) {
        const walls = [];
        for (const wall of Wall.byCell.values()) {
            if (!wall?.active) continue;
            const dist = Shocker._distanceToWall(troop, wall);
            if (dist > range) continue;
            walls.push({
                kind: "wall",
                target: wall,
                wall,
                x: wall.sprite?.x ?? (wall.x * SQUARESIZE + SQUARESIZE / 2),
                y: wall.sprite?.y ?? (wall.y * SQUARESIZE + SQUARESIZE / 2),
                distance: dist,
                task: Shocker._makeWallTask(wall),
            });
        }
        walls.sort((a, b) => a.distance - b.distance);
        return walls;
    }

    static _executeShock(troop, plan) {
        if (!troop?.active || !plan?.primary) return;
        const targets = [plan.primary, ...(plan.chains || []), ...(plan.sideWalls || [])];
        const unique = [];
        const seen = new Set();
        targets.forEach((entry) => {
            const id = Shocker._descriptorId(entry);
            if (!id || seen.has(id)) return;
            seen.add(id);
            unique.push(entry);
        });

        const from = { x: troop.x, y: troop.y - 8 };
        unique.forEach((entry, index) => {
            const to = Shocker._targetPoint(entry);
            Shocker._drawElectricArc(troop.scene, from, to, index);
            Shocker._applyShockDamage(troop, entry, index === 0);
        });
    }

    static _applyShockDamage(troop, entry, isPrimary) {
        if (!entry) return false;
        if (entry.kind === "player") {
            const target = entry.target;
            if (!target?.active) return false;
            target.health = Math.max(0, Number(target.health || 0) - PLAYER_DAMAGE);
            fightManager.applyHitReaction(target, troop, troop.weapon);
            if (target.health <= 0) {
                Player.destroyPlayer(target);
            }
            return true;
        }

        if (entry.kind === "building") {
            const target = entry.target;
            if (!Shocker._isBuildingActive(target)) return false;
            const tempTask = { value: target, duration: Number(target.health ?? target.hp ?? target.maxHealth ?? target.maxHp ?? 1) };
            const result = buildingManager.applyDestroyDamage(tempTask, BUILDING_DAMAGE);
            if (result?.destroyed) {
                target.destroy?.();
            }
            return true;
        }

        if (entry.kind === "wall") {
            const wall = entry.wall || entry.target;
            if (!wall?.active) return false;
            const destroyed = wall.damage(isPrimary ? WALL_DAMAGE_PRIMARY : WALL_DAMAGE_CHAIN);
            if (destroyed) {
                buildingManager._completeDestroyTile(troop, entry.task || Shocker._makeWallTask(wall), wall.x, wall.y);
            }
            return true;
        }

        return false;
    }

    static _describeTarget(kind, target, troop = null) {
        const point = Shocker._worldPointForTarget(target);
        return {
            kind,
            target,
            x: point.x,
            y: point.y,
            distance: troop ? Phaser.Math.Distance.Between(troop.x, troop.y, point.x, point.y) : 0,
        };
    }

    static _worldPointForTarget(target) {
        const sprite = target?.sprite || target?.baseSprite || target;
        return {
            x: Number(sprite?.x ?? target?.x ?? 0),
            y: Number(sprite?.y ?? target?.y ?? 0),
        };
    }

    static _priorityForDescriptor(entry) {
        if (!entry) return 99;
        if (entry.kind === "player") return 0;
        const target = entry.target;
        const tileName = target?.tileType?.name ?? target?.type?.name ?? null;
        if (tileName === "tower") return 1;
        if (entry.kind === "building") return 2;
        return 4;
    }

    static _canShockSameRegionTarget(troop, target, range = SHOCK_RANGE) {
        if (!troop?.active || !target?.active) return false;
        const point = Shocker._worldPointForTarget(target);
        const dist = Phaser.Math.Distance.Between(troop.x, troop.y, point.x, point.y);
        if (dist > range) return false;
        if (!Map.enemyRegionSystem?.canReachWorldToWorld) return true;
        return !!Map.enemyRegionSystem.canReachWorldToWorld(troop.x, troop.y, point.x, point.y);
    }

    static _descriptorId(entry) {
        if (!entry) return null;
        if (entry.kind === "wall") return `wall:${entry.wall?.x},${entry.wall?.y}`;
        return `${entry.kind}:${entry.target?.id ?? entry.target?.x ?? 0}:${entry.target?.y ?? 0}`;
    }

    static _targetPoint(entry) {
        return {
            x: Number(entry?.x ?? 0),
            y: Number(entry?.y ?? 0),
        };
    }

    static _distanceToWall(troop, wall) {
        const x = wall?.sprite?.x ?? (wall?.x * SQUARESIZE + SQUARESIZE / 2);
        const y = wall?.sprite?.y ?? (wall?.y * SQUARESIZE + SQUARESIZE / 2);
        return Phaser.Math.Distance.Between(troop.x, troop.y, x, y);
    }

    static _isBuildingActive(target) {
        if (!target || target._destroyed || target._isDestroyed) return false;
        const health = Number(target.health ?? target.hp ?? target.maxHealth ?? target.maxHp ?? 1);
        if (health <= 0) return false;
        const sprite = target.sprite || target.baseSprite || target;
        return sprite?.active !== false;
    }

    static _getTaskWall(troop) {
        const task = troop?.task;
        if (!task) return null;
        const tx = Number(task.tx ?? task.x);
        const ty = Number(task.ty ?? task.y);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
        const wall = Wall.getAt(tx, ty);
        if (!wall?.active) return null;
        return {
            kind: "wall",
            target: wall,
            wall,
            x: wall.sprite?.x ?? (tx * SQUARESIZE + SQUARESIZE / 2),
            y: wall.sprite?.y ?? (ty * SQUARESIZE + SQUARESIZE / 2),
            distance: Shocker._distanceToWall(troop, wall),
            task: Shocker._makeWallTask(wall),
        };
    }

    static _makeWallTask(wall) {
        const gridCell = Map.grid?.[wall.y]?.[wall.x];
        const top = Array.isArray(gridCell) ? gridCell[1] : gridCell;
        const typeName = TILE_MAP(top) || (wall.isDoor ? (wall.material === "wood" ? "woodWall_door" : "wall_door") : (wall.material === "wood" ? "woodWall" : "wall"));
        return {
            x: wall.x,
            y: wall.y,
            tx: wall.x,
            ty: wall.y,
            type: TILE_TYPES[typeName] || { name: typeName },
            assigned: 0,
            siege: true,
        };
    }

    static _drawElectricArc(scene, from, to, arcIndex = 0) {
        const g = scene.add.graphics().setDepth((UIDEPTH ?? 2000) + 180);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.max(12, Math.hypot(dx, dy));
        const norm = { x: dx / length, y: dy / length };
        const perp = { x: -norm.y, y: norm.x };
        const segments = Math.max(5, Math.round(length / 18));
        const jitter = 10 + Math.min(14, length * 0.05) + (arcIndex * 1.8);

        const drawLayer = (width, color, alpha, variance) => {
            g.lineStyle(width, color, alpha);
            g.beginPath();
            g.moveTo(from.x, from.y);
            for (let i = 1; i < segments; i++) {
                const t = i / segments;
                const alongX = Phaser.Math.Linear(from.x, to.x, t);
                const alongY = Phaser.Math.Linear(from.y, to.y, t);
                const offset = (Math.random() * 2 - 1) * variance;
                g.lineTo(
                    alongX + perp.x * offset,
                    alongY + perp.y * offset
                );
            }
            g.lineTo(to.x, to.y);
            g.strokePath();
        };

        drawLayer(5, 0x4b1f8f, 0.34, jitter + 6);
        drawLayer(3, 0x7dd3fc, 0.92, jitter);
        drawLayer(1.6, 0xffffff, 0.96, Math.max(4, jitter * 0.45));

        scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 180,
            ease: "Quad.easeOut",
            onComplete: () => g.destroy(),
        });
    }

    static _getIntensity(troop) {
        const ratio = Math.max(0, Math.min(1, Number(troop?.health || 0) / Math.max(1, Number(troop?.maxHealth || 1))));
        if (ratio <= 0.25) {
            return { chainCount: 3, sideWallCount: 3, cooldownScale: 0.68 };
        }
        if (ratio <= 0.5) {
            return { chainCount: 2, sideWallCount: 2, cooldownScale: 0.78 };
        }
        if (ratio <= 0.75) {
            return { chainCount: 2, sideWallCount: 1, cooldownScale: 0.88 };
        }
        return { chainCount: 1, sideWallCount: 1, cooldownScale: 1 };
    }

    static _currentCooldownMs(troop) {
        const intensity = Shocker._getIntensity(troop);
        return Math.max(540, Math.round(COOLDOWN_MS * intensity.cooldownScale));
    }
}
