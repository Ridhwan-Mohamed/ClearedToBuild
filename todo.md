# Release Checklist
## v1.0.0 Launch Demo Priorities

### Player Polish
- Improve player art, movement, and sprite logic.
- Improve awareness logic so players and raiders do not crowd or stand on the same spot.
- Improve projectile player pathing and logic and defense.

### Status Updates
- Redesign to make larger and more self-explanatory.

### UI
- Improve fonts for smaller screens.

### The Shocker
- Fix wall preference.

### tutorial
- processv2 lol
- mention rock gives you money and rock

### Bugs
- Turret and catapults are not properly configurable.
- Fix overview mode UI issues.  [done]
- Fix parcel contract UI issues. [done]
- Fix players showing as selected when they are not selected.
- Raiders having pathing issues after fighting (possible cleanup issue).

### Audio
- Finish sound rebalance for overly loud and overly quiet sounds.
- Aim for a cleaner, more intentional audio mix across the whole game.

### Main Menu
- Space the logo and the two buttons better.
- Add the studio logo somewhere.
- Handle resize better here.

### Starting Draft
- Fix the small text and lack of sharpness.
- Use a different font for small text.
- Make sure team fits in the starting crew row properly.

### Town Layout
- Make sure zoom does not stop the player from placing troops around the map fully. [done-ish]
- Add hover to player icons like buildings.
- Fix small text issues here too.
- Remove useless text and bars. [done]
- Make the back and start button design more comprehensive. [done]

### Continue And Draft Menu
- Fix zoom being angled.

### Contract Parcel UI Bugs [done]
- Fix overview mode style bleeding into detailed mode. [done]
- Make direction labels hidden in overview mode. [done]
- Make pressure parcel prices in overview mode more readable. [done]
- Fix sale/longer UI filling up the contract HUD page in detail mode. [done] 
- Fix sale/longer UI not looking good in overview mode. [done]
- Make parcel descriptions better. [done]

### Bottom Bar
- Make it less wide.
- Remove forager stuff. [done]
- Remove attack button. [done]
- Make scrolling comprehensive and evident in scrollables.
- Either remove the clay oven cook bar or fix it so it moves. [done]
- On destruction of all players, houses, ovens, and storages, keep the design format size the same and do not shrink sections. 
- Add an icon distinction for cards in deck vs consumables.
- Lower the description text for cards. [done]
- Make cards not always need confirms based on type.
- Fix the label design for number of cards.

### Rewards
- town reward from xp should open anytime during day/dawn/dusk, only night it waits [done]
- Move the continue button down on horde unlock. [done]
- Use portraits for player unlocks instead of walking-down art. [done]
- Fix text issues here too.
- no more crazy level up rewards, pick 1 commodity [done]
- permit reward is player icon why? [done]
- offering cards already have [done]

### Town Status Bar
- Make it bigger with graphs.
- Show when something is full vs when all slots are used more clearly.

### Game UI Stuff
- Make the storage UI filled-slots text better. [done]
- day, night and dawn top bar hovers should leave [done]
- coin/xp audio when being added [done]
- On relief package use, refresh the left side of the top bar and remove hover. [done]
- no relief package in sotre tab, should be in market [done]

### achievements
- fixed height [done]
- check for scalability [done]
- progress bar not filling up, figure out or remove [done]

### projectile players
- movement still weird, fix
- some buildings bullets go through
- delete bullets that miss [done]

### Players
- Make them emote when going to sleep, when tired, and when idle. [done]
- Make them emote after missing food, water, or both. [done]
- Make them emote with a cooldown when fleeing. [done]
- Add yelling sounds and scale them based on more people fleeing. [done]
- Figure out why speech text cannot be seen when storage is full. [done]
- sleeping players shouldnt flee and enemies shouldnt try to hit/track sleeping players (be unaware of them) [done]
- hunger/thirst death doesnt show animation for death [done]
- animation death a bit slower [done]

### Workers
- Fireman should add cooked water to storage whenever made, even if in `idle` mode. [done]
<!-- - Foragers are not coming back when done foraging.
- Builders should not be fixing a building simultaneously while it is being hit. -->

### Pause Menu [done]
- Remove useless text. [done]
- Make the scroller match percent on open. [done]
- Make the mute button not hidden. [done]
- Make all other HUD UI stuff also altered, not just world scene stuff. [done]

### Enemies
- Raiders sometimes multi-hit way too fast. [done]
- Bombers need to be redesigned or removed.
- Hunter and bomber art need to be redone.
- Make raiders aggro more if someone is within their local area bounds.

### balancing
- blademaster and gunslinger and maybe brawler need nerfs [done]

### Overview Mode
- Make movement faster here. [done]
- Make updates happen locally when stuff changes. [done]

### Map
- Make building placements stop messing up the ground. [done]
- Do not let players place anything on the outermost ring of the main island or any farther. [done]
