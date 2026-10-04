import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/rendering/materials',()=>({woodMaterial:()=>({dispose(){}})}));
vi.mock('../src/world/materials',()=>({groundTexture:()=>({dispose(){}})}));
import {IslandTerrain} from '../src/terrain/island';
import {generateWorldLayout,WorldSurvival} from '../src/survival/WorldSurvival';
import * as THREE from 'three';
import {roadGeometry} from '../src/terrain/roads';
import {grassSurfaceCover,surfaceClimate,palmSuitability,vegetationCover} from '../src/world/climate';
import {grassReceivesShadows,marshReedClumpSize,revisionTreeCover,treeCrownTint,treeSpeciesForBiome} from '../src/rendering/environment';
import {mountainLayer} from '../src/world/horizon';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {validateGameState} from '../src/save/storage';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';

const climate=(temperature:number,moisture=.45)=>({temperature,moisture,continentalness:.2});
describe('v0.9.1 world art stabilization',()=>{
  it('avoids per-blade shadow-map sampling for the dense revision-6 grass field while preserving legacy behavior',()=>{
    expect(grassReceivesShadows(1)).toBe(true);
    expect(grassReceivesShadows(5)).toBe(true);
    expect(grassReceivesShadows(6)).toBe(false);
    expect(grassReceivesShadows(7)).toBe(false);
  });
  it('adds a distant relay landmark without adding colliders',()=>{
    const terrain=new IslandTerrain(731942,5),poi={id:'poi-1',name:'Collapsed relay site',kind:1,position:{x:120,y:12,z:80}};
    const env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:1,layout:{pois:[poi],trails:[]},heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment;
    const world=new WorldSurvival(env,new THREE.Scene(),731942);
    try{const mast=world.group.getObjectByName('Weathered relay mast') as THREE.Mesh,reflector=world.group.getObjectByName('Relay reflector') as THREE.Mesh;expect(mast).toBeTruthy();expect(reflector).toBeTruthy();expect(mast.position.y).toBeCloseTo(4.2);expect(world.collisionBoxes()).toHaveLength(1);}
    finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('adds a batched exposed relay control station only to new revision-6 worlds',()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),poi={id:'poi-1',name:'Collapsed relay site',kind:1,position:{x:120,y:12,z:80}},layout={pois:[poi],trails:[]},env=(worldRevision:number)=>({terrain,spawn:terrain.spawn,colliders:[],worldRevision,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment),current=new WorldSurvival(env(6),new THREE.Scene(),seed),legacy=new WorldSurvival(env(5),new THREE.Scene(),seed);
    try{
      expect(current.group.getObjectByName('Collapsed relay diagnostic screen')).toBeTruthy();expect(current.group.getObjectByName('Collapsed relay exposed control fascia')).toBeTruthy();expect(current.group.getObjectByName('Collapsed relay manual control')).toBeTruthy();expect(current.group.getObjectByName('Collapsed relay severed ground cable')).toBeTruthy();
      expect(legacy.group.getObjectByName('Collapsed relay diagnostic screen')).toBeFalsy();expect(current.collisionBoxes()).toEqual(legacy.collisionBoxes());
    }finally{current.dispose();legacy.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('opens the Revision-6 Stormwatch shelter while preserving legacy collision and field-log saves',async()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),poi={id:'poi-stormwatch',name:'Stormwatch Station',kind:4,position:{x:120,y:terrain.heightAt(120,80),z:80}},layout={pois:[poi],trails:[]},env=(worldRevision:number)=>({terrain,spawn:terrain.spawn,colliders:[],worldRevision,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment),current=new WorldSurvival(env(6),new THREE.Scene(),seed),legacy=new WorldSurvival(env(5),new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state;
    try{
      current.populate(state);legacy.populate(structuredClone(state));
      for(const name of ['Stormwatch field log desk','Stormwatch field desk leg','Stormwatch rain log clipboard','Stormwatch rain log trace','Stormwatch clipboard clamp'])expect(current.group.getObjectByName(name)).toBeTruthy();
      for(const name of ['Stormwatch entry left wall','Stormwatch entry right wall','Stormwatch entry jamb'])expect(current.group.getObjectByName(name)).toBeTruthy();
      expect(legacy.group.getObjectByName('Stormwatch rain log clipboard')).toBeFalsy();
      expect(legacy.collisionBoxes()).toHaveLength(1);expect(current.collisionBoxes()).toHaveLength(4);
      expect(validateGameState(state)).toBe(true);
      await initPhysics();const floor=new THREE.PlaneGeometry(20,20,2,2);floor.rotateX(-Math.PI/2);floor.translate(poi.position.x,poi.position.y,poi.position.z);
      const enter=(boxes:import('../src/physics/PhysicsWorld').CollisionBox[])=>{const physics=new PhysicsWorld(floor,boxes,{x:poi.position.x-.45,y:poi.position.y,z:poi.position.z+2.5});try{for(let step=0;step<20;step++)physics.move({x:0,y:0,z:-.12});return physics.position().z;}finally{physics.dispose();}};
      expect(enter(current.collisionBoxes())).toBeLessThan(poi.position.z+.5);
      expect(enter(legacy.collisionBoxes())).toBeGreaterThan(poi.position.z+1.3);
      floor.dispose();
    }finally{current.dispose();legacy.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('renders Stormwatch, gives it weather-survey salvage and guards a persistent cache',()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,4),env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:4,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state,poi=world.pois.find(entry=>entry.kind===4)!;
    try{
      world.populate(state);const loot=state.progression!.stations.find(station=>station.id==='loot-poi-4'),cache=state.progression!.stations.find(station=>station.id==='secure-cache-poi-4');
      expect(world.group.getObjectByName('Stormwatch wind mast')).toBeTruthy();expect(world.group.getObjectByName('Stormwatch weather instrument panel')).toBeTruthy();expect(world.group.getObjectByName('Stormwatch solar array')).toBeTruthy();expect(world.group.getObjectByName('Stormwatch solar cell divider')).toBeTruthy();
      const stormwatch=world.group.getObjectByName(poi.id)!;expect(stormwatch.children.filter(child=>child instanceof THREE.Mesh)).toHaveLength(7);
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
  it('adds deterministic revision-6 scale and two specialized landmarks without changing rev-5 layout',()=>{
    const seed=731942,oldTerrain=new IslandTerrain(seed,5,5),terrain=new IslandTerrain(seed,5,6),legacy=generateWorldLayout(oldTerrain,oldTerrain.spawn,[],seed,5),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6),replayTerrain=new IslandTerrain(seed,5,6),replay=generateWorldLayout(replayTerrain,replayTerrain.spawn,[],seed,6);
    try{
      expect(terrain.size).toBeGreaterThan(oldTerrain.size*1.25);expect(legacy.pois).toHaveLength(6);expect(layout.pois).toHaveLength(8);expect(layout).toEqual(replay);
      expect(layout.pois.slice(0,6).map(p=>p.name)).toEqual(legacy.pois.map(p=>p.name));expect(layout.pois[6]).toMatchObject({name:'Tidal Survey Pier',kind:6});expect(layout.pois[7]).toMatchObject({name:'Highland Relay',kind:7});
      expect(terrain.biomeAt(layout.pois[6]!.position.x,layout.pois[6]!.position.z)).toBe('COAST');expect(layout.pois[7]!.position.y).toBeGreaterThan(24);
      expect(layout.trails).toHaveLength(8);expect(layout.trails.flat().every(p=>terrain.heightAt(p.x,p.z)>=1.15)).toBe(true);
      const env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:6,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state;
      try{world.populate(state);expect(world.group.getObjectByName('Tidal survey mast')).toBeTruthy();expect(world.group.getObjectByName('Tidal gauge faceplate')).toBeTruthy();expect(world.group.getObjectByName('Tidal level display')).toBeTruthy();expect(world.group.getObjectByName('Tidal height gauge')).toBeTruthy();expect(world.group.getObjectByName('Tidal pier under-deck crossbrace')).toBeTruthy();expect(world.group.getObjectByName('Tidal pier mooring ring')).toBeTruthy();expect(world.group.getObjectByName('Tidal sample workbench')).toBeTruthy();expect(world.group.getObjectByName('Tidal current field log')).toBeTruthy();expect(world.group.getObjectByName('Tidal survey rope coil')).toBeTruthy();const countNamed=(name:string)=>{let count=0;world.group.traverse(object=>{if(object.name===name)count++;});return count;};expect(countNamed('Tidal water sample vial')).toBe(3);expect(countNamed('Tidal sample vial cap')).toBe(3);expect(world.group.getObjectByName('Highland relay dish')).toBeTruthy();expect(world.group.getObjectByName('Highland relay access ladder')).toBeTruthy();expect(world.group.getObjectByName('Highland relay control cabinet')).toBeTruthy();expect(world.group.getObjectByName('Highland relay status display')).toBeTruthy();expect(world.group.getObjectByName('Highland relay signal beacon')).toBeTruthy();expect(world.group.getObjectByName('Stormwatch windsock')).toBeTruthy();expect(world.group.getObjectByName('Breakwater exposed hull rib')).toBeTruthy();expect(world.group.getObjectByName('Breakwater slack mooring cable')).toBeTruthy();expect(world.group.getObjectByName('Breakwater weather station cabin')).toBeTruthy();expect(world.group.getObjectByName('Breakwater bridge window')).toBeTruthy();expect(world.group.getObjectByName('Breakwater bridge chart console')).toBeTruthy();expect(world.group.getObjectByName('Breakwater charted coast map')).toBeTruthy();expect(world.group.getObjectByName('Breakwater map contour line')).toBeTruthy();expect(world.group.getObjectByName('Breakwater marked evacuation route')).toBeTruthy();expect(world.group.getObjectByName('Breakwater coastal chart waypoint')).toBeTruthy();expect(world.group.getObjectByName('Breakwater weather instrument display')).toBeTruthy();expect(world.group.getObjectByName('Breakwater bridge operator seat')).toBeTruthy();expect(world.group.getObjectByName('Breakwater cargo derrick mast')?.position.y).toBeCloseTo(8.75);expect(world.group.getObjectByName('Breakwater broken cargo boom')?.position.y).toBeCloseTo(16.45);expect(world.group.getObjectByName('Breakwater torn signal pennant')).toBeTruthy();expect(world.group.getObjectByName('Breakwater hanging hoist cable')).toBeTruthy();expect(world.group.getObjectByName('Breakwater cargo hook')).toBeTruthy();expect(countNamed('Breakwater hull repair plate')).toBe(10);expect(countNamed('Breakwater hull repair rivet')).toBe(40);expect(countNamed('Breakwater hull rust streak')).toBe(10);expect(countNamed('Breakwater oxidized waterline')).toBe(2);expect(world.collisionBoxes().filter(box=>Math.hypot(box.position.x-layout.pois.find(poi=>poi.kind===5)!.position.x,box.position.z-layout.pois.find(poi=>poi.kind===5)!.position.z)<5)).toHaveLength(13);expect(world.collisionBoxes().length).toBeGreaterThan(6);expect(validateGameState(state)).toBe(true);}finally{world.dispose();}
      const rev5Env={...env,terrain:oldTerrain,spawn:oldTerrain.spawn,worldRevision:5,layout:legacy,heightAt:(x:number,z:number)=>oldTerrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,oldWorld=new WorldSurvival(rev5Env,new THREE.Scene(),seed);try{expect(oldWorld.group.getObjectByName('Breakwater exposed hull rib')).toBeFalsy();expect(oldWorld.group.getObjectByName('Breakwater revision-6 instrument fascia')).toBeFalsy();expect(oldWorld.group.getObjectByName('Breakwater revision-6 wheelhouse work light')).toBeFalsy();expect(oldWorld.group.getObjectByName('Tidal sample workbench')).toBeFalsy();}finally{oldWorld.dispose();}
    }finally{oldTerrain.geometry.dispose();oldTerrain.heightTexture.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();replayTerrain.geometry.dispose();replayTerrain.heightTexture.dispose();}
  });
  it('lets the player enter the revision-six Breakwater wheelhouse through its front doorway',async()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6),poi=layout.pois.find(entry=>entry.kind===5)!,env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:6,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed),state=new GameSimulation(seed,terrain.spawn).state;
    try{
      world.populate(state);
      expect(world.group.getObjectByName('Breakwater Rev6 doorway lower side')).toBeTruthy();expect(world.group.getObjectByName('Breakwater Rev6 raised wheelhouse roof')).toBeTruthy();
      await initPhysics();const floor=new THREE.PlaneGeometry(20,20,2,2);floor.rotateX(-Math.PI/2);floor.translate(poi.position.x,poi.position.y+1.29,poi.position.z);
      const traverse=(localX:number)=>{const physics=new PhysicsWorld(floor,world.collisionBoxes(),{x:poi.position.x+localX,y:poi.position.y+1.29,z:poi.position.z+1.25});try{for(let step=0;step<16;step++)physics.move({x:0,y:0,z:-.1});return physics.position();}finally{physics.dispose();}};
      expect(traverse(-1.48).z).toBeLessThan(poi.position.z+.65);expect(traverse(-1.955).z).toBeGreaterThan(poi.position.z+.80);floor.dispose();
      const legacyEnv={...env,worldRevision:5} as unknown as import('../src/rendering/environment').Environment,legacy=new WorldSurvival(legacyEnv,new THREE.Scene(),seed);try{expect(legacy.group.getObjectByName('Breakwater Rev6 raised wheelhouse roof')).toBeFalsy();expect(legacy.collisionBoxes().filter(box=>Math.hypot(box.position.x-poi.position.x,box.position.z-poi.position.z)<5)).toHaveLength(2);}finally{legacy.dispose();}
    }finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('boards the Revision-6 Breakwater from generated coastal terrain',async()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6),poi=layout.pois.find(entry=>entry.kind===5)!,env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:6,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed);
    try{
      await initPhysics();const x=poi.position.x-1.48,z=poi.position.z+3.5,physics=new PhysicsWorld(terrain.geometry,world.collisionBoxes(),{x,y:terrain.heightAt(x,z),z});let vertical=0,grounded=false,started=false;
      try{for(let frame=0;frame<600;frame++){if(grounded){if(!started||physics.position().y<poi.position.y+1.20){vertical=5.8;started=true;}else vertical=-1.2;}else vertical-=19/60;grounded=physics.move({x:0,y:vertical/60,z:-4.4/60});}expect(physics.position().z).toBeLessThan(poi.position.z+.72);expect(physics.position().y).toBeGreaterThan(poi.position.y+1.20);}finally{physics.dispose();}
    }finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('reaches the Revision-6 Tidal Survey Pier from its generated coast',async()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6),poi=layout.pois.find(entry=>entry.kind===6)!,env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:6,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed);
    try{
      const directions=Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8),z:Math.sin(i*Math.PI/8)})).map(direction=>({...direction,height:terrain.heightAt(poi.position.x+direction.x*12,poi.position.z+direction.z*12)})).sort((a,b)=>b.height-a.height),approach=directions[0]!,x=poi.position.x+approach.x*12,z=poi.position.z+approach.z*12;
      await initPhysics();const physics=new PhysicsWorld(terrain.geometry,world.collisionBoxes(),{x,y:terrain.heightAt(x,z),z});let vertical=0,grounded=false,started=false;
      try{for(let frame=0;frame<600;frame++){const p=physics.position(),dx=poi.position.x-p.x,dz=poi.position.z-p.z,distance=Math.hypot(dx,dz);if(grounded){if(!started||p.y<poi.position.y+.82){vertical=5.8;started=true;}else vertical=-1.2;}else vertical-=19/60;const speed=distance>1?4.4:0;grounded=physics.move({x:distance>1?dx/distance*speed/60:0,y:vertical/60,z:distance>1?dz/distance*speed/60:0});}expect(Math.hypot(physics.position().x-poi.position.x,physics.position().z-poi.position.z)).toBeLessThan(2.5);expect(physics.position().y).toBeGreaterThan(poi.position.y+.82);}finally{physics.dispose();}
    }finally{world.dispose();terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  it('keeps the revision-six Breakwater crane readable as a distant coastal landmark',()=>{
    const seed=731942,terrain=new IslandTerrain(seed,5,6),layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6),env={terrain,spawn:terrain.spawn,colliders:[],worldRevision:6,layout,heightAt:(x:number,z:number)=>terrain.heightAt(x,z)} as unknown as import('../src/rendering/environment').Environment,world=new WorldSurvival(env,new THREE.Scene(),seed);
    try{
      world.populate(new GameSimulation(seed,terrain.spawn).state);
      const mast=world.group.getObjectByName('Breakwater cargo derrick mast')!,boom=world.group.getObjectByName('Breakwater broken cargo boom')!,pennant=world.group.getObjectByName('Breakwater torn signal pennant')!,chart=world.group.getObjectByName('Breakwater charted coast map')!,wreck=world.pois.find(poi=>poi.kind===5)!,wreckGroup=world.group.children.find(child=>child.name===wreck.id)!;
      expect(mast.position.y).toBeCloseTo(8.75);expect(boom.position.y).toBeCloseTo(16.45);expect(pennant.position.y).toBeCloseTo(17.38);expect(mast.position.y+16.8/2).toBeGreaterThan(17);
      expect(chart.position.y).toBeLessThan(1.70);expect(chart.position.z).toBeLessThan(.25);
      const bounds=new THREE.Box3().setFromObject(wreckGroup),size=bounds.getSize(new THREE.Vector3());expect(size.y).toBeGreaterThan(17.2);
      expect(world.group.getObjectByName('Breakwater revision-6 instrument fascia')).toBeTruthy();expect(world.group.getObjectByName('Breakwater revision-6 display bezel')).toBeTruthy();expect(world.group.getObjectByName('Breakwater revision-6 helm compass face')).toBeTruthy();expect(world.group.getObjectByName('Breakwater revision-6 helm compass needle')).toBeTruthy();expect(world.group.getObjectByName('Breakwater revision-6 instrument indicator')).toBeTruthy();expect(world.group.getObjectByName('Breakwater revision-6 wheelhouse work light')).toBeTruthy();
      expect(world.collisionBoxes().filter(box=>Math.hypot(box.position.x-wreck.position.x,box.position.z-wreck.position.z)<5)).toHaveLength(13);
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
      for(const road of a.trails){for(let i=1;i<road.length;i++){const a=road[i-1]!,b=road[i]!;expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeLessThanOrEqual(2.51);expect(b.y).toBeCloseTo(terrain.heightAt(b.x,b.z)+.08,6);}const geometry=roadGeometry(road,terrain),p=geometry.getAttribute('position'),colors=geometry.getAttribute('color');for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(terrain.heightAt(p.getX(i),p.getZ(i))+.075,3);expect(colors.count).toBe(p.count);expect(new Set(Array.from(colors.array)).size).toBeGreaterThan(3);geometry.dispose();}
    }finally{terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
  const revision6RouteSeeds=[...new Set([...Array.from({length:96},(_,index)=>(Math.imul(index+1,2654435761)>>>0)%1_000_000_000),0,17,81,61417,447701,84172522,123456789,555555555,987654321])];
  for(const seed of revision6RouteSeeds)it(`keeps revision-6 coast POIs routable for seed ${seed}`,()=>{
    const terrain=new IslandTerrain(seed,5,6);
    try {
      const layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6);
      expect(layout.pois.length).toBe(8);
      expect(layout.pois.filter(poi=>poi.kind===5||poi.kind===6).every(poi=>poi.position.y>=1.8)).toBe(true);
      expect(layout.trails).toHaveLength(layout.pois.length);
      expect(layout.trails.every(road=>road.length>20)).toBe(true);
      expect(layout.trails.flat().every(point=>terrain.heightAt(point.x,point.z)>=.95)).toBe(true);
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
  it('concentrates the revision-6 tree budget in forests while preserving legacy placement weights',()=>{
    expect(revisionTreeCover(.7,.8,6)).toBeCloseTo(.91);
    expect(revisionTreeCover(.7,.2,6)).toBeCloseTo(.294);
    expect(revisionTreeCover(.7,.8,5)).toBe(.7);
    expect(revisionTreeCover(.7,.2,4)).toBe(.7);
  });
  it('widens deterministic revision-6 canopy color variation without changing legacy tree palettes',()=>{
    const legacyBroad=treeCrownTint(1,.25,.4,5),expectedLegacyBroad=new THREE.Color().setHSL(.275+(.25-.5)*.045,.18,.58+.4*.13);
    expect(legacyBroad.toArray()).toEqual(expectedLegacyBroad.toArray());
    const broadLow=treeCrownTint(1,0,0,6),broadHigh=treeCrownTint(1,1,1,6),pineLow=treeCrownTint(2,0,0,6),pineHigh=treeCrownTint(2,1,1,6),repeat=treeCrownTint(1,0,0,6);
    expect(broadLow.toArray()).toEqual(repeat.toArray());
    expect(broadHigh.getHSL({h:0,s:0,l:0}).h-broadLow.getHSL({h:0,s:0,l:0}).h).toBeGreaterThan(.095);
    expect(broadHigh.getHSL({h:0,s:0,l:0}).l-broadLow.getHSL({h:0,s:0,l:0}).l).toBeGreaterThan(.19);
    expect(pineHigh.getHSL({h:0,s:0,l:0}).h-pineLow.getHSL({h:0,s:0,l:0}).h).toBeGreaterThan(.07);
    expect(pineHigh.getHSL({h:0,s:0,l:0}).l-pineLow.getHSL({h:0,s:0,l:0}).l).toBeGreaterThan(.20);
  });
  it('has gradual bounded arid, snow and forest transition bands',()=>{
    for(let t=.2;t<.8;t+=.005){const a=surfaceClimate(climate(t,.42),28,.1),b=surfaceClimate(climate(t+.005,.42),28,.1);for(const key of ['arid','snow','forest'] as const){expect(a[key]).toBeGreaterThanOrEqual(0);expect(a[key]).toBeLessThanOrEqual(1);expect(Math.abs(a[key]-b[key])).toBeLessThan(.055);}}
    expect(vegetationCover(climate(.65,.70),12,.1)).toBeGreaterThan(vegetationCover(climate(.75,.25),12,.1)*3);
    expect(vegetationCover(climate(.6),30,.85)).toBe(0);expect(vegetationCover(climate(.2),68,.1)).toBe(0);
    expect(surfaceClimate(climate(.7,.9),4,.04,.92).marsh).toBeGreaterThan(.7);expect(surfaceClimate(climate(.7,.9),4,.04,.37).marsh).toBe(0);expect(surfaceClimate(climate(.7,.3),4,.04,.92).marsh).toBe(0);
  });
  it('lets more grass show through open Revision-6 meadows than beneath dense canopy',()=>{
    const meadow=grassSurfaceCover(climate(.50,.52),12,.1),forest=grassSurfaceCover(climate(.50,.82),12,.1);
    expect(meadow).toBeGreaterThan(forest*1.2);
    expect(grassSurfaceCover(climate(.50,.82),12,.1)).toBeCloseTo(.70,5);
    const transition=Array.from({length:41},(_,i)=>grassSurfaceCover(climate(.50,.4+i*.01),12,.1));
    expect(transition.every(value=>value>=0&&value<=1)).toBe(true);
    expect(Math.max(...transition.slice(1).map((value,index)=>Math.abs(value-transition[index]!)))).toBeLessThan(.06);
  });
  it('groups revision-6 reeds into deterministic denser stands within the same total instance budget',()=>{
    expect([0,.25,.5,.75,.999].map(marshReedClumpSize)).toEqual([5,6,7,8,8]);
    expect(marshReedClumpSize(-1)).toBe(5);expect(marshReedClumpSize(1)).toBe(8);
  });
  it('adds a bounded marsh biome only to new revision-6 geography',()=>{
    const old=new IslandTerrain(731942,5,5),current=new IslandTerrain(731942,5,6);let marsh=0;
    try{const climateWeights=current.geometry.getAttribute('surfaceClimate');expect(climateWeights.itemSize).toBe(4);expect(climateWeights.count).toBe(current.geometry.getAttribute('position').count);for(let z=-816;z<=816;z+=12)for(let x=-816;x<=816;x+=12){if(current.biomeAt(x,z)==='WETLAND / MARSH')marsh++;expect(old.biomeAt(x,z)).not.toBe('WETLAND / MARSH');}expect(marsh).toBeGreaterThan(12);}finally{old.geometry.dispose();old.heightTexture.dispose();current.geometry.dispose();current.heightTexture.dispose();}
  });
  it('keeps horizon deterministic, bounded, disconnected and cheap, with broad ridge tops',()=>{
    for(let layer=0;layer<3;layer++){const a=mountainLayer(731942,layer,true),b=mountainLayer(731942,layer,true);expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));expect(a.index!.count/3).toBe(5184);const pos=a.getAttribute('position'),color=a.getAttribute('color'),rowSize=73,groupSize=rowSize*7,peakRows=Array.from({length:6},(_,group)=>Array.from({length:rowSize},(_,i)=>pos.getY(group*groupSize+rowSize*3+i)));expect(color.count).toBe(pos.count);expect(Array.from(color.array).every(value=>Number.isFinite(value)&&value>=0&&value<=1)).toBe(true);for(let group=0;group<6;group++)expect(color.getX(group*groupSize+rowSize*3+36)).toBeGreaterThan(color.getX(group*groupSize+36));expect(peakRows.some(row=>{const peak=Math.max(...row),index=row.indexOf(peak);return index>1&&index<row.length-2&&row.slice(index-1,index+2).every(y=>y>peak*.92);})).toBe(true);if(layer===0){const ridge=peakRows[1]!,peak=Math.max(...ridge),floor=Math.min(...ridge);expect(ridge.filter(height=>height>=floor+(peak-floor)*.9).length).toBeGreaterThan(11);}expect(Array.from(a.getAttribute('normal').array).every(Number.isFinite)).toBe(true);expect(a.boundingSphere!.radius).toBeLessThan(1800);a.dispose();b.dispose();}
  });
  it('preserves old gen5 snapshots without inventing a layout revision',()=>{
    const old=new GameSimulation(731942,{x:12,y:6,z:17}).state;delete old.worldRevision;old.inventory[8]={itemId:'scrap',count:70};old.nodeChanges={'tree-4':120};old.progression!.tech!.unlocked.push('efficiencyTooling');
    expect(validateGameState(old)).toBe(true);const restored=new GameSimulation(old.seed,{x:0,y:4,z:0},JSON.parse(JSON.stringify(old)));expect(restored.state).toEqual(old);expect(restored.state.worldRevision).toBeUndefined();expect(new GameSimulation(731942,{x:0,y:4,z:0}).state.worldRevision).toBe(6);
    old.worldRevision=3;expect(validateGameState(old)).toBe(true);old.worldRevision=4;expect(validateGameState(old)).toBe(true);old.worldRevision=5;expect(validateGameState(old)).toBe(true);old.worldRevision=6;expect(validateGameState(old)).toBe(true);old.worldGeneration=4;expect(validateGameState(old)).toBe(false);
  });
});
