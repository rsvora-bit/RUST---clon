import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { collisionBoundsFromBox, collisionBoundsFromObject } from '../src/physics/collisionBounds';

describe('visual collision bounds', () => {
  it('contains every vertex after instance rotation, slope alignment and non-uniform scale', () => {
    const scene = new THREE.Group();
    const root = new THREE.Group();
    root.position.set(14, 3, -9);
    root.rotation.set(.12, 1.1, -.08);
    root.scale.set(2.4, 1.65, 2.1);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1));
    rock.position.y = -.2;
    rock.scale.set(1.3, .8, 1.1);
    root.add(rock);
    scene.add(root);

    const proxy = collisionBoundsFromObject(root, .08);
    const position = rock.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(rock.matrixWorld);
      expect(Math.abs(point.x - proxy.position.x)).toBeLessThanOrEqual(proxy.halfExtents.x);
      expect(Math.abs(point.y - proxy.position.y)).toBeLessThanOrEqual(proxy.halfExtents.y);
      expect(Math.abs(point.z - proxy.position.z)).toBeLessThanOrEqual(proxy.halfExtents.z);
    }
    expect(proxy.halfExtents.x).toBeGreaterThan(2.4 * .7);
    rock.geometry.dispose();
  });

  it('adds a small safety margin and keeps degenerate bounds usable', () => {
    const proxy = collisionBoundsFromBox(new THREE.Box3(new THREE.Vector3(2, 3, 4), new THREE.Vector3(2, 3, 4)), .08);
    expect(proxy).toEqual({ position: { x: 2, y: 3, z: 4 }, halfExtents: { x: .08, y: .08, z: .08 } });
  });
});
