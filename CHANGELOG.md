## v0.7.4 / EA-07.4 — Seeded world variety, loot & developer tools (2026-09-13)

- Added generation 3 with deterministic seed-based starter spawn/clearing and fresh random seeds for blank New World creation. Existing generation 1/2 saves keep their old world layout.
- Added multiple seeded rain collectors plus sixteen scattered salvage crates with common, decent and rare lucky loot tables.
- Added distinct stone, metal ore, sulfur ore and high-quality metal ore deposits with random seed-driven distribution and original procedural mineral styling.
- Removed the oversized relay tower and the accidental-looking world-space trail ribbon; trails remain on the island map only.
- Replaced timer-based V-Sync OFF scheduling with a MessageChannel uncapped render submission loop.
- Added F3 Fly Mode, God Mode and Heal/Vitals development controls.
- Added an explicit Back button to save management and fixed History/Help overlays remaining visible after entering gameplay or Settings.

## v0.7.3 / EA-07.3 — Save controls, frame sync & gathering polish (2026-09-13)

- Fixed per-slot delete/overwrite confirmation overlays so their buttons receive pointer input; added an explicit close button.
- Added persistent V-Sync control. ON follows display-synchronized animation frames; OFF uncaps game-loop submissions within browser limits.
- Increased material-specific harvesting particle density and variation for wood, stone, metal, fiber and berries.
- Increased gatherable loose-wood and berry-bush spawns across procedural islands.
- Documented the rendering-stability foundation already merged to main: depth-based AO, substantially lower vegetation draw/triangle load and corrected Render Scale canvas sizing.

## v0.7.2 — Settings navigation & telemetry polish (2026-09-12)

- Fixed Settings escape/back navigation and restyled utility buttons so browser-default white controls cannot leak into the UI.
- Rebuilt F3 telemetry into modular Performance, Player, Camera and World panels.
- Added telemetry size, opacity and per-module visibility settings.
- Upgraded the compact FPS chip with frame time.
- Intentionally leaves world graphics unchanged for the next dedicated graphics pass.

## v0.7.1 / EA-07.1 — UI reliability & graphics controls

- Fixed individual save-slot deletion and immediate save-browser refresh.
- Rebuilt the pause menu into a larger, clearer in-game surface.
- Fixed FPS/tutorial ON/OFF toggles and persistence.
- Reverted unstable custom grass vertex fading and reduced default foliage density.
- Added foliage density, shadow quality/distance and post-processing/SSAO/bloom controls.

# Tideland changelog

## 0.7.0 — 2026-09-11

Classic menu, save-slot and interface settings overhaul.

- Restored the original left-aligned Tideland menu style, modernized with clearer state/meta information instead of the large dashboard-like v0.3 panel.
- Added five independent local save slots with seed, playtime, structure count and saved-time metadata.
- Added load/new/manage save flows with per-slot overwrite and deletion confirmation.
- Fixed deleted active saves being silently recreated by the 60-second autosave or main-menu transition.
- Added HUD scale, HUD opacity, crosshair size, FPS counter and tutorial-hint controls.
- Added world brightness/exposure control and kept all new interface preferences persistent per browser.

## 0.6.0 — 2026-09-11

Environment graphics overhaul.

- Expanded grass/dirt/rock/sand terrain blending with wet shoreline sand and stronger close-range detail.
- Added tree color variation, ferns, fallen twigs, dry meadow tufts and low-cost ground decals.
- Improved procedural rock relief and shoreline detail with seaweed, driftwood and pebbles.
- Reworked water with multi-scale wave normals, reflected sky tones, shallows and animated shoreline foam.
- Improved distance fog, shadows, layered clouds, moonlight sky detail and night stars.
- Added High/Ultra SSAO/contact shading, subtle bloom and color grading while keeping Low/Medium on the direct renderer path.

## 0.5.0 — 2026-09-11

Gathering and weak-spot overhaul.

- Added world-space tree hit marks, a red X weak spot and 50% bonus yield for accurate follow-up hits.
- Added stone/metal sparkle weak spots using the same skill-hit loop.
- Moved wood/stone/metal particles to the real impact point and increased material-specific burst readability.
- Increased visible tree/resource hit reaction, especially on weak-spot strikes.
- Extended final tree falls with a ground-rest phase plus procedural creak and crash audio.
- Added distinct harvesting sounds for rock, hatchet and pickaxe.
- Rebalanced harvestables around explicit per-tool resource gain on each hit.

## 0.4.0 — 2026-09-11

Movement, camera feel and first-person animation overhaul.

- Added tuned acceleration/deceleration, stronger reverse braking and restrained air control.
- Reduced sprint FOV kick to a subtle `0.85°`, with smooth crouch transitions, landing bob and light walking sway.
- Made mouse-look accumulation independent of render-frame batching while retaining burst protection.
- Added jump cooldown, survival-FPS crouch/sprint restrictions and remappable auto-run (`Caps Lock` by default).
- Added speed- and surface-aware footsteps for coast sand, grassland, forest, rocky terrain and timber structures.
- Rebuilt the procedural first-person rig with persistent hands and more physical rock, hatchet, pickaxe and torch presentation.
- Added item-specific swing arcs, equip/unequip transitions, mouse-driven tool sway, sprint pose, hit recoil and inspect (`X` by default).

## 0.3.0 — 2026-09-11

Game menu, settings and Czech localization update.

- Rebuilt the main menu as a full-screen game surface over the live island with a dark translucent panel and prominent Play action.
- Added `PLAY GAME → NEW GAME / CONTINUE / LOAD` and a safety confirmation before starting over an existing local world.
- Split settings into Gameplay, Controls, Graphics and Audio pages.
- Added functional keybind remapping and independent horizontal/vertical mouse sensitivity.
- Added world/viewmodel FOV, head bob, camera shake and lightweight motion blur controls.
- Added Low, Medium, High and Ultra graphics presets.
- Added independent Master, Music, Effects and Ambient volume controls.
- Added persistent EN/CZ language switching for the main menus, settings and common HUD labels/actions.

## 0.2.4 — 2026-09-11

Survival HUD overhaul.

- Reworked health, water and food into compact survival-game status panels with warning/critical states.
- Rebuilt the quick belt with a stronger selected slot, cleaner numbering and condition strips for tools.
- Made interaction prompts action-first and added gathering hit feedback at the reticle.
- Added damage/low-health screen feedback plus contextual Wet and Cold indicators.
- Added a live gameplay crafting queue with progress and remaining time.
- Resource gains now use icon-based pickup notifications instead of generic text-only messages.
- Unified HUD typography, panel opacity, spacing and responsive layout while leaving developer telemetry behind F3.

## 0.2.3 — 2026-09-11

World startup and harvesting polish.

- Split procedural island population into real loading phases with browser paint/yield points between expensive generation passes.
- Expanded the loading screen to show Engine, Terrain, World, Physics, Systems and GPU Warm-up phases with live task details.
- Uses async shader compilation when available, warms eight camera headings and waits for stable frame pacing before gameplay begins.
- Reuses the already-prepared default menu island for a fresh game with the same seed instead of rebuilding it immediately.
- Fixed depleted resource synchronization so destroyed resource visuals are actually removed.
- Trees now fall away from the player on the final hit, remain on the ground briefly, then sink and disappear.

## 0.2.2 — 2026-09-11

Input stability and loading warm-up patch.

- Added a real staged world-loading meter with named phases and percentages.
- Pre-compiles shaders and renders warm-up frames before gameplay/menu is revealed.
- Mouse-look events are coalesced once per display frame instead of changing the camera for every browser event.
- Caps accumulated mouse bursts after stalls to prevent sudden camera jumps.
- Normalizes pointer movement for high-DPI/Retina displays.
- Sensitivity now ranges from `0.05×` to `2.50×` with a lower base rotation scale.
- Resets FPS timing after warm-up so shader compilation no longer appears as sustained low startup FPS.

## 0.2.1 — 2026-09-11

Cross-device camera/settings patch.

- Preserved the current world FOV behaviour that is working correctly on the Windows reference build.
- Added held-item/viewmodel FOV, invert Y and optional head bob.
- Added render scale, dynamic shadows, crosshair opacity and compass controls.
- Added Reset Camera, Reset Settings and Reload Latest Build controls.
- Added version/build identification to F3 telemetry for PC/Mac comparison.
- Existing settings migrate to safe defaults for the new fields; world saves are untouched.

## 0.2.0 — 2026-09-11

Reconciliation update combining the useful local Codex work with the newer GitHub camera/movement and Pages fixes.

- Restored direct vertical FOV control (`60°–100°`) so the setting has the strong, immediate effect expected from the original build.
- Preserved the corrected yaw-based WASD movement fix.
- Completed station placement collision checks against resources, player structures, survival stations and landmarks.
- Stations clear grass under their footprint and the world has a 500-station safety limit.
- Improved landmark placement/spacing and safer debug teleporting to POIs.
- Smoother independent rain/fog/storm transitions and animated station fire.
- Added workbench-specific recipes and cleaner first-person handling of station kits.
- Added GitHub Pages auto-deployment, visible version/build information and an in-game History panel.
- Expanded survival browser QA for station placement and persistence.

## 0.1.0 — 2026-09-08

Initial early-access survival foundation: procedural island, gathering, crafting, building, stations, weather, local saves, map/waypoints, first-person viewmodel, diagnostics and QA tooling.
