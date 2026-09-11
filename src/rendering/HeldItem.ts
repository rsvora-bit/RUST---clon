import * as THREE from 'three';
import {rockGeometry} from '../world/models';
import {flameMaterial} from './Flame';
const smoothPalm=(y:number)=>Math.max(0,1-Math.abs(y-.25));
import type {ItemId} from '../core/types';
import {woodMaterial,stoneMaterial} from './materials';
export class HeldItem {
  readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(50,1,.01,5);private hand=new THREE.Group();private active:ItemId|null=null;private swing=0;private t=0;private equip=0;private aspectOffset=0;
  private flameOuter:THREE.Mesh|null=null;private flameInner:THREE.Mesh|null=null;
  private skin=new THREE.MeshStandardMaterial({color:'#918477',roughness:.85});private sleeve=new THREE.MeshStandardMaterial({color:'#555b4c',roughness:1});private wood=woodMaterial('#665238');private stone=stoneMaterial();private metal=new THREE.MeshStandardMaterial({color:'#6d726f',roughness:.8,metalness:.25});private wrap=new THREE.MeshStandardMaterial({color:'#5c5141',roughness:1});
  constructor(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#817768';ctx.fillRect(0,0,128,128);
    for(let i=0;i<128;i++){ctx.strokeStyle=i%2?'rgba(30,26,21,.12)':'rgba(217,199,167,.12)';ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;this.skin.map=tex;this.skin.bumpMap=tex;this.skin.bumpScale=.001;this.skin.color.set('#d0c4b3');
    this.hand.scale.setScalar(.70);this.scene.add(new THREE.HemisphereLight('#fff1d3','#434b48',2.4));const sun=new THREE.DirectionalLight('#fff3d9',2.2);sun.position.set(-2,4,1);this.scene.add(sun,this.hand);}
  private mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number){
    // The world depth is cleared once before this pass. Preserve each material's
    // local depth policy: opaque tools self-occlude, transparent fire never writes depth.
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.frustumCulled=false;o.renderOrder=100;this.hand.add(o);return o;
  }
  private clearHand(){
    const shared=[this.skin,this.sleeve,this.wood,this.stone,this.metal,this.wrap];
    this.hand.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(!shared.includes(material as THREE.MeshStandardMaterial))material.dispose();});
    this.hand.clear();
  }
  set(item:ItemId|null){if(item===this.active)return;this.active=item;this.flameOuter=null;this.flameInner=null;this.clearHand();if(!item||['wood','stone','metal','ore','fiber','campfire','storage','furnace','bedroll','workbench1','workbench2','workbench3'].includes(item))return;
    this.equip=1;
    // A tapered cloth forearm and closed, articulated work-glove grip.
    const forearm=this.mesh(new THREE.CylinderGeometry(.058,.086,.48,16,8),this.sleeve,.30,-.34,-.43);forearm.rotation.x=-.50;forearm.rotation.z=-.12;
    const cuff=this.mesh(new THREE.CylinderGeometry(.063,.069,.068,16),this.sleeve,.29,-.14,-.55);cuff.rotation.x=-.5;
    const palmGeometry=new THREE.SphereGeometry(1,24,16),palmPosition=palmGeometry.getAttribute('position');
    for(let i=0;i<palmPosition.count;i++){const y=palmPosition.getY(i),x=palmPosition.getX(i);const taper=.82+.18*smoothPalm(y);palmPosition.setXYZ(i,x*.065*taper,y*.089-.025,palmPosition.getZ(i)*.043*(1-.16*y)+.008*x);}
    palmGeometry.computeVertexNormals();const palm=this.mesh(palmGeometry,this.skin,.29,-.045,-.597);palm.rotation.z=-.13;
    const seam=new THREE.MeshStandardMaterial({color:'#4b4439',roughness:1});
    for(const x of [.258,.30,.337]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-.105,-.561),new THREE.Vector3(x-.004,-.043,-.561),new THREE.Vector3(x-.003,.004,-.57)]);this.mesh(new THREE.TubeGeometry(curve,8,.0012,4,false),seam,0,0,0);}
    for(let i=0;i<4;i++){
      const y=-.012-i*.038;
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.24,y,-.59),new THREE.Vector3(.245,y+.012,-.655),new THREE.Vector3(.29,y+.01,-.678),new THREE.Vector3(.334,y-.002,-.655)]);
      this.mesh(new THREE.TubeGeometry(curve,12,.017-i*.001,8,false),this.skin,0,0,0);
    }
    const thumbCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.246,-.09,-.574),new THREE.Vector3(.211,-.04,-.577),new THREE.Vector3(.22,.006,-.618),new THREE.Vector3(.259,.015,-.647)]);
    this.mesh(new THREE.TubeGeometry(thumbCurve,14,.023,10,false),this.skin,0,0,0);
    if(item==='rock'){const r=this.mesh(rockGeometry(492),this.stone,.24,-.09,-.65);r.scale.set(.17,.12,.18);r.rotation.set(.5,.3,.2);}
    else if(item==='hatchet'||item==='pickaxe'||item==='torch'){
      const handle=this.mesh(new THREE.CylinderGeometry(.028,.043,.54,10),this.wood,.29,.075,-.64);handle.rotation.z=-.18;
      if(item==='hatchet'){const shape=new THREE.Shape();shape.moveTo(-.15,-.095);shape.lineTo(.08,-.05);shape.lineTo(.08,.055);shape.lineTo(-.13,.10);shape.quadraticCurveTo(-.19,0,-.15,-.095);const head=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}),this.stone,.28,.30,-.665);head.rotation.z=-.12;for(let i=0;i<5;i++){const wrap=this.mesh(new THREE.TorusGeometry(.041,.004,5,14),this.wrap,.33,.26+i*.014,-.64);wrap.rotation.x=Math.PI/2;}}
      if(item==='pickaxe'){const head=this.mesh(new THREE.CylinderGeometry(.019,.037,.36,8),this.metal,.27,.30,-.64);head.rotation.z=1.4;}
      if(item==='torch'){
        const collar=this.mesh(new THREE.CylinderGeometry(.042,.038,.13,12),this.wrap,.335,.33,-.64);collar.rotation.z=-.18;
        for(let i=0;i<7;i++){const ring=this.mesh(new THREE.TorusGeometry(.039,.005,5,16),this.wrap,.329+i*.003,.285+i*.014,-.64);ring.rotation.x=Math.PI/2;ring.rotation.y=-.18;}
        this.flameOuter=this.mesh(new THREE.PlaneGeometry(.19,.29),flameMaterial(),.34,.525,-.65);
        this.flameOuter.renderOrder=102;
        this.flameInner=this.mesh(new THREE.PlaneGeometry(.11,.22),flameMaterial(),.345,.48,-.635);this.flameInner.renderOrder=103;

      }
    } else if(item==='plan'){
      const paper=new THREE.MeshStandardMaterial({color:'#638b97',roughness:1,side:THREE.DoubleSide});const plane=this.mesh(new THREE.BoxGeometry(.37,.28,.009),paper,.17,-.065,-.66);plane.rotation.set(-.4,0,-.14);
      for(let i=0;i<4;i++){const line=this.mesh(new THREE.BoxGeometry(.29,.004,.003),new THREE.MeshBasicMaterial({color:'#c6d5ca'}),.17,-.11+i*.045,-.641);line.rotation.z=-.14;}
    } else if(item==='berries'){for(let i=0;i<7;i++)this.mesh(new THREE.SphereGeometry(.022,8,6),new THREE.MeshStandardMaterial({color:'#954443',roughness:.6}),.23+(i%3)*.03,-.02-Math.floor(i/3)*.023,-.64);}
    else this.mesh(new THREE.CylinderGeometry(.065,.06,.18,10),item==='bandage'?new THREE.MeshStandardMaterial({color:'#ccc4a4'}):this.metal,.27,-.02,-.63);
  }
  setFov(value:number){this.camera.fov=THREE.MathUtils.clamp(value,40,75);this.camera.updateProjectionMatrix();}
  hit(){this.swing=1;}
  update(dt:number,speed:number){
    this.t+=dt;this.swing=Math.max(0,this.swing-dt*3.8);this.equip=Math.max(0,this.equip-dt*5);
    const strike=Math.sin(this.swing*Math.PI),moving=Math.min(speed,7),sprint=Math.max(0,speed-4.4)/2.7;
    this.hand.rotation.set(-strike*.42+sprint*.08,strike*.18,-strike*.24-sprint*.1);
    this.hand.position.set(.10+this.aspectOffset+Math.sin(this.t*7)*moving*.002-strike*.08,-.24+Math.cos(this.t*8)*moving*.0015+strike*.035-this.equip*.18-sprint*.045,-.38-strike*.08);
    if(this.flameOuter)(this.flameOuter.material as THREE.ShaderMaterial).uniforms.time.value=this.t;
    if(this.flameInner)(this.flameInner.material as THREE.ShaderMaterial).uniforms.time.value=this.t*1.23+19.;
  }
  resize(w:number,h:number){this.camera.aspect=w/Math.max(h,1);this.aspectOffset=(this.camera.aspect/(16/9)-1)*.31;this.camera.updateProjectionMatrix();}
  diagnostics(){
    this.hand.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();
    const anchor=new THREE.Vector3(.29,-.07,-.597).applyMatrix4(this.hand.matrixWorld).project(this.camera);
    const bounds=new THREE.Box3().setFromObject(this.hand);let transparentDepthWrites=0;
    this.hand.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.transparent&&m.depthWrite)transparentDepthWrites++;}});
    return {active:this.active,handMatrix:this.hand.matrixWorld.toArray(),anchor:anchor.toArray(),nearestDepth:-bounds.max.z,transparentDepthWrites};
  }
  render(renderer:THREE.WebGLRenderer){
    if(!this.active)return;
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.clearDepth();renderer.render(this.scene,this.camera);}finally{renderer.autoClear=autoClear;}
  }
}
