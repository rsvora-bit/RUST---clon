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
