// @ts-nocheck
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ITEMS,isItemId} from '../src/items/definitions';
import {RECIPES} from '../src/crafting/recipes';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {activeLostPacks,consumeEmptyContainer,handlePlayerDeath,respawnPlayerState} from '../src/survival/death';
import {ECONOMY_VERSION,fillSalvageLoot,initializeWorldEconomy,RECYCLE_RECIPES,SALVAGE_COMPONENTS} from '../src/survival/economy';
import {accepts,countPlayerStations,createStation,isPlaceableStationKind,MAX_PLAYER_STATIONS,stationStatus,takeAll,tickStation,transfer,validateStations} from '../src/survival/stations';
import {ensureProgression} from '../src/survival/progression';
import {loadGame,saveGame,validateGameState} from '../src/save/storage';

const pos={x:0,y:5,z:0};
const game=()=>new GameSimulation(779,pos);
class MemoryStorage{data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}}
const recycler=()=>createStation('world-recycler-0','recycler',pos);
const run=(component,seconds=20)=>{const s=recycler();s.inventory[0]={itemId:component,count:1};s.active=true;tickStation(s,seconds);return s;};
const count=(slots,id)=>slots.reduce((n,x)=>n+(x?.itemId===id?x.count:0),0);
const pois=[{id:'poi-0',kind:0,position:{x:50,y:5,z:60}},{id:'poi-1',kind:1,position:{x:-50,y:5,z:60}},{id:'poi-2',kind:2,position:{x:-60,y:5,z:-50}},{id:'poi-3',kind:3,position:{x:60,y:5,z:-50}}];

describe('v0.7.9 salvage item definitions and persistence',()=>{
  it('keeps a v0.7.8 save valid without economy metadata',()=>{const state=game().state;delete ensureProgression(state).economyVersion;expect(validateGameState(state)).toBe(true);});
  it.each(['scrap','gears','wiring','machineParts','techParts'])('recognizes %s as a valid ItemId',id=>expect(isItemId(id)).toBe(true));
  it('rejects unknown component ids',()=>{const state=game().state;state.inventory[2]={itemId:'circuitTrash',count:1};expect(validateGameState(state)).toBe(false);});
  it('enforces Scrap and component stack sizes',()=>{expect(ITEMS.scrap.maxStack).toBe(1000);expect(ITEMS.gears.maxStack).toBe(100);expect(ITEMS.wiring.maxStack).toBe(100);expect(ITEMS.machineParts.maxStack).toBe(100);expect(ITEMS.techParts.maxStack).toBe(50);});
  it('keeps salvage out of crafting recipes',()=>{const results=Object.values(RECIPES).map(r=>r.resultItemId);expect(results).not.toContain('scrap');for(const id of SALVAGE_COMPONENTS)expect(results).not.toContain(id);expect(results).not.toContain('recycler');});
  it('round-trips salvage inventory and world drops',()=>{vi.stubGlobal('localStorage',new MemoryStorage());const sim=game();sim.state.inventory[4]={itemId:'scrap',count:777};sim.state.drops.push({id:'drop-70',stack:{itemId:'techParts',count:2},position:pos});sim.state.nextId=71;expect(saveGame(sim.state,1)).toBe(true);const loaded=loadGame(1)!;expect(loaded.inventory[4]).toEqual({itemId:'scrap',count:777});expect(loaded.drops[0].stack).toEqual({itemId:'techParts',count:2});});
});

describe('Recycler slot rules and recipes',()=>{
  it('is neither player-placeable nor craftable',()=>{expect(isPlaceableStationKind('recycler')).toBe(false);expect(Object.values(RECIPES).some(r=>r.resultItemId==='recycler')).toBe(false);});
  it.each(SALVAGE_COMPONENTS)('accepts %s in input',id=>expect(accepts(recycler(),0,{itemId:id,count:1})).toBe(true));
  it.each(['scrap','wood','stone','metal','ore','rock'])('rejects %s in input',id=>expect(accepts(recycler(),0,{itemId:id,count:1})).toBe(false));
  it('protects output deposits but permits output extraction',()=>{const sim=game(),s=recycler();sim.state.inventory[2]={itemId:'wiring',count:2};expect(transfer(sim.state.inventory,s,{container:'player',slot:2},{container:'station',slot:3},false,()=>true)).toBe(false);s.inventory[3]={itemId:'scrap',count:10};expect(transfer(sim.state.inventory,s,{container:'station',slot:3},{container:'player',slot:5},false,()=>true)).toBe(true);expect(sim.state.inventory[5]).toEqual({itemId:'scrap',count:10});});
  it.each(SALVAGE_COMPONENTS)('turns one %s into its exact centralized outputs',id=>{const s=run(id),recipe=RECYCLE_RECIPES[id];expect(count(s.inventory,'scrap')).toBe(recipe.scrap);expect(count(s.inventory,'metal')).toBe(recipe.metal);expect(s.inventory.slice(0,3).every(x=>x===null)).toBe(true);expect(s.job).toBeNull();});
  it('makes Tech Parts more valuable than Machine Parts',()=>expect(RECYCLE_RECIPES.techParts.scrap).toBeGreaterThan(RECYCLE_RECIPES.machineParts.scrap));
  it('consumes input exactly once at job start',()=>{const s=recycler();s.inventory[0]={itemId:'wiring',count:2};s.active=true;tickStation(s,.5);expect(s.inventory[0]?.count).toBe(1);tickStation(s,.5);expect(s.inventory[0]?.count).toBe(1);});
  it('blocks a full output atomically without consuming input',()=>{const s=recycler();s.inventory[0]={itemId:'techParts',count:1};s.inventory[3]={itemId:'scrap',count:1000};s.inventory[4]={itemId:'metal',count:1000};s.inventory[5]={itemId:'scrap',count:1000};s.active=true;expect(stationStatus(s)).toBe('BLOCKED_OUTPUT_FULL');tickStation(s,20);expect(s.inventory[0]).toEqual({itemId:'techParts',count:1});expect(s.job).toBeNull();});
  it('does not process while OFF and does while ON',()=>{const s=recycler();s.inventory[0]={itemId:'gears',count:1};tickStation(s,10);expect(s.inventory[0]?.count).toBe(1);s.active=true;tickStation(s,.25);expect(s.inventory[0]).toBeNull();expect(stationStatus(s)).toBe('PROCESSING');});
  it('continues through the next component while ON',()=>{const s=recycler();s.inventory[0]={itemId:'wiring',count:2};s.active=true;tickStation(s,3.1);expect(count(s.inventory,'scrap')).toBe(12);expect(count(s.inventory,'metal')).toBe(8);expect(s.job).toBeNull();});
});

describe('Recycler persistence and duplication safety',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));afterEach(()=>vi.unstubAllGlobals());
  it('preserves an active job and remaining time',()=>{const sim=game(),s=recycler();s.inventory[0]={itemId:'techParts',count:1};s.active=true;ensureProgression(sim.state).stations.push(s);tickStation(s,1.6);expect(s.job?.remaining).toBeCloseTo(1.4);expect(saveGame(sim.state,1)).toBe(true);const loaded=loadGame(1)!,saved=ensureProgression(loaded).stations[0];expect(saved.active).toBe(true);expect(saved.job).toMatchObject({recipe:'techParts'});expect(saved.job?.remaining).toBeCloseTo(1.4);});
  it('does not duplicate output after save/reload',()=>{const sim=game(),s=recycler();s.inventory[0]={itemId:'gears',count:1};s.active=true;ensureProgression(sim.state).stations.push(s);tickStation(s,1);saveGame(sim.state,1);const loaded=loadGame(1)!,saved=ensureProgression(loaded).stations[0];tickStation(saved,1.1);expect(count(saved.inventory,'scrap')).toBe(10);expect(count(saved.inventory,'metal')).toBe(10);tickStation(saved,20);expect(count(saved.inventory,'scrap')).toBe(10);expect(count(saved.inventory,'metal')).toBe(10);});
  it('validates jobs and rejects malformed recipes or times',()=>{const s=recycler();s.job={recipe:'wiring',remaining:1.4};expect(validateStations([s])).toBe(true);s.job={recipe:'wood',remaining:1};expect(validateStations([s])).toBe(false);s.job={recipe:'techParts',remaining:3.1};expect(validateStations([s])).toBe(false);});
});

describe('economy world bootstrap and loot',()=>{
  it('spawns deterministic world Recyclers exactly once',()=>{const state=game().state,make=(id,kind,p,r)=>createStation(id,kind,p,r);const positions=initializeWorldEconomy(state,pois,()=>5,779,make,false),first=ensureProgression(state).stations.filter(s=>s.kind==='recycler').map(s=>({id:s.id,position:s.position}));expect(initializeWorldEconomy(state,pois,()=>5,779,make,false)).toEqual(positions);const second=ensureProgression(state).stations.filter(s=>s.kind==='recycler').map(s=>({id:s.id,position:s.position}));expect(first).toHaveLength(2);expect(second).toEqual(first);expect(first.map(x=>x.id)).toEqual(['world-recycler-0','world-recycler-1']);});
  it('bootstraps a v0.7.8 world once without rewriting existing loot',()=>{const state=game().state,p=ensureProgression(state),old=createStation('old-loot','loot',pos),make=(id,kind,p,r)=>createStation(id,kind,p,r);old.inventory[0]={itemId:'wood',count:17};p.stations=[old];p.lootGenerated=true;delete p.economyVersion;initializeWorldEconomy(state,pois,()=>5,780,make);expect(p.economyVersion).toBe(ECONOMY_VERSION);expect(old.inventory[0]).toEqual({itemId:'wood',count:17});expect(p.stations.filter(s=>s.id.startsWith('salvage-v079-'))).toHaveLength(3);const total=p.stations.length;initializeWorldEconomy(state,pois,()=>5,780,make);expect(p.stations).toHaveLength(total);});
  it.each(['common','decent','lucky'])('guarantees salvage value in a %s cache even on failed rolls',tier=>{const station=createStation(`loot-${tier}`,'loot',pos);fillSalvageLoot(station,tier,()=>.999);expect(station.inventory.some(x=>x&&['scrap',...SALVAGE_COMPONENTS].includes(x.itemId))).toBe(true);});
});

describe('cross-system regressions',()=>{
  it('moves salvage through death, Lost Pack and recovery without special cases',()=>{const sim=game();sim.state.inventory[2]={itemId:'scrap',count:40};sim.state.inventory[3]={itemId:'gears',count:3};sim.state.inventory[4]={itemId:'techParts',count:1};handlePlayerDeath(sim.state,pos);const pack=activeLostPacks(sim.state)[0];expect(pack.inventory.slice(2,5)).toEqual([{itemId:'scrap',count:40},{itemId:'gears',count:3},{itemId:'techParts',count:1}]);respawnPlayerState(sim.state);takeAll(sim.state.inventory,pack,()=>true);expect(count(sim.state.inventory,'scrap')).toBe(40);expect(count(sim.state.inventory,'gears')).toBe(3);expect(count(sim.state.inventory,'techParts')).toBe(1);expect(consumeEmptyContainer(sim.state,pack.id)?.kind).toBe('deathbag');});
  it('keeps furnace input/fuel/output behavior',()=>{const s=createStation('f','furnace',pos);s.inventory[0]={itemId:'ore',count:10};s.inventory[2]={itemId:'wood',count:5};s.active=true;tickStation(s,8);expect(count(s.inventory,'metal')).toBe(10);expect(s.inventory[0]).toBeNull();expect(s.inventory[2]).toBeNull();});
  it('keeps campfire fuel and persistent job behavior',()=>{const s=createStation('c','campfire',pos);s.inventory[0]={itemId:'wood',count:2};s.active=true;tickStation(s,12);expect(s.inventory[0]?.count).toBe(1);expect(s.job?.recipe).toBe('fire');expect(s.job?.remaining).toBe(18);expect(validateStations([JSON.parse(JSON.stringify(s))])).toBe(true);});
  it('counts only player-placeable stations against the player limit',()=>{const stations=[createStation('storage','storage',pos),createStation('loot','loot',pos),createStation('bag','deathbag',pos),createStation('recycler','recycler',pos)];stations[2].createdAt=0;expect(countPlayerStations(stations)).toBe(1);expect(MAX_PLAYER_STATIONS).toBe(500);});
});
