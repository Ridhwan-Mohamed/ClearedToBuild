import { CONTROL_STATES, MAX_CROP_GROWTH_STAGE, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "./constants";
import { townBounds, townRoads } from "./town";
import { Map } from "./map";
import { Player } from "./players/Player";
import { POWERUP_CARDS } from "./Cards/PowerupCards";

export class Teams {
    static teamLists = {};
    static houseCapacityPerBuilding = 2;

    static resetAll() {
      this.teamLists = {};
    }

    static createTownAutomationState() {
      return {
        waterEnabled: false,
        gatherEnabled: false,
        gatherTargets: {
          wood: 0,
          stone: 0,
          seed: 0,
          berry: 0,
        },
        waterOrderId: null,
        gatherOrderIds: {
          wood: null,
          stone: null,
          seed: null,
          berry: null,
        },
      };
    }

    static ensureTownAutomation(teamNumber) {
      const team = this.getTeam(teamNumber);
      if (!team) return null;
      if (!team.townAutomation) {
        team.townAutomation = this.createTownAutomationState();
      }
      return team.townAutomation;
    }

    static _cropNeedsWater(crop) {
      return !!(
        crop &&
        crop.hasSeed &&
        !crop.dailyWatered &&
        crop.growthStage < MAX_CROP_GROWTH_STAGE &&
        crop.sprite?.active
      );
    }

    static _destroyCropWaterIndicator(crop) {
      if (!crop) return;

      if (crop.waterNeedTween) {
        crop.waterNeedTween.remove();
        crop.waterNeedTween = null;
      }

      if (crop.waterNeedIcon) {
        Map.removeFromWorldStatic?.(crop.waterNeedIcon);
        crop.waterNeedIcon = null;
      }
    }

    static _positionCropWaterIndicator(crop) {
      if (!crop?.waterNeedIcon) return;

      crop.waterNeedIcon.setPosition(
        crop.x * SQUARESIZE + SQUARESIZE * 0.76,
        crop.y * SQUARESIZE + SQUARESIZE * 0.24
      );
    }

    static syncCropWaterIndicator(crop) {
      if (!crop?.sprite?.scene) {
        this._destroyCropWaterIndicator(crop);
        return;
      }

      if (!this._cropNeedsWater(crop)) {
        this._destroyCropWaterIndicator(crop);
        return;
      }

      const scene = crop.sprite.scene;
      if (!scene.textures?.exists("waterIcon")) return;

      if (!crop.waterNeedIcon || !crop.waterNeedIcon.active) {
        const icon = scene.add.image(0, 0, "waterIcon")
          .setDepth((crop.sprite.depth ?? TILE_TYPES.crops.depth) + 1)
          .setDisplaySize(12, 12)
          .setAlpha(0.95);

        Map.addToWorldStatic?.(icon);
        crop.waterNeedIcon = icon;
        crop.waterNeedTween = scene.tweens.add({
          targets: icon,
          alpha: 0.22,
          scaleX: 0.88,
          scaleY: 0.88,
          duration: 520,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });

        crop.sprite.once?.("destroy", () => this._destroyCropWaterIndicator(crop));
      }

      crop.waterNeedIcon.setDepth((crop.sprite.depth ?? TILE_TYPES.crops.depth) + 1);
      this._positionCropWaterIndicator(crop);
    }

    static syncTeamCropWaterIndicators(teamNumber) {
      const crops = this.teamLists[teamNumber]?.crops || [];
      for (const crop of crops) {
        this.syncCropWaterIndicator(crop);
      }
    }
  
    static newTeam(teamNumber) {
      const list = {
        playerList: [],
        farmerList: [],
        foragerList: [],
        firemanList: [],
        fighterList: [],
        builderList: [],
        houseList: [],
        TeamFarmSpots: [],
        tileList: [],
        foragerQueue: [],
        cropList: [],
        crops: [],
        wateringList: [],
        buildingTileStates: [],
        blockBuildingStates: [],
        destroyStates: [],
        destroyTileStates: [],
        fightingList: [],
        center: [0, 0],
        ovenList: [],
        ovenJobs: [],
        ovenDeliveryItems: [],
        storageList: [],
        ovenPickupJobs: [],
        ovenFuelJobs: [],
        ovenFuelDeliveryItems: [],
        storageDeliveryItems: [],
        storageDeliveryReservations: [],
        townTowerList: [],
        stateLists: {},
        cardHand: [],
        cardInventory: {
          deck: {},
          consumables: {},
        },
        townAutomation: this.createTownAutomationState(),
        buildings: [],
        buildingFixTasks: [],
        siegeTileStates: [],
        enemyDestroyStates: [],      // spawners + towers (enemy-owned buildings)
        enemyDestroyTileStates: [],  // enemy walls/doors (tile-based)
      };
  
      // initialize a Set for each control state
      for (const stateKey in CONTROL_STATES) {
        const stateVal = CONTROL_STATES[stateKey];
        list.stateLists[stateVal] = new Set();
      }
    
      Teams.teamLists[teamNumber] = list;
    }

    static getTeam(teamNumber) {
      return Teams.teamLists?.[`${teamNumber}`] ?? Teams.teamLists?.[teamNumber] ?? null;
    }

    static getHousingStatus(teamNumber) {
      const team = this.getTeam(teamNumber);
      const players = Array.isArray(team?.playerList)
        ? team.playerList.filter((player) => player?.active !== false)
        : [];
      const houses = Array.isArray(team?.houseList)
        ? team.houseList.filter((house) => house?.sprite?.active !== false)
        : [];

      const capacity = houses.reduce(
        (sum, house) => sum + Math.max(0, Number(house?.capacity ?? this.houseCapacityPerBuilding)),
        0
      );
      const homelessPlayers = players.filter((player) => !player?.home);
      const homelessCount = homelessPlayers.length;
      const freeBeds = Math.max(0, capacity - players.length);

      let descriptor = "Stable";
      if (players.length <= 0) {
        descriptor = "Empty";
      } else if (homelessCount > 0) {
        descriptor = "Homeless";
      } else if (freeBeds <= 0) {
        descriptor = "Full";
      } else if (freeBeds === 1) {
        descriptor = "Tight";
      } else {
        descriptor = "Stable";
      }

      return {
        players,
        houses,
        playerCount: players.length,
        capacity,
        homelessPlayers,
        homelessCount,
        freeBeds,
        descriptor,
      };
    }

    static assignHomelessPlayersToHouses(teamNumber) {
      const team = this.getTeam(teamNumber);
      if (!team) return 0;

      const { homelessPlayers } = this.getHousingStatus(teamNumber);
      let assigned = 0;

      for (const player of homelessPlayers) {
        const house = team.houseList?.find((candidate) => candidate?.canAcceptPlayer?.());
        if (!house) break;
        if (house.assignPlayer?.(player)) {
          assigned += 1;
        }
      }

      return assigned;
    }

    static canRecruitPlayer(teamNumber) {
      const { homelessCount, freeBeds } = this.getHousingStatus(teamNumber);
      return homelessCount <= 0 && freeBeds > 0;
    }

    static getHousePermitCost(teamNumber) {
      const { homelessCount } = this.getHousingStatus(teamNumber);
      return homelessCount >= this.houseCapacityPerBuilding ? 0 : 1;
    }

    static getHouseBuildCost(teamNumber) {
      const cost = { wood: 4, stone: 4 };
      const permitCost = this.getHousePermitCost(teamNumber);
      if (permitCost > 0) {
        cost.permits = permitCost;
      }
      return cost;
    }

    static _normalizeGridTile(tile) {
      if (Array.isArray(tile) && tile.length >= 2) {
        const x = Number(tile[0]);
        const y = Number(tile[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      }

      if (tile && typeof tile === "object") {
        const x = Number(tile.x);
        const y = Number(tile.y);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      }

      return null;
    }

    static getTownCenterTile(teamNumber) {
      const center = this.getTeam(teamNumber)?.center;
      return this._normalizeGridTile(center);
    }

    static _isOccupiedTile(x, y) {
      return Player.troops.some((troop) => {
        if (!troop?.active || troop.visible === false) return false;
        const gx = Math.floor((troop.x ?? 0) / SQUARESIZE);
        const gy = Math.floor((troop.y ?? 0) / SQUARESIZE);
        return gx === x && gy === y;
      });
    }

    static isTownRoadTile(teamNumber, x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (x < 0 || x >= WORLD_DIMENSIONX || y < 0 || y >= WORLD_DIMENSIONY) return false;
      if (Map.navGrid?.[y]?.[x] !== 1) return false;
      return !!Map._hasTypeAt?.(x, y, "road");
    }

    static getTownRoadTiles(teamNumber) {
      const roads = townRoads[`${teamNumber}`] ?? townRoads[teamNumber] ?? [];
      if (!Array.isArray(roads) || roads.length === 0) return [];

      const center = this.getTownCenterTile(teamNumber);
      const seen = new Set();
      const valid = [];

      for (const road of roads) {
        const point = this._normalizeGridTile(road);
        if (!point) continue;
        const key = `${point.x},${point.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!this.isTownRoadTile(teamNumber, point.x, point.y)) continue;
        valid.push(point);
      }

      if (!center) return valid;

      valid.sort((a, b) => {
        const da = ((a.x - center.x) ** 2) + ((a.y - center.y) ** 2);
        const db = ((b.x - center.x) ** 2) + ((b.y - center.y) ** 2);
        if (da !== db) return da - db;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });

      return valid;
    }

    static getTownCenterRoadTile(teamNumber) {
      return this.getTownRoadTiles(teamNumber)[0] ?? null;
    }

    static getTownCenterRoadWorld(teamNumber) {
      const tile = this.getTownCenterRoadTile(teamNumber) || this.getTownCenterTile(teamNumber);
      if (!tile) return null;
      return {
        gx: tile.x,
        gy: tile.y,
        x: tile.x * SQUARESIZE + SQUARESIZE / 2,
        y: tile.y * SQUARESIZE + SQUARESIZE / 2,
      };
    }

    static getTownSpawnTile(teamNumber) {
      const roads = this.getTownRoadTiles(teamNumber);
      if (!roads.length) return null;
      return roads.find((road) => !this._isOccupiedTile(road.x, road.y)) ?? roads[0];
    }

    static findTownReturnTarget(troop) {
      const teamNumber = troop?.body?.team;
      const roads = this.getTownRoadTiles(teamNumber);
      if (!troop?.body || !roads.length) return null;

      for (const road of roads) {
        const path = Player.pathTo(troop, road.x, road.y);
        if (path?.length) {
          return { tile: road, path };
        }
      }

      return null;
    }
   
    static addPlayer(teamNumber, player) {
      const team = Teams.teamLists[teamNumber];
      if (!team || !player.active) return;
  
      team.playerList.push(player);
      // put new player into USER_MODE by default
      Teams.addPlayerToState(teamNumber, player, CONTROL_STATES.TRACK_MODE);
    }

    static addPlayerToState(teamNumber, player, state) {
        const team = Teams.teamLists[teamNumber];
        if (!team) return;
        // Already in desired state, no need to re-add
        if (player.state === state) return;
        // Remove from previous state if applicable
        if (player.state !== undefined) {
            Teams.removePlayerFromState(teamNumber, player, player.state);
        }
        // Add to new state
        team.stateLists[state].add(player);
        player.state = state;
    }
  
    static movePlayerState(player, newState) {
        let teamNumber = player.body.team;
        Teams.addPlayerToState(teamNumber, player, newState);
    }
  
    static removePlayerFromState(teamNumber, player, state) {
      const team = Teams.teamLists[teamNumber];
      if (!team) return;

      team.stateLists[state].delete(player);

      // Clean up related task array if state is now empty
      const stateIsEmpty = team.stateLists[state].size === 0;

      if (stateIsEmpty && teamNumber) {
        // Map state to task array key
        const taskMapping = {
          // [CONTROL_STATES.DESTROY_MODE]: 'destroyStates',
          // [CONTROL_STATES.BUILD_MODE_B]: 'blockBuildingStates',
          // [CONTROL_STATES.BUILD_MODE_T]: 'buildingTileStates',
          // [CONTROL_STATES.FARM_MODE]: 'tileList',
          // [CONTROL_STATES.HARVEST_MODE]: 'cropList',
          // [CONTROL_STATES.SEED_MODE]: 'seedList',
          // Add more mappings if needed
        };

        const taskKey = taskMapping[state];
        if (taskKey && Array.isArray(team[taskKey])) {
          team[taskKey] = [];
          console.error("Nuked array "+taskKey)
        }
      }
    }
  
    static getPlayersInState(teamNumber, state) {
      const team = Teams.teamLists[teamNumber];
      if (!team) return [];
      return Array.from(team.stateLists[state]);
    }

    static farFromCenter(troop) {
        const teamNum = troop.body.team;
        const bounds = townBounds[teamNum];
        if (!bounds) return false; // No defined town bounds → not far
      
        const tileX = Math.floor(troop.x / SQUARESIZE);
        const tileY = Math.floor(troop.y / SQUARESIZE);
        const { minx, miny, maxx, maxy } = bounds;
      
        // If outside the rectangular town bounds → far
        if (tileX < minx || tileX > maxx || tileY < miny || tileY > maxy) {
          return true;
        }
      
        // Inside bounds: check adjacent (N/E/S/W) for a road (35)
        const neighbors = [
          [tileX,     tileY - 1], // top
          [tileX + 1, tileY    ], // right
          [tileX,     tileY + 1], // bottom
          [tileX - 1, tileY    ]  // left
        ];
      
        for (const [nx, ny] of neighbors) {
          if (
            nx >= 0 && nx < WORLD_DIMENSIONX &&
            ny >= 0 && ny < WORLD_DIMENSIONY &&
            (Map._hasTypeAt?.(nx, ny, "road") || Map.grid?.[ny]?.[nx] === TILE_TYPES.crops.grid)
          ) {
            return false; // adjacent to a road → not far
          }
        }
      
        // Inside bounds and no adjacent road → far
        return true;
    }
      
     
    static sendTroopToTown(troop) {
      if (!troop?.body) return null;
      const teamNum = troop.body.team;
      const team = Teams.teamLists[teamNum];
      if (!team) {
        console.warn(`No team found for troop with team ${teamNum}.`);
        return null;
      }

      const returnTarget = this.findTownReturnTarget(troop);
      if (!returnTarget?.path?.length) {
        console.warn(`No valid town road return path for troop with team ${teamNum}.`);
        return null;
      }

      this.movePlayerState(troop, CONTROL_STATES.BACK_TO_TOWN);
      Player.moveTo(troop, returnTarget.path);
      return returnTarget.path;
    }

    static sendTroopToRoadPool(troop, roads, moveState = CONTROL_STATES.BACK_TO_TOWN) {
      if (!troop?.body || !Array.isArray(roads) || roads.length === 0) return null;

      const [x, y] = Phaser.Utils.Array.GetRandom(roads);
      const path = Player.pathTo(troop, x, y);
      if (!path) return null;

      this.movePlayerState(troop, moveState);
      Player.moveTo(troop, path);
      return path;
    }
      

    static removeFromStateArray(teamNumber, arrayKey, element) {
      const team = Teams.teamLists[teamNumber];
      if (!team) return;
    
      const arr = team[arrayKey];
      if (!Array.isArray(arr)) return;
    
      // Try direct identity or primitive match
      let idx = arr.indexOf(element);
    
      // Fallback for object entries with x/y
      if (idx === -1 && element && typeof element === 'object') {
        if (Array.isArray(element) && element.length === 2) {
          // e.g. seedList entries like [x, y]
          idx = arr.findIndex(e => 
            Array.isArray(e) && e[0] === element[0] && e[1] === element[1]
          );
        } else if ('x' in element && 'y' in element) {
          // e.g. { x, y, ... } entries
          idx = arr.findIndex(e => 
            e && e.x === element.x && e.y === element.y
          );
        }
      }
    
      if (idx !== -1) {
        arr.splice(idx, 1);
      }
    }

    static addToStateArrayIfNotExists(teamNumber, arrayKey, val) {
      const team = Teams.teamLists[teamNumber];
      if (!team) return;

      const arr = team[arrayKey];
      if (!Array.isArray(arr)) return;

      const exists = arr.some(e =>
          e.x === val.x && e.y === val.y && e.type === val.type
      );

      if (!exists) {
          arr.push(val);
      }
    }

    static addFarmSpots(block, x, y) {
        const team = Teams.teamLists['1'];
        if (!team.TeamFarmSpots) {
          throw new Error(`No such Team: 1`);
        }
        const spots = team.TeamFarmSpots;
        
        // Find index of an existing spot
        const idx = spots.findIndex(spot => spot.x === x && spot.y === y);
        if (idx !== -1) {
          // Remove the old entry
          spots.splice(idx, 1);
        }
        // Always push a fresh entry
        spots.push({ block, x, y, assigned: 0 });
    }      

    static addCropSpots(teamNumber, cropList){
        Teams.teamLists[`${teamNumber}`].cropList = cropList
    }

    static addSeedSpots(teamNumber, x, y, block) {
        const list = Teams.teamLists[`${teamNumber}`].seedList;
        const exists = list.some(e => e.x === x && e.y === y);
        if (!exists) {
          list.push({ x, y, assigned: 0, block });
        }
    }

    static removeSeedSpot(teamNumber, val){
        Teams.teamLists[`${teamNumber}`].seedList = Teams.teamLists[`${teamNumber}`].seedList.filter(value => value !== val)
    }

    static addBuildSpots(teamNumber, buildList){
        Teams.teamLists[`${teamNumber}`].buildList.concat(buildList)
    }

    static addTroopsToFight(teamNumber, enemy){
        const list = Teams.teamLists[`${teamNumber}`]?.fightingList;
        if (!Array.isArray(list) || !enemy) return;
        const target = enemy?.target || enemy;
        const exists = list.some(entry => (entry?.target || entry) === target);
        if (!exists) {
            list.push(enemy);
        }
    }

    static getStorageWithCapacity(teamNumber, itemType, amount) {
        const team = Teams.teamLists[teamNumber];
        if (!team || !team.storageList) return null;

        for (const storage of team.storageList) {
            if (storage.canAcceptItem(itemType, amount)) {
                return storage;
            }
        }

        return null;
    }
    
    static getOvens(teamNumber) {
      const team = Teams.teamLists[teamNumber];
      return team ? team.ovenList : [];
    }

    static resetDailyWatering(teamNumber) {
        const cropList = Teams.teamLists[teamNumber]?.crops;
        if (!cropList) return;

        // Reset watering flags and build new watering list
        const wateringList = [];

        for (let crop of cropList) {
            crop.dailyWatered = false;

            if (crop.hasSeed && crop.growthStage < MAX_CROP_GROWTH_STAGE) {
                wateringList.push({
                    x: crop.x,
                    y: crop.y,
                    assigned: 0,
                    sprite: crop.sprite
                });
            }

            Teams.syncCropWaterIndicator(crop);
        }
        Teams.teamLists[teamNumber].wateringList = wateringList;
    }

    static getCropsNeedingWater(teamNumber) {
        return Teams.teamLists[teamNumber]?.wateringList || [];
    }

    static markCropWatered(team, x, y) {
        const cropList = Teams.teamLists[team]?.crops;
        const wateringList = Teams.teamLists[team]?.wateringList;

        if (!cropList || !wateringList) return;

        for (let crop of cropList) {
            if (crop.x === x && crop.y === y && crop.hasSeed && crop.growthStage < MAX_CROP_GROWTH_STAGE) {
                crop.dailyWatered = true;
                Teams.syncCropWaterIndicator(crop);
                break;
            }
        }

        // Remove from wateringList (if still present)
        const i = wateringList.findIndex(task => task.x === x && task.y === y);
        if (i !== -1) wateringList.splice(i, 1);
    }

    static getCropAt(x, y, team) {
      const cropList = Teams.teamLists[team]?.crops;
      if (!cropList) return null;

      return cropList.find(crop => crop.x === x && crop.y === y) || null;
    }

    static resetCrop(crop) {
      if (!crop) return;

      crop.dailyWatered = false;

      // 40% chance to auto-reseed
      if (Math.random() < 0.4) {
        crop.hasSeed = true;
        crop.growthStage = 0;
        crop.sprite.setFrame(1); // show seeded soil
        Teams.setCropForWatering(crop);
      } else {
        crop.hasSeed = false;
        crop.growthStage = 0;
        crop.sprite.setFrame(0); // show bare dirt
        Teams.syncCropWaterIndicator(crop);
      }
    }

    static setCropForWatering(crop){
      if (!crop) return;

      const teamNumber = crop.teamNumber ?? '1';
      const wateringList = this.teamLists[teamNumber]?.wateringList;
      if (!wateringList) return;

      const alreadyQueued = wateringList.some(task => task.x === crop.x && task.y === crop.y);
      if (!alreadyQueued && crop.hasSeed && crop.growthStage < MAX_CROP_GROWTH_STAGE) {
        wateringList.push({
            x: crop.x,
            y: crop.y,
            assigned: 0,
            sprite: crop.sprite
        });
      }

      this.syncCropWaterIndicator(crop);
    } 

    static growWateredCrops(teamNumber) {
      const crops = this.teamLists[teamNumber].crops;
      for (let crop of crops) {
        if (!crop.hasSeed) continue; // 🚫 skip until reseeded

        if (crop.dailyWatered && crop.sprite && crop.sprite.active) {
          crop.growthStage = Math.min(crop.growthStage + 1, MAX_CROP_GROWTH_STAGE);

          // Map growthStage to frame:
          // 0 = just seeded soil (frame 1)
          // 1 = growing (frame 2)
          // 2 = fully grown (frame 3)
          let frame = 1 + crop.growthStage;
          crop.sprite.setFrame(frame);

          if (frame === 3) {
            this.addFarmSpots(crop.sprite, crop.x, crop.y);
          }
        }

        this.syncCropWaterIndicator(crop);
      }
    }

}
