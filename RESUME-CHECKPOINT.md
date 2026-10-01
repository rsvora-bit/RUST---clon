# AKTUÁLNÍ CHECKPOINT — 2026-10-01

Toto je živý checkpoint po obnovení práce. Níže je ponechána historie předchozí relace v0.9.1; její Git stav už nepopisuje současnou větev.

## Cíl a postup

- Aktivní Codex Goal: **Tideland — Combat & Endgame Expansion**.
- Navázáno na vydaný v0.9.2. Po první persistentní Generation 5 event vrstvě a koordinaci POI hlídky: Goal 1 — **35%**, Goal 2 — **76%**, Goal 3 — **22%**, Goal 4 — **20%**, Goal 5 — **8%**; orientačně celkem přibližně **32% hotovo / 68% zbývá** (stejná váha Goalů; dílčí procenta jsou hrubý odhad).
- Goal 4 event loop: po vyzvednutí první bouřkové zásilky běží 15 minut herního cooldownu; až následná bouře a její konec vytvoří druhou zásilku na nové seedované pobřežní pozici. První zásilka má lucky-tier, další decent-tier loot. Pozice, cooldown a loot používají volitelná pole ve stávajícím `progression.washedAshore` a `progression.stations`; žádná save verze, Gen1–4 layout, POI ani world revision se nemění. Save ze starého jednorázového eventu dál používá původní ID `event-washed-ashore`; nové cykly mají unikátní station IDs.
- Goal 3 – zabezpečení základny: napájený Homestead Beacon vyžaduje existující síť `fueled generator → active switch`; když živý a alertovaný Gen5 scavenger vstoupí do 42m claimu, zobrazí se jednorázové upozornění a krátký syntetický alarm, Beacon červeně bliká. UI ukazuje `SECURITY ARMED` nebo `SECURITY OFF`; bez proudu je Beacon ztlumený. Save/reload zachová claim, generátor i přepínač, ale neukládá dočasný stav vniknutí. Žádná změna save schema, světové generace ani starších savů. Jednotkové `tests/base-security.test.ts` a rozšířené `test:base-security` PASS. Browser QA v izolovaném Chrome/SwiftShader ověřilo vniknutí, červený emissive Beacon, armed UI, save/reload, reset dočasného alarmu, vypnutí přepínače a offline UI; bez browser/WebGL chyb. Screenshot `test-results/base-security/alarm.png` (ignorovaný) byl vizuálně zkontrolován.
- Regresní chyba validace save odhalená browser testem: Gen5 `updateWashedAshoreEvent` inicializuje `sequence:0`, ale validátor dříve vyžadoval nejméně `1`; nový svět proto po prvním herním framu nešel uložit. `src/save/storage.ts` nyní přijímá platný počáteční nulový čítač a `tests/world-events.test.ts` chybu reprodukuje. Nebyla potřeba migrace save formátu ani úprava uložených dat.
- Chrome/SwiftShader `test:world-events` PASS: pobřeží a mapa, skutečné vyzvednutí přes Station UI, 15min cooldown, cooldown save/reload, druhá bouře, nová deterministická poloha/loot, druhý cache save/reload bez duplikace; žádné browser/WebGL chyby. V test harnessu se před druhou bouří obnoví save, protože headless frame scheduler po programatickém vyzvednutí nepostupoval; hráčský save/reload následně celý druhý cyklus ověřil. Plná sada nyní **264/264 PASS (37 souborů)**; production build PASS se stávajícím ~3.22 MB JS chunk warningem; `git diff --check` PASS. Browser QA vyžaduje `CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'` v tomto prostředí.
- Nový Goal 2 AI combat slice: po plném potvrzení hráče jedním Gen5 POI strážcem sdílí nejbližší živý lidský spojenec do 24 m krátkou last-known pozici, suspicion a alarm a jde ji prověřit. Nezíská vlastní LOS ani nezačne střílet skrz překážky; dál útočí až po vlastním zrakovém potvrzení. Wildlife/save/world layout se nemění. Jednotkový test ověřuje lookout+guard pair; `test:scavenger` v Chrome ověřil v reálném POI, že parťák přejde do `investigate` a zdraví hráče se nezmění.
- Goal 1 ověřený slice: animace napnutí luku/šípu a revolver/shotgun přebíjení, combat audio, runtime hit reaction a raycast melee occlusion; přidána Tier III Tidal salvage shotgun s osmi pelety na výstřel, shell ammunition, falloff, recoil, durability/repair, first-person model, ammo HUD a Armory Engineering odemčení.
- `scripts/ranged-qa.mjs` vybavuje předmět přes aplikační cestu a ověřuje/snímá napnutý luk. `scripts/firearm-qa.mjs` ověřuje revolver reload pózu. Přidány `scripts/shotgun-qa.mjs` a `npm run test:shotgun`; doplněn alias `npm run test:tech-tree`.
- Goal 2 první slice: scavenger potřebuje zorné pole pro chase/attack. LOS raycast testuje terrain, structures, resource nodes a POIs; kontroly jsou seedově rozfázované po přibližně 0.20–0.25 s a omezené na blízké aktory. Runtime stav se neukládá, takže save schema/layout zůstávají beze změny. Unit testy kryjí blokovanou/volnou viditelnost a throttling; browser `test:scavenger` ověřil POI, útok, porážku, salvage/access card a reload.
- AI rozšíření: scavenger má 60° horizontální vision cone, průběžné suspicion (rychlejší zblízka), alarm po dosažení plné pozornosti a 3.25s paměť poslední známé polohy. Po ztrátě výhledu tuto pozici prohledá a během hledání nestřílí/nebije naslepo. Runtime AI stav zůstává mimo save; Gen1–4 a formát savů se nemění. `test:scavenger` nově opravdu provede stealth za zády → otočení/odhalení → útok, guard/cache persistence.
- Bojový hluk: zásah zblízka varuje živé scavengery v okruhu 7 m na 2.4 s; luk podle síly v rozsahu 10–17 m na 2.8 s; revolver 36 m a shotgun 48 m na 5 s. Scavenger vyšetřuje pozici hluku, aniž by byl automaticky trvale rozhněván. Pomocná funkce zohledňuje výškový rozdíl, je deterministická a dead/ostatní wildlife ignoruje. Save formát zůstává beze změny.
- Nový equipment slice: pět craftitelných kusů oblečení má condition/durability; vybavený kus se opotřebuje pouze typem poškození, proti němuž poskytuje ochranu, a mitigace plynule klesá s condition. Rozbité oblečení se bezpečně sundá; vybavení lze vyměnit se zachováním stavu a opravit u Workbench za fiber/hide (u kapuce i metal). Volitelné `player.equipmentCondition` je zpětně kompatibilní se starými savy; save version zůstává 1. Inventář zobrazuje condition vybaveného i neseného oblečení, opravný QA ověřuje UI a save/reload.
- Browser `test:combat`: PASS v Chrome/Metal včetně cold mitigation, skutečného wear, HUD condition, save/reload a nulových browser/WebGL chyb. Přidán ellipsis overflow pro dlouhý world-info řádek inventáře. Hazard `test:hazard`: PASS; runtime ověřuje, že toxická zóna opotřebí pouze protective hood (95 → 94.96, bunda beze změny) a alpine storm opotřebí jacket i cold-protective hood a současně ubírá zdraví; žádné browser/WebGL chyby.
- Armor progression slice: přidán Advanced Fabrication recipe `salvage_vest` (Workbench II; metal, machine parts, gears, fiber, hide), salvage plate vest v torso slotu s durability 150, projectile mitigation 24%/melee 16% a bez cold resistance — smysluplná volba proti teplé bundě. Má vlastní původní SVG ikonu, salvage-material repair cost a stylizovanou dynamickou survivor ilustraci; swap zachová condition. Save version/schema se neměnily. `tests/tech-tree.test.ts` pokrývá research/craft; `tests/equipment.test.ts` pokrývá tradeoff a opravu. Browser combat QA ověřil equip/swap, avatar vzhled, projectile hit, degradation a reload persistence v Chrome/Metal; screenshot `test-results/combat/salvage-vest-equipped.png` (gitignored) byl vizuálně prohlédnut.
- Lethal projectile regression: `scripts/death-respawn-qa.mjs` nyní testuje fatal projectile se zdrojem `firearm-guard` místo syntetického toxického zásahu; ověřuje death lifecycle, Lost Pack, dead save reload, respawn, movement, building/doors a reload. Chrome/SwiftShader `test:death` PASS bez browser chyb; `tests/combat-damage.test.ts` navíc kryje lethal projectile identity.
- První raid/breach vrstva: střelné zbraně poškodí pouze zasažené dveře přes existující strukturální health/save systém; zámek zůstává aktivní, dokud dveře nejsou zničeny. Odolnost podle grade: wood `1.0×`, stone `.42×`, metal `.18×`, plus běžný distance falloff; shotgun zásah sčítá skutečně zasažené pelety. Spotřebuje běžný náboj, save format/layout se nemění. `firearmDoorDamage` má jednotkové pokrytí; Chrome/SwiftShader `test:door-lock` ověřil jeden revolverový náboj 250→217 HP, zachování locku, save/reload, odemčení, Homestead claim a persistentní zabezpečení. Browser/app/WebGL errors žádné.
- Vyšší armor tier: přidán `yardPlate` / Quarry Plate Rig s durability 220, mitigation 38% proti projektilům a 28% proti melee, bez cold/toxic insulation. Odemkne se jako tier III research `industrialArmor` za Workbench III, `advancedFabrication` + `workbench3Research`, a craftí za metal, machine parts, gears, Tech Part, fiber a hide. Má vlastní SVG ikonu, torso ilustraci v inventáři, condition UI a opravu za industrial salvage. Existing save version/schema i staré research migrace zůstávají nezměněné; migrace tier-III Workbench novou armor technologii automaticky neodemkne. `tests/tech-tree.test.ts` a `tests/equipment.test.ts` pokrývají gating, craft, tradeoff, opravu a round-trip save. Chrome/SwiftShader browser `test:combat` PASS: equip/swap, ilustrace, projectile mitigation, nulová cold protection, degradation, reload persistence; bez app/WebGL errors. `npm test` **254/254 PASS**, `npm run build` PASS (stávající ~3.21 MB chunk warning).
- Lookout archetype: deterministicky se jedna z Gen5 POI stráží zvolí jako ranged Lookout, druhá zůstává melee Scavenger; ID, POI, node state, save schema i legacy world generation zůstávají stejné. Lookout používá sdílený samostatný low-poly luk, drží odstup 9–21 m, střílí pouze při viditelnosti, má deterministickou, vzdáleností snižovanou přesnost a typ projectile damage, takže se uplatní stávající armor mitigation. Při přílišném přiblížení ustupuje. Opraveno otočení humanoidního modelu: lokální směr hlavy/luku nyní odpovídá yaw/perception směru AI. Model geometrie i materiál jsou cachované podle species+archetype. Zero-distance ústup testuje, že nevytvoří neplatné souřadnice.
- `test:scavenger` v Chrome/Metal PASS: deterministic melee/lookout role, stealth za zády, postupné suspicion a alarm, melee útok/loot/access card, sealed cache unlock, save/reload a skutečný ranged projectile hit s LOS. Bez browser/app/WebGL chyb. Ručně prohlédnutý ignorovaný `test-results/scavenger/lookout-ranged.png` ukazuje rozeznatelnou C-siluetu luku a model čelem k hráči.
- Firearm Guard archetype: quarry nyní navíc dostane jednoho deterministického obrněného strážce s vlastním stabilním `-guard` ID; původní Scavenger/Lookout ID, pozice i loot zůstávají zachované. Guard má 146 health, sdílený low-poly model s chest plate a originální improvizovanou firearm geometrií, drží 10–25 m, při přiblížení ustoupí a vystřelí typ projectile damage 14 pouze při LOS. Přesnost je seedově deterministická a snižuje se s vzdáleností. Guard dává scrap, wiring a machine parts místo další přístupové karty. Jeho smrt používá existující `nodeChanges`, takže se nový nepřítel po save/reload nevrátí; starší saves se pouze aditivně doplní o guard state, bez verze/save schema/layout revision změny. `test:scavenger` navíc runtime ověřil jeho střelbu, poražení, průmyslový loot a save/reload.
- Návrat z patroly: neporažený a nezraněný Scavenger, který ztratil hráče i last-known search, přejde do explicitního `return` state, vrátí se k POI home pozici a po zklidnění znovu začne wander patrol. Poškozený/provokovaný protivník zůstává hostile. Jde pouze o runtime AI stav; save, world layout a legacy chování zůstávají beze změny. Nový unit test kontroluje pohyb zpět domů a reset awareness/alarmu.
- Poslední validace: `npm test` **251/251 PASS, 35 souborů**; `npm run build` PASS (stávající cca 3.21 MB JS chunk warning); `git diff --check` PASS. Chrome/Metal `test:scavenger` ověřuje všechny tři role, stealth, podezření/alarm, oba ranged útoky, LOS, melee, obě loot identity a save/reload bez browser/app/WebGL chyb. Screenshoty `lookout-ranged.png` a `firearm-guard.png` jsou ignorované a vizuálně zkontrolované.
- Starší validace před lookout/guard/armor checkpointy: `npm test` **250/250 PASS, 35 souborů**; `npm run build` PASS (stávající cca 3.21 MB JS chunk warning); `git diff --check` PASS.

## Git a validace

- Repo: `/Users/romansvora/Documents/Tideland`; `origin` je canonical `https://github.com/rsvora-bit/RUST---clon.git`.
- Branch: `codex/combat-endgame-next`, z `origin/main` v0.9.2 (`ecc3197e7ac4eaa02bd37b3b4b341a776a296e93`); `main` ani vydaný release nebyly změněny. Poslední pushnutý checkpoint `810db6e Add powered Homestead security alarm` je na `origin/codex/combat-endgame-next`; navazující regresní fix a rozšíření persistence QA jsou právě připraveny pro samostatný commit.
- Předchozí lokální/pushnuté checkpointy zahrnují `1906803 Add persistent storm salvage event` a `1e7cf99 Coordinate nearby POI scavenger alerts`; ověř aktuální `origin/codex/combat-endgame-next` před případným pushnutím, žádný force push.
- Nejnovější `npm test`: **264/264 PASS**, 37 test souborů; `git diff --check`: PASS.
- Nejnovější `npm run build`: **PASS**; známé Vite upozornění na přibližně 3.22 MB JavaScript chunk. `test:world-events` v Chrome/SwiftShader — **PASS**: bouře → cache na pobřeží → mapa/marker → recover → 15min cooldown uložený v save → reload → druhá bouře → nová pobřežní cache → druhý save/reload bez duplikace. Headless QA potřebovalo reload po programatickém vyzvednutí před druhou bouří; následný druhý cyklus a persistence prošly. Žádné browser/WebGL konzolové chyby. Screenshot `test-results/world-events/washed-ashore-map.png` je ignorovaný.
- `test:hazard`, `test:combat`, `test:death`, `test:scavenger`, `test:door-lock` z předchozích ověřených checkpointů zůstávají platné. Práce na dalších cílech není dokončena.

## Další krok

- Další krok: commitnout a normálně pushnout ověřený base-security slice pouze na pracovní branch (bez PR/release), potom pokračovat v plném cíli — hlubší combat feel/balanc (Goal 1), víceútočníková AI a nebezpečí (Goal 2), raid/base security/electricity (Goal 3), další originální POI/endgame progression (Goal 4), a nakonec performance a úplná regression QA (Goal 5). Žádný Goal není kompletní.
- Předchozí lokální dev servery byly korektně ukončeny; poslední browser QA použilo izolovaný server na portu 5176. V dalším běhu spusť nový Vite server podle potřeby.
- Nepublikovat release ani nezapisovat `main` automaticky. GitHub Pages workflow publikuje pouze `main` a version tagy, proto samotný branch push nevytvoří veřejný Playable Pages preview. Aktuální veřejná Pages adresa zůstává vydaná v0.9.2. `gh` CLI není v tomto prostředí instalované.

---

# Historický checkpoint — 2026-09-30

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
4. Luk/projektily a střelné zbraně/náboje — **IN PROGRESS** (luk, draw strength, balistický šíp, firearm/reload/ammunition tiers, projectile death QA a firearm door breach runtime PASS; plné balancování a regression coverage zbývají).
5. Damage/death integration — **IN PROGRESS** (typed player hits, wildlife melee/projectile, ranged human attacks a fatal projectile → Lost Pack/save/respawn browser flow ověřeny; širší regression QA zbývá).
6. Armor/equipment — **IN PROGRESS** (oblečení/durability/temperature, salvage vest a craftitelný Workbench III Quarry Plate; mitigation, repair, UI a save/reload ověřeny; širší balance/QA zbývá).
7. Durability/repair — **COMPLETE** (volitelné `ItemStack.condition`, trvanlivost rock/hatchet/pickaxe/hammer/bow/spear, gathering/combat degradation, break, condition UI a materiálová oprava u Workbench 1; unit a browser UI/save-reload QA PASS, commit `e72b57c` plus QA `3f0286f`).
8. Wildlife — **COMPLETE for first hostile fauna slice** (seeded wolf/boar population, close-range AI LOD, melee interaction, persistent health/death, meat/hide rewards). Passive species/advanced behavior NOT STARTED.
9. Hostile human AI — **IN PROGRESS** (Gen5 POI melee scavenger, ranged lookout a firearm guard; LOS, suspicion, noise, search, retreat/return a persistentní smrt fungují; další role, raiding AI a širší balancing zbývají).
10. Loot tiers — částečně existují; rozšíření NOT STARTED.
11. Přístup do high-tier POI — **COMPLETE for first loop** (Scavenger access card odemyká sealed cache; stráže, industrial loot a smrt se ukládají).
12. Base ownership/locks — **COMPLETE for first single-player slice** (Homestead beacon vlastní oblast a auto-lockuje dveře; dveře mají persistentní lock a lze je prorazit zbraněmi za cenu munice).
13. Electricity — **COMPLETE for compact persistent loop** (generator → switch → lamp, fuel timer, range checks a Chrome save/reload QA).
14. Balancing — **IN PROGRESS** (armor tradeoff, projectile mitigation a door-grade resistance; širší náročnost a economy vyvážit).
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

## Salvage revolver checkpoint — 2026-10-01

- Přidána první datově řízená střelná zbraň `salvageRevolver`: šestiranný zásobník, `pistolAmmo`, Workbench II + research `advancedFabrication`, hitscan s omezeným dosahem a rozptylem, fire interval, recoil, procedurální zvuk, zobrazená munice, R reload, opotřebení a opravitelnost. Není to full-auto zbraň; každý výstřel je samostatný trigger.
- Zásobník je volitelné `ItemStack.loadedAmmo`, takže staré save objekty bez této hodnoty zůstávají validní. Validator přijímá zásobník jen u revolveru a v rozsahu 0–6. Výstřel poškozuje wildlife/scavengery přes existující `Damageable`; raycast kontroluje terén, stavby a node geometrii před cílem. Ammo a condition se ukládají; reload progress je dočasný a při změně slotu se ruší bez ztráty nábojů.
- Revolver dostal originální lokální SVG ikonu, procedurální first-person model a zvuk. Browser screenshot kontroloval viewmodel; zároveň byl scavenger model upraven z velkých kvádrů na sdílenou sloučenou capsule/sphere výbavu. Interaction prompt při luku/zbrani říká `SHOOT`.
- Přidán `src/combat/firearms.ts`, `tests/firearms.test.ts`, `scripts/firearm-qa.mjs`, `npm run test:firearm`, recepty přes Advanced Fabrication, `pistolAmmo`/`salvageRevolver` definice a ikony. Rozšířeny save validator, durability/repair a `GameApp` firing/reload flow.
- Browser/Chrome Metal PASS: přes hotbar bridge vybaví zbraň, viditelný revolver trefí mířeného scavengera (-34 HP), shot opotřebuje zbraň o 1, R doplní chybějící cartridge po reload době, loaded ammo/condition/reserve/wounded scavenger přežijí reload save; viewmodel se obnoví; žádné app/WebGL chyby. Pak `test:combat` a `test:ranged` PASS.
- Aktuální úplné kontroly: `npm test` **229/229 PASS, 34 souborů**; `npm run build` PASS se stávajícím ~3.19 MB bundle warningem; `git diff --check` PASS. `test:combat` a `test:ranged` browser QA PASS po implementaci. Předchozí běh `test:firearm` v Chrome/Metal PASS včetně zásahu, reloadu a save/reload. Opakování nyní v obnoveném prostředí nedoběhlo: Playwright Chromium není nainstalovaný (`chrome-headless-shell` chybí), běh skončil ještě před startem browseru.
- Zatím není dokončen: požární balanc/long-range tuning, střelba do statických world collider edge cases mimo QA scénu, druhý typ munice/střelné zbraně, NPC ranged archetype. Dále ještě zbývá high-tier access progression/containers, major POI upgrade, base ownership foundation, full regression QA. Žádný version bump.
- Změněné soubory od předchozího commit checkpointu: `package.json`, `src/app/GameApp.ts`, `src/audio/AudioMixer.ts`, `src/combat/durability.ts`, `src/combat/firearms.ts`, `src/combat/wildlife.ts`, `src/core/types.ts`, `src/crafting/recipes.ts`, `src/crafting/techTree.ts`, `src/items/definitions.ts`, `src/rendering/HeldItem.ts`, `src/save/storage.ts`, `src/simulation/GameSimulation.ts`, `src/ui/UI.ts`, `tests/firearms.test.ts`, `scripts/firearm-qa.mjs`, `public/assets/icons/{pistolAmmo,salvageRevolver}.svg`.
- Branch `codex/world-quality-next`. Před tímto checkpointem HEAD `e81e0ef Record final world performance QA`; změny jsou stále lokální a necommitnuté. Neprovádět push/PR/release/tag; origin divergence nebyla řešena. Verze zůstává `0.9.1 / EA-09.1`.
- Přiložený běhový screenshot: ignored `test-results/firearm/firearm-equipped.png`; výsledky: `test-results/firearm/results.json`.

## Access-card POI progression checkpoint — 2026-10-01

- Nové Gen5 světy nyní dostávají dvě deterministické high-tier sealed salvage cases u relay/quarry POI. Otevření vyžaduje `relayAccessCard`, kterou garantovaně dává poražený scavenger. Case obsahuje lucky salvage loot; unlock i inventory jsou součástí běžného station save datového modelu.
- Přidán `secureCache` station kind, vizuálně odlišený kovový case, interakční stav LOCKED/UNLOCK a nová ikona/karta. `locked` je volitelné persistentní pole validované pouze pro secure cache, takže staré save objekty/cache zůstávají kompatibilní.
- Změna se aplikuje pouze při první loot bootstrap fázi nového Generation 5 světa. Generation 1–4 ani existující Gen5 save s `lootGenerated` nezmění POI, inventář ani world layout.
- Browser `test:scavenger` PASS: porážka, scrap/wiring/access card reward, sealed-case lock prompt, spotřebování karty, otevření obsazené cache a unlocked state po save/reload; 0 browser/WebGL errors. `test:firearm` znovu PASS v nativním Chrome/Metal včetně magazine save/reload.
- Unit test `npm test`: **230/230 PASS, 34 souborů**. `npm run build` PASS; stávající ~3.19 MB JS chunk warning zůstává. Cílený station/wildlife test 53/53 PASS; `git diff --check` PASS.
- Změněné soubory: `src/core/types.ts`, `src/items/definitions.ts`, `src/survival/stations.ts`, `src/survival/WorldSurvival.ts`, `src/survival/StationRenderer.ts`, `src/app/GameApp.ts`, `tests/salvage-recycler.test.ts`, `scripts/scavenger-qa.mjs`, `public/assets/icons/relayAccessCard.svg` a tento checkpoint.
- Pracovní větev `codex/world-quality-next`; žádný push, PR, tag, release ani version bump. Následující krok: checkpoint commit, pak pokračovat další nedokončenou progresní/world oblastí.

## Alpine cold survival checkpoint — 2026-10-01

- Přidána druhá Generation-5 hazard expozice: alpine cold se počítá z existujícího climate temperature, denního světla a saved weather kind. Je omezena na Generation 5 revision 3; layout ani save schema se nemění.
- V runtime hazard zobrazuje jedno varování při vstupu, aplikuje časově akumulovaný cold damage přes stávající damage resolver a equipment mitigation a hlásí návrat do bezpečnějších podmínek. Warm jacket/boots/hood tak mají praktickou ochrannou funkci.
- `test:hazard` v Chrome/Metal PASS: toxický relay i noční alpine storm zobrazí warning a snižují health, bez browser/WebGL errors. Unit subset hazards/equipment/damage 11/11 PASS; celá `npm test` sada **231/231 PASS, 34 souborů**; `npm run build` PASS se stávajícím ~3.19 MB chunk warningem; `git diff --check` PASS.
- Změněné soubory: `src/survival/hazards.ts`, `src/app/GameApp.ts`, `tests/hazards.test.ts`, `scripts/hazard-qa.mjs` a tento checkpoint.
- Aktuální pracovní změna je lokální a připravená na checkpoint commit. Žádný push/PR/tag/release/version bump. Pokračovat přes další cíle v aktivním Combat, Danger & Progression goal.

## Homestead ownership checkpoint — 2026-10-01

- Přidán craftitelný `homesteadCore` / Homestead Beacon (Workbench II + Advanced Fabrication), originální ikona a vlastní low-cost world model. Na jednom světě lze postavit jeden beacon.
- Beacon definuje deterministický radius 42 m. Panel uvádí počet struktur a zajištěných dveří; při umístění se zavřou/uzamknou stávající dveře v zóně a nové dveře uvnitř zóny se automaticky zamknou. Stávající hammer UI dál dovoluje dveře odemknout.
- Claim je odvozený z persistentní stanice a souřadnic; nepřibyl world generator ani save schema. Unit coverage ověřuje hranici zóny a validitu starého station modelu. Browser `test:door-lock` PASS: lock/unlock, beacon claim, uzamčení existující dveře, oba stavy po save/reload, bez console/WebGL chyb.
- Unit test `npm test`: **232/232 PASS, 34 souborů**. `npm run build` PASS se stávajícím ~3.20 MB chunk warningem; `git diff --check` PASS.
- Změněné soubory: `src/core/types.ts`, `src/items/definitions.ts`, `src/crafting/recipes.ts`, `src/survival/stations.ts`, `src/survival/StationRenderer.ts`, `src/survival/StationUI.ts`, `src/app/GameApp.ts`, `tests/salvage-recycler.test.ts`, `scripts/door-lock-qa.mjs`, `public/assets/icons/homesteadCore.svg` a tento checkpoint.
- Stále bez push/PR/tag/release/version bump. Další cíle z dlouhé relace a kompletní regression/browser pass zbývají.

## Combat, Danger & Progression — final local validation — 2026-10-01

- Povinné položky Goal byly znovu porovnány se zadáním: final world-art/performance QA, player damage/death/Lost Pack, melee, bow/arrows, salvage revolver/ammo/reload/crafting, durability/repair, equipment/clothing, wildlife + Gen5 scavengers, toxin + alpine cold, tiered salvage/access progression, dvě guarded high-tier POI (relay a quarry), homestead ownership/locks a persistent generator→switch→lamp jsou implementované a runtime ověřené.
- Rozšířen `test:scavenger` o kontrolu, že oba relay/quarry POI mají zároveň strážce i sealed cache; kompletní přístupová smyčka card→unlock→loot→save/reload PASS. QA pořizuje i UI screenshot otevřené cache.
- Rozšířen `test:door-lock` o vizuální kontrolu Homestead panelu a save/reload claimu. Vizuální screenshot potvrdil, že přehled `42 m · 3 structures · 1 secured doors` je čitelný přímo pod nadpisem.
- Kompletní browser/regression pass na nativním Chrome s ANGLE Metal: `test:death`, `test:salvage`, přímé `node scripts/tech-tree-qa.mjs`, `test:power`, `test:combat`, `test:ranged`, `test:browser`, `test:firearm`, `test:scavenger`, `test:hazard`, `test:door-lock`; všechny úspěšné. `test:browser` jednou vrátil chybný exit při plném QA outputu i přes zelené assertiony/čistou konzoli; bez změny kódu opakování skončilo kódem 0.
- `package.json` nemá `test:tech-tree` alias, ale existující `scripts/tech-tree-qa.mjs` spuštěný přímo prošel. Prostředí nemělo Playwright Chromium shell; všechny relevantní browser testy byly spuštěny proti nainstalovanému Chrome přes `CHROME_BIN`, bez potřeby stahovat browser.
- Finální `npm test`: **232/232 PASS, 34 souborů**. Finální `npm run build`: PASS; přetrvává Vite upozornění na ~3.20 MB JS chunk. Žádné browser/WebGL/console chyby; world-art/performance Metal porovnání je výše v tomto checkpointu.
- Po tomto zápisu vytvořit lokální QA checkpoint commit, ověřit čistý working tree a aktualizovat Codex Goal na COMPLETE. Větev `codex/world-quality-next`; záměrně bez push, PR, tag, release a version bump. Verze zůstává `0.9.1 / EA-09.1`, `main` nezměněn.

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
