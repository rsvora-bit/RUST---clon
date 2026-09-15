export const GAME_VERSION='0.9.0';
export const GAME_BUILD='EA-09.0';
export const GAME_RELEASE_DATE='2026-09-15';

export interface ChangeEntry {version:string;date:string;title:string;changes:string[]}
export const CHANGELOG:ChangeEntry[]=[
  {version:'0.9.0',date:'2026-09-15',title:'World Overhaul Part I',changes:[
    'Added generation 5: a 1280-m deterministic archipelago with irregular coasts, satellite islands, broad ridges, valleys and a protected starter shelf while generations 1–4 remain compatible.',
    'Added coherent temperate forest, grassland, arid, alpine, rocky-mountain and coastal climate regions with biome-aware procedural terrain, palms, conifers and bounded vegetation.',
    'Added terrain-following roads between established POIs plus a cached topographic island survey with biome colors, hillshade, grid coordinates, pan/zoom and persistent markers.',
    'Expanded the procedural sky, storm ocean and layered distant horizon, and added landing-transition fall damage with teleport and God Mode safety.',
    'Added generation, world-size, terrain, biome and landing telemetry plus deterministic world/save regression coverage.'
  ]},
  {version:'0.8.0',date:'2026-09-14',title:'Tech Tree & Workbench Progression',changes:[
    'Added persistent Workbench research knowledge with atomic Scrap transactions, prerequisites and legacy v0.7.9 migration by highest existing Workbench.',
    'Added the original Tideland Tech Tree UI with readable locked, available and unlocked states plus Workbench tier requirements.',
    'Added recipe locks for improved tooling, Workbench II/III, Field Medicine, Advanced Fabrication and Workshop Lighting while preserving essential starter recipes.',
    'Tech knowledge survives save/reload, death and Lost Pack recovery while physical Workbench proximity remains required for advanced crafting.'
  ]},
  {version:'0.7.9',date:'2026-09-14',title:'Salvage Economy & Recycler',changes:[
    'Added Scrap plus Wiring, Gears, Machine Parts and rare Tech Parts as original exploration-economy items with tiered salvage-cache distribution.',
    'Added two deterministic world Salvage Recyclers at the Coastal Utility Shack and Quarry Outpost with protected component inputs and Scrap/Metal outputs.',
    'Added atomic, timed and persistent recycler jobs that survive save/reload without consuming input twice or losing components to full outputs.',
    'Added a one-time economy bootstrap for v0.7.8 worlds using stable supplemental cache IDs without rewriting existing containers.',
    'Separated player-placeable, bounded world-station and Lost Pack limits while preserving furnace, campfire, death recovery and building persistence.'
  ]},
  {version:'0.7.8',date:'2026-09-14',title:'Death, Respawn & Lost Pack',changes:[
    'Added an idempotent persistent death transaction that moves carried slots into one original Lost Pack while preserving crafting, stations and world drops.',
    'Added dead-save/reload restoration, a reusable player damage API and modal WASHED AWAY context without inventory rollback exploits.',
    'Added collision-aware Sleeping Roll respawn with shore fallback, clean movement/tool reset and the shared Rock + Torch survivor kit.',
    'Added persistent Lost Pack map markers, procedural field-pack rendering and shared disposable-container cleanup for Lost Packs and salvage caches.',
    'Supports up to five deterministic Lost Packs and removes renderer, Rapier collider, interaction target and save data after final recovery.'
  ]},
  {version:'0.7.7',date:'2026-09-13',title:'Building Grades & Hammer',changes:[
    'Added Wood, Stone and Metal grades with 250 / 600 / 1000 durability, distinctive procedural geometry/material treatments and piece-specific upgrade costs.',
    'Added the craftable Builder\'s Hammer with an original icon, first-person model, equip motion and a compact RMB maintenance interface.',
    'Added atomic upgrades, proportional 25% repairs, one-second hold demolition and safe door-hinge rotation.',
    'Added a reusable damageStructure API that removes destroyed structures, descendant pieces, colliders, interaction targets and stale sockets through the existing synchronization path.',
    'Migrates v0.7.6 structures without grade or currentHealth to full-health Wood while preserving door and building persistence.'
  ]},
  {version:'0.7.6',date:'2026-09-13',title:'Loot cache breakup & harvesting interaction fixes',changes:[
    'Emptied salvage caches now break apart into visible pieces, collapse and disappear after the final item is removed, and the depleted cache is removed from the saved world.',
    'Harvestable trees and mineral nodes keep their clean target names while restoring remaining / maximum HP and a compact durability bar.',
    'Interact/E is now reserved for pickups and world interactions; trees and mineral nodes can only be harvested with the primary attack input.',
    'Reworked tree/resource hit wobble to animate from the immutable base instance matrix so trees no longer blink out or temporarily vanish after a strike.',
    'Station synchronization now cleans stale interaction and physics entries when disposable loot caches are consumed.'
  ]},
  {version:'0.7.5',date:'2026-09-13',title:'Expanded island, cleaner resource HUD & horizon pass',changes:[
    'Added world generation 4 with a substantially larger irregular coastline, multiple separated hill/ridge systems and seed-dependent starter shores instead of one dominant central mound.',
    'Reduced decorative boulder density on generation 4 and added spacing checks so trees, boulders and harvestable mineral nodes no longer spawn through one another.',
    'Simplified hit-resource prompts to large resource names such as Metal Ore, Sulfur Ore and High Quality Metal Ore instead of the old GATHER/deposit/remaining block.',
    'Expanded generation-4 vegetation and resource distribution farther toward the new coastline while keeping older save generations spatially unchanged.',
    'Added an original procedural distant-mountain horizon backdrop plus an extra high cloud veil to give the ocean skyline more depth without copying external game assets.',
    'Added persistent active-state highlighting for F3 Fly Mode and God Mode controls.'
  ]},
  {version:'0.7.4',date:'2026-09-13',title:'Seeded world variety, loot & developer tools',changes:[
    'Added world generation 3 with deterministic seed-based starter shores and made blank New World creation generate a fresh random seed while preserving generation 1/2 saves.',
    'Added seeded rain collectors and sixteen scattered salvage crates with common, decent and rare lucky loot tiers.',
    'Added distinct stone, metal ore, sulfur ore and high-quality metal ore deposits with seeded random distribution and original procedural mineral styling.',
    'Removed the oversized relay scaffold and the visible world-space trail ribbon; map trails remain available only on the island survey.',
    'Replaced the timer-limited V-Sync OFF loop with a MessageChannel uncapped scheduler and added F3 Fly, God and Heal developer controls.',
    'Replaced the save-manager close glyph with an explicit Back control and made History/Help overlays close automatically when the screen changes.'
  ]},
  {version:'0.7.3',date:'2026-09-13',title:'Save controls, frame sync & gathering polish',changes:[
    'Fixed save-slot confirmation overlays inheriting disabled pointer events; Delete, Cancel and the new close button now work reliably.',
    'Added a persistent V-Sync setting: ON uses display-synchronized animation frames, while OFF uncaps game-loop submissions within browser limits.',
    'Strengthened material-specific harvesting particles for wood, stone, metal, fiber and berries with a larger pooled effect budget.',
    'Increased procedural gatherable loose-wood and berry-bush availability while keeping decorative foliage density separate.',
    'Documented the current rendering-stability foundation already on main: depth-based AO, lower vegetation draw/triangle load and corrected Render Scale canvas sizing.'
  ]},
  {version:'0.7.2',date:'2026-09-12',title:'Settings navigation & telemetry polish',changes:[
    'Reworked Settings navigation with a compact themed back control and Escape fallback so the player cannot get trapped in Settings.',
    'Standardized Settings action buttons so Manage Saves and other controls no longer fall back to bright browser-default styling.',
    'Redesigned the F3 developer telemetry into separate Performance, Player, Camera and World modules.',
    'Added telemetry size, opacity and per-module visibility controls while keeping the lightweight FPS chip independently configurable.',
    'Improved the FPS chip with frame time and clearer visual hierarchy without changing world rendering.'
  ]},
  {version:'0.7.1',date:'2026-09-12',title:'UI reliability & graphics controls patch',changes:[
    'Fixed per-slot delete confirmation so the selected local world is removed, the save browser refreshes immediately and active autosave detaches safely.',
    'Rebuilt the in-game pause surface into a larger survival-game menu with direct save management and clearer actions.',
    'Fixed FPS counter and tutorial-hint toggles so ON/OFF state updates immediately and persists correctly.',
    'Reverted grass to a stable material path to eliminate driver-dependent black/collapsed vegetation artifacts.',
    'Expanded graphics settings with foliage density, independent shadow quality/distance and post-processing, ambient-occlusion and bloom controls.'
  ]},
  {version:'0.7.0',date:'2026-09-11',title:'Classic menu, save slots & HUD settings',changes:[
    'Restored the original left-aligned Tideland menu language with a cleaner modern survival-game presentation.',
    'Added five independent local world save slots with timestamps, seed/playtime metadata, loading and per-slot deletion.',
    'Fixed deleted worlds being recreated by background autosave by detaching a deleted active slot from the live session.',
    'Added a save manager and explicit confirmations for overwriting one slot or deleting all local worlds.',
    'Added HUD scale and opacity controls plus crosshair size, optional FPS counter and tutorial-hint visibility.',
    'Added world brightness/exposure control while preserving the existing graphics quality and render-scale system.'
  ]},
  {version:'0.6.0',date:'2026-09-11',title:'Environment graphics overhaul',changes:[
    'Expanded terrain material blending with dedicated dirt, wet shoreline sand and stronger close-range procedural surface detail.',
    'Added more tree bark/canopy variation plus instanced ferns, fallen twigs, dry meadow tufts and terrain decals.',
    'Improved procedural rock relief and enriched the shoreline with denser pebbles, driftwood and tidal seaweed.',
    'Reworked ocean shading with multi-scale wave normals, sky reflection, shallows and animated shoreline foam.',
    'Upgraded the sky with layered moving clouds, stronger horizon depth, stars and a moon opposite the sun.',
    'Improved dynamic distance fog and shadow quality, including a higher-resolution Ultra shadow profile.',
    'Added quality-gated screen-space ambient occlusion/contact shading, restrained highlight bloom and color grading on High/Ultra.',
    'Kept Low/Medium on the direct renderer path so the visual upgrade does not force expensive post-processing on slower hardware.'
  ]},
  {version:'0.5.0',date:'2026-09-11',title:'Gathering & weak-spot overhaul',changes:[
    'Added visible impact marks and stronger material-specific wood, stone and metal particles at the actual strike point.',
    'Trees now reveal a red weak-spot X after the first hit; landing the next strike on it grants a 50% resource bonus and moves the target.',
    'Stone and metal deposits now reveal a glowing sparkle weak spot with the same skill-hit bonus loop.',
    'Made resource nodes react more visibly to impacts, with stronger shake on successful weak-spot hits.',
    'Extended the final tree fall so the trunk visibly falls, rests on the ground and then sinks away, backed by a creak and heavy crash.',
    'Added distinct procedural harvesting audio for rock, hatchet and pickaxe impacts.',
    'Rebalanced tree, stone and metal gathering to use explicit per-tool resource yields on every individual hit.'
  ]},
  {version:'0.4.0',date:'2026-09-11',title:'Movement & first-person animation overhaul',changes:[
    'Added tuned acceleration, deceleration, reverse response and restrained in-air steering instead of instant ground-speed changes.',
    'Reduced the sprint FOV kick to a subtle 0.85 degrees and added smooth crouch, landing bob and walking camera sway.',
    'Made mouse-look accumulation independent of render-frame batching while keeping per-event burst protection.',
    'Added jump cooldown, survival-FPS crouch/sprint restrictions and remappable auto-run.',
    'Added speed- and surface-aware procedural footsteps for sand, grass, forest, rock and timber structures.',
    'Rebuilt the procedural first-person rig with persistent hands, item-specific rock/hatchet/pickaxe poses and torch motion.',
    'Added equip/unequip transitions, mouse-driven tool sway, sprint lowering, contact recoil and a remappable inspect animation.'
  ]},
  {version:'0.3.0',date:'2026-09-11',title:'Game menu, settings & Czech localization',changes:[
    'Rebuilt the main and pause menus as a full-screen game interface over the live world with a prominent Play flow.',
    'Added Play Game with New Game, Continue and Load actions plus a confirmation step before replacing an existing world.',
    'Split settings into Gameplay, Controls, Graphics and Audio pages.',
    'Added real keybind remapping and separate horizontal/vertical mouse sensitivity.',
    'Added camera shake and motion-blur toggles alongside world and viewmodel FOV and head bob.',
    'Added Low, Medium, High and Ultra graphics presets.',
    'Added independent Master, Music, Effects and Ambient audio channels.',
    'Added persistent English/Czech interface switching across the main game menus and common HUD labels.'
  ]},
  {version:'0.2.4',date:'2026-09-11',title:'Survival HUD overhaul',changes:[
    'Rebuilt the live vitals HUD into compact health, water and food panels with warning and critical states.',
    'Reworked the quick belt with a stronger active slot, cleaner numbering and tool-condition strips.',
    'Reframed world interactions around the action itself, with compact key prompts and progress feedback.',
    'Added center-screen resource hit feedback driven by real gathering results and depleted-node events.',
    'Added damage vignette, persistent low-health pressure and contextual wet/cold environment indicators.',
    'Added a live crafting queue to the gameplay HUD with item icons, timers and progress bars.',
    'Converted resource notifications into compact icon-based pickup toasts.',
    'Unified HUD spacing, typography, translucency and responsive behaviour for a more game-like presentation.'
  ]},
  {version:'0.2.3',date:'2026-09-11',title:'World startup & harvesting polish',changes:[
    'Split procedural world population into visible loading phases that yield between expensive generation steps.',
    'Expanded the loading screen with six pipeline phases, live task detail and GPU warm-up status.',
    'Pre-compiles shaders, warms multiple camera headings and waits for stable frame pacing before gameplay begins.',
    'Reuses the already prepared default menu island when starting a fresh game with the same seed.',
    'Fixed depleted resource visuals so destroyed nodes reliably disappear instead of remaining in the world.',
    'Trees now fall away from the player, rest briefly, then sink/fade out after the final harvesting hit.'
  ]},
  {version:'0.2.2',date:'2026-09-11',title:'Input stability & loading warm-up',changes:[
    'Added real staged loading progress and renderer warm-up before the world is revealed.',
    'Mouse look is now coalesced once per render frame instead of applying every browser event immediately.',
    'Large pointer-lock bursts are capped so a short browser or GPU stall cannot throw the camera sideways.',
    'Mouse deltas are normalized for high-DPI displays to make Windows and Retina behaviour more consistent.',
    'Expanded sensitivity down to 0.05x and reduced the base look scale for precise low-sensitivity play.',
    'Reset FPS timing after warm-up so startup compilation frames do not pollute the live FPS meter.'
  ]},
  {version:'0.2.1',date:'2026-09-11',title:'Cross-device camera & settings patch',changes:[
    'Kept the world FOV behaviour that is working correctly on the Windows reference build.',
    'Added separate held-item FOV, invert Y and optional head bob controls.',
    'Added render scale, dynamic shadow, crosshair opacity and compass controls.',
    'Added camera reset, full settings reset and a cache-busting Reload Latest Build action.',
    'Added the exact game version/build to developer telemetry for cross-device debugging.',
    'Old saved settings migrate safely to the expanded settings model without touching world saves.'
  ]},
  {version:'0.2.0',date:'2026-09-11',title:'Reconciliation update',changes:[
    'Merged the useful unfinished local Codex work into the GitHub build.',
    'Restored direct, clearly visible vertical FOV control from 60° to 100°.',
    'Kept the corrected yaw-based first-person movement so W follows the camera heading.',
    'Improved station placement collision checks against structures, landmarks and resources.',
    'Stations now clear grass beneath their footprint and enforce a safe world station limit.',
    'Improved procedural landmark spacing and safer POI teleport/debug positioning.',
    'Added smoother independent rain, fog and storm transitions plus animated station flames.',
    'Added workbench-specific recipes and cleaner held-item behaviour for station kits.',
    'Added automatic GitHub Pages deployment, visible versioning and this in-game history panel.'
  ]},
  {version:'0.1.0',date:'2026-09-08',title:'Early access foundation',changes:[
    'Procedural island survival loop with gathering, crafting, building and local saves.',
    'Inventory, stations, weather, map/waypoints, structures, tools and first-person viewmodel.',
    'Performance/visual polish, diagnostics and deterministic browser QA tooling.'
  ]}
];
