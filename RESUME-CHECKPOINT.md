# AKTUÁLNÍ CHECKPOINT — 2026-09-30

Tento oddíl je aktuální; níže ponechaný checkpoint z 2026-09-13 je historie předchozího grafického úkolu. Cílem této relace je Goal **Tideland — Combat, Danger & Progression Expansion**. Goal je aktivní. V tomto rozhraní nelze vytvářet samostatné podúkoly pod Goal, proto se jejich stav vede níže a zde.

## Git

- Repository: `/Users/romansvora/Documents/Tideland`; canonical origin `https://github.com/rsvora-bit/RUST---clon.git`.
- Pracovní branch: `codex/world-quality-next`; poslední commit `8aaa1d8` (`Add recoverable hunting bow projectiles`). Navazující durability/repair slice je právě rozpracovaný v working tree.
- Při povinném `git fetch origin` se `origin/main` nečekaně posunul z `19cd35b2a52f6d7929afc1e0bf64b8db322766b4` na `7c5748eca1949379304316347cff0c1d9208a64e` (`Merge branch 'main' ...`). Mění mimo jiné world revision 3 zpět na 2 a upravuje foliage, atmosféru i QA. Větev je 15 commitů napřed a 2 pozadu; merge-base je `19cd35b`. Změnu jsem neslučoval, neresetoval ani nepřepisoval, protože jde o odlišný world layout s důsledky pro save compatibility. Před integrací či pushnutím je nutná samostatná kontrola tohoto upstream rozdílu.
- Nepracoval jsem na lokální `main`; neproběhl push, PR, tag ani release.
- Každá další validovaná gameplay vrstva se ukládá do samostatného lokálního checkpointu; QA artefakty zůstávají v ignorované `test-results/`.

## Goal a stav úkolů

1. Dokončit world-art/performance QA — **COMPLETE** (native Metal GPU verified; podklady níže).
2. Combat foundation — **COMPLETE** po `npm test`, buildu a typed-damage/death/Lost Pack browser průchodu.
3. Melee — **COMPLETE for existing improvised tools** (rock/hatchet/pickaxe profiles, range/arc/occlusion, stamina cost, one damage per swing; actual aimed wildlife hit and harvest verified). New dedicated spear/blade tier remains NOT STARTED.
4. Luk/projektily a střelné zbraně/náboje — **IN PROGRESS** (luk, draw strength, balistický šíp, swept hit, wildlife damage, recoverable/persistent arrows runtime PASS; firearm/reload/ammunition tiers NOT STARTED).
5. Damage/death integration — **IN PROGRESS** (typed player hits, wildlife melee/projectile and death flow wired; projectile lethal browser regression and human AI integration remain).
6. Armor/equipment — **IN PROGRESS** (pět craftitelných kusů, čtyři persistentní sloty, damage-category mitigation, UI equip/save/load; durability a teplotní survival efekt zbývají).
7. Durability/repair — **COMPLETE** (volitelné `ItemStack.condition`, trvanlivost rock/hatchet/pickaxe/hammer/bow/spear, gathering/combat degradation, break, condition UI a materiálová oprava u Workbench 1; unit a browser UI/save-reload QA PASS, commit `e72b57c` plus QA `3f0286f`).
8. Wildlife — **COMPLETE for first hostile fauna slice** (seeded wolf/boar population, close-range AI LOD, melee interaction, persistent health/death, meat/hide rewards). Passive species/advanced behavior NOT STARTED.
9. Hostile human AI — NOT STARTED.
10. Loot tiers — částečně existují; rozšíření NOT STARTED.
11. Přístup do high-tier POI — NOT STARTED.
12. Base ownership/locks — NOT STARTED.
13. Electricity — NOT STARTED.
14. Balancing — NOT STARTED.
15. Plná regression/runtime QA — IN PROGRESS (death/respawn/Lost Pack and combat/wildlife browser scenarios pass; full feature-by-feature regression remains).
16. Dokumentace/checkpoint/release decision — IN PROGRESS; nevydávat release, dokud neprojdou mandatory runtime kontroly.

## Fáze 0 — dokončené ověření světa

- `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome npm run test:world-art`: **31/31 PASS**, `errors=[]`. Ověřeno generování Gen5 revision 3, přesně 68 000 instancí trávy, tree culling, climate-aware palms, road clearance, denní/večerní/noční/storm snímky, rychlý sweep kamery a save/reload stability.
- Skutečný archivovaný save v0.9.0 (revize 1) zachoval world layout, ID/pozice resource nodes, hráče, inventář, stavby, stanice, Tech Tree i rozestavěné/upravené world state. Archivovaný v0.9.1 (revize 2) stejně zachoval svůj layout a data. QA nenašlo nové browser console, WebGL ani aplikační chyby.
- Výstupní screenshoty jsou v `test-results/world-art/` (ignorované): `road-new`, `spawn-understory`, `palm-warm-coast`, pět biome view a day/evening/night/storm horizon. Ruční kontrola: cesta je čitelná a svět se načítá; zůstávají známé art nedostatky — travní pokryv je místy uniformní/ostrý, vzdálené hory působí hladce geometricky a některé blízké jehličnany jsou tmavé. Nejde o novou regresi této QA fáze.
- Dvě měření v Chrome s `--use-angle=metal`; GPU renderer byl samostatně ověřen jako `ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)`. Seed `731942`, HIGH, 1280×720:

  | Měření | v0.9.0 archiv | současná větev |
  | --- | ---: | ---: |
  | FPS / čas snímku | 59.996 / 16.668 ms | 60.002 / 16.666 ms |
  | Draw calls | 612 | 606 |
  | Trojúhelníky | 3 390 261 | 2 855 982 |
  | World nodes | 1 318 | 1 598 |
  | Startup | 7 716 ms | 6 937 ms, opakované teplé spuštění 2 762 ms |

- FPS bylo synchronizované přibližně na 60 Hz; nejde o maximální propustnost GPU. Významnější stabilní signály jsou stejné FPS bez viditelné regrese, o 6 méně draw calls a přibližně o 15,8 % méně trojúhelníků; nárůst world nodes odpovídá hustší vegetaci. Startup závisí na studeném/teplém cache a nelze z těchto dvou běhů dělat přímé tvrzení o zrychlení.
- Původní baseline před combat prací: `npm test` **189/189 PASS**, 25 souborů; build PASS s existujícím Vite chunk >500 kB upozorněním.

## Combat foundation — aktuální checkpoint

- Přidán `src/combat/damage.ts`: `DamageType`, `DamagePacket`, `DamageResult`, `Damageable`, deterministické řešení zásahu a mitigace s 85% stropem, mapování legacy cause stringů. Absorbed hlásí mitigovanou část; overkill se nevydává za armor absorb.
- `GameSimulation` implementuje `Damageable` a drží starý `damagePlayer(amount, cause)` kontrakt kompatibilní. `GameApp.applyPlayerDamage(packet)` zachovává god mode a napojuje lethal zásah na stávající smrt/Lost Pack lifecycle; starý API zůstává wrapperem. Typed bridge je dostupný přes lokální QA/debug API.
- `tests/combat-damage.test.ts`: 5 testů kontraktů, mitigation, invalid/fatal zásahů a compatibility. `tests/melee-combat.test.ts`: 5 testů současných improvizovaných weapon profiles, range/forward arc/occlusion a single-hit swing claim.
- `scripts/death-respawn-qa.mjs`: skutečný typed toxic lethal hit s ověřením cause/source, zachování dead save, Lost Pack/map marker/loot transfer, respawn kitu/statistik/collision-safe spawn, movement input, build/door a reload. Movement kontrola po respawnu bere v úvahu překážky kolem bedrollu: zkouší čtyři směry a požaduje ≥0,3 m; poslední běh naměřil 0.15/0.07/0.49/0.04 m, PASS při 0.49 m. Žádné browser console chyby.
- Poslední úplný `npm test`: **194/194 PASS**, 26 souborů. `npm run build`: PASS (existující >500 kB bundle warning). Po drobné opravě semantics `absorbed` proběhlo cílených **5/5** combat testů a build znovu PASS.
- Poslední runtime: `CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:death` PASS včetně typed damage/death/reload/respawn/Lost Pack/building. QA běžela přes nainstalovaný Chrome; Playwright bundled Chromium na tomto hostu chybí.
- Wildlife implementace: `src/combat/wildlife.ts` generuje 10 deterministických actorů pro Gen5 a 6 pro legacy worlds podle seedu, výšky a biome. Boar je klidný do napadení; wolf útočí v aggro radiusu. Aktivní AI/modely se zpracují do 100 m; každý druh sdílí jednu sloučenou low-poly geometrii, instance dále než 100 m se skryjí. Bez persistentních mesh/collider references.
- Melee/loot integrace: `GameApp` registruje wildlife přes existující interaction raycaster; rock/hatchet/pickaxe používají typed melee profily, forward arc, range, collision occlusion přes stávající InteractionSystem, stamina cost a swing cooldown. Zasažené HP i dead flag se zapisují do existující `nodeChanges`, bez save schema/generation bumpu. Kills dávají `rawMeat`/`hide`, které jsou validními novými `ItemId` s vlastními ikonami; po reloadu se poražený actor znovu negeneruje.
- Runtime: `CHROME_BIN=... npm run test:combat` PASS — seedovaný wildlife, aimed melee damage, poražení/loot, AI hit player typed damage, save/reload bez respawnu cíle, inventory equip, cold mitigation, persisted clothing a žádné browser chyby. Harness používá debug bridge k deterministickému setupu. Jeden mezilehlý běh minul 8s timing okno AI útoku; po přidání deterministické hostile fixture celý browser průchod PASS. QA artefakty jsou ignorované v `test-results/combat/`.
- Regression: `CHROME_BIN=... npm run test:death` PASS — death/dead save/respawn, movement po respawnu 0.52 m v nejvolnějším směru, Lost Pack recovery/map marker/save reload/building/doors; browser errors none.
- Equipment: nové položky `shirt`, `pants`, `boots`, `warmJacket`, `protectiveHood`; recipes používají wildlife hide/fiber a pokročilé kusy Workbench 1. Volitelné `GameState.player.equipment` je pro starší saves zpětně kompatibilní, normalizuje se na prázdné sloty a validuje item/slot mapping. Nasazení vrací předchozí kus do téhož inventářového slotu. Typová ochrana je omezena a cold jacket browserově ověřená. Inventory footer dostal pointer-events opravu, protože dříve překrýval tlačítko WEAR.
- `tests/equipment.test.ts`: tři cílené testy equip/swap, chybné položky/sloty, mitigace a legacy save reload.
- Ranged slice: nové `bow`/`arrow` definitions/icons/recipes; bow held mesh; hold/release draw strength; strength-scaled launch, gravity a swept segment-sphere actor detection s raycast terrain/building occlusion. Zásah ukládá actor HP/death+loot; každý dopad nechá recoverable world arrow. Přidán `src/combat/projectile.ts`, `tests/projectile.test.ts` (2), `scripts/ranged-qa.mjs`, `npm run test:ranged`; save bridge vrací skutečný success boolean. Save používá existující formát/`nodeChanges`, bez revision bumpu.
- Poslední plný `npm test`: **209/209 PASS**, 30 souborů; `npm run build` PASS s existujícím ~3.17 MB bundle warningem. Chrome headless `test:ranged` PASS: výstřel odebere jeden šíp, balistický zásah poškodí wildlife, uloží poškození i sbíratelný šíp; browser console/WebGL errors none.
- Ranged slice a následující durability/repair fáze byly následně dokončeny; viz jejich checkpointy níže.
- Verze zůstává v0.9.1 / EA-09.1. Žádný tag/release/merge/push. `origin/main` má výše zaznamenanou neintegrovanou změnu, proto před budoucím publish nutné výslovně zkontrolovat divergenci.

## Durability/repair checkpoint — 2026-09-30

- Nový `src/combat/durability.ts` definuje maximální condition durable tools a legacy-safe default condition.
- `ItemStack.condition` je volitelné, takže starší save data bez tohoto pole zůstávají kompatibilní. Save a station validators odmítají neplatné condition nebo condition na nedurable itemech.
- Gathering snižuje condition aktivního nástroje a yield se s opotřebením mírně zhoršuje; melee/ranged poškození wildlife také škáluje s condition. Po úplném opotřebení se nástroj odstraní. Při move/drop/pickup a station take-all se condition přenáší.
- Inventory ukazuje condition bar/detail a nabízí `REPAIR AT WORKBENCH`; oprava spotřebuje item-specific materiály a obnoví 45 condition. Workbench musí být do 5 m.
- Přidán `tests/durability.test.ts` (3 testy: přesun/drop/pickup/break, oprava/cena/save validity, legacy stack/validace).
- Validace po aktuálních změnách: cílené **74/74 PASS**, plné `npm test` **212/212 PASS (31 souborů)**, `npm run build` PASS; existující upozornění na velký JS chunk cca 3.17 MB.
- `git diff --check` PASS. Browser `test:ranged` rozšířen a PASS: vystřelení/recoverable arrow, inventářové UI opravy, správné spotřebování 12 stone + 6 wood, `save()===true`, reload/Continue a zachovaná condition 65; bez aplikačních/WebGL chyb. QA vygenerovalo jen ignorované `test-results/ranged/` artefakty.
- `scripts/ranged-qa.mjs` nyní obsahuje skutečnou UI/reload regresi pro opravu; QA fixture používá správnou nulovou kapacitu Workbench inventáře.
- Aktuální změněné soubory: `src/app/GameApp.ts`, `src/core/types.ts`, `src/inventory/inventory.ts`, `src/save/storage.ts`, `src/simulation/GameSimulation.ts`, `src/survival/stations.ts`, `src/ui/UI.ts`, `src/ui/style.css`, `src/combat/durability.ts` (nový), `tests/durability.test.ts` (nový).
- Při obnovení nejdřív `git status` a `git diff`; zachovat celý tento rozpracovaný stav. Poslední potvrzený HEAD `8aaa1d8`. Neprovádět push/release; divergence origin/main není vyřešena.

## Tech Tree / spear checkpoint — 2026-10-01

- Přidán originální spear jako první samostatně profilovaná melee zbraň v delším dosahu. Je craftitelný až po výzkumu `fieldEngineering` na Workbench 1 a využívá současnou stamina/damage/condition/save pipeline wildlife combat.
- Přidána vlastní procedural first-person geometrie (haft, kovová špička a návlek) a vlastní SVG ikona; durability 90, landed hit opotřebuje o 1. Jeho profil: damage 36, reach 2.7 m, cooldown 0.76 s, stamina 9 a užší arc 0.72.
- `fieldEngineering` nyní odemyká `field_spear`; recept stojí wood 75, stone 45, fiber 20. Všechny staré ItemId/save validace zůstávají řízeny katalogem `ITEMS`; žádné save schema ani verze se nemění.
- Testy rozšířeny o spear reach/damage/arc a kompletní research→craft→save-valid flow.
- Targeted tests **22/22 PASS**; následná plná sada **214/214 PASS (31 souborů)**, TypeScript/build PASS (existující velký JS chunk warning). Browser `test:combat` PASS: spear zasáhl z větší vzdálenosti a condition 90→89, běžný melee kill + meat/hide persistence, hostile wildlife typed damage, save/reload, clothing equip/cold mitigation/persistence; žádné console/WebGL chyby.
- Aktuálně rozpracováno pouze QA rozšíření, které je třeba commitnout po úspěšné plné sadě: `src/core/types.ts`, `src/items/definitions.ts`, `src/combat/durability.ts`, `src/combat/melee.ts`, `src/crafting/recipes.ts`, `src/crafting/techTree.ts`, `src/rendering/HeldItem.ts`, `public/assets/icons/spear.svg`, `tests/melee-combat.test.ts`, `tests/tech-tree.test.ts`, `scripts/combat-qa.mjs`.
- Aktuální potvrzené předchozí HEAD `3f0286f`; nová feature zatím necommitnutá. Zůstat na `codex/world-quality-next`, nepushovat/releasovat; origin divergence dál blokuje integraci.

## Toxic relay hazard checkpoint — 2026-10-01

- Added `src/survival/hazards.ts`: continuous horizontal-distance exposure derived only from deterministic Generation 5 revision 3 relay POI. Legacy generations and revisions 1–2 stay unchanged. The hazard is runtime-derived and adds nothing to saved layout/state.
- Added 19 m exposure band with weaker edge dose, one toxic damage tick per game second, one entry/exit notification, plus increased protective-hood toxic mitigation to 35%. Added three small irregular dark runoff pools and corroded battery drums at the existing relay POI; the main pool was reduced after screenshot inspection because the first version read as an oversized bright-green disc.
- Added `scripts/hazard-qa.mjs` / `npm run test:hazard`, unit coverage for deterministic range/revision gates and height independence, and toxic gear mitigation assertions.
- Browser test passed real New Game → relay teleport/aim → entry notice → actual health loss, screenshot visual inspection, no browser/WebGL console errors. SwiftShader simulates slowly (about 0.18 game seconds per 2.2 wall seconds in an observed run); harness waits on game health instead of relying on wall-time assumptions.
- `npm test`: **216/216 PASS (32 files)**. `npm run build` PASS; existing large JS chunk warning (~3.18 MB). `git diff --check` PASS.
- Current uncommitted files before checkpoint: `package.json`, `src/app/GameApp.ts`, `src/combat/equipment.ts`, `src/survival/WorldSurvival.ts`, `tests/equipment.test.ts`, new `scripts/hazard-qa.mjs`, `src/survival/hazards.ts`, `tests/hazards.test.ts`.
- Latest committed HEAD is `404ddb5`; hazard commit remains to be created. Continue without push/release; upstream divergence remains unresolved.

## Door locks checkpoint — 2026-10-01

- Přidáno persistentní zamykání pouze pro zavřené dveře přes stávající field hammer menu. Zamčené dveře nelze otevřít běžnou interakcí; nabídka umožňuje zamknout/odemknout a při změně se ihned překreslí viditelný kovový visací zámek.
- `Structure.locked` je volitelné pole. Validátor saveů přijímá staré dveře bez tohoto pole, povoluje boolean pouze na dveřích a odmítá ostatní typy konstrukcí. Bez změny save verze ani world generation identity.
- Unit testy pokrývají lock/unlock, blokování otevření, save/reload a validaci starých dat; renderer ověřuje zámek při změně stavu.
- Přidán `scripts/door-lock-qa.mjs` a `npm run test:door-lock`. Browser ověřil placement dveří v platné konstrukci, kliknutí na lock UI, nemožnost otevření, zachování stavu po reloadu a unlock; žádné browser/WebGL chyby. Chromium z Playwright cache na hostu chybí; použil se instalovaný Google Chrome s Metal.
- Po přidání této části `npm test`: **218/218 PASS, 32 souborů**. `npm run build`: PASS s existujícím upozorněním na velký JS chunk. `git diff --check`: PASS.
- Screenshot browser QA je ignorovaný artefakt `test-results/door-lock/door-lock.png`.
- Změněné soubory: `package.json`, `src/app/GameApp.ts`, `src/building/HammerMenu.ts`, `src/building/StructureRenderer.ts`, `src/core/types.ts`, `src/save/storage.ts`, `src/simulation/GameSimulation.ts`, `tests/simulation.test.ts`, `tests/structure-renderer.test.ts`, nový `scripts/door-lock-qa.mjs`.
- Aktuální commit zůstává `62a3d75`; zamykání dveří zatím není commitnuté. Pracovní větev `codex/world-quality-next`, žádný push/PR/release. `origin/main` divergence zůstává nevyřešena; před integrací ji nejdřív prozkoumat.
- Zamykání dveří bylo po tomto checkpointu commitnuto jako `c3bc298`; tento systém je ověřený a dokončený.

## Persistentní utility power checkpoint — 2026-10-01

- Přidán lokální power loop `generator → field switch → caged lamp` přes existující persistentní seznam stanic. Bez změny save schema version, world generation nebo starých save dat.
- Generátor přijímá dřevo ve fuel slotu, spotřebuje jeden kus za 120 herních sekund a ukládá časovač v existujícím `Station.job`. Spínač musí být do 11 m od běžícího/naplněného generátoru; lampa se napájí do 11 m od aktivního spínače. Síť se prostorově předfiltruje buckety; render a UI stav se obnovují omezenou frekvencí.
- Research `advancedFabrication` odemyká generátor a spínač na Workbench II; `workshopLighting` odemyká lampu na Workbench III. Přidány originální procedural modely, SVG ikony a station UI pro fuel/toggle/status.
- Unit testy ověřují spotřebu paliva, save validaci, range, stav spínače a úplný research/crafting řetězec. Browser QA `npm run test:power` v instalovaném Chrome s Metal ověřila skutečné vložení paliva přes UI, spuštění generátoru, časovanou spotřebu, aktivaci switch, napájení lampy, save/reload, odpojení po vypnutí switch a absenci browser/WebGL chyb.
- QA nejdřív odhalila zastaralý power-status při otevření lampy krátce po přepnutí switch; opraveno vynuceným přepočtem při otevření station panelu.
- Poslední úplné kontroly po opravě: `npm test` **222/222 PASS (33 souborů)**; `npm run build` PASS s existujícím Vite chunk-size warningem (~3.18 MB); `git diff --check` PASS.
- Screenshot a výsledky jsou ignorované artefakty `test-results/power-network/`.
- Soubory power změn: `package.json`, `public/assets/icons/{generator,lamp,powerSwitch}.svg`, `scripts/power-network-qa.mjs`, `src/app/GameApp.ts`, `src/core/types.ts`, `src/crafting/recipes.ts`, `src/crafting/techTree.ts`, `src/items/definitions.ts`, `src/rendering/HeldItem.ts`, `src/survival/StationRenderer.ts`, `src/survival/StationUI.ts`, `src/survival/stations.ts`, `tests/power-network.test.ts`, `tests/tech-tree.test.ts`.
- Power část je nyní připravená k checkpoint commitu. Před commitem je HEAD `c3bc298`; pracovní branch `codex/world-quality-next`. Žádný push/PR/tag/release; divergence `origin/main` zůstává nevyřešena a musí se zkontrolovat zvlášť před integrací. Verze zůstává v0.9.1 / EA-09.1.
- Další krok po power checkpointu: pokračovat další hratelnou progression vrstvou v aktivním cíli; prioritu zvolit podle aktuálního architektonického průzkumu a znovu ověřit saves/QA. Zatím nezačínat release.

**INCOMPLETE.** World-art QA, melee/wildlife, persistent equipment a první bow/projectile loop jsou ověřené. Firearms/reload, durability/repair, hostile human AI, loot-tier/access progression, base ownership/locks, electricity, balancing a plná regression QA zbývají.

## Hostile scavenger checkpoint — 2026-10-01

- Přidáni nejvýše dva deterministicí island scavengers u Generation-5 relay/quarry POI. Sdílejí stejnou combat/damage, melee a projectile cestu jako fauna; po porážce dávají scrap a wiring. Jejich health/death používá existující `nodeChanges`, bez save schema nebo world-generation identity změny.
- Následná kontrola výslovně omezuje jejich spawn na Generation 5; test potvrzuje, že legacy Generation 4 wildlife layout scavengery nedostane.
- Humanoid procedural low-poly model je jedna sloučená sdílená geometrie na druh; scéně jsou přidány pouze actor meshes. Fauna modely a jejich loot zůstaly stejné.
- Rozšířeny `tests/wildlife-combat.test.ts`, přidán browser harness `scripts/scavenger-qa.mjs` a `npm run test:scavenger`.
- Cílené Vitest: 7/7 PASS. Browser QA v instalovaném Chrome/Metal: deterministický spawn u industriální POI, útok na hráče, scrap+wiring loot, persistentní death po save/reload, bez browser/WebGL errors. Výstupy jsou ignored v `test-results/scavenger/`.
- Úplné `npm test`: **224/224 PASS (33 souborů)**. `npm run build`: PASS; zůstává stávající Vite upozornění na bundle přibližně 3.18 MB. Ještě čeká finální commit této sekce.
- Změněné soubory: `src/combat/wildlife.ts`, `src/app/GameApp.ts`, `tests/wildlife-combat.test.ts`, `scripts/scavenger-qa.mjs`, `package.json`, tento checkpoint dokument.
- Větev `codex/world-quality-next`; žádný push/PR/tag/release, verze stále `0.9.1 / EA-09.1`. Předchozí commit `f9c42af`. Zkontrolovat stav a vytvořit lokální checkpoint commit; nepokračovat na main ani neřešit upstream divergence bez inspekce.
- Další pracovní oblast vybrat po commitu z rozsáhlého cíle Combat, Danger & Progression Expansion; ověřit existující implementace před rozšířením, nepřidávat duplicity existujících loot profilů.

## Final world-art/performance QA — 2026-10-01

- Dokončena první položka aktivního Codex Goal: Chrome s ANGLE Metal, 1280×720, seed 731942, preset HIGH. Výkon je omezený synchronizací na 60 FPS, takže FPS/frame time potvrzují absenci viditelného propadu, nikoli maximální GPU propustnost.
- Archiv v0.9.0 versus aktuální v0.9.1 checkout: FPS **59.996 → 60.002**, frame time **16.668 → 16.666 ms**, draw calls **612 → 618** (+~1 %), triangles **3,390,261 → 2,856,582** (-15.7 %), startup **2,893 → 2,582 ms** (-10.7 %), resource node count **1,318 → 1,598** (+280; současná revision obsahuje více world nodes). Běh používá nativní Chrome/Metal; nespoléhá pouze na SwiftShader.
- `npm run test:performance`: PASS proti skutečnému publikovanému archivu v0.9.0; obě app verze bez console/page errors. `npm run test:world-art`: **31/31 kontrol PASS**, včetně skutečného archivovaného v0.9.0 a v0.9.1 save reload, node/POI/road identity, structures/colliders, horizon/grass/tree culling/palm climate/road clearance a revision-3 save reload. Camera sweep bez WebGL/application errors.
- Prohlédnuté screenshots aktuálního světa: HIGH spawn/understory, grassland, rocky mountain, road, warm coast palm, night a storm. Noc a storm mají jasně odlišnou atmosféru; road je čitelná a vizuálně zapadá. Některé automaticky nadepsané biome záběry neukázaly reprezentativní vnitřní forest view, proto je nenazývat kompletním forest screenshot coverage; detailní forest gameplay sweep zůstává součástí pozdější regresní QA.
- Po legacy safeguard změně: `npm test` **225/225 PASS (33 souborů)**; `npm run build` PASS; `git diff --check` PASS. Build warning o ~3.18 MB JS chunk přetrvává.
- Gameplay browser regression po scavenger změně: `test:scavenger`, `test:combat` a `test:ranged` PASS; žádné console/WebGL chyby. Scavengers jsou Generation 5-only a Generation 4 unit test neumožňuje jejich přidání do legacy worlds.
- Aktuální poslední commit před zápisem této části: `98bf74f Keep scavengers out of legacy worlds`; předchozí `24d9f10 Add deterministic hostile scavengers`. Pracovní strom byl čistý. Následující krok: commitnout aktualizovaný QA checkpoint a pokračovat dalšími nedokončenými cíli. Bez push, PR, release nebo bump verze.

# RESUME CHECKPOINT — 2026-09-13 13:36 Europe/Prague

**INCOMPLETE.** Pokračovat v celém původním zadání v0.8.0 Graphics Overhaul. Tento checkpoint není release ani kandidát na merge. Přerušení kvůli usage limitu (85 % při poslední kontrole), nikoli kvůli iCloudu.

## Git a obnovení

- Repository: `/Users/romansvora/Documents/Tideland`.
- Origin: `https://github.com/rsvora-bit/RUST---clon.git`.
- Pracovní branch: `codex/graphics-overhaul-v080`; nevytvářet novou.
- Výchozí commit a posledně ověřený origin/main: `4de78f28f09b2ab0c993511e67bd6f064374dbe8` (maintenance PR #10).
- Aktuální checkpoint commit: commit obsahující tento soubor, zjistit `git log -1`; zpráva `WIP: checkpoint Tideland vegetation rendering stability`.
- WIP commit/push: následuje po zápisu dokumentu, skutečný výsledek je v závěrečném reportu konverzace; ověřit `git status -sb` a remote ref. Žádný PR ani merge této rozpracované práce.
- První krok po obnovení: přečíst tento soubor, spustit `git status`, `git branch --show-current`, `git log --oneline -n 10`, `git diff`, `git fetch origin`. Ověřit, že main/pracovní branch se neočekávaně nezměnily. Pokračovat existující implementací fáze 3 a následně terrain; neopakovat celý BEFORE baseline.
- Nedotýkat se parent Git repository `/Users/romansvora/Documents`. Žádné destructive reset/force push/mazání práce.

## Dokončené a rozpracované fáze

- Dokončeno: úvodní analýza, BEFORE baseline, obnovení fyzické dostupnosti repozitáře po iCloudu.
- Rozpracováno: fáze 3 vegetation stability, dílčí základy grass/post-processing/lighting. Neoznačovat tyto systémy za finálně hotové.
- Zachovány původně rozpracované `scripts/environment-qa.mjs` a checkpoint. Verze stále **0.7.2 / EA-07.2**.
- Změněné soubory a obsah:
  - `src/rendering/DepthAO.ts` (nový): jemné AO ze skutečné depth texture hlavního RenderPass; 8 vzorků, maximální ztmavení 18 %, bez dalšího překreslení geometrie. Aktualizuje readBuffer depth při composer ping-pong a inverzní projekci po změně FOV.
  - `src/rendering/WorldPostFX.ts`: nahrazení SSAOPass za DepthAO, FXAA po OutputPass, slabší bloom, explicitní dispose passes. Composer jen High/Ultra.
  - `src/rendering/environment.ts`: standardní Lambert alpha cutout foliage bez custom wind shaderu; mírnější instance tint; koruny nepřijímají self-shadows. Opaque geometrická tráva, počet 16000 místo 30240, vynucená oblast u spawnu 2800 místo 14500, postupný úbytek počtu instancí podle vzdálenosti.
  - `src/world/models.ts`: sdílený deterministický trs trávy ze 7 ohnutých stébel, 21 trojúhelníků, bez alpha karet. Ostatní geometrie zatím původní.
  - `src/world/atmosphere.ts`: zvýšené denní hemisphere fill/ground contribution; další světlo/sky/water zatím původní.
  - `src/app/GameApp.ts`: opraven CSS rozměr canvasu při Render Scale pomocí renderer.setSize(w,h).
  - `tests/depth-ao.test.ts`, `tests/foliage-geometry.test.ts`: 4 nové testy depth ping-pong/projekce a konečnosti normál/nekolabované geometrie/determinismu trávy.
  - `scripts/environment-qa.mjs`: deterministické BEFORE/AFTER screenshoty, F3, 17 scén/time/weather/preset vzorků a hlídání konzole.
  - `RESUME-CHECKPOINT.md`: tento stav.

## Validace

- `npm ci --cache .npm-cache`: úspěch. Opravil iCloud duplikáty v node_modules (`@types/three 2`, `chai 2`), které předtím bránily TypeScript buildu.
- Poslední `npm test`: **59/59**, 15 souborů, 2026-09-13 13:35; `.npm-cache/checkpoint-tests.log`.
- Poslední `npm run build`: **úspěch**; `.npm-cache/checkpoint-build.log`. Existující upozornění na JS chunk >500 kB.
- Poslední browser QA: `TIDELAND_QA_LABEL=stability-grass node scripts/environment-qa.mjs`, **17 vzorků, errors=[]**. Pouze původní Rapier warning deprecated initialization parameters.
- Výstupy: `.npm-cache/graphics-v080/stability-grass/report.json` a PNG; starší mezikrok `.npm-cache/graphics-v080/stability/`. Screenshoty/logy jsou ignorované, necommitovat.
- Skutečně prohlédnuté poslední snímky: High field, dense forest, Low field, High night. Low nyní pokrývá celý viewport. Tráva nemá dřívější černé alpha shluky, je však zatím velmi řídká. Noční svět je stále téměř černý.
- Dev server: `npm run dev -- --host 127.0.0.1 --strictPort --force`, http://127.0.0.1:5173, před přerušením session 60483. Po obnovení ověřit dostupnost, případně znovu spustit. `--force` je reoptimalizace Vite dependencies, nikoli Git force push.
- Browser: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, Playwright headless ANGLE Metal.
- Gameplay regression QA po změnách **dosud neprovedeno**. Statické QA nenahrazuje pohyb kamery, rychlé otočení, gathering ani save/load.

## Performance — průběžné, nikoli finální AFTER

High, 1280×720, DPR1, seed731942, 10:00 clear, x28/z212 směrem x28/z155; celý snímek včetně shadow/post/viewmodel průchodů:

| Stav | FPS | frame time | draw calls | triangles |
| --- | --- | --- | --- | --- |
| BEFORE | ~60 | 16,67 ms | 888 | 6 305 034 |
| stability-grass | ~60 | 16,67 ms | 455 | 3 121 982 |

FPS omezené synchronizací, nejde o měření maximální GPU propustnosti. BEFORE Low měl chybu velikosti canvasu, nelze z něj vyvozovat přesné srovnání GPU výkonu. Současný Low 232 calls / 1 483 517 triangles, Medium 347 / 2 411 517, Ultra 479 / 3 225 398.

Původní BEFORE z 2026-09-12 zachován v `.npm-cache/graphics-v080/before/`; původní 55 testů a build v `.npm-cache/v080-baseline-tests.log` a `v080-baseline-build.log`.

## Zjištění, skutečné problémy a další práce

1. SSAOPass override MeshNormalMaterial nezohledňoval alpha cutout/vlastní wind/invisible material stejně jako hlavní pass. Nový DepthAO používá skutečnou hloubku, odstraňuje celý dodatečný geometry pass. Černé části stromů existovaly i bez AO: není to jediná příčina všech artefaktů.
2. Foliage wind je nyní statický; původní custom deformace neodpovídala shadow depth. Zachovány node IDs, placement, colliders a fall references. Pohyb/falling ověřit skutečným QA. Koruny stále mají původní řídké až rozpadlé siluety a některé tmavé části, proto nelze říct, že všechny tree artefacts byly odstraněny.
3. První implementační krok: dokončit stabilitu tree foliage (textury/normály/tmavé multiplikace a úhly), pak pokračovat terrain materiály bez změny výšek/save generation. Zvažovat lepší koruny a prostorový tree batching/LOD; celosvětové batches stále vykreslují ~3 miliony trojúhelníků.
4. Grass je nyní stabilnější, ale příliš řídká a zatím jednoduchá. Doladit hustotu/distribuci/odstíny a distance popping při pohybu. Nepřidávat zpět obří alpha karty.
5. Noční krajina zůstává téměř černá; fáze lighting/sky/postFX musí zlepšit čitelnost. Původní grading s kontrastem zůstává, vyhodnotit crushed blacks. Denní les stále potřebuje lepší koruny a vyvážení.
6. Terrain detail a wet/dry/slope blending, rocks, water/shoreline, sky/clouds/night, weather visuals a kvalitativní presety jsou dosud převážně původní. Water vWorld používá lokální pozici i při posunu oceánu -0.12; ověřit při fázi vody.
7. Hot paths: Weather tvoří Color každý frame, falls Quaternion; resource culling nodes.find opakovaně. Zlepšit lokálně bez změny gameplay/RNG/node identity.
8. Finální QA skripty: `scripts/fps-basis-qa.mjs` má starý New Game selector a potenciálně zastaralé movement předpoklady. Opravit jen prokazatelně zastaralé testy, nikoli skrýt bug. `scripts/polish-qa.mjs` také prověřit.
9. Zbývají všechny nedokončené části fází 3–14, finální visual QA s pohybem a presety, kompletní požadované gameplay regression QA, test/build, teprve potom versioning 0.8.0/EA-08, README/CHANGELOG/package-lock, PR/performance/limitations, CI, merge, Pages.

Žádné nové assety z internetu. Pause menu, Settings layout, gameplay, saves a audio neredesignovat. WIP nikdy nemergovat do main.
