import {describe,expect,it} from 'vitest';
import {createStation} from '../src/survival/stations';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';

const spawn={x:0,y:2,z:4};

describe('persistent tool condition and repair',()=>{
  it('preserves condition across moves, drops and pickups, and removes a broken tool',()=>{
    const sim=new GameSimulation(77,spawn);expect(sim.wearItem(0,15)).toBe(false);expect(sim.state.inventory[0]).toEqual({itemId:'rock',count:1,condition:55});
    sim.moveItem(0,8);expect(sim.state.inventory[8]?.condition).toBe(55);
    const drop=sim.dropItem(8,spawn)!;expect(drop.stack.condition).toBe(55);expect(sim.pickup(drop.id)).toBe(true);
    const carried=sim.state.inventory.findIndex(stack=>stack?.itemId==='rock');expect(sim.state.inventory[carried]?.condition).toBe(55);
    expect(sim.wearItem(carried,100)).toBe(true);expect(sim.state.inventory[carried]).toBeNull();
  });

  it('repairs at an existing workbench for materials and saves the repaired condition',()=>{
    const sim=new GameSimulation(77,spawn);sim.state.inventory[0]={itemId:'hatchet',count:1,condition:20};
    expect(sim.repairTool(0)).toEqual({ok:false,reason:'workbench'});
    sim.state.progression!.stations.push(createStation('bench-1','workbench1',spawn));sim.addItem('stone',12);sim.addItem('wood',6);
    expect(sim.repairTool(0)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[0]).toEqual({itemId:'hatchet',count:1,condition:65});
    expect(sim.count('stone')).toBe(0);expect(sim.count('wood')).toBe(0);expect(validateGameState(sim.state)).toBe(true);
    sim.addItem('stone',12);sim.addItem('wood',6);
    expect(sim.repairTool(0)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[0]?.condition).toBe(110);
    expect(sim.repairTool(0)).toEqual({ok:false,reason:'full'});
  });

  it('accepts old tool stacks and rejects invalid or non-durable condition fields',()=>{
    const sim=new GameSimulation(77,spawn);expect(validateGameState(sim.state)).toBe(true);
    sim.state.inventory[0]={itemId:'hatchet',count:1,condition:80};expect(validateGameState(sim.state)).toBe(true);
    sim.state.inventory[0]={itemId:'wood',count:1,condition:80};expect(validateGameState(sim.state)).toBe(false);
    sim.state.inventory[0]={itemId:'hatchet',count:1,condition:0};expect(validateGameState(sim.state)).toBe(false);
  });

  it('persists and repairs condition for the advanced salvage melee weapon',()=>{
    const sim=new GameSimulation(78,spawn);sim.state.inventory[0]={itemId:'docksideCleaver',count:1,condition:83};expect(validateGameState(structuredClone(sim.state))).toBe(true);
    sim.state.progression!.stations.push(createStation('bench-2','workbench2',spawn));sim.addItem('metal',14);sim.addItem('machineParts',1);expect(sim.repairTool(0)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[0]).toMatchObject({itemId:'docksideCleaver',condition:128});expect(validateGameState(structuredClone(sim.state))).toBe(true);
  });
  it('preserves and industrially repairs the Quarry maul through its high-tier materials',()=>{
    const sim=new GameSimulation(79,spawn);sim.state.inventory[0]={itemId:'quarryMaul',count:1,condition:120};expect(validateGameState(structuredClone(sim.state))).toBe(true);
    sim.state.progression!.stations.push(createStation('bench-3','workbench3',spawn));sim.addItem('metal',24);sim.addItem('machineParts',2);sim.addItem('hqMetalOre',3);
    expect(sim.repairTool(0)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[0]).toMatchObject({itemId:'quarryMaul',condition:165});expect(sim.count('hqMetalOre')).toBe(0);expect(validateGameState(structuredClone(sim.state))).toBe(true);
  });
});
