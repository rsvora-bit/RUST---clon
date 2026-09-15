import {describe,expect,it} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {fallDamageForSpeed} from '../src/player/fallDamage';
import {FALL_DAMAGE,WORLD,WORLD_GENERATION_5} from '../src/config/balance';
import {generateWorldLayout,mapToWorld,worldToMap} from '../src/survival/WorldSurvival';
import {treeDensityForBiome,treeSpeciesForBiome} from '../src/rendering/environment';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';

const dispose=(...terrains:IslandTerrain[])=>terrains.forEach(t=>{t.geometry.dispose();t.heightTexture.dispose();});

describe('generation 5 world overhaul',()=>{
  it('uses the larger dynamic terrain grid for new worlds',()=>{
    const terrain=new IslandTerrain(731942,5),sim=new GameSimulation(731942,terrain.spawn);
    expect(terrain.size).toBe(WORLD_GENERATION_5.SIZE);expect(terrain.resolution).toBe(WORLD_GENERATION_5.RESOLUTION);
    expect(terrain.bounds).toEqual({minX:-640,maxX:640,minZ:-640,maxZ:640});expect(sim.state.worldGeneration).toBe(5);expect(validateGameState(sim.state)).toBe(true);dispose(terrain);
  });
  it('preserves legacy generator dimensions and accepts generations 1 through 4',()=>{
    for(const generation of [1,2,3,4] as const){const terrain=new IslandTerrain(81,generation);expect(terrain.size).toBe(WORLD.SIZE);expect(terrain.resolution).toBe(WORLD.RESOLUTION);const state=new GameSimulation(81,terrain.spawn).state;state.worldGeneration=generation;expect(validateGameState(state)).toBe(true);dispose(terrain);}
  });
  it('is deterministic and creates a bounded deterministic satellite archipelago',()=>{
    const a=new IslandTerrain(447701,5),b=new IslandTerrain(447701,5);
    expect(a.satellites).toEqual(b.satellites);expect(a.satellites.length).toBeGreaterThanOrEqual(3);expect(a.satellites.length).toBeLessThanOrEqual(7);
    for(const island of a.satellites){expect(Math.hypot(island.x,island.z)).toBeGreaterThan(500);expect(a.heightAt(island.x,island.z)).toBeGreaterThan(1);}
    for(const [x,z] of [[0,0],[210,-180],[-330,90],[410,250]])expect(a.heightAt(x,z)).toBeCloseTo(b.heightAt(x,z),6);dispose(a,b);
  });
  it('provides a dry safe starter shelf and multiple climate regions',()=>{
    const terrain=new IslandTerrain(731942,5),spawn=terrain.spawn,biomes=new Set<string>();
    expect(terrain.heightAt(spawn.x,spawn.z)).toBeGreaterThan(3.5);expect(terrain.slopeAt(spawn.x,spawn.z)).toBeLessThan(.18);
    for(let z=-500;z<=500;z+=50)for(let x=-500;x<=500;x+=50)if(terrain.heightAt(x,z)>2.8)biomes.add(terrain.biomeAt(x,z));
    expect(biomes.has('TEMPERATE FOREST')).toBe(true);expect(biomes.has('TEMPERATE GRASSLAND')).toBe(true);expect(biomes.has('ARID')).toBe(true);expect(biomes.has('SNOW / ALPINE')).toBe(true);expect(biomes.has('ROCKY MOUNTAIN')).toBe(true);dispose(terrain);
  });
  it('has finite climate fields plus both navigable land and surrounding water',()=>{
    const terrain=new IslandTerrain(61417,5);let land=0,water=0;for(let z=-600;z<=600;z+=40)for(let x=-600;x<=600;x+=40){const h=terrain.heightAt(x,z);h>1?land++:water++;const c=terrain.climateAt(x,z);expect(c.temperature).toBeGreaterThanOrEqual(0);expect(c.temperature).toBeLessThanOrEqual(1);expect(c.moisture).toBeGreaterThanOrEqual(0);expect(c.moisture).toBeLessThanOrEqual(1);expect(c.continentalness).toBeGreaterThanOrEqual(0);expect(c.continentalness).toBeLessThanOrEqual(1);}expect(land).toBeGreaterThan(150);expect(water).toBeGreaterThan(30);expect(terrain.heightAt(641,0)).toBe(-10);dispose(terrain);
  });
  it('generates deterministic separated POIs and terrain-following road samples',()=>{
    const terrain=new IslandTerrain(731942,5),a=generateWorldLayout(terrain,terrain.spawn,[],731942),b=generateWorldLayout(terrain,terrain.spawn,[],731942);expect(a).toEqual(b);expect(a.pois.length).toBeGreaterThanOrEqual(3);
    for(const poi of a.pois){expect(Math.hypot(poi.position.x-terrain.spawn.x,poi.position.z-terrain.spawn.z)).toBeGreaterThanOrEqual(90);expect(terrain.slopeAt(poi.position.x,poi.position.z)).toBeLessThanOrEqual(.36);}
    const points=a.trails.flat();expect(points.every(p=>terrain.heightAt(p.x,p.z)>=.95)).toBe(true);expect(points.filter(p=>terrain.slopeAt(p.x,p.z)<1.25).length/points.length).toBeGreaterThan(.94);dispose(terrain);
  });
  it('maps dynamic world coordinates round-trip without fixed 720m assumptions',()=>{
    const source={x:519.25,z:-407.5},pixel=worldToMap(source,1280,768),world=mapToWorld(pixel,1280,768);
    expect(world.x).toBeCloseTo(source.x,8);expect(world.z).toBeCloseTo(source.z,8);expect(worldToMap({x:-640,z:-640},1280,768)).toEqual({x:0,y:0});expect(worldToMap({x:640,z:640},1280,768)).toEqual({x:768,y:768});
  });
  it('validates generation 5 waypoints against its own bounds',()=>{
    const state=new GameSimulation(17,{x:0,y:4,z:0}).state;state.progression!.waypoint={x:600,z:-610};expect(validateGameState(state)).toBe(true);
    state.progression!.waypoint={x:641,z:0};expect(validateGameState(state)).toBe(false);state.worldGeneration=4;state.progression!.waypoint={x:400,z:0};expect(validateGameState(state)).toBe(false);
  });
  it('keeps generation 4 map transforms on the legacy 720m extent',()=>{const source={x:-311,z:287},pixel=worldToMap(source,720,600),roundTrip=mapToWorld(pixel,720,600);expect(roundTrip.x).toBeCloseTo(source.x,8);expect(roundTrip.z).toBeCloseTo(source.z,8);});
  it('uses deterministic biome-aware tree density and species rules',()=>{
    expect(treeDensityForBiome('TEMPERATE FOREST',.6)).toBeGreaterThan(treeDensityForBiome('TEMPERATE GRASSLAND',.6));expect(treeDensityForBiome('TEMPERATE GRASSLAND',.6)).toBeGreaterThan(treeDensityForBiome('ARID',.6));
    for(const roll of [.05,.2,.4,.6])expect(treeSpeciesForBiome('ARID',.2,roll,.9,true)).toBe(5);expect([0,2]).toContain(treeSpeciesForBiome('SNOW / ALPINE',.7,.9,.9,true));expect(treeSpeciesForBiome('TEMPERATE FOREST',.7,.9,.9,false)).not.toBe(5);
  });
});

describe('fall damage curve',()=>{
  it('ignores invalid, small and ordinary jump landings',()=>{
    expect(fallDamageForSpeed(Number.NaN)).toBe(0);expect(fallDamageForSpeed(-4)).toBe(0);expect(fallDamageForSpeed(FALL_DAMAGE.SAFE_SPEED)).toBe(0);expect(fallDamageForSpeed(FALL_DAMAGE.DAMAGE_START)).toBe(0);
  });
  it('scales severe impacts and reaches fatal damage deterministically',()=>{
    const moderate=fallDamageForSpeed(20),severe=fallDamageForSpeed(27);expect(moderate).toBeGreaterThan(0);expect(severe).toBeGreaterThan(moderate);expect(fallDamageForSpeed(FALL_DAMAGE.FATAL_SPEED)).toBe(100);expect(fallDamageForSpeed(100)).toBe(100);
  });
});
