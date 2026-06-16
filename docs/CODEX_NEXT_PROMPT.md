# Další prompt pro Codex – audit, stabilita a přesný HTML clon

Tento soubor je hlavní prompt pro další běh Codexu. Nedávej Codexu obří text pokaždé znovu. Stačí mu říct, ať začne tady v `docs/`.

## Krátký prompt, který vlož do Codexu

```text
Přečti nejdřív docs/README.md, docs/NEXT_STEPS.md, docs/IMPLEMENTATION_STATUS.md, docs/HTML_PORT_MAPPING.md a docs/CODEX_NEXT_PROMPT.md. Řiď se tím jako hlavním zadáním. Nezačínej od nuly, nepoužívej WebView, pracuj v existujícím Unity projektu Farken's World. Nejdřív ověř Play Mode stabilitu, collider patch a problém s doskakováním/stavěním trávy při pohybu. Nepoužívej falešné DONE: co nebylo fyzicky otestované v Unity Play Mode, nech jako PARTIAL nebo BROKEN. Po každé změně aktualizuj docs podle reality z testu. Finální odpověď piš česky.
```

---

## Projekt

Jsi v Unity projektu **Farken's World / Rust-like survival prototype**.

Repozitář:
`https://github.com/rsvora-bit/RUST---clon`

Pracuj v existujícím projektu.

**Nesmíš:**

- začít od nuly,
- vytvořit nový Unity projekt,
- použít WebView,
- smazat existující `Assets/_FarkensWorld/`,
- dělat jen dokumentaci bez reálného testu/opravy,
- tvrdit `DONE`, pokud funkce nebyla fyzicky otestovaná v Play Mode.

Main scene musí zůstat:
`Assets/_FarkensWorld/Scenes/Main.unity`

Primární gameplay/reference je nahraný single-file HTML prototyp Farken's World Beta 1.5.x. HTML ber jako zdroj pravdy pro layout, UI, HUD, hotbar, inventory, crafting, building, survival, loot, map/minimap, compass a celkový Rust-like styl.

## Nejdřív přečti tyto soubory

1. `docs/README.md`
2. `docs/NEXT_STEPS.md`
3. `docs/IMPLEMENTATION_STATUS.md`
4. `docs/HTML_PORT_MAPPING.md`
5. Tento soubor `docs/CODEX_NEXT_PROMPT.md`

Dokumentace je pracovní zdroj pravdy, ale ne absolutní pravda. Pokud Play Mode ukáže, že něco nefunguje, oprav dokumentaci podle reality.

## Aktuální známý stav

Projekt už obsahuje hodně Unity systémů Beta 1.6, ale po dokumentačním auditu nejsou automaticky brané jako `DONE`. Většina je `PARTIAL`, protože musí projít fyzickým gameplay testem.

Známé věci:

- Po posledním collider fixu se hráč podle ručního testu už dokáže pohybovat.
- Původní levitace / pád pod mapu se zdá být zlepšený, ale musíš to znovu ověřit v Play Mode.
- Známý problém: při pohybu je vidět doskakování / stavění trávy nebo world detailů.
- UI existuje, ale musí se dál ladit, aby působilo víc jako HTML Rust-like verze, ne obecný Unity prototyp.
- Start menu a changelog podle HTML zatím nejsou hotové.

## Status pravidla

Používej přesně tyto statusy:

- `DONE` = existuje v kódu a prošlo Play Mode testem.
- `PARTIAL` = existuje v kódu, ale je to zjednodušené, neověřené nebo ne úplně podle HTML.
- `BROKEN` = je v kódu, ale při testu nefunguje správně.
- `TODO` = není hotové.

Pokud něco pouze existuje jako C# soubor, ale netestoval jsi to ve hře, nech `PARTIAL`.

## Priorita 0 – ověř stabilní základ

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
7. Neobjevuje se viditelné stavění / doskakování trávy při pohybu.
8. Console nemá red errors.

Pokud se cokoli z toho rozbije, nepřidávej nové features. Nejdřív oprav základ.

## Priorita 1 – opravit doskakování / stavění trávy

Tohle je aktuální ručně pozorovaný problém.

Zjisti přesně:

- který skript vytváří nebo refreshuje trávu / vegetaci / world detaily,
- jestli se něco negeneruje opakovaně podle pozice hráče,
- jestli se při pohybu nepřepočítává celý world nebo chunk,
- jestli nejde o špatný culling, LOD, enable/disable nebo spawn threshold,
- jestli některý UI/map refresh omylem nespouští world refresh.

Oprava:

- Nedělej brutální fix odstraněním veškeré trávy.
- Zachovej ostrov vizuálně živý.
- Tráva a detaily se nesmí viditelně stavět po každém kroku hráče.
- Použij stabilní spawn/detail cache, chunk hysterézi nebo prostě statické rozmístění, pokud je to pro tento prototyp lepší.
- Po opravě spusť 2minutový pohybový test.

## Priorita 2 – ověř collider patch

Zkontroluj `Assets/_FarkensWorld/Scripts/World/WorldGenerator.cs`.

Musí platit:

- `Beach Visual` a `Island Visual` nesmí být walkable `CylinderCollider`.
- Walkable povrch nesmí být problematický `CylinderCollider`.
- Chůzi má řešit stabilní rovný collider / jednoduchý collider.
- `Ground snap` musí trefovat hlavní walkable ground, ne špatný fallback.
- Road nesmí tvořit hranu, o kterou se CharacterController zasekne.
- Přechod pláž -> tráva musí být plynulý.

Pokud je hráč moc vysoko nad zemí nebo se zasekne u okraje, uprav:

- výšku walkable colliderů,
- `CharacterController` center/height/radius,
- ground clearance,
- spawn pozici,
- road výšku.

## Priorita 3 – pravdivá dokumentace

Po testu oprav:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/HTML_PORT_MAPPING.md`
- `docs/NEXT_STEPS.md`

Nepoužívej falešné `DONE`.

Speciálně ověř:

- ground/terrain collider,
- player spawn,
- runtime safety,
- grass/world detail popping,
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

## Priorita 4 – kompletní test Beta 1.6 mechanik

### Dev console

Otevři `F10` nebo backquote a otestuj:

```text
help
report
tp spawn
respawn
damage 20
damage 999
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

`report` má vypsat užitečné info:

- player position,
- isGrounded,
- ground collider name,
- world seed,
- weather,
- time,
- population counts,
- active arrows,
- active dropped items.

### Projectile bow

Ověř:

- bow jde dát do hotbaru,
- střelba odebere arrow,
- šíp letí fyzicky dopředu,
- má gravity/drop,
- po zásahu dá damage,
- po zásahu nebo timeoutu se vrátí do poolu / uklidí,
- netvoří stovky aktivních objektů.

### AI / zvířata / scientist

Ověř:

- deer/boar/wolf/scientist spawnují na zemi,
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

## Priorita 5 – UI podle HTML

Po stabilizačním testu porovnej Unity s HTML verzí.

Cíl: Unity verze má vypadat jako HTML Rust-like hra, ne jako obecný Unity prototyp.

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

Pokud UI nesedí vizuálně, uprav:

- barvy,
- opacity,
- spacing,
- font size,
- border,
- slot highlight,
- anchor pozice.

## Priorita 6 – nové věci až po stabilitě

Až když základ projde, můžeš přidat:

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
6. Tráva/world detaily se viditelně nestaví při každém pohybu.
7. UI je podobné HTML.
8. Inventory/hotbar fungují.
9. Loot pickup nemá freeze.
10. Weather/time funguje.
11. Settings fungují.
12. Bow funguje.
13. AI/corpse loot funguje.
14. Death/respawn funguje.
15. Save/load nerozbije nové systémy.
16. Dev console `report` funguje.
17. Console nemá red errors.
18. Dokumentace odpovídá realitě.

## Commit

Commituj jasnou zprávou podle toho, co opravíš, například:

`Fix grass popping and verify Beta 1.6 stability`

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
