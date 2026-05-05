# Release Checklist
## v1.0.0 Launch Demo Priorities

### Tutorial
- Add a talking guide/player that walks new players through the core systems.
- Teach farming basics.
- Teach building placement and town expansion basics.
- Teach parcel purchasing.
- Teach defending yourself and the town.
- Keep the rest of the game light-touch and self-explanatory.

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

### Enemies
- Add a run-and-explode enemy type that detonates when it reaches its target. [done]
- Allow players to stop the exploding enemy by killing it before detonation. [done] 
- Add a projectile-shooting enemy type similar to the Gunslinger, but less powerful. [done]
- Improve off-screen enemy indicators. [done]
- Reduce indicator size and fix cases where indicators do not appear. [done]
- make them prefer attacking troops, less so non offensive ones

### Balancing
- Balance money gathering so players cannot earn too much too quickly.
- Tune progression so the game gets difficult at a good rate.
- Balance parcel item pricing.
- Scale parcel prices over time.
- Balance market item pricing.
- Scale market item prices over time.
- Balance player costs.
- Scale player costs over time.

### Market Tab Art
- Add art for market tab items. [done]
- Add more market tab items. [done]
- Replace placeholder market item art with finished art. [done]

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
- animate parcel addby the tile
- make parcel add work on thread

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

## audio
- Finish sound rebalance for overly loud and overly quiet sounds.
- Aim for a cleaner, more intentional audio mix across the whole game.
