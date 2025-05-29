import { CONTROL_STATES, SQUARESIZE } from "./constants";

export class Teams {
    static teamLists = {};
  
    static newTeam(teamNumber) {
      const list = {
        playerList: [],
        tileStates: {},
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

    static farFromCenter(troop, maxTiles = 30) {
        const teamNum = troop.body.team;
        const team = Teams.teamLists[teamNum];
        if (!team || !Array.isArray(team.center)) return false;
    
        const [centerX, centerY] = team.center;
        const troopX = Math.floor(troop.body.x / SQUARESIZE);
        const troopY = Math.floor(troop.body.y / SQUARESIZE);
    
        // Euclidean distance in tile‐space
        const dist = Phaser.Math.Distance.Between(centerX, centerY, troopX, troopY);
        return dist > maxTiles;
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
      

    static addFarmSpots(teamNumber, farmList, states){
        Teams.teamLists[`${teamNumber}`].tileList = farmList
        Teams.teamLists[`${teamNumber}`].tileStates = states
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