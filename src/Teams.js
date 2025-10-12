import { CONTROL_STATES, MAX_CROP_GROWTH_STAGE, SQUARESIZE, TILE_TYPES, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "./constants";
import { townBounds, townRoads } from "./town";
import { Map } from "./map";
import { Player } from "./players/Player";


export class Teams {
    static teamLists = {};
  
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
        // seedStates: {},
        foragerQueue: [],
        cropList: [],
        crops: [],
        wateringList: [],
        buildingTileStates: [],
        blockBuildingStates: [],
        destroyStates: [],
        fightingList: [],
        center: [0, 0],
        ovenList: [],
        ovenJobs: [],
        storageList: [],
        ovenPickupItems: [],
        ovenFuelJobs: [],
        ovenFuelDeliveryItems: [],
        ovenDeliveryItems: [],
        storagePickupItems: [],
        storageDeliveryItems: [],
        stateLists: {}
      };
  
      // initialize a Set for each control state
      for (const stateKey in CONTROL_STATES) {
        const stateVal = CONTROL_STATES[stateKey];
        list.stateLists[stateVal] = new Set();
      }
    
      Teams.teamLists[teamNumber] = list;
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
          [CONTROL_STATES.DESTROY_MODE]: 'destroyStates',
          [CONTROL_STATES.BUILD_MODE_B]: 'blockBuildingStates',
          [CONTROL_STATES.BUILD_MODE_T]: 'buildingTileStates',
          [CONTROL_STATES.FARM_MODE]: 'tileList',
          [CONTROL_STATES.HARVEST_MODE]: 'cropList',
          // [CONTROL_STATES.SEED_MODE]: 'seedList',
          // Add more mappings if needed
        };

        const taskKey = taskMapping[state];
        if (taskKey && Array.isArray(team[taskKey])) {
          team[taskKey] = [];
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
            Map.grid[ny][nx] === 35 || Map.grid[ny][nx] === TILE_TYPES.crops.grid
          ) {
            return false; // adjacent to a road → not far
          }
        }
      
        // Inside bounds and no adjacent road → far
        return true;
    }
      
     
    static sendTroopToTown(troop) {
      const teamNum = troop.body.team;
      const team = Teams.teamLists[teamNum];
      if (!team) {
        console.warn(`No team found for troop with team ${teamNum}.`);
        return;
      }
    
      // Extract the saved center tile for this team
      const roads = townRoads[`${troop.body.team}`];
      if (!roads || roads.length === 0) return null;

      const [x, y] = Phaser.Utils.Array.GetRandom(roads);      
      const path = Player.pathTo(troop, x, y);
      if(!path) return; 
    
      this.movePlayerState(troop, CONTROL_STATES.BACK_TO_TOWN);
      // Hand off that path to Player.moveTo
      Player.moveTo(troop, path);
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
        Teams.teamLists[`${teamNumber}`].fightingList.push(enemy)
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

            if (crop.growthStage < MAX_CROP_GROWTH_STAGE) {
                wateringList.push({
                    x: crop.x,
                    y: crop.y,
                    assigned: 0,
                    sprite: crop.sprite
                });
            }
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
            if (crop.x === x && crop.y === y && crop.growthStage < MAX_CROP_GROWTH_STAGE) {
                crop.dailyWatered = true;
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
      }
    }

    static setCropForWatering(crop){
      const wateringList = this.teamLists['1'].wateringList;
      wateringList.push({
          x: crop.x,
          y: crop.y,
          assigned: 0,
          sprite: crop.sprite
      });
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
      }
    }

}