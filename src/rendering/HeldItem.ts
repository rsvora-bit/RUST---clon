import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rockGeometry} from '../world/models';
import {flameMaterial} from './Flame';
import type {ItemId} from '../core/types';
import {woodMaterial,stoneMaterial} from './materials';

const smoothPalm=(y:number)=>Math.max(0,1-Math.abs(y-.25));
const hiddenItems:ItemId[]=['wood','stone','metal','ore','fiber','scrap','gears','wiring','machineParts','techParts','pistolAmmo','shotgunShells','campfire','storage','furnace','bedroll','workbench1','workbench2','workbench3','generator','powerSwitch','lamp'];

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
  private bowString:THREE.Mesh|null=null;
  private bowArrow:THREE.Group|null=null;
  private bowDraw=0;
  private reloadProgress=0;
  private muzzleFlash:THREE.Mesh|null=null;
  private muzzleFlashTime=0;

  private skin=new THREE.MeshStandardMaterial({color:'#d0c4b3',roughness:.86});
  private sleeve=new THREE.MeshStandardMaterial({color:'#555b4c',roughness:1});
  private glove=new THREE.MeshStandardMaterial({color:'#39413c',roughness:.98});
  private gloveWear=new THREE.MeshStandardMaterial({color:'#71684f',roughness:1});
  private wood=woodMaterial('#665238');
  private stone=stoneMaterial();
  private metal=new THREE.MeshStandardMaterial({color:'#6d726f',roughness:.8,metalness:.25});
  private shellCasing=new THREE.MeshStandardMaterial({color:'#a04d34',roughness:.78,metalness:.08});
  private brass=new THREE.MeshStandardMaterial({color:'#a88a4b',roughness:.56,metalness:.38});
  private rust=new THREE.MeshStandardMaterial({color:'#895d43',roughness:.91,metalness:.12});
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
    const shared=[this.skin,this.sleeve,this.glove,this.gloveWear,this.wood,this.stone,this.metal,this.shellCasing,this.brass,this.wrap,this.rust];
    this.hand.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials)if(!shared.includes(material as THREE.MeshStandardMaterial))material.dispose();});
    this.hand.clear();this.flameOuter=null;this.flameInner=null;this.bowString=null;this.bowArrow=null;this.muzzleFlash=null;this.muzzleFlashTime=0;
  }

  private addArm(side:1|-1,x:number,y:number,z:number,rotationZ:number,compact=false){
    const forearm=this.mesh(new THREE.CylinderGeometry(.058,.086,.48,16,8),this.sleeve,x-side*.015,y-.27,z+.16);forearm.rotation.x=-.50;forearm.rotation.z=rotationZ;
    const cuff=this.mesh(new THREE.CylinderGeometry(.063,.069,.068,16),this.sleeve,x,y-.065,z+.045);cuff.rotation.x=-.5;cuff.rotation.z=rotationZ*.45;
    const palmGeometry=new THREE.SphereGeometry(1,24,16),palmPosition=palmGeometry.getAttribute('position');
    for(let i=0;i<palmPosition.count;i++){const py=palmPosition.getY(i),px=palmPosition.getX(i);const taper=.82+.18*smoothPalm(py);palmPosition.setXYZ(i,px*.065*taper,py*.089-.025,palmPosition.getZ(i)*.043*(1-.16*py)+.008*px*side);}
    palmGeometry.computeVertexNormals();const palm=this.mesh(palmGeometry,this.glove,x,y,z);palm.rotation.z=rotationZ;
    // A worn fingerless work glove adds a readable material break on the back
    // of the hand without changing the held-item grip or its action transforms.
    const backPlate=this.mesh(new THREE.BoxGeometry(.092,.026,.018),this.glove,x,y+.047,z-.018);backPlate.rotation.z=rotationZ;
    for(let i=0;i<3;i++){const knuckle=this.mesh(new THREE.SphereGeometry(.012,8,6),this.gloveWear,x+side*(-.025+i*.025),y+.054,z-.033);knuckle.scale.set(1,.75,.65);}
    const wristWrap=this.mesh(new THREE.TorusGeometry(.066,.007,5,14),this.gloveWear,x,y-.035,z+.035);wristWrap.rotation.z=rotationZ;
    const fingerLength=compact?.068:.084;
    for(let i=0;i<4;i++){
      const fx=x+side*(-.046+i*.029),fy=y-.012-i*.012,fz=z-.046;
      const finger=this.mesh(new THREE.CapsuleGeometry(.012,fingerLength*.72,4,8),this.glove,fx,fy,fz+.008);finger.rotation.x=Math.PI/2.35;finger.rotation.z=rotationZ*.35;
      this.mesh(new THREE.SphereGeometry(.011,8,6),this.skin,fx,fy-.006,fz-fingerLength*.40);
    }
    const thumb=this.mesh(new THREE.CapsuleGeometry(.015,.047,4,8),this.glove,x-side*.061,y-.015,z-.012);thumb.rotation.x=Math.PI/2.5;thumb.rotation.z=side*.72;
    this.mesh(new THREE.SphereGeometry(.014,8,6),this.skin,x-side*.067,y-.020,z-.052);
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
    }else if(item==='hatchet'||item==='pickaxe'||item==='hammer'||item==='torch'){
      const handle=this.mesh(new THREE.CylinderGeometry(.028,.043,.54,10),this.wood,.29,.075,-.64);handle.rotation.z=-.18;
      if(item==='hatchet'){
        const shape=new THREE.Shape();shape.moveTo(-.15,-.095);shape.lineTo(.08,-.05);shape.lineTo(.08,.055);shape.lineTo(-.13,.10);shape.quadraticCurveTo(-.19,0,-.15,-.095);
        const head=this.mesh(new THREE.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}),this.stone,.28,.30,-.665);head.rotation.z=-.12;
        for(let i=0;i<5;i++){const wrap=this.mesh(new THREE.TorusGeometry(.041,.004,5,14),this.wrap,.33,.26+i*.014,-.64);wrap.rotation.x=Math.PI/2;}
      }
      if(item==='pickaxe'){
        const headShape=new THREE.Shape();headShape.moveTo(-.225,-.012);headShape.lineTo(-.135,-.046);headShape.lineTo(-.075,-.058);headShape.lineTo(.085,-.051);headShape.lineTo(.135,-.027);headShape.lineTo(.275,0);headShape.lineTo(.135,.027);headShape.lineTo(.085,.051);headShape.lineTo(-.075,.058);headShape.lineTo(-.135,.046);headShape.closePath();const headGeometry=new THREE.ExtrudeGeometry(headShape,{depth:.07,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.007,bevelThickness:.006});headGeometry.translate(0,0,-.035);const steel=new THREE.MeshStandardMaterial({color:'#999b90',roughness:.78,metalness:.16}),head=this.mesh(headGeometry,steel,.27,.30,-.64);head.rotation.z=-.08;
        this.addArm(-1,-.08,-.18,-.61,.2,true);
      }
      if(item==='hammer'){
        const head=this.mesh(new THREE.BoxGeometry(.31,.115,.12,3,2,2),this.metal,.28,.31,-.64);head.rotation.z=-.17;
        const face=this.mesh(new THREE.CylinderGeometry(.068,.068,.075,12),this.metal,.12,.34,-.64);face.rotation.z=Math.PI/2-.17;
        const clawShape=new THREE.Shape();clawShape.moveTo(0,-.055);clawShape.lineTo(.17,-.09);clawShape.lineTo(.14,-.02);clawShape.lineTo(.17,.07);clawShape.lineTo(0,.055);
        const claw=this.mesh(new THREE.ExtrudeGeometry(clawShape,{depth:.045,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1}),this.metal,.37,.31,-.665);claw.rotation.z=-.17;
        for(let i=0;i<5;i++){const wrap=this.mesh(new THREE.TorusGeometry(.037,.004,5,14),this.wrap,.34,.08+i*.014,-.64);wrap.rotation.x=Math.PI/2;}
        this.addArm(-1,-.08,-.18,-.61,.2,true);
      }
      if(item==='torch'){
        const collar=this.mesh(new THREE.CylinderGeometry(.042,.038,.13,12),this.wrap,.335,.33,-.64);collar.rotation.z=-.18;
        for(let i=0;i<7;i++){const ring=this.mesh(new THREE.TorusGeometry(.039,.005,5,16),this.wrap,.329+i*.003,.285+i*.014,-.64);ring.rotation.x=Math.PI/2;ring.rotation.y=-.18;}
        this.flameOuter=this.mesh(new THREE.PlaneGeometry(.19,.29),flameMaterial(),.34,.525,-.65);this.flameOuter.renderOrder=102;
        this.flameInner=this.mesh(new THREE.PlaneGeometry(.11,.22),flameMaterial(),.345,.48,-.635);this.flameInner.renderOrder=103;
      }
    }else if(item==='spear'){
      const haft=this.mesh(new THREE.CylinderGeometry(.018,.027,.92,9),this.wood,.27,.10,-.66);haft.rotation.z=-.16;
      const point=this.mesh(new THREE.ConeGeometry(.062,.24,6),this.metal,.27,.66,-.68);point.rotation.z=-.16;
      const socket=this.mesh(new THREE.CylinderGeometry(.038,.034,.10,8),this.wrap,.27,.51,-.665);socket.rotation.z=-.16;
      for(let i=0;i<4;i++){const band=this.mesh(new THREE.TorusGeometry(.029,.003,5,12),this.wrap,.283,.03+i*.018,-.655);band.rotation.x=Math.PI/2;}
      this.addArm(-1,-.08,-.17,-.61,.18,true);
    }else if(item==='docksideCleaver'){
      const grip=this.mesh(new THREE.CylinderGeometry(.024,.034,.35,10),this.wrap,.28,-.005,-.64);grip.rotation.z=-.16;
      const tang=this.mesh(new THREE.BoxGeometry(.045,.20,.035),this.metal,.28,.255,-.64);tang.rotation.z=-.12;
      const edge=new THREE.Shape();edge.moveTo(-.025,-.08);edge.lineTo(.095,-.20);edge.lineTo(.19,-.28);edge.lineTo(.27,-.29);edge.lineTo(.30,-.23);edge.lineTo(.235,-.11);edge.lineTo(.15,.04);edge.lineTo(.065,.18);edge.lineTo(-.015,.15);edge.closePath();
      this.mesh(new THREE.ExtrudeGeometry(edge,{depth:.035,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2,steps:1}),this.metal,.27,.30,-.66).rotation.z=-.10;
      const edgeMaterial=new THREE.MeshStandardMaterial({color:'#b9b6a3',roughness:.42,metalness:.58});this.mesh(new THREE.BoxGeometry(.018,.34,.008),edgeMaterial,.442,.285,-.615).rotation.z=-.48;
      for(let i=0;i<4;i++){const wrap=this.mesh(new THREE.TorusGeometry(.031,.004,5,14),this.wrap,.28,-.11+i*.035,-.64);wrap.rotation.x=Math.PI/2;}
      this.addArm(-1,-.09,-.16,-.61,.20,true);
    }else if(item==='quarryMaul'){
      const haft=this.mesh(new THREE.CylinderGeometry(.027,.036,.82,10),this.wood,.27,.10,-.65);haft.rotation.z=-.18;
      const grip=this.mesh(new THREE.CylinderGeometry(.039,.043,.24,10),this.wrap,.27,-.18,-.645);grip.rotation.z=-.18;
      for(const y of [-.215,-.155]){const band=this.mesh(new THREE.TorusGeometry(.041,.004,5,14),this.rust,.27,y,-.645);band.rotation.x=Math.PI/2;band.rotation.z=-.18;}

      // A compact forged head with clipped corners and salvage-steel face plates.
      // Keep the repeated metal details in one geometry so the model remains cheap.
      const headShape=new THREE.Shape();headShape.moveTo(-.145,-.048);headShape.lineTo(-.119,-.075);headShape.lineTo(.119,-.075);headShape.lineTo(.15,-.043);headShape.lineTo(.15,.043);headShape.lineTo(.119,.075);headShape.lineTo(-.119,.075);headShape.lineTo(-.145,.048);headShape.closePath();
      const core=new THREE.ExtrudeGeometry(headShape,{depth:.145,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008});core.translate(0,0,-.0725);
      const steelParts:THREE.BufferGeometry[]=[core];
      const addSteel=(geometry:THREE.BufferGeometry,x:number,y:number,z:number)=>{geometry.translate(x,y,z);steelParts.push(geometry);};
      addSteel(new THREE.BoxGeometry(.025,.13,.15),.141,0,0);
      for(const x of [-.095,.095])for(const y of [-.045,.045]){const rivet=new THREE.CylinderGeometry(.012,.012,.008,8);rivet.rotateX(Math.PI/2);addSteel(rivet,x,y,.078);}
      const mergeParts=steelParts.map(part=>part.index?part.toNonIndexed():part);
      steelParts.forEach((part,index)=>{if(mergeParts[index]!==part)part.dispose();});
      const steelGeometry=mergeGeometries(mergeParts,false);for(const part of mergeParts)part.dispose();
      if(!steelGeometry)throw new Error('Could not assemble Quarry Maul head geometry');
      const head=this.mesh(steelGeometry,this.metal,.27,.53,-.67);head.rotation.z=-.12;

      const faceShape=new THREE.Shape();faceShape.moveTo(-.073,-.027);faceShape.lineTo(-.059,-.041);faceShape.lineTo(.059,-.041);faceShape.lineTo(.073,-.027);faceShape.lineTo(.073,.027);faceShape.lineTo(.059,.041);faceShape.lineTo(-.059,.041);faceShape.lineTo(-.073,.027);faceShape.closePath();
      const face=this.mesh(new THREE.ShapeGeometry(faceShape),this.wrap,.27,.53,-.584);face.rotation.z=-.12;
      const rustCap=this.mesh(new THREE.BoxGeometry(.035,.13,.15),this.rust,.105,.53,-.67);rustCap.rotation.z=-.12;
      const collar=this.mesh(new THREE.CylinderGeometry(.07,.055,.105,8),this.wrap,.27,.36,-.66);collar.rotation.z=-.18;
      this.addArm(-1,-.10,-.18,-.61,.23,true);
    }else if(item==='salvageRevolver'||item==='fieldShotgun'){
      const weapon=new THREE.Group();weapon.scale.setScalar(.64);weapon.position.set(.10,.02,-.12);this.hand.add(weapon);
      const shotgun=item==='fieldShotgun';if(shotgun){weapon.scale.setScalar(.76);weapon.position.y=.11;}let gripGeometry:THREE.BufferGeometry;if(shotgun)gripGeometry=new THREE.BoxGeometry(.13,.32,.15);else{const gripShape=new THREE.Shape();gripShape.moveTo(-.052,.135);gripShape.lineTo(.052,.135);gripShape.lineTo(.058,.075);gripShape.lineTo(.039,-.09);gripShape.lineTo(.018,-.145);gripShape.lineTo(-.043,-.145);gripShape.lineTo(-.056,-.075);gripShape.closePath();gripGeometry=new THREE.ExtrudeGeometry(gripShape,{depth:.13,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.006});gripGeometry.translate(0,0,-.065);}const grip=this.mesh(gripGeometry,this.wrap,.28,shotgun?-.17:-.12,-.63,weapon);grip.rotation.x=-.18;
      if(shotgun){const stockShape=new THREE.Shape();stockShape.moveTo(-.064,-.09);stockShape.lineTo(.062,-.09);stockShape.lineTo(.078,-.045);stockShape.lineTo(.054,.025);stockShape.lineTo(.046,.091);stockShape.lineTo(-.046,.091);stockShape.lineTo(-.06,.018);stockShape.closePath();const stockGeometry=new THREE.ExtrudeGeometry(stockShape,{depth:.29,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008});stockGeometry.translate(0,0,-.145);const stock=this.mesh(stockGeometry,this.wood,.28,.01,-.54,weapon);stock.rotation.x=-.12;
        const receiverShape=new THREE.Shape();receiverShape.moveTo(-.09,-.045);receiverShape.lineTo(-.068,-.065);receiverShape.lineTo(.064,-.065);receiverShape.lineTo(.09,-.038);receiverShape.lineTo(.09,.038);receiverShape.lineTo(.066,.065);receiverShape.lineTo(-.068,.065);receiverShape.lineTo(-.09,.043);receiverShape.closePath();const receiverGeometry=new THREE.ExtrudeGeometry(receiverShape,{depth:.28,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.006});receiverGeometry.translate(0,0,-.14);const receiver=this.mesh(receiverGeometry,this.metal,.27,.07,-.79,weapon);receiver.rotation.x=-.04;
        // Keep the action plate on the player-facing side of the receiver.
        const sidePlate=this.mesh(new THREE.BoxGeometry(.012,.085,.16),this.rust,.176,.073,-.79,weapon);sidePlate.rotation.x=-.04;const ejectionPort=this.mesh(new THREE.BoxGeometry(.009,.034,.078),this.wrap,.166,.079,-.795,weapon);ejectionPort.rotation.x=-.04;const bolt=this.mesh(new THREE.CylinderGeometry(.018,.018,.026,8),this.metal,.151,.075,-.72,weapon);bolt.rotation.z=Math.PI/2;
        for(let i=0;i<2;i++){const x=.228+i*.084,barrel=this.mesh(new THREE.CylinderGeometry(.028,.031,.47,10),this.metal,x,.08,-1.04,weapon);barrel.rotation.x=Math.PI/2;const muzzle=this.mesh(new THREE.CylinderGeometry(.031,.031,.035,10),this.wrap,x,.08,-1.276,weapon);muzzle.rotation.x=Math.PI/2;}
        const frontSight=this.mesh(new THREE.BoxGeometry(.038,.045,.055),this.rust,.27,.145,-1.205,weapon);frontSight.rotation.x=-.05;const foregrip=this.mesh(new THREE.BoxGeometry(.19,.095,.23),this.wood,.27,.055,-1.05,weapon);foregrip.rotation.x=-.08;
        const shellBodies:THREE.BufferGeometry[]=[],shellBases:THREE.BufferGeometry[]=[];for(let i=0;i<4;i++){const y=-.055+i*.043,body=new THREE.CylinderGeometry(.019,.019,.082,9,1);body.rotateZ(Math.PI/2);body.translate(.382,y,-.54);shellBodies.push(body);const base=new THREE.CylinderGeometry(.020,.020,.012,9,1);base.rotateZ(Math.PI/2);base.translate(.429,y,-.54);shellBases.push(base);}const bodyGeometry=mergeGeometries(shellBodies,false),baseGeometry=mergeGeometries(shellBases,false);shellBodies.forEach(g=>g.dispose());shellBases.forEach(g=>g.dispose());if(!bodyGeometry||!baseGeometry)throw new Error('Could not assemble shotgun stock shells');const shellMesh=this.mesh(bodyGeometry,this.shellCasing,0,0,0,weapon);shellMesh.name='Shotgun stock shell bodies';const brassMesh=this.mesh(baseGeometry,this.brass,0,0,0,weapon);brassMesh.name='Shotgun shell brass bases';const shellStrap=this.mesh(new THREE.BoxGeometry(.017,.197,.047),this.wrap,.407,.01,-.54,weapon);shellStrap.rotation.z=-.025;
        this.addArm(-1,-.13,-.10,-.63,.18,true);
      }else{const frameShape=new THREE.Shape();frameShape.moveTo(-.08,-.045);frameShape.lineTo(-.058,-.063);frameShape.lineTo(.06,-.063);frameShape.lineTo(.08,-.038);frameShape.lineTo(.08,.035);frameShape.lineTo(.056,.063);frameShape.lineTo(-.06,.063);frameShape.lineTo(-.08,.04);frameShape.closePath();const frameGeometry=new THREE.ExtrudeGeometry(frameShape,{depth:.29,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.006,bevelThickness:.006});frameGeometry.translate(0,0,-.145);const frame=this.mesh(frameGeometry,this.metal,.27,.04,-.73,weapon);frame.rotation.x=-.05;
        const sidePlate=this.mesh(new THREE.BoxGeometry(.012,.076,.155),this.rust,.188,.04,-.755,weapon);sidePlate.rotation.x=-.05;const port=this.mesh(new THREE.BoxGeometry(.009,.028,.062),this.wrap,.178,.046,-.755,weapon);port.rotation.x=-.05;
        const barrel=this.mesh(new THREE.CylinderGeometry(.033,.037,.31,12),this.metal,.27,.07,-.96,weapon);barrel.rotation.x=Math.PI/2;const muzzle=this.mesh(new THREE.CylinderGeometry(.038,.038,.035,10),this.wrap,.27,.07,-1.12,weapon);muzzle.rotation.x=Math.PI/2;const cylinder=this.mesh(new THREE.CylinderGeometry(.066,.066,.14,12),this.metal,.27,.035,-.70,weapon);cylinder.rotation.x=Math.PI/2;
        const chamberParts:THREE.BufferGeometry[]=[];for(let i=0;i<6;i++){const angle=i*Math.PI/3,disc=new THREE.CircleGeometry(.012,8);disc.rotateY(-Math.PI/2);disc.translate(-.067,Math.cos(angle)*.044,Math.sin(angle)*.044);chamberParts.push(disc);}const chamberGeometry=mergeGeometries(chamberParts,false);chamberParts.forEach(part=>part.dispose());if(!chamberGeometry)throw new Error('Could not assemble revolver cylinder chambers');this.mesh(chamberGeometry,this.wrap,.27,.035,-.70,weapon);
        const hammer=this.mesh(new THREE.BoxGeometry(.065,.085,.075),this.metal,.27,.15,-.59,weapon);hammer.rotation.x=-.25;const sight=this.mesh(new THREE.BoxGeometry(.035,.035,.045),this.rust,.27,.135,-1.08,weapon);const trigger=this.mesh(new THREE.TorusGeometry(.046,.007,6,14,Math.PI),this.wrap,.27,-.01,-.72,weapon);trigger.rotation.x=Math.PI/2;this.addArm(-1,-.13,-.13,-.59,.18,true);}
      const flashMaterial=new THREE.MeshBasicMaterial({color:shotgun?0xffa94c:0xffd17a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});this.muzzleFlash=this.mesh(new THREE.ConeGeometry(.075,.24,7),flashMaterial,shotgun?.27:.27,.08,shotgun?-1.34:-1.18,weapon);this.muzzleFlash.rotation.x=-Math.PI/2;this.muzzleFlash.renderOrder=104;this.muzzleFlash.visible=false;
    }else if(item==='bow'){
      const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(.05,-.30,0),new THREE.Vector3(.37,.02,-.05),new THREE.Vector3(.05,.34,0));
      this.mesh(new THREE.TubeGeometry(curve,18,.018,8,false),this.wood,.20,.04,-.68);
      const laminate=new THREE.QuadraticBezierCurve3(new THREE.Vector3(.05,-.30,.017),new THREE.Vector3(.345,.02,-.033),new THREE.Vector3(.05,.34,.017));
      this.mesh(new THREE.TubeGeometry(laminate,18,.0045,5,false),this.rust,.20,.04,-.68);
      this.bowString=this.mesh(new THREE.CylinderGeometry(.003,.003,.65,5),this.wrap,.05,.02,-.68);this.bowString.rotation.z=.12;
      const grip=this.mesh(new THREE.CylinderGeometry(.027,.03,.13,8),this.wrap,.17,.02,-.68);grip.rotation.z=-.18;
      for(const y of [-.025,.026]){const wrap=this.mesh(new THREE.TorusGeometry(.031,.004,5,12),this.rust,.17,y,-.68);wrap.rotation.x=Math.PI/2;wrap.rotation.z=-.18;}
      const arrowRest=this.mesh(new THREE.BoxGeometry(.07,.018,.045),this.metal,.235,.018,-.66);arrowRest.rotation.z=-.12;
      this.bowArrow=new THREE.Group();this.bowArrow.position.set(.14,.02,-.71);this.bowArrow.visible=false;this.hand.add(this.bowArrow);
      const shaft=this.mesh(new THREE.CylinderGeometry(.008,.009,.48,5),this.wood,0,0,0,this.bowArrow);shaft.rotation.z=-Math.PI/2;
      const tip=this.mesh(new THREE.ConeGeometry(.018,.07,5),this.metal,.26,0,0,this.bowArrow);tip.rotation.z=-Math.PI/2;
      for(let vane=0;vane<3;vane++){const feather=this.mesh(new THREE.PlaneGeometry(.105,.05),this.wrap,-.165,0,0,this.bowArrow);feather.rotation.set(vane*Math.PI*2/3,0,.08);}
      this.addArm(-1,-.16,-.10,-.61,.21,true);
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
  firearmShot(){if(!this.muzzleFlash||this.unequip>0)return;this.muzzleFlashTime=.09;this.muzzleFlash.visible=true;(this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity=.92;}
  inspect(){if(this.hand.children.length&&this.unequip<=0){this.inspectTime=1.35;this.swing=0;}}
  look(dx:number,dy:number){
    this.lookTarget.x=THREE.MathUtils.clamp(this.lookTarget.x-dx*.000075,-.045,.045);
    this.lookTarget.y=THREE.MathUtils.clamp(this.lookTarget.y-dy*.00006,-.035,.035);
  }

  update(dt:number,speed:number,sprinting=false,crouching=false,bowDraw=0,reloadProgress=0){
    this.t+=dt;
    if(this.unequip>0){this.unequip=Math.max(0,this.unequip-dt*5.8);if(this.unequip===0&&this.pending!==undefined)this.build(this.pending);}
    this.equip=Math.max(0,this.equip-dt*5.2);
    const swingRate=this.active==='quarryMaul'?2.25:this.active==='pickaxe'?2.65:this.active==='hammer'?3.35:this.active==='hatchet'?3.15:this.active==='docksideCleaver'?3.65:this.active==='rock'?3.55:4.1;
    this.swing=Math.max(0,this.swing-dt*swingRate);
    this.recoil=Math.max(0,this.recoil-dt*7.8);
    this.muzzleFlashTime=Math.max(0,this.muzzleFlashTime-dt);if(this.muzzleFlash){this.muzzleFlash.visible=this.muzzleFlashTime>0;(this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity=Math.min(.92,this.muzzleFlashTime*14);}
    this.inspectTime=Math.max(0,this.inspectTime-dt);
    this.sprintBlend=THREE.MathUtils.damp(this.sprintBlend,sprinting?1:0,9,dt);
    this.crouchBlend=THREE.MathUtils.damp(this.crouchBlend,crouching?1:0,8,dt);
    this.bowDraw=THREE.MathUtils.damp(this.bowDraw,this.active==='bow'?THREE.MathUtils.clamp(bowDraw,0,1):0,16,dt);
    this.reloadProgress=THREE.MathUtils.damp(this.reloadProgress,reloadProgress,11,dt);
    this.lookSway.lerp(this.lookTarget,1-Math.exp(-dt*18));
    this.lookTarget.multiplyScalar(Math.exp(-dt*13));

    const action=1-this.swing;
    const envelope=this.swing>0?Math.sin(action*Math.PI):0;
    let swingPitch=0,swingYaw=0,swingRoll=0,swingX=0,swingY=0,swingZ=0;
    if(this.active==='hammer'){
      swingPitch=-envelope*.58;swingYaw=envelope*.10;swingRoll=-envelope*.31;swingX=-envelope*.055;swingY=envelope*.04;swingZ=-envelope*.09;
    }else if(this.active==='hatchet'){
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
    if(this.bowString){this.bowString.position.x=.05-this.bowDraw*.21;this.bowString.scale.y=1-this.bowDraw*.12;}
    if(this.bowArrow){this.bowArrow.visible=this.bowDraw>.08;this.bowArrow.position.x=.14-this.bowDraw*.18;}
    if((this.active==='salvageRevolver'||this.active==='fieldShotgun')&&this.reloadProgress>0){this.hand.rotation.x-=Math.sin(this.reloadProgress*Math.PI)*.20;this.hand.rotation.z+=this.reloadProgress*.11;this.hand.position.y-=Math.sin(this.reloadProgress*Math.PI)*.035;}

    if(this.flameOuter)(this.flameOuter.material as THREE.ShaderMaterial).uniforms.time.value=this.t;
    if(this.flameInner)(this.flameInner.material as THREE.ShaderMaterial).uniforms.time.value=this.t*1.23+19.;
  }

  resize(w:number,h:number){this.camera.aspect=w/Math.max(h,1);this.aspectOffset=(this.camera.aspect/(16/9)-1)*.31;this.camera.updateProjectionMatrix();}
  diagnostics(){
    this.hand.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();
    const anchor=new THREE.Vector3(.29,-.07,-.597).applyMatrix4(this.hand.matrixWorld).project(this.camera);
    const muzzleFlashScreen=this.muzzleFlash?new THREE.Vector3().setFromMatrixPosition(this.muzzleFlash.matrixWorld).project(this.camera):null;
    const bounds=new THREE.Box3().setFromObject(this.hand);let transparentDepthWrites=0;
    this.hand.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.transparent&&m.depthWrite)transparentDepthWrites++;}});
    return {active:this.active,handMatrix:this.hand.matrixWorld.toArray(),anchor:anchor.toArray(),nearestDepth:-bounds.max.z,transparentDepthWrites,swing:this.swing,recoil:this.recoil,inspect:this.inspectTime,sprintPose:this.sprintBlend,bowDraw:this.bowDraw,reloadProgress:this.reloadProgress,muzzleFlash:this.muzzleFlash?.visible??false,muzzleFlashOpacity:this.muzzleFlash?.material instanceof THREE.MeshBasicMaterial?this.muzzleFlash.material.opacity:0,muzzleFlashScreen:muzzleFlashScreen?[muzzleFlashScreen.x,muzzleFlashScreen.y,muzzleFlashScreen.z]:null};
  }
  render(renderer:THREE.WebGLRenderer){
    if(!this.hand.children.length)return;
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.clearDepth();renderer.render(this.scene,this.camera);}finally{renderer.autoClear=autoClear;}
  }
}
