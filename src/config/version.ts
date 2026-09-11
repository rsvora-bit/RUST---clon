export const GAME_VERSION='0.7.0';
export const GAME_BUILD='EA-07';
export const GAME_RELEASE_DATE='2026-09-11';

export interface ChangeEntry {version:string;date:string;title:string;changes:string[]}
export const CHANGELOG:ChangeEntry[]=[
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
