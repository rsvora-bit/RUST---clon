import * as THREE from 'three';

export interface CollisionBounds {
  position: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  rotation?: number;
}

/** Stable trunk proxy based on the authored species scale and meter height. */
export function treeTrunkCollision(position: { x: number; y: number; z: number }, scale: number, species: number): CollisionBounds {
  const halfHeight = species === 5 ? 3.9 : species === 1 ? 4.65 : species === 4 ? 4.25 : species === 2 ? 6.55 : species === 3 ? 5.1 : 5.8;
  const radius = .45 * scale, height = halfHeight * scale;
  return {
    position: { x: position.x, y: position.y + height, z: position.z },
    halfExtents: { x: radius, y: height, z: radius },
  };
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

/** Build a yaw-oriented proxy from upright local geometry and its instance transform. */
export function collisionBoundsFromGeometry(geometry: THREE.BufferGeometry, transform: THREE.Matrix4, padding = 0.06): CollisionBounds {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!,center=bounds.getCenter(new THREE.Vector3()).applyMatrix4(transform),size=bounds.getSize(new THREE.Vector3()),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  transform.decompose(position,quaternion,scale);const rotation=new THREE.Euler().setFromQuaternion(quaternion,'YXZ').y;
  return {position:{x:center.x,y:center.y,z:center.z},halfExtents:{x:Math.max(.05,size.x*Math.abs(scale.x)*.5+padding),y:Math.max(.05,size.y*Math.abs(scale.y)*.5+padding),z:Math.max(.05,size.z*Math.abs(scale.z)*.5+padding)},rotation};
}

/** Two thin side walls for a long, open hull, derived from its authored bounds. */
export function longHullSideCollisions(box: THREE.Box3, thickness = 0.12, inset = 0.10): CollisionBounds[] {
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),halfLength=Math.max(.05,size.x*.5-inset),halfHeight=Math.max(.05,size.y*.5-inset),halfThickness=Math.max(.05,thickness);
  return [box.min.z+halfThickness,box.max.z-halfThickness].map(z=>({
    position:{x:center.x,y:center.y,z},
    halfExtents:{x:halfLength,y:halfHeight,z:halfThickness},
  }));
}

/** Measure all rendered child meshes after their complete world transform. */
export function collisionBoundsFromObject(object: THREE.Object3D, padding = 0.06): CollisionBounds {
  object.updateWorldMatrix(true, true);
  return collisionBoundsFromBox(new THREE.Box3().setFromObject(object, true), padding);
}
