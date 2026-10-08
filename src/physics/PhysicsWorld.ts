import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PLAYER } from '../config/balance';
import type { Vec3 } from '../core/types';
export interface CollisionBox {position:Vec3;halfExtents:Vec3;rotation?:number;rotationZ?:number;shape?:'cuboid'|'capsule';nodeId?:string;rainSurface?:boolean}
export class PhysicsWorld {
  readonly world:RAPIER.World;
  readonly body:RAPIER.RigidBody;
  readonly collider:RAPIER.Collider;
  readonly controller:RAPIER.KinematicCharacterController;
  private structureColliders = new Map<string,RAPIER.Collider[]>();
  private naturalColliders = new Map<string,RAPIER.Collider>();
  private readonly excludedRainSurfaces=new Set<number>();
  private readonly rainRay=new RAPIER.Ray({x:0,y:0,z:0},{x:0,y:-1,z:0});
  constructor(terrain:THREE.BufferGeometry,props:CollisionBox[],spawn:Vec3){
    this.world = new RAPIER.World({x:0,y:-PLAYER.GRAVITY,z:0});
    const positions = new Float32Array(terrain.getAttribute('position').array);
    const indices = terrain.index ? new Uint32Array(terrain.index.array) : new Uint32Array(Array.from({length:positions.length/3},(_,i)=>i));
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions,indices).setFriction(0.9));
    for(const p of props) { const collider=this.createCollider(p);if(p.nodeId)this.naturalColliders.set(p.nodeId,collider);if(p.rainSurface===false)this.excludedRainSurfaces.add(collider.handle); }
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x,spawn.y+PLAYER.HEIGHT/2,spawn.z));
    this.collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER.HEIGHT/2-PLAYER.RADIUS,PLAYER.RADIUS),this.body);
    this.controller=this.world.createCharacterController(0.025);
    this.controller.enableAutostep(0.56,0.2,true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle(47*Math.PI/180);
    this.controller.setMinSlopeSlideAngle(51*Math.PI/180);
    this.world.timestep=1/60;
    this.world.step();
  }
  private createCollider(box:CollisionBox){
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,box.rotation??0,box.rotationZ??0));
    const shape=box.shape==='capsule'?RAPIER.ColliderDesc.capsule(box.halfExtents.y,box.halfExtents.x):RAPIER.ColliderDesc.cuboid(box.halfExtents.x,box.halfExtents.y,box.halfExtents.z);
    return this.world.createCollider(shape.setTranslation(box.position.x,box.position.y,box.position.z).setRotation(q).setFriction(0.8));
  }
  setStructure(id:string,boxes:CollisionBox[]){this.removeStructure(id);this.structureColliders.set(id,boxes.map(b=>this.createCollider(b)));}
  removeStructure(id:string){for(const c of this.structureColliders.get(id)??[])this.world.removeCollider(c,true);this.structureColliders.delete(id);}
  hasStructure(id:string){return this.structureColliders.has(id);}
  removeNodeCollider(id:string){const collider=this.naturalColliders.get(id);if(collider){this.world.removeCollider(collider,true);this.naturalColliders.delete(id);this.excludedRainSurfaces.delete(collider.handle);}}
  rainSurfaceAt(x:number,z:number,originY:number,maxDistance:number,point:THREE.Vector3,normal:THREE.Vector3):boolean{
    this.rainRay.origin.x=x;this.rainRay.origin.y=originY;this.rainRay.origin.z=z;
    const hit=this.world.castRayAndGetNormal(this.rainRay,maxDistance,true,undefined,undefined,this.collider,this.body,collider=>!this.excludedRainSurfaces.has(collider.handle));
    if(!hit)return false;point.set(x,originY-hit.timeOfImpact,z);normal.set(hit.normal.x,hit.normal.y,hit.normal.z).normalize();return true;
  }
  move(delta:Vec3){
    this.controller.computeColliderMovement(this.collider,delta);
    const m=this.controller.computedMovement(),p=this.body.translation();
    this.body.setNextKinematicTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z});
    this.world.step();
    return this.controller.computedGrounded();
  }
  position():Vec3 {const p=this.body.translation();return {x:p.x,y:p.y-PLAYER.HEIGHT/2,z:p.z};}
  teleport(p:Vec3){const center={x:p.x,y:p.y+PLAYER.HEIGHT/2,z:p.z};this.body.setTranslation(center,true);this.body.setNextKinematicTranslation(center);this.world.step();}
  dispose(){this.world.free();}
}
export async function initPhysics(){await RAPIER.init();}
