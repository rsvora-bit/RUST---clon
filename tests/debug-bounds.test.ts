import { describe, expect, it } from 'vitest';
import { boundsLineVertices } from '../src/diagnostics/DebugView';
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
});
