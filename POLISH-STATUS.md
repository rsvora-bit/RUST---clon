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
