const SIX_DIRECTION_KEYS = ["down", "down_left", "down_right", "up", "up_left", "up_right"];
const SWIM_DIRECTION_KEYS = ["up", "down", "side"];

function createDirectionalAnim(scene, animKey, textureKey, frameRate, frameEnd = 2) {
    if (scene.anims.exists(animKey)) return;
    scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(textureKey, { start: 0, end: Math.max(0, Number(frameEnd) || 0) }),
        frameRate,
        repeat: -1
    });
}

function getDirectionProfileEntry(profile, dirKey) {
    return profile?.directions?.[dirKey] || profile?.directions?.down;
}

function getSwimProfileEntry(profile, dirKey) {
    return profile?.swimDirections?.[dirKey] || profile?.swimDirections?.down || profile?.swimDirections?.side;
}

function showDirectionalIdle(troop, dirKey) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    const entry = getDirectionProfileEntry(profile, dirKey);
    if (!entry) return false;

    troop.rotation = 0;
    troop.setFlipX(false);
    troop.anims.stop();
    troop.setTexture(entry.textureKey, profile.idleFrame);
    return true;
}

function playDirectionalWalk(troop, dirKey) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    const entry = getDirectionProfileEntry(profile, dirKey);
    if (!entry) return false;

    troop.rotation = 0;
    troop.setFlipX(false);

    const currentAnimKey = troop.anims?.currentAnim?.key;
    if (currentAnimKey !== entry.animKey || !troop.anims?.isPlaying) {
        troop.play(entry.animKey, true);
    }
    return true;
}

function showDirectionalSwimIdle(troop, dirKey) {
    const profile = troop?.directionalMove;
    if (!profile?.swimDirections) return false;

    const entry = getSwimProfileEntry(profile, dirKey);
    if (!entry) return false;

    troop.rotation = 0;
    troop.setFlipX(dirKey === "side" && profile.lastSwimFlipX === true);
    troop.anims.stop();
    troop.setTexture(entry.textureKey, profile.swimIdleFrame);
    return true;
}

function playDirectionalSwim(troop, dirKey) {
    const profile = troop?.directionalMove;
    if (!profile?.swimDirections) return false;

    const entry = getSwimProfileEntry(profile, dirKey);
    if (!entry) return false;

    troop.rotation = 0;
    troop.setFlipX(dirKey === "side" && profile.lastSwimFlipX === true);

    const currentAnimKey = troop.anims?.currentAnim?.key;
    if (currentAnimKey !== entry.animKey || !troop.anims?.isPlaying) {
        troop.play(entry.animKey, true);
    }
    return true;
}

function chooseHorizontalDiagonal(vx, lastDirection) {
    if (vx > 0) {
        if (lastDirection === "up_right" || lastDirection === "up") return "up_right";
        return "down_right";
    }
    if (lastDirection === "up_left" || lastDirection === "up") return "up_left";
    return "down_left";
}

function pickSixDirection(vx, vy, lastDirection = "down") {
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);

    if (absX < 0.001 && absY < 0.001) return lastDirection;

    if (absY <= absX * 0.35) {
        return chooseHorizontalDiagonal(vx, lastDirection);
    }

    if (absY >= absX * 1.2) {
        return vy < 0 ? "up" : "down";
    }

    if (vx > 0) {
        return vy < 0 ? "up_right" : "down_right";
    }
    return vy < 0 ? "up_left" : "down_left";
}

function pickSwimDirection(vx, vy, lastDirection = "down") {
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);

    if (absX < 0.001 && absY < 0.001) {
        if (lastDirection === "side") return "side";
        return lastDirection === "up" ? "up" : "down";
    }

    if (absY > absX * 1.15) {
        return vy < 0 ? "up" : "down";
    }

    return "side";
}

export function attachDirectionalSix(troop, config) {
    if (!troop?.scene) return troop;

    const profile = {
        walkStateKey: config.walkStateKey || "walk",
        idleStateKey: config.idleStateKey || "idle",
        swimStateKey: config.swimStateKey || "swim",
        idleFrame: Number.isFinite(config.idleFrame) ? config.idleFrame : 1,
        swimIdleFrame: Number.isFinite(config.swimIdleFrame) ? config.swimIdleFrame : 1,
        frameRate: Number.isFinite(config.frameRate) ? config.frameRate : 7,
        swimFrameRate: Number.isFinite(config.swimFrameRate) ? config.swimFrameRate : 8,
        frameEnd: Number.isFinite(config.frameEnd) ? config.frameEnd : 2,
        swimFrameEnd: Number.isFinite(config.swimFrameEnd) ? config.swimFrameEnd : 2,
        lastDirection: config.defaultDirection || "down",
        lastSwimDirection: "down",
        lastSwimFlipX: false,
        directions: {},
        swimDirections: {}
    };

    SIX_DIRECTION_KEYS.forEach((dirKey) => {
        const textureKey = config.directions?.[dirKey];
        if (!textureKey) return;

        const animKey = `${config.animPrefix || "unit"}_${dirKey}_walk`;
        createDirectionalAnim(troop.scene, animKey, textureKey, profile.frameRate, profile.frameEnd);

        profile.directions[dirKey] = {
            textureKey,
            animKey
        };
    });

    SWIM_DIRECTION_KEYS.forEach((dirKey) => {
        const textureKey = config.swimDirections?.[dirKey];
        if (!textureKey) return;

        const animKey = `${config.animPrefix || "unit"}_${dirKey}_swim`;
        createDirectionalAnim(troop.scene, animKey, textureKey, profile.swimFrameRate, profile.swimFrameEnd);

        profile.swimDirections[dirKey] = {
            textureKey,
            animKey
        };
    });

    troop.directionalMove = profile;

    if (!troop._directionalPlayWrapped) {
        const originalPlay = troop.play.bind(troop);
        troop._originalPlay = originalPlay;

        troop.play = function wrappedPlay(key, ignoreIfPlaying) {
            const moveProfile = this.directionalMove;
            if (
                moveProfile &&
                (
                    key === moveProfile.walkStateKey ||
                    key === moveProfile.idleStateKey ||
                    key === moveProfile.swimStateKey
                )
            ) {
                this.animState = key;
                syncDirectionalAnimationState(this, key);
                return this;
            }
            return originalPlay(key, ignoreIfPlaying);
        };

        troop._directionalPlayWrapped = true;
    }

    syncDirectionalAnimationState(troop, profile.idleStateKey);
    return troop;
}

export function syncDirectionalAnimationState(troop, state) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    if (state === profile.walkStateKey) {
        return playDirectionalWalk(troop, profile.lastDirection);
    }

    if (state === profile.idleStateKey) {
        return showDirectionalIdle(troop, profile.lastDirection);
    }

    if (state === profile.swimStateKey) {
        return playDirectionalSwim(troop, profile.lastSwimDirection);
    }

    return false;
}

export function updateDirectionalAnimationFromVelocity(troop, vx, vy, moving = true) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    const speedSq = vx * vx + vy * vy;

    if (!moving || speedSq < 1) {
        if (troop.animState === profile.idleStateKey) {
            return showDirectionalIdle(troop, profile.lastDirection);
        }
        if (troop.animState === profile.swimStateKey) {
            return showDirectionalSwimIdle(troop, profile.lastSwimDirection);
        }
        return false;
    }

    if (troop.animState === profile.swimStateKey) {
        const nextSwimDirection = pickSwimDirection(vx, vy, profile.lastSwimDirection);
        profile.lastSwimDirection = nextSwimDirection;
        profile.lastSwimFlipX = nextSwimDirection === "side" && vx < 0;
        return playDirectionalSwim(troop, nextSwimDirection);
    }

    const nextDirection = pickSixDirection(vx, vy, profile.lastDirection);
    profile.lastDirection = nextDirection;

    if (troop.animState === profile.walkStateKey) {
        return playDirectionalWalk(troop, nextDirection);
    }

    return false;
}

export function faceDirectionalTowardVector(troop, vx, vy, opts = {}) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    const speedSq = vx * vx + vy * vy;
    if (speedSq < 0.0001) return false;

    const forceSwim = opts.forceSwim === true;
    const useSwimFacing = forceSwim || troop.animState === profile.swimStateKey;
    if (useSwimFacing) {
        const nextSwimDirection = pickSwimDirection(vx, vy, profile.lastSwimDirection);
        profile.lastSwimDirection = nextSwimDirection;
        profile.lastSwimFlipX = nextSwimDirection === "side" && vx < 0;
        return showDirectionalSwimIdle(troop, nextSwimDirection);
    }

    const nextDirection = pickSixDirection(vx, vy, profile.lastDirection);
    profile.lastDirection = nextDirection;
    return showDirectionalIdle(troop, nextDirection);
}

export function shouldUseDirectionalFacing(troop) {
    const profile = troop?.directionalMove;
    if (!profile) return false;

    return (
        troop.animState === profile.walkStateKey ||
        troop.animState === profile.idleStateKey ||
        troop.animState === profile.swimStateKey
    );
}
