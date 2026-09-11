# Tideland changelog

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
