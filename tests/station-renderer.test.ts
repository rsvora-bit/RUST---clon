import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {StationRenderer} from '../src/survival/StationRenderer';
import {createStation} from '../src/survival/stations';

describe('event cache rendering',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('adds a compact visible aerial only to the encrypted relay cache',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),signal=createStation('event-radio-signal','loot',{x:4,y:8,z:-3}),ordinary=createStation('loot-field-0','loot',{x:0,y:0,z:0});
    renderer.sync([signal,ordinary]);
    const relay=renderer.objects.get(signal.id)!,cache=renderer.objects.get(ordinary.id)!;
    expect(relay.getObjectByName('Relay cache aerial')).toBeInstanceOf(THREE.Mesh);
    expect(relay.getObjectByName('Relay cache signal light')).toBeInstanceOf(THREE.Mesh);
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
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),generator=createStation('generator-test','generator',{x:0,y:0,z:0});
    generator.active=true;generator.inventory[0]={itemId:'wood',count:1};renderer.sync([generator]);const fan=renderer.objects.get(generator.id)!.getObjectByName('generator-fan')!;
    renderer.update([generator],1,new THREE.Vector3(0,0,2));expect(fan.rotation.z).toBe(9);
    generator.active=false;renderer.update([generator],2,new THREE.Vector3(0,0,2));expect(fan.rotation.z).toBe(0);renderer.dispose();
  });
});
