import { describe, expect, it } from 'vitest';
import { boundsLineVertices,groundingLineVertices } from '../src/diagnostics/DebugView';
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
});
