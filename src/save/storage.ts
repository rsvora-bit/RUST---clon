import {validateStations} from '../survival/stations';
import {normalizeFov} from '../camera/FirstPersonProjection';
import type { GameState, ItemStack, PlayerStats, Settings, Structure, Vec3 } from '../core/types';
import { DEFAULT_SETTINGS } from '../config/balance';
import { BUILDING_RULES, INVENTORY, SAVE } from '../config/gameplay';
import { ITEMS, isItemId } from '../items/definitions';
import { RECIPES } from '../crafting/recipes';
import { PIECES, validateStructurePlacement } from '../building/rules';

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
  if (value.worldGeneration !== undefined && value.worldGeneration !== 1 && value.worldGeneration !== 2) return false;
  if (!record(value.player) || !position(value.player.position) || !stats(value.player.stats) || !finite(value.player.yaw) || !finite(value.player.pitch, -Math.PI / 2, Math.PI / 2)) return false;
  if (!Array.isArray(value.inventory) || value.inventory.length !== INVENTORY.SLOTS || !value.inventory.every(item => item === null || stack(item)) || !integer(value.activeSlot, 0, INVENTORY.HOTBAR_SLOTS - 1)) return false;
  if (!Array.isArray(value.structures) || value.structures.length > BUILDING_RULES.MAX_STRUCTURES || !Array.isArray(value.drops) || value.drops.length > SAVE.MAX_DROPS) return false;
  const ids = new Set<string>();
  const parsedStructures: Structure[] = [];
  for (const entry of value.structures) {
    if (!record(entry) || !identifier(entry.id) || ids.has(entry.id) || typeof entry.pieceType !== 'string' || !Object.hasOwn(PIECES, entry.pieceType) || !position(entry.position) || !finite(entry.rotation) || !finite(entry.health, 0, typeof entry.maxHealth==='number'?entry.maxHealth:BUILDING_RULES.HEALTH) || !finite(entry.createdAt, 0, value.elapsed)) return false;
    if ((entry.parentId !== undefined && !identifier(entry.parentId)) || (entry.socketId !== undefined && !identifier(entry.socketId)) || (entry.open !== undefined && typeof entry.open !== 'boolean')) return false;
    if ((entry.parentId === undefined) !== (entry.socketId === undefined)) return false;
    if(entry.grade!==undefined&&!['wood','stone','metal'].includes(entry.grade as string))return false;
    if(entry.maxHealth!==undefined&&entry.maxHealth!==({wood:250,stone:600,metal:1000}[entry.grade as 'wood'|'stone'|'metal']))return false;
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
    for(const s of p.stations){if(ids.has(s.id))return false;ids.add(s.id);if(/^station-\d+$/.test(s.id)&&Number(s.id.slice(8))>=value.nextId)return false;}
  }
  return true;
}

export function saveGame(state: GameState): boolean {
  try {
    if (!validateGameState(state)) return false;
    localStorage.setItem(SAVE.GAME_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE.GAME_KEY);
    if (!raw || raw.length > 12_000_000) return null;
    const parsed: unknown = JSON.parse(raw);
    return validateGameState(parsed) ? parsed : null;
  } catch { return null; }
}

export function hasSave(): boolean { return loadGame() !== null; }
export function resetSave(): void { try { localStorage.removeItem(SAVE.GAME_KEY); } catch { /* Storage can be unavailable in private sessions. */ } }

function normalizeSettings(value: unknown): Settings {
  if (!record(value)) return { ...DEFAULT_SETTINGS };
  return {
    sensitivity: finite(value.sensitivity, 0.05, 3) ? value.sensitivity : DEFAULT_SETTINGS.sensitivity,
    fov: finite(value.fov, 55, 110) ? normalizeFov(value.fov) : DEFAULT_SETTINGS.fov,
    viewmodelFov: finite(value.viewmodelFov, 40, 75) ? value.viewmodelFov : DEFAULT_SETTINGS.viewmodelFov,
    invertY: typeof value.invertY === 'boolean' ? value.invertY : DEFAULT_SETTINGS.invertY,
    headBob: typeof value.headBob === 'boolean' ? value.headBob : DEFAULT_SETTINGS.headBob,
    masterVolume: finite(value.masterVolume, 0, 1) ? value.masterVolume : DEFAULT_SETTINGS.masterVolume,
    effectsVolume: finite(value.effectsVolume, 0, 1) ? value.effectsVolume : DEFAULT_SETTINGS.effectsVolume,
    quality: value.quality === 'low' || value.quality === 'medium' || value.quality === 'high' ? value.quality : DEFAULT_SETTINGS.quality,
    renderScale: finite(value.renderScale, 0.5, 1) ? value.renderScale : DEFAULT_SETTINGS.renderScale,
    shadows: typeof value.shadows === 'boolean' ? value.shadows : DEFAULT_SETTINGS.shadows,
    crosshairOpacity: finite(value.crosshairOpacity, 0, 1) ? value.crosshairOpacity : DEFAULT_SETTINGS.crosshairOpacity,
    showCompass: typeof value.showCompass === 'boolean' ? value.showCompass : DEFAULT_SETTINGS.showCompass,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SAVE.SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(SAVE.SETTINGS_KEY, JSON.stringify(normalizeSettings(settings))); } catch { /* Settings still apply for the current session. */ }
}
