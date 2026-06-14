# Další prompt pro Codex – pokračování Unity portu Farken's World

Použij tento prompt v Codexu jako další úkol. Repozitář už obsahuje Unity projekt a několik bezpečnostních oprav po předchozí kontrole.

---

Jsi v Unity projektu **Farken's World / Rust-like survival prototype**.

Repozitář:
`https://github.com/rsvora-bit/RUST---clon`

Pracuj v existujícím projektu. **Nesmíš začít od nuly.**

Main scene musí zůstat:
`Assets/_FarkensWorld/Scenes/Main.unity`

Primární reference je nahraný single-file HTML prototyp hry Farken's World Beta 1.5.x. HTML ber jako zdroj pravdy pro layout, mechaniky, HUD, hotbar, inventář, survival panel, mapu, loot, crafting, stavění, furnace, workbench, dev terminál a celkový Rust-like styl.

## Co už bylo doplněno před tímto promptem

V tomto repozitáři už byly přidány tyto bezpečnostní a debug změny:

1. `Assets/_FarkensWorld/Scripts/Player/FirstPersonController.cs`
   - `Teleport()` už nedává hráče slepě na fixní Y pozici.
   - Při teleportu/spawnu se raycastem hledá zem pod hráčem a hráč se snapne těsně nad collider.
   - Cíl: omezit problém, kdy hráč po startu levituje nebo spadne pod mapu.

2. `Assets/_FarkensWorld/Scripts/Core/RuntimeSafety.cs`
   - Přidán runtime safety systém.
   - Vytváří neviditelnou fallback collision floor.
   - Kontroluje NaN/Infinity pozici hráče.
   - Pokud hráč spadne pod `y = -20`, zavolá respawn.

3. `Assets/_FarkensWorld/Scripts/Core/GameManager.cs`
   - Registrován `RuntimeSafety` komponent jako součást runtime systémů.

4. `Assets/_FarkensWorld/Scripts/Player/PlayerStats.cs`
   - Přidány debug metody:
     - `Damage(float amount)`
     - `AddBleeding(float amount)`
     - `AddWetness(float amount)`
     - `AddRadiation(float amount)`

5. `Assets/_FarkensWorld/Scripts/UI/DevConsoleUI.cs`
   - Dev terminál umí navíc:
     - `respawn`
     - `tp spawn`
     - `damage 20`
     - `bleed 20`
     - `wet 50`
     - `rad 20`
   - Help text byl aktualizovaný.

## Nejdřív ověř build a spawn

Než začneš přidávat nové věci, udělej toto:

1. Otevři Unity projekt.
2. Otevři scénu:
   `Assets/_FarkensWorld/Scenes/Main.unity`
3. Dej Play.
4. Zkontroluj Console.
5. Oprav všechny červené compile/runtime errors.
6. Ověř, že:
   - hráč se spawnne na pevném povrchu,
   - nepropadne mapou,
   - nelítá nesmyslně nad mapou,
   - WASD, myš, sprint a jump fungují,
   - `F10` otevře dev terminal,
   - příkaz `tp spawn` hráče bezpečně vrátí na spawn,
   - příkaz `respawn` funguje,
   - příkaz `damage 20` ubere HP,
   - příkaz `bleed 20` zapne bleeding alert.

Pokud hráč pořád padá pod mapu, nepiš nové features. Nejdřív oprav:
- collider terrainu,
- vrstvy/layers,
- CharacterController center/height/radius,
- spawn pozici,
- raycast ground snap,
- fallback floor.

## Zásadní pravidla

- Nezačínej nový projekt.
- Nepoužívej WebView.
- Nemaž existující strukturu bez důvodu.
- Nepiš jen dokumentaci; musíš implementovat reálné změny v C# / Unity UI.
- Vše udržuj v `Assets/_FarkensWorld/`.
- UI musí vypadat jako HTML verze, ne jako generický Unity placeholder.
- Každý větší krok zapisuj do `docs/IMPLEMENTATION_STATUS.md` a `docs/HTML_PORT_MAPPING.md`.
- Commituj s jasnými zprávami.

## Priorita 1 – udělej Unity UI co nejvíc jako HTML verzi

Cíl: Unity verze musí na první pohled připomínat HTML Rust-like hru.

Zkontroluj HTML a přenes přesně:

- hotbar dole uprostřed,
- 6 slotů hotbaru,
- zvýrazněný vybraný slot,
- item count a durability,
- survival panel vpravo dole,
- HP / food / water / stamina,
- bleeding/cold/wet/radiation alerty jen při problému,
- kompas nahoře uprostřed nebo přesně podle HTML,
- minimapa vpravo nahoře,
- feed zprávy vlevo dole,
- center message uprostřed dole,
- interaction prompt pod crosshairem,
- inventář jako tmavý Rust-like grid, ne obyčejný seznam,
- crafting panel vedle inventáře,
- container panel při otevření storage/furnace/corpse,
- pause menu přes ESC,
- map screen přes M,
- settings screen pokud už existuje nebo ho doplnit.

Použij Unity Canvas UI s anchored RectTransformy. UI musí fungovat na 1920x1080 i na jiných rozlišeních.

## Priorita 2 – oprav nebo vylepši inventář

Inventář musí být reálný slotový systém podle HTML:

- 28 slotů hráče,
- prvních 6 slotů jako hotbar,
- stack limity podle itemů,
- prázdný slot je skutečně prázdný,
- item tile ukazuje ikonu, název, počet, durability/progress,
- klik/shift klik přesouvá itemy mezi hráčem a kontejnerem,
- drop 1 / drop stack,
- při pickup/dropu se nesmí lagovat hra.

Optimalizuj pickup:
- nepřekreslovat celý UI canvas při každém sebrání, pokud stačí aktualizovat změněný slot,
- cache item definice,
- object pool pro dropped item vizuály,
- nepoužívat zbytečné Instantiate/Destroy ve smyčce.

## Priorita 3 – porovnej feature-by-feature s HTML

Vytvoř přesný audit podle HTML:

- HTML Feature
- Unity Script / Scene Object
- Status: DONE / PARTIAL / BROKEN / TODO
- Notes

Doplň do:
`docs/HTML_PORT_MAPPING.md`

Nesmí tam být falešné DONE, pokud je to jen placeholder. Radši napiš PARTIAL.

## Priorita 4 – chybějící mechaniky

Podle aktuálního stavu projektu dodělej hlavně:

### Projectile bow
- luk nesmí být jen raycast melee,
- po kliknutí vytvoř šíp jako GameObject,
- odeber 1 arrow,
- šíp letí z kamery dopředu,
- má gravity/drop,
- kontroluje zásah do resource/enemy/animal/interactable,
- po zásahu dá damage,
- po čase se smaže nebo vrátí do poolu.

### Animal/enemy AI + corpse loot
- přidej jednoduchá zvířata: deer, boar, wolf,
- přidej jednoduchého road scientist enemy,
- po smrti nevkládat loot rovnou do inventáře,
- vytvořit corpse/loot bag na zemi,
- corpse otevřít přes E,
- corpse má sloty,
- po vybrání nebo po čase zmizí.

### Weather / day-night
- přenes z HTML den/noc, déšť, fog/storm alespoň zjednodušeně,
- HUD musí ukazovat čas a weather stav,
- déšť a tma mají vizuální overlay nebo změnu light/fog.

### Death overlay
- když HP klesne na 0, zobraz death screen,
- důvod smrti: thirst, hunger, radiation, cold, bleeding, generic,
- tlačítko Respawn,
- návrat do menu/pause flow.

### Settings screen
- FOV,
- mouse sensitivity,
- HUD opacity,
- FPS/performance HUD toggle,
- compass/minimap/hint toggle,
- SFX volume,
- ambience volume,
- mute all.

## Priorita 5 – vizuální zlepšení světa

Zachovej procedurální jednoduchý svět, ale přibliž ho HTML ostrovu:

- ostrov,
- pláž,
- voda,
- silnice,
- road loot,
- monument,
- stromy,
- kameny,
- metal/sulfur ore,
- barrel/crate vizuály,
- tmavší survival atmosféra,
- lepší materiály bez externích assetů.

Nepotřebujeme AAA grafiku. Důležité je, aby to vypadalo podobně jako HTML prototyp a působilo jako Rust-like survival.

## Acceptance test po úpravě

Po dokončení musí platit:

1. Projekt se otevře v Unity bez compile errors.
2. `Assets/_FarkensWorld/Scenes/Main.unity` jde spustit přes Play.
3. Hráč se spawnne na pevném povrchu.
4. Hráč nespadne pod mapu.
5. UI je vizuálně podobné HTML verzi.
6. Hotbar je dole uprostřed a funguje 1–6.
7. Inventory vypadá jako Rust-like grid, ne placeholder.
8. Survival panel ukazuje staty.
9. Alerty se zobrazují jen při problému.
10. Loot pickup funguje bez freeze/lagnutí.
11. Storage/furnace/crafting se dají otevřít a používat.
12. Save/load funguje.
13. Dev terminal F10 funguje a má nové příkazy.
14. Dokumentace v `docs/` odpovídá realitě.

## Finální zpráva pro mě

Na konci mi napiš česky:

- co přesně jsi změnil,
- které soubory jsi upravil,
- co je DONE,
- co je PARTIAL,
- co je TODO,
- jestli je spawn bug opravený,
- jestli jsou v Console ještě red errors.
