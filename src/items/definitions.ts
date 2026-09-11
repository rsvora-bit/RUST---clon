import type { ItemDefinition, ItemId } from '../core/types';

const item = (id: ItemId, displayName: string, description: string, category: ItemDefinition['category'], maxStack: number, tags: string[], extra: Partial<ItemDefinition> = {}): ItemDefinition => ({ id, displayName, description, category, maxStack, tags, icon: `assets/icons/${id}.svg`, ...extra });

export const ITEMS: Record<ItemId, ItemDefinition> = {
  ore: item('ore', 'Raw metal resource', 'Process with fuel at a field processor.', 'resource', 1000, ['survival'], {placeable:false}),
  storage: item('storage', 'Storage box', 'Place from your hotbar; E opens 18 slots.', 'building', 1, ['survival'], {placeable:true}),
  furnace: item('furnace', 'Field processor', 'Converts raw resources into game crafting fragments.', 'building', 1, ['survival'], {placeable:true}),
  workbench1: item('workbench1', 'Workbench level 1', 'Unlocks recipes while standing within 5 meters.', 'building', 1, ['survival'], {placeable:true}),
  workbench2: item('workbench2', 'Workbench level 2', 'A more capable workshop.', 'building', 1, ['survival'], {placeable:true}),
  workbench3: item('workbench3', 'Workbench level 3', 'Advanced crafting station.', 'building', 1, ['survival'], {placeable:true}),
  bedroll: item('bedroll', 'Sleeping roll', 'Place and interact to choose your respawn point.', 'utility', 1, ['survival'], {placeable:true}),
  rock: item('rock', 'Weathered rock', 'A dependable starting tool. Strike trees and mineral deposits to gather resources.', 'tool', 1, ['gather', 'starter']),
  torch: item('torch', 'Handmade torch', 'A resin-soaked torch. Equip it after sundown to illuminate your surroundings.', 'tool', 1, ['light', 'starter']),
  wood: item('wood', 'Wood', 'Timber gathered from trees and driftwood. The foundation of a new shelter.', 'resource', 1000, ['building', 'crafting']),
  stone: item('stone', 'Stone', 'Rough stone used in foundations and improvised tools.', 'resource', 1000, ['building', 'crafting']),
  metal: item('metal', 'Metal fragments', 'Processed fragments used for hardware and stronger construction.', 'resource', 1000, ['crafting']),
  fiber: item('fiber', 'Plant fiber', 'Tough fibers from wild flax. Twist into cord or use as a dressing.', 'resource', 1000, ['crafting']),
  berries: item('berries', 'Wild berries', 'A small meal that restores 9 food and 5 hydration. Double-click to eat.', 'food', 20, ['food'], { consumable: true }),
  hatchet: item('hatchet', 'Stone hatchet', 'A hafted cutting edge. Gathers wood two and a half times as quickly.', 'tool', 1, ['gather', 'wood']),
  pickaxe: item('pickaxe', 'Stone pickaxe', 'A rugged mining tool. Gathers stone and metal two and a half times as quickly.', 'tool', 1, ['gather', 'mining']),
  plan: item('plan', 'Building plan', 'Equip to place foundations, walls, doorways, doors, floors and roofs. Press B to choose a piece.', 'building', 1, ['build']),
  bandage: item('bandage', 'Field dressing', 'Clean plant-fiber dressing. Restores 24 health. Double-click to use.', 'utility', 5, ['healing'], { consumable: true }),
  canteen: item('canteen', 'Rainwater pouch', 'A small collector of fresh water. Restores 42 hydration. Double-click to drink.', 'utility', 3, ['water'], { consumable: true }),
  campfire: item('campfire', 'Campfire kit', 'A bundle of fuel and stones prepared for a sheltered fire.', 'utility', 1, ['camp'], { placeable: true }),
};

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && Object.hasOwn(ITEMS, value);
}
