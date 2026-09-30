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
- Přesný další krok: checkpoint ranged slice, implementovat persistentní tool/item durability a repair bench, poté pokračovat ostatními Goal systémy a regression QA.
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

**INCOMPLETE.** World-art QA, melee/wildlife, persistent equipment a první bow/projectile loop jsou ověřené. Firearms/reload, durability/repair, hostile human AI, loot-tier/access progression, base ownership/locks, electricity, balancing a plná regression QA zbývají.

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
