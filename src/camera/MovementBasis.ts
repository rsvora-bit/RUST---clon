import {Camera,Vector3} from 'three';
const up=new Vector3(0,1,0);
/** Three.js cameras look down local -Z. Project that actual world direction onto XZ. */
export function cameraMovementBasis(camera:Camera,forward:Vector3,right:Vector3){
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
}
/** FPS movement is owned by yaw, so pitch, camera hierarchy or interpolation can never skew W/A/S/D. */
export function yawMovementBasis(yaw:number,forward:Vector3,right:Vector3){
  forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));
}
export function composeMovement(forward:Vector3,right:Vector3,f:number,s:number,out:Vector3){
  out.copy(forward).multiplyScalar(f).addScaledVector(right,s);if(out.lengthSq()>1)out.normalize();return out;
}
