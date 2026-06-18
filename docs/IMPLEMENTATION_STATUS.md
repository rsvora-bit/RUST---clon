# Implementation status

Tento soubor má popisovat realitu, ne optimistický plán. Status `DONE` používej jen tehdy, když je věc opravdu v kódu a zároveň prošla Play Mode testem v Unity Editoru.

Poslední známý stav podle aktuálního běhu Codexu: Unity 6000.4.11f1 projekt prošel batch buildem a postavený runtime player prošel smoke testem přes `Assets/_FarkensWorld/Scenes/Main.unity`. Smoke test ověřil spawn, walkable `BoxCollider`, cestu spawn -> tráva/road -> střed ostrova, weather, death/respawn a AI spawn bez gameplay erroru. Ruční 2minutový vizuální Play Mode test v Editoru ale ještě neproběhl, takže většina systémů zůstává `PARTIAL`, dokud se fyzicky neověří ovládání, UI a viditelné doskakování trávy.

| Feature | Status | Notes |
|---|---:|---|
| Main scene | PARTIAL | Hlavní scéna zůstává `Assets/_FarkensWorld/Scenes/Main.unity`. Batch build a runtime smoke player prošly, ruční Editor Play Mode test ještě zopakovat. |
| First person controller | PARTIAL | Runtime smoke automaticky prošel cestu spawn -> tráva/road -> střed ostrova bez pádu pod mapu. WASD, myš, sprint a jump ještě ručně ověřit v Editor Play Mode. |
| Ground/terrain collider | PARTIAL | Walkable povrch je řešený `BoxCollider` objekty (`Walkable Island/Beach/Fallback`). `Beach Visual`, `Island Visual` a `Road` nejsou walkable collidery. Runtime smoke trefil `Walkable Island Collider (BoxCollider)` a prošel cestu do středu ostrova; ruční test hran a invisible walls ještě zopakovat. |
| Player spawn | PARTIAL | Runtime smoke potvrdil spawn na `(-6.00, 0.13, -10.00)` nad `Walkable Island Collider`. Opakovaný ruční spawn/respawn a pád pod `y = -20` ještě ověřit v Editoru. |
| Runtime safety | PARTIAL | Existuje ochrana proti pádu pod mapu / špatné pozici, ale musí projít testem `tp spawn`, `respawn`, pád pod mapu a nový seed. |
| World visuals | PARTIAL | Ostrov, pláž, oceán, road, stromy, kameny, loot objekty a statický grass detail mesh existují. Vizuální shodu a popping je potřeba ještě zkontrolovat očima v Editor Play Mode. |
| Grass / world detail popping | PARTIAL | Přidaný kandidátní fix: tráva se generuje jednou jako statický mesh podle seedu (`GrassDetailCount=520`) a road visual už nemá fyzický collider/lip. Runtime smoke prošel, ale viditelné doskakování musí ještě potvrdit ruční 2minutový Play Mode test. |
| Inventory UI | PARTIAL | Existuje nativní Canvas inventář se sloty, ale musí se ověřit chování, přesun itemů, stacky, drop a vizuální shoda s HTML. |
| Hotbar UI | PARTIAL | Hotbar existuje dole uprostřed. Ověřit výběr 1-6, durability, použití itemů a přesnou podobu podle HTML. |
| Compass | PARTIAL | Kompas je viditelný nahoře uprostřed. Ověřit přesnost yaw/stupňů, responsivitu a shodu s HTML. |
| Survival HUD | PARTIAL | HP, food, water, stamina/temperature/status panel existuje. Ověřit drain, damage over time a viditelnost v různých rozlišeních. |
| Alerts | PARTIAL | Bleeding/cold/wet/radiation alerty jsou v kódu, ale musí se otestovat přes dev příkazy `bleed`, `wet`, `rad`. |
| Loot pickup | PARTIAL | Pickup přes `E` a pooling jsou implementované. Ověřit bez freeze, včetně plného inventáře a více dropů vedle sebe. |
| Dropped items | PARTIAL | Fyzické dropy a pooling existují. Ověřit slučování, pickup, drop stacku a cleanup. |
| Crafting | PARTIAL | Recepty a queue existují. Ověřit craft time, missing resources, cancel, overflow a shodu s HTML seznamem. |
| Furnace | PARTIAL | Furnace UI/smelting/fuel existují. Ověřit input/fuel/output sloty, progress, on/off a save/load stavu. |
| Workbench | PARTIAL | Workbench levely existují. Ověřit detekci vzdálenosti a blokaci receptů podle tieru. |
| Building system | PARTIAL | Preview, placement, upgrade/repair/demolish existují. Ověřit valid/invalid placement, rotaci, náklady, kolize a save/load. |
| Storage boxes | PARTIAL | Storage box UI existuje. Ověřit otevření přes `E`, přesun itemů, take all, deposit all a save/load. |
| Save/load | PARTIAL | JSON save/load existuje. Nutné ověřit, že po nových systémech nerozbije pozici, inventory, buildy, dropy, počasí, AI a settings. |
| Dev console | PARTIAL | Dev console existuje a `report` byl rozšířen o player position, grounded, ground collider, seed, weather/time, population counts, arrows, drops a grass details. Ovládání přes `F10`/backquote a celý příkazový checklist ještě ručně ověřit. |
| Map/minimap | PARTIAL | Minimap a velká mapa existují. Ověřit pozici hráče, orientaci, legendu a otevření přes `M`. Waypoint zatím chybí. |
| Pause menu | PARTIAL | ESC menu existuje. Ověřit resume, save/load, respawn, settings, mapu, quit a blokaci inputu. |
| Weather/day-night | PARTIAL | Systém clear/rain/storm/fog a den/noc existuje. Ověřit vizuál, particles, audio, HUD a návrat do clear. |
| Settings menu | PARTIAL | `O`/pause settings existují. Ověřit FOV, sensitivity, HUD opacity, toggly, audio a ukládání. |
| Animal/enemy AI | PARTIAL | Deer/boar/wolf/scientist existují v kódu. Ověřit spawn na zemi, chování, kolize, damage a balance. |
| Projectile bow | PARTIAL | Fyzické šípy s poolingem existují. Ověřit hotbar, spotřebu arrows, trajektorii, hit damage a cleanup. |
| Corpse loot | PARTIAL | Corpse container existuje. Ověřit vznik po smrti AI/hráče, otevření, vybrání lootů a expiraci. |
| Death screen | PARTIAL | Death/respawn overlay existuje. Ověřit přes `damage 999`, důvod smrti, respawn a obnovení inputu. |
| Loot tables | PARTIAL | Loot table database existuje. Ověřit drop šance/množství a porovnání s HTML referencí. |
| Procedural audio | PARTIAL | Runtime SFX/ambience existuje. Ověřit hlasitost, mute, rain audio a absence loop bugů. |
| Runtime verification | PARTIAL | Aktuální běh prošel Unity batch buildem a runtime smoke playerem. Smoke test ověřuje collider patch, cestu do středu ostrova, weather, bleeding, death/respawn a AI spawn. Ruční 2minutový Editor Play Mode audit je stále potřeba pro ovládání, UI a vizuální popping. |
| Start menu / changelog | TODO | Unity verze pořád startuje přímo do hry. Start menu a changelog podle HTML zatím nejsou hotové. |
| Codex continuation prompt | DONE | `docs/CODEX_NEXT_PROMPT.md` existuje a říká Codexu, ať nejdřív čte docs a testuje realitu. |

## Ovládání, které má Codex ověřit

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

## Důležité dev příkazy k ověření

| Příkaz | Funkce |
|---|---|
| `help` | Vypíše dostupné příkazy. |
| `report` | Vypíše stav hráče, ground collider, seed, počasí, populaci, dropy a další debug info. |
| `respawn` | Vrátí hráče na bezpečný spawn. |
| `tp spawn` | Teleportuje hráče na spawn přes ground snap. |
| `damage 20` | Ubírá HP pro test survival logiky. |
| `damage 999` | Má zabít hráče a otevřít death overlay. |
| `bleed 20` | Přidá bleeding pro test alertu. |
| `wet 50` | Přidá wetness pro test alertu. |
| `rad 20` | Přidá radiation pro test alertu. |
| `weather clear/rain/storm/fog` | Okamžitě změní počasí. |
| `time 0-24/day/night/noon/midnight` | Nastaví denní dobu. |
| `spawn deer/boar/wolf/scientist 3` | Vytvoří zvolený typ aktéra. |
| `kill animals/all/type` | Odstraní zvolenou populaci. |

## Nejbližší ruční ověření

1. Otevřít `Assets/_FarkensWorld/Scenes/Main.unity`.
2. Spustit Play Mode aspoň 2 minuty.
3. Ověřit chůzi z pláže na trávu, do středu ostrova, po road a k lootům.
4. Zapsat, jestli hráč levituje, propadá se nebo narazí na invisible wall.
5. Ručně ověřit, jestli statický grass detail mesh odstranil viditelné doskakování / stavění trávy při pohybu.
6. Spustit dev console `report`.
7. Otestovat `tp spawn`, `respawn`, `weather storm`, `time night`, `spawn wolf 2`, luk/šípy, corpse loot, death/respawn.
8. Zkontrolovat Console red errors.
9. Teprve po tom měnit `PARTIAL` na `DONE`.
