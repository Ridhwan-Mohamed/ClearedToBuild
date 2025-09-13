import { UIDEPTH } from "../constants";
import { openPowerupScreen } from "../UI/Powerups";
import { Teams } from "../Teams";
import { DailyNeedsTracker } from "../UI/DailyNeedsTracker";


const NIGHT_START = 18;
const NIGHT_END = 6;


export class Clock {
    constructor(scene) {
        this.scene = scene;
        this.paused = false; 
        this.powerupScreenShown = false;

        this.hours = 6;
        this.minutes = 1;
        this.day = 1;

        this.waveAmount = 1;
        this.spawnedThisNight = 0;
        this.lastSend = null;
        this.wasNight = false; // <== track night state

        this.minuteStep = 1;
        this.ticksPerMinute = 1;
        this.tickCount = 0;

        // Dark overlay setup
        const camera = scene.cameras.main;
        this.overlay = scene.add.rectangle(-1, -1, camera.width+1, camera.height+1, 0x000000, 1)
            .setOrigin(0, 0)
            .setDepth(UIDEPTH-2)
            .setScrollFactor(0)
            .setAlpha(0);

        this.clockText = scene.add.text(camera.width - 120, 10, this.formatTime(), {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            stroke: "#000000",
            strokeThickness: 2
        }).setDepth(UIDEPTH).setScrollFactor(0);

        this.dayText = scene.add.text(camera.width - 120, 30, `Day ${this.day}`, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'monospace',
            stroke: "#000000",
            strokeThickness: 2
        }).setDepth(UIDEPTH).setScrollFactor(0);
        scene.cameras.main.ignore([this.clockText, this.dayText])
        scene.uiCamera.ignore([this.overlay]);   // overlay is only seen by main cam
    }

    update() {
        this.tickCount++;
        if (this.tickCount >= this.ticksPerMinute) {
            this.tickCount = 0;
            this.advanceTime();
        }

        this.events();
        this.clockText.setText(this.formatTime());
        this.dayText.setText(`Day ${this.day}`);
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

    events() {
        if (this.isNight()) {
            // if (this.day > 3 && this.lastSend !== this.hours && this.spawnedThisNight < this.waveAmount) {
            //     spawnAndSend();
            //     this.spawnedThisNight++;
            //     this.lastSend = this.hours;
            // }
        } else if (this.isDayStart() && !this.powerupScreenShown){
            this.powerupScreenShown = true;   // ✅ prevent re-trigger
            openPowerupScreen(this.scene);
            DailyNeedsTracker.consumeResources();
            DailyNeedsTracker.render();
            Teams.growWateredCrops(1);
            Teams.resetDailyWatering(1);
            this.pause();
        } else {
            this.lastSend = null;
        }
    }

    formatTime() {
        const hour12 = this.hours % 12 === 0 ? 12 : this.hours % 12;
        const ampm = this.hours < 12 ? 'AM' : 'PM';
        const minutesStr = String(this.minutes).padStart(2, '0');
        return `${hour12}:${minutesStr} ${ampm}`;
    }

    updateLighting() {
        let alpha = 0;
        const hourFloat = this.hours + this.minutes / 60;
        let nightHour = hourFloat;
        if (nightHour < NIGHT_END) nightHour += 24;

        if (nightHour >= 20 && nightHour <= 28) {
            alpha = 0.6;
        } else if (nightHour >= 18 && nightHour < 20) {
            const t = (nightHour - 18) / 2;
            alpha = t * 0.6;
        } else if (nightHour > 28 && nightHour <= 30) {
            const t = 1 - (nightHour - 28) / 2;
            alpha = t * 0.6;
        }

        this.overlay.setAlpha(alpha);
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }
}
