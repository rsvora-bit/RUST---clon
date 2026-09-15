import {describe,expect,it} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {GATHERING} from '../src/config/gameplay';
import {ITEMS} from '../src/items/definitions';
import {validateGameState} from '../src/save/storage';
import {GameSimulation} from '../src/simulation/GameSimulation';

describe('v0.7.4 seeded world variety',()=>{
  it('keeps generation 2 spawn stable but gives generation 3 seed-dependent spawn',()=>{
    const oldWorld=new IslandTerrain(731942,2),a=new IslandTerrain(731942,3),a2=new IslandTerrain(731942,3),b=new IslandTerrain(123456,3);
    expect({x:oldWorld.spawn.x,z:oldWorld.spawn.z}).toEqual({x:28,z:212});
    expect({x:a.spawn.x,z:a.spawn.z}).toEqual({x:a2.spawn.x,z:a2.spawn.z});
    expect(Math.hypot(a.spawn.x-b.spawn.x,a.spawn.z-b.spawn.z)).toBeGreaterThan(5);
    expect(a.spawn.y).toBeGreaterThan(2);
  });
  it('ships sulfur and high quality metal as gatherable resources',()=>{
    expect(GATHERING.sulfur.itemId).toBe('sulfurOre');expect(GATHERING.hqmetal.itemId).toBe('hqMetalOre');
    expect(ITEMS.sulfurOre.displayName).toBe('Sulfur ore');expect(ITEMS.hqMetalOre.displayName).toContain('High quality');
  });
  it('accepts generation 3 save snapshots while new worlds use generation 5',()=>{
    const sim=new GameSimulation(99,{x:0,y:5,z:0});expect(sim.state.worldGeneration).toBe(5);expect(validateGameState(sim.state)).toBe(true);expect(validateGameState({...sim.state,worldGeneration:3})).toBe(true);
  });
});
