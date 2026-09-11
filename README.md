# Tideland

Tideland is an original, procedural first-person island survival sandbox built with TypeScript, Vite, Three.js, Rapier 3D, and a DOM-based interface. It uses no extracted game assets or branding.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The production checks are:

```bash
npm test
npm run build
```

## Controls

- `WASD` move, mouse look, `Shift` sprint, `Space` jump, `C` or `Ctrl` crouch
- `E` interact, left click gather/use, `1–6` select the quick belt
- `Tab` inventory and crafting, `B` building plan, `Q` piece, `R` rotate
- Left click places a building piece, right click cancels, `Esc` pauses
- `F3` opens development telemetry and test controls

Worlds, settings, inventory, crafting, structures, doors, dropped items, and depleted resource nodes persist locally in the browser.

## Polish validation

Current implementation notes, coverage and limitations: [POLISH-STATUS.md](POLISH-STATUS.md).
Screenshot gallery: [artifacts/polish/index.html](artifacts/polish/index.html).

With the dev server running, `npm run test:browser` runs isolated Chrome gameplay,
UI and multi-level persistence checks. `node scripts/polish-settings-qa.mjs` checks
settings persistence, crafting capacity UI and a dense forest view. Set `CHROME_BIN`
if Chrome is not installed at the default macOS application path.

## Camera and field of view

Settings use horizontal FOV at a 16:9 reference aspect, 60–100 degrees (default 90). The renderer converts this to Three.js vertical FOV and preserves vertical coverage when resizing; ultrawide displays show more on the sides. Existing numeric preferences now follow this convention. Changes apply live and persist. Sprint adds a smooth 2-degree offset. Held items use a separate fixed 50-degree vertical camera, so world FOV does not stretch them.

Run `node scripts/camera-fov-qa.mjs` with the Vite server running for camera/persistence/aspect regression checks. Open `artifacts/camera-fov/index.html` for exact-pose screenshot comparisons.


## Version

Current release: **0.2.0 / EA-02** (2026-09-11).

Development history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) and is also visible from the in-game **HISTORY** menu.
