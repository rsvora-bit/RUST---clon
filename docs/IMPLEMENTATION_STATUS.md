# Implementation status

| Feature | Status | Notes |
|---|---:|---|
| First person controller | DONE | WASD, mouse look, jump, sprint, fly debug. Teleport nyní snapuje hráče na collider pod spawnem. |
| Ground/terrain collider | DONE | Pevný ostrov plus neviditelný bezpečnostní collider; nově také runtime fallback floor přes `RuntimeSafety`. |
| Player spawn | DONE | Bezpečný spawn, ground snap při teleportu a automatický respawn pod `y = -20`. Nutné ještě ověřit přímo v Unity Editoru. |
| Runtime safety | DONE | `RuntimeSafety` kontroluje NaN/Infinity pozici, pád pod mapu a vytváří neviditelný fallback collider. |
| Inventory UI | DONE | Nativní `Canvas`, 28 slotů, stacky, selection, drop a transfer. Vizuálně ještě chce doladit podle HTML reference. |
| Hotbar UI | DONE | 6 slotů dole uprostřed, výběr 1-6 a durability. |
| Compass | DONE | Horní střed, směr a stupně podle hráče. |
| Survival HUD | DONE | HP, food, water, stamina, temperature a stav. |
| Alerts | DONE | Bleeding, cold, wet a radiation pouze při problému. |
| Loot pickup | DONE | `E`, částečné vložení při plném inventáři. Ještě otestovat freeze/lag při pickup ve scéně. |
| Dropped items | DONE | Fyzické dropy, object pool a cache materiálů. |
| Crafting | DONE | Recepty, ceny, queue, progress, cancel a overflow drop. |
| Furnace | DONE | 6 slotů, fuel, smelting, progress a on/off. |
| Workbench | DONE | Level 1-3 a kontrola tieru v dosahu. |
| Building system | DONE | Preview, snap, rotace, placement, upgrade, repair a demolish. |
| Storage boxes | DONE | 12 slotů, take all, deposit all a sort. |
| Save/load | DONE | JSON save pro svět, hráče, stats, inventory, stavby a dropy. |
| Dev console | PARTIAL | Rozšířeno o `respawn`, `tp spawn`, `damage`, `bleed`, `wet`, `rad`; weather/time/spawn/kill příkazy z HTML ještě chybí. |
| Map/minimap | DONE | Nativní Canvas mapa, legenda a živá pozice hráče; waypoint chybí. |
| Pause menu | DONE | Resume, save/load, respawn, inventory, mapa, new game, quit. |
| Weather/day-night | PARTIAL | HUD hodiny fungují, plná simulace HTML chybí. |
| Settings menu | TODO | FOV, HUD, audio a detail nastavení nejsou portovaná. |
| Animal/enemy AI | TODO | Není v aktuálním Unity základu. |
| Projectile bow | TODO | Combat zatím používá melee raycast. |
| Death screen | TODO | Samostatný death flow není implementovaný. |
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
| `1-6` | Hotbar |
| `H` | Bandage |
| `G` | Jídlo |
| `R` | Otočit build preview |
| `U / T / X` | Upgrade / repair / demolish |
| `F10` nebo `` ` `` | Dev terminal |
| `ESC` | Zavřít panel / pauza |

## Nové dev příkazy po safety patchi

| Příkaz | Funkce |
|---|---|
| `respawn` | Vrátí hráče na bezpečný spawn. |
| `tp spawn` | Teleportuje hráče na spawn přes ground snap. |
| `damage 20` | Ubírá HP pro test death/survival logiky. |
| `bleed 20` | Přidá bleeding pro test alertu. |
| `wet 50` | Přidá wetness pro test alertu. |
| `rad 20` | Přidá radiation pro test alertu. |
