# Release Checklist

Goal for release:
- Ship a polished endless-run build where the core loop is clear, rewards feel good, automation is satisfying, and the controls do not fight the player.

## v0.9.9 Main Patch Priorities

### 1. Save Functionality [check]
- Add full local storage save/load support for continue-on-reload.
- Restore timer state, map layout, parcels, buildings, cook jobs, players, inventories, and player states.
- Make reload return the game to the same progression state instead of restarting the run.
- Treat this as a major systems task and lock down data shape early so follow-up features can build on it.

### 2. Menu Pause [check]
- Add an in-game pause menu.
- Let the player pause to manage settings and game state safely.
- Include volume controls, mute, save, continue, restart, and delete/reset actions.
- Make sure this plays nicely with the save/load system and does not leave timers or jobs in a bad state.

### 3. Parcel Addition And Removal Performance [check]
- Rework parcel add/remove so we do not redraw the whole map or rebuild the full navmesh every time.
- Redraw only the parcel bounding box plus a 1-tile border for connected terrain updates.
- Build navmesh locally for the parcel, then connect it into the main island navmesh.
- Goal: reduce hitching and make parcel expansion feel snappy.

### 4. Storage Logic [check]
- Make haulers and workers prioritize the closest valid storage instead of first-added storage.
- Sort candidate storages by distance before deposit and pickup decisions.
- Verify this works for both placing items into storage and pulling items back out.
- Goal: remove dumb pathing and reduce unnecessary walking.

### 5. bottom bar final pass [check]
- Tighten layout and logic across every page/state.
- Make it more compact, more readable, and more consistent.
- Clean up edge cases where the wrong actions or spacing show up.
- Treat this as the last major UX pass for the bar before `v1.0.0`.

### 6. Sound Pass [in progress]
- Add missing sounds for main menu, button clicks, menu transitions, and swimming.
- Rebalance overly loud and overly quiet sounds.
- Cap simultaneous footstep sounds so they do not stack into noise.
- Aim for a cleaner, more intentional audio mix across the whole game.

### 7. Achievements [check]
- Add early and mid-game achievements that guide player behavior.
- Examples: first house, first storage, first oven, first fighter.
- Reward with XP, money, or other light progression boosts.
- Use achievements as goal-setting and onboarding support, not just completion tracking.

### 8. UI Pass + market [in progress]
- use better fonts for smaller screens 
- fix overview mode ui and parcel contract ui issues

### 9. market Pass [check]
- redesign market

### 10. water pickup spots [check]
- either fix water spots on run time or come up with a more elegant solution
- implement solution
- make parcel lakes swimmable by changing the sprite used

### 11. Resilient Builders and walls [check]
- stop them (buildes and pther palyers) from getting stuck from being built over when building walls mainly like a builder standing in a spot to build a wall but that spot is already queued for another wall placement thus getting caught (and make them cautious when building walls/buildings in general, some awareness ot flee area)
- multilayer walls cause for breach logic to break when the soltuion is just to break the wall multituple times, perhaps consider walls their own region based on connection?
- fix breach bug when wall is closed while a enemy path is active causing the raider to just through the now currently blocked last entry point
- when players are in a blocked spot, path them automatically to nearest unblocked in a straight path then let them continue normal functions

### bugs
- fighters using unintelligent tracking software
- check recovery path/state for fighters post fight
- allow builders to cancel queued destroy jobs cleanly if needed [x]
- fix navmesh issues on parcel adds [x]
- allow navmesh merging [x]

## v1.0.0 Focus
- Tutorial
- QA and bug fixing
- Light polish patches only

## Notes
- More items will probably surface during `v0.9.9`, but this should stay the core patch list unless something critical appears.