# Implementation status

| Feature | Status | Notes |
|---|---:|---|
| First person controller | DONE | WASD, mouse look, jump, sprint, fly debug. |
| Ground/terrain collider | DONE | Pevný ostrov plus neviditelný bezpečnostní collider. |
| Player spawn | DONE | Bezpečný spawn a automatický respawn pod `y = -20`. |
| Inventory UI | DONE | Nativní `Canvas`, 28 slotů, stacky, selection, drop a transfer. |
| Hotbar UI | DONE | 6 slotů dole uprostřed, výběr 1-6 a durability. |
| Compass | DONE | Horní střed, směr a stupně podle hráče. |
| Survival HUD | DONE | HP, food, water, stamina, temperature a stav. |
| Alerts | DONE | Bleeding, cold, wet a radiation pouze při problému. |
| Loot pickup | DONE | `E`, částečné vložení při plném inventáři. |
| Dropped items | DONE | Fyzické dropy, object pool a cache materiálů. |
| Crafting | DONE | Recepty, ceny, queue, progress, cancel a overflow drop. |
| Furnace | DONE | 6 slotů, fuel, smelting, progress a on/off. |
| Workbench | DONE | Level 1-3 a kontrola tieru v dosahu. |
| Building system | DONE | Preview, snap, rotace, placement, upgrade, repair a demolish. |
| Storage boxes | DONE | 12 slotů, take all, deposit all a sort. |
| Save/load | DONE | JSON save pro svět, hráče, stats, inventory, stavby a dropy. |
| Dev console | PARTIAL | Základní admin příkazy fungují; weather/time/spawn/kill chybí. |
| Map/minimap | DONE | Nativní Canvas mapa, legenda a živá pozice hráče; waypoint chybí. |
| Pause menu | DONE | Resume, save/load, respawn, inventory, mapa, new game, quit. |
| Weather/day-night | PARTIAL | HUD hodiny fungují, plná simulace HTML chybí. |
| Settings menu | TODO | FOV, HUD, audio a detail nastavení nejsou portovaná. |
| Animal/enemy AI | TODO | Není v aktuálním Unity základu. |
| Projectile bow | TODO | Combat zatím používá melee raycast. |
| Death screen | TODO | Samostatný death flow není implementovaný. |

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

