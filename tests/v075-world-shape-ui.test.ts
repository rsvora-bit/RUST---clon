import {describe,it,expect} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {GATHERING} from '../src/config/gameplay';

describe('v0.7.5 expanded world and resource labels',()=>{
  it('records generation 4 on new worlds and keeps the terrain deterministic',()=>{
    const a=new IslandTerrain(445152874,4),b=new IslandTerrain(445152874,4);
    const state=new GameSimulation(445152874,a.spawn).state;
    expect(state.worldGeneration).toBe(4);
    expect(a.heights).toEqual(b.heights);
    const samples=[0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,Math.PI*5/4,Math.PI*3/2,Math.PI*7/4].map(angle=>a.heightAt(Math.cos(angle)*300,Math.sin(angle)*300));
    expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(2);
    a.geometry.dispose();a.heightTexture.dispose();b.geometry.dispose();b.heightTexture.dispose();
  });
  it('uses concise mineral target names',()=>{
    expect(GATHERING.stone.label).toBe('Stone');
    expect(GATHERING.metal.label).toBe('Metal Ore');
    expect(GATHERING.sulfur.label).toBe('Sulfur Ore');
    expect(GATHERING.hqmetal.label).toBe('High Quality Metal Ore');
  });
});
