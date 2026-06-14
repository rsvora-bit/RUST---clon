# HTML -> Unity port mapping

Primární zdroj: `Farken's World - Beta 1.5.1.html` (interní verze HTML 1.5.0).

Stavy: `DONE` = funkční Unity implementace, `PARTIAL` = funkční zjednodušená varianta, `BROKEN` = známá chyba, `TODO` = zatím nepřeneseno.

| HTML Feature | Unity Script / Scene Object | Status | Notes |
|---|---|---:|---|
| Hlavní scéna | `Assets/_FarkensWorld/Scenes/Main.unity`, `Bootstrap.cs` | DONE | Scéna zůstává jediným vstupním bodem a vytváří runtime systémy. |
| First person pohyb a mouse look | `FirstPersonController.cs` | DONE | WASD, myš, skok, sprint a vývojářský fly mode. `Teleport()` nyní používá raycast ground snap. |
| Pevný ostrov / ground collider | `WorldGenerator.cs`, `RuntimeSafety.cs` | DONE | Ostrov byl zvětšen na skutečný poloměr 74 m, má záložní collider a runtime fallback floor. |
| Bezpečný spawn | `WorldGenerator.PlayerSpawn`, `FirstPersonController.Teleport()`, `GameManager.Respawn()` | DONE | Spawn je snapnutý na collider pod hráčem, ne pouze na fixní Y. Nutné play-test ověření v Unity. |
| Failsafe pod `y = -20` | `FirstPersonController.Update()`, `RuntimeSafety.Update()` | DONE | Automatický respawn na bezpečný bod, kontrola NaN/Infinity pozice. |
| Rust-like HUD | `HUDController.cs`, `RuntimeUI.cs` | DONE | Nativní `Canvas`, tmavé panely, opacity, kotvení pro 1920x1080 a škálování. Vizuálně ještě doladit podle HTML. |
| Zaměřovač | `HUDController.cs` / `Crosshair` | DONE | Střed obrazovky. |
| Kompas nahoře uprostřed | `HUDController.cs` / `Top Compass` | DONE | Směr a stupně se mění podle yaw hráče. |
| FPS / local latency panel | `HUDController.cs` / `Performance` | DONE | Lokální FPS a statický local latency údaj. |
| Počasí a hodiny | `HUDController.cs` / `Weather` | PARTIAL | Vizuál a běžící čas jsou portované, plná HTML simulace počasí zatím ne. |
| Minimap vpravo nahoře | `HUDController.cs`, `IslandMapGraphic` | DONE | Mapa ostrova a živá značka hráče. |
| Velká mapa přes `M` | `MapUI.cs` | DONE | Ostrov, silnice, monument, sladká voda, legenda a pozice hráče. Waypoint zatím chybí. |
| Interakční prompt | `PlayerInteraction.cs`, `HUDController.cs` | DONE | Prompt se zobrazuje pod zaměřovačem pouze u cíle. |
| Feed a center alerts | `GameEvents.cs`, `HUDController.cs` | DONE | Maximálně šest zpráv a časovaná centrální hláška. |
| Survival panel vpravo dole | `HUDController.cs`, `PlayerStats.cs` | DONE | Health, hunger, thirst, stamina, status, povrch a úkol. |
| Temperature | `PlayerStats.cs` | PARTIAL | Teplota reaguje na čas a mokrost; blízkost ohně zatím neovlivňuje teplotu. |
| Bleeding / cold / wet / radiation alerts | `HUDController.UpdateStatus()`, `PlayerStats.cs` | DONE | Výstrahy se objeví pouze při problému. Dev terminal nově umí testovat `bleed`, `wet`, `rad`. |
| Hlad, žízeň a damage over time | `PlayerStats.cs` | DONE | Průběžný úbytek a poškození při kritických stavech. Dev terminal nově umí `damage`. |
| Bandage přes `H` | `GameManager.UseBandage()` | DONE | Léčí a snižuje krvácení. |
| Jídlo přes `G` | `GameManager.UseFood()` | DONE | Preferuje cooked meat, potom mushroom. |
| Inventory 28 slotů | `Inventory.cs`, `InventoryUI.cs` | DONE | 7x4 slotová mřížka, stacky, rarity/category barvy a obsazenost. |
| Hotbar jako prvních 6 slotů | `Hotbar.cs`, `HUDController.cs` | DONE | Výběr 1-6, zvýraznění, count a durability. |
| Výběr, drop 1 / stack | `InventoryUI.cs` | DONE | Kliknutí, `Alt` kliknutí a `Shift+Alt` kliknutí. |
| Přesun hráč <-> kontejner | `InventoryUI.cs`, `ContainerInventory.cs` | DONE | `Shift` kliknutí, take all a deposit all. |
| Storage box 12 slotů | `ContainerInventory.cs`, `BuildSystem.cs`, `InventoryUI.cs` | DONE | Otevíratelný kontejner s vlastním slotovým UI. |
| Furnace 2 input / fuel / 3 output | `Furnace.cs`, `InventoryUI.cs` | DONE | Turn on/off, progress, metal/sulfur/oil recepty. |
| Crafting recepty | `RecipeDefinition.cs`, `CraftingManager.cs` | DONE | Recepty, ceny, craft time a workbench požadavky odpovídají HTML seznamu. |
| Crafting queue a cancel | `CraftingManager.cs`, `InventoryUI.cs` | DONE | Fronta se třemi viditelnými položkami, průběh a vrácení surovin. |
| Workbench level 1-3 | `BuildPieceDefinition.cs`, `BuildSystem.cs` | DONE | Samostatně stavitelné tier objekty a detekce nejvyšší úrovně v dosahu. |
| Building plan menu | `BuildUI.cs`, `BuildPieceDefinition.cs` | DONE | Foundation, wall, doorframe, roof, campfire, storage, furnace, workbenches a sleeping bag. |
| Ghost valid / invalid | `BuildSystem.cs` | DONE | Zelený/červený preview materiál, raycast a snap k foundation. |
| Rotace, placement a cena | `BuildSystem.cs` | DONE | `R`, LPM, RMB a odečtení surovin/itemu. |
| Upgrade / repair / demolish | `BuildPiece.cs`, `BuildSystem.cs` | DONE | `U`, `T`, `X`, wood/stone/metal grade, HP a částečný refund. |
| Resource nodes | `ResourceNode.cs`, `WorldGenerator.cs` | DONE | Stromy, stone, metal ore a sulfur ore. |
| Road barrels / crates | `LootContainer.cs`, `WorldGenerator.cs` | DONE | Zničitelné objekty s loot tabulkami a fyzickými dropy. |
| Dropped item pickup | `DroppedItem.cs`, `DroppedItemWorldSpawner.cs` | DONE | Interakce `E`, částečný pickup při plném inventáři. |
| Optimalizovaný pickup | `DroppedItemWorldSpawner.cs` | DONE | Object pool, cache materiálů a aktualizace existujících UI slotů. Ještě fyzicky otestovat lag v Unity. |
| Fresh water interaction | `WaterZone.cs` | DONE | Pití u sladké vody přes interakci. |
| Save / load | `SaveManager.cs` | DONE | Seed, hráč, stats, inventory, hotbar, stavby, kontejnery, furnace a dropy. |
| Pause menu / ESC | `PauseMenuUI.cs`, `GameManager.cs` | DONE | Resume, save, load, respawn, inventory, mapa, nový svět a quit. |
| Private dev terminal | `DevConsoleUI.cs` | PARTIAL | F10/` a příkazy give, god, fly, save/load/report/clear. Nově `respawn`, `tp spawn`, `damage`, `bleed`, `wet`, `rad`. HTML weather/time/spawn/kill příkazy chybí. |
| World visuals | `WorldGenerator.cs` | PARTIAL | Ostrov, pláž, oceán, silnice, kopce, vegetace, rudy, monument a fog; bez AAA assetů. |
| Den/noc, déšť a lightning | - | TODO | HTML simulace prostředí zatím není plně portovaná. |
| Animal/enemy AI a corpse loot | - | TODO | Současný Unity projekt nemá AI aktéry. |
| Projectile bow | `PlayerCombat.cs` | TODO | Současný combat je raycast melee/harvest. |
| Death overlay a důvod smrti | - | TODO | Respawn je dostupný z pauzy a failsafe, samostatná death obrazovka chybí. |
| Settings overlay | - | TODO | FOV/HUD/audio/detail přepínače z HTML zatím nejsou v Unity UI. |
| Hlavní start menu a changelog | - | TODO | Unity verze startuje přímo do ostrova. |
| Navazující prompt pro Codex | `docs/CODEX_NEXT_PROMPT.md` | DONE | Český prompt popisuje, co už je hotové, a co má Codex dál ověřit/dodělat. |
