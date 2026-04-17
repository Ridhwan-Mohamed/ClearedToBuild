# Release Checklist

Goal for release:
- Ship a polished endless-run build where the core loop is clear, rewards feel good, automation is satisfying, and the controls do not fight the player.

## Do First

1. Rewards + economy clarity
- [x] Reward control for troop-type cards
  - only show player-type cards when that troop is actually available for buy/unlock
  - reward palyer if not sufficient space for items in storage

2. Core automation + defense logic
- [x] Nerf wall building time
  - walls should take meaningful time to place/build
- [x] Function tab overhaul
  - centralize global commands
  - add water production control
  - add better global gather / town-management commands
  - make it the place players go for town-wide automation, not unit micro

3. Missing content that affects the loop
- [x] Militia parcel
  - temporary fighter drop for one night
  - make it feel like a panic / emergency defense contract
  - cleanly expire after the night ends
- [x] farm parcel
  - use dark grass for change
  - mix seeds and berries better
  - in overview, showgrid spots with colour that are seeds and berries

## Do Next

4. Presentation + polish with gameplay impact
- [x] Swim animations for all troop types
  - keep silhouettes readable in water
  - make sure state transitions in/out of swim feel clean

## Release QA

6. Must-pass checks before ship
- [ ] Verify every troop command flow still works after Function Tab overhaul
- [ ] Verify reward screens never offer dead choices
- [ ] Verify auto-build rewards never place into invalid / blocked spots
- [ ] Verify militia parcel spawns and despawns correctly across dusk / night / dawn
- [ ] Verify turret and catapult refueling survives restart / loss / long endless runs
- [ ] Verify swimming troops use correct animations in all directions
- [ ] Verify wall build-time nerf still feels fair in early game