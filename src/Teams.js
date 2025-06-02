import { CONTROL_STATES, SQUARESIZE, WORLD_DIMENSIONX, WORLD_DIMENSIONY } from "./constants";
import { townBounds } from "./town";
import { Map } from "./map";
import { Player } from "./Player";


export class Teams {
    static teamLists = {};
  
    static newTeam(teamNumber) {
      const list = {
        playerList: [],
        TeamFarmSpots: [],
        tileList: [],
        seedList: [],
        seedStates: {},
        cropList: [],
        buildingTileStates: [],
        blockBuildingStates: [],
        destroyStates: [],
        center: [0, 0],
  
        // per‐state buckets
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
      // remove from any prior state
      for (const s in team.stateLists) {
        team.stateLists[s].delete(player);
      }
      // add to new state
      team.stateLists[state].add(player);
      // also store on the sprite for convenience
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
            Map.grid[ny][nx] === 35
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
        const [centerTileX, centerTileY] = team.center;
      
        // Convert that center tile into world‐pixel coordinates
        const destX = centerTileX * SQUARESIZE + SQUARESIZE / 2;
        const destY = centerTileY * SQUARESIZE + SQUARESIZE / 2;
      
        // Grab the troop’s current world‐pixel position
        const startX = troop.body.x;
        const startY = troop.body.y;
      
        // Ask the navmesh to build a path back to town center
        const path = Map.navMesh.findPath(
          { x: startX, y: startY },
          { x: destX,   y: destY   }
        );
      
        if (!path || path.length === 0) {
          console.warn(
            `Troop (team ${teamNum}) could not find a path to town center at (${centerTileX},${centerTileY}).`
          );
          return;
        }
      
        this.movePlayerState(troop, CONTROL_STATES.BACK_TO_TOWN)
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

    static addSeedSpots(teamNumber, x, y) {
        const list = Teams.teamLists[`${teamNumber}`].seedList;
        const exists = list.some(e => e.x === x && e.y === y);
        if (!exists) {
          list.push({ x, y, assigned: 0 });
        }
    }
      

    static removeSeedSpot(teamNumber, val){
        Teams.teamLists[`${teamNumber}`].seedList = Teams.teamLists[`${teamNumber}`].seedList.filter(value => value !== val)
    }

    static addBuildSpots(teamNumber, buildList){
        Teams.teamLists[`${teamNumber}`].buildList.concat(buildList)
    }
    
}