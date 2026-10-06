import {beforeAll,describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';

describe('rain surface query',()=>{
  beforeAll(async()=>{await initPhysics();});

  it('finds nearby rock/building tops and skips tree gameplay colliders',()=>{
    const ground=new THREE.PlaneGeometry(20,20,2,2);ground.rotateX(-Math.PI/2);
    const physics=new PhysicsWorld(ground,[
      {position:{x:2,y:1,z:0},halfExtents:{x:.5,y:.5,z:.5}},
      {nodeId:'tree-test',rainSurface:false,position:{x:-2,y:2,z:0},halfExtents:{x:.3,y:2,z:.3}},
    ],{x:8,y:5,z:8});
    const point=new THREE.Vector3(),normal=new THREE.Vector3();
    try{
      expect(physics.rainSurfaceAt(2,0,10,20,point,normal)).toBe(true);
      expect(point.y).toBeCloseTo(1.5,2);expect(normal.y).toBeGreaterThan(.99);
      expect(physics.rainSurfaceAt(-2,0,10,20,point,normal)).toBe(true);
      expect(point.y).toBeCloseTo(0,2);expect(normal.y).toBeGreaterThan(.99);
      physics.removeNodeCollider('tree-test');
      expect(physics.rainSurfaceAt(-2,0,10,20,point,normal)).toBe(true);
      expect(point.y).toBeCloseTo(0,2);
    }finally{physics.dispose();ground.dispose();}
  });
});
