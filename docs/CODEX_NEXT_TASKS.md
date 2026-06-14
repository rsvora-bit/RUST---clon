# Další úkoly pro Codex – Unity port Farken's World

## Základní instrukce

Odpovídej česky. Kód piš normálně v C# s anglickými názvy tříd/metod, ale vysvětlení, shrnutí a report piš česky.

Nezačínej projekt úplně od nuly, pokud už v repozitáři existuje Unity projekt. Navazuj na existující soubory. Pokud Unity projekt ještě není vytvořený, vytvoř běžnou Unity strukturu a používej složky z `docs/PROJECT_STRUCTURE.md`.

## Cíl dalšího velkého kroku

Přenést vizuální styl a mechaniky z HTML verze do Unity tak, aby se hra chovala jako kopie původního HTML Rust-like prototypu, ale byla napsaná čistě v Unity/C#.

## Priorita 1 – funkční základ

1. Vytvoř/ověř Unity projektovou strukturu.
2. Vytvoř hlavní scénu `Assets/_Project/Scenes/Main.unity`.
3. Vytvoř First Person Player:
   - kamera z pohledu první osoby,
   - WASD pohyb,
   - skok,
   - sprint,
   - jednoduchá gravitace,
   - ochrana proti propadnutí mapou.
4. Vytvoř základní terrain/ostrov:
   - voda kolem,
   - jednoduchý procedurální terén,
   - spawn point nad zemí,
   - fallback respawn, když hráč spadne pod mapu.

## Priorita 2 – UI kopie HTML verze

Replikuj layout z HTML verze:

- kompas nahoře uprostřed,
- FPS/debug panel vlevo nahoře,
- weather/time panel vlevo nahoře pod FPS,
- minimapa vpravo nahoře,
- target panel uprostřed pod crosshairem,
- feed vlevo dole,
- hotbar dole uprostřed,
- survival panel vpravo dole,
- inventory overlay jako Rust-like tmavý panel.

UI má být tmavé, hranaté, survival/Rust-like, se žlutým accentem a modrými prvky.

## Priorita 3 – systémy

Implementuj po modulech:

- `Inventory/` – slot inventory, stack limits, hotbar.
- `Crafting/` – recipes, crafting queue, workbench levels.
- `Building/` – foundation/wall/doorframe/roof, snap, ghost preview, upgrade/repair/demolish.
- `World/` – resources, barrels, crates, dropped items.
- `Combat/` – melee, bow projectile, animals/enemies later.
- `SaveSystem/` – save/load JSON.
- `DevTools/` – dev console commands.

## Zakázané věci

- Nepoužívej HTML WebView.
- Nedělej jen prázdné ukázkové skripty bez propojení.
- Nedávej všechny skripty do jedné složky.
- Nepřepisuj README tak, aby zmizely informace o HTML původu.
- Nenechávej hráče spawnovat pod mapou.

## Kontrola před commitem

- Hra se spustí v Unity bez compile errorů.
- Hráč se nespawne pod mapou.
- Kamera funguje.
- WASD/Mouse/Jump funguje.
- UI prvky jsou na podobných místech jako v HTML verzi.
- Složky a skripty jsou uklizené podle `docs/PROJECT_STRUCTURE.md`.
