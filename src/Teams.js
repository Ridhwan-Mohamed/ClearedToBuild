import { SQUARESIZE } from "./constants";

export class Teams{

    static teamLists = {}

    static newTeam(teamNumber){
        Teams.teamLists[`${teamNumber}`] = {
            playerList: [],
            tileStates: {},
            tileList: [],
            seedList: [],
            seedStates: {},
            cropList: [],
            buildingTileList: [],
            blockBuildingState: {},
            buildingBlockList: [],
            destroyList: [],
            destroyState: {},
            center: [0,0]
        }
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

    static addPlayer(teamNumber, player){
        if(player.active) Teams.teamLists[`${teamNumber}`].playerList.push(player)
    }

    static addFarmSpots(teamNumber, farmList, states){
        Teams.teamLists[`${teamNumber}`].tileList = farmList
        Teams.teamLists[`${teamNumber}`].tileStates = states
    }

    static addCropSpots(teamNumber, cropList){
        Teams.teamLists[`${teamNumber}`].cropList = cropList
    }

    static addSeedSpots(teamNumber, newVal){
        Teams.teamLists[`${teamNumber}`].seedList.push(newVal);
    }

    static addBuildSpots(teamNumber, buildList){
        Teams.teamLists[`${teamNumber}`].buildList.concat(buildList)
    }
    
}