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
});
