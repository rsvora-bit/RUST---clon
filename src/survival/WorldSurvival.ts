import type {CollisionBox} from '../physics/PhysicsWorld';
import * as T from 'three';
import type {Environment} from '../rendering/environment';
import type {GameState,ItemId,Vec3} from '../core/types';
import {ensureProgression} from './progression';
import {createStation,type Station} from './stations';
import {woodMaterial} from '../rendering/materials';
import {randomSource} from '../world/noise';
import {fillSalvageLoot,initializeWorldEconomy,type LootTier} from './economy';
import type {IslandTerrain} from '../terrain/island';

export interface Landmark {id:string;name:string;position:Vec3;kind:number}
const NAMES=['Coastal utility shack','Collapsed relay site','Quarry outpost','Overgrown camp'];
export const worldToMap=(p:{x:number;z:number},size:number,pixels:number)=>({x:(p.x+size/2)/size*pixels,y:(p.z+size/2)/size*pixels});
export const mapToWorld=(p:{x:number;y:number},size:number,pixels:number)=>({x:p.x/pixels*size-size/2,z:p.y/pixels*size-size/2});

export interface WorldLayout{pois:Landmark[];trails:Vec3[][]}
export function generateWorldLayout(terrain:IslandTerrain,spawn:Vec3,colliders:CollisionBox[],seed:number):WorldLayout{
  const pois:Landmark[]=[],trails:Vec3[][]=[],rand=randomSource(seed+1939);
  for(let k=0;k<4;k++){let best:Vec3|null=null,score=Infinity;const angle=k*Math.PI/2+.5+(rand()-.5)*.38;for(let i=0;i<2800;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=terrain.generation===5?155+(i%325):terrain.generation>=4?96+(i%215):82+(i%175);const x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrain.heightAt(x,z);if(y<3||y>(terrain.generation===5?52:36))continue;const slope=terrain.slopeAt(x,z);if(slope>.36)continue;if(Math.hypot(x-spawn.x,z-spawn.z)<90||pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<95))continue;const nearby=colliders.some(c=>Math.abs(c.position.x-x)<5+c.halfExtents.x&&Math.abs(c.position.z-z)<5+c.halfExtents.z);if(nearby)continue;const rank=slope+Math.abs(r-(terrain.generation===5?300:175))*.001;if(rank<score){score=rank;best={x,y,z};}}if(best)pois.push({id:`poi-${k}`,name:NAMES[k]!,position:best,kind:k});}
  let from=spawn;const ordered=terrain.generation===5?(()=>{const remaining=[...pois],route:Landmark[]=[];let cursor=spawn;while(remaining.length){let best=0,bestDistance=Infinity;remaining.forEach((poi,index)=>{const d=Math.hypot(poi.position.x-cursor.x,poi.position.z-cursor.z);if(d<bestDistance){best=index;bestDistance=d;}});const next=remaining.splice(best,1)[0]!;route.push(next);cursor=next.position;}return route;})():pois;
  for(const poi of ordered){const points:Vec3[]=[],distance=Math.hypot(poi.position.x-from.x,poi.position.z-from.z),segments=Math.ceil(distance/3);for(let i=0;i<=segments;i++){const t=i/segments;let x=T.MathUtils.lerp(from.x,poi.position.x,t)+Math.sin(t*Math.PI)*Math.sin(seed+i*.03)*8,z=T.MathUtils.lerp(from.z,poi.position.z,t),y=terrain.heightAt(x,z);if(terrain.generation===5&&y<1){for(let j=1;j<=12&&y<1;j++){const pull=j/12*.86;x=T.MathUtils.lerp(x,0,pull);z=T.MathUtils.lerp(z,0,pull);y=terrain.heightAt(x,z);}}points.push({x,y:y+.08,z});}trails.push(points);from=poi.position;}
  return {pois,trails};
}

export class WorldSurvival {
  readonly pois:Landmark[]=[];readonly recyclers:Vec3[]=[];readonly group=new T.Group();readonly trails:Vec3[][]=[];
  private wood=woodMaterial('#696858');private metal=new T.MeshStandardMaterial({color:0x64706b,roughness:.88,metalness:.3});private cloth=new T.MeshStandardMaterial({color:0x6b755d,roughness:1,side:T.DoubleSide});private road=new T.MeshStandardMaterial({color:0x725f43,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  constructor(private env:Environment,scene:T.Scene,private seed:number){
    scene.add(this.group);const layout=generateWorldLayout(env.terrain,env.spawn,env.colliders,seed);this.pois.push(...layout.pois);this.trails.push(...layout.trails);for(const poi of this.pois)this.make(poi);for(const points of this.trails)this.makeRoad(points);
  }
  private makeRoad(points:Vec3[]){if(points.length<2)return;const vertices:number[]=[],indices:number[]=[],width=this.env.terrain.generation===5?2.8:1.5;for(let i=0;i<points.length;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;vertices.push(p.x+nx*width,p.y,p.z+nz*width,p.x-nx*width,p.y,p.z-nz*width);if(i<points.length-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,this.road);mesh.receiveShadow=true;mesh.name='Terrain-following island road';this.group.add(mesh);}
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
  fillLoot(s:Station,tier:LootTier,rand:()=>number){fillSalvageLoot(s,tier,rand);}
  populate(state:GameState){
    const progress=ensureProgression(state),existing=new Set(progress.stations.map(s=>s.id)),legacyEconomy=progress.lootGenerated&&progress.economyVersion===undefined;
    if(!progress.lootGenerated){
      for(const poi of this.pois){const id=`loot-${poi.id}`,pos={x:poi.position.x+2.7,y:this.env.heightAt(poi.position.x+2.7,poi.position.z+2.4),z:poi.position.z+2.4},rand=randomSource(this.seed+8000+poi.kind*313);if(!existing.has(id)){const s=createStation(id,'loot',pos,rand()*Math.PI*2);this.fillLoot(s,this.tier(rand),rand);progress.stations.push(s);existing.add(id);}}
      const rand=randomSource(this.seed+12091),placed:Vec3[]=[];
      for(let tries=0,index=0;tries<6500&&index<16;tries++){
        const span=this.env.terrain.generation===5?this.env.terrain.size*.92:this.env.terrain.generation>=4?640:530,x=(rand()-.5)*span,z=(rand()-.5)*span,y=this.env.heightAt(x,z);if(y<2.2||y>42||this.env.terrain.slopeAt(x,z)>.48||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<24)continue;if(placed.some(p=>Math.hypot(p.x-x,p.z-z)<24))continue;
        const pos={x,y:y+.02,z};placed.push(pos);const id=`loot-field-${index}`,lootRand=randomSource(this.seed+24000+index*977);if(!existing.has(id)){const s=createStation(id,'loot',pos,lootRand()*Math.PI*2);this.fillLoot(s,this.tier(lootRand),lootRand);progress.stations.push(s);existing.add(id);}index++;
      }
      progress.lootGenerated=true;
    }
    this.recyclers.splice(0,this.recyclers.length,...initializeWorldEconomy(state,this.pois,(x,z)=>this.env.heightAt(x,z),this.seed,createStation,legacyEconomy));
  }
  collisionBoxes():CollisionBox[]{const result:CollisionBox[]=[];for(const p of this.pois){if(p.kind===1){result.push({position:{x:p.position.x+.8,y:p.position.y+.23,z:p.position.z-.7},halfExtents:{x:.8,y:.2,z:.45}});}else if(p.kind!==3)result.push({position:{x:p.position.x,y:p.position.y+1.2,z:p.position.z-1.6},halfExtents:{x:2.2,y:1.2,z:.12}});}return result;}
  dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.group.removeFromParent();[this.wood,this.metal,this.cloth,this.road].forEach(m=>m.dispose());}
}

export class IslandMap {
  readonly root=document.createElement('section');private canvas=document.createElement('canvas');private base=document.createElement('canvas');private ctx:CanvasRenderingContext2D;private readonly pixels=768;private zoom=1;private pan={x:0,y:0};private dragging=false;private dragStart={x:0,y:0};private panStart={x:0,y:0};
  constructor(parent:HTMLElement,private world:WorldSurvival,private env:Environment,private onWaypoint:(p:{x:number;z:number}|null)=>void,close:()=>void){
    this.root.className='survival-panel world-map';this.root.hidden=true;this.root.innerHTML='<header><span>TIDELAND / ISLAND SURVEY</span><div><button data-map="fit">FIT ISLAND</button><button data-map="zoom">ZOOM</button><button data-map="close">CLOSE · M / ESC</button></div></header><p>Click to set waypoint · Drag to pan · Wheel to zoom · Right-click to clear · North is up</p>';
    this.root.querySelector<HTMLElement>('[data-map="close"]')!.onclick=close;this.root.querySelector<HTMLElement>('[data-map="fit"]')!.onclick=()=>{this.zoom=1;this.pan={x:0,y:0};};this.root.querySelector<HTMLElement>('[data-map="zoom"]')!.onclick=()=>{this.zoom=this.zoom===1?1.6:this.zoom===1.6?2.4:1;this.pan={x:(1-this.zoom)*this.pixels/2,y:(1-this.zoom)*this.pixels/2};};
    this.canvas.width=this.canvas.height=this.base.width=this.base.height=this.pixels;this.ctx=this.canvas.getContext('2d')!;this.root.append(this.canvas);parent.append(this.root);this.buildBase();
    this.canvas.onpointerdown=e=>{if(e.button!==0)return;this.dragging=true;this.dragStart={x:e.clientX,y:e.clientY};this.panStart={...this.pan};this.canvas.setPointerCapture(e.pointerId);};this.canvas.onpointermove=e=>{if(!this.dragging)return;this.pan={x:this.panStart.x+e.clientX-this.dragStart.x,y:this.panStart.y+e.clientY-this.dragStart.y};};this.canvas.onpointerup=e=>{if(!this.dragging)return;const moved=Math.hypot(e.clientX-this.dragStart.x,e.clientY-this.dragStart.y);this.dragging=false;if(moved<5){const q=this.eventPoint(e),local={x:(q.x-this.pan.x)/this.zoom,y:(q.y-this.pan.y)/this.zoom};this.onWaypoint(mapToWorld(local,this.env.terrain.size,this.pixels));}};this.canvas.onwheel=e=>{e.preventDefault();const before=this.eventPoint(e),old=this.zoom;this.zoom=Math.max(1,Math.min(2.8,this.zoom*(e.deltaY<0?1.25:.8)));this.pan.x=before.x-(before.x-this.pan.x)*this.zoom/old;this.pan.y=before.y-(before.y-this.pan.y)*this.zoom/old;};this.canvas.oncontextmenu=e=>{e.preventDefault();this.onWaypoint(null);};
  }
  private eventPoint(e:MouseEvent|PointerEvent|WheelEvent){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*this.pixels,y:(e.clientY-r.top)/r.height*this.pixels};}
  private buildBase(){const c=this.base.getContext('2d')!,data=c.createImageData(this.pixels,this.pixels),size=this.env.terrain.size;for(let py=0;py<this.pixels;py++)for(let px=0;px<this.pixels;px++){const w=mapToWorld({x:px,y:py},size,this.pixels),h=this.env.heightAt(w.x,w.z),biome=this.env.biomeAt(w.x,w.z),dx=this.env.heightAt(w.x+3,w.z)-this.env.heightAt(w.x-3,w.z),dz=this.env.heightAt(w.x,w.z+3)-this.env.heightAt(w.x,w.z-3),shade=Math.max(.68,Math.min(1.24,1+(dx+dz)*.026));let col:number[]=h<0?[31,56,72]:h<2.8?[177,159,119]:biome==='ARID'?[154,126,76]:biome==='SNOW / ALPINE'?[218,220,211]:biome==='ROCKY MOUNTAIN'||biome==='ROCKY UPLAND'?[119,122,116]:biome==='TEMPERATE FOREST'||biome==='FOREST'?[57,91,60]:[91,117,68];const i=(py*this.pixels+px)*4;data.data.set([col[0]!*shade,col[1]!*shade,col[2]!*shade,255],i);}c.putImageData(data,0,0);
    c.strokeStyle='rgba(221,190,132,.78)';c.lineWidth=2;for(const trail of this.world.trails){c.beginPath();trail.forEach((p,i)=>{const q=worldToMap(p,size,this.pixels);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.stroke();}
    const cells=12,step=this.pixels/cells;c.strokeStyle='rgba(224,230,211,.12)';c.fillStyle='rgba(231,235,216,.38)';c.font='11px sans-serif';c.lineWidth=1;for(let i=0;i<=cells;i++){c.beginPath();c.moveTo(i*step,0);c.lineTo(i*step,this.pixels);c.stroke();c.beginPath();c.moveTo(0,i*step);c.lineTo(this.pixels,i*step);c.stroke();if(i<cells){c.fillText(String.fromCharCode(65+i),i*step+5,14);c.fillText(String(i+1),4,i*step+28);}}
    const labels:{x:number;y:number;w:number;h:number}[]=[],drawLabel=(text:string,x:number,y:number,color:string)=>{const w=c.measureText(text).width+5,h=13,options=[[x+9,y-9],[x+9,y+20],[x-w-9,y-9],[x-w-9,y+20],[x+9,y-25],[x-w-9,y+35]];const chosen=options.find(([lx,ly])=>lx>3&&lx+w<this.pixels-3&&ly-h>3&&ly<this.pixels-3&&!labels.some(b=>lx<b.x+b.w&&lx+w>b.x&&ly-h<b.y&&ly>b.y-b.h))??options[0]!;labels.push({x:chosen[0],y:chosen[1],w,h});c.fillStyle=color;c.fillText(text,chosen[0],chosen[1]);};
    c.font='bold 12px sans-serif';this.world.pois.forEach(p=>{const q=worldToMap(p.position,size,this.pixels);c.fillStyle='#e5d5a9';c.beginPath();c.arc(q.x,q.y,5,0,Math.PI*2);c.fill();drawLabel(p.name.toUpperCase(),q.x,q.y,'#e5d5a9');});for(const r of this.world.recyclers){const q=worldToMap(r,size,this.pixels);c.fillStyle='#b6cf79';c.fillRect(q.x-4,q.y-4,8,8);drawLabel('RECYCLER',q.x,q.y,'#b6cf79');}}
  get isOpen(){return !this.root.hidden;}show(){this.root.hidden=false;}close(){this.root.hidden=true;this.dragging=false;}
  update(p:Vec3,yaw:number,waypoint?:{x:number;z:number},packs:Vec3[]=[]){if(!this.isOpen)return;const c=this.ctx,size=this.env.terrain.size;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.pixels,this.pixels);c.setTransform(this.zoom,0,0,this.zoom,this.pan.x,this.pan.y);c.drawImage(this.base,0,0);if(waypoint){const q=worldToMap(waypoint,size,this.pixels);c.strokeStyle='#f0ad63';c.lineWidth=3/this.zoom;c.strokeRect(q.x-8,q.y-8,16,16);}for(const pack of packs){const q=worldToMap(pack,size,this.pixels);c.save();c.translate(q.x,q.y);c.rotate(Math.PI/4);c.fillStyle='#d88955';c.strokeStyle='#f1d0a0';c.lineWidth=2/this.zoom;c.fillRect(-6,-6,12,12);c.strokeRect(-6,-6,12,12);c.restore();}const q=worldToMap(p,size,this.pixels);c.save();c.translate(q.x,q.y);c.rotate(-yaw);c.fillStyle='#f0f4e4';c.strokeStyle='#1a2728';c.lineWidth=2/this.zoom;c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();c.setTransform(1,0,0,1,0,0);}
  dispose(){this.root.remove();}
}
