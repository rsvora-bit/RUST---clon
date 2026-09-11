import type { ItemId, PlayerStats, ResourceNode } from '../core/types';

export const INVENTORY = { SLOTS: 30, HOTBAR_SLOTS: 6, MAX_CRAFT_QUEUE: 5 } as const;
export const SURVIVAL = {
  STARTING_STATS: { health: 100, hunger: 86, thirst: 78, stamina: 100 } satisfies PlayerStats,
  STARVATION_DAMAGE: 0.35,
  DEHYDRATION_DAMAGE: 0.55,
  PASSIVE_HEAL_RATE: 0.12,
  HEAL_HUNGER_THRESHOLD: 60,
  HEAL_THIRST_THRESHOLD: 50,
  DAY_LENGTH_SECONDS: 1800,
  START_HOUR: 9.4,
} as const;

export interface GatherRule { itemId: ItemId; amount: number; preferredTool?: ItemId; toolMultiplier: number; label: string }
export const GATHERING: Record<ResourceNode['kind'], GatherRule> = {
  tree: { itemId: 'wood', amount: 30, preferredTool: 'hatchet', toolMultiplier: 2.5, label: 'Tree' },
  wood: { itemId: 'wood', amount: 35, preferredTool: 'hatchet', toolMultiplier: 1, label: 'Driftwood' },
  stone: { itemId: 'stone', amount: 24, preferredTool: 'pickaxe', toolMultiplier: 2.5, label: 'Stone deposit' },
  metal: { itemId: 'ore', amount: 14, preferredTool: 'pickaxe', toolMultiplier: 2.5, label: 'Metal deposit' },
  fiber: { itemId: 'fiber', amount: 25, toolMultiplier: 1, label: 'Wild flax' },
  berries: { itemId: 'berries', amount: 4, toolMultiplier: 1, label: 'Berry bush' },
};

export const CONSUMABLES: Partial<Record<ItemId, Partial<PlayerStats>>> = {
  berries: { hunger: 9, thirst: 5 },
  bandage: { health: 24 },
  canteen: { thirst: 42 },
};

export const BUILDING_RULES = {
  MAX_TERRAIN_VARIATION: 0.72,
  MIN_GROUND_HEIGHT: 0.12,
  FOUNDATION_EMBED: 0.12,
  COLLISION_EPSILON: 0.055,
  MAX_STRUCTURES: 1500,
  HEALTH: 250,
} as const;

export const SAVE = { GAME_KEY: 'tideland:save:v1', SETTINGS_KEY: 'tideland:settings:v1', MAX_DROPS: 500, MAX_NODE_CHANGES: 50000 } as const;
