import * as THREE from 'three';

/** Segment ray test shared by AI perception; shorten the far plane to exclude the target itself. */
export function hasLineOfSight(ray:THREE.Raycaster,origin:THREE.Vector3,target:THREE.Vector3,blockers:THREE.Object3D[],directionScratch:THREE.Vector3,endpointPadding=.2):boolean{
  directionScratch.subVectors(target,origin);const distance=directionScratch.length();if(distance<=endpointPadding)return true;
  directionScratch.multiplyScalar(1/distance);ray.set(origin,directionScratch);ray.near=0;ray.far=distance-endpointPadding;
  return ray.intersectObjects(blockers,true).length===0;
}
