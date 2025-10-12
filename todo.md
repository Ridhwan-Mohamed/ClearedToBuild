📈 Advancing TODOS

🎛️ Tab Page UI Tasks

🔹 Setup & Integration
- [✔️] Install or import rexTabPage plugin or module (from rex-notes UIs)
- [✔️] Ensure scene has rex UI scene support (load plugin, etc.)
- [✔️] Define tab page container UI component

🔹 Define Tabs
- [✔️] Create tabs: Players | Ovens | Storages | Functions
- [ ] Style tabs: tab labels, background, selected tab indicator
- [✔️] Make tab switching logic (change content when tab clicked)

🔹 Content of Each Tab

  • Players Tab
    - [✔️] List all players (cards/rows) with name, health, stamina
    - [✔️] Include buttons for Sleep/Awaken, Sell

  • Ovens Tab
    - [✔️] List all clay ovens, status (idle / cooking / etc.)
    - [✔️] Show queue / pending items
    - [✔️] Buttons for actions: start cooking jobs, cancel jobs

  • Fireman
    - [✔️] Do only jobs that are asked, not place water infinitly
    - [✔️] refuel

  • Forager
    - [✔️] Fix issue where block resources are priotized (by order instead)

  • Storages Tab
    - [✔️] List all storages, current contents (# of seeds / wood / etc.)

  • Functions Tab
    - [✔️] Buttons for “Farm / Harvest”, “Get Seeds”, “Get Block Resources”
    - [✔️] Show status / progress of these functions if running

🔹 UX / Behavior
- [✔️] Each tab content should scroll if content overflow
- [✔️] Maintain state: remember which tab was open last
- [✔️] Close or hide tab UI when clicking outside or via close button

🔹 Polishing
- [✔️] Key shortcut for pulling up and down tab bar 

---------------------------------------------------------------------------------------------------------------------------------
📦 BackLog
    - 🍽️ Decrease health / increase stamina based on food/water on EOD 
    - 🔄 fix redraw (OAFA)
    - 🚰 needs a switch to stop producing water unnecessarily (3 / maybe subtask in larger Player UI reconfig)
----------------------------------------------------------------------------------------------------------------------------------
⏳ Down the Line
    - 🎨 Art Overhaul
    - 📦 Storage Reconfig
    - 🧭 Pathing Update
    - ⚔️ Fighting