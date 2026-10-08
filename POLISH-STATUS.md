# Tideland — camera / FOV checkpoint, 2026-09-08

This follow-up fixes the critical camera request in the existing project. It does not implement the separate progression expansion attached to that request.

## Root causes and changes

- Baseline browser probes proved the original slider DID update the active world camera. However, its value was passed directly as Three.js vertical FOV: 100 meant roughly 130 degrees horizontally at 16:9. The nearly opaque, blurred settings backdrop concealed the live result. Projection writes were spread across settings, resize and movement.
- `FirstPersonProjection` is now the sole world-projection owner. Settings expose **60–100 horizontal degrees at 16:9, default 90**. Conversion is `vertical = 2 atan(tan(horizontal/2)/(16/9))`. Vertical coverage remains constant across aspect ratios; ultrawide adds horizontal coverage (Hor+). Settings apply immediately, including projection-matrix refresh. Resize, New Game, Continue and menus preserve the base.
- Existing numeric preferences are retained and interpreted using the newly documented convention; values outside the new range are clamped. Consequently, an old saved FOV number produces a narrower world view than before. World saves and structure data are unchanged.
- Sprint adds a smoothly interpolated **2 horizontal degrees**, never a hardcoded replacement. Crouch no longer changes FOV. Camera position interpolates between physics ticks; mouse orientation updates each rendered frame without added smoothing. Teleports reset interpolation samples. Existing movement speeds, eye height and subtle bob remain.
- The existing separate viewmodel scene/camera was retained: fixed **50 vertical degrees**, near/far **0.01 / 5**, independent of world FOV. Resting hands/tools move closer and farther right, with aspect-aware horizontal anchoring. Camera-local coordinates intentionally remain independent of the world camera transform. World near/far remain **0.075 / 1700**.
- Viewmodel rendering preserves renderer auto-clear state, clears depth after the world pass and renders only held geometry. Fixed the mesh helper overriding transparent flame materials with `depthWrite=true`. Shared renderer tone mapping remains; no second world render or extra camera pass was added. This overlay avoids world occlusion but does not implement physical tool collision/retraction near walls.
- Settings now retain an unobstructed world preview on the left. Inventory and other UI architecture remain intact.

## Validation and evidence

- `npm test`: **32/32 passing**, including three new projection/conversion/aspect/sprint regressions.
- `npm run build`: **passing**, `artifacts/camera-fov/build.log`. Existing engine bundle-size warning remains documented below.
- `node scripts/camera-fov-qa.mjs`: **43 checks, 18 aspect/FOV comparisons, zero application errors**. Actual Settings input, active camera matrices, identical camera pose, invariant viewmodel matrix/projection, near-plane margin, flame depth state, movement states, inventory, build plan, interaction, save/reload/Continue and resize checked.
- `TIDELAND_QA_DIR=artifacts/camera-fov/regression npm run test:browser`: **70 checkpoints passing**. The 52-piece multi-level structure, restored floor colliders, door blocking/opening and post-reload socket attachment remain valid.
- Settings QA passes at 720p, including persistence and crafting capacity. Browser input tests use explicit development fixtures where needed; they are not a claim of exclusively manual testing.
- LOW / MEDIUM / HIGH sampled at **59.75 / 59.99 / 60.00 FPS**, with **111 / 327 / 336 calls**, **1.50 / 2.24 / 2.85M submitted triangles**. Dense forest settings probe: **59.83 FPS, 192 calls, 2.74M triangles**. Previous pass was about 60 FPS; changed projection makes draw counts non-identical-camera comparisons. No observed material FPS regression on native Chrome/Metal.
- New gallery: **`artifacts/camera-fov/index.html`**, with before/after, 60/75/90/100 at 1920×1080, 1440×900 and 2560×1080, plus rock/hatchet/plan, live settings and reload. Additional 70/80 captures are stored alongside. Camera pose is fixed exactly by pausing physics through a development-only capture flag; rendering, shader animation and the real Settings slider remain active.
- Visually inspected low/high FOV, all three aspect ratios, held tools/plan and live settings. World framing visibly changes while hands keep their proportions. Assets remain visibly procedural and the glove remains stylized; this fix does not claim anatomical realism. The upstream Rapier warning remains unsuppressed.

---

# Tideland — visual overhaul checkpoint, 2026-09-08

Work remains in the existing repository. Simulation, inventory, crafting, player movement, UI and socket/collider dimensions were preserved. This pass changes original procedural rendering and introduces a versioned terrain generator. The earlier checkpoint is retained below as history.

## Implemented in this visual pass

- **Terrain generation 2:** broad folded ridge, secondary massif, sheltered valley, smaller slope variation, warped island outline, coves and coastal shelves. Starter construction area retains its previous heights. Existing saves without `worldGeneration` use the unchanged generation-1 height function and resource-placement rules. New games record `worldGeneration: 2`; save version remains 1. Unknown generator versions are rejected rather than silently moving a saved base.
- **Ground materials:** removed the sinusoidal repeating soil mask; introduced independent spatial noise, rotated/scaled texture blending, muted colors, soil patches and derivative-based micro relief with distance attenuation. Base texture noise wraps across texture edges. Shore sand darkens toward the water. Fixed visible sand seams and an overly continuous white foam band found in screenshots.
- **Grass:** preserved instancing, chunk culling, wind and preset scaling. Redesigned the blade texture around irregular roots and curved narrower blades, with larger size/height variation, independent patch/density masks and correlated dry-grass probability. Reduced yellow coloration. First iteration produced overly broad blades; corrected the opposing curve controls after inspecting it.
- **Forests:** broader forest masks, denser populations in new worlds (cap 820 instead of 560), revised conifer spray direction and crown irregularity, original clustered needle texture, connected primary/forked broadleaf branches and uneven canopy masses. Reduced redundant spray geometry, trunk segments and minor branches to retain the triangle budget. Existing saves retain their original tree positions/count and resource IDs. Harvestable trees remain visible on LOW.
- **Rocks:** replaced noisy rounded icospheres with reusable convex fractured-strata meshes, asymmetric profiles, broad faces, crease-aware normals and UVs for held stones. Original triplanar rough stone materials remain. Geography-based placement and partial burial are preserved.
- **Shore/ocean:** lightweight instanced stranded branches and pebbles in shoreline patches; three displacement directions, advected multi-scale noise for water normals, distance attenuation, cooler/deeper water colors, revised highlight, shallow color approximation and broken foam. Reduced cloud coverage and ambient fill for clearer terrain form.
- **Viewmodel/torch:** replaced the extruded glove outline with a rounded tapered palm and repositioned curved thumb; retained perspective camera, fingers, cuff, cloth material and use/equip animations. Added a second independently animated flame layer and split turbulent tongues. Torch uses a less saturated color, lower intensity, shorter range and inverse-square falloff. Checked night outdoors and indoors.
- **Structures:** variable wall plank widths/depth/offset, exterior timber rails, roof edge trim and a more weathered neutral wood palette with reduced bump strength. Per-material batching remains intact; logical dimensions, doors, sockets and colliders are unchanged.
- **Evidence tooling:** QA scripts accept `TIDELAND_QA_DIR` so previous evidence is preserved. Added repeatable visual capture and gallery scripts. All 24 old representative PNGs were inspected before changes. Several screenshot iterations were inspected during development.

## Validation and performance

- `npm test`: **29/29 passing** (all previous 27 plus generator compatibility/determinism tests).
- `npm run build`: **passing**, recorded in `artifacts/visual-overhaul/build.log`.
- `TIDELAND_QA_DIR=artifacts/visual-overhaul/qa npm run test:browser`: **70 checkpoints passing**. New Game, movement/jump/sprint/crouch, gathering, inventory DOM drag/splitting, hotbar, queue capacity, save/Continue, doors, F3 and all presets exercised. No application console errors.
- The **52-piece** two-level structure again retained exact transforms/open state after reload. All 18 foundation/floor colliders, blocking walls, opening/passing the door and a new socket attachment were checked. Tests use actual browser inputs plus explicit development fixtures, not a claim that every piece was placed manually.
- Settings QA passed: FOV, sensitivity, master/effects volume and graphics preference persistence; crafting capacity button also verified.
- Matched grassland sample: **59.79 → 59.78 FPS**, **235 → 243 calls**, **2.798M → 2.864M submitted triangles** (+2.4%).
- Dense-forest probe: **59.81 FPS, 223 calls, 2.748M triangles**, with **40 trees within 32 m**. Previous probe was 28 trees, about 60 FPS / 2.70M; these densest positions differ, so this is a demanding-scene comparison, not identical-camera benchmarking.
- Large-base HIGH view: about **60 FPS / 364 calls / 2.876M triangles**, versus previous 356 calls / 2.81M. Added environment detail accounts for the modest increase; structure meshes remain batched by material. LOW/MEDIUM/HIGH all remain approximately 60 FPS in the sampled views.
- Measurements are short desktop Chrome/Metal samples, not a guarantee for all hardware or every seed.

## Evidence and remaining limitations

Open `artifacts/visual-overhaul/index.html`: **22 representative views and 10 before/after pairs**. New evidence is separate from `artifacts/polish/`. `before/` contains the pre-change camera set, `iteration-1/` through `iteration-3/` retain intermediate images, `after/` holds final environmental views, and `qa/` holds gameplay/base/torch/UI/preset evidence and JSON results. Six comparisons use matching horizontal camera coordinates and targets; terrain-relative eye height, animation and new-world vegetation differ. Four comparisons link the previous polish gallery.

**This is visibly revised procedural art, not photorealism or Rust-equivalent realism.** Important remaining weaknesses are still visible: near foliage cards and simplified conifer twigs, broadleaf crowns with repeated forms, recognizable grass tufts, smooth areas on steep uplands, some faceted rock edges, a simplified glove/tool silhouette, and modular rectangular building masses. Water uses approximate lighting, without scene reflection/refraction. Tree LOD/impostors were not introduced; shared instancing and geometry reduction kept performance stable. These limitations should not be presented as completed photorealistic assets.

The previously investigated Rapier initialization warning remains upstream and unsuppressed (details below). The bundle warning also remains: both Three and Rapier are needed for the current startup. Final JS is about **2.91 MB minified / 1.016 MB gzip**; this pass does not hide the warning or split engines merely to change the warning threshold.

To regenerate evidence while preserving the old gallery:

```sh
TIDELAND_QA_DIR=artifacts/visual-overhaul/qa npm run test:browser
TIDELAND_QA_DIR=artifacts/visual-overhaul/qa node scripts/polish-settings-qa.mjs
node scripts/visual-overhaul-capture.mjs after
node scripts/visual-overhaul-gallery.mjs
```

---

# Previous polish checkpoint (retained history)

This replaces the 2026-09-07 checkpoint. Work stayed in the existing project; the simulation, inventory, save format, Rapier movement and socket-based construction architecture were preserved. All art changes are original/procedural.

## Implemented in the latest pass

- Replaced closed cone pine crowns with transparent needle sprays distributed along branches. Three conifer forms and two broadleaf forms share instanced geometry/materials. Trunks taper, bend slightly, carry irregular branches and root flares. Species variation uses position-derived selection without consuming additional placement RNG, preserving resource IDs/locations for existing saves.
- Added original cutout needle texture, reduced foliage saturation/emissive lift, retained readable canopy shadows and all harvestable trees on every preset.
- Increased local grass coverage with smaller tufts, added soil/micro-color breakup to ground materials and smoothed rock normals with rough bump detail.
- Replaced orthographic held-item projection with a dedicated perspective viewmodel camera. Added a shaped work glove, curved fingers/thumb, seams, cuff, cloth texture, improved hatchet head and wrapped tool fittings. Tuned scale, position, equip transition, sprint lowering and impact motion.
- Replaced solid flame geometry with a turbulent rising-noise flame shader. The torch has restrained warm flicker/range variation and a useful local light pool, checked outdoors and inside the test shelter.
- Gathering from a mineral/tree node now starts the swing and delivers particles, sound and resource reward at the impact phase rather than before it.
- Building textures now maintain scale and vary their UV offsets. Merged each piece by material to avoid submitting individual planks; retained door hinges and collision ownership.
- Added lateral upper-floor and roof sockets so a 3×3 base can have a complete center floor and roof.
- Fixed a reproducible door interaction failure: aiming through a plank seam lost the target. A non-rendered slab now provides continuous targeting and follows the door hinge.
- Matched upper-floor visual/collider thickness to socket height, closed visible wall-top gaps, and removed decorative grass under foundations on placement and load.
- Closing inventory/pause now clears drag state. Craft buttons use simulation capacity validation, with explicit full-inventory/full-queue labels; blocked completed jobs show READY / MAKE ROOM.
- Added an original favicon to remove actual 404 console errors.

## Reproducible validation

Final commands on 2026-09-08:

- `npm test`: **27/27 passed** across simulation and geometry tests.
- `npm run build`: **passed**, including TypeScript.
- `npm run test:browser`: **passed**, 70 recorded browser checkpoints.
- `node scripts/polish-settings-qa.mjs`: **passed**.

Browser scripts use an isolated Chrome context, real keyboard/mouse/DOM drag handlers and the existing development bridge for exact fixtures, larger construction setup and state assertions. Screenshots were visually inspected. This is browser-driven automated testing plus visual review, not a claim that every fixture was created by hand through gameplay.

Inventory coverage includes empty/full capacity, exact stack maximum and overflow, rejected pickup retention, even/odd/single-item splits, native drag merges/swaps, belt transfers, occupied belt swaps, Shift drag, drop/pickup conservation, closing during drag, pause from inventory and exact saved layout restoration. Partial dropping is supported by splitting into a slot and dropping that slot; there is no amount-entry drop control.

Crafting coverage includes insufficient/exact ingredients, real Craft button input, multiple jobs, moving ingredients, blocked completion under externally filled capacity, exactly-once output delivery, output stacking, and a two-job queue surviving reload. There is no cancellation feature to test. Capacity reservation intentionally prevents normal pickups from stealing queued output space; tests also force a full inventory to check the defensive path.

The persistence test constructs **52 pieces**: 9 foundations, 23 walls, 1 doorway, 1 door, 9 upper floors and 9 roofs. It checks exact structure transforms and open state before/after reload, rejects duplicate placement without payment, checks all 18 foundation/floor colliders using actual Rapier character movement, verifies a wall and closed door block movement, opens the restored door with E, walks through it, and successfully attaches another foundation after reload. Construction spans all four edge orientations. Screenshots include both floors and the restored exterior. This does not exhaust every possible awkward camera angle or arbitrary user-built graph.

Settings tests persist FOV, sensitivity, master/effects volume and preset through reload. LOW/MEDIUM/HIGH were rendered and inspected. Harvestable tree visibility stays consistent with collisions; presets change grass density/distance, shadows and pixel ratio.

## Performance

Local Chrome/Metal at 1280×720, after settling:

- Base-area LOW: approximately 60 FPS, 101 draw calls.
- Base-area MEDIUM: approximately 60 FPS, 343 draw calls.
- Base-area HIGH: approximately 60 FPS, 356 draw calls, 2.81 million submitted triangles including passes.
- Dense forest (28 trees within 32 m), held torch, shadows, HIGH: approximately 59.9 FPS, 275 draw calls, 2.70 million submitted triangles.

The same base-area HIGH view used approximately 1,134 calls before plank batching. These are local sampled views, not a guarantee on all hardware or maximum-size bases.

## Warnings investigated

No application console errors in the final browser runs.

**Rapier warning remains, unsuppressed.** Installed `@dimforge/rapier3d-compat` 0.19.3 exposes `init(): Promise<void>`. Its bundled source map shows `gen3d/init.ts` internally calling `wasmInit(base64.toByteArray(wasmBase64).buffer)`. The generated WASM initializer warns when that argument is not the newer `{module_or_path: ...}` wrapper. Tideland calls and awaits the public zero-argument initializer once per page; new worlds reuse it. Passing a wrapper to the public function would be ignored and contradict its type contract. The warning is internal to the compatibility package, not duplicate app initialization or failed physics. No dependency internals or console filters were patched.

**Vite size warning remains, unsuppressed.** Final JS is approximately 2.895 MB minified / 1.011 MB gzip. Rollup module-length measurement before final minification found Rapier including embedded WASM at 2,237,075 bytes, Three.js at 1,397,408 bytes and application code at 181,484 bytes. Both engines are needed for the rendered menu/world at startup; merely splitting them into chunks would not materially reduce first-load transfer. No destabilizing loader rewrite or warning-threshold increase was introduced. Measurements are in `artifacts/polish/bundle-contributors.json`.

## Visual evidence and remaining limits

Open `artifacts/polish/index.html` for the screenshot gallery. JSON reports live beside it. Representative views cover coast/day, forest/day/evening, dense forest, torch/night/indoors, gathering, inventory at 720p/1080p, crafting, building preview, complete base, restored upper floor and graphics presets.

Trees, glove, flame and rock shading are visibly improved over the previous pass, but the assets remain procedural and do not equal the photographic realism of Rust. In close views, branch geometry and glove silhouette still reveal simplification. A broader aesthetic pass could refine those further; no assertion is made that all perceptual differences from the references have disappeared.

Save version remains 1. Existing saves are accepted; small floor-surface height correction settles through physics. No broad new gameplay systems were added. Vertical traversal between floors still uses the existing game's available movement/build access; this pass did not add stairs or ladders.

## Running

`npm run dev`, then open the printed URL (normally http://localhost:5173).

Run browser checks while the dev server is active. The scripts default to macOS Google Chrome; set `CHROME_BIN` to another installed Chrome executable if needed. They create isolated browser storage and do not modify the player's regular browser save.


# Tideland — v0.2.0 reconciliation, 2026-09-11

- Reconciled the remaining useful local Codex work with the GitHub `main` branch.
- Completed station placement/collision, maintenance-panel and dev-terminal lifecycle work from the unfinished local copy.
- Local camera/movement regressions, absolute Pages asset paths and `.npmrc` cache behavior were deliberately not restored.
- Direct vertical FOV behavior restored at 60–100 degrees; yaw-based movement remains the source of truth.
- Added explicit game version/history UI and `CHANGELOG.md`.
- Added broader QA for version/history, FOV and station placement.
- Release target: `0.2.0` / `EA-02`.
# Tideland v0.14 visual fidelity continuation — 2026-10-08

## Shore asset grounding checkpoint — 2026-10-08

- Fixed a Blender join/export transform loss that rotated horizontal shoreline driftwood upright and moved the Breakwater salvage crate down through its authored base. The exporter now bakes the active object's location/rotation/scale into mesh vertices before resetting transforms; only the verified driftwood and crate GLBs/proxies were regenerated.
- Added asset-verifier regressions for horizontal driftwood dimensions and the crate's ground-level base. A full 31-asset regeneration audit showed the other GLB differences were byte-order only (the changed small rock had identical position bounds), so that unrelated output was discarded.
- Browser world-art QA ran screenshot-free: **91 checks PASS**, both archived v0.9.0 and v0.9.1 save migrations remained intact, four graphics presets and weather/camera sweep had zero browser/WebGL errors, and current revision save/reload determinism passed.
- `npm test`: **563/563 PASS across 58 files**; `npm run build`: PASS (existing Vite large-chunk advisory); `npm run test:assets:world`: **31 GLBs + 31 proxies PASS**; `git diff --check`: PASS.
- Checkpoints pushed to `codex/v0.14.2-water-weather`: `7863d92` (driftwood), `779abfd` (grounded Breakwater crate), `b197455` (exporter documentation). Main/release tags/Pages were not changed. User-created ` 2` files and `artifacts/` remain untouched.
- Overall completion estimate: **about 38%**. The full asset/material and physical audit, substantive terrain/water/atmosphere/station polish, matched v0.13 performance comparison, release docs/version, and final QA/release gates are still open. Next: continue the major-asset collision/material audit, then address a high-impact remaining world surface issue rather than treating these prop fixes as completion.

- Active goal: **Tideland v0.14.0 — Visual Fidelity, Materials & Physical World Overhaul**. Repository source currently identifies itself as v0.14.1; do not downgrade or reuse the already released v0.14.0 tag. Work remains on the existing pushed branch `codex/v0.14.2-water-weather`; `951ba696e66e8c276fbf775c409ae3d340ae7d94` was the base checkpoint when this continuation began. `main`, release tags, GitHub Release and production Pages were not changed.
- Added a single world-space collision envelope across every rendered LOD and applied it to the detached Breakwater hull, salvage crate, secondary hull and cargo drum. Driftwood remains decorative. The primary hull already uses stable side collision derived from all of its LODs; harvest nodes, saved world identity and loot state are unchanged.
- Strengthened collision verification: the browser rock probe moved the player against all four sides of all three authored boulder variants (**12/12 blocked, zero app/browser errors**). Its lateral assertion now allows slope-driven motion only within the tested collider face; the separate depth assertion still verifies that the player is stopped at the solid boundary. Added unit coverage that unions transformed LOD bounds and blocks movement at a far-LOD protrusion.
- Validation for this checkpoint: `npm test -- --run tests/collision-bounds.test.ts tests/world-art.test.ts` **47/47 PASS**; `npm run build` **PASS** after the collision implementation (existing Vite large-chunk advisory remains); final focused `tests/collision-bounds.test.ts` **15/15 PASS** after adding the far-LOD movement case; `node --check scripts/rock-collision-qa.mjs` and `git diff --check` **PASS**. One first browser run was invalidated by two concurrent SwiftShader instances and a slope-sensitive lateral threshold; the single-instance rerun passed all 12 approaches.
- Commits pushed in this continuation: `d1e05d4` (Breakwater debris collision), `e5b5252` (slope-tolerant rock collision QA), `9689939` (LOD bounds coverage), `0f82254` (far-LOD player collision test). User-created iCloud files ending in ` 2` and `artifacts/` remain untouched and untracked.
- Overall completion estimate at the time of that checkpoint: **about 23%**. This is a broad, weighted estimate, not a claim that one subsystem’s tests imply release readiness. Existing branch work already includes PBR detail families, tree bark/foliage work, fractured rock geometry, wet material response and several debug overlays. Still largely open: complete asset/physical audit, terrain/rock/vegetation visual review, water/sky/weather and mountain fidelity, stations/decals, performance comparison, full regression suite, release documentation/versioning, CI, tag, GitHub Release and Pages verification.
- First next step: continue the physical asset audit beyond boulders and Breakwater by comparing the largest remaining POI/station visible meshes with their live collision bounds; keep using focused tests and avoid screenshot churn. Do not merge or publish v0.14.0 until the requested release gates pass.

# Tideland v0.14 physical audit continuation — 2026-10-08

- Extended the physical audit to Collapsed Relay. Its visible wood crate, high weather mast and all three battery drums were missing from the POI collision set; added stable proxy boxes matching their authored placements and mast lean. Cabinet collision remains unchanged.
- `tests/world-art.test.ts` now verifies all six relay collision boxes and the exact drum/mast placements.
- Validation: `npm test -- --run tests/world-art.test.ts tests/station-renderer.test.ts tests/collision-bounds.test.ts` **57/57 PASS**; `npm run build` **PASS** (existing Vite large-chunk advisory); `git diff --check` **PASS**.
- Working branch remains `codex/v0.14.2-water-weather`; user-created ` 2` files and `artifacts/` remain untracked and untouched. The relay fix was committed as `8a22323` and pushed.
- Next: continue checking the remaining rendered POI props against physical colliders, then broaden visual and regression QA. No release/version bump has happened.
- Continued the audit into Highland Relay: replaced a phantom center-post collider with collision envelopes for its three visible tower legs and control cabinet. Extended the existing ridge approach physics test to assert the envelopes while still reaching the cabinet.
- Highland Relay validation: `npm test -- --run tests/world-art.test.ts` **35/35 PASS**, including the real Rapier approach; `npm run build` **PASS** (same existing bundle-size advisory); `git diff --check` **PASS**. The follow-up was committed as `68a9fda` and pushed.
- Full baseline validation on 2026-10-08: `npm test` **551/551 PASS** (57 files); `npm run build` **PASS**. Screenshot-free browser `test:world` **23/23 PASS**, no console/page errors; screenshot-free `test:world-art` **91/91 PASS**, no console/page errors. The latter loaded real archived v0.9.0 and v0.9.1 saves and retained inventory, structures, stations, research, node identity, drops, craft queue, and player position.
- Relative performance run used Chromium SwiftShader, 1280×720, HIGH, seed `731942`, 48 sampled frames at spawn. v0.9.0: **14.16 FPS / 70.61 ms**, 612 draw calls, 3,390,261 triangles, 1,318 nodes; menu ready 44.89 s, new-game load 20.11 s, total to playing 65.00 s. Current v0.14.1: **19.86 FPS / 50.35 ms**, 477 draw calls, 3,105,964 triangles, 2,033 nodes; menu ready 53.14 s, prepared new-game transition 0.04 s, total to playing 53.19 s. That is approximately +40% FPS, −22% draw calls and −8% triangles in this headless sample; menu preparation regressed by about 8.2 s while overall time to playing improved by about 11.8 s. SwiftShader is relative-only and must not be represented as hardware FPS.
- All QA output was directed to `/tmp/tideland-v14-*`; screenshots were disabled. The temporary Vite dev server was stopped after browser QA.
- Follow-up collision fix: added Z-axis tilt support to `CollisionBox`, Rapier collider creation and the F3 wireframe overlay. Highland Relay legs now use their real ±0.19 rad lean instead of over-wide vertical approximations. Targeted checks: collision/debug/world-art **60/60 PASS**, production build PASS, `git diff --check` PASS. The earlier one-frame visual capture attempt was abandoned because SwiftShader initialization stalled; no screenshot was written.
- World asset package validation: `npm run test:assets:world` **PASS**, 31 GLBs and 31 all-LOD collision sidecars, all under 512 KiB. Screenshot-free tree culling QA **PASS** (766/1500 visible instances, fall lifecycle and preset LOD checks; no browser/WebGL errors). Highland Relay browser QA **6/6 PASS**, including locked-cache interaction after the tilted leg colliders; no browser/application errors. Both temporary dev servers were stopped after QA.
- F3 / Testing Mode browser QA: **24/24 PASS** with no browser/page errors. Live collider wireframes, asset bounds, grounding and LOD overlays all toggle correctly; asset teleports work; the isolated Testing Mode lock left all save data byte-for-byte unchanged. Temporary Vite server was stopped.
- Added Revision-6 collision proxies for the Utility Shack pump bench/pump and Quarry Outpost sample table, tool rack and three supply crates. Legacy revision keeps its original two broad POI colliders. Targeted world-art/collision tests **51/51 PASS**, build PASS and `git diff --check` PASS. Source fix was committed and pushed as `de841fc`.
- Screenshot-free browser regression: `npm run test:browser` **71 checks PASS**, covering new game, movement, gathering, inventory, crafting, construction, save/reload, door and collider persistence, with zero console errors. `npm run test:menu-settings` **15/15 PASS** in EN/CZ, including settings persistence and actual graphics/effect controls. Results were written to `/tmp`; Vite was stopped. Current branch HEAD before this documentation checkpoint: `de841fcd3f7bea127e6aabcbd55f8c9f3230ed54`.
- Physics regression follow-up for Utility Shack and Quarry: the world-art unit now drives Rapier movement into the pump bench and a supply crate and asserts the player is physically blocked. `npm test -- --run tests/world-art.test.ts tests/collision-bounds.test.ts` **51/51 PASS**; this was committed and pushed as `a00d8fd`. Unrelated user-created files remain untracked and untouched.
- Extended the Revision-6 physical audit to Tidal Survey Pier: added stable proxies for its instrument housing, height gauge, survey mast and complete sample bench. Added actual Rapier movement tests that verify the housing and mast block the player; revision 5 retains its one legacy pier collider. Latest `world-art` + `collision-bounds` tests: **52/52 PASS**; `npm run build` and `git diff --check` pass (existing Vite large-chunk advisory remains). This follow-up is in the working tree; the broad asset/material, terrain, foliage, water, atmosphere and release work remains incomplete.
- Corrected ocean vertex coordinates so shoreline-height, camera distance and haze calculations use the translated mesh's world position. Added a focused regression test. `tests/atmosphere.test.ts` plus `tests/world-art.test.ts`: **38/38 PASS**; production build and `git diff --check` pass. The full screenshot-free world-art harness was stopped before its scenarios completed. A separate local browser smoke check reached `window.__TIDELAND` after about 45 seconds and observed zero console/page errors; no screenshots were created. This verifies app startup and shader delivery, not the full world-art scenario suite.
- Current broad completion estimate before this continuation: **about 29%** (rough weighted estimate, not test-pass percentage). Physical audit had advanced across rocks, Breakwater, relay sites, Utility Shack, Quarry, Stormwatch and the Tidal Pier; water response already included coherent wave normals and rain-driven surface perturbation. Remaining work still covers much of the visual fidelity scope, full final QA, and release gates. Keep screenshots off unless a specific issue needs visual diagnosis. `main`, release tags, GitHub Release and Pages remain untouched; v0.14.0 is already tagged/released and must not be moved or reused.
- Added a Revision-6 Stormwatch desk collision matching its tabletop and legs. The physical entry test still passes through the front doorway, stops at the desk, and confirms the legacy revision retains one collider. Focused world-art/collision tests **52/52 PASS**; production build and whitespace check PASS. This work remains on the existing feature branch; user-created ` 2` files and `artifacts/` are untouched.
- Unified ocean vertex displacement and fragment-normal wave fields. The fragment normal now includes matching base, rain, storm and Revision-6 swell terms once, removing the previously duplicated Revision-6 normal offset. `atmosphere`, `weather-materials` and `world-art` tests: **42/42 PASS**; production build PASS. Browser New Game smoke reached Revision 6 gameplay with **zero console/page errors**; screenshots remained disabled and the temporary server was stopped.
- Added a narrow Revision-6 Stormwatch wind-mast collider aligned with its visible four-meter instrument pole. Rapier now confirms the player is blocked by the mast while the shelter entrance remains traversable; Revision 5 collision count stays unchanged. World-art/collision tests **52/52 PASS**, production build and diff check PASS.
- Rain ripple placement now contributes a restrained height gradient to the water normal, while reusing the same ring variables for the existing visible ripple highlight. Focused atmosphere/weather material tests **6/6 PASS**; production build PASS; a fresh Generation-5 Revision-6 New Game under rain reached gameplay with zero console/page errors. Screenshots disabled; temporary Vite server stopped.
- Revision-6 authored tree trunk proxies now use Rapier capsule colliders rather than square cuboids. This matches the rounded capsule proxy shape authored in the world-asset sidecars, removes invisible square corners from player movement, and leaves legacy-generation tree colliders unchanged. F3 world bounds now draw and ground-check the actual capsule silhouette. `tests/collision-bounds.test.ts`, `tests/debug-bounds.test.ts` and `tests/world-art.test.ts`: **64/64 PASS**, including real Rapier movement into the trunk; `npm run build` PASS (existing large-chunk advisory remains). Full suite and browser movement regression remain outstanding.
- Revision-6 ocean now transitions gradually from turquoise shallows into the existing deep-water color using the terrain height map over a 24 m depth band, while preserving Fresnel highlights. Legacy revisions retain their original narrow shoreline tint. Updated the water shader regression assertions to match the already-implemented finite-difference/rain-gradient normals rather than removed analytic-normal code. Atmosphere/environment/weather material tests **27/27 PASS**; production build PASS; Chromium SwiftShader New Game reached gameplay with zero page/console errors (about 2 minutes startup); temporary Vite server stopped. No screenshot artifacts were produced.
- Full regression after the capsule and water changes: `npm test` **560/560 PASS** (58 files), `npm run build` **PASS**, existing Vite chunk-size advisory unchanged. The full run also found a second stale assertion for the removed analytic swell-normal path; the settings test now verifies actual water-quality scaling of wave sampling, normal strength, rain and foam. The v0.14.2 feature branch remains the only branch changed; `main`, release tags and production Pages remain untouched.
- Broad weighted completion estimate after the water/tree work: **about 31%**. This reflects the additional physical-shape correction for Revision-6 tree trunks, depth-aware Revision-6 shoreline/water coloring, full unit regression, build and gameplay browser smoke. Much of the requested model/material audit, terrain/rock/foliage/sky/weather/station VFX work and final release gates remains open; this is not a completion claim.
- Breakwater authored debris, crates, drums and the secondary ship hull now get one collision proxy aligned to their actual shared LOD parent yaw. Previously the helper unioned already-rotated world AABBs, making a long tilted hull collider unnecessarily wide and blocking nearby empty space. New proxy construction unions every LOD in the common parent frame before projecting into Rapier's oriented cuboid; focused tests verify all-LOD containment, reduced side footprint and real character-controller blocking. `tests/collision-bounds.test.ts` + `tests/world-art.test.ts`: **54/54 PASS**; production build PASS. Legacy POI colliders remain on their original code path.
- Current broad weighted completion estimate: **about 32%**. The increase accounts for this additional tested physical-alignment fix only; visual audit and most PBR, terrain, foliage, weather, performance and release work remain incomplete.

## Revision-6 outcrop albedo correction — 2026-10-08

- Corrected instanced biome rock tint: the prior `0.18–0.28` linear lightness was multiplied by material albedo and authored facet colors, making the boulders much darker than intended and suppressing their surface detail. New deterministic biome tints use restrained hue/saturation variation with `0.66–0.78` lightness; legacy revisions are unchanged.
- Added a regression test for deterministic, readable temperate/arid/alpine tint values. `tests/rock-geometry.test.ts` + `tests/terrain-materials.test.ts`: **17/17 PASS**; `npm run build`: **PASS** (existing Vite chunk-size advisory).
- Asset package check: `npm run test:assets:world` **PASS**, 31 GLBs and 31 collision proxy sidecars, all LODs present, files under 512 KiB.
- This is one material correction; broad visual inspection and the rest of the asset/material, environment, performance and release gates remain open. Estimated overall completion: **about 33%**. Branch remains `codex/v0.14.2-water-weather`; no release, tag or Pages changes.

## Revision-6 world-space rock relief — 2026-10-08

- Added restrained derivative-based micro-relief for Revision-6 stone using the existing world-space triplanar rock albedo height. Large/small instanced outcrops now keep relief frequency tied to world position instead of stretching their local-UV normal detail with instance scale. The path adds no texture, draw call, or material and leaves legacy stone shader normals unchanged.
- `tests/weather-materials.test.ts` + `tests/rock-geometry.test.ts`: **13/13 PASS**; `npm run build`: **PASS** (existing Vite chunk-size advisory). Headless WebGL SwiftShader New Game reached `playing` with **zero browser/page errors**. No screenshots captured; temporary Vite server stopped.
- Combined with the prior outcrop tint fix, current broad completion estimate is **about 34%**. Wider material/asset audit, world visuals, performance comparisons, full regression QA, and release gates remain open.

- Follow-up completed the Revision-6 rock normal strategy: local-UV normal maps are now disabled and disposed only for world-space-detail stone materials; their legacy counterpart retains its original normal map. The world-space relief and roughness map remain active. `weather-materials`, `terrain-materials`, and `rock-geometry`: **20/20 PASS**; build PASS; headless WebGL New Game reached `playing` with zero page/console errors. No screenshots captured; temporary Vite server stopped.

## Revision-6 forest deadfall grounding — 2026-10-08

- Replaced the fixed `0.165 × scale` log lift with a geometry-aware contact correction after terrain alignment and instance scaling. The full trunk plus broken branch vertices now settle against the sampled height field, reducing floating/buried ends on curved ground; no gameplay collision or save data changes.
- Added a curved-terrain regression for the actual fallen-log geometry and slope-aligned transform. `environment-visuals`, `foliage-geometry`, `world-art`: **71/71 PASS**; `npm run build`: **PASS** (existing Vite chunk-size advisory); `git diff --check`: **PASS**. Overall goal estimate remains approximately **36%**.

## Authored Breakwater PBR surfaces — 2026-10-08

- Routed authored Breakwater hull/detail, cargo drum and instanced shoreline driftwood materials through the shared Tideland weathered-wood, oxidized-metal and painted-metal PBR families. Authored palette and metalness remain intact; existing grain/roughness/normal maps and wetness response are reused without adding draw calls.
- Added a deterministic material-family resolver for the actual GLB material names, regression coverage for each Breakwater surface, and a read-only runtime QA summary. Screenshot-free local tree/world-art QA asserted all three families on loaded assets, retained 727 visible trees and 192 instanced outcrops, and reported zero browser/WebGL errors.
- Validation: full `npm test` **565/565 PASS (58 files)**; `npm run build` PASS (existing large-chunk advisory); `npm run test:assets:world` **31 GLBs + 31 collision proxies PASS**; `TIDELAND_QA_SCREENSHOTS=0 npm run test:tree-culling` PASS; focused material/environment/world-art tests **64/64 PASS**.
- The broader `test:world-art` rerun was stopped before scenarios because its first step waited several minutes for the public archived v0.9.1 app, which remained on its world-initialization screen. The archive returns HTTP 200, but that run did not verify archived-save QA; the prior recorded successful run remains the latest completed archive test.
- Commits pushed to `codex/v0.14.2-water-weather`: `1e8772e`, `0369695`, `578e5f2`. Current branch head and origin branch head match at `578e5f283b5b8f787d820725a5e0f2e72e3653c6`. `main`, release tags and Pages remain unchanged; user-created ` 2` files and `artifacts/` remain untouched.
- Overall weighted completion estimate: approximately **37%**. This is a broad estimate; terrain/atmosphere/props and remaining material/physical audits, v0.13 matched performance, and final release gates remain open.
- Next: continue the highest-impact unresolved world-fidelity review; do not bump version or publish until the release criteria pass.

## Highland Relay lattice collision completion — 2026-10-08

- Revision-6 Highland Relay now has ten thin Z-tilted collision boxes aligned to the visible diagonal tower braces. Legacy revisions keep the previous collider set. The existing three leaned tower-leg colliders and side control-cabinet collider are unchanged.
- Regression coverage checks all ten brace proxy dimensions/angles, Rapier blocks the player at the central lattice, and a separate approach still reaches the side cabinet. The browser QA continues to open the generated locked-cache interaction through its access card.
- Validation: `tests/world-art.test.ts`, `tests/collision-bounds.test.ts`, `tests/debug-bounds.test.ts` **66/66 PASS**; `npm run build` PASS (existing chunk-size advisory); `npm run test:highland-relay` **6/6 PASS**, zero browser/application errors; `git diff --check` PASS. Browser QA ran without screenshots; the Vite server was stopped.
- Overall weighted completion estimate: approximately **38%**. Asset/physical inspection advanced, but broad visual implementation, matched v0.13 performance, final QA, and release gates remain outstanding. Main, tags and Pages are unchanged.

## Revision-6 Breakwater derrick collision — 2026-10-08

- Added a Revision-6-only cuboid proxy for the visible leaning Breakwater cargo derrick mast. The proxy follows the rendered mast's `-0.11` Z rotation and full 16.8 m length, closing the walk-through gap without changing legacy revisions or save data.
- Added a Rapier movement regression proving the player is blocked at the mast, plus updated the Breakwater proxy-count assertion. `tests/world-art.test.ts`: **38/38 PASS**; `npm run build`: **PASS** (existing Vite large-chunk advisory).
- Estimated overall goal completion: approximately **39%**. The remaining asset/material audit and most terrain, rocks, vegetation, water, atmosphere, weather, performance comparison and final release checks are still outstanding. No release/tag/Pages changes.

## Live authored boulder collision QA — 2026-10-08

- Updated `scripts/rock-collision-qa.mjs` to launch the menu's already-prepared Revision-6 preview through F3 Testing Mode. This avoids generating a second random New Game, preserves all save slots, and still exercises the live authored rock meshes, their collider batches and actual character-controller movement.
- The previous New Game flow timed out waiting for `playing` after its 180-second limit. With the prepared-world path, Chrome/Metal QA passed **12/12 approaches** (all four sides of `large_boulder_a`, `_b`, and `_c`) with **zero application/browser errors**. No screenshots were captured. `node --check scripts/rock-collision-qa.mjs` PASS; collision/world-art unit tests **55/55 PASS**; world asset package **31 GLBs + 31 collision proxies PASS**.
- Estimated overall goal completion: approximately **40%**. The rock-side walk-through criterion now has both direct Rapier unit coverage and live browser movement evidence; the broader terrain, vegetation, water, atmosphere, materials and release requirements remain open.

## Revision-6 Breakwater deck crate collision and access — 2026-10-08

- Added an oriented Rapier proxy for the tilted Breakwater equipment crate and moved only its Revision-6 visual placement to the open starboard/aft deck. The original Revision-5 placement and collider layout are unchanged.
- Actual character-controller movement now blocks against the Rev6 crate. Regression checks also confirm that the revised position keeps the wheelhouse doorway open and the coastal boarding route traversable. `tests/world-art.test.ts`: **38/38 PASS**; `npm run build`: **PASS** (existing Vite chunk-size advisory).
- Estimated overall completion: approximately **41%**. A previously walk-through solid deck prop is now physically consistent without sacrificing access; the remaining visual overhaul and final release gates remain incomplete.

## Revision-6 Breakwater crate grounding correction — 2026-10-08

- Rechecked the crate against the overlapping cargo stack: its Revision-6 footprint sits on the first cargo container, whose top is at local y=1.83. Set the tilted crate center to y=2.72 and added a transformed-geometry assertion for ground contact; its oriented Rapier proxy now shares that elevation. Revision-5 placement remains unchanged.
- Updated the Rapier approach test to stand at the cargo top and assert the visible crate contacts that surface. `tests/world-art.test.ts`: **38/38 PASS**; `npm run build`: **PASS** (existing Vite large-chunk advisory).
- Overall completion remains approximately **41%**; this fixes one physical inconsistency and does not close the broader visual, performance or release requirements.
- Continued the same Revision-6 Breakwater audit: grounded the exhaust stack/cap on the raised deck and added collision proxies for both, the two mooring bollards and four torn rails. Legacy revision geometry and collider sets remain unchanged; regression coverage checks the proxy count, exhaust alignment and actual Rapier blocking at the stack.
- Final block validation: `npm test` **566/566 PASS** (58 files), `npm run build` **PASS** (existing >500 kB Vite chunk advisory), `git diff --check` PASS. This extends the physical consistency audit but leaves the terrain/material/weather/performance and release work open; overall estimate moves to approximately **42%**.

## Breakwater cargo collision dimensions — 2026-10-08

- The two visible cargo containers used full dimensions `3.1 × 1.5 × 1.64 m`, while their collision half-extents covered only about half that size. Matched the oriented proxies to each actual box so the top, long sides and ends are all solid. This preserves their deterministic POI positions and save data; the existing four-side Rapier movement regression now exercises the model-sized bounds.
- Focused `tests/world-art.test.ts`: **38/38 PASS**; full `npm test`: **566/566 PASS** (58 files); `npm run build`: **PASS** (existing Vite large-chunk advisory); `git diff --check`: PASS. This is another targeted physical correction, not completion of the remaining material, terrain, weather, performance or release requirements. Estimated overall completion: approximately **43%**.
- Screenshot-free local Chrome/SwiftShader smoke after this physical/material branch checkpoint created an isolated Gen-5 Revision-6 world (8 POIs, 3 horizon layers), stepped through day/evening/night and clear/rain/fog/storm, and applied LOW/MEDIUM/HIGH/ULTRA presets. App, shader startup and all transitions completed with zero page/console errors; the temporary Vite server was stopped. SwiftShader FPS and per-preset triangle samples varied during warm-up and are not used as a performance comparison.

## Procedural terrain texture seam reduction — 2026-10-08

- Added a deterministic edge feather to generated terrain ground textures after their procedural grain and marks are drawn. Opposing edge texels now match across both axes, reducing visible seams when grass, dry ground, sand, dirt, rock and snow maps repeat; terrain geometry, world layout and save state are unchanged.
- `tests/terrain-materials.test.ts`: **8/8 PASS**, including repeated-seed equality, edge equality and retained texture variation. `npm run build`: **PASS** (existing >500 kB Vite chunk advisory); `git diff --check`: **PASS**.
- This closes one narrow material tiling issue. Overall v0.14 visual/physical scope remains incomplete; performance comparison, broad visual/physical QA and release gates are still open. Main, tags and Pages remain unchanged.
- Revision-6 steep terrain now blends its triplanar grass/dry-soil/mud projections toward the shader's already-sampled triplanar rock field. This makes exposed slopes read more geologically without extra texture samples or changes to terrain height/layout; legacy revisions are unchanged. `terrain-materials` + `world-overhaul`: **23/23 PASS**; production build and diff check PASS. Browser world QA reached the menu but stalled before New Game entered gameplay; it was stopped after two minutes, so runtime shader QA remains unverified.
- Follow-up isolated Chromium/Metal runtime smoke used the same default seed and the same New Game/save-slot controls without screenshots. It reached `playing` in under 5 seconds and recorded zero page or console errors, confirming the updated world material shader initializes in WebGL. The longer `test:world` harness still stalls at the menu/New Game transition and remains an unresolved QA-harness issue; no full world scenario result is claimed.

## Gen-5 save/reload material disposal regression — 2026-10-08

- Fixed the actual Revision-6 reload failure: `MeshStandardMaterial.clone()` JSON-copies `userData`, converting the shared PBR texture metadata into plain objects. On world replacement, `Environment.dispose()` attempted to call `.dispose()` on those objects, then Rapier initialization failed. `materialWithSurfaceFamily()` now rebuilds its texture ownership list from the clone's live material maps, and environment disposal deduplicates and checks every supported texture map plus valid metadata textures.
- Updated `test:world` to set the known menu-preview seed `731942`; blank seed selected a random world and forced a redundant full generation/shader warm-up that made the harness appear hung. This keeps all scenarios while making New Game deterministic.
- Full screenshot-free `npm run test:world`: **23/23 checks PASS**, zero page/console errors. It covered Generation 5 Revision 6 layout, roads/map/biomes, storm, fall damage, Gen-5 save/reload identity, Generation-4 save compatibility, and Testing Mode God Mode. The previous run exposed both the disposal error and Rapier null-pointer follow-up; neither recurred.
- Focused `weather-materials`, `terrain-materials`, and `world-art` tests: **51/51 PASS**; `npm run build`: **PASS** (existing large-chunk advisory); QA script syntax and `git diff --check`: PASS. No screenshots created; local Vite server stopped. Release/tag/Pages unchanged.
- Overall goal estimate: approximately **45%**. Visual/material audits, terrain/rocks/vegetation/atmosphere upgrades, matched v0.13 performance and final release gates remain incomplete.
