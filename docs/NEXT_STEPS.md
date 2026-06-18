# Next steps checklist

Tento soubor je konkrétní seznam práce pro další vývoj. Codex má postupovat shora dolů a po dokončení aktualizovat status v dokumentaci podle reality z Play Mode testu.

## Aktuální známý stav

- Aktuální běh Codexu prošel `git status`, `git log --oneline -5` a ověřil větev `main`.
- Unity 6000.4.11f1 batch build prošel a postavený runtime player smoke test prošel bez gameplay failure.
- Runtime smoke ověřil spawn, walkable `BoxCollider`, cestu spawn -> tráva/road -> střed ostrova, weather, bleeding, death/respawn a AI spawn.
- Původní problém s levitací / pádem pod mapu se v automatizovaném runtime smoke testu neprojevil, ale ruční 2minutový Editor Play Mode test je pořád potřeba.
- Kandidátní fix pro doskakování trávy je v kódu: tráva je statický seedovaný mesh (`GrassDetailCount=520`) a road visual už nemá collider/lip. Vizuálně to ještě musí ověřit ruční Play Mode test.
- Hodně systémů v kódu existuje, ale není férové je označit jako `DONE`, dokud neprojdou Play Mode testem.

## 0) Povinný start před každou prací

- [ ] Spustit `git status`.
- [ ] Spustit `git log --oneline -5`.
- [ ] Ověřit, že se pracuje na `main`.
- [ ] Otevřít `Assets/_FarkensWorld/Scenes/Main.unity`.
- [ ] Spustit Play Mode.
- [ ] Zapsat do finální odpovědi, jestli jsou v Console red errors.
- [ ] Pokud je Console červená, nejdřív opravit errors, až potom dělat gameplay změny.

## 1) Stabilita hráče a mapy

- [x] Automatizovaný runtime smoke: hráč se spawnne na zemi.
- [x] Automatizovaný runtime smoke: hráč neleviduje ani nepadá pod mapu během kontrolované cesty.
- [x] Automatizovaný runtime smoke: hráč se dostane ze spawnu přes trávu/road do středu ostrova.
- [ ] Ruční Editor Play Mode: hráč se spawnne na zemi.
- [ ] Ruční Editor Play Mode: hráč neleviduje.
- [ ] Ruční Editor Play Mode: hráč nepadá pod mapu.
- [ ] Ruční Editor Play Mode: hráč se dostane z pláže na trávu.
- [ ] Ruční Editor Play Mode: hráč se dostane do středu ostrova.
- [ ] Hráč se nezasekne na road / loot / hraně beach-island.
- [x] Automatizovaný runtime smoke: walkable povrch je `BoxCollider`, ne visual/cylinder collider.
- [ ] Ověřit `tp spawn`.
- [ ] Ověřit `respawn`.
- [ ] Ověřit, že ground snap netrefuje špatný fallback collider.

## 2) Opravit doskakování / stavění trávy při pohybu

Toto je aktuální vizuální problém po posledním testu.

- [x] Najít, který systém vytváří / přesouvá / obnovuje trávu nebo world detaily: vegetace a detaily jsou v `WorldGenerator.cs`, ne v UI/minimap refreshi.
- [x] Ověřit v kódu, že se nic negeneruje opakovaně podle pozice hráče.
- [x] Zajistit, aby se tráva negenerovala znovu každý frame podle pohybu hráče: přidaný statický seedovaný grass detail mesh.
- [ ] Pokud je nutná optimalizace, použít stabilní chunk/grid systém s hysterézí, ne rebuild celé vrstvy okolo hráče při každém kroku.
- [ ] Neopravovat to smazáním veškeré vegetace; cílem je stabilní vizuál, ne prázdná mapa.
- [ ] Po opravě otestovat 2 minuty pohybu po ostrově.

## 3) Runtime/Console audit

- [ ] `help` funguje.
- [ ] `report` funguje a vypíše useful debug info.
- [ ] `damage 20` funguje.
- [ ] `damage 999` zabije hráče a otevře death screen.
- [ ] `bleed 20`, `wet 50`, `rad 20` zobrazí alert.
- [ ] `weather rain/storm/fog/clear` funguje.
- [ ] `time night/noon` mění světlo.
- [ ] `spawn deer/boar/wolf/scientist` funguje.
- [ ] `kill animals/all/type` funguje.

## 4) Beta 1.6 gameplay systémy

### Bow / arrows

- [ ] Bow jde použít z hotbaru.
- [ ] Střelba odebere arrow.
- [ ] Šíp letí fyzicky dopředu.
- [ ] Šíp má gravity/drop.
- [ ] Šíp dává damage.
- [ ] Šíp se uklidí přes pool/timeout.

### AI / corpse loot

- [ ] Deer/boar/wolf/scientist se spawnují správně na zemi.
- [ ] Nepropadají se.
- [ ] Nejsou zaseknutí v colliderech.
- [ ] Po smrti vytvoří corpse/loot bag.
- [ ] Corpse jde otevřít přes `E`.
- [ ] Loot jde vzít.
- [ ] Prázdný corpse zmizí.

### Death/respawn

- [ ] HP 0 otevře death overlay.
- [ ] Death overlay ukazuje důvod smrti.
- [ ] Respawn tlačítko funguje.
- [ ] Po respawnu jde znovu chodit.
- [ ] UI/input nezůstane blokovaný.

### Settings

- [ ] `O` otevře settings.
- [ ] FOV funguje.
- [ ] Mouse sensitivity funguje.
- [ ] HUD opacity funguje.
- [ ] Compass/minimap/performance toggle funguje.
- [ ] Audio mute/volume funguje.

## 5) UI podle HTML

- [ ] Hotbar dole uprostřed, 6 slotů.
- [ ] Vybraný slot je jasně zvýrazněný.
- [ ] Compass nahoře uprostřed.
- [ ] Minimap vpravo nahoře.
- [ ] Survival panel vpravo dole.
- [ ] Feed vlevo dole.
- [ ] Interaction prompt pod crosshairem.
- [ ] Inventory 7x4 slotový grid.
- [ ] Crafting panel vedle inventáře.
- [ ] Container/furnace/corpse panel se otevírá správně.
- [ ] Pause menu přes ESC.
- [ ] Map screen přes M.
- [ ] Vizuál panelů, opacity, okraje a velikosti slotů porovnat s HTML Beta 1.5.x.

## 6) Save/load

- [ ] Save uloží pozici hráče.
- [ ] Save uloží inventory/hotbar.
- [ ] Save uloží building pieces.
- [ ] Save uloží dropy/kontejnery/furnace.
- [ ] Save uloží weather/time/settings, pokud to dokumentace tvrdí.
- [ ] Load nevyvolá red errors.
- [ ] Po loadu jde pokračovat v gameplayi.

## 7) Dokumentace po každém běhu

- [ ] Aktualizovat `docs/IMPLEMENTATION_STATUS.md`.
- [ ] Aktualizovat `docs/HTML_PORT_MAPPING.md`.
- [ ] Pokud se změní další priority, aktualizovat `docs/NEXT_STEPS.md`.
- [ ] Pokud je potřeba nové zadání, aktualizovat `docs/CODEX_NEXT_PROMPT.md`.
- [ ] Nepřepisovat `PARTIAL` na `DONE`, pokud to nebylo fyzicky otestované v Play Mode.

## Nejbližší doporučený úkol

Nejbližší úkol pro Codex:

1. Vzít tento checklist.
2. Ručně otevřít `Main.unity` v Editoru a udělat 2minutový Play Mode test pohybu, ovládání a vizuálního poppingu.
3. Pokud statický grass detail mesh pořád viditelně doskakuje, doladit materiál/mesh/bounds nebo další world detail culling.
4. Pokud je základ stabilní, otestovat Beta 1.6 systémy.
5. V dokumentaci přepsat statusy podle reality, ne podle toho, že existuje C# soubor.
6. Teprve potom ladit UI a vizuál podle HTML.
