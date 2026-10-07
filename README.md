<div align="center">

# 🌊 TIDELAND

### Procedural first-person island survival — built for the browser

**Explore. Gather. Build. Survive.**

[![Version](https://img.shields.io/badge/version-v0.14.1%20%7C%20EA--14.1-2ea44f?style=for-the-badge)](./CHANGELOG.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Tideland CI](https://github.com/rsvora-bit/RUST---clon/actions/workflows/tideland-ci.yml/badge.svg)](https://github.com/rsvora-bit/RUST---clon/actions/workflows/tideland-ci.yml)

**Current release:** `v0.14.1 / EA-14.1` · **8 October 2026**

> Active development repository. All new Tideland development continues here.

</div>

---

## 🎮 Play Tideland

### Latest build

[▶ PLAY LATEST](https://rsvora-bit.github.io/RUST---clon/)

### Version archive

[🕘 VIEW ALL RELEASES](https://rsvora-bit.github.io/RUST---clon/versions/)

Latest stable: [▶ PLAY LATEST](https://rsvora-bit.github.io/RUST---clon/)

Every tagged release is preserved as a separately playable build. See the repository [Releases](https://github.com/rsvora-bit/RUST---clon/releases) for release notes and direct play links.

---

## 🏝️ What is Tideland?

**Tideland** is an original procedural first-person survival sandbox running directly in a web browser. The world is generated at runtime and combines exploration, resource gathering, crafting, building, survival systems, weather, persistence and first-person interaction into one continuously evolving project.

The game is built with **TypeScript**, **Three.js**, **Rapier 3D** and **Vite**, while the interface is rendered with a custom DOM-based UI.

Tideland started as an experiment in building a Rust-inspired survival loop for the web, but the goal is not to reproduce Rust feature-for-feature. The project is gradually developing its **own world generation, visual identity, systems and gameplay direction**.

---

## 🎯 Why this project exists

Tideland is both a game and a long-term development project. It is used to experiment with browser game architecture, procedural generation, rendering, physics, performance, UI, gameplay systems and automated testing while continuously turning those experiments into a playable survival game.

The main idea is simple:

> **Build a survival game that feels increasingly like a real standalone game — not just a technical demo running in Three.js.**

---

## 🧭 Project direction

| We want | We do not want |
| --- | --- |
| A coherent survival sandbox | A collection of disconnected tech demos |
| Stable first-person controls | Camera or input behaviour that changes randomly between devices |
| A world worth exploring | Empty procedural terrain with repeated props |
| Strong atmosphere and readable visuals | Graphics that destroy performance for no gameplay benefit |
| Meaningful gathering, crafting and building | Hundreds of systems with no depth |
| Smooth browser performance | Startup stutter hidden inside normal gameplay |
| Clear update history and versioning | Large undocumented changes |
| Automated tests for important systems | Shipping changes without validation |

---

## ⚙️ Current gameplay systems

### 🌍 World
- Generation-5 1664-m procedural archipelago with irregular coasts, satellite islands, ridges, valleys and a safe starter shore
- Regional temperate forest, grassland, arid, alpine, rocky-mountain and coastal biomes
- Terrain-following roads connecting established POIs
- Cached topographic island map with hillshade, biome colors, grid coordinates, pan/zoom and persistent markers
- Biome-aware forests, palms, alpine conifers, grass, rocks, resources and coastal detail
- Day/night progression and atmosphere
- Dynamic rain, fog and storms
- Distance culling and quality settings

### 🪓 Survival & interaction
- Harvestable trees, stone, metal ore, sulfur ore, high-quality metal ore, fiber and berries
- Hunger, thirst, stamina and health
- Tools and resource-specific gathering
- Dropped items and world persistence
- Falling-tree depletion animation when a tree is fully harvested

### 🧱 Building & progression
- Building plan with placeable structures
- Placement validation and collision checks
- Persistent foundations, walls, doorways, floors, roofs and hinged doors
- Wood, Stone and Metal grades with durability, upgrades and proportional repair costs
- Builder's Hammer with structure HUD, one-second hold demolition and safe door-hinge rotation
- Workbench progression and crafting requirements
- Survival stations and station upgrades
- Persistent Homestead ownership, authorized doors and a structure overview
- Tool durability and workbench repair, field clothing and alpine cold exposure
- Melee, recoverable bow projectiles, research-gated salvage revolver and ammunition crafting
- Hostile scavengers and a dangerous access-card relay cache with location-specific salvage

### 🎒 Player & UI
- Inventory and quick belt
- Crafting queue
- First-person hands with animated held tools, equip transitions, sway, sprint pose and inspect
- Tuned acceleration/deceleration, air control, crouch transitions, landing response and height-scaled fall damage
- Configurable FOV and viewmodel FOV
- Frame-rate independent mouse look, separate X/Y sensitivity, auto-run, invert Y and head bob settings
- Speed- and surface-aware footsteps
- Five local save slots with per-slot load/delete management
- HUD scale/opacity, crosshair size, FPS counter and tutorial visibility settings
- Render scale, brightness, V-Sync/frame pacing, shadows, compass and crosshair settings
- Map, waypoints, diagnostics and developer telemetry with fly/god/vitals controls

### 💾 Persistence
The browser locally persists world generation, settings, inventory, crafting, research, structure grades/health, doors, stations, drops, depleted resource nodes and survival progression. Historical generation 1–4 worlds continue on their original 720-m terrain. Generation-5 save revisions keep their own deterministic layout: v0.9.0 saves without `worldRevision` remain revision 1, v0.9.1 revision-2 saves keep their roads and resources, and v0.10.0+ worlds use the 1664-m revision-6 archipelago. Loading a save does not reset its terrain, player, inventory, structures, stations, research or Lost Packs.

---

## 🚀 Current release

**v0.14.1 / EA-14.1 — Physical World & Foliage Stabilization** hardens collision proxies against visual LOD changes and verifies all sides of the three major boulder models in live browser movement. Generated trees retain their authored bark/foliage material groups through batching, while grass silhouettes gain variation at the same geometry budget. Existing save layouts and world identities are unchanged.

### v0.14.1 validation and save compatibility

No save schema or generation identity changed. The follow-up retains existing world, player, structures, stations, inventory, research, resources and Lost Packs. Full unit tests pass (537 tests across 57 files); production build and screenshot-free Chrome/Metal world-art/save, collision, tree-culling and Testing Mode QA pass without app/WebGL errors. Matched Chrome/Metal HIGH at 1280×720, seed 731942 and 240 frames measured v0.14.0 → v0.14.1 at **195.99 → 198.27 FPS** (**5.102 → 5.044 ms**), **464 → 451 draw calls**, **3,047,769 → 3,063,669 triangles** and **2,033 → 2,033 nodes**. This is a relative measurement on the same hardware/browser configuration, not a cross-device guarantee.

**v0.14.0 / EA-14.0 — Visual Fidelity & Physical World Overhaul** improves shared PBR surface detail for wood, metal, rock and terrain; adds slope-aware terrain detail, weathered outcrops and climate-aware ground decals; refines instanced trees and wind; improves underwater readability and distant mountain depth; and makes wet surfaces dry gradually. Major world collision proxies are more closely aligned with visual models, and F3 now exposes physical bounds, grounding contacts, nearby asset identity and active LOD. Active generators receive restrained, batched exhaust and smoke feedback.

### v0.14.0 validation and save compatibility

No save schema or generation identity changed. Generation 1–4 saves retain their legacy generators; archived v0.9.0 and v0.9.1 Generation 5 saves retain their revision, player position, inventory, structures, drops, resource state, stations, research, roads and POIs. Visual asset and proxy updates do not rewrite saved world layout or gameplay identity.

Validation: `npm test` **530/530 passed in 56 files** and `npm run build` passed. Screenshot-free Chrome/Metal browser QA passed movement, gathering, inventory/crafting, multi-level building/colliders, settings, Recycler/furnace, death/Lost Pack, world generation/map/weather, Testing Mode physical overlays and teleport, and world-art/save checks; the probes reported no app/WebGL errors. Asset verification passed **31 GLBs and 31 collision-proxy sidecars**, with LOD0/1/2 and every GLB below 512 KiB. On matched Chrome/Metal HIGH, 1280×900, seed 731942, viewpoint `(0,0)`, 240 frames, v0.13.0 archive → v0.14.0 candidate measured **250.90 → 234.91 FPS** (**3.986 → 4.257 ms**, +6.8% frame time), **262 → 266 draw calls**, and **2,360,569 → 2,032,361 triangles** (−13.9%). The candidate stayed within the 10–15% runtime performance regression target. Menu-ready time was **3.34 → 4.47 s**, while prepared New Game startup was **170 → 71 ms**; shader precompile exceeded its advisory threshold on the candidate, but both runs reached Ready and had zero browser errors. Build output retains the known Vite advisory for a ~3.50 MB main JavaScript chunk.

### v0.13.0 validation and save compatibility

No save schema or generation identity changed. Generation 1–4 saves retain their legacy worlds; archived v0.9.0 and v0.9.1 Generation 5 saves retain their revision, player position, inventory, structures, drops, resource state, stations, research, roads and POIs.

Validation: `npm test` **502/502 passed in 53 files** and `npm run build` passed. Screenshot-free browser QA passed movement, gathering, inventory/crafting, multi-level building and colliders, doors, settings, Recycler/furnace, death/Lost Pack, storm-salvage events, archived Generation 5 saves and world-art/weather checks without app or WebGL errors. Against archived v0.12.0 at 1280×900, HIGH, seed 731942, 240 SwiftShader frames measured telemetry **11.44 → 11.45 FPS**, **87.406 → 87.346 ms**, **472 → 472 draw calls**, and **3,182,461 → 3,182,165 triangles**. This is a relative headless stability check, not an absolute hardware benchmark.

## 🗺️ Development direction

Continue improving world readability, biome transitions and visual stability across real hardware and weather states. Deepen exploration rewards and survival progression around existing POIs, equipment, salvage and workbenches while preserving existing saves and controls. The roadmap stays flexible and prioritizes changes that strengthen Tideland’s coastal survival identity.

---

## 🕹️ Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Shift` | Sprint |
| `Space` | Jump |
| `Ctrl` | Crouch |
| `Caps Lock` | Auto-run |
| `X` | Inspect held item |
| `E` | Interact |
| Left click | Gather / use / place |
| `1–6` | Select quick-belt slot |
| `Tab` | Inventory & crafting |
| `B` | Building plan |
| `Q` | Cycle building piece |
| `R` | Rotate building piece |
| Right click | Cancel building placement / open Hammer menu while aiming at a structure |
| Builder's Hammer + `RMB` | Upgrade, repair, rotate or hold-demolish a structure |
| `Esc` | Pause |
| `F3` | Developer telemetry |

> Keyboard actions, including **Auto-run** and **Inspect**, can be remapped in **Settings → Controls**.

---

## 🧰 Technology

```text
TypeScript
├── Three.js       → WebGL rendering and scene management
├── Rapier 3D      → physics and collision
├── Vite           → development server and production build
├── Vitest         → unit/integration validation
└── Playwright     → browser gameplay QA
```

The project intentionally stays close to the underlying browser and rendering stack instead of using a large game engine. This keeps the architecture visible and makes rendering, input, simulation and performance systems directly controllable.

---

## 📦 Run locally

Requirements: a current Node.js installation and npm.

```bash
npm install
npm run dev
```

Production validation:

```bash
npm test
npm run build
```

Browser gameplay QA:

```bash
npm run test:browser
```

Regenerate the original procedural Blender-rendered inventory icons:

```bash
npm run icons:render
```

This runs Blender in background mode and writes the catalogued transparent WebP assets to `public/assets/items/`. Blender must be installed locally; when it is not on `PATH`, set `BLENDER_BIN` to its executable. The renderer uses only project-authored geometry and materials.

Generate the original modular environment models and validate them with:

```bash
npm run assets:world
npm run test:assets:world
```

The headless Blender exporter in `tools/world-assets/` builds source-authored trees, rocks, shoreline props and POI assets as compact GLBs with LOD0/1/2 meshes and one shared material set per model. It emits meter-based collision-proxy hints alongside the GLBs; live gameplay colliders remain managed by the existing world and physics systems. Export rules, LOD selection and budgets are documented in [`tools/world-assets/README.md`](tools/world-assets/README.md). No external asset pack is required.

World rendering batches repeated tree, grass, rock and shoreline assets with instancing, distance culling and graphics-tier LOD/density choices. Save data continues to store procedural world identity and gameplay nodes rather than these visual meshes, so asset refinements preserve existing save layouts.

For browser content checks, `npm run test:testing-mode` opens an isolated developer sandbox for items, building, weather and combat QA. Testing Mode displays a save lock and rejects writes to normal browser saves.

---

## 🧪 Development workflow

Changes should remain playable and validated before being treated as a finished update.

```text
feature / fix
     ↓
local or branch validation
     ↓
unit tests + production build
     ↓
merge to main
     ↓
GitHub Actions CI
     ↓
GitHub Pages test build
```

The repository includes automated GitHub Actions CI so important regressions are visible immediately after changes reach GitHub.

---

## 📜 Release history

| Version | Focus |
| --- | --- |
| `v0.14.1` | Stable cross-LOD collision, live boulder side checks, correct batched tree foliage materials and varied grass silhouettes |
| `v0.14.0` | Physical collision proxies and F3 world debugging, detailed weathered materials, terrain/rock/vegetation polish, gradual wetness, station exhaust and mountain atmosphere |
| `v0.13.0` | Surface-anchored gathering, supported vertical building, selectable menu scenes, F3 workflow groups, active station feedback and living-world polish |
| `v0.12.0` | Blender world-asset pipeline, refined item icons, environment LODs, wet weather, readable HUD and save-locked Testing Mode |
| `v0.11.0` | Original item-icon pipeline, cohesive responsive interface, EN/CZ research, station and map localization |
| `v0.10.0` | World Revision 6, expanded archipelago, forests, marsh, terrain, atmosphere and landmark polish |
| `v0.9.3` | Combat and armor progression, raiding/security, relay and storm events, Breakwater wreck and campfire cooking |
| `v0.9.2` | Forest and terrain polish, combat, equipment, hostile scavengers, relay cache progression and Homestead ownership |
| `v0.9.1` | Terrain-aware roads, climate-correct vegetation, continuous biome bands, distant massifs and save-safe stabilization |
| `v0.9.0` | World generation 5, regional biomes, roads, topographic map, atmosphere and fall damage |
| `v0.8.0` | Persistent Tech Tree research, Scrap progression and Workbench II–III recipe unlocks |
| `v0.7.9` | Scrap, salvage components, tiered component loot and persistent world Recyclers |
| `v0.7.8` | Death, respawn, persistent Lost Packs and Sleeping Roll recovery loop |
| `v0.7.7` | Building grades, durability and Builder's Hammer maintenance loop |
| `v0.7.6` | Loot-cache cleanup and harvesting interaction fixes |
| `v0.7.5` | Expanded generation-4 island, resource HUD and procedural horizon |
| `v0.7.4` | Seeded world variety, salvage loot and developer tools |
| `v0.7.3` | Save-dialog reliability, V-Sync/frame pacing, gathering FX and resource-density polish |
| `v0.7.2` | Settings navigation and configurable performance telemetry |
| `v0.7.1` | Save/UI reliability, pause-menu polish and expanded graphics controls |
| `v0.6.0` | Environment rendering, water, vegetation, atmosphere and scalable post FX |
| `v0.5.0` | Gathering weak spots, per-tool yields, particles and tree-fall audio |
| `v0.4.0` | Movement feel, first-person hands and tool animations |
| `v0.3.0` | Game menus, settings, remappable controls and EN/CZ localization |
| `v0.2.4` | Survival HUD overhaul |
| `v0.2.3` | Detailed loading, GPU warm-up and falling trees |
| `v0.2.2` | Mouse input stability and loading warm-up |
| `v0.2.1` | Cross-device camera and expanded settings |
| `v0.2.0` | Local/GitHub reconciliation, building and survival polish |
| `v0.1.0` | Initial early-access survival foundation |

Full release notes are maintained in **[CHANGELOG.md](./CHANGELOG.md)** and are also available from the in-game **HISTORY** menu.

Implementation and QA notes are stored in **[POLISH-STATUS.md](./POLISH-STATUS.md)**.

---

## 🏫 Repository history

Tideland was previously developed inside a larger school programming repository. That copy is intentionally kept as a stable historical snapshot:

**[rsvora-bit/it3b_prog_/Projekty/Tideland](https://github.com/rsvora-bit/it3b_prog_/tree/main/Projekty/Tideland)**

Starting with `v0.2.3`, **this repository is the canonical source for all new Tideland development**.

---

## 🌱 Development philosophy

Tideland is still early in development. Systems may be redesigned when there is a clear gameplay, stability or performance reason to do so.

Priorities are:

1. **Controls must feel correct.**
2. **The game must remain performant.**
3. **New systems should have a purpose.**
4. **Visual improvements should strengthen atmosphere without destroying FPS.**
5. **Major changes should be testable, documented and reversible.**

---

<div align="center">

### TIDELAND

*An island survival project growing one system at a time.*

`EARLY ACCESS DEVELOPMENT · v0.14.1 / EA-14.1`

</div>

### v0.12.0 validation and compatibility

World-generation identity and save schema are unchanged. Generation 1–4 keep their legacy generators; historical Generation 5 revisions retain their original terrain, roads, POIs, resource identities and player/world state. New visual assets are runtime representations and collision-proxy sidecars are authoring hints; live gameplay colliders remain owned by the existing world and physics systems. Testing Mode rejects save writes and does not alter ordinary browser saves.

Validation: `npm test` **496/496 passed in 53 files** and `npm run build` passed. Screenshot-free browser QA passed world-art **82/82**, Testing Mode **12/12**, menu/Settings, gameplay construction and inventory, and Recycler/Lost Pack regression checks without browser errors. The Blender pipeline generated **53 icons** (472,310 bytes) and verified **31 world GLBs plus 31 collision proxies**. Matched Chrome/Metal HIGH performance against archived v0.11.0 measured **216.53 → 217.70 FPS**, **4.618 → 4.593 ms/frame**, **437 → 463 draw calls** and **3,553,774 → 3,134,585 triangles** at 1280×900, seed 731942 and 240 sampled frames; both runs reported no browser errors.

### v0.11.0 validation and compatibility

This is a presentation and localization update. It does not change world generation, gameplay state, or the save schema. Existing saves continue to use the same item IDs and persistence paths.

Validation: `npm test` **481/481 passed in 49 files** and `npm run build` passed. A 1280×720 browser smoke test verified visible inventory icons, short-viewport panel bounds and scrolling, Czech map/station/Tech Tree copy, and no browser console errors. Icon generation is documented under the repository tooling and uses original procedural Blender scenes.

### v0.10.0 validation and save compatibility

Generation 1–4 saves retain their legacy generators. Existing Generation 5 saves keep their stored world revision, player state, structures, stations, inventory, progression and Lost Packs; the Revision 6 geography is used for new Revision 6 worlds. No save schema replacement is required.

Validation: `npm test` **478/478 passed in 48 files** and `npm run build` passed. Browser probes covered Revision 6 world generation and legacy saves, world art, combat, Tech Tree, death/respawn, salvage, hazards, door security, raids, wildlife, events, ranged weapons and cooking. Matched Chrome/Metal M5 HIGH uncapped view: v0.9.0 **271.28 FPS / 3.686 ms / 386 draw calls / 3.35M triangles**; Revision 6 **226.67–232.25 FPS / 4.31–4.41 ms / 271 draw calls / 3.48M triangles**. This measured scene remains approximately 14–16% lower in FPS; compare hardware/view details in [RESUME-CHECKPOINT.md](./RESUME-CHECKPOINT.md).

### v0.9.3 validation and save compatibility

Generation 1–4 saves retain their legacy generators. Existing Generation 5 saves retain their saved revision, player state, structures, stations, inventory, progression and Lost Packs; the coastal wreck and other new placements use deterministic IDs and existing persistence. The existing save schema remains compatible.

Validation: `npm test` **304/304 passed in 39 files** and `npm run build` passed. Browser probes covered movement, gathering, crafting, building, doors, settings, save/reload, combat, death/respawn, raiding, power, POI caches, cooking and world events; the relevant browser runs reported no app/WebGL errors. Chrome/Metal High, 1280×720, seed 731942 comparison against archived v0.9.0: **60 FPS / 16.666 ms** in both, **612 → 664 draw calls**, **3,390,261 → 2,858,710 triangles (-15.7%)**, **1,318 → 1,598 nodes**, and **2,744 → 2,467 ms startup**. FPS was display-capped, so this is a same-device regression check rather than a maximum-throughput benchmark.

`npm audit` reports two moderate development-only advisories in Vitest/@vitest/mocker; the available fix requires a major Vitest upgrade and was not forced into this release.

### v0.9.2 validation and save compatibility

Generation 1–4 saves keep their legacy generators. Existing Generation 5 saves retain their saved layout and player/world state. This update adds combat, equipment, hazards, scavengers and Homestead state through the existing persistence path; no generation reset or save-format replacement is required.

Browser gameplay probes covered combat, ranged weapons, firearms, scavengers, hazards, doors, power, salvage, death/respawn and the browser flow. Unit tests: 232 tests in 34 files. Production build passes. Relative performance comparison at 1280×720, High, seed 731942: archived v0.9.0 vs current build measured 59.996 vs 60.002 FPS (display-capped), 16.668 vs 16.666 ms, 612 vs 618 draw calls (+1.0%) and 3,390,261 vs 2,856,582 triangles (-15.7%).

### v0.9.1 validation and layout compatibility

`src/terrain/roads.ts` shares one 12-m cost grid between all POI routes. New-layout vegetation leaves road/POI corridors clear; the routing layout is reused for rendering and the map. `src/world/climate.ts` shares continuous cover bands, and `src/world/horizon.ts` batches disconnected original massifs into three nonphysical meshes. Historical gen5 resources, species placement, colliders and roads are intentionally retained on revision 1 rather than migrated underneath a player or base. Cosmetic ground blending, palm materials and the horizon also apply to historical worlds.

### Lokální CPU diagnostika Rev6

Na běžícím Vite dev serveru lze spustit `CHROME_BIN=/usr/bin/chromium npm run test:cpu-profile`. Harness ověří zaměření stromu i vyčištění interakce při odvrácení pohledu a pořídí tři CPU profily (pozastavená / živá / pozastavená simulace). V QA browseru instrumentuje skutečně načtené moduly včetně jejich Vite URL; herní zdroje ani uložené světy tím nemění. Volba `TIDELAND_QA_SCREENSHOTS=0` ponechá pouze profiler data bez snímků. Výstup `profile.json`, případné screenshoty a Chrome DevTools `.cpuprofile` zůstávají v ignorovaném `test-results/world-cpu-profile/`.

Volby: `TIDELAND_QA_PRESET=low|medium|high|ultra`, `TIDELAND_QA_PROFILE_MS` (výchozí 6000), `TIDELAND_QA_BOOT_MS` (výchozí 180000), `TIDELAND_QA_RENDER_SCALE`, `TIDELAND_QA_WIDTH`, `TIDELAND_QA_HEIGHT`, `TIDELAND_QA_SEED`, `TIDELAND_QA_DIR` a `TIDELAND_QA_ANGLE`. Pro pomalý SwiftShader použijte LOW, renderScale `.5` a boot limit `600000`; menu potřebuje dostatečnou výšku okna, výchozí 1280×720 je ověřené. Jsou zaznamenány všechny skutečné settings a WebGL renderer. Tento nástroj je CPU diagnostika; interní `stats.fps` má omezené frame delta a není měřením skutečné propustnosti. Krátké vzorky s málo voláními ani SwiftShader nelze použít k uzavření historické Metal FPS regrese. Archivní performance / save compatibility QA se nadále spouští samostatně.

For browser QA, start the app on port 5173, set `CHROME_BIN` to the installed Chrome executable, then run `npm run test:performance` followed by `npm run test:world-art`. The performance probe first boots the immutable v0.9.0 archive with seed 731942, High quality, 1280×720 and DPR1; it also exports a real archived save fixture. `TIDELAND_QA_POSITION=x,z` pins both versions to the same ground coordinates, and `TIDELAND_QA_UNCAPPED=1` disables the in-game V-Sync setting (the probe asserts this); reported FPS comes from game telemetry while browser RAF timing is recorded separately. `TIDELAND_QA_SCREENSHOTS=0` skips images when the run is for performance data only. The world-art probe transfers the archived fixture into isolated local storage and checks old and new layouts. Generated evidence stays under ignored `test-results/`. Functional harnesses optionally accept `TIDELAND_QA_ANGLE=metal` on macOS; performance comparisons must use the same backend for both builds. `polish-qa.mjs` uses the historical generation-1 construction clearing; Generation 5 is covered separately.

`npm audit` reports two moderate Vitest/@vitest/mocker development-tool findings under GHSA-82fw-gwwq-j7x9. The patched range begins with Vitest 4.1.11, a major upgrade from this project's 3.x; no dependency or force-fix change was made in this stabilization release.

Release validation (macOS Chrome/ANGLE Metal, seed 731942, High, 1280×720 DPR1, identical spawn camera, 60 real frame intervals): archived v0.9.0 vs v0.9.1 measured 60.00 vs 60.01 FPS, 16.666 vs 16.664 ms, 612 vs 617 draw calls, 3,390,261 vs 3,163,616 triangles and 1,318 nodes in both. Startup was 5,661 vs 4,455 ms including page loading. The refresh-limited FPS is a relative smoke check, not a GPU capacity benchmark; SwiftShader startup timed out on this device. Unit validation: 185 tests in 25 files.
