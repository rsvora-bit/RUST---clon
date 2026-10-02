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
  it('batches only the revision-4 Stormwatch containers and keeps their interaction and collapse behavior',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),renderer=new StationRenderer(scene),loot=createStation('loot-poi-4','loot',{x:4,y:8,z:-3}),cache=createStation('secure-cache-poi-4','secureCache',{x:0,y:0,z:0}),ordinary=createStation('loot-poi-2','loot',{x:8,y:0,z:0});renderer.sync([loot,cache,ordinary]);
    const batched=(id:string)=>renderer.objects.get(id)!.children.filter((child):child is THREE.Mesh=>child instanceof THREE.Mesh&&child.name.includes('-batched-shell-'));
    expect(batched(loot.id)).toHaveLength(2);expect(batched(cache.id)).toHaveLength(2);expect(renderer.objects.get(cache.id)!.getObjectByName('sealed-cache-latch')).toBeTruthy();expect(batched(ordinary.id)).toHaveLength(0);
    expect(renderer.collapseContainer(loot.id)).toBe(true);renderer.update([loot,cache,ordinary],0,new THREE.Vector3());renderer.update([loot,cache,ordinary],1,new THREE.Vector3());expect(renderer.objects.has(loot.id)).toBe(false);renderer.dispose();
  });
});
