// @ts-nocheck
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {activeLostPacks,consumeEmptyContainer,handlePlayerDeath,resolveRespawnBedroll,respawnPlayerState} from '../src/survival/death';
import {createStation,takeAll,transfer,validateStations} from '../src/survival/stations';
import {ensureProgression} from '../src/survival/progression';
import {loadGame,saveGame,validateGameState} from '../src/save/storage';
import type {GameState} from '../src/core/types';

const spawn={x:4,y:2,z:-3};
const game=()=>new GameSimulation(778,spawn);
class MemoryStorage{data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}}

describe('v0.7.8 player damage',()=>{
  it('clamps player damage at zero',()=>{const sim=game();expect(sim.damagePlayer(125,'environment')).toMatchObject({ok:true,health:0,killed:true});expect(sim.state.player.stats.health).toBe(0);});
  it.each([0,-1,Number.NaN,Infinity])('rejects invalid damage %s',amount=>{const sim=game();expect(sim.damagePlayer(amount).ok).toBe(false);expect(sim.state.player.stats.health).toBe(100);});
});

describe('one-shot death transaction',()=>{
  it('creates exactly one Lost Pack and repeated processing is idempotent',()=>{const sim=game(),first=handlePlayerDeath(sim.state,spawn,'test'),second=handlePlayerDeath(sim.state,spawn,'test');expect(first.processed).toBe(true);expect(second.processed).toBe(false);expect(activeLostPacks(sim.state)).toHaveLength(1);expect(second.packId).toBe(first.packId);});
  it('preserves the exact slot layout and total stack counts, then empties the player',()=>{const sim=game();sim.state.inventory[7]={itemId:'wood',count:417};sim.state.inventory[29]={itemId:'berries',count:6};sim.state.activeSlot=4;const before=sim.state.inventory.reduce((n,x)=>n+(x?.count??0),0);const result=handlePlayerDeath(sim.state,{x:7,y:1,z:9});const pack=activeLostPacks(sim.state)[0];expect(pack.inventory[0]).toEqual({itemId:'rock',count:1});expect(pack.inventory[7]).toEqual({itemId:'wood',count:417});expect(pack.inventory[29]).toEqual({itemId:'berries',count:6});expect(pack.inventory.reduce((n,x)=>n+(x?.count??0),0)).toBe(before);expect(result.lostItemCount).toBe(before);expect(sim.state.inventory.every(x=>x===null)).toBe(true);expect(sim.state.activeSlot).toBe(0);});
  it('leaves crafting, world drops, and unrelated station inventories unchanged',()=>{const sim=game();sim.state.craftQueue=[{recipeId:'bandage',remaining:1,total:2}];sim.state.drops=[{id:'drop-80',stack:{itemId:'stone',count:9},position:{x:1,y:1,z:1}}];const storage=createStation('storage-custom','storage',{x:2,y:1,z:2});storage.inventory[3]={itemId:'metal',count:12};ensureProgression(sim.state).stations.push(storage);const queue=structuredClone(sim.state.craftQueue),drops=structuredClone(sim.state.drops),stored=structuredClone(storage.inventory);handlePlayerDeath(sim.state,spawn);expect(sim.state.craftQueue).toEqual(queue);expect(sim.state.drops).toEqual(drops);expect(storage.inventory).toEqual(stored);});
  it('does not create an empty pack or evict an older pack for an empty death',()=>{const sim=game();handlePlayerDeath(sim.state,spawn);respawnPlayerState(sim.state);sim.state.inventory=Array(30).fill(null);const previous=activeLostPacks(sim.state)[0].id;handlePlayerDeath(sim.state,{x:8,y:1,z:8});expect(activeLostPacks(sim.state).map(x=>x.id)).toEqual([previous]);expect(ensureProgression(sim.state).death?.packId).toBeUndefined();});
});

describe('respawn and spawn selection',()=>{
  it('gives exactly Rock and Torch, resets stats, and marks the event respawned',()=>{const sim=game();sim.state.player.stats={health:0,hunger:1,thirst:2,stamina:3};handlePlayerDeath(sim.state,spawn);expect(respawnPlayerState(sim.state)).toBe(true);expect(sim.state.inventory.filter(Boolean)).toEqual([{itemId:'rock',count:1},{itemId:'torch',count:1}]);expect(sim.state.player.stats).toEqual({health:100,hunger:86,thirst:78,stamina:100});expect(ensureProgression(sim.state).death?.phase).toBe('respawned');expect(respawnPlayerState(sim.state)).toBe(false);});
  it('resolves a valid sleeping roll and safely clears missing or wrong-kind spawn ids',()=>{const sim=game(),p=ensureProgression(sim.state),bed=createStation('bed-a','bedroll',{x:12,y:3,z:4});p.stations.push(bed);p.spawnId=bed.id;expect(resolveRespawnBedroll(sim.state)).toBe(bed);p.spawnId='missing';expect(resolveRespawnBedroll(sim.state)).toBeUndefined();expect(p.spawnId).toBeUndefined();p.spawnId='box';p.stations.push(createStation('box','storage',spawn));expect(resolveRespawnBedroll(sim.state)).toBeUndefined();expect(p.spawnId).toBeUndefined();});
  it('falls back cleanly when no sleeping roll is selected',()=>{const sim=game();expect(resolveRespawnBedroll(sim.state)).toBeUndefined();expect(ensureProgression(sim.state).spawnId).toBeUndefined();});
});

describe('Lost Pack retrieval and retention',()=>{
  it('supports partial retrieval and removes the pack only after the final item',()=>{const sim=game();sim.state.inventory[2]={itemId:'wood',count:10};handlePlayerDeath(sim.state,spawn);respawnPlayerState(sim.state);const pack=activeLostPacks(sim.state)[0];expect(transfer(sim.state.inventory,pack,{container:'station',slot:2},{container:'player',slot:4},true,()=>true)).toBe(true);expect(pack.inventory[2]?.count).toBe(5);expect(consumeEmptyContainer(sim.state,pack.id)).toBeNull();expect(takeAll(sim.state.inventory,pack,()=>true)).toBe(7);expect(pack.inventory.every(x=>x===null)).toBe(true);expect(consumeEmptyContainer(sim.state,pack.id)?.kind).toBe('deathbag');expect(activeLostPacks(sim.state)).toHaveLength(0);expect(ensureProgression(sim.state).death?.packId).toBeUndefined();});
  it('keeps salvage-cache cleanup behavior shared but refuses permanent containers',()=>{const sim=game(),p=ensureProgression(sim.state),loot=createStation('loot-x','loot',spawn),storage=createStation('storage-x','storage',spawn);p.stations.push(loot,storage);expect(consumeEmptyContainer(sim.state,loot.id)?.kind).toBe('loot');expect(consumeEmptyContainer(sim.state,storage.id)).toBeNull();expect(p.stations).toContain(storage);});
  it('enforces five packs and deterministically removes the oldest',()=>{const sim=game(),ids:string[]=[];for(let i=0;i<6;i++){sim.state.elapsed=i;sim.state.inventory[2]={itemId:'wood',count:i+1};ids.push(handlePlayerDeath(sim.state,{x:i,y:1,z:i}).packId!);respawnPlayerState(sim.state);}expect(activeLostPacks(sim.state)).toHaveLength(5);expect(activeLostPacks(sim.state).map(x=>x.id)).toEqual(ids.slice(1));});
  it('validates deathbag station shape and refuses active processing state',()=>{const bag=createStation('deathbag-1','deathbag',spawn);bag.createdAt=0;expect(validateStations([bag])).toBe(true);bag.active=true;expect(validateStations([bag])).toBe(false);});
});

describe('death persistence and v0.7.7 compatibility',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));afterEach(()=>vi.unstubAllGlobals());
  it('round-trips a dead player, Lost Pack, and persistent death metadata',()=>{const sim=game();sim.state.inventory[8]={itemId:'metal',count:77};handlePlayerDeath(sim.state,{x:11,y:2,z:12},'qa');expect(saveGame(sim.state,1)).toBe(true);const loaded=loadGame(1)!;expect(loaded.player.stats.health).toBe(0);expect(loaded.inventory.every(x=>x===null)).toBe(true);expect(activeLostPacks(loaded)[0].inventory[8]).toEqual({itemId:'metal',count:77});expect(ensureProgression(loaded).death).toMatchObject({phase:'dead',cause:'qa'});const repeat=handlePlayerDeath(loaded,spawn);expect(repeat.processed).toBe(false);expect(activeLostPacks(loaded)).toHaveLength(1);});
  it('accepts a v0.7.7 save without death metadata and normalizes health-zero once',()=>{const legacy=game().state;legacy.player.stats.health=0;delete ensureProgression(legacy).death;expect(validateGameState(legacy)).toBe(true);const first=handlePlayerDeath(legacy,spawn,'legacy-save');expect(first.processed).toBe(true);expect(validateGameState(legacy)).toBe(true);expect(handlePlayerDeath(legacy,spawn).processed).toBe(false);});
  it('preserves v0.7.7 structure grade/health and Hammer implementation coverage',()=>{const sim=game();sim.state.structures=[{id:'structure-custom',pieceType:'foundation',position:{x:0,y:1,z:0},rotation:0,health:438,currentHealth:438,maxHealth:600,grade:'stone',createdAt:0}];expect(validateGameState(sim.state)).toBe(true);const source=readFileSync(new URL('../src/building/HammerMenu.ts',import.meta.url),'utf8');expect(source).toContain("data-hammer-action=\"upgrade\"");expect(source).toContain('HOLD TO DEMOLISH');});
});
