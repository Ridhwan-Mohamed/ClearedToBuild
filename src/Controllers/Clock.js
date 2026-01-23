import { openPowerupScreen } from "../UI/Powerups";
import { Teams } from "../Teams";
import { VisibilitySystem } from "../UI/VisibilitySystem";
import { Player } from "../players/Player";
import { recalculateDestroyTasksFromPoint, spawnSeaRaider } from "../Manager/spawnManager";
import { AudioManager } from "../Manager/AudioManager";

const NIGHT_START = 18;
const NIGHT_END = 6;

export class Clock {

    static overlay;
    constructor(scene) {
        this.scene = scene;
        this.paused = false; 
        this.powerupScreenShown = false;

        this.hours = 5;
        this.minutes = 50;
        this.day = 1;

        this.waveAmount = 1;
        this.spawnedThisNight = 0;
        this.lastSend = null;
        this.wasNight = false; // <== track night state

        this.minuteStep = 0.5;
        this.ticksPerMinute = 1;
        this.tickCount = 0;

        // // Dark overlay setup
        // const camera = scene.cameras.main;
        // const worldScale = 1 / 0.3; // pretend zoomed out fully
        // const bleed = 0.25;          // bleed margin on each side
        // const w = camera.width * worldScale * (1 + bleed * 2);
        // const h = camera.height * worldScale * (1 + bleed * 2);

        // Clock.overlay = scene.add.rectangle(
        // -camera.width * worldScale * (bleed+0.15),
        // -camera.height * worldScale * (bleed+0.15),
        // w,
        // h,
        // 0x000000,
        // 1
        // )
        //     .setOrigin(0, 0)
        //     .setDepth(UIDEPTH - 2)
        //     .setScrollFactor(0)
        //     .setAlpha(0);

        this.externalText = null;

        // scene.uiCamera.ignore([Clock.overlay]);   // overlay is only seen by main cam
    }

    update() {
        this.tickCount++;
        if (this.tickCount >= this.ticksPerMinute) {
            this.tickCount = 0;
            this.advanceTime();
        }

        this.events();
        this.externalText.setText(this.formatTimeWithDay());
        this.updateLighting();
    }

    advanceTime() {
        if (this.paused) return; // ⛔ don't advance time or spawn events
        this.minutes += this.minuteStep;
        if (this.minutes >= 60) {
            this.minutes = 0;
            this.hours++;

            if (this.hours >= 24) {
                this.hours = 0;
            }

            // Handle night end transition
            const isNight = this.isNight();
            if (this.wasNight && !isNight) {
                this.day++;
                this.waveAmount += 2;
                this.spawnedThisNight = 0;
            }
            this.wasNight = isNight;
        }
    }

    isNight() {
        return this.hours >= NIGHT_START || this.hours < NIGHT_END;
    }

    isDayStart(){
        return this.hours == NIGHT_END && this.minutes == 0
    }

    isNightStart(){
        return this.hours == NIGHT_START && this.minutes == 0
    }

    events() {
        if (this.isNightStart()) {
            // ✅ No enemies until Day 3
            AudioManager.setIsNight(true);

            if (this.day < 0) {
                this.spawnedThisNight = 0;
                this.lastSend = this.hours;
                return;
            }

            // ✅ Day 3–4: 1 spawn, Day 5–6: 2 spawns, Day 7–8: 3 spawns, ...
            const spawnsTonight = 1 + Math.floor((this.day + 0) / 2);

            for (let i = 0; i < spawnsTonight; i++) {
                spawnSeaRaider(this.scene);
            }

            this.spawnedThisNight = spawnsTonight;
            this.lastSend = this.hours;
        }
        else if (this.isNight()) {
            // keep your later-per-hour spawning disabled for now (or remove)
        }
        else if (this.isDayStart() && !this.powerupScreenShown) {
            AudioManager.setIsNight(false);
            this.powerupScreenShown = true;
            openPowerupScreen(this.scene);
            Teams.growWateredCrops(1);
            Teams.resetDailyWatering(1);
            this.pause();
        } else {
            this.lastSend = null;
        }
    }

    formatTimeWithDay() {
        const hour12 = this.hours % 12 === 0 ? 12 : this.hours % 12;
        const ampm = this.hours < 12 ? 'AM' : 'PM';
        const minutesStr = String(Math.round(this.minutes)).padStart(2, '0');
        return `Day ${this.day} — ${hour12}:${minutesStr} ${ampm}`;
    }

    // Clock.js
    updateLighting() {
        let alpha = 0;
        const hourFloat = this.hours + this.minutes / 60;
        let nightHour = hourFloat;
        if (nightHour < 6) nightHour += 24;

        if (nightHour >= 20 && nightHour <= 28) {
            alpha = 0.9;                      // this is DARKNESS amount
        } else if (nightHour >= 18 && nightHour < 20) {
            const t = (nightHour - 18) / 2;   // dusk ramp
            alpha = t * 0.9;
        } else if (nightHour > 28 && nightHour <= 30) {
            const t = 1 - (nightHour - 28) / 2; // dawn ramp
            alpha = t * 0.9;
        }

        // ✅ VisibilitySystem expects a light floor (BRIGHTNESS), not darkness.
        const ambientBrightness = 1 - alpha;
        VisibilitySystem.setAmbient(ambientBrightness);
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }
}
