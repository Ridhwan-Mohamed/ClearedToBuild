todo:
Map:
generate
    - world terrain
        - load chunk based on cameraXY
        - Wave collapse?
    - store in data efficient manner***
        - grid item = 1x1 pixel
        - block item = store center/position
    - recreate world from stored data***
Colonies
    - Add colonies on map
    - Add people in these colonies
    - store data for people on game exit
    - load and deload pplayers baased on Camera XY
Art/Assets
    - Farm buildings
    - houses
    Players
        - militias
        - civilians/workers
Players:
    - collisions
        - Walls and respecting
        - running into teammates (remove collisions?)
        - tracking blocked objects
    - Fighting
        - melee
        - projectiles
Bugs:
Tiles re-grid glitch when swapping tiles (because of array values at index)
