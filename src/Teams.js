export class Teams{

    static teamLists = {}

    static newTeam(teamNumber){
        Teams.teamLists[`${teamNumber}`] = {
            playerList: [],
            farmList: [],
            tileStates: {},
            tileList: [],
            cropList: [],
            buildingTileList: [],
            blockBuildingState: {},
            buildingBlockList: [],
            destroyList: [],
            destroyState: {}
        }
    }

    static addPlayer(teamNumber, player){
        if(player.active) Teams.teamLists[`${teamNumber}`].playerList.push(player)
    }

    static addFarmSpots(teamNumber, farmList){
        Teams.teamLists[`${teamNumber}`].farmList.concat(farmList)
    }

    static addBuildSpots(teamNumber, buildList){
        Teams.teamLists[`${teamNumber}`].buildList.concat(buildList)
    }
}