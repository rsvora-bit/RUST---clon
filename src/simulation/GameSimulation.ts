import {ensureProgression} from '../survival/progression';
import {tickStation,nearbyWorkbench} from '../survival/stations';
import type { BuildCandidate, CraftJob, DroppedItem, GameState, ItemId, ResourceNode, Structure, Vec3 } from '../core/types';
import { BUILD, PLAYER } from '../config/balance';
import { BUILDING_RULES, CONSUMABLES, GATHERING, INVENTORY, SAVE, SURVIVAL } from '../config/gameplay';
import { ITEMS, isItemId } from '../items/definitions';
import { RECIPES } from '../crafting/recipes';
import { copyInventory, deductCosts, hasCosts, insertItem, itemCount, moveStack, type InventorySlots } from '../inventory/inventory';
import { PIECES, validateStructurePlacement } from '../building/rules';

const clamp = (value: number): number => Math.max(0, Math.min(100, value));
const validSlot = (slot: number): boolean => Number.isInteger(slot) && slot >= 0 && slot < INVENTORY.SLOTS;

export class GameSimulation {
  state: GameState;
  onNotify: (message: string) => void = () => {};
  private queueBlocked = false;
  private benchTimer=0;workbenchLevel=0;

  constructor(seed: number, spawn: Vec3, saved?: GameState) {
    this.state = saved ? structuredClone(saved) : {
      version: 1, worldGeneration: 2, seed, elapsed: 0, timeOfDay: SURVIVAL.START_HOUR,
      player: { position: { ...spawn }, yaw: 0, pitch: 0, stats: { ...SURVIVAL.STARTING_STATS } },
      inventory: Array.from({ length: INVENTORY.SLOTS }, (_, i) => i === 0 ? { itemId: 'rock', count: 1 } : i === 1 ? { itemId: 'torch', count: 1 } : null),
      activeSlot: 0, structures: [], nodeChanges: {}, drops: [], craftQueue: [], nextId: 1,
    };
    ensureProgression(this.state);
  }

  tick(dt: number, sprinting: boolean): void {
    if (!Number.isFinite(dt) || dt <= 0 || this.state.player.stats.health <= 0) return;
    const progress=ensureProgression(this.state);for(const station of progress.stations)tickStation(station,dt);
    this.benchTimer-=dt;if(this.benchTimer<=0){this.benchTimer=.25;this.workbenchLevel=nearbyWorkbench(progress.stations,this.state.player.position);}
    const stats = this.state.player.stats;
    this.state.elapsed += dt;
    this.state.timeOfDay = (this.state.timeOfDay + dt * 24 / SURVIVAL.DAY_LENGTH_SECONDS) % 24;
    stats.hunger = clamp(stats.hunger - PLAYER.HUNGER_DRAIN * dt * (sprinting ? 1.5 : 1));
    stats.thirst = clamp(stats.thirst - PLAYER.THIRST_DRAIN * dt * (sprinting ? 1.7 : 1));
    stats.stamina = clamp(stats.stamina + (sprinting ? -PLAYER.STAMINA_DRAIN : PLAYER.STAMINA_REGEN) * dt);
    if (stats.hunger === 0) stats.health = clamp(stats.health - SURVIVAL.STARVATION_DAMAGE * dt);
    if (stats.thirst === 0) stats.health = clamp(stats.health - SURVIVAL.DEHYDRATION_DAMAGE * dt);
    if (stats.hunger > SURVIVAL.HEAL_HUNGER_THRESHOLD && stats.thirst > SURVIVAL.HEAL_THIRST_THRESHOLD) stats.health = clamp(stats.health + SURVIVAL.PASSIVE_HEAL_RATE * dt);

    let time = dt;
    while (this.state.craftQueue.length && time >= 0) {
      const job = this.state.craftQueue[0];
      const used = Math.min(time, job.remaining);
      job.remaining -= used;
      time -= used;
      if (job.remaining > 0) break;
      const recipe = RECIPES[job.recipeId];
      const inventory = copyInventory(this.state.inventory);
      if (insertItem(inventory, recipe.resultItemId, recipe.resultCount) !== 0) {
        if (!this.queueBlocked) this.onNotify('Craft ready · make room in your inventory');
        this.queueBlocked = true;
        break;
      }
      this.state.inventory = inventory;
      this.state.craftQueue.shift();
      this.queueBlocked = false;
      this.onNotify(`Crafted ${ITEMS[recipe.resultItemId].displayName}`);
      if (time === 0) break;
    }
  }

  fitsQueue(inventory: InventorySlots, jobs: CraftJob[] = this.state.craftQueue): boolean {
    const preview = copyInventory(inventory);
    return jobs.every(job => {
      const recipe = RECIPES[job.recipeId];
      return !!recipe && insertItem(preview, recipe.resultItemId, recipe.resultCount) === 0;
    });
  }

  gather(node: ResourceNode): { amount: number; depleted: boolean } {
    const rule = GATHERING[node.kind];
    if (!rule) return { amount: 0, depleted: false };
    const remaining = this.state.nodeChanges[node.id] ?? node.remaining;
    if (remaining <= 0) return { amount: 0, depleted: true };
    const active = this.state.inventory[this.state.activeSlot]?.itemId;
    if (['tree', 'stone', 'metal'].includes(node.kind) && active !== 'rock' && active !== 'hatchet' && active !== 'pickaxe') {
      this.onNotify('Equip a rock, hatchet or pickaxe');
      return { amount: 0, depleted: false };
    }
    const requested = Math.min(remaining, Math.round(rule.amount * (active === rule.preferredTool ? rule.toolMultiplier : 1)));
    const amount = requested - this.addItem(rule.itemId, requested);
    if (amount === 0) {
      this.onNotify('Inventory full');
      return { amount: 0, depleted: false };
    }
    node.remaining = remaining - amount;
    this.state.nodeChanges[node.id] = node.remaining;
    if (node.remaining === 0) node.depletedAt = this.state.elapsed;
    this.onNotify(`+ ${amount} ${ITEMS[rule.itemId].displayName}`);
    return { amount, depleted: node.remaining === 0 };
  }

  /** Outputs in the craft queue reserve capacity, so gathering cannot lose a crafted item. */
  addItem(itemId: ItemId, count: number): number {
    if (!isItemId(itemId) || !Number.isSafeInteger(count) || count <= 0) return Math.max(0, count);
    const preview = copyInventory(this.state.inventory);
    for (const job of this.state.craftQueue) {
      const recipe = RECIPES[job.recipeId];
      if (insertItem(preview, recipe.resultItemId, recipe.resultCount) !== 0) return count;
    }
    const leftover = insertItem(preview, itemId, count);
    insertItem(this.state.inventory, itemId, count - leftover);
    return leftover;
  }

  count(itemId: ItemId): number { return itemCount(this.state.inventory, itemId); }

  moveItem(from: number, to: number, split = false): void {
    const preview = copyInventory(this.state.inventory);
    if (!moveStack(preview, from, to, split)) return;
    if (!this.fitsQueue(preview)) { this.onNotify('Space reserved for crafting'); return; }
    this.state.inventory = preview;
  }

  dropItem(slot: number, position: Vec3): DroppedItem | null {
    if (!validSlot(slot) || !this.state.inventory[slot] || this.state.drops.length >= SAVE.MAX_DROPS || ![position.x, position.y, position.z].every(Number.isFinite)) return null;
    const stack = this.state.inventory[slot]!;
    const drop: DroppedItem = { id: `drop-${this.state.nextId++}`, stack: { ...stack }, position: { ...position } };
    this.state.inventory[slot] = null;
    this.state.drops.push(drop);
    this.onNotify(`Dropped ${stack.count} ${ITEMS[stack.itemId].displayName}`);
    return drop;
  }

  pickup(dropId: string): boolean {
    const drop = this.state.drops.find(item => item.id === dropId);
    if (!drop) return false;
    const leftover = this.addItem(drop.stack.itemId, drop.stack.count);
    const pickedUp = drop.stack.count - leftover;
    if (!pickedUp) { this.onNotify('Inventory full'); return false; }
    this.onNotify(`+ ${pickedUp} ${ITEMS[drop.stack.itemId].displayName}`);
    if (leftover) drop.stack.count = leftover;
    else this.state.drops = this.state.drops.filter(item => item.id !== dropId);
    return true;
  }

  consume(slot: number): boolean {
    if (!validSlot(slot)) return false;
    const stack = this.state.inventory[slot];
    if (!stack) return false;
    const effects = CONSUMABLES[stack.itemId];
    if (!effects) return false;
    const stats = this.state.player.stats;
    if (!Object.entries(effects).some(([key]) => stats[key as keyof typeof stats] < 100)) { this.onNotify('You do not need that right now'); return false; }
    for (const [key, amount] of Object.entries(effects)) stats[key as keyof typeof stats] = clamp(stats[key as keyof typeof stats] + (amount ?? 0));
    this.onNotify(`Used ${ITEMS[stack.itemId].displayName}`);
    if (--stack.count === 0) this.state.inventory[slot] = null;
    return true;
  }

  selectSlot(slot: number): void {
    if (Number.isInteger(slot) && slot >= 0 && slot < INVENTORY.HOTBAR_SLOTS) this.state.activeSlot = slot;
  }

  canCraft(recipeId: string): boolean {
    const recipe = Object.hasOwn(RECIPES, recipeId) ? RECIPES[recipeId] : undefined;
    if (!recipe || (recipe.requiredWorkbenchLevel??0)>nearbyWorkbench(ensureProgression(this.state).stations,this.state.player.position) || this.state.craftQueue.length >= INVENTORY.MAX_CRAFT_QUEUE || !hasCosts(this.state.inventory, recipe.ingredients)) return false;
    const inventory = copyInventory(this.state.inventory);
    deductCosts(inventory, recipe.ingredients);
    return this.fitsQueue(inventory, [...this.state.craftQueue, { recipeId, remaining: recipe.craftTime, total: recipe.craftTime }]);
  }

  craft(recipeId: string): boolean {
    const recipe = Object.hasOwn(RECIPES, recipeId) ? RECIPES[recipeId] : undefined;
    if (!recipe) return false;
    if (!this.canCraft(recipeId)) {
      this.onNotify((recipe.requiredWorkbenchLevel??0)>nearbyWorkbench(ensureProgression(this.state).stations,this.state.player.position)?`Requires workbench level ${recipe.requiredWorkbenchLevel}`:!hasCosts(this.state.inventory, recipe.ingredients) ? 'Not enough resources' : this.state.craftQueue.length >= INVENTORY.MAX_CRAFT_QUEUE ? 'Crafting queue is full' : 'Make room for the crafted item');
      return false;
    }
    deductCosts(this.state.inventory, recipe.ingredients);
    this.state.craftQueue.push({ recipeId, remaining: recipe.craftTime, total: recipe.craftTime });
    this.onNotify(`Crafting ${ITEMS[recipe.resultItemId].displayName}`);
    return true;
  }

  place(candidate: BuildCandidate): Structure | null {
    if (!candidate.valid) { this.onNotify(candidate.reason || 'Cannot build here'); return null; }
    const problem = validateStructurePlacement(candidate, this.state.structures, this.state.player.position);
    if (problem) { this.onNotify(problem); return null; }
    const pos = this.state.player.position;
    if (Math.hypot(candidate.position.x - pos.x, candidate.position.z - pos.z) > BUILD.MAX_DISTANCE || Math.abs(candidate.position.y - pos.y) > BUILD.MAX_DISTANCE) { this.onNotify('Move closer to build'); return null; }
    if (!deductCosts(this.state.inventory, PIECES[candidate.pieceType].cost)) { this.onNotify('Not enough resources'); return null; }
    const structure: Structure = {
      id: `structure-${this.state.nextId++}`, pieceType: candidate.pieceType, position: { ...candidate.position }, rotation: candidate.rotation,
      health: BUILDING_RULES.HEALTH, createdAt: this.state.elapsed,
      ...(candidate.parentId ? { parentId: candidate.parentId, socketId: candidate.socketId } : {}),
      ...(candidate.pieceType === 'door' ? { open: false } : {}),
    };
    this.state.structures.push(structure);
    this.onNotify(`${PIECES[structure.pieceType].name} placed`);
    return structure;
  }

  toggleDoor(id: string): boolean {
    const structure = this.state.structures.find(item => item.id === id && item.pieceType === 'door');
    if (!structure) return false;
    structure.open = !structure.open;
    return true;
  }

  resetStats(): void { this.state.player.stats = { ...SURVIVAL.STARTING_STATS }; }
}
