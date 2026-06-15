# Implementation status

| Feature | Status | Notes |
|---|---:|---|
| First person controller | DONE | WASD, mouse look, jump, sprint, fly debug. Teleport nyní snapuje hráče na collider pod spawnem. |
| Ground/terrain collider | DONE | Pevný ostrov plus neviditelný bezpečnostní collider; nově také runtime fallback floor přes `RuntimeSafety`. |
| Player spawn | DONE | Bezpečný spawn, ground snap při teleportu a automatický respawn pod `y = -20`. Ověřeno také ve standalone runtime smoke testu. |
| Runtime safety | DONE | `RuntimeSafety` kontroluje NaN/Infinity pozici, pád pod mapu a vytváří neviditelný fallback collider. |
| Inventory UI | DONE | Nativní `Canvas`, 28 slotů, stacky, selection, drop a transfer. Vizuálně ještě chce doladit podle HTML reference. |
| Hotbar UI | DONE | 6 slotů dole uprostřed, výběr 1-6 a durability. |
| Compass | DONE | Horní střed, směr a stupně podle hráče. |
| Survival HUD | DONE | HP, food, water, stamina, temperature a stav. |
| Alerts | DONE | Bleeding, cold, wet a radiation pouze při problému. |
| Loot pickup | DONE | `E`, částečné vložení při plném inventáři, pooling a slučování dropů bez kompletního překreslení UI. |
| Dropped items | DONE | Fyzické dropy, object pool a cache materiálů. |
| Crafting | DONE | Recepty, ceny, queue, progress, cancel a overflow drop. |
| Furnace | DONE | 6 slotů, fuel, smelting, progress a on/off. |
| Workbench | DONE | Level 1-3 a kontrola tieru v dosahu. |
| Building system | DONE | Preview, snap, rotace, placement, upgrade, repair a demolish. |
| Storage boxes | DONE | 12 slotů, take all, deposit all a sort. |
| Save/load | DONE | JSON save pro svět, hráče, stats, inventory, stavby, dropy, prostředí a nastavení. |
| Dev console | DONE | Give/god/fly/save/load/report plus `weather`, `time`, `spawn`, `kill`, survival testy a bezpečný respawn. |
| Map/minimap | DONE | Nativní Canvas mapa, legenda a živá pozice hráče; waypoint chybí. |
| Pause menu | DONE | Resume, save/load, respawn, inventory, mapa, settings, new game a quit. |
| Weather/day-night | DONE | Clear/rain/storm/fog, denní cyklus, slunce, ambient, mlha a procedurální déšť. |
| Settings menu | DONE | `O` nebo pause menu: FOV, citlivost, HUD opacity, FPS limit, HUD prvky, SFX, ambience a mute. |
| Animal/enemy AI | DONE | Procedurální deer, boar, wolf a scientist s wander/flee/chase/attack chováním. |
| Projectile bow | DONE | Pooled fyzické šípy s gravitací, kolizí, damage a automatickým cleanupem. |
| Corpse loot | DONE | Časovaný corpse container, take-only inventory a odstranění po vyprázdnění/expiraci. |
| Death screen | DONE | Důvod smrti, respawn a vytvoření nového ostrova s náhodným seedem. |
| Loot tables | DONE | Samostatná databáze pro barel/crate/toolbox varianty a fyzické dropy. |
| Procedural audio | DONE | Web assety nejsou potřeba; pickup, combat, build, crafting, death a rain zvuky vznikají runtime. |
| Runtime verification | DONE | Batch compile, macOS standalone build a automatický runtime smoke test. |
| Codex continuation prompt | DONE | Přidán `docs/CODEX_NEXT_PROMPT.md` s navazujícím českým promptem. |

## Ovládání

| Klávesa | Akce |
|---|---|
| `WASD` | Pohyb |
| Myš | Rozhlížení |
| `Shift` | Sprint |
| `Space` | Skok |
| `LPM` | Těžba / útok / placement |
| `E` | Interakce / pickup / kontejner / pití |
| `Tab` | Inventář a crafting |
| `B` | Build menu |
| `M` | Mapa |
| `O` | Nastavení |
| `1-6` | Hotbar |
| `H` | Bandage |
| `G` | Jídlo |
| `R` | Otočit build preview |
| `U / T / X` | Upgrade / repair / demolish |
| `F10` nebo `` ` `` | Dev terminal |
| `ESC` | Zavřít panel / pauza |

## Důležité dev příkazy

| Příkaz | Funkce |
|---|---|
| `respawn` | Vrátí hráče na bezpečný spawn. |
| `tp spawn` | Teleportuje hráče na spawn přes ground snap. |
| `damage 20` | Ubírá HP pro test death/survival logiky. |
| `bleed 20` | Přidá bleeding pro test alertu. |
| `wet 50` | Přidá wetness pro test alertu. |
| `rad 20` | Přidá radiation pro test alertu. |
| `weather clear/rain/storm/fog` | Okamžitě změní počasí. |
| `time 0-24/day/night/noon/midnight` | Nastaví denní dobu. |
| `spawn deer/boar/wolf/scientist 3` | Vytvoří zvolený typ aktéra. |
| `kill animals/all/type` | Odstraní zvolenou populaci. |
| `report` | Vypíše stav světa, populace, počasí a aktivních šípů. |
