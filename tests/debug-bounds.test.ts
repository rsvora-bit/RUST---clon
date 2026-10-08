import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { boundsLineVertices,DebugView,groundingLineVertices,lodDebugGeometry,shadowCasterLineVertices } from '../src/diagnostics/DebugView';
import type { CollisionBox } from '../src/physics/PhysicsWorld';

describe('F3 world collision bounds', () => {
  it('builds one 12-edge wireframe cuboid per world proxy', () => {
    const boxes: CollisionBox[] = [
      { position: { x: 2, y: 3, z: 4 }, halfExtents: { x: 1, y: 2, z: 3 } },
      { position: { x: -1, y: 0, z: 1 }, halfExtents: { x: .5, y: .75, z: 1.25 } },
    ];
    const lines = boundsLineVertices(boxes);
    expect(lines).toHaveLength(2 * 12 * 2 * 3);
    expect([...lines.slice(0, 6)]).toEqual([1, 1, 1, 3, 1, 1]);
    expect([...lines.slice(-6)]).toEqual([-1.5, .75, 2.25, -.5, .75, 2.25]);
  });

  it('supports an empty world without allocating line vertices', () => {
    expect(boundsLineVertices([])).toHaveLength(0);
  });

  it('rotates world proxy bounds with the physics cuboid yaw',()=>{
    const box:CollisionBox={position:{x:0,y:0,z:0},halfExtents:{x:1,y:.5,z:2},rotation:Math.PI/2};
    const lines=boundsLineVertices([box]);
    expect([...lines.slice(0,6)]).toEqual([-2,-.5,1,-2,-.5,-1]);
  });

  it('shows tilted collision proxies with their authored Z lean',()=>{
    const lines=boundsLineVertices([{position:{x:0,y:0,z:0},halfExtents:{x:1,y:.5,z:2},rotationZ:Math.PI/2}]);
    expect([...lines.slice(0,6)]).toEqual([.5,-1,-2,.5,1,-2]);
  });

  it('shows proxy contact gap, origin marker and the local terrain normal',()=>{
    const box:CollisionBox={position:{x:0,y:3,z:0},halfExtents:{x:1,y:2,z:1}},lines=groundingLineVertices([box],(x)=>x*.1,{x:0,z:0});
    expect(lines).toHaveLength(24);
    expect([...lines.slice(0,9)]).toEqual([0,1,0,0,0,0,0,0,0]);expect(lines[9]).toBeCloseTo(-.0995,3);expect(lines[10]).toBeCloseTo(.995,3);expect(lines[11]).toBe(0);
    const origin=[-.14,3,0,.14,3,0,0,3,-.14,0,3,.14];origin.forEach((value,index)=>expect(lines[index+12]).toBeCloseTo(value,5));
  });

  it('limits grounding guides to nearby colliders and ignores void samples',()=>{
    const boxes:CollisionBox[]=[{position:{x:0,y:2,z:0},halfExtents:{x:1,y:1,z:1}},{position:{x:100,y:2,z:0},halfExtents:{x:1,y:1,z:1}},{position:{x:2,y:2,z:0},halfExtents:{x:1,y:1,z:1}}];
    expect(groundingLineVertices(boxes,(x)=>x===2?-20:0,{x:0,z:0},20)).toHaveLength(24);
  });

  it('shows nearby shadow-casting meshes and instances while excluding distant or non-casting objects',()=>{
    const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,2,1),material=new THREE.MeshBasicMaterial(),caster=new THREE.Mesh(geometry,material);caster.castShadow=true;caster.position.set(2,1,0);scene.add(caster);
    const instanced=new THREE.InstancedMesh(geometry,material,2);instanced.castShadow=true;instanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(5,1,0));instanced.setMatrixAt(1,new THREE.Matrix4().makeTranslation(100,1,0));scene.add(instanced);
    const nonCaster=new THREE.Mesh(geometry,material);nonCaster.position.set(1,1,0);scene.add(nonCaster);
    expect(shadowCasterLineVertices(scene,{x:0,y:1,z:0},20)).toHaveLength(2*12*2*3);
    expect(shadowCasterLineVertices(scene,{x:0,y:1,z:0},20,1)).toHaveLength(12*2*3);
    geometry.dispose();material.dispose();
  });

  it('draws bounded nearby authored asset boxes colored by their active LOD',()=>{
    const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(2,2,2),mesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial(),2);mesh.userData.generatedWorldAsset='large_boulder_a';mesh.userData.generatedWorldLod=2;mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(4,0,0));mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(200,0,0));scene.add(mesh);
    const result=lodDebugGeometry(scene,{x:0,y:0,z:0},30,10);
    expect(result.assets).toBe(1);expect(result.positions).toHaveLength(12*2*3);expect(result.colors).toHaveLength(result.positions.length);expect(result.colors[0]).toBe(1);expect(result.colors[1]).toBeCloseTo(.34,5);expect(result.colors[2]).toBeCloseTo(.28,5);
    expect(lodDebugGeometry(scene,{x:0,y:0,z:0},2,10).assets).toBe(0);geometry.dispose();(mesh.material as THREE.Material).dispose();
  });

  it('keeps the active-LOD overlay disabled until explicitly enabled',()=>{
    const scene=new THREE.Scene(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),1);mesh.userData.generatedWorldAsset='large_boulder_a';scene.add(mesh);const debug=new DebugView(scene),fakePhysics={} as import('../src/physics/PhysicsWorld').PhysicsWorld;
    debug.update(fakePhysics,[],[],new THREE.Vector3());expect(scene.getObjectByName('World active LOD debug')).toBeUndefined();debug.lod=true;debug.update(fakePhysics,[],[],new THREE.Vector3());const overlay=scene.getObjectByName('World active LOD debug') as THREE.LineSegments;expect(overlay.visible).toBe(true);expect(overlay.userData.assetCount).toBe(1);debug.lod=false;debug.update(fakePhysics,[],[],new THREE.Vector3());expect(overlay.visible).toBe(false);mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
  });

  it('toggles the F3 shadow-caster overlay on and off without enabling it by default',()=>{
    const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());mesh.castShadow=true;scene.add(mesh);const debug=new DebugView(scene),fakePhysics={} as import('../src/physics/PhysicsWorld').PhysicsWorld;
    debug.update(fakePhysics,[],[],new THREE.Vector3(0,1,0));expect(scene.getObjectByName('World shadow caster debug')).toBeUndefined();
    debug.shadowCasters=true;debug.update(fakePhysics,[],[],new THREE.Vector3(0,1,0));const lines=scene.getObjectByName('World shadow caster debug') as THREE.LineSegments;
    expect(lines.visible).toBe(true);expect(lines.geometry.getAttribute('position').count).toBe(24);
    debug.shadowCasters=false;debug.update(fakePhysics,[],[],new THREE.Vector3(0,1,0));expect(lines.visible).toBe(false);mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
  });
});
