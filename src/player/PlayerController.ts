import * as THREE from 'three';
import {cameraMovementBasis,composeMovement,yawMovementBasis} from '../camera/MovementBasis';
import { PLAYER } from '../config/balance';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Input } from '../input/Input';
import type {GameState,Settings,Vec3} from '../core/types';
export class PlayerController {
  yaw=0;pitch=0;grounded=false;sprinting=false;speed=0;private vertical=0;private jumpRequested=false;private stride=0;private crouch=0;
  private velocity=new THREE.Vector2();
  private forward=new THREE.Vector3();private right=new THREE.Vector3();private wish=new THREE.Vector3();
  headBob=false;
  private previousEye=new THREE.Vector3();private currentEye=new THREE.Vector3();
  onStep:()=>void=()=>{};private stepDistance=0;
  constructor(readonly physics:PhysicsWorld,readonly camera:THREE.PerspectiveCamera,private input:Input,private settings:Settings,state:GameState){this.yaw=state.player.yaw;this.pitch=state.player.pitch;this.currentEye.set(state.player.position.x,state.player.position.y+PLAYER.EYE_HEIGHT,state.player.position.z);this.previousEye.copy(this.currentEye);this.renderCamera(1);}
  look(dx:number,dy:number){const scale=0.0009*this.settings.sensitivity;this.yaw-=dx*scale;const ySign=this.settings.invertY?1:-1;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*scale*ySign,-1.48,1.48);this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);}
  jump(){this.jumpRequested=true;}
  setSettings(s:Settings){this.settings=s;this.headBob=s.headBob;}
  tick(dt:number,state:GameState,active:boolean){
    const forward=active?Number(this.input.down('KeyW','ArrowUp'))-Number(this.input.down('KeyS','ArrowDown')):0;
    const side=active?Number(this.input.down('KeyD','ArrowRight'))-Number(this.input.down('KeyA','ArrowLeft')):0;
    const crouching=active&&this.input.down('ControlLeft','ControlRight','KeyC');
    this.sprinting=active&&forward>0&&this.input.down('ShiftLeft','ShiftRight')&&state.player.stats.stamina>2&&!crouching;
    const speed=crouching?PLAYER.CROUCH_SPEED:this.sprinting?PLAYER.SPRINT_SPEED:PLAYER.WALK_SPEED;
    // Camera and movement share the same yaw. Pitch only changes where the player looks, never ground movement.
    this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
    yawMovementBasis(this.yaw,this.forward,this.right);
    composeMovement(this.forward,this.right,forward,side,this.wish);
    const alpha=1-Math.exp(-dt*(this.grounded?17:5));
    // Ease speed, not world-axis direction: turning must not retain sideways momentum.
    const magnitude=THREE.MathUtils.lerp(this.velocity.length(),this.wish.lengthSq()?speed:0,alpha);
    if(this.wish.lengthSq()){this.velocity.set(this.wish.x*magnitude,this.wish.z*magnitude);}
    else this.velocity.multiplyScalar(1-alpha);
    if(this.jumpRequested&&this.grounded&&active&&state.player.stats.stamina>=8){this.vertical=PLAYER.JUMP_SPEED;state.player.stats.stamina-=8;this.grounded=false;}
    this.jumpRequested=false;
    if(this.grounded&&this.vertical<0)this.vertical=-1.2;else this.vertical-=PLAYER.GRAVITY*dt;
    this.vertical=Math.max(this.vertical,-32);
    this.grounded=this.physics.move({x:this.velocity.x*dt,y:this.vertical*dt,z:this.velocity.y*dt});
    if(this.grounded&&this.vertical<0)this.vertical=-1.2;
    this.speed=Math.hypot(this.velocity.x,this.velocity.y);
    state.player.position=this.physics.position();state.player.yaw=this.yaw;state.player.pitch=this.pitch;
    if(this.grounded&&this.speed>0.5){this.stepDistance+=this.speed*dt;if(this.stepDistance>2.2){this.stepDistance=0;this.onStep();}}
    this.crouch=THREE.MathUtils.damp(this.crouch,crouching?0.43:0,12,dt);
    this.stride+=this.speed*dt*1.9;
    const bob=this.headBob&&this.grounded?Math.sin(this.stride)*Math.min(this.speed/7,1)*0.018:0;
    const p=state.player.position;
    this.previousEye.copy(this.currentEye);
    this.currentEye.set(p.x,p.y+PLAYER.EYE_HEIGHT-this.crouch+bob,p.z);
    this.renderCamera(1);
  }
  /** Interpolate position across fixed physics steps; mouse orientation is current each render. */
  renderCamera(alpha:number){
    this.camera.position.lerpVectors(this.previousEye,this.currentEye,THREE.MathUtils.clamp(alpha,0,1));
    this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
  }

  cameraDebug(){
    const forward=new THREE.Vector3(),right=new THREE.Vector3();cameraMovementBasis(this.camera,forward,right);
    const movement=new THREE.Vector3(),movementRight=new THREE.Vector3();yawMovementBasis(this.yaw,movement,movementRight);
    const position=this.physics.position(),world=this.camera.getWorldPosition(new THREE.Vector3());
    const hierarchy:string[]=[];for(let node:THREE.Object3D|null=this.camera;node;node=node.parent)hierarchy.push(node.name||node.type);
    return {controller:position,world:world.toArray(),local:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),yaw:this.yaw,cameraYaw:this.camera.rotation.y,pitch:this.camera.rotation.x,roll:this.camera.rotation.z,forward:forward.toArray(),movementForward:movement.toArray(),velocity:[this.velocity.x,0,this.velocity.y],angle:THREE.MathUtils.radToDeg(forward.angleTo(movement)),hierarchy,bodyRotation:this.physics.body.rotation(),horizontalEyeOffset:Math.hypot(world.x-position.x,world.z-position.z),fov:this.camera.fov,aspect:this.camera.aspect};
  }
  debugText(){const d=this.cameraDebug(),v=(a:number[])=>a.map(n=>n.toFixed(3)).join(', ');return `CAMERA BASIS\nEYES ${v(d.world)}\nLOCAL ${v(d.local)}\nYAW ${d.yaw.toFixed(3)} / CAMERA ${d.cameraYaw.toFixed(3)}\nPITCH ${d.pitch.toFixed(3)} ROLL ${d.roll.toFixed(3)}\nQUAT ${v(d.quaternion)}\nCAM FWD ${v(d.forward)}\nMOVE FWD ${v(d.movementForward)}\nANGLE ${d.angle.toFixed(5)}°\nVELOCITY ${v(d.velocity)}\nEYE XZ OFFSET ${d.horizontalEyeOffset.toFixed(4)} m\nFOV V ${d.fov.toFixed(2)} ASPECT ${d.aspect.toFixed(3)}\n${d.hierarchy.join(' ← ')}`;}
  teleport(p:Vec3){this.physics.teleport(p);this.vertical=0;this.velocity.set(0,0);this.currentEye.set(p.x,p.y+PLAYER.EYE_HEIGHT-this.crouch,p.z);this.previousEye.copy(this.currentEye);this.renderCamera(1);}
}
