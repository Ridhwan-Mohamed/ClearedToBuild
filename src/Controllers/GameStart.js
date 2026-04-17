// GameStart.js
import { House } from "../buildings/House";
import { Farmer } from "../players/Farmer";
import { Forager } from "../players/Forager";
import { Builder } from "../players/Builder";
import { Blademaster } from "../players/Blademaster";
import { Brawler } from "../players/Brawler";
import { Fireman } from "../players/Fireman";
import { Gunslinger } from "../players/Gunslinger";
import { Teams } from "../Teams";

const PLAYER_CLASS_BY_KEY = {
  farmer: Farmer,
  forager: Forager,
  builder: Builder,
  blademaster: Blademaster,
  brawler: Brawler,
  fireman: Fireman,
  gunslinger: Gunslinger,
  // add others here
};

export class GameStart {
  static placePlayers(startCfg) {
    const teamNumber = 1;
    // crew is an object: { forager: 1, builder: 1, ... }
    const crewCounts = startCfg?.crew ?? {}; // object
    // spawnPoints is: [{x,y,type}, ...]
    const spawnPoints = Array.isArray(startCfg?.spawnPoints) ? startCfg.spawnPoints : [];

    // fallback roads (same as before)
    const roads = Teams.getTownRoadTiles?.(teamNumber) ?? [];
    const fallbackSpawns = Phaser.Utils.Array.Shuffle(roads).slice(); // copy

    const playerArray = [];

    // helper: pop a fallback road if needed
    const popFallback = () => {
    const p = fallbackSpawns.pop();
    if (!p) return null;
    // roads entries might already be [x,y] or {x,y}; support both
    if (Array.isArray(p)) return { x: p[0], y: p[1] };
    if (typeof p === "object" && p) return { x: p.x, y: p.y };
    return null;
    };

    // 1) Prefer explicit spawnPoints (these are the ones you previewed)
    for (const sp of spawnPoints) {
    if (!sp) continue;
    const key = sp.type; // "builder", "forager", etc
    const Cls = PLAYER_CLASS_BY_KEY[key];
    if (!Cls) {
        console.warn("Unknown crew type in spawnPoints:", key, sp);
        continue;
    }
    playerArray.push(new Cls(sp.x, sp.y, teamNumber));
    }

    // 2) If crewCounts implies MORE players than spawnPoints, fill missing using fallback roads
    // Expand crewCounts into an ordered list of types
    const typesWanted = [];
    Object.keys(crewCounts).sort().forEach((k) => {
    const n = Math.max(0, crewCounts[k] | 0);
    for (let i = 0; i < n; i++) typesWanted.push(k);
    });

    // If we already spawned some via spawnPoints, spawn the remainder.
    // Assumption: spawnPoints are already in the same “type” universe as crewCounts.
    let spawnedSoFar = playerArray.length;

    for (let i = spawnedSoFar; i < typesWanted.length; i++) {
    const key = typesWanted[i];
    const Cls = PLAYER_CLASS_BY_KEY[key];
    if (!Cls) {
        console.warn("Unknown crew type in crewCounts:", key);
        continue;
    }
    const fb = popFallback();
    if (!fb) {
        console.warn("No fallback road tiles left for spawn");
        break;
    }
    playerArray.push(new Cls(fb.x, fb.y, teamNumber));
    }
    playerArray.forEach(player => House.assignPlayerToHouse(player, teamNumber));
  }
}
