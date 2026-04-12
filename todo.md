# MVP / Demo Roadmap

Goal for `v1.0.0`:
- Make the core loop obvious and fun:
  - prep by day
  - survive a horde by night
  - pick a reward
  - expand and automate
  - repeat until the last Town Tower falls

## Do First: Core Game Loop

1. Endless horde mode pivot
- [x] Remove the North Fort as an active progression objective from the demo loop
- [x] Make the run endless instead of stage-clearing
- [x] Scale horde difficulty upward continuously until the player dies
- [x] Make horde completion the main progression beat instead of fort destruction

2. Town Tower rules
- [x] Use Town Tower as the core survival structure
- [x] Start each run with 1 Town Tower
- [x] Lose only when all Town Towers are destroyed
- [x] Give the starting Town Tower `+$150` and `+2 expansion permits` at dawn
- [x] Give each additional Town Tower `+$150` and `+1 expansion permit` at dawn
- [x] Let players build more Town Towers during the run
- [x] Add a proper tower-destruction loss flow
  - town explosion / failure sequence
  - run summary
  - back to main menu button

3. Day / dusk / night rules
- [x] Lock the game into clear phases
  - Day = build / gather / expand
  - Dusk = last prep / recall / lock parcel buying
  - Night = horde survival only
  - Dawn = reward + daily income + permits
- [x] Disable parcel buying at dusk and night
- [x] Prevent parcel offers from carrying across days
- [x] Recall or cancel remote parcel jobs at dusk
- [x] Keep town-contained jobs alive if they still make sense at night
- [x] Make it extremely obvious what is allowed in the current phase

4. Pressure parcel horde system
- [x] Replace the current fort-pressure loop with nightly pressure parcels / attack lanes
- [x] Make each horde use a quota of pressure parcels
- [x] Scale parcel count and enemy composition over time
- [x] Add wave modifiers for later hordes
  - fast raiders
  - heavy grunts
  - siege pressure
  - torch rush
- [x] Show which directions / parcel lanes will be pressured before night starts

5. Post-horde reward loop
- [x] Give 1 of 3 reward choices after each horde
- [x] Grant expansion permits equal to the number of pressure parcels survived that night
- [ ] Refresh daily wards after each completed night / dawn
- [x] Keep the reward screen fast and readable so the run keeps momentum

6. Early unlock track
- [x] Survive Horde 1 -> unlock Blademaster
- [x] Survive Horde 2 -> unlock Gunslinger
- [x] Survive Horde 3 -> unlock Turrets
- [x] Survive Horde 4 -> unlock Stone Walls
- [x] Survive Horde 5 -> unlock Catapults
- [x] Make these milestone unlocks very clearly communicated in UI

## Economy + Expansion

7. Parcel role cleanup
- [ ] Make parcels primarily a Day-phase economy / expansion system
- [ ] Make night parcels purely pressure lanes, not active work zones
- [ ] Make expansion feel necessary, not optional turtling
- [ ] Rebalance permit flow around the new endless loop
- [ ] Make sure starting town can stabilize early but not scale forever without expansion

8. Seeds / berries source design
- [ ] Add a dedicated fertile / farm parcel type for long-term seed and berry economy
- [ ] Keep market as an emergency fallback for seeds / berries instead of the main source
- [ ] Price emergency market support high enough that farm parcels are the preferred long-term answer
- [ ] Make the farm parcel read clearly in overview and in contracts

9. Turtling balance pass
- [ ] Make the starting parcel insufficient for long-term defense scaling
- [ ] Increase repair / sustain / economy pressure across later hordes
- [ ] Make passive turtling collapse under higher night pressure
- [ ] Keep early success possible without making static play the dominant strategy

## UX / Readability

10. Phase clock + communication
- [x] Add a segmented clock that clearly shows:
  - Day work window
  - Dusk warning window
  - Night survival window
  - Dawn reward / reset window
- [x] Show current phase text and allowed actions
- [x] Show time remaining until the next phase
- [x] Show night survival duration while a horde is active
- [x] Make dusk parcel lock impossible to miss so players do not get baited into bad late buys

11. Horde telegraphing
- [x] Show the upcoming horde size before night starts
- [x] Show enemy types or lane modifiers before the horde starts
- [x] Make attack direction warnings readable in both detailed and overview play
- [x] Keep alerts short and punchy

12. Reward / run summary polish
- [ ] Make the post-horde reward flow feel juicy and fast
- [ ] Add a run-end summary that shows what the player accomplished
  - nights survived
  - towers built
  - parcels claimed
  - enemies defeated
  - troops unlocked

## Systems To Reuse / Finish

13. Existing systems to repurpose cleanly
- [ ] Rewire contracts / parcels to fit the new day-night horde cadence
- [ ] Reuse the card reward system as the main between-horde reward structure
- [ ] Reuse troop unlocks instead of inventing a new meta system for the demo
- [ ] Reuse existing defense buildings as the main escalation curve

14. Demo QA checklists
- [ ] Make a checklist to verify order logic for every order type
- [ ] Make a checklist to verify every command bar button flow for every troop / unit type
- [ ] Make a checklist for phase transitions
  - day -> dusk
  - dusk -> night
  - night -> reward
  - reward -> dawn
- [ ] Make a checklist for parcel lock / recall / nightly pressure behavior

## Nice To Have Before Demo

15. Optional polish if time allows
- [ ] Add stronger visual identity to horde nights
- [ ] Improve run-end stats and screenshots
- [ ] Add a few more late-wave modifiers if the loop is stable

## Backlogs

Minor fixes
- team name cant clear

Major fixes
- Path update on new region creation (goes through last placed tile)

------------------------------------------------------------------------------------------------------------------

## Down the Line

- medics
- hospitals
- crafting shops
- more troop types
- more buildings
- items / meta progression
- specialized ship types
