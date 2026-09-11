import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PLAYER } from '../config/balance';
import type { Vec3 } from '../core/types';
export interface CollisionBox {position:Vec3;halfExtents:Vec3;rotation?:number;nodeId?:string}
export class PhysicsWorld {
  readonly world:RAPIER.World;
  readonly body:RAPIER.RigidBody;
  readonly collider:RAPIER.Collider;
  readonly controller:RAPIER.KinematicCharacterController;
  private structureColliders = new Map<string,RAPIER.Collider[]>();
  private naturalColliders = new Map<string,RAPIER.Collider>();
  constructor(terrain:THREE.BufferGeometry,props:CollisionBox[],spawn:Vec3){
    this.world = new RAPIER.World({x:0,y:-PLAYER.GRAVITY,z:0});
    const positions = new Float32Array(terrain.getAttribute('position').array);
    const indices = terrain.index ? new Uint32Array(terrain.index.array) : new Uint32Array(Array.from({length:positions.length/3},(_,i)=>i));
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions,indices).setFriction(0.9));
    for(const p of props) { const collider=this.createBox(p);if(p.nodeId)this.naturalColliders.set(p.nodeId,collider); }
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
  private createBox(box:CollisionBox){
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),box.rotation??0);
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(box.halfExtents.x,box.halfExtents.y,box.halfExtents.z).setTranslation(box.position.x,box.position.y,box.position.z).setRotation(q).setFriction(0.8));
  }
  setStructure(id:string,boxes:CollisionBox[]){this.removeStructure(id);this.structureColliders.set(id,boxes.map(b=>this.createBox(b)));}
  removeStructure(id:string){for(const c of this.structureColliders.get(id)??[])this.world.removeCollider(c,true);this.structureColliders.delete(id);}
  removeNodeCollider(id:string){const collider=this.naturalColliders.get(id);if(collider){this.world.removeCollider(collider,true);this.naturalColliders.delete(id);}}
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
