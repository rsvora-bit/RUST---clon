import {describe,expect,it} from 'vitest';
import {equipmentMitigation} from '../src/combat/equipment';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';

const spawn={x:4,y:2,z:-3};

describe('field clothing and equipment',()=>{
  it('equips the correct slot, returns replaced clothing to the same inventory slot, and persists',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.inventory[7]={itemId:'warmJacket',count:1};
    expect(sim.equip(7)).toBe(true);expect(sim.state.player.equipment?.body).toBe('warmJacket');expect(sim.state.inventory[7]).toBeNull();
    sim.state.inventory[7]={itemId:'shirt',count:1};expect(sim.equip(7)).toBe(true);
    expect(sim.state.inventory[7]).toEqual({itemId:'warmJacket',count:1});expect(sim.state.player.equipment?.body).toBe('shirt');
    expect(validateGameState(sim.state)).toBe(true);
  });

  it('rejects non-equipment, stacks, and malformed slot combinations',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.inventory[7]={itemId:'hide',count:1};expect(sim.equip(7)).toBe(false);
    sim.state.inventory[7]={itemId:'boots',count:2};expect(sim.equip(7)).toBe(false);
    sim.state.player.equipment={body:'boots'};expect(validateGameState(sim.state)).toBe(false);
  });

  it('mitigates damage by category with a bounded total and accepts legacy saves without equipment',()=>{
    const sim=new GameSimulation(12,spawn);expect(equipmentMitigation(undefined,'cold')).toBe(0);
    sim.state.player.equipment={body:'warmJacket',feet:'boots',head:'protectiveHood',legs:'pants'};
    expect(equipmentMitigation(sim.state.player.equipment,'cold')).toBeCloseTo(.46);
    expect(equipmentMitigation(sim.state.player.equipment,'melee')).toBeCloseTo(.17);
    expect(equipmentMitigation({...sim.state.player.equipment,body:'shirt'},'melee')).toBeLessThan(.55);
    expect(sim.takeDamage({amount:50,type:'cold'}).applied).toBeCloseTo(27);
    const oldSave=structuredClone(sim.state);delete oldSave.player.equipment;
    expect(validateGameState(oldSave)).toBe(true);
    const loaded=new GameSimulation(12,spawn,oldSave);expect(loaded.state.player.equipment).toEqual({});
  });
});
