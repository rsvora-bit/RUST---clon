import {beforeEach,describe,expect,it,vi} from 'vitest';
import {FIREARMS,consumeLoadedRound,firearmDoorDamage,firearmShotDirection,loadedRounds,roundsToLoad} from '../src/combat/firearms';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {createStation} from '../src/survival/stations';
import {ensureProgression} from '../src/survival/progression';
import {loadGame,resetSave,saveGame,validateGameState} from '../src/save/storage';

class MemoryStorage{private data=new Map<string,string>();getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,String(value));}removeItem(key:string){this.data.delete(key);}clear(){this.data.clear();}}
describe('salvage revolver',()=>{
  beforeEach(()=>{vi.stubGlobal('localStorage',new MemoryStorage());resetSave();});
  it('uses deterministic normalized low spread and consumes one loaded cartridge per shot',()=>{
    const stack={itemId:'salvageRevolver' as const,count:1,loadedAmmo:2},a=firearmShotDirection({x:0,y:0,z:-3},7),b=firearmShotDirection({x:0,y:0,z:-3},7);
    expect(a).toEqual(b);expect(Math.hypot(a.x,a.y,a.z)).toBeCloseTo(1);expect(a.x).toBeCloseTo(0,1);expect(loadedRounds(stack)).toBe(2);
    expect(consumeLoadedRound(stack)).toBe(true);expect(consumeLoadedRound(stack)).toBe(true);expect(consumeLoadedRound(stack)).toBe(false);expect(stack.loadedAmmo).toBe(0);
  });
  it('fills only the missing magazine capacity and persists rounds in compatible saves',()=>{
    const g=new GameSimulation(91,{x:0,y:5,z:0}),stack={itemId:'salvageRevolver' as const,count:1,loadedAmmo:4,condition:82};g.state.inventory[2]=stack;g.addItem('pistolAmmo',10);
    expect(roundsToLoad(stack,g.count('pistolAmmo'))).toBe(2);stack.loadedAmmo+=2;g.removeItem('pistolAmmo',2);expect(validateGameState(g.state)).toBe(true);expect(saveGame(g.state,1)).toBe(true);
    expect(loadGame(1)?.inventory[2]).toEqual({itemId:'salvageRevolver',count:1,loadedAmmo:6,condition:82});
    const invalid=structuredClone(g.state);invalid.inventory[2]!.loadedAmmo=7;expect(validateGameState(invalid)).toBe(false);
    const legacy=structuredClone(g.state);legacy.inventory[2]!.loadedAmmo=undefined;expect(validateGameState(legacy)).toBe(true);
    const wrong=structuredClone(g.state);wrong.inventory[3]={itemId:'pistolAmmo',count:2,loadedAmmo:1};expect(validateGameState(wrong)).toBe(false);
  });
  it('repairs a worn revolver at a workbench with salvage materials',()=>{
    const g=new GameSimulation(93,{x:0,y:5,z:0});ensureProgression(g.state).stations.push(createStation('bench-repair','workbench2',{x:0,y:5,z:0}));g.state.inventory[2]={itemId:'salvageRevolver',count:1,condition:73,loadedAmmo:3};g.addItem('metal',16);g.addItem('machineParts',1);
    expect(g.repairTool(2)).toEqual({ok:true,reason:'ok'});expect(g.state.inventory[2]).toMatchObject({itemId:'salvageRevolver',condition:118,loadedAmmo:3});expect(g.count('metal')).toBe(0);expect(g.count('machineParts')).toBe(0);expect(validateGameState(g.state)).toBe(true);
  });
  it('requires Workbench II research and pays salvage costs for gun and ammunition',()=>{
    const g=new GameSimulation(92,{x:0,y:5,z:0}),p=ensureProgression(g.state);p.stations.push(createStation('bench-2','workbench2',{x:0,y:5,z:0}));g.addItem('scrap',90);g.addItem('metal',150);g.addItem('machineParts',3);g.addItem('gears',2);g.addItem('wood',20);g.addItem('sulfurOre',7);
    expect(g.canCraft('field_revolver')).toBe(false);expect(g.researchTech('advancedFabrication').ok).toBe(false);
    expect(g.researchTech('workbench2Research').ok).toBe(true);g.addItem('scrap',90);expect(g.researchTech('advancedFabrication').ok).toBe(true);
    expect(g.canCraft('field_revolver')).toBe(true);expect(g.canCraft('pistol_cartridges')).toBe(false);g.addItem('scrap',3);g.addItem('sulfurOre',1);expect(g.craft('field_revolver')).toBe(true);expect(g.craft('pistol_cartridges')).toBe(true);g.tick(9,false);g.tick(4,false);
    expect(g.count('salvageRevolver')).toBe(1);expect(g.count('pistolAmmo')).toBe(8);expect(validateGameState(g.state)).toBe(true);expect(FIREARMS.salvageRevolver.magazineSize).toBe(6);
  });
  it('models the research-gated Tidal shotgun as eight deterministic pellets per shell',()=>{
    const weapon=FIREARMS.fieldShotgun,stack={itemId:'fieldShotgun' as const,count:1,loadedAmmo:4,condition:141};
    expect(weapon.pellets).toBe(8);expect(weapon.ammoItemId).toBe('shotgunShells');expect(weapon.range).toBeLessThan(FIREARMS.salvageRevolver.range);
    expect(firearmShotDirection({x:0,y:0,z:-1},11,weapon)).toEqual(firearmShotDirection({x:0,y:0,z:-1},11,weapon));
    expect(firearmShotDirection({x:0,y:0,z:-1},1,weapon).x).not.toBeCloseTo(firearmShotDirection({x:0,y:0,z:-1},2,weapon).x,4);
    expect(consumeLoadedRound(stack,weapon)).toBe(true);expect(stack.loadedAmmo).toBe(3);expect(roundsToLoad(stack,12,weapon)).toBe(1);
  });
  it('lets scarce firearm rounds breach wooden doors while upgraded grades resist more',()=>{
    const revolver=FIREARMS.salvageRevolver,shotgun=FIREARMS.fieldShotgun;
    expect(firearmDoorDamage(revolver,0,'wood')).toBe(34);expect(firearmDoorDamage(revolver,0,'stone')).toBeCloseTo(14.28);expect(firearmDoorDamage(revolver,0,'metal')).toBeCloseTo(6.12);
    expect(firearmDoorDamage(revolver,29,'wood')).toBeCloseTo(25.5);expect(firearmDoorDamage(shotgun,0,'wood')).toBe(9);
  });
  it('validates shotgun loaded shells and preserves them through save/reload and repair',()=>{
    const g=new GameSimulation(94,{x:0,y:5,z:0});ensureProgression(g.state).stations.push(createStation('bench-shotgun','workbench1',{x:0,y:5,z:0}));g.state.inventory[2]={itemId:'fieldShotgun',count:1,condition:80,loadedAmmo:3};g.addItem('metal',24);g.addItem('machineParts',2);g.addItem('shotgunShells',10);
    expect(validateGameState(g.state)).toBe(true);expect(saveGame(g.state,1)).toBe(true);expect(loadGame(1)?.inventory[2]).toMatchObject({itemId:'fieldShotgun',loadedAmmo:3,condition:80});
    expect(g.repairTool(2)).toEqual({ok:true,reason:'ok'});expect(g.state.inventory[2]).toMatchObject({itemId:'fieldShotgun',loadedAmmo:3,condition:125});
    const invalid=structuredClone(g.state);invalid.inventory[2]!.loadedAmmo=5;expect(validateGameState(invalid)).toBe(false);
    const wrong=structuredClone(g.state);wrong.inventory[3]={itemId:'shotgunShells',count:2,loadedAmmo:1};expect(validateGameState(wrong)).toBe(false);
  });
});
