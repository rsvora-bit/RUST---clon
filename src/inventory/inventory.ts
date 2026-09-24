import type { ItemId, ItemStack } from '../core/types';
import { ITEMS } from '../items/definitions';

export type InventorySlots = (ItemStack | null)[];
export type ItemCosts = Partial<Record<ItemId, number>>;

export function copyInventory(inventory: InventorySlots): InventorySlots {
  return inventory.map(stack => stack ? { ...stack } : null);
}

export function itemCount(inventory: InventorySlots, itemId: ItemId): number {
  return inventory.reduce((sum, stack) => sum + (stack?.itemId === itemId ? stack.count : 0), 0);
}

/** Merge into existing stacks before occupying an empty slot. Returns uninserted units. */
export function insertItem(inventory: InventorySlots, itemId: ItemId, count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) return Math.max(0, count);
  const max = ITEMS[itemId].maxStack;
  let remaining = count;
  for (const stack of inventory) {
    if (stack?.itemId !== itemId || stack.count === max) continue;
    const inserted = Math.min(max - stack.count, remaining);
    stack.count += inserted;
    remaining -= inserted;
    if (!remaining) return 0;
  }
  for (let i = 0; i < inventory.length && remaining; i++) {
    if (inventory[i]) continue;
    const inserted = Math.min(max, remaining);
    inventory[i] = { itemId, count: inserted };
    remaining -= inserted;
  }
  return remaining;
}

export function hasCosts(inventory: InventorySlots, costs: ItemCosts): boolean {
  return Object.entries(costs).every(([id, amount]) => itemCount(inventory, id as ItemId) >= (amount ?? 0));
}

/** Atomic resource payment. The inventory remains unchanged if any resource is missing. */
export function deductCosts(inventory: InventorySlots, costs: ItemCosts): boolean {
  if (!hasCosts(inventory, costs)) return false;
  for (const [id, value] of Object.entries(costs)) {
    let remaining = value ?? 0;
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      const stack = inventory[i];
      if (stack?.itemId !== id) continue;
      const removed = Math.min(stack.count, remaining);
      stack.count -= removed;
      remaining -= removed;
      if (stack.count === 0) inventory[i] = null;
    }
  }
  return true;
}

/** Split moves half a stack (rounded up), never swaps incompatible items. */
export function moveStack(inventory: InventorySlots, from: number, to: number, split = false): boolean {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= inventory.length || to >= inventory.length || from === to) return false;
  const source = inventory[from];
  const target = inventory[to];
  if (!source) return false;
  if (split && target && target.itemId !== source.itemId) return false;
  if (target?.itemId === source.itemId || !target) {
    const amount = Math.min(split ? Math.ceil(source.count / 2) : source.count, ITEMS[source.itemId].maxStack - (target?.count ?? 0));
    if (!amount) return false;
    inventory[to] = { itemId: source.itemId, count: (target?.count ?? 0) + amount };
    source.count -= amount;
    if (!source.count) inventory[from] = null;
  } else {
    inventory[from] = target;
    inventory[to] = source;
  }
  return true;
}
