import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {StructureRenderer} from '../src/building/StructureRenderer';
import {BUILD} from '../src/config/balance';
import type {Structure} from '../src/core/types';
function renderer(){
  // Geometry tests never upload textures; a minimal drawing surface is sufficient.
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
  return new StructureRenderer(new THREE.Scene());
}
afterEach(()=>vi.unstubAllGlobals());
describe('rendered structure regressions',()=>{
  it('keeps the door target continuous across plank seams and follows the open hinge',()=>{
    const r=renderer();const door:Structure={id:'door',pieceType:'door',position:{x:0,y:0,z:0},rotation:0,health:250,createdAt:0,open:false};
    r.sync([door]);const root=r.objects.get('door')!;root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(0,1.6,2),new THREE.Vector3(0,0,-1),0,3);
    expect(ray.intersectObject(root,true).length).toBeGreaterThan(0);
    door.open=true;r.sync([door]);root.updateMatrixWorld(true);
    expect(ray.intersectObject(root,true)).toHaveLength(0);r.dispose();
  });
  it('uses the socket thickness for upper-floor collision and batches repeated boards',()=>{
    const r=renderer();const floor:Structure={id:'floor',pieceType:'floor',position:{x:0,y:5,z:0},rotation:0,health:250,createdAt:0};
    const box=r.boxes(floor)[0];expect(box.halfExtents.y*2).toBe(BUILD.THICKNESS);expect(box.position.y+box.halfExtents.y).toBeCloseTo(5+BUILD.THICKNESS);
    const wall=r.make('wall');expect(wall.children.length).toBeLessThanOrEqual(3);r.dispose();
  });
});
