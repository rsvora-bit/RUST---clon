export const GAME_VERSION='0.2.2';
export const GAME_BUILD='EA-02.2';
export const GAME_RELEASE_DATE='2026-09-11';

export interface ChangeEntry {version:string;date:string;title:string;changes:string[]}
export const CHANGELOG:ChangeEntry[]=[
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
