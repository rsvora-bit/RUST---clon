# Tideland changelog

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
