import {describe,it,expect} from 'vitest';
import {IslandTerrain} from '../src/terrain/island';
import {generateWorldLayout} from '../src/survival/WorldSurvival';
import {roadGeometry} from '../src/terrain/roads';
import {surfaceClimate,palmSuitability,vegetationCover} from '../src/world/climate';
import {treeSpeciesForBiome} from '../src/rendering/environment';
import {mountainLayer} from '../src/world/horizon';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';

const climate=(temperature:number,moisture=.45)=>({temperature,moisture,continentalness:.2});
describe('v0.9.1 world art stabilization',()=>{
  for(const seed of [731942,447701,61417])it(`routes deterministic dry roads away from steep hills (${seed})`,()=>{
    const terrain=new IslandTerrain(seed,5);
    try {
      const a=generateWorldLayout(terrain,terrain.spawn,[],seed,2),b=generateWorldLayout(terrain,terrain.spawn,[],seed,2),old=generateWorldLayout(terrain,terrain.spawn,[],seed,1);
      expect(a).toEqual(b);expect(a.pois).toEqual(old.pois);expect(a.trails.length).toBe(4);
      const samples=a.trails.flat(),oldSamples=old.trails.flat(),steep=(p:{x:number;z:number})=>terrain.slopeAt(p.x,p.z)>.45;
      const fraction=samples.filter(steep).length/samples.length,oldFraction=oldSamples.filter(steep).length/oldSamples.length;
      expect(samples.every(p=>terrain.heightAt(p.x,p.z)>=1.15)).toBe(true);expect(fraction).toBeLessThan(.06);expect(fraction).toBeLessThanOrEqual(oldFraction*.65+.004);
      for(const road of a.trails){for(let i=1;i<road.length;i++){const a=road[i-1]!,b=road[i]!;expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeLessThanOrEqual(2.51);expect(b.y).toBeCloseTo(terrain.heightAt(b.x,b.z)+.08,6);}const geometry=roadGeometry(road,terrain);const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(terrain.heightAt(p.getX(i),p.getZ(i))+.075,3);geometry.dispose();}
    }finally{terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it.each([-81,0,1,17,81,9999999999])('connects POIs for custom seed %s',seed=>{const terrain=new IslandTerrain(seed,5);try{const layout=generateWorldLayout(terrain,terrain.spawn,[],seed,2);expect(layout.trails.length).toBe(layout.pois.length);expect(layout.trails.flat().every(p=>terrain.heightAt(p.x,p.z)>=1.15)).toBe(true);}finally{terrain.geometry.dispose();terrain.heightTexture.dispose();}});
  it('matches the immutable v0.9.0 legacy heightfields byte-for-byte',async()=>{
    const hashes=['954a91f22e0e8d27df0afc09121637865ac7b75f0e371cd6e2f7afe7580bf9a4','1806872a04946883bc4cf5dbc9bf6c7585945baf4ca89c19f74c351e1d2c790f','c532476227d4c1f488c083ddadbb3449e28660a4947292f79f3f29e974134f3f','d3bed34c95e9b0c714dd14c50e73ecb337f842bebd06add472fd51a6c2ee9765'];
    for(const generation of [1,2,3,4] as const){const t=new IslandTerrain(731942,generation);try{expect(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(t.heights.buffer as ArrayBuffer)))).map(v=>v.toString(16).padStart(2,'0')).join('')).toBe(hashes[generation-1]);}finally{t.geometry.dispose();t.heightTexture.dispose();}}
  });
  it('uses climate and altitude for palm eligibility, with alpine conifers',()=>{
    for(const biome of ['COAST','ARID','TEMPERATE GRASSLAND'])for(const temperature of [.15,.35,.50])expect(treeSpeciesForBiome(biome,.4,0,.8,true,climate(temperature),3)).not.toBe(5);
    for(const height of [26,40,60])expect(treeSpeciesForBiome('COAST',.4,0,.8,false,climate(.85),height)).not.toBe(5);
    expect(treeSpeciesForBiome('ARID',.3,.1,.8,true,climate(.8,.30),5)).toBe(5);
    expect(treeSpeciesForBiome('SNOW / ALPINE',.3,.1,0,true,climate(.35),30)).toBe(0);
    expect(treeSpeciesForBiome('ROCKY MOUNTAIN',.3,0,.8,false,climate(.8),65)).toBe(2);
    expect(palmSuitability(climate(.8,.9),3,'COAST')).toBe(0);
  });
  it('has gradual bounded arid, snow and forest transition bands',()=>{
    for(let t=.2;t<.8;t+=.005){const a=surfaceClimate(climate(t,.42),28,.1),b=surfaceClimate(climate(t+.005,.42),28,.1);for(const key of ['arid','snow','forest'] as const){expect(a[key]).toBeGreaterThanOrEqual(0);expect(a[key]).toBeLessThanOrEqual(1);expect(Math.abs(a[key]-b[key])).toBeLessThan(.055);}}
    expect(vegetationCover(climate(.65,.70),12,.1)).toBeGreaterThan(vegetationCover(climate(.75,.25),12,.1)*3);
    expect(vegetationCover(climate(.6),30,.85)).toBe(0);expect(vegetationCover(climate(.2),68,.1)).toBe(0);
  });
  it('keeps horizon deterministic, bounded, disconnected and cheap',()=>{
    for(let layer=0;layer<3;layer++){const a=mountainLayer(731942,layer,true),b=mountainLayer(731942,layer,true);expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));expect(a.index!.count/3).toBe(448);expect(Array.from(a.getAttribute('normal').array).every(Number.isFinite)).toBe(true);expect(a.boundingSphere!.radius).toBeLessThan(1600);a.dispose();b.dispose();}
  });
  it('preserves old gen5 snapshots without inventing a layout revision',()=>{
    const old=new GameSimulation(731942,{x:12,y:6,z:17}).state;delete old.worldRevision;old.inventory[8]={itemId:'scrap',count:70};old.nodeChanges={'tree-4':120};old.progression!.tech!.unlocked.push('efficiencyTooling');
    expect(validateGameState(old)).toBe(true);const restored=new GameSimulation(old.seed,{x:0,y:4,z:0},JSON.parse(JSON.stringify(old)));expect(restored.state).toEqual(old);expect(restored.state.worldRevision).toBeUndefined();expect(new GameSimulation(731942,{x:0,y:4,z:0}).state.worldRevision).toBe(2);
    old.worldRevision=3 as 1;expect(validateGameState(old)).toBe(false);
  });
});
