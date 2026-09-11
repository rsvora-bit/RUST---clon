# Tideland

> **Active development repository.** All new Tideland work continues here.

Tideland is an original procedural first-person island survival sandbox built with TypeScript, Vite, Three.js, Rapier 3D, and a DOM-based interface.

**Current release:** `v0.2.3 / EA-02.3` — 2026-09-11

The previous school-repository copy is kept only as a stable snapshot at [`rsvora-bit/it3b_prog_/Projekty/Tideland`](https://github.com/rsvora-bit/it3b_prog_/tree/main/Projekty/Tideland).

## Run locally

```bash
npm install
npm run dev
```

Production validation:

```bash
npm test
npm run build
```

Browser gameplay QA can be run with:

```bash
npm run test:browser
```

## Controls

- `WASD` move, mouse look, `Shift` sprint, `Space` jump, `C` or `Ctrl` crouch
- `E` interact, left click gather/use, `1–6` select the quick belt
- `Tab` inventory and crafting, `B` building plan, `Q` cycle piece, `R` rotate
- Left click places a building piece, right click cancels, `Esc` pauses
- `F3` opens developer telemetry and test controls

Worlds, settings, inventory, crafting, structures, doors, dropped items, depleted resource nodes and survival progression persist locally in the browser.

## Camera, settings and performance

The current world FOV and yaw-based movement are kept on the proven gameplay path. Held-item FOV is configured separately. Settings also include mouse sensitivity, invert Y, head bob, render scale, shadows, crosshair opacity and compass visibility.

Mouse look uses frame-coalesced input with burst protection to avoid large camera jumps after browser/GPU stalls. Startup uses staged world loading plus renderer/shader warm-up before gameplay is revealed.

## Development history

Release history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) and is also visible from the in-game **HISTORY** menu. Implementation notes and QA status live in [`POLISH-STATUS.md`](./POLISH-STATUS.md).

From `v0.2.3` onward, this repository is the canonical source for new Tideland development.
