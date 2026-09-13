<div align="center">

# 🌊 TIDELAND

### Procedural first-person island survival — built for the browser

**Explore. Gather. Build. Survive.**

[![Version](https://img.shields.io/badge/version-v0.7.4%20%7C%20EA--07.4-2ea44f?style=for-the-badge)](./CHANGELOG.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Tideland CI](https://github.com/rsvora-bit/RUST---clon/actions/workflows/tideland-ci.yml/badge.svg)](https://github.com/rsvora-bit/RUST---clon/actions/workflows/tideland-ci.yml)

**Current release:** `v0.7.4 / EA-07.4` · **13 September 2026**

> Active development repository. All new Tideland development continues here.

</div>

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
- Procedural island terrain and biomes
- Forests, grass, rocks, resources and coastal detail
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
- Doors and persistent structures
- Workbench progression and crafting requirements
- Survival stations and station upgrades

### 🎒 Player & UI
- Inventory and quick belt
- Crafting queue
- First-person hands with animated held tools, equip transitions, sway, sprint pose and inspect
- Tuned acceleration/deceleration, air control, crouch transitions and landing response
- Configurable FOV and viewmodel FOV
- Frame-rate independent mouse look, separate X/Y sensitivity, auto-run, invert Y and head bob settings
- Speed- and surface-aware footsteps
- Five local save slots with per-slot load/delete management
- HUD scale/opacity, crosshair size, FPS counter and tutorial visibility settings
- Render scale, brightness, V-Sync/frame pacing, shadows, compass and crosshair settings
- Map, waypoints, diagnostics and developer telemetry with fly/god/vitals controls

### 💾 Persistence
The browser locally persists worlds, settings, inventory, crafting, structures, doors, drops, depleted resource nodes and survival progression.

---

## 🚀 Current development focus

**v0.7.x** is focused on menu usability, multi-save persistence and player-configurable interface scale.

- ✅ Tuned acceleration/deceleration, air control, crouch transitions and landing response
- ✅ Frame-rate independent mouse-look accumulation and burst protection
- ✅ Subtle sprint FOV response and movement camera sway
- ✅ Auto-run plus survival-FPS crouch/sprint restrictions
- ✅ Animated hands/tools with swing, recoil, sway, sprint pose and inspect
- ✅ Speed- and surface-aware procedural footsteps
- ✅ Tree X weak spots, rock sparkle targets and per-hit bonus yields
- ✅ Tool-specific gathering audio and material impact particles
- ✅ Rich terrain blending, understory vegetation, decals and shoreline detail
- ✅ Improved ocean, layered sky/clouds and distance fog
- ✅ High/Ultra SSAO, subtle bloom and color grading with Low/Medium performance fallback
- ✅ Detailed staged world loading and GPU warm-up
- ✅ Expanded settings, localization and diagnostics
- ✅ Reliable multi-save confirmation controls, explicit Back navigation and auto-closing History overlays
- ✅ Seed-driven generation 3 spawns, scattered rain collectors and tiered salvage crates
- ✅ Stone, metal, sulfur and high-quality metal mineral node variants with seeded random distribution
- ✅ Optional V-Sync/frame pacing with an uncapped OFF scheduler plus F3 fly/god/vitals tools
- ✅ Denser gatherable loose wood/berry resources
- ✅ Current rendering-stability foundation with depth-based AO and reduced vegetation render cost
- ✅ Automated CI validation and GitHub Pages deployment

---

## 🗺️ Roadmap

### `v0.2.x` — Foundation & stability
Performance, input, loading, persistence, building reliability, resource behaviour and debugging tools.

### `v0.3.x` — Menu & settings foundation
Game-style main/pause menus, tabbed settings, remappable controls, graphics/audio controls and EN/CZ localization.

### `v0.4.x` — Movement & first-person feel
Acceleration/deceleration, crouch and landing transitions, air control, footsteps, auto-run, first-person hands and tool animation.

### Future
- Graphics, terrain, vegetation, water, lighting and atmosphere overhaul
- Deeper crafting and progression
- More meaningful landmarks and exploration
- Better building variety
- Improved survival balancing
- More environmental interaction
- Expanded world events and points of interest
- Continued optimization for both Windows and macOS browsers

The roadmap is intentionally flexible. Features are added when they improve the core survival experience rather than simply increasing the feature count.

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
| Right click | Cancel building placement |
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

`EARLY ACCESS DEVELOPMENT · v0.7.3 / EA-07.3`

</div>
