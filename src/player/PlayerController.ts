import * as THREE from 'three';
import {cameraMovementBasis,composeMovement,yawMovementBasis} from '../camera/MovementBasis';
import { PLAYER } from '../config/balance';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Input } from '../input/Input';
import type {GameState,Settings,Vec3} from '../core/types';

export class PlayerController {
  yaw=0;
  pitch=0;
  grounded=false;
  sprinting=false;
  crouching=false;
  autoRun=false;
  speed=0;
  headBob=false;
  lastLandingSpeed=0;
  lastFallDamage=0;

  private vertical=0;
  private jumpRequested=false;
  private jumpCooldown=0;
  private stride=0;
  private crouchBlend=0;
  private landingAge=10;
  private landingKick=0;
  private swayX=0;
  private swayY=0;
  private swayRoll=0;
  private velocity=new THREE.Vector2();
  private targetVelocity=new THREE.Vector2();
  private forward=new THREE.Vector3();
  private right=new THREE.Vector3();
  private wish=new THREE.Vector3();
  private previousEye=new THREE.Vector3();
  private currentEye=new THREE.Vector3();
  private stepDistance=0;
  private suppressLanding=true;

  onStep:(speed:number)=>void=()=>{};
  onLand:(impactSpeed:number)=>void=()=>{};

  constructor(readonly physics:PhysicsWorld,readonly camera:THREE.PerspectiveCamera,private input:Input,private settings:Settings,state:GameState){
    this.yaw=state.player.yaw;
    this.pitch=state.player.pitch;
    this.headBob=settings.headBob;
    this.currentEye.set(state.player.position.x,state.player.position.y+PLAYER.EYE_HEIGHT,state.player.position.z);
    this.previousEye.copy(this.currentEye);
    this.renderCamera(1);
  }

  /** Mouse deltas are angular input, never multiplied by dt. */
  look(dx:number,dy:number){
    const sx=0.0009*this.settings.sensitivityX,sy=0.0009*this.settings.sensitivityY;
    this.yaw-=dx*sx;
    const ySign=this.settings.invertY?1:-1;
    this.pitch=THREE.MathUtils.clamp(this.pitch+dy*sy*ySign,-1.48,1.48);
    this.camera.rotation.order='YXZ';
    this.camera.rotation.set(this.pitch,this.yaw,this.settings.cameraShake?this.swayRoll:0);
  }

  jump(){this.jumpRequested=true;this.suppressLanding=false;}
  toggleAutoRun(){this.autoRun=!this.autoRun;return this.autoRun;}
  setSettings(s:Settings){this.settings=s;this.headBob=s.headBob;}

  tick(dt:number,state:GameState,active:boolean){
    const keys=this.settings.keybinds;
    const manualForward=active?Number(this.input.down(keys.forward))-Number(this.input.down(keys.backward)):0;
    const side=active?Number(this.input.down(keys.right))-Number(this.input.down(keys.left)):0;
    if(active&&this.input.down(keys.backward))this.autoRun=false;
    const forward=active?(this.autoRun&&manualForward>=0?Math.max(1,manualForward):manualForward):0;
    const crouchWanted=active&&this.input.down(keys.crouch);
    const wasGrounded=this.grounded;
    const wasSprinting=this.sprinting;

    this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);
    this.crouchBlend=THREE.MathUtils.damp(this.crouchBlend,crouchWanted?1:0,crouchWanted?11:8.5,dt);
    this.crouching=this.crouchBlend>.5;

    const sprintHeld=active&&this.input.down(keys.sprint);
    const sprintDirection=forward>.2&&Math.abs(side)<.95;
    const sprintPosture=!crouchWanted&&this.crouchBlend<.18;
    const sprintGroundState=this.grounded||wasSprinting;
    this.sprinting=Boolean(sprintHeld&&sprintDirection&&sprintPosture&&sprintGroundState&&state.player.stats.stamina>3);

    const postureSpeed=THREE.MathUtils.lerp(PLAYER.WALK_SPEED,PLAYER.CROUCH_SPEED,this.crouchBlend);
    const moveSpeed=this.sprinting?PLAYER.SPRINT_SPEED:postureSpeed;

    // Camera and movement share yaw. Pitch never changes ground movement.
    this.camera.rotation.order='YXZ';
    yawMovementBasis(this.yaw,this.forward,this.right);
    composeMovement(this.forward,this.right,forward,side,this.wish);
    const hasWish=this.wish.lengthSq()>.0001;
    this.targetVelocity.set(hasWish?this.wish.x*moveSpeed:0,hasWish?this.wish.z*moveSpeed:0);

    if(this.grounded){
      const reversing=hasWish&&this.velocity.lengthSq()>.04&&this.velocity.dot(this.targetVelocity)<0;
      const response=!hasWish?PLAYER.DECELERATION:reversing?PLAYER.REVERSE_ACCELERATION:PLAYER.ACCELERATION;
      const alpha=1-Math.exp(-response*dt);
      this.velocity.lerp(this.targetVelocity,alpha);
      if(!hasWish&&this.velocity.length()<.015)this.velocity.set(0,0);
    }else{
      // Preserve momentum in the air and only allow a restrained steering influence.
      if(hasWish){
        const desired=this.targetVelocity.clone();
        const current=this.velocity.length();
        if(current>moveSpeed&&desired.lengthSq()>0)desired.setLength(current);
        this.velocity.lerp(desired,1-Math.exp(-PLAYER.AIR_CONTROL*dt));
      }else this.velocity.multiplyScalar(Math.exp(-PLAYER.AIR_DRAG*dt));
    }

    if(this.jumpRequested&&this.grounded&&active&&this.jumpCooldown<=0&&state.player.stats.stamina>=8&&this.crouchBlend<.42){
      this.vertical=PLAYER.JUMP_SPEED;
      state.player.stats.stamina-=8;
      this.grounded=false;
      this.jumpCooldown=PLAYER.JUMP_COOLDOWN;
      this.landingAge=10;
    }
    this.jumpRequested=false;

    if(this.grounded&&this.vertical<0)this.vertical=-1.2;
    else this.vertical-=PLAYER.GRAVITY*dt;
    this.vertical=Math.max(this.vertical,-32);

    const impactVelocity=this.vertical;
    this.grounded=this.physics.move({x:this.velocity.x*dt,y:this.vertical*dt,z:this.velocity.y*dt});
    if(this.grounded&&this.vertical<0)this.vertical=-1.2;

    if(wasGrounded&&!this.grounded)this.suppressLanding=false;

    if(this.grounded&&!wasGrounded&&impactVelocity<-2.5){
      const impactSpeed=-impactVelocity;
      this.lastLandingSpeed=impactSpeed;
      this.landingKick=THREE.MathUtils.clamp((impactSpeed-2.5)*.011,0,.105);
      this.landingAge=0;
      this.jumpCooldown=Math.max(this.jumpCooldown,.08);
      if(this.suppressLanding)this.suppressLanding=false;
      else this.onLand(impactSpeed);
    }

    this.speed=Math.hypot(this.velocity.x,this.velocity.y);
    state.player.position=this.physics.position();
    state.player.yaw=this.yaw;
    state.player.pitch=this.pitch;

    if(this.grounded&&this.speed>.45){
      this.stepDistance+=this.speed*dt;
      const strideLength=this.crouching?1.55:this.sprinting?2.45:2.02;
      if(this.stepDistance>=strideLength){this.stepDistance%=strideLength;this.onStep(this.speed);}
    }else if(this.speed<.15)this.stepDistance=0;

    this.stride+=this.speed*dt*(this.sprinting?2.08:this.crouching?1.55:1.82);
    const movementAmount=this.grounded?Math.min(this.speed/PLAYER.WALK_SPEED,1.35):0;
    const bob=this.headBob?Math.sin(this.stride*1.15)*movementAmount*.013:0;
    const swayEnabled=this.settings.cameraShake;
    const swayTargetX=swayEnabled?Math.sin(this.stride*.56)*movementAmount*.0065:0;
    const swayTargetY=swayEnabled?Math.abs(Math.cos(this.stride*.56))*movementAmount*.0028:0;
    const swayTargetRoll=swayEnabled?Math.sin(this.stride*.56)*movementAmount*.0027:0;
    this.swayX=THREE.MathUtils.damp(this.swayX,swayTargetX,10,dt);
    this.swayY=THREE.MathUtils.damp(this.swayY,swayTargetY,10,dt);
    this.swayRoll=THREE.MathUtils.damp(this.swayRoll,swayTargetRoll,9,dt);

    let landingOffset=0;
    if(this.landingAge<1.2&&this.settings.cameraShake){
      this.landingAge+=dt;
      landingOffset=-this.landingKick*Math.exp(-this.landingAge*8.5)*Math.cos(this.landingAge*16.5);
    }else this.landingKick=0;

    const p=state.player.position;
    this.previousEye.copy(this.currentEye);
    this.currentEye.set(p.x,p.y+PLAYER.EYE_HEIGHT-this.crouchBlend*PLAYER.CROUCH_EYE_DROP+bob+this.swayY+landingOffset,p.z);
    this.renderCamera(1);
  }

  /** Interpolate position across fixed physics steps; mouse orientation is current each render. */
  renderCamera(alpha:number){
    this.camera.position.lerpVectors(this.previousEye,this.currentEye,THREE.MathUtils.clamp(alpha,0,1));
    if(this.settings.cameraShake&&Math.abs(this.swayX)>.00001){
      yawMovementBasis(this.yaw,this.forward,this.right);
      this.camera.position.addScaledVector(this.right,this.swayX);
    }
    this.camera.rotation.order='YXZ';
    this.camera.rotation.set(this.pitch,this.yaw,this.settings.cameraShake?this.swayRoll:0);
  }

  cameraDebug(){
    const forward=new THREE.Vector3(),right=new THREE.Vector3();cameraMovementBasis(this.camera,forward,right);
    const movement=new THREE.Vector3(),movementRight=new THREE.Vector3();yawMovementBasis(this.yaw,movement,movementRight);
    const position=this.physics.position(),world=this.camera.getWorldPosition(new THREE.Vector3());
    const hierarchy:string[]=[];for(let node:THREE.Object3D|null=this.camera;node;node=node.parent)hierarchy.push(node.name||node.type);
    return {controller:position,world:world.toArray(),local:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),yaw:this.yaw,cameraYaw:this.camera.rotation.y,pitch:this.camera.rotation.x,roll:this.camera.rotation.z,forward:forward.toArray(),movementForward:movement.toArray(),velocity:[this.velocity.x,0,this.velocity.y],angle:THREE.MathUtils.radToDeg(forward.angleTo(movement)),hierarchy,bodyRotation:this.physics.body.rotation(),horizontalEyeOffset:Math.hypot(world.x-position.x,world.z-position.z),fov:this.camera.fov,aspect:this.camera.aspect,autoRun:this.autoRun,crouching:this.crouching,jumpCooldown:this.jumpCooldown};
  }
  debugText(){const d=this.cameraDebug(),v=(a:number[])=>a.map(n=>n.toFixed(3)).join(', ');return `CAMERA BASIS\nEYES ${v(d.world)}\nLOCAL ${v(d.local)}\nYAW ${d.yaw.toFixed(3)} / CAMERA ${d.cameraYaw.toFixed(3)}\nPITCH ${d.pitch.toFixed(3)} ROLL ${d.roll.toFixed(3)}\nQUAT ${v(d.quaternion)}\nCAM FWD ${v(d.forward)}\nMOVE FWD ${v(d.movementForward)}\nANGLE ${d.angle.toFixed(5)}°\nVELOCITY ${v(d.velocity)}\nEYE XZ OFFSET ${d.horizontalEyeOffset.toFixed(4)} m\nFOV V ${d.fov.toFixed(2)} ASPECT ${d.aspect.toFixed(3)}\nAUTO-RUN ${d.autoRun?'ON':'OFF'}  CROUCH ${d.crouching?'ON':'OFF'}\n${d.hierarchy.join(' ← ')}`;}
  teleport(p:Vec3,suppressLanding=true){this.physics.teleport(p);this.vertical=0;this.velocity.set(0,0);this.targetVelocity.set(0,0);this.grounded=false;this.landingKick=0;this.landingAge=10;this.suppressLanding=suppressLanding;this.currentEye.set(p.x,p.y+PLAYER.EYE_HEIGHT-this.crouchBlend*PLAYER.CROUCH_EYE_DROP,p.z);this.previousEye.copy(this.currentEye);this.renderCamera(1);}
  resetForRespawn(p:Vec3){
    this.autoRun=false;this.sprinting=false;this.crouching=false;this.grounded=false;this.jumpRequested=false;this.jumpCooldown=0;this.crouchBlend=0;this.stride=0;this.stepDistance=0;this.swayX=this.swayY=this.swayRoll=0;this.speed=0;this.teleport(p);
  }
}
