# AKTUÁLNÍ CHECKPOINT — 2026-09-30

Tento oddíl je aktuální; níže ponechaný checkpoint z 2026-09-13 je historický a popisuje starou větev v0.8.0.

## Git

- Repository: `/Users/romansvora/Documents/Tideland`; canonical origin `https://github.com/rsvora-bit/RUST---clon.git`.
- Pracovní branch: `codex/world-quality-next`.
- Aktuální HEAD: `3e7d613c07f86551f363cf3508355b6830177bf8` (`Improve moonlit world readability`).
- `origin/main`: `19cd35b2a52f6d7929afc1e0bf64b8db322766b4`; main nebyl změněn. Neproběhl push, PR, tag ani merge.
- Poslední ověření: čistý working tree, `git diff` prázdný.

## Dokončeno v této větvi

- World rendering a environment polish: terrain blending/ridges, forest density, pine readability, moonlit fill, water/shoreline, irregular distant mountain layers, relay skyline landmark a instanced tree culling/compaction.
- Generation 5 vegetation je seed-stabilní; 68 000 instanced grass tufts, z toho 15 000 soustředěno v okolí spawnu (72×72 m). Další culling/quality tiers zůstávají aktivní. Nový test QA vyžaduje nejméně 68 000 instancí a pořizuje screenshot spawn understory.
- POI cache mají odlišné loot tendence; save/reload zachovává staré stavy.
- Opraveny pomalé headless-browser timingy v `scripts/polish-qa.mjs`; assertions pro gameplay a fyzické kolize zůstaly zachované.
- Nedávné commity: `c377ff4` timing QA, `669e759` lokální grass cover, `3e7d613` noční ambient fill.

## Validace posledního stavu

- `npm test`: 189/189 prošlo (25 souborů).
- `npm run build`: prošel; zůstává existující Vite upozornění na JS chunk větší než 500 kB.
- `npm run test:browser`: 71 kontrol prošlo, žádné aplikační console errors; ověřeno také movement, gathering, inventory, crafting, stavba, save/load, 18 podlahových colliderů, dveře a LOW/MEDIUM/HIGH.
- `npm run test:world-art` přes explicitní systémový Chrome: 31 kontrol prošlo, žádné console errors; kompatibilita archivovaných saveů v0.9.0 a v0.9.1 potvrzena. Plný běh proběhl při grass count 72k; aktuální 68k se liší jen celkovým limitem, 15k lokální skupina zůstala stejná. Aktuální screenshot z custom lokálního browser probe ověřil přesně 68k a novou noční intenzitu.
- Performance probe na SwiftShaderu je výrazně variabilní: dvě baseline v0.9.0 měly 1.56 a 1.78 FPS. Při 72k aktuální běh ukázal 606 draw calls a 2.858M triangles oproti baseline 612 a 3.390M; FPS z těchto běhů nelze použít jako spolehlivý přímý závěr. Snížením na 68k se omezil nejistý dopad. Pro reálné GPU je třeba zopakovat nativní srovnání.
- Screenshoty a JSON jsou v ignorované `test-results/`; necommitovat.

## První kroky při pokračování

1. Zkontrolovat `git status`, branch, HEAD, `git diff`; pracovní větev má zůstat `codex/world-quality-next`.
2. Pokračovat world-art QA na přesně 68k/novém moonlight fill (pro `test:world-art` nastavit `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`); pak prověřit zbývající vizuální priority a případně gameplay progression.
3. Průběžně zachovat malé logické commity. Nezvyšovat verzi, netagovat ani nemergovat, dokud celý zvolený rozsah není validovaný.

**INCOMPLETE.** Tato práce není hotový release. Nezačínat znovu od začátku a nezaměňovat historický oddíl níže za současný stav.

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
