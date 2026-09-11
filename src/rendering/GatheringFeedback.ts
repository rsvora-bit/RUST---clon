import * as THREE from 'three';
import type {ResourceNode,Vec3} from '../core/types';

type WeakKind='tree'|'stone'|'metal';
type Spot={nodeId:string;kind:WeakKind;position:THREE.Vector3;root:THREE.Group;sequence:number;age:number};
type HitMark={root:THREE.Group;material:THREE.MeshBasicMaterial;life:number;max:number};
export interface GatherStrike {point:THREE.Vector3;weakSpot:boolean}

const eligible=(kind:ResourceNode['kind']):kind is WeakKind=>kind==='tree'||kind==='stone'||kind==='metal';
const hash=(value:string):number=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
const unit=(seed:number,offset:number)=>((Math.imul(seed^(offset*0x9e3779b9),1664525)+1013904223)>>>0)/4294967296;

/** Presentation-only weak spots and short-lived impact marks. Simulation stays authoritative. */
export class GatheringFeedback {
  private readonly spots=new Map<string,Spot>();
  private readonly hitMarks:HitMark[]=[];
  private readonly red=new THREE.MeshBasicMaterial({color:0xe43d35,transparent:true,opacity:.96,depthWrite:false,toneMapped:false});
  private readonly glow=new THREE.MeshBasicMaterial({color:0xffd45b,transparent:true,opacity:.94,depthWrite:false,toneMapped:false});
  private readonly bar=new THREE.BoxGeometry(.34,.052,.022);
  private readonly sparkBar=new THREE.BoxGeometry(.31,.035,.018);
  private readonly ring=new THREE.RingGeometry(.145,.185,20);

  constructor(private readonly scene:THREE.Scene){}

  capture(node:ResourceNode,ray:THREE.Ray,point:THREE.Vector3):GatherStrike{
    const spot=this.spots.get(node.id);
    if(!spot)return {point:point.clone(),weakSpot:false};
    const radius=(node.kind==='tree'?.27:.32)*Math.max(.72,node.scale);
    return {point:point.clone(),weakSpot:ray.distanceSqToPoint(spot.position)<=radius*radius};
  }

  onHit(node:ResourceNode,point:Vec3,weakSpot:boolean,depleted:boolean):void{
    this.hitMark(point,node.kind,weakSpot);
    if(depleted){this.removeSpot(node.id);return;}
    if(!eligible(node.kind))return;
    if(!this.spots.has(node.id)||weakSpot)this.placeSpot(node);
  }

  spotPosition(nodeId:string):Vec3|null{
    const spot=this.spots.get(nodeId);return spot?{x:spot.position.x,y:spot.position.y,z:spot.position.z}:null;
  }

  update(dt:number,camera:THREE.Camera):void{
    for(const spot of this.spots.values()){
      spot.age+=dt;spot.root.quaternion.copy(camera.quaternion);
      const pulse=1+Math.sin(spot.age*(spot.kind==='tree'?8.5:11))*0.08;spot.root.scale.setScalar(pulse);
      if(spot.kind!=='tree')spot.root.rotation.z+=dt*1.7;
    }
    for(let i=this.hitMarks.length-1;i>=0;i--){
      const mark=this.hitMarks[i]!;mark.life-=dt;if(mark.life<=0){mark.root.removeFromParent();mark.material.dispose();this.hitMarks.splice(i,1);continue;}
      mark.root.quaternion.copy(camera.quaternion);const t=1-mark.life/mark.max;mark.material.opacity=(1-t)*.92;mark.root.scale.setScalar(.75+t*.75);
    }
  }

  clear():void{
    for(const spot of this.spots.values())spot.root.removeFromParent();this.spots.clear();
    for(const mark of this.hitMarks){mark.root.removeFromParent();mark.material.dispose();}this.hitMarks.length=0;
  }

  dispose():void{this.clear();this.red.dispose();this.glow.dispose();this.bar.dispose();this.sparkBar.dispose();this.ring.dispose();}

  private placeSpot(node:ResourceNode):void{
    let spot=this.spots.get(node.id);
    if(!spot){const root=node.kind==='tree'?this.treeMarker():this.rockMarker();root.name=`${node.kind} weak spot`;this.scene.add(root);spot={nodeId:node.id,kind:node.kind as WeakKind,position:new THREE.Vector3(),root,sequence:0,age:0};this.spots.set(node.id,spot);}else spot.sequence++;
    const seed=hash(`${node.id}:${spot.sequence}`),angle=unit(seed,1)*Math.PI*2;
    if(node.kind==='tree'){
      const radius=.41*node.scale,vertical=(1.35+unit(seed,2)*2.65)*node.scale;
      spot.position.set(node.position.x+Math.cos(angle)*radius,node.position.y+vertical,node.position.z+Math.sin(angle)*radius);
    }else{
      const radius=(.24+unit(seed,2)*.28)*node.scale,vertical=(.48+unit(seed,3)*.38)*node.scale;
      spot.position.set(node.position.x+Math.cos(angle)*radius,node.position.y+vertical,node.position.z+Math.sin(angle)*radius);
    }
    spot.root.position.copy(spot.position);spot.age=0;
  }

  private treeMarker():THREE.Group{
    const g=new THREE.Group();for(const a of [Math.PI/4,-Math.PI/4]){const m=new THREE.Mesh(this.bar,this.red);m.rotation.z=a;m.renderOrder=7;g.add(m);}return g;
  }

  private rockMarker():THREE.Group{
    const g=new THREE.Group(),ring=new THREE.Mesh(this.ring,this.glow);ring.renderOrder=7;g.add(ring);
    for(const a of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){const m=new THREE.Mesh(this.sparkBar,this.glow);m.rotation.z=a;m.renderOrder=8;g.add(m);}return g;
  }

  private hitMark(point:Vec3,kind:ResourceNode['kind'],strong:boolean):void{
    const color=kind==='tree'||kind==='wood'?(strong?0xffd6a1:0xe7bf88):(kind==='metal'?(strong?0xffe6a0:0xc9b28d):0xe3e1d7);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false,toneMapped:false});
    const root=new THREE.Group();root.position.set(point.x,point.y,point.z);root.name='Gathering hit mark';
    for(const a of [Math.PI/4,-Math.PI/4]){const mesh=new THREE.Mesh(this.sparkBar,material);mesh.rotation.z=a;mesh.renderOrder=9;root.add(mesh);}root.scale.setScalar(strong?1.15:.82);this.scene.add(root);
    this.hitMarks.push({root,material,life:strong?.42:.28,max:strong?.42:.28});
  }

  private removeSpot(id:string):void{const spot=this.spots.get(id);if(!spot)return;spot.root.removeFromParent();this.spots.delete(id);}
}
