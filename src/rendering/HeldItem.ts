import * as THREE from 'three';
import {rockGeometry} from '../world/models';
import {flameMaterial} from './Flame';
import type {ItemId} from '../core/types';
import {woodMaterial,stoneMaterial} from './materials';

const smoothPalm=(y:number)=>Math.max(0,1-Math.abs(y-.25));
const hiddenItems:ItemId[]=['wood','stone','metal','ore','fiber','campfire','storage','furnace','bedroll','workbench1','workbench2','workbench3'];

export class HeldItem {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(50,1,.01,5);
  private hand=new THREE.Group();
  private active:ItemId|null=null;
  private pending:ItemId|null|undefined=undefined;
  private swing=0;
  private recoil=0;
  private inspectTime=0;
  private t=0;
  private equip=0;
  private unequip=0;
  private sprintBlend=0;
  private crouchBlend=0;
  private lookSway=new THREE.Vector2();
  private lookTarget=new THREE.Vector2();
  private aspectOffset=0;
  private flameOuter:THREE.Mesh|null=null;
  private flameInner:THREE.Mesh|null=null;

  private skin=new THREE.MeshStandardMaterial({color:'#d0c4b3',roughness:.86});
  private sleeve=new THREE.MeshStandardMaterial({color:'#555b4c',roughness:1});
  private wood=woodMaterial('#665238');
  private stone=stoneMaterial();
  private metal=new THREE.MeshStandardMaterial({color:'#6d726f',roughness:.8,metalness:.25});
  private wrap=new THREE.MeshStandardMaterial({color:'#5c5141',roughness:1});

  constructor(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#817768';ctx.fillRect(0,0,128,128);
    for(let i=0;i<128;i++){ctx.strokeStyle=i%2?'rgba(30,26,21,.12)':'rgba(217,199,167,.12)';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;this.skin.map=tex;this.skin.bumpMap=tex;this.skin.bumpScale=.001;
    this.hand.scale.setScalar(.70);
    this.scene.add(new THREE.HemisphereLight('#fff1d3','#434b48',2.4));
    const sun=new THREE.DirectionalLight('#fff3d9',2.2);sun.position.set(-2,4,1);this.scene.add(sun,this.hand);
    this.build(null);
  }

  private mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=this.hand){
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.frustumCulled=false;o.renderOrder=100;parent.add(o);return o;
  }

  private clearHand(){
    const shared=[this.skin,this.sleeve,this.wood,this.stone,this.metal,this.wrap];
    this.hand.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(!shared.includes(material as THREE.MeshStandardMaterial))material.dispose();});
    this.hand.clear();this.flameOuter=null;this.flameInner=null;
  }

  private addArm(side:1|-1,x:number,y:number,z:number,rotationZ:number,compact=false){
    const forearm=this.mesh(new THREE.CylinderGeometry(.058,.086,.48,16,8),this.sleeve,x-side*.015,y-.27,z+.16);forearm.rotation.x=-.50;forearm.rotation.z=rotationZ;
    const cuff=this.mesh(new THREE.CylinderGeometry(.063,.069,.068,16),this.sleeve,x,y-.065,z+.045);cuff.rotation.x=-.5;cuff.rotation.z=rotationZ*.45;
    const palmGeometry=new THREE.SphereGeometry(1,24,16),palmPosition=palmGeometry.getAttribute('position');
    for(let i=0;i<palmPosition.count;i++){const py=palmPosition.getY(i),px=palmPosition.getX(i);const taper=.82+.18*smoothPalm(py);palmPosition.setXYZ(i,px*.065*taper,py*.089-.025,palmPosition.getZ(i)*.043*(1-.16*py)+.008*px*side);}
    palmGeometry.computeVertexNormals();const palm=this.mesh(palmGeometry,this.skin,x,y,z);palm.rotation.z=rotationZ;
    const fingerLength=compact?.068:.084;
    for(let i=0;i<4;i++){
      const fx=x+side*(-.046+i*.029),fy=y-.012-i*.012,fz=z-.046;
      const finger=this.mesh(new THREE.CapsuleGeometry(.012,fingerLength,4,8),this.skin,fx,fy,fz);finger.rotation.x=Math.PI/2.35;finger.rotation.z=rotationZ*.35;
    }
    const thumb=this.mesh(new THREE.CapsuleGeometry(.015,.065,4,8),this.skin,x-side*.061,y-.015,z-.018);thumb.rotation.x=Math.PI/2.5;thumb.rotation.z=side*.72;
  }

  private build(item:ItemId|null){
    this.clearHand();this.active=item;this.pending=undefined;this.unequip=0;this.equip=1;
    // The right hand is always present. Empty/resource slots therefore still feel
    // like a first-person body instead of a floating camera.
    this.addArm(1,.29,-.045,-.597,-.13);
    if(!item||hiddenItems.includes(item)){this.addArm(-1,-.28,-.09,-.54,.16,true);return;}

    if(item==='rock'){
      const r=this.mesh(rockGeometry(492),this.stone,.24,-.09,-.65);r.scale.set(.17,.12,.18);r.rotation.set(.5,.3,.2);
      this.addArm(-1,-.15,-.12,-.59,.25,true);
    }else if(item==='hatchet'||item==='pickaxe'||item==='torch'){
      const handle=this.mesh(new THREE.CylinderGeometry(.028,.043,.54,10),this.wood,.29,.075,-.64);handle.rotation.z=-.18;
      if(item==='hatchet'){
        const shape=new THREE.Shape();shape.moveTo(-.15,-.095);shape.lineTo(.08,-.05);shape.lineTo(.08,.055);shape.lineTo(-.13,.10);shape.quadraticCurveTo(-.19,0,-.15,-.095);
        const head=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}),this.stone,.28,.30,-.665);head.rotation.z=-.12;
        for(let i=0;i<5;i++){const wrap=this.mesh(new THREE.TorusGeometry(.041,.004,5,14),this.wrap,.33,.26+i*.014,-.64);wrap.rotation.x=Math.PI/2;}
      }
      if(item==='pickaxe'){
        const head=this.mesh(new THREE.CylinderGeometry(.019,.037,.36,8),this.metal,.27,.30,-.64);head.rotation.z=1.4;
        this.addArm(-1,-.08,-.18,-.61,.2,true);
      }
      if(item==='torch'){
        const collar=this.mesh(new THREE.CylinderGeometry(.042,.038,.13,12),this.wrap,.335,.33,-.64);collar.rotation.z=-.18;
        for(let i=0;i<7;i++){const ring=this.mesh(new THREE.TorusGeometry(.039,.005,5,16),this.wrap,.329+i*.003,.285+i*.014,-.64);ring.rotation.x=Math.PI/2;ring.rotation.y=-.18;}
        this.flameOuter=this.mesh(new THREE.PlaneGeometry(.19,.29),flameMaterial(),.34,.525,-.65);this.flameOuter.renderOrder=102;
        this.flameInner=this.mesh(new THREE.PlaneGeometry(.11,.22),flameMaterial(),.345,.48,-.635);this.flameInner.renderOrder=103;
      }
    }else if(item==='plan'){
      const paper=new THREE.MeshStandardMaterial({color:'#638b97',roughness:1,side:THREE.DoubleSide});const plane=this.mesh(new THREE.BoxGeometry(.37,.28,.009),paper,.05,-.055,-.66);plane.rotation.set(-.4,0,-.04);
      for(let i=0;i<4;i++){const line=this.mesh(new THREE.BoxGeometry(.29,.004,.003),new THREE.MeshBasicMaterial({color:'#c6d5ca'}),.05,-.11+i*.045,-.641);line.rotation.z=-.04;}
      this.addArm(-1,-.18,-.055,-.61,.12,true);
    }else if(item==='berries'){
      for(let i=0;i<7;i++)this.mesh(new THREE.SphereGeometry(.022,8,6),new THREE.MeshStandardMaterial({color:'#954443',roughness:.6}),.23+(i%3)*.03,-.02-Math.floor(i/3)*.023,-.64);
    }else this.mesh(new THREE.CylinderGeometry(.065,.06,.18,10),item==='bandage'?new THREE.MeshStandardMaterial({color:'#ccc4a4'}):this.metal,.27,-.02,-.63);
  }

  set(item:ItemId|null){
    if(item===this.active&&this.pending===undefined)return;
    if(this.hand.children.length&&this.active!==item){this.pending=item;this.unequip=1;this.inspectTime=0;return;}
    this.build(item);
  }

  setFov(value:number){this.camera.fov=THREE.MathUtils.clamp(value,40,75);this.camera.updateProjectionMatrix();}

  /** Start the item's primary action. Each tool has a different weight/arc. */
  hit(){if(this.unequip>0)return;this.swing=1;this.inspectTime=0;}
  /** Contact recoil is separate from the pre-contact swing so hits feel physical. */
  impact(){this.recoil=1;}
  inspect(){if(this.hand.children.length&&this.unequip<=0){this.inspectTime=1.35;this.swing=0;}}
  look(dx:number,dy:number){
    this.lookTarget.x=THREE.MathUtils.clamp(this.lookTarget.x-dx*.000075,-.045,.045);
    this.lookTarget.y=THREE.MathUtils.clamp(this.lookTarget.y-dy*.00006,-.035,.035);
  }

  update(dt:number,speed:number,sprinting=false,crouching=false){
    this.t+=dt;
    if(this.unequip>0){this.unequip=Math.max(0,this.unequip-dt*5.8);if(this.unequip===0&&this.pending!==undefined)this.build(this.pending);}
    this.equip=Math.max(0,this.equip-dt*5.2);
    const swingRate=this.active==='pickaxe'?2.65:this.active==='hatchet'?3.15:this.active==='rock'?3.55:4.1;
    this.swing=Math.max(0,this.swing-dt*swingRate);
    this.recoil=Math.max(0,this.recoil-dt*7.8);
    this.inspectTime=Math.max(0,this.inspectTime-dt);
    this.sprintBlend=THREE.MathUtils.damp(this.sprintBlend,sprinting?1:0,9,dt);
    this.crouchBlend=THREE.MathUtils.damp(this.crouchBlend,crouching?1:0,8,dt);
    this.lookSway.lerp(this.lookTarget,1-Math.exp(-dt*18));
    this.lookTarget.multiplyScalar(Math.exp(-dt*13));

    const action=1-this.swing;
    const envelope=this.swing>0?Math.sin(action*Math.PI):0;
    let swingPitch=0,swingYaw=0,swingRoll=0,swingX=0,swingY=0,swingZ=0;
    if(this.active==='hatchet'){
      swingPitch=-envelope*.72;swingYaw=envelope*.16;swingRoll=-envelope*.42;swingX=-envelope*.075;swingY=envelope*.035;swingZ=-envelope*.10;
    }else if(this.active==='pickaxe'){
      swingPitch=-envelope*.96;swingYaw=envelope*.08;swingRoll=-envelope*.24;swingX=-envelope*.045;swingY=envelope*.055;swingZ=-envelope*.135;
    }else if(this.active==='rock'){
      swingPitch=-envelope*.46;swingYaw=envelope*.24;swingRoll=-envelope*.18;swingX=-envelope*.095;swingY=envelope*.025;swingZ=-envelope*.11;
    }else{
      swingPitch=-envelope*.28;swingYaw=envelope*.12;swingRoll=-envelope*.14;swingX=-envelope*.045;swingY=envelope*.02;swingZ=-envelope*.055;
    }

    const moving=Math.min(speed,7.1),walkAmount=Math.min(1,moving/4.4);
    const idleTorch=this.active==='torch'?Math.sin(this.t*1.7)*.012:0;
    const walkX=Math.sin(this.t*(6.1+moving*.42))*walkAmount*.008;
    const walkY=Math.abs(Math.cos(this.t*(6.4+moving*.45)))*walkAmount*.006;
    const inspectPhase=this.inspectTime>0?(1.35-this.inspectTime)/1.35:0;
    const inspectEnvelope=this.inspectTime>0?Math.sin(inspectPhase*Math.PI):0;
    const recoilCurve=this.recoil>0?Math.sin(this.recoil*Math.PI):0;
    const oldItemDrop=this.unequip>0?(1-this.unequip)*.24:0;
    const transitionDrop=this.equip*.22+oldItemDrop;

    this.hand.rotation.set(
      swingPitch+this.lookSway.y*.9+inspectEnvelope*.14+this.sprintBlend*.10-recoilCurve*.12,
      swingYaw-this.lookSway.x*.75-inspectEnvelope*.52,
      swingRoll+this.lookSway.x*.55+inspectEnvelope*.18-this.sprintBlend*.13
    );
    this.hand.position.set(
      .10+this.aspectOffset+walkX+swingX+this.lookSway.x*.7-inspectEnvelope*.075,
      -.24+walkY+swingY+idleTorch-transitionDrop-this.sprintBlend*.075-this.crouchBlend*.025+inspectEnvelope*.06,
      -.38+swingZ+this.lookSway.y*.48+this.sprintBlend*.025+recoilCurve*.075+inspectEnvelope*.035
    );

    if(this.flameOuter)(this.flameOuter.material as THREE.ShaderMaterial).uniforms.time.value=this.t;
    if(this.flameInner)(this.flameInner.material as THREE.ShaderMaterial).uniforms.time.value=this.t*1.23+19.;
  }

  resize(w:number,h:number){this.camera.aspect=w/Math.max(h,1);this.aspectOffset=(this.camera.aspect/(16/9)-1)*.31;this.camera.updateProjectionMatrix();}
  diagnostics(){
    this.hand.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();
    const anchor=new THREE.Vector3(.29,-.07,-.597).applyMatrix4(this.hand.matrixWorld).project(this.camera);
    const bounds=new THREE.Box3().setFromObject(this.hand);let transparentDepthWrites=0;
    this.hand.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.transparent&&m.depthWrite)transparentDepthWrites++;}});
    return {active:this.active,handMatrix:this.hand.matrixWorld.toArray(),anchor:anchor.toArray(),nearestDepth:-bounds.max.z,transparentDepthWrites,swing:this.swing,recoil:this.recoil,inspect:this.inspectTime,sprintPose:this.sprintBlend};
  }
  render(renderer:THREE.WebGLRenderer){
    if(!this.hand.children.length)return;
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.clearDepth();renderer.render(this.scene,this.camera);}finally{renderer.autoClear=autoClear;}
  }
}
