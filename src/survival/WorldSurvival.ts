import type {CollisionBox} from '../physics/PhysicsWorld';
import * as T from 'three';
import type {Environment} from '../rendering/environment';
import type {GameState,ItemId,Vec3,WorldRevision} from '../core/types';
import {ensureProgression} from './progression';
import {createStation,type Station} from './stations';
import {woodMaterial} from '../rendering/materials';
import {randomSource} from '../world/noise';
import {fillPoiLoot,fillSalvageLoot,fillSecureCacheLoot,initializeWorldEconomy,rollPoiLootTier,type LootTier} from './economy';
import type {IslandTerrain} from '../terrain/island';
import {TerrainRoadRouter,roadGeometry} from '../terrain/roads';
import {groundTexture} from '../world/materials';
import {surfaceClimate} from '../world/climate';
import {createRadioSignalEvent,updateWashedAshoreEvent} from './events';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export interface Landmark {id:string;name:string;position:Vec3;kind:number}
const NAMES=['Coastal utility shack','Collapsed relay site','Quarry outpost','Overgrown camp','Stormwatch Station','Breakwater Cargo Wreck','Tidal Survey Pier','Highland Relay'];
export const worldToMap=(p:{x:number;z:number},size:number,pixels:number)=>({x:(p.x+size/2)/size*pixels,y:(p.z+size/2)/size*pixels});
export const mapToWorld=(p:{x:number;y:number},size:number,pixels:number)=>({x:p.x/pixels*size-size/2,z:p.y/pixels*size-size/2});

export interface WorldLayout{pois:Landmark[];trails:Vec3[][]}
export function generateWorldLayout(terrain:IslandTerrain,spawn:Vec3,colliders:CollisionBox[],seed:number,revision:WorldRevision=5):WorldLayout{
  const pois:Landmark[]=[],trails:Vec3[][]=[],rand=randomSource(seed+1939);
  const poiCount=terrain.generation===5&&revision>=6?8:terrain.generation===5&&revision>=5?6:terrain.generation===5&&revision>=4?5:4,scale=terrain.generation===5&&revision>=6?1.3:1;
  // Revision-6 shoreline landmarks need enough dry margin for the road router's endpoint grid; legacy layouts keep their original coast height.
  for(let k=0;k<poiCount;k++){let best:Vec3|null=null,score=Infinity;const angle=k===5?Math.PI/2+.06:k===6?-Math.PI/2+.15:k===7?-Math.PI/2-.27:k*Math.PI/2+.5+(rand()-.5)*.38,attempts=revision>=6?4200:2800;for(let i=0;i<attempts;i++){const a=angle+Math.sin(i*2.31+seed)*.67,r=(terrain.generation===5?155+(i%325):terrain.generation>=4?96+(i%215):82+(i%175))*scale,x=Math.cos(a)*r,z=Math.sin(a)*r,y=terrain.heightAt(x,z),coastal=k===5||k===6,legacyWreck=k===5&&revision<6,highland=k===7,minCoastalHeight=terrain.generation===5&&revision>=6?1.8:legacyWreck?1.45:.6;if(coastal?(y<minCoastalHeight||y>(legacyWreck?10:5)||terrain.biomeAt(x,z)!=='COAST'):highland?(y<24||y>63||!['ROCKY MOUNTAIN','SNOW / ALPINE'].includes(terrain.biomeAt(x,z))):(y<3||y>(terrain.generation===5?52:36)))continue;const slope=terrain.slopeAt(x,z);if(slope>(coastal?.24:.36))continue;if(Math.hypot(x-spawn.x,z-spawn.z)<90||pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<110))continue;const nearby=(terrain.generation===5&&revision===2?[]:colliders).some(c=>Math.abs(c.position.x-x)<5+c.halfExtents.x&&Math.abs(c.position.z-z)<5+c.halfExtents.z);if(nearby)continue;const targetRadius=(coastal?(k===5?420:485):highland?260:terrain.generation===5?300:175)*scale,rank=slope+Math.abs(r-targetRadius)*.001;if(rank<score){score=rank;best={x,y,z};}}if(best)pois.push({id:`poi-${k}`,name:NAMES[k]!,position:best,kind:k});}
  let from=spawn;const ordered=terrain.generation===5?(()=>{const remaining=[...pois],route:Landmark[]=[];let cursor=spawn;while(remaining.length){let best=0,bestDistance=Infinity;remaining.forEach((poi,index)=>{const d=Math.hypot(poi.position.x-cursor.x,poi.position.z-cursor.z);if(d<bestDistance){best=index;bestDistance=d;}});const next=remaining.splice(best,1)[0]!;route.push(next);cursor=next.position;}return route;})():pois;
  const router=terrain.generation===5&&revision>=2?new TerrainRoadRouter(terrain):null;
  for(const poi of ordered){if(router){trails.push(router.route(from,poi.position));from=poi.position;continue;}const points:Vec3[]=[],distance=Math.hypot(poi.position.x-from.x,poi.position.z-from.z),segments=Math.ceil(distance/3);for(let i=0;i<=segments;i++){const t=i/segments;let x=T.MathUtils.lerp(from.x,poi.position.x,t)+Math.sin(t*Math.PI)*Math.sin(seed+i*.03)*8,z=T.MathUtils.lerp(from.z,poi.position.z,t),y=terrain.heightAt(x,z);if(terrain.generation===5&&y<1){for(let j=1;j<=12&&y<1;j++){const pull=j/12*.86;x=T.MathUtils.lerp(x,0,pull);z=T.MathUtils.lerp(z,0,pull);y=terrain.heightAt(x,z);}}points.push({x,y:y+.08,z});}trails.push(points);from=poi.position;}
  return {pois,trails};
}

export class WorldSurvival {
  readonly pois:Landmark[]=[];readonly recyclers:Vec3[]=[];readonly group=new T.Group();readonly trails:Vec3[][]=[];
  private readonly eventSiteCache=new Map<number,Vec3|null>();
  private wood=woodMaterial('#696858');private metal=new T.MeshStandardMaterial({color:0x64706b,roughness:.88,metalness:.3});private rust=new T.MeshStandardMaterial({color:0x91694d,roughness:.92,metalness:.18});private paint=new T.MeshStandardMaterial({color:0x52645c,roughness:.78,metalness:.36});private chartPaper=new T.MeshStandardMaterial({color:0xb3a77f,roughness:1,emissive:0x655a37,emissiveIntensity:.45});private glass=new T.MeshStandardMaterial({color:0x77979a,roughness:.28,metalness:.12,transparent:true,opacity:.38,depthWrite:false,emissive:0x162426,emissiveIntensity:.16});private display=new T.MeshStandardMaterial({color:0x588879,roughness:.4,metalness:.12,emissive:0x42b98c,emissiveIntensity:.72});private bridgeDisplay=new T.MeshStandardMaterial({color:0x34443d,roughness:.62,metalness:.12,emissive:0x17251c,emissiveIntensity:.22});private bridgeLamp=new T.MeshStandardMaterial({color:0xb28a50,roughness:.75,emissive:0x9b6830,emissiveIntensity:.32});private cloth=new T.MeshStandardMaterial({color:0x6b755d,roughness:1,side:T.DoubleSide});private stormCloth=new T.MeshStandardMaterial({color:0xb56c43,roughness:.96,side:T.DoubleSide});private sludge=new T.MeshStandardMaterial({color:0x4d5941,roughness:.38,metalness:.04,transparent:true,opacity:.73,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,emissive:0x0d1209,emissiveIntensity:.12,side:T.DoubleSide});private road=new T.MeshStandardMaterial({color:0x725f43,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  private readonly relayMast=new T.CylinderGeometry(.08,.2,8.4,6,5);private readonly relayDish=new T.SphereGeometry(.48,9,6,0,Math.PI*2,0,Math.PI*.58);
  constructor(private env:Environment,scene:T.Scene,private seed:number){
    scene.add(this.group);const layout=env.layout??generateWorldLayout(env.terrain,env.spawn,env.colliders,seed,env.worldRevision);this.pois.push(...layout.pois);this.trails.push(...layout.trails);for(const poi of this.pois)this.make(poi);if(env.terrain.generation===5&&env.worldRevision>=2){this.road.color.set(0xffffff);this.road.vertexColors=true;this.road.map=groundTexture('dirt',713);this.road.transparent=true;this.road.depthWrite=false;this.road.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat edge=min(vMapUv.x,1.-vMapUv.x);diffuseColor.a*=smoothstep(0.,.17,edge);diffuseColor.rgb*=.88+.12*sin(vMapUv.x*18.);');};}for(const points of this.trails)this.makeRoad(points);
  }
  private makeRoad(points:Vec3[]){if(points.length<2)return;if(this.env.terrain.generation===5&&this.env.worldRevision>=2){const mesh=new T.Mesh(roadGeometry(points,this.env.terrain),this.road);mesh.receiveShadow=true;mesh.name='Terrain-following island road';this.group.add(mesh);return;}const vertices:number[]=[],indices:number[]=[],width=this.env.terrain.generation===5?2.8:1.5;for(let i=0;i<points.length;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;vertices.push(p.x+nx*width,p.y,p.z+nz*width,p.x-nx*width,p.y,p.z-nz*width);if(i<points.length-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,this.road);mesh.receiveShadow=true;mesh.name='Terrain-following island road';this.group.add(mesh);}
  private box(g:T.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
  private make(p:Landmark){
    const g=new T.Group();g.name=p.id;g.position.set(p.position.x,p.position.y,p.position.z);this.group.add(g);
    if(p.kind===1){
      // A narrow, damaged antenna restores a useful skyline cue without rebuilding the old bulky scaffold.
      for(let i=0;i<6;i++){const beam=this.box(g,-1.7+i*.65,.12+(i%2)*.08,(i%3-1)*.58,1.05,.11,.13,this.metal);beam.rotation.y=(i*.71)%Math.PI;beam.rotation.z=(i%2?.08:-.06);}
      const powerUnit=this.box(g,.8,.23,-.7,1.55,.32,.85,this.metal);powerUnit.name='Collapsed relay power cabinet';this.box(g,-.75,.16,.7,1.2,.2,.65,this.wood);
      const mast=new T.Mesh(this.relayMast,this.metal);mast.name='Weathered relay mast';mast.position.set(-2.15,4.2,.35);mast.rotation.z=-.035;mast.castShadow=true;g.add(mast);
      const brace=this.box(g,-2.12,5.9,.38,2.25,.075,.075,this.rust);brace.rotation.z=-.04;
      const dish=new T.Mesh(this.relayDish,this.rust);dish.name='Relay reflector';dish.position.set(-2.4,6.4,.43);dish.rotation.set(.38,.22,.72);dish.scale.set(1,.72,.20);dish.castShadow=true;g.add(dish);
      const puddle=()=>{const geometry=new T.CircleGeometry(1,20),position=geometry.getAttribute('position');for(let i=1;i<position.count;i++){const x=position.getX(i),y=position.getY(i),angle=Math.atan2(y,x),radius=.82+.11*Math.sin(angle*3+.4)+.07*Math.cos(angle*5-.2);position.setXY(i,x*radius,y*radius);}geometry.computeVertexNormals();return geometry;};
      for(const [x,z,sx,sz] of [[.45,1.35,2.15,1.25],[-1.35,2.35,.72,.46],[2.1,2.45,.55,.34]] as const){const runoff=new T.Mesh(puddle(),this.sludge);runoff.name='Leaking battery residue';runoff.rotation.x=-Math.PI/2;runoff.position.set(x,.035,z);runoff.scale.set(sx,sz,1);runoff.receiveShadow=true;g.add(runoff);}
      for(const [x,z,rotation] of [[1.25,1.05,.1],[2.15,.2,-.08],[-.25,2.4,.18]] as const){const drum=new T.Group();drum.position.set(x,.03,z);drum.rotation.y=rotation;g.add(drum);const body=new T.Mesh(new T.CylinderGeometry(.27,.30,.82,10,1),this.rust);body.castShadow=body.receiveShadow=true;drum.add(body);const rim=new T.Mesh(new T.TorusGeometry(.275,.025,5,12),this.metal);rim.rotation.x=Math.PI/2;rim.position.y=.33;drum.add(rim);drum.name='Corroded battery drum';}
      if(this.env.terrain.generation===5&&this.env.worldRevision>=6){
        // An exposed field console makes the collapsed relay read as abandoned
        // infrastructure rather than a mast surrounded by anonymous boxes.
        const fascia=this.box(g,.8,.235,-.238,1.16,.225,.035,this.paint);fascia.name='Collapsed relay exposed control fascia';
        const display=this.box(g,.78,.285,-.214,.38,.105,.012,this.display);display.name='Collapsed relay diagnostic screen';
        for(let vent=0;vent<5;vent++){const slot=this.box(g,.36+vent*.085,.20,-.211,.025,.092,.012,this.metal);slot.name='Collapsed relay cabinet cooling slot';}
        for(let button=0;button<3;button++){const control=new T.Mesh(new T.CylinderGeometry(.017,.017,.018,8),button===1?this.display:this.rust);control.name='Collapsed relay manual control';control.position.set(.99+button*.09,.16,-.207);control.rotation.x=Math.PI/2;g.add(control);}
        const looseHatch=this.box(g,1.61,.37,-.66,.055,.30,.53,this.rust);looseHatch.name='Collapsed relay hanging cabinet hatch';looseHatch.rotation.y=.42;looseHatch.rotation.z=-.31;
        const cableStart=new T.Vector3(.78,.055,-.215);for(const [x,z] of [[1.25,1.05],[2.15,.2]] as const){const end=new T.Vector3(x,.045,z),delta=end.clone().sub(cableStart),cable=new T.Mesh(new T.CylinderGeometry(.018,.024,delta.length(),5),this.wood);cable.name='Collapsed relay severed ground cable';cable.position.copy(cableStart).add(end).multiplyScalar(.5);cable.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());g.add(cable);}
        this.mergeStaticLandmarkMeshes(g);
      }
    }else if(p.kind===4){
      // A compact, wind-battered field station gives the outer island a readable storm-survey landmark.
      const revisionSixStormwatch=this.env.terrain.generation===5&&this.env.worldRevision>=6,roofLift=revisionSixStormwatch?.5:0;
      this.box(g,-.45,.14,.12,3.1,.22,2.65,this.metal);
      for(const x of [-1.72,.82])for(const z of [-.92,1.16])this.box(g,x,revisionSixStormwatch?1.08:.88,z,.13,revisionSixStormwatch?1.85:1.45,.13,this.wood);
      this.box(g,-.45,.78,-.89,2.45,1.23,.12,this.cloth);
      if(revisionSixStormwatch){
        // Leave a full-height central entry so the field log is reachable.
        this.box(g,-1.30,.78,1.13,.75,1.23,.12,this.metal).name='Stormwatch entry left wall';
        this.box(g,.40,.78,1.13,.75,1.23,.12,this.metal).name='Stormwatch entry right wall';
        for(const x of [-.925,.025])this.box(g,x,.78,1.13,.07,1.23,.15,this.rust).name='Stormwatch entry jamb';
      }else this.box(g,-.45,.78,1.13,2.45,1.23,.12,this.metal);
      this.box(g,-1.67,1.48+roofLift,.12,.15,.14,2.05,this.rust);this.box(g,.77,1.48+roofLift,.12,.15,.14,2.05,this.rust);
      this.box(g,-.45,1.61+roofLift,.12,2.65,.17,2.85,this.metal).rotation.z=-.045;
      const mast=new T.Mesh(new T.CylinderGeometry(.065,.11,4.2,7),this.metal);mast.name='Stormwatch wind mast';mast.position.set(1.72,2.25,.38);mast.castShadow=true;g.add(mast);
      if(this.env.terrain.generation===5&&this.env.worldRevision>=6){const windAngle=randomSource(this.seed+9004)()*Math.PI*2,windSock=new T.Mesh(new T.CylinderGeometry(.052,.125,.78,8,4,true),this.stormCloth);windSock.name='Stormwatch windsock';windSock.position.set(1.96,4.05,.38);windSock.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.cos(windAngle),.04,Math.sin(windAngle)).normalize());windSock.castShadow=true;g.add(windSock);}
      const arm=this.box(g,1.72,4.29,.38,.86,.055,.055,this.rust);arm.name='Stormwatch vane arm';
      const vane=this.box(g,2.1,4.42,.38,.48,.06,.12,this.rust);vane.rotation.z=-.16;
      for(const [x,z] of [[1.48,.38],[1.96,.62],[1.96,.14]] as const){const cup=new T.Mesh(new T.SphereGeometry(.105,7,5),this.cloth);cup.name='Stormwatch anemometer cup';cup.position.set(x,4.1,z);g.add(cup);}
      const panel=this.box(g,-.48,1.87+roofLift,.36,1.05,.07,.72,this.metal);panel.name='Stormwatch weather instrument panel';panel.rotation.x=-.22;
      const solar=this.box(g,-.45,1.81+roofLift,-.78,1.36,.055,.88,this.paint);solar.name='Stormwatch solar array';solar.rotation.x=-.18;
      for(const x of [-1.13,-.79,-.45,-.11,.23]){const cell=this.box(g,x,1.846+roofLift,-.78,.025,.012,.81,this.metal);cell.rotation.x=-.18;cell.name='Stormwatch solar cell divider';}
      for(const z of [-1.21,-.35]){const rail=this.box(g,-.45,1.85+roofLift,z,1.43,.035,.045,this.rust);rail.rotation.x=-.18;rail.name='Stormwatch solar array frame';}
      this.box(g,.48,.88,-.96,.42,.72,.08,this.rust);
      if(this.env.terrain.generation===5&&this.env.worldRevision>=6){
        // The sheltered station gains a small field desk and rain log, all
        // merged into its existing static material batches.
        const desk=this.box(g,-.48,.66,.12,.92,.075,.46,this.wood);desk.name='Stormwatch field log desk';
        for(const x of [-.86,-.10])for(const z of [-.04,.28]){const leg=this.box(g,x,.44,z,.055,.39,.055,this.wood);leg.name='Stormwatch field desk leg';}
        const log=this.box(g,-.48,.701,.105,.48,.012,.31,this.chartPaper);log.name='Stormwatch rain log clipboard';
        for(let line=0;line<5;line++){const mark=this.box(g,-.62+line*.07,.710,-.005+(line%2)*.13,.045,.003,.004,this.rust);mark.name='Stormwatch rain log trace';mark.rotation.y=(line%2?.08:-.06);}
        const clip=this.box(g,-.48,.712,-.045,.09,.012,.025,this.metal);clip.name='Stormwatch clipboard clamp';
      }
      this.mergeStaticLandmarkMeshes(g);
    }else if(p.kind===6){
      // A tidal instrument pier has visible structural bracing and a working gauge face.
      const revisionSixTidal=this.env.terrain.generation===5&&this.env.worldRevision>=6;
      for(const x of [-2.65,2.65])for(const z of [-.6,2.45]){const pile=this.box(g,x,-.28,z,.22,2.2,.22,this.wood);pile.name='Tidal pier timber pile';}
      for(const z of [-.6,2.45])for(const direction of [-1,1]){const brace=this.box(g,0,-.24,z,5.45,.105,.11,this.rust);brace.rotation.z=direction*.29;brace.name='Tidal pier under-deck crossbrace';}
      this.box(g,0,.82,.9,6.4,.2,4.4,this.wood).name='Tidal survey deck';
      for(let i=0;i<9;i++){const plank=this.box(g,-2.8+i*.7,.94,.9,.62,.06,4.25,i%3===0?this.rust:this.wood);plank.name='Salt-worn pier plank';}
      this.box(g,-1.45,1.44,.2,.8,.9,.72,this.metal).name='Tidal instrument housing';
      this.box(g,-1.45,1.45,.595,.56,.43,.055,this.paint).name='Tidal gauge faceplate';
      this.box(g,-1.45,1.48,.631,.35,.23,.025,revisionSixTidal?this.paint:this.display).name='Tidal level display';
      if(revisionSixTidal){
        // Mark the physical level readout without adding another material batch.
        for(let mark=0;mark<5;mark++){
          const graduation=this.box(g,-1.574,1.395+mark*.041,.651,.048-(mark%2)*.013,.006,.006,this.chartPaper);
          graduation.name='Tidal level graduation';
        }
        const pointer=this.box(g,-1.425,1.475,.651,.018,.145,.006,this.rust);pointer.name='Tidal level pointer';
      }
      for(let button=0;button<3;button++){const knob=new T.Mesh(new T.CylinderGeometry(.045,.045,.04,8),button===0?this.rust:this.metal);knob.name='Tidal instrument control';knob.position.set(-1.64+button*.19,1.19,.62);knob.rotation.x=Math.PI/2;knob.castShadow=true;g.add(knob);}
      const gauge=new T.Mesh(new T.CylinderGeometry(.045,.055,1.45,7),this.metal);gauge.name='Tidal height gauge';gauge.position.set(2.62,1.75,-1.08);gauge.castShadow=true;g.add(gauge);
      for(let mark=0;mark<8;mark++){const stripe=this.box(g,2.62,1.18+mark*.16,-1.03,.18,.035,.035,mark%2===0?this.rust:this.cloth);stripe.name='Tidal gauge calibration mark';}
      for(const x of [-2.65,2.65]){const cleat=new T.Mesh(new T.TorusGeometry(.16,.035,5,10),this.rust);cleat.name='Tidal pier mooring ring';cleat.position.set(x,1.05,.1);cleat.rotation.x=Math.PI/2;cleat.castShadow=true;g.add(cleat);}
      const pole=new T.Mesh(new T.CylinderGeometry(.045,.08,7.2,7),this.metal);pole.name='Tidal survey mast';pole.position.set(2.2,4.3,-.1);pole.castShadow=true;g.add(pole);
      const dish=new T.Mesh(this.relayDish,this.rust);dish.name='Tidal survey reflector';dish.position.set(2.2,7.2,-.1);dish.rotation.set(.3,0,.5);dish.scale.set(.8,.58,.18);g.add(dish);
      if(this.env.terrain.generation===5&&this.env.worldRevision>=6){
        // Field samples and a marked log give this bare instrument platform a
        // clear survey purpose without changing its gameplay footprint.
        for(const x of [.22,1.34])for(const z of [-.12,.58])this.box(g,x,1.055,z,.075,.16,.075,this.rust).name='Tidal sample bench leg';
        this.box(g,.78,1.17,.23,1.22,.07,.82,this.metal).name='Tidal sample workbench';
        this.box(g,.48,1.212,.18,.43,.018,.52,this.chartPaper).name='Tidal current field log';
        for(let line=0;line<4;line++){const mark=this.box(g,.48+(line%2?.035:-.035),1.225,.02+line*.09,.27-(line%2)*.035,.009,.012,line===3?this.rust:this.wood);mark.name='Tidal field log notation';mark.rotation.y=line%2?.035:-.025;}
        for(const [index,x] of [.78,1.02,1.26].entries()){
          const vial=new T.Mesh(new T.CylinderGeometry(.065,.078,.20,8),index===1?this.display:this.glass);vial.name='Tidal water sample vial';vial.position.set(x,1.36,.28);vial.castShadow=vial.receiveShadow=true;g.add(vial);
          const cap=new T.Mesh(new T.CylinderGeometry(.076,.076,.035,8),index===0?this.display:this.rust);cap.name='Tidal sample vial cap';cap.position.set(x,1.478,.28);cap.castShadow=cap.receiveShadow=true;g.add(cap);
        }
        const rope=new T.Mesh(new T.TorusGeometry(.19,.035,5,12),this.wood);rope.name='Tidal survey rope coil';rope.position.set(-2.48,1.015,.12);rope.rotation.x=Math.PI/2;rope.castShadow=rope.receiveShadow=true;g.add(rope);
      }
      this.mergeStaticLandmarkMeshes(g);
    }else if(p.kind===7){
      // A ridge-top triangular relay frame breaks the skyline and helps long-range navigation.
      for(const [x,z] of [[-1.45,-1],[1.45,-1],[0,1.55]] as const){const leg=this.box(g,x,5.2,z,.16,10.4,.16,this.metal);leg.rotation.z=x<0?-.19:x>0?.19:0;leg.name='Highland relay tower leg';}
      for(let y=1.5;y<10;y+=2.1){for(const direction of [-1,1]){const brace=this.box(g,0,y,0,3.2,.075,.075,this.rust);brace.rotation.z=direction*(.35+(y%2)*.24);brace.name='Highland relay lattice crossbrace';}}
      for(const x of [-.28,.28]){const rail=this.box(g,x,4.55,1.64,.055,8.8,.055,this.metal);rail.name='Highland relay access ladder';}
      for(let rung=0;rung<18;rung++){const step=this.box(g,0,.45+rung*.48,1.65,.62,.045,.055,this.rust);step.name='Highland relay access ladder rung';}
      this.box(g,0,10.65,0,2.5,.2,.2,this.wood).name='Highland relay crossarm';
      const dish=new T.Mesh(this.relayDish,this.rust);dish.name='Highland relay dish';dish.position.set(-.55,11.6,.1);dish.rotation.set(1.06,.73,0);dish.scale.set(2.2,1.7,.28);dish.castShadow=true;g.add(dish);
      this.box(g,2.45,.74,.15,.88,1.34,.76,this.metal).name='Highland relay control cabinet';
      this.box(g,2.45,.82,.555,.62,.88,.045,this.paint).name='Highland relay cabinet door';
      for(let vent=0;vent<6;vent++){const slot=this.box(g,2.45,.68+vent*.095,.586,.36,.027,.018,this.rust);slot.name='Highland relay cabinet vent';}
      this.box(g,2.45,1.06,.602,.32,.17,.025,this.display).name='Highland relay status display';
      for(const x of [-.7,.65]){const cable=this.box(g,(x+2.18)*.5,.26,.12,Math.hypot(2.18-x,.12),.035,.035,this.rust);cable.rotation.z=Math.atan2(.12,2.18-x);cable.name='Highland relay ground cable';}
      const beacon=new T.Mesh(new T.SphereGeometry(.13,8,6),this.display);beacon.name='Highland relay signal beacon';beacon.position.set(0,12.95,0);beacon.castShadow=true;beacon.receiveShadow=true;g.add(beacon);
      this.mergeStaticLandmarkMeshes(g);
    }else if(p.kind===5){
      // A stranded coastal hauler creates a readable silhouette from its broken mast and stacked cargo.
      const profile=new T.Shape();profile.moveTo(-3.8,-.66);profile.lineTo(2.75,-.66);profile.lineTo(4,-.18);profile.lineTo(2.65,.7);profile.lineTo(-3.8,.7);profile.closePath();
      const hullGeometry=new T.ExtrudeGeometry(profile,{depth:.9,bevelEnabled:false});hullGeometry.rotateX(Math.PI/2);hullGeometry.translate(0,.92,-.45);
      const hull=new T.Mesh(hullGeometry,this.rust);hull.name='Breakwater split cargo hull';hull.castShadow=hull.receiveShadow=true;g.add(hull);
      this.box(g,-.85,1.18,0,1.4,.84,1.1,this.metal).rotation.z=-.08;
      for(const [x,z] of [[1.05,-.35],[2.25,.35]] as const){const container=this.box(g,x,1.08,z,1.55,.75,.82,this.rust);container.name='Breakwater corroded cargo';container.rotation.y=z<0?-.04:.06;}
      this.box(g,-2.45,2.05,.08,.12,2.45,.12,this.metal).rotation.z=.21;
      this.box(g,-2.13,2.65,.08,.72,.07,.07,this.wood).rotation.z=-.18;
      this.box(g,3.18,.72,.02,.16,.48,.14,this.wood).rotation.z=.3;
      if(this.env.worldRevision>=6){
        // Revision 6 turns the wreck into a readable stranded work site while keeping its gameplay IDs.
        this.box(g,-.25,1.23,0,5.1,.12,1.45,this.metal).name='Breakwater buckled deck plate';
        // Uneven field repairs interrupt the broad hull color and make its
        // exposed sides read as patched steel without adding separate draws.
        const hullRepairs=[[-2.55,.34,.82,.26,-.055],[-1.38,.53,1.02,.31,.035],[-.12,.39,.78,.24,-.04],[1.10,.55,1.04,.29,.045],[2.22,.34,.56,.22,-.065]] as const;
        for(const side of [-1,1])for(const [index,[x,y,width,height,tilt]] of hullRepairs.entries()){
          const plate=this.box(g,x,y,side*.704,width,height,.035,this.metal);plate.rotation.z=tilt;plate.name='Breakwater hull repair plate';
          const stripe=this.box(g,x+width*.20,y-height*.20,side*.728,.035,height*.56,.018,this.rust);stripe.rotation.z=tilt*.45;stripe.name='Breakwater hull rust streak';
          for(const dx of [-width*.36,width*.36])for(const dy of [-height*.31,height*.31]){const rivet=this.box(g,x+dx,y+dy,side*.731,.042,.042,.025,index%3===0?this.rust:this.paint);rivet.name='Breakwater hull repair rivet';}
        }
        const waterline=this.box(g,-.18,.19,.716,3.8,.075,.022,this.paint);waterline.name='Breakwater oxidized waterline';
        const oppositeWaterline=this.box(g,-.18,.19,-.716,3.8,.075,.022,this.paint);oppositeWaterline.name='Breakwater oxidized waterline';
        // Assemble the wheelhouse around real window openings so the exposed
        // bridge reads as a flooded, abandoned workspace rather than a box.
        this.box(g,-1.48,1.34,.04,1.2,.10,.96,this.paint).name='Breakwater weather station cabin';
        const revisionSixBridge=this.env.terrain.generation===5&&this.env.worldRevision>=6;
        this.box(g,-1.48,revisionSixBridge?2.20:1.70,-.42,1.2,revisionSixBridge?1.82:.82,.08,this.paint).name='Breakwater cabin aft bulkhead';
        this.box(g,-2.04,revisionSixBridge?2.20:1.70,.04,.08,revisionSixBridge?1.82:.82,.96,this.paint).name='Breakwater cabin port bulkhead';
        this.box(g,-.92,1.44,-.34,.08,.30,.24,this.paint).name='Breakwater cabin starboard lower bulkhead';
        this.box(g,-.92,1.96,-.34,.08,.30,.24,this.paint).name='Breakwater cabin starboard upper bulkhead';
        this.box(g,-.92,revisionSixBridge?2.20:1.70,-.005,.08,revisionSixBridge?1.82:.82,.11,this.paint).name='Breakwater cabin starboard forward post';
        this.box(g,-.92,revisionSixBridge?2.20:1.70,.415,.08,revisionSixBridge?1.82:.82,.13,this.paint).name='Breakwater cabin starboard aft post';
        // Twin front panes span most of the forward wall; leave a center pier
        // and narrow outer posts to keep the sightline into the cabin open.
        if(revisionSixBridge){
          // Open a standing-height central doorway and lift the Rev6 wheelhouse roof.
          // Older revisions retain the sealed, low cabin geometry below.
          for(const x of [-1.955,-1.005]){
            this.box(g,x,1.44,.52,.25,.30,.08,this.paint).name='Breakwater Rev6 doorway lower side';
            this.box(g,x,2.60,.52,.25,1.08,.08,this.paint).name='Breakwater Rev6 doorway upper side';
          }
          this.box(g,-1.48,3.20,.04,1.48,.13,1.18,this.rust).name='Breakwater Rev6 raised wheelhouse roof';
          for(const x of [-1.95,-1.01]){this.box(g,x,1.77,.535,.24,.34,.035,this.glass).name='Breakwater bridge window';this.box(g,x,1.98,.56,.40,.045,.045,this.rust);}
        }else{
          this.box(g,-1.48,1.44,.52,1.2,.30,.08,this.paint);
          this.box(g,-1.48,2.06,.52,1.2,.24,.08,this.paint);
          this.box(g,-1.48,2.15,.04,1.48,.13,1.18,this.rust).rotation.z=-.035;
          for(const x of [-1.82,-1.18]){this.box(g,x,1.77,.535,.37,.34,.035,this.glass).name='Breakwater bridge window';this.box(g,x,1.98,.56,.40,.045,.045,this.rust);}
        }
        this.box(g,-.86,1.78,.04,.035,.35,.62,this.glass).name='Breakwater side window';
        const chart=this.box(g,-1.48,1.56,.21,.70,.12,.34,this.metal);chart.name='Breakwater bridge chart console';
        if(revisionSixBridge){
          // The old high-emissive mint rectangle read like a modern arcade HUD.
          // Revision 6 gets a dim, layered marine instrument board while older
          // saved world revisions retain their original landmark appearance.
          const fascia=this.box(g,-1.48,1.685,.295,.50,.205,.075,this.rust);fascia.name='Breakwater revision-6 instrument fascia';
          const bezel=this.box(g,-1.51,1.691,.252,.34,.105,.022,this.metal);bezel.name='Breakwater revision-6 display bezel';
          const instrument=this.box(g,-1.51,1.691,.237,.292,.061,.012,this.bridgeDisplay);instrument.name='Breakwater weather instrument display';
          for(let i=0;i<4;i++){const trace=this.box(g,-1.60+(i%2)*.18,1.681+Math.floor(i/2)*.023,.229,.10,.003,.004,i===0?this.bridgeLamp:this.bridgeDisplay);trace.name='Breakwater revision-6 instrument trace';}
          for(let i=0;i<3;i++){const indicator=new T.Mesh(new T.SphereGeometry(.018,6,4),i===1?this.bridgeLamp:this.bridgeDisplay);indicator.name='Breakwater revision-6 instrument indicator';indicator.position.set(-1.32+i*.075,1.744,.248);g.add(indicator);}
          const lamp=this.box(g,-1.48,3.05,-.10,.25,.045,.15,this.metal);lamp.name='Breakwater revision-6 wheelhouse lamp housing';
          const diffuser=this.box(g,-1.48,3.018,-.10,.17,.012,.085,this.bridgeLamp);diffuser.name='Breakwater revision-6 wheelhouse lamp diffuser';
          const workLight=new T.PointLight(0xffd39a,.45,3.4,2);workLight.name='Breakwater revision-6 wheelhouse work light';workLight.position.set(-1.48,2.99,-.10);g.add(workLight);
          const compassBase=new T.Mesh(new T.CylinderGeometry(.078,.086,.022,12),this.rust);compassBase.name='Breakwater revision-6 helm compass bezel';compassBase.position.set(-1.17,1.676,.247);compassBase.rotation.x=Math.PI/2;g.add(compassBase);
          const compassFace=new T.Mesh(new T.CircleGeometry(.061,12),this.chartPaper);compassFace.name='Breakwater revision-6 helm compass face';compassFace.position.set(-1.17,1.676,.232);g.add(compassFace);
          const compassNeedle=this.box(g,-1.17,1.676,.224,.009,.074,.004,this.rust);compassNeedle.name='Breakwater revision-6 helm compass needle';
          for(let tick=0;tick<8;tick++){const angle=tick*Math.PI/4,mark=this.box(g,-1.17+Math.sin(angle)*.046,1.676+Math.cos(angle)*.046,.222,.004,.013,.003,this.metal);mark.name='Breakwater revision-6 compass graduation';mark.rotation.z=-angle;}
        }else{
          const instrument=this.box(g,-1.48,1.666,.30,.34,.075,.045,this.display);instrument.name='Breakwater weather instrument display';instrument.rotation.x=-.18;
        }
        for(let i=0;i<3;i++){const dial=this.box(g,-1.61+i*.13,1.708,.34,.04,.014,.012,i===1?this.rust:this.metal);dial.name='Breakwater bridge control dial';}
        const chartMap=this.box(g,-1.55,1.646,.105,.38,.014,.20,this.chartPaper);chartMap.name='Breakwater charted coast map';
        for(let line=0;line<4;line++){const contour=this.box(g,-1.55+(line%2?.025:-.02),1.658,.045+line*.039,.29-(line%2)*.035,.004,.006,this.rust);contour.name='Breakwater map contour line';contour.rotation.y=line%2?-.08:.06;}
        const route=this.box(g,-1.50,1.661,.103,.20,.006,.008,this.rust);route.name='Breakwater marked evacuation route';route.rotation.y=.31;
        for(const [x,z] of [[-1.70,.08],[-1.41,.13],[-1.45,.17]] as const){const marker=new T.Mesh(new T.CylinderGeometry(.009,.009,.006,6),this.display);marker.name='Breakwater coastal chart waypoint';marker.position.set(x,1.669,z);g.add(marker);}
        const seat=this.box(g,-1.48,1.50,-.08,.31,.08,.28,this.wood);seat.name='Breakwater bridge operator seat';
        const seatBack=this.box(g,-1.48,1.70,-.20,.31,.35,.07,this.wood);seatBack.name='Breakwater bridge operator seat';seatBack.rotation.x=-.10;
        const stack=new T.Mesh(new T.CylinderGeometry(.10,.14,.72,7),this.rust);stack.name='Breakwater exhaust stack';stack.position.set(-2.24,2.23,-.2);stack.castShadow=true;g.add(stack);
        this.box(g,-2.24,2.61,-.2,.28,.07,.28,this.metal).name='Breakwater exhaust cap';
        for(const x of [-3.15,3.62]){const bollard=this.box(g,x,1.42,.68,.15,.37,.15,this.metal);bollard.name='Breakwater mooring bollard';}
        for(let i=0;i<8;i++){const seam=this.box(g,-2.7+i*.7,1.31,-.73,.035,.018,1.38,this.rust);seam.name='Breakwater deck seam';}
        for(const [x,z] of [[-3.15,-.35],[-2.3,.48],[-1.2,-.5],[.1,.54],[2.5,-.5],[3.35,.42]] as const){const rib=this.box(g,x,.62,z,.09,1.28,.09,this.metal);rib.rotation.z=(x<0?-.13:.13)+(z<0?.04:-.04);rib.name='Breakwater exposed hull rib';}
        for(const x of [-3.15,-2.55,2.8,3.45]){const rail=this.box(g,x,1.48,.02,.075,.72,.075,this.rust);rail.rotation.z=x<0?-.19:.14;rail.name='Breakwater torn rail';}
        const crate=this.box(g,-2.0,1.52,-.1,1.05,.72,.82,this.paint);crate.name='Breakwater tilted equipment crate';crate.rotation.z=.17;crate.rotation.y=-.13;
        for(let i=0;i<7;i++){const corrugation=this.box(g,2.25+i*.13,1.47,-.77,.035,.68,.035,this.metal);corrugation.name='Breakwater container ribs';}
        for(const [x,z] of [[-4.3,-.7],[-3.7,1.0],[3.8,-.95],[4.25,.84]] as const){const debris=this.box(g,x,.16,z,.85,.18,.22,this.wood);debris.rotation.y=(x+z)*.12;debris.rotation.z=(x<0?.1:-.14);debris.name='Breakwater shore debris';}
        const cable=new T.Mesh(new T.CylinderGeometry(.018,.024,4.2,5),this.wood);cable.name='Breakwater slack mooring cable';cable.position.set(-3.5,1.05,-.38);cable.rotation.set(.24,.18,Math.PI/2.8);g.add(cable);
        const warning=this.box(g,2.03,1.48,.47,.34,.27,.025,this.rust);warning.name='Breakwater unmarked hazard placard';
        // Lift the broken cargo gear above the low hull so the stranded vessel
        // keeps a readable skyline silhouette beyond the shoreline.
        const derrick=new T.Mesh(new T.CylinderGeometry(.105,.15,16.8,7),this.metal);derrick.name='Breakwater cargo derrick mast';derrick.position.set(.72,8.75,.36);derrick.rotation.z=-.11;derrick.castShadow=true;g.add(derrick);
        const pennantShape=new T.Shape();pennantShape.moveTo(0,0);pennantShape.lineTo(1.50,-.06);pennantShape.lineTo(1.20,-.34);pennantShape.lineTo(1.42,-.76);pennantShape.lineTo(.48,-.62);pennantShape.lineTo(0,-.68);pennantShape.closePath();const pennant=new T.Mesh(new T.ExtrudeGeometry(pennantShape,{depth:.035,bevelEnabled:false}),this.rust);pennant.name='Breakwater torn signal pennant';pennant.position.set(1.30,17.38,.38);pennant.scale.set(1.42,1.30,1);pennant.castShadow=pennant.receiveShadow=true;g.add(pennant);
        const boom=this.box(g,1.72,16.45,.36,4.85,.15,.14,this.rust);boom.name='Breakwater broken cargo boom';boom.rotation.z=-.12;
        const hoist=new T.Mesh(new T.CylinderGeometry(.024,.035,2.6,5),this.metal);hoist.name='Breakwater hanging hoist cable';hoist.position.set(2.62,14.25,.36);hoist.castShadow=true;g.add(hoist);
        const hook=new T.Mesh(new T.TorusGeometry(.13,.032,5,8,Math.PI*1.55),this.rust);hook.name='Breakwater cargo hook';hook.position.set(2.62,12.65,.36);hook.rotation.z=-.45;g.add(hook);
        const cableStart=new T.Vector3(.52,16.9,.36),cableEnd=new T.Vector3(2.48,1.35,.36),cableDelta=cableEnd.clone().sub(cableStart),stay=new T.Mesh(new T.CylinderGeometry(.023,.032,cableDelta.length(),5),this.wood);stay.name='Breakwater snapped derrick stay';stay.position.copy(cableStart).add(cableEnd).multiplyScalar(.5);stay.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),cableDelta.normalize());g.add(stay);
        // A small washed-up cargo spill gives the wreck a grounded beach context.
        // These static pieces join the existing per-material landmark batches.
        const groundY=(x:number,z:number)=>this.env.heightAt(p.position.x+x,p.position.z+z)-p.position.y;
        const palletX=4.65,palletZ=-2.15,palletRotation=.24,palletY=groundY(palletX,palletZ)+.09;
        for(let i=0;i<5;i++){const slat=this.box(g,palletX+(i-2)*.19,palletY,palletZ,.15,.07,1.28,this.wood);slat.rotation.y=palletRotation;slat.name='Breakwater split pallet slat';}
        for(const z of [-.43,.43]){const runner=this.box(g,palletX,palletY-.045,palletZ+z,.94,.08,.12,this.wood);runner.rotation.y=palletRotation;runner.name='Breakwater pallet runner';}
        const drumGeometry=new T.CylinderGeometry(.24,.29,.70,10,2);drumGeometry.rotateZ(Math.PI/2);
        const drum=new T.Mesh(drumGeometry,this.rust);drum.name='Breakwater washed cargo drum';drum.position.set(-4.65,groundY(-4.65,-1.65)+.28,-1.65);drum.rotation.z=.08;drum.castShadow=drum.receiveShadow=true;g.add(drum);
        const buoy=new T.Mesh(new T.CylinderGeometry(.18,.31,.72,8,1),this.rust);buoy.name='Breakwater washed channel buoy';buoy.position.set(5.0,groundY(5.0,-.95)+.38,-.95);buoy.rotation.z=.16;buoy.castShadow=buoy.receiveShadow=true;g.add(buoy);
        const cableCoil=new T.Mesh(new T.TorusGeometry(.34,.035,5,12),this.wood);cableCoil.name='Breakwater stranded cable coil';cableCoil.position.set(-4.0,groundY(-4.0,-2.9)+.36,-2.9);cableCoil.rotation.x=Math.PI/2;g.add(cableCoil);
      }
      this.mergeStaticLandmarkMeshes(g);
    }else if(p.kind===3){const tent=new T.Mesh(new T.ConeGeometry(1.8,2.3,4,1,true),this.cloth);tent.position.y=1.15;tent.rotation.y=Math.PI/4;g.add(tent);this.box(g,-2,.18,0,.3,.3,2,this.wood);
    }else{for(const x of [-2,2])for(const z of [-1.6,1.6])this.box(g,x,1.4,z,.18,2.8,.18,this.wood);for(let i=0;i<12;i++)this.box(g,-2+i*.35,1.2,-1.6,.32,2.4,.12,this.wood);this.box(g,0,2.8,0,4.5,.13,3.8,this.metal).rotation.z=.08;if(p.kind===2)for(let i=0;i<3;i++)this.box(g,3,.35,i*.7,1,.7,.5,this.metal);
      if(this.env.terrain.generation===5&&this.env.worldRevision>=6){
        if(p.kind===0){
          this.box(g,1.05,.78,-.55,1.18,.12,.72,this.metal).name='Utility shack pump bench';
          for(const x of [.60,1.50])for(const z of [-.84,-.26])this.box(g,x,.39,z,.09,.78,.09,this.rust).name='Utility shack bench leg';
          const pump=new T.Mesh(new T.CylinderGeometry(.23,.29,.48,10),this.paint);pump.name='Utility shack water pump';pump.position.set(.94,1.08,-.55);pump.castShadow=true;g.add(pump);
          this.box(g,.94,1.37,-.55,.65,.055,.07,this.rust).name='Utility shack pump handle';
          this.box(g,1.39,.46,.18,.07,.07,1.08,this.rust).name='Utility shack intake pipe';
          const gauge=new T.Mesh(new T.CylinderGeometry(.16,.16,.035,12),this.chartPaper);gauge.name='Utility shack pressure gauge';gauge.position.set(1.45,1.14,-.55);gauge.rotation.z=Math.PI/2;g.add(gauge);
        }else if(p.kind===2){
          this.box(g,.55,.88,-.43,1.55,.10,.85,this.wood).name='Quarry sample table';
          for(const x of [-.12,1.22])for(const z of [-.75,-.1])this.box(g,x,.44,z,.08,.88,.08,this.metal).name='Quarry table leg';
          for(let i=0;i<4;i++){const core=new T.Mesh(new T.CylinderGeometry(.085,.085,.48,7),i%2?this.rust:this.metal);core.name='Quarry core sample';core.position.set(.12+i*.29,1.17,-.45);core.rotation.z=Math.PI/2;core.castShadow=true;g.add(core);}
          this.box(g,.52,1.00,.15,.52,.018,.38,this.chartPaper).name='Quarry sample field chart';
          this.box(g,-1.35,.55,.62,.86,1.05,.14,this.rust).name='Quarry tool rack';
          for(const x of [-1.65,-1.34,-1.03])this.box(g,x,.68,.75,.035,.72,.035,this.metal).name='Quarry hanging tool';
        }
      }
      this.mergeStaticLandmarkMeshes(g);}
  }
  private mergeStaticLandmarkMeshes(group:T.Group){
    type Batch={material:T.Material;castShadow:boolean;receiveShadow:boolean;geometries:T.BufferGeometry[];markers:{name:string;position:T.Vector3}[]};
    const batches=new Map<string,Batch>();
    for(const child of [...group.children]){
      if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;
      child.updateMatrix();const key=`${child.material.uuid}:${child.castShadow}:${child.receiveShadow}`;let batch=batches.get(key);
      if(!batch){batch={material:child.material,castShadow:child.castShadow,receiveShadow:child.receiveShadow,geometries:[],markers:[]};batches.set(key,batch);}
      const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrix);batch.geometries.push(geometry);
      if(child.name)batch.markers.push({name:child.name,position:child.position.clone()});
      group.remove(child);child.geometry.dispose();
    }
    for(const batch of batches.values()){
      const geometry=mergeGeometries(batch.geometries,false);batch.geometries.forEach(part=>part.dispose());
      if(!geometry)throw new Error('Could not batch static landmark geometry');geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,batch.material);mesh.castShadow=batch.castShadow;mesh.receiveShadow=batch.receiveShadow;mesh.name='Stormwatch batched structure';group.add(mesh);
      for(const marker of batch.markers){const feature=new T.Object3D();feature.name=marker.name;feature.position.copy(marker.position);group.add(feature);}
    }
  }
  private tier(rand:()=>number):LootTier{const roll=rand();return roll<.60?'common':roll<.92?'decent':'lucky';}
  fillLoot(s:Station,tier:LootTier,rand:()=>number){fillSalvageLoot(s,tier,rand);}
  populate(state:GameState){
    const progress=ensureProgression(state),existing=new Set(progress.stations.map(s=>s.id)),legacyEconomy=progress.lootGenerated&&progress.economyVersion===undefined;
    if(!progress.lootGenerated){
      for(const poi of this.pois){const id=`loot-${poi.id}`,pos={x:poi.position.x+2.7,y:this.env.heightAt(poi.position.x+2.7,poi.position.z+2.4),z:poi.position.z+2.4},rand=randomSource(this.seed+8000+poi.kind*313);if(!existing.has(id)){const s=createStation(id,'loot',pos,rand()*Math.PI*2);fillPoiLoot(s,poi.kind,rollPoiLootTier(poi.kind,rand),rand);progress.stations.push(s);existing.add(id);}}
      if(this.env.terrain.generation===5)for(const poi of this.pois.filter(p=>p.kind===1||p.kind===2||p.kind===4||p.kind===5||p.kind===6||p.kind===7)){const id=`secure-cache-${poi.id}`,x=poi.position.x-3.6,z=poi.position.z+3.1,rand=randomSource(this.seed+91000+poi.kind*719);if(existing.has(id))continue;const cache=createStation(id,'secureCache',{x,y:this.env.heightAt(x,z)+.03,z},rand()*Math.PI*2);cache.locked=true;fillSecureCacheLoot(cache,poi.kind,rand);progress.stations.push(cache);existing.add(id);}
      const rand=randomSource(this.seed+12091),placed:Vec3[]=[];
      for(let tries=0,index=0;tries<6500&&index<16;tries++){
        const span=this.env.terrain.generation===5?this.env.terrain.size*.92:this.env.terrain.generation>=4?640:530,x=(rand()-.5)*span,z=(rand()-.5)*span,y=this.env.heightAt(x,z);if(y<2.2||y>42||this.env.terrain.slopeAt(x,z)>.48||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<24)continue;if(placed.some(p=>Math.hypot(p.x-x,p.z-z)<24))continue;
        const pos={x,y:y+.02,z};placed.push(pos);const id=`loot-field-${index}`,lootRand=randomSource(this.seed+24000+index*977);if(!existing.has(id)){const s=createStation(id,'loot',pos,lootRand()*Math.PI*2);this.fillLoot(s,this.tier(lootRand),lootRand);progress.stations.push(s);existing.add(id);}index++;
      }
      progress.lootGenerated=true;
    }
    this.recyclers.splice(0,this.recyclers.length,...initializeWorldEconomy(state,this.pois,(x,z)=>this.env.heightAt(x,z),this.seed,createStation,legacyEconomy));
  }
  advanceEvents(state:GameState){return updateWashedAshoreEvent(state,this.env.terrain.generation,sequence=>this.findEventCoast(state,sequence));}
  triggerRadioSignal(state:GameState,source:Vec3){
    if(this.env.terrain.generation!==5||state.progression?.radioSignal)return false;
    const terrain=this.env.terrain,originSeed=(state.seed^Math.imul(Math.round(source.x),0x45d9f3b)^Math.imul(Math.round(source.z),0x119de1f3)^0x72616469)>>>0,rand=randomSource(originSeed);let best:Vec3|null=null,bestScore=Infinity;
    for(let i=0;i<1100;i++){
      const angle=rand()*Math.PI*2,radius=150+rand()*175,x=source.x+Math.cos(angle)*radius,z=source.z+Math.sin(angle)*radius,y=this.env.heightAt(x,z);
      if(y<3||y>45||terrain.slopeAt(x,z)>.28||terrain.biomeAt(x,z)==='WATER'||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<100)continue;
      if(this.pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<38)||this.env.colliders.some(c=>Math.abs(c.position.x-x)<c.halfExtents.x+5&&Math.abs(c.position.z-z)<c.halfExtents.z+5))continue;
      if(state.progression?.stations.some(s=>Math.hypot(s.position.x-x,s.position.z-z)<16)||state.structures.some(s=>Math.hypot(s.position.x-x,s.position.z-z)<14))continue;
      const score=Math.abs(y-12)*.025+terrain.slopeAt(x,z)*2+rand()*.12;if(score<bestScore){bestScore=score;best={x,y:y+.04,z};}
    }
    return best?createRadioSignalEvent(state,best):false;
  }
  private findEventCoast(state:GameState,sequence:number):Vec3|null{
    if(this.eventSiteCache.has(sequence))return this.eventSiteCache.get(sequence)??null;
    const terrain=this.env.terrain;if(terrain.generation!==5)return null;
    const eventSeed=(this.seed^Math.imul(sequence,0x45d9f3b)^0x5a16)>>>0,rand=randomSource(eventSeed);let best:Vec3|null=null,bestScore=Infinity;
    for(let i=0;i<1800;i++){
      const angle=rand()*Math.PI*2,radius=350+rand()*245,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=this.env.heightAt(x,z);
      if(y<.55||y>4.8||terrain.biomeAt(x,z)!=='COAST'||terrain.slopeAt(x,z)>.2||Math.hypot(x-this.env.spawn.x,z-this.env.spawn.z)<105)continue;
      if(this.pois.some(p=>Math.hypot(p.position.x-x,p.position.z-z)<48)||this.env.colliders.some(c=>Math.abs(c.position.x-x)<c.halfExtents.x+4&&Math.abs(c.position.z-z)<c.halfExtents.z+4))continue;
      if(state.progression?.stations.some(s=>Math.hypot(s.position.x-x,s.position.z-z)<8)||state.structures.some(s=>Math.hypot(s.position.x-x,s.position.z-z)<8))continue;
      const score=Math.abs(y-1.8)*.35+terrain.slopeAt(x,z)*3+rand()*.24;
      if(score<bestScore){bestScore=score;best={x,y:y+.04,z};}
    }
    this.eventSiteCache.set(sequence,best);return best;
  }
  collisionBoxes():CollisionBox[]{const result:CollisionBox[]=[];for(const p of this.pois){if(p.kind===1){result.push({position:{x:p.position.x+.8,y:p.position.y+.23,z:p.position.z-.7},halfExtents:{x:.8,y:.2,z:.45}});}else if(p.kind===4){if(this.env.terrain.generation===5&&this.env.worldRevision>=6){result.push({position:{x:p.position.x-.45,y:p.position.y+.78,z:p.position.z-.89},halfExtents:{x:1.225,y:.615,z:.06}},{position:{x:p.position.x-1.30,y:p.position.y+.78,z:p.position.z+1.13},halfExtents:{x:.375,y:.615,z:.06}},{position:{x:p.position.x+.40,y:p.position.y+.78,z:p.position.z+1.13},halfExtents:{x:.375,y:.615,z:.06}},{position:{x:p.position.x-.45,y:p.position.y+2.12,z:p.position.z+.12},halfExtents:{x:1.325,y:.085,z:1.425}});}else result.push({position:{x:p.position.x-.45,y:p.position.y+.78,z:p.position.z+.12},halfExtents:{x:1.25,y:.7,z:1.02}});}else if(p.kind===5){result.push({position:{x:p.position.x-.15,y:p.position.y+.34,z:p.position.z},halfExtents:{x:3.7,y:.38,z:.78}},{position:{x:p.position.x+1.48,y:p.position.y+1.05,z:p.position.z+.32},halfExtents:{x:.82,y:.38,z:.46}});if(this.env.terrain.generation===5&&this.env.worldRevision>=6){result.push({position:{x:p.position.x-.25,y:p.position.y+1.23,z:p.position.z},halfExtents:{x:2.55,y:.06,z:.725}});for(const x of [-1.955,-1.005]){result.push({position:{x:p.position.x+x,y:p.position.y+1.44,z:p.position.z+.52},halfExtents:{x:.125,y:.15,z:.04}},{position:{x:p.position.x+x,y:p.position.y+2.60,z:p.position.z+.52},halfExtents:{x:.125,y:.54,z:.04}});}result.push({position:{x:p.position.x-1.48,y:p.position.y+2.20,z:p.position.z-.42},halfExtents:{x:.6,y:.91,z:.04}},{position:{x:p.position.x-2.04,y:p.position.y+2.20,z:p.position.z+.04},halfExtents:{x:.04,y:.91,z:.48}},{position:{x:p.position.x-.92,y:p.position.y+2.20,z:p.position.z-.34},halfExtents:{x:.04,y:.91,z:.24}},{position:{x:p.position.x-.92,y:p.position.y+2.20,z:p.position.z-.005},halfExtents:{x:.04,y:.91,z:.11}},{position:{x:p.position.x-.92,y:p.position.y+2.20,z:p.position.z+.415},halfExtents:{x:.04,y:.91,z:.13}},{position:{x:p.position.x-1.48,y:p.position.y+3.20,z:p.position.z+.04},halfExtents:{x:.74,y:.065,z:.59}});}}else if(p.kind===6){result.push({position:{x:p.position.x,y:p.position.y+.83,z:p.position.z+.9},halfExtents:{x:3.15,y:.12,z:2.1}});}else if(p.kind===7){result.push({position:{x:p.position.x,y:p.position.y+5.2,z:p.position.z},halfExtents:{x:.2,y:5.2,z:.2}});}else if(p.kind!==3)result.push({position:{x:p.position.x,y:p.position.y+1.2,z:p.position.z-1.6},halfExtents:{x:2.2,y:1.2,z:.12}});}return result;}
  dispose(){this.group.traverse(o=>{if(o instanceof T.Mesh&&o.geometry!==this.relayMast&&o.geometry!==this.relayDish)o.geometry.dispose();});this.group.removeFromParent();this.relayMast.dispose();this.relayDish.dispose();this.road.map?.dispose();[this.wood,this.metal,this.rust,this.paint,this.chartPaper,this.glass,this.display,this.bridgeDisplay,this.bridgeLamp,this.cloth,this.stormCloth,this.sludge,this.road].forEach(m=>m.dispose());}
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
  private buildBase(){const c=this.base.getContext('2d')!,data=c.createImageData(this.pixels,this.pixels),size=this.env.terrain.size;for(let py=0;py<this.pixels;py++)for(let px=0;px<this.pixels;px++){const w=mapToWorld({x:px,y:py},size,this.pixels),h=this.env.heightAt(w.x,w.z),biome=this.env.biomeAt(w.x,w.z),dx=this.env.heightAt(w.x+3,w.z)-this.env.heightAt(w.x-3,w.z),dz=this.env.heightAt(w.x,w.z+3)-this.env.heightAt(w.x,w.z-3),shade=Math.max(.68,Math.min(1.24,1+(dx+dz)*.026));let col:number[]=h<0?[31,56,72]:h<2.8?[177,159,119]:biome==='ARID'?[154,126,76]:biome==='SNOW / ALPINE'?[218,220,211]:biome==='ROCKY MOUNTAIN'||biome==='ROCKY UPLAND'?[119,122,116]:biome==='TEMPERATE FOREST'||biome==='FOREST'?[57,91,60]:[91,117,68];if(this.env.terrain.generation===5&&h>=2.8){const slope=this.env.terrain.slopeAt(w.x,w.z),weights=surfaceClimate(this.env.terrain.climateAt(w.x,w.z),h,1-1/Math.sqrt(1+slope*slope));const blend=(target:number[],amount:number)=>col=col.map((v,i)=>v+(target[i]!-v)*amount);col=[91,117,68];blend([57,91,60],weights.forest);blend([154,126,76],weights.arid);blend([218,220,211],weights.snow);blend([119,122,116],T.MathUtils.smoothstep(slope,.45,.95));}const i=(py*this.pixels+px)*4;data.data.set([col[0]!*shade,col[1]!*shade,col[2]!*shade,255],i);}c.putImageData(data,0,0);
    c.strokeStyle='rgba(221,190,132,.78)';c.lineWidth=2;for(const trail of this.world.trails){c.beginPath();trail.forEach((p,i)=>{const q=worldToMap(p,size,this.pixels);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.stroke();}
    const cells=12,step=this.pixels/cells;c.strokeStyle='rgba(224,230,211,.12)';c.fillStyle='rgba(231,235,216,.38)';c.font='11px sans-serif';c.lineWidth=1;for(let i=0;i<=cells;i++){c.beginPath();c.moveTo(i*step,0);c.lineTo(i*step,this.pixels);c.stroke();c.beginPath();c.moveTo(0,i*step);c.lineTo(this.pixels,i*step);c.stroke();if(i<cells){c.fillText(String.fromCharCode(65+i),i*step+5,14);c.fillText(String(i+1),4,i*step+28);}}
    const labels:{x:number;y:number;w:number;h:number}[]=[],drawLabel=(text:string,x:number,y:number,color:string)=>{const w=c.measureText(text).width+5,h=13,options=[[x+9,y-9],[x+9,y+20],[x-w-9,y-9],[x-w-9,y+20],[x+9,y-25],[x-w-9,y+35]];const chosen=options.find(([lx,ly])=>lx>3&&lx+w<this.pixels-3&&ly-h>3&&ly<this.pixels-3&&!labels.some(b=>lx<b.x+b.w&&lx+w>b.x&&ly-h<b.y&&ly>b.y-b.h))??options[0]!;labels.push({x:chosen[0],y:chosen[1],w,h});c.fillStyle=color;c.fillText(text,chosen[0],chosen[1]);};
    c.font='bold 12px sans-serif';this.world.pois.forEach(p=>{const q=worldToMap(p.position,size,this.pixels);c.fillStyle='#e5d5a9';c.beginPath();c.arc(q.x,q.y,5,0,Math.PI*2);c.fill();drawLabel(p.name.toUpperCase(),q.x,q.y,'#e5d5a9');});for(const r of this.world.recyclers){const q=worldToMap(r,size,this.pixels);c.fillStyle='#b6cf79';c.fillRect(q.x-4,q.y-4,8,8);drawLabel('RECYCLER',q.x,q.y,'#b6cf79');}}
  get isOpen(){return !this.root.hidden;}show(){this.root.hidden=false;}close(){this.root.hidden=true;this.dragging=false;}
  update(p:Vec3,yaw:number,waypoint?:{x:number;z:number},packs:Vec3[]=[],event?:Vec3,signal?:Vec3){if(!this.isOpen)return;const c=this.ctx,size=this.env.terrain.size;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.pixels,this.pixels);c.setTransform(this.zoom,0,0,this.zoom,this.pan.x,this.pan.y);c.drawImage(this.base,0,0);if(waypoint){const q=worldToMap(waypoint,size,this.pixels);c.strokeStyle='#f0ad63';c.lineWidth=3/this.zoom;c.strokeRect(q.x-8,q.y-8,16,16);}if(event){const e=worldToMap(event,size,this.pixels);c.fillStyle='#e8a45a';c.strokeStyle='#fff0c2';c.lineWidth=2/this.zoom;c.beginPath();c.arc(e.x,e.y,7/this.zoom,0,Math.PI*2);c.fill();c.stroke();}if(signal){const q=worldToMap(signal,size,this.pixels);c.save();c.translate(q.x,q.y);c.rotate(Math.PI/4);c.fillStyle='#67d7ae';c.strokeStyle='#e7ffed';c.lineWidth=2/this.zoom;c.fillRect(-6/this.zoom,-6/this.zoom,12/this.zoom,12/this.zoom);c.strokeRect(-6/this.zoom,-6/this.zoom,12/this.zoom,12/this.zoom);c.restore();}for(const pack of packs){const q=worldToMap(pack,size,this.pixels);c.save();c.translate(q.x,q.y);c.rotate(Math.PI/4);c.fillStyle='#d88955';c.strokeStyle='#f1d0a0';c.lineWidth=2/this.zoom;c.fillRect(-6,-6,12,12);c.strokeRect(-6,-6,12,12);c.restore();}const q=worldToMap(p,size,this.pixels);c.save();c.translate(q.x,q.y);c.rotate(-yaw);c.fillStyle='#f0f4e4';c.strokeStyle='#1a2728';c.lineWidth=2/this.zoom;c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(6,7);c.closePath();c.fill();c.stroke();c.restore();c.setTransform(1,0,0,1,0,0);}
  dispose(){this.root.remove();}
}
