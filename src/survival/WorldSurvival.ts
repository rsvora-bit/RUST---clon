import type {CollisionBox} from '../physics/PhysicsWorld';
import * as T from 'three';
import type {Environment} from '../rendering/environment';
import type {GameState,ItemId,Vec3} from '../core/types';
import {ensureProgression} from './progression';
import {createStation,type Station} from './stations';
import {insertItem} from '../inventory/inventory';
import {woodMaterial} from '../rendering/materials';
import {randomSource} from '../world/noise';

export interface Landmark {id:string;name:string;position:Vec3;kind:number}
const NAMES=['Coastal utility shack','Collapsed relay site','Quarry outpost','Overgrown camp'];
type LootTier='common'|'decent'|'lucky';
const LOOT:Record<LootTier,{item:ItemId;min:number;max:number;chance:number}[]>={
  common:[{item:'wood',min:25,max:90,chance:.82},{item:'stone',min:20,max:75,chance:.72},{item:'fiber',min:10,max:40,chance:.58},{item:'berries',min:2,max:8,chance:.34},{item:'ore',min:8,max:28,chance:.30}],
  decent:[{item:'ore',min:28,max:75,chance:.88},{item:'metal',min:8,max:28,chance:.72},{item:'sulfurOre',min:15,max:55,chance:.68},{item:'bandage',min:1,max:3,chance:.48},{item:'canteen',min:1,max:2,chance:.35},{item:'hatchet',min:1,max:1,chance:.18},{item:'pickaxe',min:1,max:1,chance:.18}],
  lucky:[{item:'hqMetalOre',min:8,max:28,chance:.95},{item:'sulfurOre',min:45,max:130,chance:.92},{item:'ore',min:65,max:180,chance:.92},{item:'metal',min:20,max:65,chance:.85},{item:'bandage',min:2,max:5,chance:.68},{item:'canteen',min:1,max:3,chance:.55},{item:'pickaxe',min:1,max:1,chance:.42},{item:'hatchet',min:1,max:1,chance:.36}]
};

export class WorldSurvival {
  readonly pois:Landmark[]=[];readonly group=new T.Group();readonly trails:Vec3[][]=[];
  private wood=woodMaterial('#696858');private metal=new T.MeshStandardMaterial({color:0x64706b,roughness:.88,metalness:.3});private cloth=new T.MeshStandardMaterial({color:0x6b755d,roughness:1,side:T.DoubleSide});
  constructor(private env:Environment,scene:T.Scene,private seed:number){
    scene.add(this.group);const rand=randomSource(seed+1939);
    for(let k=0;k<4;k++){let best:Vec3|null=null,score=Infinity;const angle=k*Math.PI/2+.5+(rand()-.5)*.38;for(let i=0;i<2100;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=env.terrain.generation>=4?96+(i%215):82+(i%175);const x=Math.cos(a)*r,z=Math.sin(a)*r,y=env.heightAt(x,z);if(y<3||y>36)continue;const slope=env.terrain.slopeAt(x,z);if(slope>.36)continue;if(this.pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<65))continue;const nearby=env.colliders.some(c=>Math.abs(c.position.x-x)<5+c.halfExtents.x&&Math.abs(c.position.z-z)<5+c.halfExtents.z);if(nearby)continue;const rank=slope+Math.abs(r-175)*.001;if(rank<score){score=rank;best={x,y,z};}}if(!best)continue;const poi={id:`poi-${k}`,name:NAMES[k]!,position:best,kind:k};this.pois.push(poi);this.make(poi);}
    let from=env.spawn;for(const poi of this.pois){const points:Vec3[]=[],distance=Math.hypot(poi.position.x-from.x,poi.position.z-from.z),segments=Math.ceil(distance/2);for(let i=0;i<=segments;i++){const t=i/segments,x=T.MathUtils.lerp(from.x,poi.position.x,t)+Math.sin(t*Math.PI)*Math.sin(seed+i*.03)*5,z=T.MathUtils.lerp(from.z,poi.position.z,t);points.push({x,y:env.heightAt(x,z)+.03,z});}this.trails.push(points);from=poi.position;}
  }
  private box(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
  private make(p:Landmark){
    const g=new T.Group();g.position.set(p.position.x,p.position.y,p.position.z);this.group.add(g);
    if(p.kind===1){
      // The former multi-storey relay scaffold was visually dominant and looked accidental.
      // Keep only a low collapsed relay wreck so the POI still has identity without a tower.
      for(let i=0;i<6;i++){const beam=this.box(g,-1.7+i*.65,.12+(i%2)*.08,(i%3-1)*.58,1.05,.11,.13,this.metal);beam.rotation.y=(i*.71)%Math.PI;beam.rotation.z=(i%2?.08:-.06);}
      this.box(g,.8,.23,-.7,1.55,.32,.85,this.metal);this.box(g,-.75,.16,.7,1.2,.2,.65,this.wood);
    }else if(p.kind===3){const tent=new T.Mesh(new T.ConeGeometry(1.8,2.3,4,1,true),this.cloth);tent.position.y=1.15;tent.rotation.y=Math.PI/4;g.add(tent);this.box(g,-2,.18,0,.3,.3,2,this.wood);
    }else{for(const x of [-2,2])for(const z of [-1.6,1.6])this.box(g,x,1.4,z,.18,2.8,.18,this.wood);for(let i=0;i<12;i++)this.box(g,-2+i*.35,1.2,-1.6,.32,2.4,.12,this.wood);this.box(g,0,2.8,0,4.5,.13,3.8,this.metal).rotation.z=.08;if(p.kind===2)for(let i=0;i<3;i++)this.box(g,3,.35,i*.7,1,.7,.5,this.metal);}
  }
  private tier(rand:()=>number):LootTier{const roll=rand();return roll<.60?'common':roll<.92?'decent':'lucky';}
  private fillLoot(s:Station,tier:LootTier,rand:()=>number){let added=0;for(const entry of LOOT[tier]){if(rand()>entry.chance)continue;const amount=entry.min+Math.floor(rand()*(entry.max-entry.min+1));if(insertItem(s.inventory,entry.item,amount)<amount)added++;}if(!added){const fallback=tier==='lucky'?'hqMetalOre':tier==='decent'?'ore':'wood';insertItem(s.inventory,fallback,tier==='lucky'?10:tier==='decent'?35:45);}}
  populate(state:GameState){
    const progress=ensureProgression(state),existing=new Set(progress.stations.map(s=>s.id));
    for(const poi of this.pois){const id=`loot-${poi.id}`,pos={x:poi.position.x+2.7,y:this.env.heightAt(poi.position.x+2.7,poi.position.z+2.4),z:poi.position.z+2.4},rand=randomSource(this.seed+8000+poi.kind*313);if(!existing.has(id)){const s=createStation(id,'loot',pos,rand()*Math.PI*2);this.fillLoot(s,this.tier(rand),rand);progress.stations.push(s);existing.add(id);}}
    const rand=randomSource(this.seed+12091),placed:Vec3[]=[];
    for(let tries=0,index=0;tries<6500&&index<16;tries++){
      const span=this.env.terrain.generation>=4?640:530,x=(rand()-.5)*span,z=(rand()-.5)*span,y=this.env.heightAt(x,z);if(y<2.2||y>33||this.env.terrain.slopeAt(x,z)>.48||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<24)continue;if(placed.some(p=>Math.hypot(p.x-x,p.z-z)<24))continue;
      const pos={x,y:y+.02,z};placed.push(pos);const id=`loot-field-${index}`,lootRand=randomSource(this.seed+24000+index*977);if(!existing.has(id)){const s=createStation(id,'loot',pos,lootRand()*Math.PI*2);this.fillLoot(s,this.tier(lootRand),lootRand);progress.stations.push(s);existing.add(id);}index++;
    }
    progress.lootGenerated=true;
  }
  collisionBoxes():CollisionBox[]{const result:CollisionBox[]=[];for(const p of this.pois){if(p.kind===1){result.push({position:{x:p.position.x+.8,y:p.position.y+.23,z:p.position.z-.7},halfExtents:{x:.8,y:.2,z:.45}});}else if(p.kind!==3)result.push({position:{x:p.position.x,y:p.position.y+1.2,z:p.position.z-1.6},halfExtents:{x:2.2,y:1.2,z:.12}});}return result;}
  dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.group.removeFromParent();[this.wood,this.metal,this.cloth].forEach(m=>m.dispose());}
}

export class IslandMap {
  readonly root=document.createElement('section');private canvas=document.createElement('canvas');private base=document.createElement('canvas');private ctx:CanvasRenderingContext2D;
  constructor(parent:HTMLElement,world:WorldSurvival,env:Environment,private onWaypoint:(p:{x:number;z:number}|null)=>void,close:()=>void){this.root.className='survival-panel world-map';this.root.hidden=true;this.root.innerHTML='<header><span>TIDELAND / ISLAND SURVEY</span><button>CLOSE · M / ESC</button></header><p>Click to set waypoint · Right-click to clear · North is up</p>';this.root.querySelector('button')!.onclick=close;this.canvas.width=this.canvas.height=this.base.width=this.base.height=720;this.ctx=this.canvas.getContext('2d')!;this.root.append(this.canvas);parent.append(this.root);const c=this.base.getContext('2d')!,data=c.createImageData(720,720);for(let z=0;z<720;z++)for(let x=0;x<720;x++){const h=env.heightAt(x-360,z-360),i=(z*720+x)*4,col=h<0?[39,66,75]:h<2?[154,147,117]:[72+h*1.2,88+h*.9,64+h*.9];data.data.set([...col,255],i);}c.putImageData(data,0,0);c.strokeStyle='#c0ad80';c.lineWidth=2;for(const trail of world.trails){c.beginPath();trail.forEach((p,i)=>i?c.lineTo(p.x+360,p.z+360):c.moveTo(p.x+360,p.z+360));c.stroke();}c.font='13px sans-serif';for(const p of world.pois){c.fillStyle='#e4d4a6';c.fillRect(p.position.x+355,p.position.z+355,10,10);c.fillText(p.name,p.position.x+368,p.position.z+360);}this.canvas.onclick=e=>{const r=this.canvas.getBoundingClientRect();this.onWaypoint({x:(e.clientX-r.left)/r.width*720-360,z:(e.clientY-r.top)/r.height*720-360});};this.canvas.oncontextmenu=e=>{e.preventDefault();this.onWaypoint(null);};}
  get isOpen(){return !this.root.hidden;}show(){this.root.hidden=false;}close(){this.root.hidden=true;}update(p:Vec3,yaw:number,waypoint?:{x:number;z:number}){if(!this.isOpen)return;const c=this.ctx;c.drawImage(this.base,0,0);if(waypoint){c.strokeStyle='#e3a877';c.lineWidth=3;c.strokeRect(waypoint.x+352,waypoint.z+352,16,16);}c.save();c.translate(p.x+360,p.z+360);c.rotate(-yaw);c.fillStyle='#f0f4e4';c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.restore();}
  dispose(){this.root.remove();}
}
