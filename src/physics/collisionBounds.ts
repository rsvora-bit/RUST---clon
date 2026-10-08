import * as THREE from 'three';

export interface CollisionBounds {
  position: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  rotation?: number;
  shape?: 'cuboid'|'capsule';
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

/** Revision-6 authored tree trunk proxies, kept independent from decorative branches and crowns. */
const TREE_ASSET_COLLISION_PROXIES = [
  { center: 5.8, halfHeight: 5.42, radius: .38 }, // conifer_a
  { center: 4.65, halfHeight: 4.27, radius: .38 }, // broadleaf_a
  { center: 6.55, halfHeight: 6.17, radius: .38 }, // conifer_b
  { center: 5.1, halfHeight: 4.72, radius: .38 }, // conifer_c
  { center: 4.25, halfHeight: 3.87, radius: .38 }, // broadleaf_c
  { center: 4.8, halfHeight: 4.46, radius: .34 }, // palm_tree_a
  { center: 4.2, halfHeight: 3.86, radius: .34 }, // alpine_conifer
  { center: 3.9, halfHeight: 3.52, radius: .38 }, // marsh_tree
  { center: 4.55, halfHeight: 4.17, radius: .38 }, // coastal_tree
  { center: 5.35, halfHeight: 4.97, radius: .38 }, // broadleaf_b
] as const;

export function treeAssetCollision(position: { x: number; y: number; z: number }, scale: number, species: number): CollisionBounds {
  const proxy = TREE_ASSET_COLLISION_PROXIES[species];
  if (!proxy) return treeTrunkCollision(position, scale, species);
  return {
    position: { x: position.x, y: position.y + proxy.center * scale, z: position.z },
    halfExtents: { x: proxy.radius * scale, y: proxy.halfHeight * scale, z: proxy.radius * scale },
    shape: 'capsule',
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

/** Enclose several authored render LODs in one stable physical proxy. */
export function collisionBoundsFromLodObjects(levels:readonly THREE.Object3D[],padding=.06):CollisionBounds|null{
  const bounds=new THREE.Box3().makeEmpty();for(const level of levels){level.updateWorldMatrix(true,true);bounds.union(new THREE.Box3().setFromObject(level,true));}
  return bounds.isEmpty()?null:collisionBoundsFromBox(bounds,padding);
}

/** Build a yaw-oriented proxy from upright local bounds and their instance transform. */
export function collisionBoundsFromLocalBox(bounds:THREE.Box3,transform:THREE.Matrix4,padding=.06):CollisionBounds {
  const worldBounds=new THREE.Box3().copy(bounds).applyMatrix4(transform),localCenter=bounds.getCenter(new THREE.Vector3()),center=localCenter.clone().applyMatrix4(transform),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
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

/** Build a stable proxy around the union of several visual LOD bounds. */
export function collisionBoundsFromGeometries(geometries:readonly THREE.BufferGeometry[],transform:THREE.Matrix4,padding=.06):CollisionBounds {
  const bounds=new THREE.Box3().makeEmpty();
  for(const geometry of geometries){if(!geometry.boundingBox)geometry.computeBoundingBox();if(geometry.boundingBox)bounds.union(geometry.boundingBox);}
  return collisionBoundsFromLocalBox(bounds,transform,padding);
}

/** Build a yaw-oriented proxy from upright local geometry and its instance transform. */
export function collisionBoundsFromGeometry(geometry: THREE.BufferGeometry, transform: THREE.Matrix4, padding = 0.06): CollisionBounds {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return collisionBoundsFromLocalBox(geometry.boundingBox!,transform,padding);
}

/** Two thin side walls for a long, open hull, derived from its authored bounds. */
export function longHullSideCollisions(box: THREE.Box3, thickness = 0.12, inset = 0.10): CollisionBounds[] {
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),halfLength=Math.max(.05,size.x*.5-inset),halfHeight=Math.max(.05,size.y*.5-inset),halfThickness=Math.max(.05,thickness);
  return [box.min.z+halfThickness,box.max.z-halfThickness].map(z=>({
    position:{x:center.x,y:center.y,z},
    halfExtents:{x:halfLength,y:halfHeight,z:halfThickness},
  }));
}

/** Keep open-hull side collision stable when authored render LODs extend beyond LOD0. */
export function longHullSideCollisionsFromLods(levels:readonly THREE.Object3D[],thickness=.12,inset=.10):CollisionBounds[]{
  const bounds=new THREE.Box3().makeEmpty();
  for(const level of levels){level.updateWorldMatrix(true,true);bounds.union(new THREE.Box3().setFromObject(level,true));}
  return bounds.isEmpty()?[]:longHullSideCollisions(bounds,thickness,inset);
}

/** Measure all rendered child meshes after their complete world transform. */
export function collisionBoundsFromObject(object: THREE.Object3D, padding = 0.06): CollisionBounds {
  object.updateWorldMatrix(true, true);
  return collisionBoundsFromBox(new THREE.Box3().setFromObject(object, true), padding);
}
