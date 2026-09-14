import {validateStations} from '../survival/stations';
import {normalizeFov} from '../camera/FirstPersonProjection';
import type { GameState, ItemStack, PlayerStats, SaveSlotSummary, Settings, Structure, Vec3 } from '../core/types';
import { DEFAULT_KEYBINDS, DEFAULT_SETTINGS } from '../config/balance';
import { BUILDING_RULES, INVENTORY, SAVE } from '../config/gameplay';
import { ITEMS, isItemId } from '../items/definitions';
import { RECIPES } from '../crafting/recipes';
import { PIECES, validateStructurePlacement } from '../building/rules';
import {migrateStructure} from '../building/grades';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, min = -1e6, max = 1e6): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => finite(value, min, max) && Number.isSafeInteger(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
const position = (value: unknown): value is Vec3 => record(value) && finite(value.x) && finite(value.y) && finite(value.z);
const stats = (value: unknown): value is PlayerStats => record(value) && ['health', 'hunger', 'thirst', 'stamina'].every(key => finite(value[key], 0, 100));
const stack = (value: unknown): value is ItemStack => record(value) && isItemId(value.itemId) && integer(value.count, 1, ITEMS[value.itemId].maxStack);

/** Reject the whole snapshot, rather than silently discarding the player's saved items. */
export function validateGameState(value: unknown): value is GameState {
  // The menu accepts ten digit seeds. Keep the complete safe-integer range
  // here so a valid custom island can be saved and continued later.
  if (!record(value) || value.version !== 1 || !integer(value.seed, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) || !finite(value.elapsed, 0, 1e10) || !finite(value.timeOfDay, 0, 24) || !integer(value.nextId, 1)) return false;
  if (value.worldGeneration !== undefined && value.worldGeneration !== 1 && value.worldGeneration !== 2 && value.worldGeneration !== 3 && value.worldGeneration !== 4) return false;
  if (!record(value.player) || !position(value.player.position) || !stats(value.player.stats) || !finite(value.player.yaw) || !finite(value.player.pitch, -Math.PI / 2, Math.PI / 2)) return false;
  if (!Array.isArray(value.inventory) || value.inventory.length !== INVENTORY.SLOTS || !value.inventory.every(item => item === null || stack(item)) || !integer(value.activeSlot, 0, INVENTORY.HOTBAR_SLOTS - 1)) return false;
  if (!Array.isArray(value.structures) || value.structures.length > BUILDING_RULES.MAX_STRUCTURES || !Array.isArray(value.drops) || value.drops.length > SAVE.MAX_DROPS) return false;
  const ids = new Set<string>();
  const parsedStructures: Structure[] = [];
  for (const entry of value.structures) {
    if (!record(entry) || !identifier(entry.id) || ids.has(entry.id) || typeof entry.pieceType !== 'string' || !Object.hasOwn(PIECES, entry.pieceType) || !position(entry.position) || !finite(entry.rotation) || !finite(entry.createdAt, 0, value.elapsed)) return false;
    if ((entry.parentId !== undefined && !identifier(entry.parentId)) || (entry.socketId !== undefined && !identifier(entry.socketId)) || (entry.open !== undefined && typeof entry.open !== 'boolean')) return false;
    if ((entry.parentId === undefined) !== (entry.socketId === undefined)) return false;
    if(entry.grade!==undefined&&!['wood','stone','metal'].includes(entry.grade as string))return false;
    if(entry.flipped!==undefined&&(entry.pieceType!=='door'||typeof entry.flipped!=='boolean'))return false;
    const expectedMax=({wood:250,stone:600,metal:1000}[(entry.grade??'wood') as 'wood'|'stone'|'metal']);
    if(entry.maxHealth!==undefined&&entry.maxHealth!==expectedMax)return false;
    const health=entry.currentHealth??entry.health??expectedMax;
    if(!finite(health,0,expectedMax)||entry.health!==undefined&&!finite(entry.health,0,expectedMax)||entry.currentHealth!==undefined&&!finite(entry.currentHealth,0,expectedMax))return false;
    if(entry.health!==undefined&&entry.currentHealth!==undefined&&entry.health!==entry.currentHealth)return false;
    const structure = entry as unknown as Structure;
    if (validateStructurePlacement({ ...structure, valid: true, reason: '', snapped: !!structure.socketId }, parsedStructures)) return false;
    ids.add(entry.id);
    parsedStructures.push(structure);
  }
  for (const entry of value.drops) {
    if (!record(entry) || !identifier(entry.id) || ids.has(entry.id) || !stack(entry.stack) || !position(entry.position)) return false;
    ids.add(entry.id);
  }
  if ([...ids].some(id => /^(structure|drop)-\d+$/.test(id) && Number(id.split('-')[1]) >= (value.nextId as number))) return false;
  if (!record(value.nodeChanges) || Object.keys(value.nodeChanges).length > SAVE.MAX_NODE_CHANGES || !Object.entries(value.nodeChanges).every(([id, remaining]) => identifier(id) && integer(remaining, 0, 1000000))) return false;
  if (!Array.isArray(value.craftQueue) || value.craftQueue.length > INVENTORY.MAX_CRAFT_QUEUE) return false;
  for (const job of value.craftQueue) {
    if (!record(job) || typeof job.recipeId !== 'string' || !Object.hasOwn(RECIPES, job.recipeId) || !finite(job.total, 0, 3600) || !finite(job.remaining, 0, job.total) || job.total !== RECIPES[job.recipeId].craftTime) return false;
  }
  if(value.progression!==undefined){const p=value.progression;if(!record(p)||p.version!==1||!validateStations(p.stations)||typeof p.lootGenerated!=='boolean'||!record(p.weather)||!['clear','rain','fog','storm'].includes(p.weather.kind as string)||!finite(p.weather.blend,0,1)||!finite(p.weather.remaining,0,3600))return false;
    const weather=p.weather;if(['rain','mist','storm'].some(k=>weather[k]!==undefined&&!finite(weather[k],0,1)))return false;
    if(p.spawnId!==undefined&&(typeof p.spawnId!=='string'||!p.stations.some(s=>s.id===p.spawnId&&s.kind==='bedroll')))return false;
    if(p.waypoint!==undefined&&(!record(p.waypoint)||!finite(p.waypoint.x,-360,360)||!finite(p.waypoint.z,-360,360)))return false;
    if(p.death!==undefined){const death=p.death;if(!record(death)||!integer(death.sequence,1)||!['dead','respawned'].includes(death.phase as string)||!position(death.position)||!finite(death.occurredAt,0,value.elapsed as number)||death.cause!==undefined&&(typeof death.cause!=='string'||death.cause.length>80)||death.packId!==undefined&&(typeof death.packId!=='string'||!p.stations.some(s=>s.id===death.packId&&s.kind==='deathbag')))return false;}
    for(const s of p.stations){if(ids.has(s.id))return false;ids.add(s.id);const generated=/^(?:station|deathbag)-(\d+)$/.exec(s.id);if(generated&&Number(generated[1])>=value.nextId)return false;}
  }
  return true;
}

interface SaveEnvelope {savedAt:number; state:GameState}
const slotKey=(slot:number):string=>`${SAVE.GAME_KEY}:slot:${Math.max(1,Math.min(SAVE.SLOT_COUNT,Math.trunc(slot)))}`;
function migrateState(state:GameState):GameState {const migrated=structuredClone(state);for(const structure of migrated.structures)migrateStructure(structure);return migrated;}
function decodeSave(raw:string|null):SaveEnvelope|null {
  if(!raw||raw.length>12_000_000)return null;
  try {
    const parsed:unknown=JSON.parse(raw);
    if(validateGameState(parsed))return {savedAt:0,state:migrateState(parsed)};
    if(record(parsed)&&finite(parsed.savedAt,0,Number.MAX_SAFE_INTEGER)&&validateGameState(parsed.state))return {savedAt:parsed.savedAt,state:migrateState(parsed.state)};
  } catch { /* Invalid or partial browser storage entry. */ }
  return null;
}
function migrateLegacySave():void {
  try {
    const legacy=localStorage.getItem(SAVE.GAME_KEY);if(!legacy)return;
    if(Array.from({length:SAVE.SLOT_COUNT},(_,i)=>localStorage.getItem(slotKey(i+1))).some(Boolean))return;
    const decoded=decodeSave(legacy);if(!decoded)return;
    localStorage.setItem(slotKey(1),JSON.stringify({savedAt:decoded.savedAt||Date.now(),state:decoded.state} satisfies SaveEnvelope));
    localStorage.removeItem(SAVE.GAME_KEY);
  } catch { /* Storage can be unavailable in private sessions. */ }
}
export function saveGame(state: GameState, slot=1): boolean {
  try {
    if (!validateGameState(state)) return false;
    migrateLegacySave();
    const canonical=migrateState(state);
    localStorage.setItem(slotKey(slot), JSON.stringify({savedAt:Date.now(),state:canonical} satisfies SaveEnvelope));
    return true;
  } catch { return false; }
}

export function loadGame(slot=1): GameState | null {
  try {migrateLegacySave();return decodeSave(localStorage.getItem(slotKey(slot)))?.state??null;} catch { return null; }
}

export function listSaveSlots():SaveSlotSummary[] {
  try {
    migrateLegacySave();
    return Array.from({length:SAVE.SLOT_COUNT},(_,index)=>{
      const slot=index+1,decoded=decodeSave(localStorage.getItem(slotKey(slot)));
      if(!decoded)return {slot,exists:false};
      const state=decoded.state;
      return {slot,exists:true,seed:state.seed,savedAt:decoded.savedAt,elapsed:state.elapsed,timeOfDay:state.timeOfDay,structures:state.structures.length,worldGeneration:state.worldGeneration};
    });
  } catch { return Array.from({length:SAVE.SLOT_COUNT},(_,index)=>({slot:index+1,exists:false})); }
}
export function latestSaveSlot():number|null {
  const saves=listSaveSlots().filter(save=>save.exists);
  if(!saves.length)return null;
  saves.sort((a,b)=>(b.savedAt??0)-(a.savedAt??0)||a.slot-b.slot);
  return saves[0]!.slot;
}
export function hasSave(slot?:number): boolean {return slot===undefined?listSaveSlots().some(save=>save.exists):loadGame(slot)!==null;}
export function deleteSave(slot:number):void {try{migrateLegacySave();localStorage.removeItem(slotKey(slot));if(slot===1)localStorage.removeItem(SAVE.GAME_KEY);}catch{/* Storage can be unavailable. */}}
export function resetSave(): void {try{localStorage.removeItem(SAVE.GAME_KEY);for(let slot=1;slot<=SAVE.SLOT_COUNT;slot++)localStorage.removeItem(slotKey(slot));}catch{/* Storage can be unavailable. */}}

const defaultSettings=():Settings=>({...DEFAULT_SETTINGS,keybinds:{...DEFAULT_KEYBINDS}});
function normalizeSettings(value: unknown): Settings {
  if (!record(value)) return defaultSettings();
  const legacySensitivity=finite(value.sensitivity,0.05,3)?value.sensitivity:1;
  const source=record(value.keybinds)?value.keybinds:{};
  const keybinds={...DEFAULT_KEYBINDS} as Settings['keybinds'];
  for(const action of Object.keys(DEFAULT_KEYBINDS) as (keyof Settings['keybinds'])[]){
    const code=source[action];
    if(typeof code==='string'&&code.length>0&&code.length<=32)keybinds[action]=code;
  }
  return {
    language:value.language==='cs'?'cs':'en',
    sensitivityX:finite(value.sensitivityX,0.05,3)?value.sensitivityX:legacySensitivity,
    sensitivityY:finite(value.sensitivityY,0.05,3)?value.sensitivityY:legacySensitivity,
    fov: finite(value.fov, 55, 110) ? normalizeFov(value.fov) : DEFAULT_SETTINGS.fov,
    viewmodelFov: finite(value.viewmodelFov, 40, 75) ? value.viewmodelFov : DEFAULT_SETTINGS.viewmodelFov,
    invertY: typeof value.invertY === 'boolean' ? value.invertY : DEFAULT_SETTINGS.invertY,
    headBob: typeof value.headBob === 'boolean' ? value.headBob : DEFAULT_SETTINGS.headBob,
    cameraShake: typeof value.cameraShake === 'boolean' ? value.cameraShake : DEFAULT_SETTINGS.cameraShake,
    motionBlur: typeof value.motionBlur === 'boolean' ? value.motionBlur : DEFAULT_SETTINGS.motionBlur,
    masterVolume: finite(value.masterVolume, 0, 1) ? value.masterVolume : DEFAULT_SETTINGS.masterVolume,
    musicVolume: finite(value.musicVolume, 0, 1) ? value.musicVolume : DEFAULT_SETTINGS.musicVolume,
    effectsVolume: finite(value.effectsVolume, 0, 1) ? value.effectsVolume : DEFAULT_SETTINGS.effectsVolume,
    ambientVolume: finite(value.ambientVolume, 0, 1) ? value.ambientVolume : DEFAULT_SETTINGS.ambientVolume,
    quality: ['low','medium','high','ultra'].includes(String(value.quality)) ? value.quality as Settings['quality'] : DEFAULT_SETTINGS.quality,
    renderScale: finite(value.renderScale, 0.5, 1) ? value.renderScale : DEFAULT_SETTINGS.renderScale,
    vsync: typeof value.vsync === 'boolean' ? value.vsync : DEFAULT_SETTINGS.vsync,
    shadows: typeof value.shadows === 'boolean' ? value.shadows : DEFAULT_SETTINGS.shadows,
    shadowQuality: value.shadowQuality === 'low' || value.shadowQuality === 'medium' || value.shadowQuality === 'high' ? value.shadowQuality : DEFAULT_SETTINGS.shadowQuality,
    shadowDistance: finite(value.shadowDistance, 35, 120) ? value.shadowDistance : DEFAULT_SETTINGS.shadowDistance,
    foliageDensity: finite(value.foliageDensity, 0.25, 1) ? value.foliageDensity : DEFAULT_SETTINGS.foliageDensity,
    postProcessing: typeof value.postProcessing === 'boolean' ? value.postProcessing : DEFAULT_SETTINGS.postProcessing,
    ambientOcclusion: typeof value.ambientOcclusion === 'boolean' ? value.ambientOcclusion : DEFAULT_SETTINGS.ambientOcclusion,
    bloom: typeof value.bloom === 'boolean' ? value.bloom : DEFAULT_SETTINGS.bloom,
    crosshairOpacity: finite(value.crosshairOpacity, 0, 1) ? value.crosshairOpacity : DEFAULT_SETTINGS.crosshairOpacity,
    crosshairScale: finite(value.crosshairScale, 0.6, 2) ? value.crosshairScale : DEFAULT_SETTINGS.crosshairScale,
    hudScale: finite(value.hudScale, 0.8, 1.45) ? value.hudScale : DEFAULT_SETTINGS.hudScale,
    hudOpacity: finite(value.hudOpacity, 0.55, 1) ? value.hudOpacity : DEFAULT_SETTINGS.hudOpacity,
    brightness: finite(value.brightness, 0.75, 1.35) ? value.brightness : DEFAULT_SETTINGS.brightness,
    showCompass: typeof value.showCompass === 'boolean' ? value.showCompass : DEFAULT_SETTINGS.showCompass,
    showFps: typeof value.showFps === 'boolean' ? value.showFps : DEFAULT_SETTINGS.showFps,
    showTutorialHints: typeof value.showTutorialHints === 'boolean' ? value.showTutorialHints : DEFAULT_SETTINGS.showTutorialHints,
    telemetryScale: finite(value.telemetryScale, 0.7, 1.4) ? value.telemetryScale : DEFAULT_SETTINGS.telemetryScale,
    telemetryOpacity: finite(value.telemetryOpacity, 0.55, 1) ? value.telemetryOpacity : DEFAULT_SETTINGS.telemetryOpacity,
    telemetryPerformance: typeof value.telemetryPerformance === 'boolean' ? value.telemetryPerformance : DEFAULT_SETTINGS.telemetryPerformance,
    telemetryPlayer: typeof value.telemetryPlayer === 'boolean' ? value.telemetryPlayer : DEFAULT_SETTINGS.telemetryPlayer,
    telemetryCamera: typeof value.telemetryCamera === 'boolean' ? value.telemetryCamera : DEFAULT_SETTINGS.telemetryCamera,
    telemetryWorld: typeof value.telemetryWorld === 'boolean' ? value.telemetryWorld : DEFAULT_SETTINGS.telemetryWorld,
    keybinds
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SAVE.SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch { return defaultSettings(); }
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(SAVE.SETTINGS_KEY, JSON.stringify(normalizeSettings(settings))); } catch { /* Settings still apply for the current session. */ }
}
