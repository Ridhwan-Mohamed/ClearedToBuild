// UI/DraftStartState_v5.js

import { spawnPoints } from "../../town";

export class DraftStartState {
  constructor(opts = {}) {
    this.startingCash = opts.startingCash ?? 500;
    this.cash = this.startingCash;

    // Team
    this.teamName = opts.teamName ?? "My Team";

    // Crew (forager + builder required)
    this.crew = {
      forager: 1,
      builder: 1,
      brawler: 0,
      gunslinger: 0,
      blademaster: 0,
      farmer: 0,
      fireman: 0
    };

    // Supplies (store row)
    this.supplies = {
      seeds: 0,
      food: 10,
      berries: 0,
      wood: 0,
      stone: 0,
      water: 10
    };

    // Extras
    this.extras = {
      house: 120,
      storage: 90,
      oven: 110,

      // wall settings (MUST exist so setExtra() works)
      wall: 0,
      wallType: "wood",

      // optional: keep if you want them displayed elsewhere, but pricing should use prices.extras
      wallWoodPerTile: 10,
      wallStonePerTile: 15
    };

    // Cards: roll N pick K
    this.cards = {
      offerCount: 5,
      pickCount: 3,
      offered: [],
      picked: []
    };

    // Preview/build placement output (filled by preview controller)
    this.placedBuildings = []; // [{x,y,typeKey,teamnum}]
    this.wall = {
      estimatedTiles: 0,
      estimatedCost: 0
    };
    // Pricing
    this.prices = {
      crew: {
        forager: 50,
        builder: 60,
        brawler: 80,
        gunslinger: 150,
        blademaster: 75,
        farmer: 70,
        fireman: 90
      },
      supplies: {
        seeds: 2,
        food: 3,
        berries: 3,
        wood: 4,
        stone: 5,
        water: 2
      },
      extras: {
        house: 120,
        storage: 90,
        oven: 110,

        // per-tile costs (these are what setWallEstimate() uses)
        wallWoodPerTile: 10,
        wallStonePerTile: 15
      },
      cards: { base: 0 }
    };

    this._listeners = new Set();
    this.recalc();
  }

  onChange(cb){
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }
  _emit(reason = "ui"){
    for (const cb of this._listeners) cb(this, reason);
  }

  // --- Team ---
  setTeamName(name){
    this.teamName = (name ?? "").trim().slice(0, 24) || "My Team";
    this._emit("ui");
  }

  // --- Crew ---
  setCrew(type, count){
    if (!(type in this.crew)) return;
    const c = Math.floor(count);
    if (type === "forager" || type === "builder") this.crew[type] = Math.max(1, c);
    else this.crew[type] = Math.max(0, c);
    this._emit("ui");
  }
  addCrew(type, delta = 1){
    this.setCrew(type, (this.crew[type] ?? 0) + delta);
  }
  getTotalCrew(){
    return Object.values(this.crew).reduce((a,b)=>a+b,0);
  }
  minHousesNeeded(){
    return Math.ceil(this.getTotalCrew()/2);
  }

  // --- Supplies ---
  setSupply(k, count){
    if (!(k in this.supplies)) return;
    this.supplies[k] = Math.max(0, Math.floor(count));
    this._emit("ui");
  }
  addSupply(k, delta = 1){
    this.setSupply(k, (this.supplies[k] ?? 0) + delta);
  }

  // --- Extras ---
  setExtra(k, v){
    if (!(k in this.extras)) return;
    if (k === "wall") this.extras.wall = v ? 1 : 0;
    else if (k === "wallType") this.extras.wallType = (v === "stone") ? "stone" : "wood";
    else this.extras[k] = Math.max(0, Math.floor(v));
    this._emit(k === "wall" || k === "wallType" ? "preview" : "ui");
  }

  // Called by preview controller when placements changed
  setPlacedBuildings(list){
    this.placedBuildings = Array.isArray(list) ? list : [];
    this._emit("preview");
  }

  setWallEstimate(tiles, silent = false){
    this.wall.estimatedTiles = Math.max(0, Math.floor(tiles));
    const per = (this.extras.wallType === "stone")
      ? this.prices.extras.wallStonePerTile
      : this.prices.extras.wallWoodPerTile;
    this.wall.estimatedCost = this.wall.estimatedTiles * per;
    if (!silent) this._emit("ui");
  }

  // --- Cards ---
  setOfferedCards(cards){
    this.cards.offered = (cards ?? []).slice(0, this.cards.offerCount);
    this.cards.picked = this.cards.offered.slice(0, this.cards.pickCount);
    this._emit("ui");
  }
  togglePickCard(card){
    const idx = this.cards.picked.indexOf(card);
    if (idx >= 0) {
      this.cards.picked.splice(idx, 1);
      this._emit("ui");
      return;
    }
    if (this.cards.picked.length >= this.cards.pickCount) return;
    if (!this.cards.offered.includes(card)) return;
    this.cards.picked.push(card);
    this._emit("ui");
  }

  _countPlaced(typeKeys){
    const set = new Set(typeKeys);
    let n = 0;
    for (const b of (this.placedBuildings ?? [])) {
      const k = b?.typeKey ?? b?.type; // tolerate older shapes
      if (set.has(k)) n++;
    }
    return n;
  }

  _getPlacedHouseCount(){
    // count BOTH house variants as "houses"
    return this._countPlaced(["house1", "house2"]);
  }

  // --- Pricing ---
  recalc(){
    // 1) derive "paid-for / exists" extras from what is actually placed
    const placedH = this._getPlacedHouseCount();
    const placedStorage = this._countPlaced(["storage"]);
    const placedOven = this._countPlaced(["clayOven"]);

    // 2) keep your rule: houses must cover crew minimum; storage+oven min 1
    const minH = this.minHousesNeeded();
    this.extras.house = Math.max(minH, placedH);

    this.extras.storage = Math.max(1, placedStorage);
    this.extras.oven = Math.max(1, placedOven);

    // 3) cash = starting - total
    const cost = this.getTotalCost();
    this.cash = this.startingCash - cost;
  }

  getCrewCost(){
    let sum = 0;
    for (const [k,v] of Object.entries(this.crew)) sum += (this.prices.crew[k] ?? 0) * v;
    return sum;
  }
  getSuppliesCost(){
    let sum = 0;
    for (const [k,v] of Object.entries(this.supplies)) sum += (this.prices.supplies[k] ?? 0) * v;
    return sum;
  }
  getExtrasCost(){
    const p = this.prices.extras;
    let sum = 0;
    sum += p.house * (this.extras.house ?? 0);
    sum += p.storage * (this.extras.storage ?? 0);
    sum += p.oven * (this.extras.oven ?? 0);
    if (this.extras.wall) {
      const per = (this.extras.wallType === "stone") ? p.wallStonePerTile : p.wallWoodPerTile;
      sum += per * (this.wall.estimatedTiles ?? 0);
    }
    return sum;
  }
  getCardsCost(){
    return (this.prices.cards.base ?? 0) * (this.cards.picked.length ?? 0);
  }
  getTotalCost(){
    return this.getCrewCost() + this.getSuppliesCost() + this.getExtrasCost() + this.getCardsCost();
  }

  canAfford(){
    this.recalc();
    return this.cash >= 0;
  }

  toStartConfig(){
    this.recalc();
    return {
      teamName: this.teamName,
      money: {
        startingCash: this.startingCash,
        spent: this.getTotalCost(),
        remaining: this.cash
      },
      crew: structuredClone(this.crew),
      supplies: structuredClone(this.supplies),
      extras: structuredClone(this.extras),
      wall: structuredClone(this.wall),
      cards: {
        picked: (this.cards.picked ?? []).map(c => ({ id: c.id ?? c.name ?? c.key, ...c }))
      },
      buildings: structuredClone(this.placedBuildings),
    };
  }
}
