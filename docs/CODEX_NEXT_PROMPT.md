# Další prompt pro Codex – audit a stabilizace Unity Beta 1.6

Použij tento prompt jako další úkol v Codexu. Projekt už obsahuje Unity Beta 1.6 survival systémy, ale je potřeba udělat důkladný audit, protože dokumentace může tvrdit DONE i u věcí, které je ještě nutné fyzicky ověřit v Play Mode.

---

Jsi v Unity projektu **Farken's World / Rust-like survival prototype**.

Repozitář:
`https://github.com/rsvora-bit/RUST---clon`

Pracuj v existujícím projektu. **Nezačínej od nuly. Nepoužívej WebView.**

Main scene musí zůstat:
`Assets/_FarkensWorld/Scenes/Main.unity`

Primární reference je nahraný single-file HTML prototyp hry Farken's World Beta 1.5.x. HTML ber jako zdroj pravdy pro layout, UI, HUD, hotbar, inventory, crafting, building, survival, loot, map/minimap, compass a celkový Rust-like styl.

## Aktuální stav podle repozitáře

Poslední velká změna přidala Unity Beta 1.6 systémy:

- settings menu přes `O`,
- weather/day-night systém,
- wildlife/enemy population,
- deer/boar/wolf/scientist,
- corpse loot,
- projectile bow se šípy,
- death screen,
- procedural audio,
- rozšířený dev console,
- loot table database,
- runtime smoke/build verification.

Po auditu byl ručně opraven `WorldGenerator.cs`, protože `main` pořád používal walkable `CylinderCollider` pro Beach/Island/Ground Safety Collider. Nově má být:

- Beach/Island pouze vizuální cylinder bez collideru,
- chůzi mají řešit ploché `BoxCollider` objekty:
  - `Walkable Island Collider`,
  - `Walkable Beach Collider`,
  - `Fallback Safety Collider`.

Tento collider patch je commitnutý, ale ještě musíš vše ověřit přímo v Unity Editoru.

## Priorita 0 – nejdřív ověř aktuální main

Než začneš něco přidávat, spusť:

```bash
git status
git log --oneline -5
git branch
```

Ověř, že pracuješ na `main` a že nemáš nepushnuté změny.

Potom otevři:
`Assets/_FarkensWorld/Scenes/Main.unity`

Spusť Play Mode a otestuj minimálně 2 minuty:

1. Spawn na zemi.
2. Žádné propadnutí pod mapu.
3. Žádné levitování.
4. WASD, myš, sprint, jump.
5. Přechod pláž -> tráva -> road -> loot.
6. Hráč se dostane do středu ostrova bez invisible walls.
7. Neobjevuje se viditelné stavění/poskakování trávy při pohybu.
8. Console nemá red errors.

Pokud se cokoli z toho rozbije, nepřidávej další mechaniky a oprav nejdřív základ.

## Priorita 1 – ověř collider patch

Zkontroluj `Assets/_FarkensWorld/Scripts/World/WorldGenerator.cs`.

Musí platit:

- `Beach Visual` a `Island Visual` nesmí mít collider.
- Walkable povrch nesmí být `CylinderCollider`.
- Chůzi musí řešit stabilní `BoxCollider` / jednoduchý rovný collider.
- `Ground snap` musí trefovat hlavní walkable ground, ne nouzový fallback.
- Road nesmí tvořit hranu, o kterou se CharacterController zasekne.
- Přechod pláž -> tráva musí být plynulý.

Pokud je hráč moc vysoko nad zemí nebo se zasekne u okraje, uprav:

- výšku walkable colliderů,
- `CharacterController` center/height/radius,
- `GroundClearance`,
- spawn pozici,
- road výšku.

## Priorita 2 – ověř pravdivost dokumentace

Zkontroluj a případně oprav:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/HTML_PORT_MAPPING.md`

Nepiš falešně DONE.

Použij:

- `DONE` = reálně existuje v kódu a prošlo Play Mode testem,
- `PARTIAL` = existuje v kódu, ale je to zjednodušené nebo ne plně otestované,
- `BROKEN` = je v kódu, ale při testu nefunguje,
- `TODO` = není hotové.

Speciálně ověř tyto položky:

- Ground/terrain collider,
- spawn,
- runtime safety,
- inventory/hotbar,
- loot pickup bez freeze,
- weather/day-night,
- settings menu,
- animal/enemy AI,
- projectile bow,
- corpse loot,
- death screen,
- save/load po nových systémech,
- dev console `report`,
- runtime verification.

Pokud něco jen existuje v C# souboru, ale není ověřené v gameplayi, dej `PARTIAL`, ne `DONE`.

## Priorita 3 – kompletní test nových Beta 1.6 mechanik

Otestuj postupně:

### Dev console

Otevři `F10` nebo backquote a otestuj:

```text
help
report
tp spawn
respawn
damage 20
bleed 20
wet 50
rad 20
weather rain
weather storm
weather clear
time night
time noon
spawn deer 2
spawn boar 2
spawn wolf 2
spawn scientist 1
kill animals
kill all
```

`report` musí vypsat užitečné info:

- player position,
- isGrounded,
- ground collider name,
- world seed,
- weather,
- time,
- population counts,
- active arrows,
- active dropped items,
- red error count pokud to umíš zjistit.

### Projectile bow

Ověř:

- bow se dá dát do hotbaru,
- střelba odebere arrow,
- šíp letí fyzicky dopředu,
- má gravity/drop,
- po zásahu dá damage,
- po zásahu nebo timeoutu se vrátí do poolu / uklidí,
- netvoří stovky aktivních objektů.

### AI / zvířata / scientist

Ověř:

- deer neutíká nebo se chová pasivně,
- boar/wolf/scientist mají rozumný chase/attack,
- nejdou přes zeď/propadnout mapou,
- po smrti vytvoří corpse/loot bag,
- corpse jde otevřít přes `E`,
- loot se dá vybrat,
- prázdný corpse zmizí.

### Death screen

Ověř:

- `damage 999` zabije hráče,
- zobrazí se death screen,
- ukáže důvod smrti,
- respawn tlačítko funguje,
- po respawnu jde znovu chodit,
- UI se neblokuje navždy.

### Settings

Ověř:

- `O` otevře settings,
- FOV se reálně mění,
- sensitivity se reálně mění,
- HUD opacity mění panely,
- minimap/compass/performance toggle fungují,
- audio mute funguje,
- settings se ukládají přes save/load, pokud to dokumentace tvrdí.

### Weather/day-night

Ověř:

- `weather rain/storm/fog/clear` mění vizuál,
- `time night/noon` mění světlo,
- HUD ukazuje čas a weather,
- rain audio/particles nezůstávají zapnuté po clear.

## Priorita 4 – UI přesnost podle HTML

Po stabilizačním testu porovnej Unity s HTML verzí.

Cíl: Unity verze má vypadat co nejvíc jako HTML verze, ne jako obecný Unity prototyp.

Zkontroluj:

- hotbar dole uprostřed,
- compass nahoře uprostřed,
- minimapa vpravo nahoře,
- survival panel vpravo dole,
- feed vlevo dole,
- center alerts,
- inventory grid 7x4,
- crafting panel,
- loot/container panel,
- furnace UI,
- workbench UI,
- pause menu,
- map screen,
- settings overlay.

Pokud UI nesedí vizuálně, uprav barvy, opacity, spacing, font size, border, slot highlight a anchor pozice.

## Priorita 5 – další malé zlepšení, až když je vše stabilní

Až po ověření stabilního základu můžeš přidat:

- hlavní start menu před spawnem,
- changelog screen,
- jednoduchý loading screen při generování světa,
- waypoint na mapě,
- lepší hit feedback u bow,
- lepší loot icons,
- lepší vizuál zvířat/scientista bez externích assetů.

## Acceptance test

Na konci musí platit:

1. Projekt se otevře bez compile errors.
2. `Main.unity` jde spustit přes Play.
3. Hráč se spawnne na zemi.
4. Hráč se dostane z pláže do středu ostrova.
5. Žádné levitování ani invisible walls.
6. UI je podobné HTML.
7. Inventory/hotbar fungují.
8. Loot pickup nemá freeze.
9. Weather/time funguje.
10. Settings fungují.
11. Bow funguje.
12. AI/corpse loot funguje.
13. Death/respawn funguje.
14. Save/load nerozbije nové systémy.
15. Dev console `report` funguje.
16. Console nemá red errors.
17. Dokumentace odpovídá realitě.

## Commit

Commituj jasnou zprávou podle toho, co opravíš, například:

`Stabilize Beta 1.6 gameplay systems`

## Finální odpověď napiš česky

Napiš mi:

- aktuální commit hash,
- jestli jsi pushnul na `main`,
- co přesně bylo rozbité,
- co jsi opravil,
- co je DONE,
- co je PARTIAL,
- co je BROKEN/TODO,
- jestli ground collider už není walkable CylinderCollider,
- jestli se dá dojít do středu ostrova,
- jestli tráva pořád viditelně doskakuje,
- jestli Console má red errors.