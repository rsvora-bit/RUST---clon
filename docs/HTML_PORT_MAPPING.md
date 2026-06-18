# HTML -> Unity port mapping

Primární zdroj: `Farken's World - Beta 1.5.1.html` / HTML Beta 1.5.x.

Tento soubor mapuje, co z HTML prototypu existuje v Unity. Status `DONE` znamená pouze: funkce je v Unity, prošla Play Mode testem a odpovídá aspoň zjednodušeně HTML referenci. Pokud funkce pouze existuje v C# kódu, ale není gameplay ověřená, má být `PARTIAL`.

Poslední aktuální ověření: Unity batch build a postavený runtime player smoke test prošly na `Assets/_FarkensWorld/Scenes/Main.unity`. Smoke test ověřil spawn, walkable `BoxCollider`, cestu spawn -> tráva/road -> střed ostrova, weather, death/respawn a AI spawn. Ruční 2minutový Editor Play Mode test je pořád nutný pro vizuální popping, UI a reálné ovládání.

Stavy: `DONE` = hotové a ověřené, `PARTIAL` = existuje, ale je zjednodušené nebo neověřené, `BROKEN` = je v kódu, ale chová se špatně, `TODO` = zatím nepřeneseno.

| HTML Feature | Unity Script / Scene Object | Status | Notes |
|---|---|---:|---|
| Hlavní scéna | `Assets/_FarkensWorld/Scenes/Main.unity`, `Bootstrap.cs` | PARTIAL | Scéna existuje, spouští runtime systémy a prošla batch build/runtime smoke. Ruční Editor Play Mode audit pořád zopakovat. |
| First person pohyb a mouse look | `FirstPersonController.cs` | PARTIAL | Automatizovaný runtime pohyb prošel spawn -> tráva/road -> střed ostrova. WASD, myš, sprint, jump a input lock ještě ručně ověřit. |
| Pevný ostrov / ground collider | `WorldGenerator.cs`, `RuntimeSafety.cs` | PARTIAL | Walkable povrch řeší `BoxCollider` objekty. `Beach Visual`, `Island Visual` a `Road` nemají walkable collider; smoke test trefil `Walkable Island Collider (BoxCollider)`. Ruční kontrola hran/invisible walls ještě zbývá. |
| Bezpečný spawn | `WorldGenerator.PlayerSpawn`, `FirstPersonController.Teleport()`, `GameManager.Respawn()` | PARTIAL | Runtime smoke potvrdil spawn na zemi a respawn flow. Opakovaný ruční respawn / `tp spawn` přes dev console ještě ověřit v Editoru. |
| Failsafe pod `y = -20` | `FirstPersonController.Update()`, `RuntimeSafety.Update()` | PARTIAL | Existuje v kódu. Ověřit pádem pod mapu nebo dev příkazem. |
| Rust-like HUD | `HUDController.cs`, `RuntimeUI.cs` | PARTIAL | Canvas UI existuje. Vizuálně ještě doladit, aby více odpovídalo HTML místo obecného Unity prototypu. |
| Zaměřovač | `HUDController.cs` / `Crosshair` | PARTIAL | Viditelný, ale ověřit placement a chování při UI panelech. |
| Kompas nahoře uprostřed | `HUDController.cs` / `Top Compass` | PARTIAL | Viditelný nahoře uprostřed. Ověřit přesnost směru a podobu podle HTML. |
| FPS / local latency panel | `HUDController.cs` / `Performance` | PARTIAL | Panel existuje. Ověřit toggle, správné hodnoty a shodu s HTML stylem. |
| Počasí a hodiny | `WorldEnvironment.cs`, `HUDController.cs` | PARTIAL | Systém existuje. Ověřit `weather`, `time`, světlo, déšť, mlhu a HUD. |
| Minimap vpravo nahoře | `HUDController.cs`, `IslandMapGraphic` | PARTIAL | Minimap existuje. Ověřit orientaci, player marker, pozici a map scale. |
| Velká mapa přes `M` | `MapUI.cs` | PARTIAL | Existuje. Ověřit otevření, zavření, legendu, pozici hráče a input lock. Waypoint chybí. |
| Interakční prompt | `PlayerInteraction.cs`, `HUDController.cs` | PARTIAL | Existuje. Ověřit u lootů, vody, storage, furnace, corpse a workbench. |
| Feed a center alerts | `GameEvents.cs`, `HUDController.cs` | PARTIAL | Existuje. Ověřit timing, max počet zpráv a vzhled. |
| Survival panel vpravo dole | `HUDController.cs`, `PlayerStats.cs` | PARTIAL | Existuje. Ověřit drain statů, damage over time, cold/wet/rad a layout. |
| Temperature | `PlayerStats.cs` | PARTIAL | Reaguje na některé stavy, ale úplná HTML shoda není ověřená. |
| Bleeding / cold / wet / radiation alerts | `HUDController.UpdateStatus()`, `PlayerStats.cs` | PARTIAL | Ověřit přes `bleed`, `wet`, `rad`, weather a temperature testy. |
| Hlad, žízeň a damage over time | `PlayerStats.cs` | PARTIAL | Existuje. Ověřit časování, damage a hranice hodnot. |
| Bandage přes `H` | `GameManager.UseBandage()` | PARTIAL | Existuje. Ověřit heal, bleeding reduction a item count. |
| Jídlo přes `G` | `GameManager.UseFood()` | PARTIAL | Existuje. Ověřit prioritu cooked meat / mushroom a doplnění hunger. |
| Inventory 28 slotů | `Inventory.cs`, `InventoryUI.cs` | PARTIAL | 7x4 grid existuje. Ověřit stacky, click/drag/drop/transfer a vizuál podle HTML. |
| Hotbar jako prvních 6 slotů | `Hotbar.cs`, `HUDController.cs` | PARTIAL | Existuje. Ověřit 1-6, selected highlight, item use a durability. |
| Výběr, drop 1 / stack | `InventoryUI.cs` | PARTIAL | Existuje podle dokumentace/kódu. Nutné gameplay ověření. |
| Přesun hráč <-> kontejner | `InventoryUI.cs`, `ContainerInventory.cs` | PARTIAL | Existuje. Ověřit všechny container typy a edge cases při plném inventory. |
| Storage box 12 slotů | `ContainerInventory.cs`, `BuildSystem.cs`, `InventoryUI.cs` | PARTIAL | Existuje. Ověřit otevření, save/load, take all/deposit all/sort. |
| Furnace 2 input / fuel / 3 output | `Furnace.cs`, `InventoryUI.cs` | PARTIAL | Existuje. Ověřit smelting, fuel, on/off, progress, output a save/load. |
| Crafting recepty | `RecipeDefinition.cs`, `CraftingManager.cs` | PARTIAL | Existuje. Ověřit recepty podle HTML, ceny, workbench tier a missing resources. |
| Crafting queue a cancel | `CraftingManager.cs`, `InventoryUI.cs` | PARTIAL | Existuje. Ověřit progress, cancel refund a overflow drop. |
| Workbench level 1-3 | `BuildPieceDefinition.cs`, `BuildSystem.cs` | PARTIAL | Existuje. Ověřit radius detekci a blokaci receptů. |
| Building plan menu | `BuildUI.cs`, `BuildPieceDefinition.cs` | PARTIAL | Existuje. Ověřit všechny piece typy a UI layout. |
| Ghost valid / invalid | `BuildSystem.cs` | PARTIAL | Existuje. Ověřit preview barvy, snapping, kolize a placement na terénu. |
| Rotace, placement a cena | `BuildSystem.cs` | PARTIAL | Existuje. Ověřit `R`, LPM/RMB, odečtení surovin a chování bez resources. |
| Upgrade / repair / demolish | `BuildPiece.cs`, `BuildSystem.cs` | PARTIAL | Existuje. Ověřit `U`, `T`, `X`, grade, HP a refund. |
| Resource nodes | `ResourceNode.cs`, `WorldGenerator.cs` | PARTIAL | Stromy/rudy existují. Ověřit těžbu, dropy a hit feedback. |
| Road barrels / crates | `LootContainer.cs`, `LootTableDatabase.cs`, `WorldGenerator.cs` | PARTIAL | Loot kontejnery existují. Ověřit loot table výstupy, otevření a pickup. |
| Dropped item pickup | `DroppedItem.cs`, `DroppedItemWorldSpawner.cs` | PARTIAL | Existuje. Ověřit pickup bez freeze a chování při plném inventáři. |
| Optimalizovaný pickup | `DroppedItemWorldSpawner.cs` | PARTIAL | Pooling/cache existují. Nutné měřit prakticky, jestli pickup nelaguje. |
| Fresh water interaction | `WaterZone.cs` | PARTIAL | Existuje. Ověřit `E` u vody, thirst restore a prompt. |
| Save / load | `SaveManager.cs` | PARTIAL | Existuje. Ověřit kompletní gameplay save/load po všech nových systémech. |
| Pause menu / ESC | `PauseMenuUI.cs`, `GameManager.cs` | PARTIAL | Existuje. Ověřit input lock, resume, save/load, settings, map, respawn. |
| Private dev terminal | `DevConsoleUI.cs` | PARTIAL | Existuje. `report` nově vypisuje player position, grounded, ground collider, seed, weather/time, population counts, arrows, drops a grass details. Celý ruční příkazový checklist ještě ověřit přes `F10`/backquote. |
| World visuals | `WorldGenerator.cs` | PARTIAL | Ostrov a low-poly svět existují včetně statického grass detail meshe. Vizuální shoda a popping musí ještě projít ručním Play Mode testem. |
| Grass / world detail popping | `WorldGenerator.cs` | PARTIAL | Kandidátní fix: tráva se vytváří jednou jako statický seedovaný mesh (`GrassDetailCount=520`) a ne přes pohyb hráče/chunky; road visual už nemá fyzický collider/lip. Runtime smoke prošel, ale viditelné doskakování musí potvrdit ruční test. |
| Den/noc a déšť | `WorldEnvironment.cs` | PARTIAL | Existuje. Ověřit přechody, rain particles/audio a clear reset. |
| Animal/enemy AI a corpse loot | `WorldActor.cs`, `WorldPopulation.cs`, `CorpseContainer.cs` | PARTIAL | Existuje. Ověřit spawn, pohyb, damage, smrt, corpse a loot. |
| Projectile bow | `PlayerCombat.cs`, `ArrowProjectile.cs` | PARTIAL | Existuje. Ověřit míření, fyziku, damage, spotřebu arrows a cleanup. |
| Death overlay a důvod smrti | `DeathUI.cs`, `GameManager.cs` | PARTIAL | Existuje. Ověřit `damage 999`, důvod smrti, respawn a input. |
| Settings overlay | `SettingsUI.cs`, `GameSettings.cs` | PARTIAL | Existuje. Ověřit FOV, sensitivity, HUD opacity, toggly, audio a persistenci. |
| Procedurální zvuky | `ProceduralAudio.cs` | PARTIAL | Existuje. Ověřit SFX, rain ambience, mute a hlasitost. |
| Hlavní start menu a changelog | - | TODO | Unity verze zatím startuje přímo do ostrova. |
| Navazující prompt pro Codex | `docs/CODEX_NEXT_PROMPT.md` | DONE | Prompt existuje a má Codex vést přes docs a Play Mode audit. |
