import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PieceType, ResourceNode, Structure, Vec3 } from '../src/core/types';
import { BUILD, DEFAULT_SETTINGS } from '../src/config/balance';
import { SAVE } from '../src/config/gameplay';
import { GameSimulation } from '../src/simulation/GameSimulation';
import { RECIPES } from '../src/crafting/recipes';
import { copyInventory, deductCosts, insertItem, moveStack } from '../src/inventory/inventory';
import { findBuildCandidate, getSockets, PIECES } from '../src/building/rules';
import { hasSave, loadGame, loadSettings, resetSave, saveGame, saveSettings, validateGameState } from '../src/save/storage';

const spawn = { x: 0, y: 2, z: 4 };
const ground = (): number => 1;
const sim = (): GameSimulation => new GameSimulation(731942, spawn);

describe('inventory transactions', () => {
  it('merges before allocating slots and returns overflow without deleting it', () => {
    const inventory = [{ itemId: 'wood' as const, count: 990 }, null];
    expect(insertItem(inventory, 'wood', 1030)).toBe(20);
    expect(inventory).toEqual([{ itemId: 'wood', count: 1000 }, { itemId: 'wood', count: 1000 }]);
  });

  it('splits stacks, merges up to limits and swaps unlike items', () => {
    const game = sim();
    game.addItem('wood', 9);
    game.moveItem(2, 3, true);
    expect(game.state.inventory[2]).toEqual({ itemId: 'wood', count: 4 });
    expect(game.state.inventory[3]).toEqual({ itemId: 'wood', count: 5 });
    game.moveItem(3, 2);
    expect(game.state.inventory[2]?.count).toBe(9);
    expect(game.state.inventory[3]).toBeNull();
    game.moveItem(2, 0);
    expect(game.state.inventory[0]?.itemId).toBe('wood');
    expect(game.state.inventory[2]?.itemId).toBe('rock');
    const before = copyInventory(game.state.inventory);
    expect(moveStack(game.state.inventory, 0, 1, true)).toBe(false);
    expect(game.state.inventory).toEqual(before);
    game.state.inventory[3] = { itemId: 'wood', count: 998 };
    game.moveItem(0, 3);
    expect(game.state.inventory[3]?.count).toBe(1000);
    expect(game.state.inventory[0]?.count).toBe(7);
  });

  it('does not partially pay an unaffordable cost', () => {
    const game = sim();
    game.addItem('wood', 100);
    const before = copyInventory(game.state.inventory);
    expect(deductCosts(game.state.inventory, { wood: 90, stone: 50 })).toBe(false);
    expect(game.state.inventory).toEqual(before);
  });

  it('drops and picks up exact stacks, retaining overflow in the world', () => {
    const game = sim();
    game.addItem('wood', 1000);
    const drop = game.dropItem(2, { x: 0, y: 1, z: 0 })!;
    expect(game.count('wood')).toBe(0);
    game.addItem('wood', 990);
    game.addItem('rock', 27);
    expect(game.pickup(drop.id)).toBe(true);
    expect(game.count('wood')).toBe(1000);
    expect(game.state.drops[0].stack.count).toBe(990);
    expect(game.pickup(drop.id)).toBe(false);
  });
});

describe('crafting and gathering progression', () => {
  it('starts with only a rock and torch, gathers, pays once, then completes sequential jobs', () => {
    const game = sim();
    expect(game.state.inventory.filter(Boolean).map(item => item?.itemId)).toEqual(['rock', 'torch']);
    const tree: ResourceNode = { id: 'tree-1', kind: 'tree', position: { x: 0, y: 1, z: 0 }, capacity: 120, remaining: 120, rotation: 0, scale: 1 };
    expect(game.gather(tree)).toEqual({ amount: 30, depleted: false });
    expect(game.state.nodeChanges['tree-1']).toBe(90);
    game.addItem('hatchet', 1);
    game.moveItem(3, 0);
    expect(game.gather(tree).amount).toBe(75);
    expect(game.gather(tree)).toEqual({ amount: 15, depleted: true });
    expect(game.gather(tree).amount).toBe(0);
    game.addItem('fiber', 50);
    expect(game.craft('plan')).toBe(true);
    expect(game.count('wood')).toBe(95);
    expect(game.count('fiber')).toBe(40);
    expect(game.count('plan')).toBe(0);
    expect(game.craft('bandage')).toBe(true);
    game.tick(1, false);
    expect(game.count('plan')).toBe(0);
    game.tick(1, false);
    expect(game.count('plan')).toBe(1);
    expect(game.state.craftQueue[0].remaining).toBe(1.5);
    game.tick(1.5, false);
    expect(game.count('bandage')).toBe(1);
    expect(game.state.craftQueue).toHaveLength(0);
    expect(game.count('fiber')).toBe(20);
  });

  it('refuses output overflow without taking ingredients', () => {
    const game = sim();
    game.state.inventory = Array.from({ length: 30 }, (_, index) => index === 2 ? { itemId: 'fiber', count: 40 } : { itemId: 'rock', count: 1 });
    expect(game.canCraft('bandage')).toBe(false);
    expect(game.craft('bandage')).toBe(false);
    expect(game.count('fiber')).toBe(40);
    // Exact consumption frees a slot, so a full inventory can still craft safely.
    game.state.inventory[2]!.count = 20;
    expect(game.craft('bandage')).toBe(true);
    game.tick(RECIPES.bandage.craftTime, false);
    expect(game.state.inventory[2]).toEqual({ itemId: 'bandage', count: 1 });
  });

  it('reserves queued output space against gathering and stack splitting', () => {
    const game = sim();
    game.addItem('fiber', 40);
    expect(game.craft('bandage')).toBe(true);
    expect(game.addItem('rock', 30)).toBe(4);
    const empty = game.state.inventory.findIndex(item => !item);
    expect(empty).toBeGreaterThan(-1);
    game.moveItem(2, empty, true);
    expect(game.state.inventory[empty]).toBeNull();
    expect(game.count('fiber')).toBe(20);
    game.tick(2, false);
    expect(game.count('bandage')).toBe(1);
    expect(game.state.inventory.filter(Boolean)).toHaveLength(30);
  });

  it('only depletes the resource amount actually inserted', () => {
    const game = sim();
    game.addItem('wood', 994);
    game.addItem('rock', 27);
    const tree: ResourceNode = { id: 'tree-2', kind: 'tree', position: { x: 0, y: 1, z: 0 }, capacity: 100, remaining: 100, rotation: 0, scale: 1 };
    expect(game.gather(tree).amount).toBe(6);
    expect(tree.remaining).toBe(94);
    expect(game.gather(tree).amount).toBe(0);
    expect(tree.remaining).toBe(94);
  });

  it('connects consumables, survival drain, stamina and the day clock', () => {
    const game = sim();
    game.state.player.stats = { health: 60, hunger: 40, thirst: 30, stamina: 100 };
    game.addItem('berries', 1);
    expect(game.consume(2)).toBe(true);
    expect(game.state.player.stats.hunger).toBe(49);
    expect(game.state.player.stats.thirst).toBe(35);
    expect(game.state.inventory[2]).toBeNull();
    game.tick(4, true);
    expect(game.state.player.stats.stamina).toBe(48);
    const time = game.state.timeOfDay;
    game.tick(4, false);
    expect(game.state.player.stats.stamina).toBe(100);
    expect(game.state.timeOfDay).toBeGreaterThan(time);
  });
});

function createShelter(): GameSimulation {
  const game = sim();
  game.addItem('wood', 1200);
  game.addItem('stone', 500);
  game.addItem('metal', 100);
  const place = (type: PieceType, target: Vec3, rotation = 0): Structure => {
    const candidate = findBuildCandidate(type, target, rotation, game.state.structures, ground, id => game.count(id), game.state.player.position);
    expect(candidate.valid, `${type}: ${candidate.reason}`).toBe(true);
    const structure = game.place(candidate);
    expect(structure).not.toBeNull();
    return structure!;
  };
  const foundation = place('foundation', { x: 0, y: 1, z: 0 }, Math.PI / 6);
  const next = getSockets(foundation).find(socket => socket.id.endsWith('adjacent:1'))!;
  const secondFoundation = place('foundation', next.position);
  const edges = getSockets(foundation).filter(socket => socket.accepts.includes('wall'));
  const wall = place('wall', edges[0].position);
  place('wall', edges[3].position);
  const doorway = place('doorway', edges[2].position);
  place('door', getSockets(doorway).find(socket => socket.accepts.includes('door'))!.position);
  place('floor', getSockets(wall).find(socket => socket.accepts.includes('floor'))!.position);
  const secondWallSocket = getSockets(secondFoundation).find(socket => socket.id.endsWith('edge:0'))!;
  const secondWall = place('wall', secondWallSocket.position);
  place('roof', getSockets(secondWall).find(socket => socket.accepts.includes('roof'))!.position);
  return game;
}

describe('modular building', () => {
  it('builds a connected rotated shelter from actual local sockets', () => {
    const game = createShelter();
    const [first, second] = game.state.structures;
    expect(second.position.x).toBeCloseTo(BUILD.SIZE * Math.cos(Math.PI / 6));
    expect(second.position.z).toBeCloseTo(-BUILD.SIZE * Math.sin(Math.PI / 6));
    expect(second.rotation).toBeCloseTo(first.rotation);
    expect(second.parentId).toBe(first.id);
    expect(game.state.structures.map(item => item.pieceType)).toEqual(['foundation', 'foundation', 'wall', 'wall', 'doorway', 'door', 'floor', 'wall', 'roof']);
    const door = game.state.structures.find(item => item.pieceType === 'door')!;
    expect(door.open).toBe(false);
    expect(game.toggleDoor(door.id)).toBe(true);
    expect(door.open).toBe(true);
    expect(game.toggleDoor(first.id)).toBe(false);
    const cost = game.state.structures.reduce((sum, item) => sum + (PIECES[item.pieceType].cost.wood ?? 0), 0);
    expect(game.count('wood')).toBe(1200 - cost);
  });

  it('rejects occupied sockets, unsupported pieces, steep terrain and overlaps without payment', () => {
    const game = createShelter();
    const foundation = game.state.structures[0];
    const wallSocket = getSockets(foundation).find(socket => socket.id.endsWith('edge:0'))!;
    const duplicate = findBuildCandidate('wall', wallSocket.position, 0, game.state.structures, ground, id => game.count(id), spawn);
    const before = game.count('wood');
    expect(duplicate.valid).toBe(false);
    expect(game.place(duplicate)).toBeNull();
    expect(game.count('wood')).toBe(before);
    expect(findBuildCandidate('wall', { x: 20, y: 1, z: 20 }, 0, [], ground, () => 999, spawn).valid).toBe(false);
    expect(findBuildCandidate('foundation', { x: 0, y: 1, z: 0 }, 0, [], (x, z) => 5 + x + z, () => 999, spawn).reason).toContain('steep');
    const intersection = findBuildCandidate('foundation', foundation.position, 0, [foundation], ground, () => 999, spawn);
    expect(intersection.valid).toBe(false);
    const water = findBuildCandidate('foundation', { x: 0, y: 0, z: 0 }, 0, [], () => 0, () => 999, spawn);
    expect(water.reason).toContain('shoreline');
  });

  it('rechecks the socket and resources at commit time', () => {
    const game = sim();
    game.addItem('wood', 100);
    game.addItem('stone', 100);
    const candidate = findBuildCandidate('foundation', { x: 0, y: 1, z: 0 }, 0, [], ground, id => game.count(id), spawn);
    expect(candidate.valid).toBe(true);
    game.dropItem(2, spawn);
    expect(game.place(candidate)).toBeNull();
    expect(game.count('stone')).toBe(100);
  });
});

describe('versioned persistence', () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips a shelter, open doors, inventory, world changes and in-progress crafting', () => {
    const game = createShelter();
    game.addItem('fiber', 50);
    game.craft('bandage');
    game.tick(0.7, true);
    const door = game.state.structures.find(item => item.pieceType === 'door')!;
    game.toggleDoor(door.id);
    game.state.nodeChanges['tree-1'] = 0;
    game.state.activeSlot = 1;
    game.dropItem(4, { x: 2, y: 1, z: 1 });
    expect(saveGame(game.state)).toBe(true);
    expect(hasSave()).toBe(true);
    const restored = loadGame()!;
    expect(restored).toEqual(game.state);
    const continued = new GameSimulation(0, spawn, restored);
    continued.tick(1.3, false);
    expect(continued.count('bandage')).toBe(1);
    expect(continued.state.structures.find(item => item.id === door.id)?.open).toBe(true);
    resetSave();
    expect(hasSave()).toBe(false);
  });

  it.each([
    (state: GameState) => { state.version = 2 as 1; },
    (state: GameState) => { state.inventory[2] = { itemId: 'wood', count: 1001 }; },
    (state: GameState) => { state.player.stats.health = -1; },
    (state: GameState) => { state.player.position.x = Number.NaN; },
    (state: GameState) => { state.nodeChanges['tree-1'] = -1; },
    (state: GameState) => { state.craftQueue = [{ recipeId: 'missing', remaining: 1, total: 1 }]; },
    (state: GameState) => { state.activeSlot = 9; },
  ])('rejects a malformed snapshot safely', corrupt => {
    const state = sim().state;
    corrupt(state);
    expect(validateGameState(state)).toBe(false);
    localStorage.setItem(SAVE.GAME_KEY, JSON.stringify(state));
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it('rejects missing structural parents and malformed JSON, and handles storage failure', () => {
    const state = createShelter().state;
    state.structures[2].parentId = 'missing-parent';
    expect(saveGame(state)).toBe(false);
    localStorage.setItem(SAVE.GAME_KEY, '{broken');
    expect(loadGame()).toBeNull();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Quota'); } });
    expect(saveGame(sim().state)).toBe(false);
    expect(loadGame()).toBeNull();
    expect(loadSettings().fov).toBe(DEFAULT_SETTINGS.fov);
  });

  it('persists settings separately and rejects out-of-range values', () => {
    const settings = { ...DEFAULT_SETTINGS, sensitivity: 1.4, fov: 90, masterVolume: 0.3, effectsVolume: 0.6, quality: 'low' as const };
    saveSettings(settings);
    expect(loadSettings()).toMatchObject(settings);
    expect(loadSettings()).toMatchObject({viewmodelFov:50,invertY:false,headBob:false,renderScale:1,shadows:true,crosshairOpacity:1,showCompass:true});
    expect(hasSave()).toBe(false);
    localStorage.setItem(SAVE.SETTINGS_KEY, JSON.stringify({ sensitivity: -10, fov: 300, quality: 'ultra', effectsVolume: 0.2 }));
    expect(loadSettings()).toMatchObject({ sensitivity: 1, fov: DEFAULT_SETTINGS.fov, quality: 'high', effectsVolume: 0.2 });
  });

  it('round-trips a ten digit custom world seed', () => {
    const game = new GameSimulation(9876543210, spawn);
    expect(saveGame(game.state)).toBe(true);
    expect(loadGame()?.seed).toBe(9876543210);
  });
});

describe('polish regressions', () => {
  it('extends upper floors across the center of a larger base and preserves attachment validation', () => {
    const foundation:Structure={id:'structure-1',pieceType:'foundation',position:{x:0,y:1,z:0},rotation:0,health:500,createdAt:0};
    const ws=getSockets(foundation).find(s=>s.accepts.includes('wall'))!;
    const wall:Structure={id:'structure-2',pieceType:'wall',position:ws.position,rotation:ws.rotation,health:500,createdAt:0,parentId:foundation.id,socketId:ws.id};
    const fs=getSockets(wall).find(s=>s.accepts.includes('floor'))!;
    const floor:Structure={id:'structure-3',pieceType:'floor',position:fs.position,rotation:fs.rotation,health:500,createdAt:0,parentId:wall.id,socketId:fs.id};
    const adjacent=getSockets(floor).find(s=>s.id.endsWith('adjacent:1'))!;
    const candidate=findBuildCandidate('floor',adjacent.position,0,[foundation,wall,floor],ground,()=>1000,{x:4,y:3,z:4});
    expect(candidate.valid).toBe(true);expect(candidate.parentId).toBe(floor.id);expect(candidate.position.y).toBe(floor.position.y);
  });

  it('retains a finished craft when its reserved capacity is externally filled and delivers exactly once', () => {
    const game=sim();game.addItem('fiber',20);expect(game.craft('bandage')).toBe(true);
    game.state.inventory=Array.from({length:30},()=>({itemId:'wood' as const,count:1000}));
    game.tick(3,false);expect(game.state.craftQueue).toHaveLength(1);expect(game.state.craftQueue[0].remaining).toBe(0);
    game.state.inventory[9]=null;game.tick(.1,false);game.tick(3,false);
    expect(game.count('bandage')).toBe(1);expect(game.state.craftQueue).toHaveLength(0);
  });
});
