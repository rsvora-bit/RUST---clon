import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILD } from '../config/balance';
import type { BuildCandidate,PieceType,Structure,Vec3 } from '../core/types';
import type {CollisionBox} from '../physics/PhysicsWorld';
import {woodMaterial,stoneMaterial} from '../rendering/materials';
const S=BUILD.SIZE,H=BUILD.WALL_HEIGHT,T=BUILD.THICKNESS,F=BUILD.FOUNDATION_HEIGHT,DW=BUILD.DOOR_WIDTH,DH=BUILD.DOOR_HEIGHT;
export class StructureRenderer {
  readonly group=new THREE.Group();readonly objects=new Map<string,THREE.Group>();readonly ghost=new THREE.Group();
  private wood=woodMaterial('#969286');private darkWood=woodMaterial('#777467');private stone=stoneMaterial();private metal=new THREE.MeshStandardMaterial({color:'#393c39',roughness:.72,metalness:.52});
  private ghostMaterial=new THREE.MeshBasicMaterial({color:'#8bbb84',transparent:true,opacity:.35,depthWrite:false});private ghostType:PieceType|null=null;
  private interactionMaterial=new THREE.MeshBasicMaterial({visible:false});
  constructor(scene:THREE.Scene){scene.add(this.group,this.ghost);this.ghost.visible=false;}
  private box(parent:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material=this.wood){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);const uv=mesh.geometry.getAttribute('uv'),normal=mesh.geometry.getAttribute('normal');for(let i=0;i<uv.count;i++){const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));const across=nx>.5?d:w,along=ny>.5?d:h;uv.setXY(i,uv.getX(i)*across*2.1+x*.173+z*.211,uv.getY(i)*along*.47+y*.13);}mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private brace(parent:THREE.Group,x1:number,y1:number,x2:number,y2:number,z:number){const length=Math.hypot(x2-x1,y2-y1);const beam=this.box(parent,.11,length,.09,(x1+x2)/2,(y1+y2)/2,z,this.darkWood);beam.rotation.z=-Math.atan2(x2-x1,y2-y1);}
  make(piece:PieceType,ghost=false){
    const g=new THREE.Group();
    if(piece==='foundation'){
      this.box(g,S-.1,.25,S-.1,0,.125,0,this.stone);
      for(let i=0;i<11;i++)this.box(g,(S-.07)/11-.012,.12,S,(-S/2)+(i+.5)*(S/11),F-.06,0,i%3===0?this.darkWood:this.wood);
      for(const x of [-S/2+.1,S/2-.1])for(const z of [-S/2+.1,S/2-.1])this.box(g,.19,F,.19,x,F/2,z,this.darkWood);
      this.box(g,S,.14,.12,0,F-.2,-S/2+.06,this.darkWood);this.box(g,S,.14,.12,0,F-.2,S/2-.06,this.darkWood);
    } else if(piece==='wall'){
      let edge=-S/2;
      const widths=Array.from({length:13},(_,i)=>.8+.35*Math.sin(i*2.37+1)),sum=widths.reduce((a,b)=>a+b,0);
      for(let i=0;i<13;i++){const width=widths[i]/sum*S;this.box(g,width-.006,H-.006*(i%3),.095+.012*Math.sin(i*1.7),edge+width/2,H/2,.007*Math.sin(i*2.1),i%5===0?this.darkWood:this.wood);edge+=width;}
      for(const x of [-S/2+.08,S/2-.08])this.box(g,.16,H,.2,x,H/2,0,this.darkWood);
      for(const y of [.18,H-.17])this.box(g,S,.14,.12,0,y,.11,this.darkWood);
      this.brace(g,-S/2+.12,.3,S/2-.12,H-.3,.14);
      // Exterior rails give the modular shell depth without changing sockets.
      for(const y of [.13,H-.12])this.box(g,S+.035,.10,.075,0,y,-.09,this.darkWood);
    } else if(piece==='doorway'){
      const side=(S-DW)/2;
      for(const sign of [-1,1]){const center=sign*(DW/2+side/2);for(let i=0;i<4;i++)this.box(g,side/4-.006,H,.1,center-side/2+(i+.5)*side/4,H/2,0);this.box(g,.13,H,.2,sign*(DW/2+.06),H/2,0,this.darkWood);}
      this.box(g,DW,H-DH,.14,0,DH+(H-DH)/2,0);this.box(g,DW+.26,.16,.22,0,DH+.08,0,this.darkWood);
      for(const x of [-S/2+.08,S/2-.08])this.box(g,.16,H,.2,x,H/2,0,this.darkWood);
    } else if(piece==='door'){
      g.position.x=-DW/2;
      for(let i=0;i<6;i++)this.box(g,DW/6-.009,DH-.055,.085,(i+.5)*DW/6,DH/2,0,i%2===0?this.darkWood:this.wood);
      for(const y of [.3,DH-.3]){this.box(g,DW-.06,.1,.04,DW/2,y,.065,this.metal);this.box(g,.06,.17,.14,.05,y,0,this.metal);}
      this.brace(g,.09,.39,DW-.09,DH-.39,.065);
      this.box(g,.055,.19,.065,DW-.13,DH*.49,.09,this.metal);
    } else {
      for(let i=0;i<11;i++)this.box(g,S/11-.01,T,S,-S/2+(i+.5)*S/11,T/2,0,i%3===0?this.darkWood:this.wood);
      for(const x of [-S/2+.15,0,S/2-.15])this.box(g,.12,.16,S,x,-.04,0,this.darkWood);
      if(piece==='roof'){for(const z of [-S/2,S/2])this.box(g,S+.08,.16,.16,0,.1,z,this.darkWood);for(const x of [-S/2,S/2])this.box(g,.10,.11,S+.1,x,.14,0,this.darkWood);}
    }
    if(ghost)g.traverse(o=>{if(o instanceof THREE.Mesh){o.material=this.ghostMaterial;o.castShadow=false;o.receiveShadow=false;}});
    // Planks share materials and never move independently. Batch each piece
    // locally so a two-storey shelter does not submit every board separately.
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of [...g.children])if(child instanceof THREE.Mesh){
      child.updateMatrix();const geometry=child.geometry.clone().applyMatrix4(child.matrix);
      const material=child.material as THREE.Material;
      const entries=batches.get(material)??[];entries.push(geometry);batches.set(material,entries);
      child.geometry.dispose();g.remove(child);
    }
    for(const [material,parts] of batches){const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=!ghost;g.add(mesh);}
    if(piece==='door'&&!ghost){
      // The reticle must not lose a door when it crosses a millimetre-wide
      // plank seam. This follows the same hinge and slab as its collider.
      const hit=new THREE.Mesh(new THREE.BoxGeometry(DW-.035,DH-.03,.105),this.interactionMaterial);
      hit.position.set(DW/2,DH/2,0);g.add(hit);
    }
    return g;
  }
  add(s:Structure){
    if(this.objects.has(s.id))return;
    const root=new THREE.Group(),body=this.make(s.pieceType);root.add(body);root.position.set(s.position.x,s.position.y,s.position.z);root.rotation.y=s.rotation;
    if(s.pieceType==='door')body.rotation.y=s.open?-Math.PI/2:0;
    root.traverse(o=>{o.userData.structureId=s.id;if(o instanceof THREE.Mesh&&o.material!==this.interactionMaterial){if(s.grade==='stone')o.material=this.stone;if(s.grade==='metal')o.material=this.metal;}});root.userData.grade=s.grade;root.userData.pieceType=s.pieceType;this.objects.set(s.id,root);this.group.add(root);
  }
  sync(structures:Structure[]){const ids=new Set(structures.map(s=>s.id));for(const [id,g] of this.objects)if(!ids.has(id)){this.group.remove(g);this.disposeGroup(g);this.objects.delete(id);}for(const s of structures){const old=this.objects.get(s.id);if(old&&old.userData.grade!==s.grade){this.disposeGroup(old);old.removeFromParent();this.objects.delete(s.id);}this.add(s);const g=this.objects.get(s.id)!;if(s.pieceType==='door')g.children[0].rotation.y=s.open?-Math.PI/2:0;}}
  preview(c:BuildCandidate|null){if(!c){this.ghost.visible=false;return;}if(c.pieceType!==this.ghostType){for(const child of [...this.ghost.children]){this.ghost.remove(child);this.disposeGroup(child);}this.ghost.add(this.make(c.pieceType,true));this.ghostType=c.pieceType;}this.ghost.visible=true;this.ghost.position.set(c.position.x,c.position.y,c.position.z);this.ghost.rotation.y=c.rotation;this.ghostMaterial.color.set(c.valid?'#8fce97':'#da684c');}
  boxes(s:Structure):CollisionBox[]{
    const boxes:CollisionBox[]=[];const add=(x:number,y:number,z:number,w:number,h:number,d:number,r=0)=>{const c=Math.cos(s.rotation),sn=Math.sin(s.rotation);boxes.push({position:{x:s.position.x+x*c+z*sn,y:s.position.y+y,z:s.position.z+z*c-x*sn},halfExtents:{x:w/2,y:h/2,z:d/2},rotation:s.rotation+r});};
    if(s.pieceType==='foundation')add(0,F/2,0,S,F,S);
    if(s.pieceType==='wall')add(0,H/2,0,S,H,T);
    if(s.pieceType==='doorway'){const side=(S-DW)/2;for(const sign of [-1,1])add(sign*(DW/2+side/2),H/2,0,side,H,T);add(0,DH+(H-DH)/2,0,DW,H-DH,T);}
    if(s.pieceType==='door'){const r=s.open?-Math.PI/2:0;add(-DW/2+Math.cos(r)*DW/2,DH/2,-Math.sin(r)*DW/2,DW-.035,DH-.03,.105,r);}
    if(s.pieceType==='floor'||s.pieceType==='roof')add(0,T/2,0,S,T,S);
    return boxes;
  }
  private disposeGroup(group:THREE.Object3D){group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
  dispose(){this.disposeGroup(this.group);this.disposeGroup(this.ghost);this.group.removeFromParent();this.ghost.removeFromParent();for(const mat of [this.wood,this.darkWood,this.stone,this.metal,this.ghostMaterial,this.interactionMaterial])mat.dispose();}
}
