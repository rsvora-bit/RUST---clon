import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/rendering/materials',()=>({woodMaterial:()=>({dispose(){}})}));
vi.mock('../src/world/materials',()=>({groundTexture:()=>({dispose(){}})}));
import {IslandTerrain} from '../src/terrain/island';
import {generateWorldLayout,WorldSurvival} from '../src/survival/WorldSurvival';
import * as THREE from 'three';
import {roadGeometry} from '../src/terrain/roads';
import {surfaceClimate,palmSuitability,vegetationCover} from '../src/world/climate';
import {treeSpeciesForBiome} from '../src/rendering/environment';
import {mountainLayer} from '../src/world/horizon';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';

const climate=(temperature:number,moisture=.45)=>({temperature,moisture,continentalness:.2});
describe('v0.9.1 world art stabilization',()=>{
  it('adds a distant relay landmark without adding colliders',()=>{
    const terrain=new IslandTerrain(731942,5),poi={id:'poi-1',name:'Collapsed relay site',kind:1,position:{x:120,y:12,z:80}};
    const env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:1,layout:{pois:[poi],trails:[]},heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment;
    const world=new WorldSurvival(env,new THREE.Scene(),731942);
    try{const mast=world.group.getObjectByName('Weathered relay mast') as THREE.Mesh,reflector=world.group.getObjectByName('Relay reflector') as THREE.Mesh;expect(mast).toBeTruthy();expect(reflector).toBeTruthy();expect(mast.position.y).toBeCloseTo(4.2);expect(world.collisionBoxes()).toHaveLength(1);}
    finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('renders Stormwatch, gives it weather-survey salvage and guards a persistent cache',()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,4),env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:4,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state,poi=world.pois.find(entry=>entry.kind===4)!;
    try{
      world.populate(state);const loot=state.progression!.stations.find(station=>station.id==='loot-poi-4'),cache=state.progression!.stations.find(station=>station.id==='secure-cache-poi-4');
      expect(world.group.getObjectByName('Stormwatch wind mast')).toBeTruthy();expect(world.group.getObjectByName('Stormwatch weather instrument panel')).toBeTruthy();
      const stormwatch=world.group.getObjectByName(poi.id)!;expect(stormwatch.children.filter(child=>child instanceof THREE.Mesh)).toHaveLength(6);
      expect(world.collisionBoxes().some(box=>Math.hypot(box.position.x-poi.position.x,box.position.z-poi.position.z)<1)).toBe(true);
      expect(loot?.inventory.some(stack=>stack?.itemId==='wiring'||stack?.itemId==='machineParts')).toBe(true);expect(cache).toMatchObject({kind:'secureCache',locked:true});expect(cache?.inventory.some(stack=>stack?.itemId==='techParts')).toBe(true);expect(cache?.inventory.some(stack=>stack?.itemId==='canteen')).toBe(true);expect(cache?.inventory.some(stack=>stack?.itemId==='gears')).toBe(true);
      cache!.inventory[0]={itemId:'scrap',count:9};const savedLoot=structuredClone(cache!.inventory),reloadedWorld=new WorldSurvival(env,new THREE.Scene(),seed);try{reloadedWorld.populate(state);expect(state.progression!.stations.find(station=>station.id==='secure-cache-poi-4')?.inventory).toEqual(savedLoot);}finally{reloadedWorld.dispose();}
      expect(validateGameState(state)).toBe(true);
    }finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('adds a batched coastal wreck with distinct salvage, guarded cargo and safe rev-4 saves',()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,5),env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:5,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state,wreck=world.pois.find(poi=>poi.kind===5)!;
    try{
      world.populate(state);const loot=state.progression!.stations.find(station=>station.id==='loot-poi-5'),cache=state.progression!.stations.find(station=>station.id==='secure-cache-poi-5');
      expect(wreck.name).toBe('Breakwater Cargo Wreck');expect(terrain.biomeAt(wreck.position.x,wreck.position.z)).toBe('COAST');expect(world.group.getObjectByName('Breakwater split cargo hull')).toBeTruthy();expect(world.group.getObjectByName('Breakwater corroded cargo')).toBeTruthy();
      expect(world.collisionBoxes().filter(box=>Math.hypot(box.position.x-wreck.position.x,box.position.z-wreck.position.z)<5)).toHaveLength(2);
      expect(loot?.inventory.some(stack=>stack?.itemId==='shotgunShells'||stack?.itemId==='machineParts'||stack?.itemId==='cookedMeat')).toBe(true);
      expect(cache).toMatchObject({kind:'secureCache',locked:true});expect(cache?.inventory.some(stack=>stack?.itemId==='machineParts')).toBe(true);expect(cache?.inventory.some(stack=>stack?.itemId==='shotgunShells')).toBe(true);expect(validateGameState(state)).toBe(true);
      const legacy=structuredClone(state);legacy.worldRevision=4;legacy.progression!.stations=[];legacy.progression!.lootGenerated=false;const oldLayout=generateWorldLayout(terrain,terrain.spawn,[],seed,4),oldEnv={...env,worldRevision:4,layout:oldLayout} as unknown as import('../src/rendering/environment').Environment,oldWorld=new WorldSurvival(oldEnv,new THREE.Scene(),seed);
      try{oldWorld.populate(legacy);expect(oldWorld.pois).toHaveLength(5);expect(oldWorld.pois.some(poi=>poi.kind===5)).toBe(false);expect(legacy.progression!.stations.some(station=>station.id.includes('poi-5'))).toBe(false);expect(legacy.worldRevision).toBe(4);expect(validateGameState(legacy)).toBe(true);}finally{oldWorld.dispose();}
    }finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
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
    for(let layer=0;layer<3;layer++){const a=mountainLayer(731942,layer,true),b=mountainLayer(731942,layer,true);expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));expect(a.index!.count/3).toBe(720);expect(Array.from(a.getAttribute('normal').array).every(Number.isFinite)).toBe(true);expect(a.boundingSphere!.radius).toBeLessThan(1600);a.dispose();b.dispose();}
  });
  it('preserves old gen5 snapshots without inventing a layout revision',()=>{
    const old=new GameSimulation(731942,{x:12,y:6,z:17}).state;delete old.worldRevision;old.inventory[8]={itemId:'scrap',count:70};old.nodeChanges={'tree-4':120};old.progression!.tech!.unlocked.push('efficiencyTooling');
    expect(validateGameState(old)).toBe(true);const restored=new GameSimulation(old.seed,{x:0,y:4,z:0},JSON.parse(JSON.stringify(old)));expect(restored.state).toEqual(old);expect(restored.state.worldRevision).toBeUndefined();expect(new GameSimulation(731942,{x:0,y:4,z:0}).state.worldRevision).toBe(5);
    old.worldRevision=3;expect(validateGameState(old)).toBe(true);old.worldRevision=4;expect(validateGameState(old)).toBe(true);old.worldRevision=5;expect(validateGameState(old)).toBe(true);old.worldRevision=6 as 1;expect(validateGameState(old)).toBe(false);
  });
});
