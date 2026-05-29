# Remaining V1 Work

## The Shocker
- [x] Despite already breached wall, prefers to destory other walls in its range instead rush buildings next. should not prefer walls beyond getting in
- [x] sometimes not attacking houses after attacking players (bad cleanup of task switch logic i imagine)
- [x] health bar on hover looks weird, not clear what is filled and what isnt. fix it or remove it
- [x] remove redundant boss-night subtitle wording
- [x] play different zap audios per zap attack tendrel sent out by shocker
- [x] play rain ambience when rain starts before shockers entrence for the whole duration the rain is there (blend it to star)
- [x] using thunder audio, randomly add thunder during the rain period (not too often, not spammy) and play audio and draw thunder lines and add screen flash 

## [x] Tutorial
- [x] Redo tutorial flow and tighten the text.
- re-add completed tutorial save to save manager again
- brawler should say im one of the fighters
- highlihgt the town tower when discussing it
- tutorial not lining up with storage values on continue
- when brawler cant be bought cause house not amde yet, mention wait till house made

### player tab
- [x] add sell buttons with confirm
- [x] add berry button
- [x] add sleep/wake buttons

## Bugs
- [x] Militia parcel not properly set up
- [x] Fix money not resetting position on resize properly.
- [x] If all wall depths are 0, simplify wall building depth logic and only prevent building on standing people.
- [x] Fix projectiles still going through buildings with better line-of-sight code. (also seems like town centre has weird hit box, make sure all buildings have proper bounding hitbox based on width and length of building)
- [x] Fix pressure parcel holes re-rendering.
- [x] fix hover on overview mode for players
- [x] no confirm on sell
- [x] if cant place build mention cost or permit issue better
- [x] should be able to cancel destory jobs like wall jobs are based on all the selections per job like wall job deletions
- [x] dont show storage additions ui on start of game when you are adding the original deck storage values, it looks weird when starting game
- [x] storage and oven status icons and foraging and water icons and any icons that sit above the bottom bar should come at once when bottom bar is rendered in a nice way when going from main menu to game through continue mode
- [x] forage icon still showing when parcel has left
- [x] command bar remove unnecessary commands
- [x] town layout player icons shrink on moving of any building
- [x] trailblazing gunslingers text pushed down too much, perhaps move card label and description subtexts below it all up by like 10px
- [x] play door open and close sound on house sleep and wake
- [x] town centres when destory should play smoke animation then leave not show destoryed tower spritesheet
- [x] have reseed not be 0 before card but 15% and card increase to 40%, add a small localized animation and text mention reseed happens when it does happen too
- still having interrupt issues with hunters, raiders and forgers
- player tab buttons still mucked
- bad player tracking 
- bad lake design in parcels

## Town Layout
- [x] Add hover to player icons like buildings.

## Bottom Bar
- [x] Make it less wide.
- [x] Make scrolling comprehensive and evident in scrollable areas.
- [x] On destruction of all players, houses, ovens, and storages, keep the design format size the same and do not shrink sections.
- [x] Fit bottom bar width cleanly to the screen.
- [x] Scope scroll bars to their active page only.
- [x] Show scroll bars only for overflowing row/card lanes.
- [x] Keep scroll bars off detail panels.
- [x] Rename Store Units to Troops.
- [x] Round scroll bar corners.

## [x] Town Status Bar
- [x] Like how we show current production and foraging and store powerups that are active in bottom left above bottom bar, we will show town status bar stuff in bottom right
- [x] show fire cooking in oven as a fire emoji, and some sort of storage emoji with a red cancel icon over it for storage filled/slots filled, idk you decide design (explain the emoji on hover better)
- [x] remove old town status bar ui and code logic
- [x] relief packge storage building not blocking its tiles in the navmesh, also if players are in region send them running away to a nearby clear place
- [x] why is shocker not shocking the buildings nearby it like how it shocks nearby walls. why is it punching. it is not a puncher

## Workers
- [x] Fix foragers not coming back when done foraging/fighting.
- [x] axe/pickaxe aniamtion doesnt auto end on parcel leave (sometimes foragers swim back while axe/pickaxe animation active for a few seconds before callback removes it. should go away though on parcel being removed, not while animating remove but when actually removed in the game)

## Enemies
- [x] Redesign bombers
- [x] Redo hunter art
- [x] make enemies not crowd buildings
- [x] hunters sometimes not arriving on shore

## [x] Map
- [x] Sometimes buildings placement causes road inner corner tiles to appear where interior tiles should, not sure why
- [x] treat crop tiles as road tiles when trying to figure out what road tile you need at x spot.
- [x] when a crop tile is added, check for redraws on all sorounding tiles of radius 1
- [x] it seems not yet placed crops are accounted for when a road tile is placed. dont do this anymore. only account for already placed crop tiles
- [x] inner corner parcel piece that acts as a inner corner when two perpendicular parcels are placed is still not showing, should be a "grass_inner_corner_water" when you have a 
grass_edge_something - grass_inner_corner
                              |
water_tile           - grass_edge_something  
type connection
