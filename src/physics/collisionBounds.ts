import * as THREE from 'three';

export interface CollisionBounds {
  position: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

/** Convert a world-space visual bound into a conservative, axis-aligned proxy. */
export function collisionBoundsFromBox(box: THREE.Box3, padding = 0.06): CollisionBounds {
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return {
    position: { x: center.x, y: center.y, z: center.z },
    halfExtents: {
      x: Math.max(0.05, half.x + padding),
      y: Math.max(0.05, half.y + padding),
      z: Math.max(0.05, half.z + padding),
    },
  };
}

/** Measure all rendered child meshes after their complete world transform. */
export function collisionBoundsFromObject(object: THREE.Object3D, padding = 0.06): CollisionBounds {
  object.updateWorldMatrix(true, true);
  return collisionBoundsFromBox(new THREE.Box3().setFromObject(object, true), padding);
}
