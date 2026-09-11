import {describe,it,expect} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';
describe('world generation compatibility',()=>{
 it('preserves legacy saves and records the generator on new worlds',()=>{
  const state=new GameSimulation(731942,{x:28,y:6,z:212}).state;
  expect(state.worldGeneration).toBe(2);expect(validateGameState(state)).toBe(true);
  delete state.worldGeneration;
  expect(validateGameState(state)).toBe(true);
  expect(new GameSimulation(state.seed,state.player.position,state).state.worldGeneration).toBeUndefined();
  expect(validateGameState({...state,worldGeneration:99})).toBe(false);
 });
 it('is deterministic, changes inland landforms and preserves the construction clearing',()=>{
  const legacy=new IslandTerrain(731942,1),current=new IslandTerrain(731942,2),repeat=new IslandTerrain(731942,2);
  expect(current.heights).toEqual(repeat.heights);
  expect(current.heightAt(0,-70)).toBeGreaterThan(legacy.heightAt(0,-70)+10);
  for(const x of [22,25,28])for(const z of [218,221,224])expect(current.heightAt(x,z)).toBeCloseTo(legacy.heightAt(x,z),4);
  for(const t of [legacy,current,repeat]){expect([...t.heights].every(Number.isFinite)).toBe(true);t.geometry.dispose();t.heightTexture.dispose();}
 });
});
