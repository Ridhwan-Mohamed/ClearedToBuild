Advancing TODOS
✨ QOL
    🔤 Fonts ☑️
Building
    only allow building in team zone
Back_To_Town + roam ☑️
    farm spots are valid walk areas ☑️
    only go back to town if told to, stay put (or roam) otherwise ☑️
enemy ai
    - attack infra ☑️
    - attack players bug needs fixing 
base 
    - house makes players ☑️
    - select for tasks ☑️
    - empty state when state empty ☑️
fighting
     - on click enemy with selected go send them to fight ☑️
     - calculate all possible sites to attack for holes ☑️
     - large group fighting enemy select thingy ☑️ 
     - enemy routine (check what can attack after one attack) ☑️
     - your team should check if any targets are to attack after complete attack ☑️
Guns
    - make animations ☑️
    - make shots lead ☑️
    - make shots hurt and kill ☑️
    - edit bullets look
    - make player move away from target
Draw
    - day end level screen with 3 rogue like features and store like mechanics ☑️
    - add house and code for that to store ☑️
day and night cycles
    - add clock ☑️
    - add rectangle of darkness ☑️
    - spawn and send at night hours ☑️
base 
    - for shared tasks, stop in follow path if no longer active ☑️
goals
    - build ship to leave 
----------------------------------------------------------------------------------------------
to finish MVP:

🌱 PHASE 1 – CORE RESOURCE LOOP DEEPENING (2–4 days)
Focus: Transform farming from passive to interactive, introduce water + hunger as friction.

✅ Add Water Mechanics:
    🌱 Crops need water daily to grow (track hydration per crop)
    🪣 “Watering can” action for farmers: fetch + water nearby crops
✅ Add Food Requirement:
    🍞 Troops/Farmers consume food daily
    📉 Hunger/Morale debuff if food is insufficient (slower work, lower combat stats)
    👀 UI: Food per day usage and stored food count
✅ Add Storage Building:
    🏚️ Granary or Storage Shed
    🎒 Cap max food (and clean water) unless storage exists
    ⏳ Optional: Decay timer for food if no storage
    live update for storage.
✅ 🔥 Add Clay Oven (Hearth):
🧱 Building: “Clay Oven” unlocked early (cost: stone + wood)
    🔁 Converts:
        Dirty Water → Clean Water (drinking only)
        Raw Wheat + Clean Water → Bread
        Raw Meat → Cooked Meat (later)
    ⏱️ Simple progress timer (10s boil/cook)
    🧑‍🍳 Farmers or cooks can operate the oven
add stone and wood types ***

🧑‍🌾 PHASE 2 – ROLE SPECIALIZATION + JOB SYSTEM (3–5 days)
Focus: Differentiate players into classes, limit universal utility.

 Implement worker classes:

Farmer: faster crop handling, can water

Fighter: higher HP, only ones who fight

Fisher: auto-fish from ponds for slow food

Builder (optional): auto-queue buildings

 Restrict actions by type (e.g. only fighters can attack)

 Add class icon or color over unit heads

 Assign roles via card reward or house-building

🧱 PHASE 3 – ENVIRONMENT & RESOURCE SYSTEMS (4–6 days)
Focus: Expand your map and introduce extractive gameplay.

 Add trees → Lumberjack role + Wood as a new resource

Trees regrow slowly

Used in housing + building upgrades

 Add mining tile → Miner role + Stone/Iron resource

Add 1-2 new tiles

Risk of collapse or hazard

 Add new building: Water Purifier

Clean water needed for larger farms

Must be maintained or enemies poison it

⚔️ PHASE 4 – ENEMY VARIETY & ESCALATION (4–6 days)
Focus: Add surprise, threat, and forced adaptation.

 Add 3 new enemy types:

Poisoner (targets water tiles)

Thief (steals stored food)

Siege monster (destroys buildings)

 Add enemy “camp” locations on map (fogged)

Optional: can destroy for reward

 Add defense buildings (e.g., turret, wall)

 Night fog mechanic: limits visibility during night raids

🚢 PHASE 5 – MIDGAME & WIN CONDITION (3–5 days)
Focus: Provide long-term objective and tech development.

 Add tech/upgrade building (Research Bench):

Unlock new buildings, better tools

Example: Faster farming, stronger turrets, efficient storage

 Add escape path (e.g. Build a Ship):

Requires wood, stone, iron, food

Takes days to complete

Can be attacked during construction

 Alternate path: destroy all enemy lairs

 Add goal UI + progress tracking

🪄 PHASE 6 – POLISH, VARIANTS, AND PLAYER AGENCY (Ongoing)
Focus: Replayability, polish, and alternate paths.

 Add powerup rarities (epic, rare, common)

 Add map generation variants

 Add seasons: change crop type, water needs

 Add alternate modes (hardcore, endless)

 Add weather (slows movement, reduces crops)