# Release Checklist
## v1.0.0 Launch Demo Priorities

### Tutorial [done]
- Add a talking guide/player that walks new players through the core systems. [done]
- Teach farming basics. [done]
- Teach building placement and town expansion basics. [done]
- Teach parcel purchasing. [done]
- Teach defending yourself and the town. [done]
- Keep the rest of the game light-touch and self-explanatory. [done]

### Achievements Bar [done]
- Reposition the achievements dropdown so it opens to the right of the contract HUD squares. [done]
- Extend the town level bar so the achievements dropdown has a clear attached source. [done]
- Keep a visible closed dropdown tab so players can tell the goals panel opens there. [done]
- Open the achievements dropdown on game start. [done]
- Improve the closed state so completed achievements are visible through a clear alert or notification. [done]
- Add a nicer completion animation when the achievements bar is open. [done]
- Animate progress bar movement as XP is added instead of jumping instantly. [done]
- Replace the XP pill with the current level display. [done]
- Remove text from inside the progress bar. [done]
- Show completion text separately, for example `0/100 XP`. [done]

### Player Polish
- let foragers be retouted by clicking on them then parcel. [done]
- Improve player art, movement, and sprite logic.
- Improve awareness logic so players and raiders do not crowd or stand on the same spot.
- Imporove projectile players pathing and logic and defense
- Improve flee behavior so players do not twitch or panic without a clear reason. [done]
- Improve raider attack priorities so they do not chase one player forever. [done]
- Make raiders focus more on destroying the town than hunting individual players. [done]

### Status updates
- mention if storages are all full [done]
- mention if players cant put their items in storage [done]
- mention if cooking is in process somehow [done]
- redisgn to make larger and more self-explanatory

### Enemies [done-ish]
- Add a run-and-explode enemy type that detonates when it reaches its target. [done]
- Allow players to stop the exploding enemy by killing it before detonation. [done] 
- Add a projectile-shooting enemy type similar to the Gunslinger, but less powerful. [done]
- Improve off-screen enemy indicators. [done]
- Reduce indicator size and fix cases where indicators do not appear. [done]
- make them prefer attacking troops, less so non offensive ones [done]

### Balancing [done]
- Balance money gathering so players cannot earn too much too quickly. [done]
- Tune progression so the game gets difficult at a good rate. [done]
- Balance parcel item pricing. [done]
- Scale parcel prices over time. [done]
- Balance market item pricing. [done]
- Scale market item prices over time. [done]
- Balance player costs. [done]
- Scale player costs over time. [done]

### Market Tab Art [done]
- Add art for market tab items. [done]
- Add more market tab items. [done]
- Replace placeholder market item art with finished art. [done]

### contract deals [done]
- implement contract sales based on least usage [done]
- add sale and duration bonusses [done]

### UI
- Reduce the size of the speed-up and zoom buttons. [done]
- Align town XP HUD, contract HUD, clock, and town goals top-bar spacing. [done]
- Remove idle backgrounds from top-bar pause, speed, and zoom buttons. [done]
- Prevent world parcel hover from changing contract HUD square visuals. [done]
- Fix bottom bar edge spill. [done]
- use a bullet with effects for projctiles [done]
- add explosion smoke effects and shake when buildings and walls break and projectiles hit [done]
- add player death animations [done]
- receive xp for killing players with animation to xp bar [done]
- Improve fonts for smaller screens.
- remove attack button from bottom bar [done]

### parcel polish
- animate parcel addby the tile [done]
- make parcel add work on thread [done]

### the shocker
- make the shocker [done]
- fix wall preference

### bugs
- store items on game load not syncing with level [done]
- crops on game load regen for free [done]
- bottom bar sleep buttons not working [done]
- turret and catapults are not properly configurable
- Fix overview mode UI issues.
- Fix parcel contract UI issues.
- Fix farm mode and wall placement sometimes eating clicks when starting a plot or segment. [done]
- Improve destroy mode drag so it feels as good as select drag. [done]
- Fix players showing as selected when they are not selected.
- Fix building health bars sitting too high. [done]
- Fix building health bars lingering if a raider dies unexpectedly. [done]
- Fix building health values changing inconsistently when multiple raiders hit the same building. [done]
- Prevent raiders from pathing toward buildings that are already broken. [done]
- Improve fighter tracking logic. [done]
- Check fighter recovery path/state after fights. [done]
- Allow builders to cancel queued destroy jobs cleanly if needed. [done]
- debug fighters and make sure they prioiritize enemies closest to town or are attacking town and not bunch up and also not do nothing if there is an enemy [done]
- yes and no button keep moving up on hover [done]
- placed to be built should act as placement blockers [done]
- continue causing crops to always have water sign even when nothing there [done]
- raiders having pathing issues after fighting (possible clean up issue)
- builders are prioiritizing fixing over new build jobs [done]
- debug issue of forager after getting reosurce [done]
- debug fireman sometimes not getting wood [done]

## audio
- Finish sound rebalance for overly loud and overly quiet sounds.
- Aim for a cleaner, more intentional audio mix across the whole game.
