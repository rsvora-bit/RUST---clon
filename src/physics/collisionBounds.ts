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
  const bounds=geometry.boundingBox!,worldBounds=new THREE.Box3().copy(bounds).applyMatrix4(transform),localCenter=bounds.getCenter(new THREE.Vector3()),center=localCenter.clone().applyMatrix4(transform),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  transform.decompose(position,quaternion,scale);const rotation=new THREE.Euler().setFromQuaternion(quaternion,'YXZ').y,c=Math.cos(rotation),s=Math.sin(rotation),half=new THREE.Vector3();
  // Project the transformed local bounds onto the collider's yaw axes. This
  // keeps tilted/rotated rocks enclosed without the oversized world AABB that
  // blocks empty space around their visible silhouette.
  for(let corner=0;corner<8;corner++){
    const point=new THREE.Vector3(corner&1?bounds.max.x:bounds.min.x,corner&2?bounds.max.y:bounds.min.y,corner&4?bounds.max.z:bounds.min.z).applyMatrix4(transform),dx=point.x-center.x,dz=point.z-center.z;
    half.x=Math.max(half.x,Math.abs(dx*c-dz*s));half.z=Math.max(half.z,Math.abs(dx*s+dz*c));
  }
  const verticalCenter=(worldBounds.min.y+worldBounds.max.y)*.5,verticalHalf=(worldBounds.max.y-worldBounds.min.y)*.5;
  return {position:{x:center.x,y:verticalCenter,z:center.z},halfExtents:{x:Math.max(.05,half.x+padding),y:Math.max(.05,verticalHalf+padding),z:Math.max(.05,half.z+padding)},rotation};
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
