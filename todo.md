# Release Checklist

Goal for release:
- Ship a polished endless-run build where the core loop is clear, rewards feel good, automation is satisfying, and the controls do not fight the player.

## Do First

1. Rewards + economy clarity
- [ ] Rewards balancing pass
  - tune XP pacing
  - tune consumable reward values
  - tune card appearance rates
  - make sure level-up rewards do not outscale horde pressure too early
- [ ] Reward control for troop-type cards
  - only show player-type cards when that troop is actually available for buy/unlock
  - avoid dead reward choices
- [ ] Auto-build rewards
  - add rewards that place buildings automatically
  - make sure they respect placement rules and do not create dumb layouts

2. Core automation + defense logic
- [ ] Refueling logic for turrets and catapults
  - assign supply jobs cleanly
  - keep ammo/fuel readable in UI
  - make sure defense structures do not silently die due to missing upkeep
- [ ] Nerf wall building time
  - walls should take meaningful time to place/build
  - keep an instant-build card/reward as a special payoff
- [ ] Function tab overhaul
  - centralize global commands
  - add water production control
  - add better global gather / town-management commands
  - make it the place players go for town-wide automation, not unit micro

3. Missing content that affects the loop
- [ ] Militia parcel
  - temporary fighter drop for one night
  - make it feel like a panic / emergency defense contract
  - cleanly expire after the night ends

## Do Next

4. Presentation + polish with gameplay impact
- [ ] Swim animations for all troop types
  - keep silhouettes readable in water
  - make sure state transitions in/out of swim feel clean

5. Balance follow-up after systems land
- [ ] Re-test reward pacing after automation rewards and militia parcel are in
- [ ] Re-test endless scaling once turret/catapult refueling is working
- [ ] Re-test early wall pressure after slower wall build times

## Release QA

6. Must-pass checks before ship
- [ ] Verify every troop command flow still works after Function Tab overhaul
- [ ] Verify reward screens never offer dead choices
- [ ] Verify auto-build rewards never place into invalid / blocked spots
- [ ] Verify militia parcel spawns and despawns correctly across dusk / night / dawn
- [ ] Verify turret and catapult refueling survives restart / loss / long endless runs
- [ ] Verify swimming troops use correct animations in all directions
- [ ] Verify wall build-time nerf still feels fair in early game

## Keep In Mind

Design guardrails:
- rewards should push interesting choices, not just raw snowball
- automation should reduce busywork without removing player expression
- emergency defense tools should help recover mistakes, not trivialize nights
- release polish should focus on readability and feel, not feature sprawl

## Post-Release / Later

- medics
- hospitals
- crafting shops
- more troop types
- more buildings
- items / meta progression
- specialized ship types
- team name clear fix
- path update on new region creation
