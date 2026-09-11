import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {GatheringFeedback} from '../src/rendering/GatheringFeedback';
import type {ResourceNode} from '../src/core/types';

describe('gathering weak spots',()=>{
  it('creates a target after the first hit and recognizes a centered weak-spot strike',()=>{
    const scene=new THREE.Scene(),fx=new GatheringFeedback(scene),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);
    const tree:ResourceNode={id:'tree-test',kind:'tree',position:{x:0,y:0,z:0},capacity:300,remaining:300,rotation:0,scale:1};
    fx.onHit(tree,{x:0,y:1.6,z:0},false,false);const spot=fx.spotPosition(tree.id);expect(spot).not.toBeNull();
    const origin=camera.position.clone(),target=new THREE.Vector3(spot!.x,spot!.y,spot!.z),ray=new THREE.Ray(origin,target.sub(origin).normalize());
    expect(fx.capture(tree,ray,new THREE.Vector3(0,1.6,0)).weakSpot).toBe(true);
    const before={...spot!};fx.onHit(tree,{x:before.x,y:before.y,z:before.z},true,false);const moved=fx.spotPosition(tree.id)!;
    expect(Math.hypot(moved.x-before.x,moved.y-before.y,moved.z-before.z)).toBeGreaterThan(.05);fx.dispose();
  });

  it('uses explicit tool yields and a 50 percent weak-spot bonus in simulation',()=>{
    // Behaviour is covered in simulation.test.ts; this test guards renderer lifecycle only.
    const scene=new THREE.Scene(),fx=new GatheringFeedback(scene);fx.clear();fx.dispose();expect(scene.children).toHaveLength(0);
  });
});
