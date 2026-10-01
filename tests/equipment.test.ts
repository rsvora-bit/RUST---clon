import {describe,expect,it} from 'vitest';
import {equipmentMitigation,equipmentWear} from '../src/combat/equipment';
import {maxDurability} from '../src/combat/durability';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';
import {createStation} from '../src/survival/stations';

const spawn={x:4,y:2,z:-3};

describe('field clothing and equipment',()=>{
  it('equips the correct slot, returns replaced clothing to the same inventory slot, and persists',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.inventory[7]={itemId:'warmJacket',count:1};
    expect(sim.equip(7)).toBe(true);expect(sim.state.player.equipment?.body).toBe('warmJacket');expect(sim.state.inventory[7]).toBeNull();
    sim.state.player.equipmentCondition={body:42};sim.state.inventory[7]={itemId:'shirt',count:1,condition:24};expect(sim.equip(7)).toBe(true);
    expect(sim.state.inventory[7]).toEqual({itemId:'warmJacket',count:1,condition:42});expect(sim.state.player.equipment?.body).toBe('shirt');expect(sim.state.player.equipmentCondition?.body).toBe(24);
    expect(validateGameState(sim.state)).toBe(true);
    const loaded=new GameSimulation(12,spawn,structuredClone(sim.state));expect(loaded.state.player.equipmentCondition?.body).toBe(24);
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
    const wornHoodMitigation=.35*(maxDurability('protectiveHood')-equipmentWear(50,'cold'))/maxDurability('protectiveHood');
    expect(equipmentMitigation(sim.state.player.equipment,'toxic',sim.state.player.equipmentCondition)).toBeCloseTo(wornHoodMitigation);
    expect(sim.takeDamage({amount:10,type:'toxic'}).applied).toBeCloseTo(10*(1-wornHoodMitigation));
    const oldSave=structuredClone(sim.state);delete oldSave.player.equipment;delete oldSave.player.equipmentCondition;
    expect(validateGameState(oldSave)).toBe(true);
    const loaded=new GameSimulation(12,spawn,oldSave);expect(loaded.state.player.equipment).toEqual({});
  });

  it('wears only protective clothing on matching hits and condition loss weakens mitigation',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.player.equipment={body:'warmJacket',head:'protectiveHood'};
    const jacketMax=maxDurability('warmJacket'),hoodMax=maxDurability('protectiveHood');sim.state.player.equipmentCondition={body:jacketMax,head:hoodMax};
    const hit=sim.takeDamage({amount:20,type:'projectile'});
    expect(hit.applied).toBeCloseTo(20*(1-.03));expect(sim.state.player.equipmentCondition?.body).toBeLessThan(jacketMax);expect(sim.state.player.equipmentCondition?.head).toBe(hoodMax);
    sim.state.player.equipmentCondition!.body=1;
    const wornThrough=sim.takeDamage({amount:20,type:'projectile'});expect(wornThrough.applied).toBeGreaterThan(hit.applied);expect(sim.state.player.equipment?.body).toBeUndefined();expect(sim.state.player.equipmentCondition?.body).toBeUndefined();
    expect(equipmentMitigation(sim.state.player.equipment,'projectile',sim.state.player.equipmentCondition)).toBe(0);
    expect(validateGameState(sim.state)).toBe(true);
  });

  it('accepts legacy equipped clothing at full condition and rejects invalid condition snapshots',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.player.equipment={body:'warmJacket'};delete sim.state.player.equipmentCondition;
    expect(validateGameState(sim.state)).toBe(true);expect(equipmentMitigation(sim.state.player.equipment,'cold',sim.state.player.equipmentCondition)).toBeCloseTo(.28);
    const damaged=structuredClone(sim.state);damaged.player.equipmentCondition={body:maxDurability('warmJacket')-1};expect(validateGameState(damaged)).toBe(true);
    damaged.player.equipmentCondition={body:maxDurability('warmJacket')+1};expect(validateGameState(damaged)).toBe(false);
    damaged.player.equipmentCondition={head:20};expect(validateGameState(damaged)).toBe(false);
  });

  it('repairs unequipped clothing at a workbench with salvage materials',()=>{
    const sim=new GameSimulation(12,spawn);sim.state.inventory[7]={itemId:'warmJacket',count:1,condition:30};
    sim.state.progression!.stations.push(createStation('bench-clothing','workbench1',spawn));sim.addItem('fiber',12);sim.addItem('hide',8);
    expect(sim.repairTool(7)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[7]).toEqual({itemId:'warmJacket',count:1,condition:75});
    expect(sim.count('fiber')).toBe(0);expect(sim.count('hide')).toBe(0);expect(validateGameState(sim.state)).toBe(true);
  });

  it('repairs salvage armor with industrial materials and gives it a distinct cold-versus-projectile tradeoff',()=>{
    const sim=new GameSimulation(22,spawn);sim.state.inventory[7]={itemId:'salvageVest',count:1,condition:40};
    sim.state.progression!.stations.push(createStation('bench-salvage-armor','workbench2',spawn));sim.addItem('metal',14);sim.addItem('machineParts',1);sim.addItem('fiber',8);sim.addItem('hide',4);
    expect(sim.repairTool(7)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[7]).toEqual({itemId:'salvageVest',count:1,condition:85});
    expect(equipmentMitigation({body:'salvageVest'},'projectile')).toBeCloseTo(.24);expect(equipmentMitigation({body:'salvageVest'},'cold')).toBe(0);
    expect(equipmentMitigation({body:'warmJacket'},'cold')).toBeCloseTo(.28);expect(equipmentMitigation({body:'warmJacket'},'projectile')).toBeCloseTo(.03);
    expect(validateGameState(sim.state)).toBe(true);
  });

  it('industrial plate trades weather insulation for stronger protection and persists condition',()=>{
    const sim=new GameSimulation(23,spawn);sim.state.inventory[7]={itemId:'yardPlate',count:1,condition:40};
    sim.state.progression!.stations.push(createStation('bench-yard-armor','workbench3',spawn));sim.addItem('metal',24);sim.addItem('machineParts',2);sim.addItem('techParts',1);
    expect(sim.repairTool(7)).toEqual({ok:true,reason:'ok'});expect(sim.state.inventory[7]).toEqual({itemId:'yardPlate',count:1,condition:85});
    expect(equipmentMitigation({body:'yardPlate'},'projectile')).toBeCloseTo(.38);expect(equipmentMitigation({body:'yardPlate'},'melee')).toBeCloseTo(.28);expect(equipmentMitigation({body:'yardPlate'},'cold')).toBe(0);
    expect(equipmentMitigation({body:'salvageVest'},'projectile')).toBeLessThan(equipmentMitigation({body:'yardPlate'},'projectile'));expect(equipmentMitigation({body:'warmJacket'},'cold')).toBeGreaterThan(equipmentMitigation({body:'yardPlate'},'cold'));
    const save=structuredClone(sim.state);expect(validateGameState(save)).toBe(true);const loaded=new GameSimulation(23,spawn,save);expect(loaded.state.inventory[7]).toEqual({itemId:'yardPlate',count:1,condition:85});
  });
});
