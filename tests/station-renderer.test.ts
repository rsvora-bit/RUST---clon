import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {StationRenderer} from '../src/survival/StationRenderer';
import {createStation} from '../src/survival/stations';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';

describe('event cache rendering',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('extends solid workbench collision to the authored upper assembly and follows station rotation',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const renderer=new StationRenderer(new THREE.Scene()),bench=createStation('bench-collision','workbench3',{x:4,y:2,z:-3},Math.PI/2);renderer.sync([bench]);
    const [box]=renderer.boxes(bench);expect(box!.position.y+box!.halfExtents.y).toBeCloseTo(3.83,2);expect(box!.rotation).toBe(Math.PI/2);renderer.dispose();
  });
  it('keeps live collision envelopes around every solid station mesh at rotated placements',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const kinds=['storage','furnace','workbench1','workbench2','workbench3','campfire','bedroll','generator','powerSwitch','lamp','homesteadCore','recycler','deathbag','loot','secureCache'] as const,stations=kinds.map((kind,index)=>createStation(`collider-audit-${kind}`,kind,{x:30+index*5,y:2,z:-20-index*3},.37)),renderer=new StationRenderer(new THREE.Scene()),excluded=new Set(['flame','power-lamp-bulb','Relay cache aerial','Relay cache signal light']);renderer.sync(stations);
    try{for(const station of stations){const group=renderer.objects.get(station.id)!,box=renderer.boxes(station)[0]!;expect(box).toBeTruthy();const c=Math.cos(station.rotation),s=Math.sin(station.rotation),point=new THREE.Vector3();group.updateWorldMatrix(true,true);group.traverse(object=>{if(!(object instanceof THREE.Mesh)||!object.visible||excluded.has(object.name)||object.name.startsWith('recycler-spark-')||!object.material.visible)return;const geometry=object.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();const bounds=geometry.boundingBox;if(!bounds)return;for(let corner=0;corner<8;corner++){point.set(corner&1?bounds.max.x:bounds.min.x,corner&2?bounds.max.y:bounds.min.y,corner&4?bounds.max.z:bounds.min.z).applyMatrix4(object.matrixWorld);const dx=point.x-box.position.x,dz=point.z-box.position.z,localX=dx*c-dz*s,localZ=dx*s+dz*c;expect(Math.abs(localX)).toBeLessThanOrEqual(box.halfExtents.x+1e-4);expect(Math.abs(point.y-box.position.y)).toBeLessThanOrEqual(box.halfExtents.y+1e-4);expect(Math.abs(localZ)).toBeLessThanOrEqual(box.halfExtents.z+1e-4);}});}}
    finally{renderer.dispose();}
  });
  it.each(['storage','furnace','workbench3','recycler','generator','homesteadCore'] as const)('blocks a live Rapier player against the visible %s body',async kind=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    await initPhysics();
    const station=createStation(`live-collider-${kind}`,kind,{x:0,y:0,z:0},.37),renderer=new StationRenderer(new THREE.Scene());renderer.sync([station]);
    const [box]=renderer.boxes(station)!,floor=new THREE.PlaneGeometry(24,24,1,1);floor.rotateX(-Math.PI/2);
    const axis={x:Math.cos(station.rotation),z:-Math.sin(station.rotation)},start={x:box!.position.x-axis.x*(box!.halfExtents.x+2.5),y:0,z:box!.position.z-axis.z*(box!.halfExtents.x+2.5)};
    const physics=new PhysicsWorld(floor,[box!],start);
    try{
      for(let step=0;step<40;step++)physics.move({x:axis.x*.1,y:0,z:axis.z*.1});
      const position=physics.position(),dx=position.x-box!.position.x,dz=position.z-box!.position.z,depth=dx*axis.x+dz*axis.z,lateral=Math.abs(dx*axis.z-dz*axis.x);
      expect(depth).toBeLessThan(-(box!.halfExtents.x+.12));expect(depth).toBeGreaterThan(-(box!.halfExtents.x+.85));expect(lateral).toBeLessThan(.12);
    }finally{physics.dispose();floor.dispose();renderer.dispose();}
  });
  it('keeps signal antenna and beacon out of the solid salvage-cache proxy',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const renderer=new StationRenderer(new THREE.Scene()),cache=createStation('event-radio-signal','loot',{x:4,y:8,z:-3});renderer.sync([cache]);
    const [box]=renderer.boxes(cache);expect(box!.position.y+box!.halfExtents.y).toBeLessThan(9);expect(box!.position.y+box!.halfExtents.y).toBeGreaterThan(8.7);renderer.dispose();
  });
  it('adds a compact visible aerial only to the encrypted relay cache',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),signal=createStation('event-radio-signal','loot',{x:4,y:8,z:-3}),ordinary=createStation('loot-field-0','loot',{x:0,y:0,z:0});
    renderer.sync([signal,ordinary]);
    const relay=renderer.objects.get(signal.id)!,cache=renderer.objects.get(ordinary.id)!;
    const aerial=relay.getObjectByName('Relay cache aerial')!,beacon=relay.getObjectByName('Relay cache signal light')!;
    expect(aerial).toBeInstanceOf(THREE.Mesh);expect(beacon).toBeInstanceOf(THREE.Mesh);
    renderer.update([signal,ordinary],.25,new THREE.Vector3());const firstRotation=aerial.rotation.y;
    expect(beacon.visible).toBe(true);renderer.update([signal,ordinary],.75,new THREE.Vector3());expect(beacon.visible).toBe(false);expect(aerial.rotation.y).not.toBe(firstRotation);
    expect(cache.getObjectByName('Relay cache aerial')).toBeUndefined();
    renderer.dispose();
  });
  it('batches static salvage containers while keeping signal props, interaction and collapse behavior',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),loot=createStation('loot-poi-4','loot',{x:4,y:8,z:-3}),cache=createStation('secure-cache-poi-4','secureCache',{x:0,y:0,z:0}),ordinary=createStation('loot-poi-2','loot',{x:8,y:0,z:0});renderer.sync([loot,cache,ordinary]);
    const batched=(id:string)=>renderer.objects.get(id)!.children.filter((child):child is THREE.Mesh=>child instanceof THREE.Mesh&&child.name.includes('-batched-shell-'));
    expect(batched(loot.id)).toHaveLength(2);expect(batched(cache.id)).toHaveLength(2);expect(renderer.objects.get(cache.id)!.getObjectByName('sealed-cache-latch')).toBeTruthy();expect(batched(ordinary.id)).toHaveLength(2);
    expect(renderer.collapseContainer(loot.id)).toBe(true);renderer.update([loot,cache,ordinary],0,new THREE.Vector3());renderer.update([loot,cache,ordinary],1,new THREE.Vector3());expect(renderer.objects.has(loot.id)).toBe(false);renderer.dispose();
  });
  it('shows restrained moving sparks and a nearby warm work light while the recycler processes',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),recycler=createStation('recycler-test','recycler',{x:0,y:0,z:0}),workLights=scene.children.filter((object):object is THREE.PointLight=>object instanceof THREE.PointLight);
    recycler.active=true;recycler.inventory[0]={itemId:'gears',count:1};recycler.job={recipe:'gears',remaining:4};renderer.sync([recycler]);
    const group=renderer.objects.get(recycler.id)!,spark=group.getObjectByName('recycler-spark-0')!,light=group.getObjectByName('recycler-light')!,drive=group.getObjectByName('recycler-drive')!;
    renderer.update([recycler],1,new THREE.Vector3(0,0,2));const first=spark.position.clone();
    expect(spark.visible).toBe(true);expect(light.visible).toBe(true);expect(drive.rotation.x).toBeCloseTo(2.8);expect(workLights[0]!.intensity).toBeGreaterThan(0);
    renderer.update([recycler],2,new THREE.Vector3(0,0,2));expect(spark.position.equals(first)).toBe(false);
    recycler.active=false;renderer.update([recycler],3,new THREE.Vector3(0,0,2));expect(spark.visible).toBe(false);expect(light.visible).toBe(false);expect(workLights[0]!.intensity).toBe(0);renderer.dispose();
  });
  it('spins the generator flywheel only while its powered status is on',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),generator=createStation('generator-test','generator',{x:0,y:0,z:0},Math.PI/2);
    generator.active=true;generator.inventory[0]={itemId:'wood',count:1};renderer.sync([generator]);const group=renderer.objects.get(generator.id)!,fan=group.getObjectByName('generator-fan')!;
    expect(group.getObjectByName('generator-exhaust')).toBeTruthy();renderer.update([generator],1,new THREE.Vector3(0,0,2));expect(fan.rotation.z).toBe(9);expect(renderer.smokePuffCount).toBe(2);
    const smoke=scene.getObjectByName('Batched station smoke') as THREE.InstancedMesh,matrix=new THREE.Matrix4(),smokePosition=new THREE.Vector3();smoke.getMatrixAt(0,matrix);smokePosition.setFromMatrixPosition(matrix);expect(smokePosition.x).toBeCloseTo(-.15,1);expect(smokePosition.z).toBeCloseTo(-.27,1);
    generator.active=false;renderer.update([generator],2,new THREE.Vector3(0,0,2));expect(fan.rotation.z).toBe(0);expect(renderer.smokePuffCount).toBe(0);renderer.dispose();
  });
  it('batches nearby active furnace and campfire smoke, then clears it when cold or distant',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const renderer=new StationRenderer(new THREE.Scene()),furnace=createStation('smoke-furnace','furnace',{x:2,y:0,z:0}),campfire=createStation('smoke-campfire','campfire',{x:-2,y:0,z:0}),cold=createStation('cold-campfire','campfire',{x:0,y:0,z:2});
    furnace.active=true;furnace.inventory[0]={itemId:'ore',count:10};furnace.inventory[2]={itemId:'wood',count:5};campfire.active=true;campfire.inventory[0]={itemId:'wood',count:2};renderer.sync([furnace,campfire,cold]);
    renderer.update([cold],.5,new THREE.Vector3());const smoke=renderer.group.getObjectByName('Batched station smoke') as THREE.InstancedMesh;expect(renderer.smokePuffCount).toBe(0);expect(smoke.instanceMatrix.version).toBe(0);
    renderer.update([furnace,campfire,cold],1,new THREE.Vector3());expect(renderer.smokePuffCount).toBe(10);expect(smoke.instanceMatrix.version).toBe(1);
    const first=new THREE.Matrix4(),later=new THREE.Matrix4();smoke.getMatrixAt(0,first);renderer.update([furnace,campfire,cold],2,new THREE.Vector3());smoke.getMatrixAt(0,later);expect(first.equals(later)).toBe(false);expect(smoke.instanceMatrix.version).toBe(2);
    renderer.update([furnace,campfire,cold],3,new THREE.Vector3(100,0,0));expect(renderer.smokePuffCount).toBe(0);expect(smoke.instanceMatrix.version).toBe(2);renderer.dispose();
  });
});
