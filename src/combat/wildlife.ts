import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {DamagePacket,DamageResult,Damageable} from './damage';
import {resolveDamage} from './damage';
import type {Vec3,WorldGeneration} from '../core/types';
import {randomSource} from '../world/noise';

export type WildlifeSpecies='islandWolf'|'coastalBoar'|'islandScavenger';
export type WildlifeState='wander'|'chase'|'attack'|'dead';
export interface WildlifeActor extends Damageable {id:string;species:WildlifeSpecies;state:WildlifeState;position:Vec3;health:number;maxHealth:number;yaw:number;angered:boolean;attackCooldown:number;wanderTime:number;wanderCycle:number;wanderX:number;wanderZ:number;readonly home:Vec3;readonly seed:number}
export interface WildlifeSpawnContext {seed:number;generation:WorldGeneration;spawn:Vec3;halfSize:number;heightAt:(x:number,z:number)=>number;biomeAt:(x:number,z:number)=>string;scavengerSites?:readonly Vec3[];nodeChanges?:Record<string,number>}

const SPECIES:Record<WildlifeSpecies,{health:number;radius:number;scale:number;speed:number;damage:number;aggro:number;name:string;color:number}>={
  islandWolf:{health:78,radius:.64,scale:1.05,speed:3.25,damage:17,aggro:24,name:'Island wolf',color:0x696d69},
  coastalBoar:{health:92,radius:.72,scale:.95,speed:2.8,damage:13,aggro:0,name:'Coastal boar',color:0x735641},
  islandScavenger:{health:112,radius:.58,scale:1,speed:2.55,damage:12,aggro:21,name:'Island scavenger',color:0x71664c},
};

export function wildlifeSpeciesForBiome(biome:string,temperature:number):WildlifeSpecies|null {
  if(biome.includes('SNOW')||biome.includes('ALPINE'))return temperature<.34?'islandWolf':null;
  if(biome.includes('FOREST'))return 'islandWolf';
  if((biome.includes('GRASS')||biome.includes('COAST'))&&temperature>.3)return 'coastalBoar';
  return null;
}

/** Seeded placements are stable across reloads; only defeated ids are stored in the save. */
export function createWildlifePopulation(context:WildlifeSpawnContext):WildlifeActor[] {
  const random=randomSource(context.seed^0x5f3759df),actors:WildlifeActor[]=[];
  const desired=context.generation===5?10:6,margin=Math.max(24,context.halfSize*.88),minRadius=context.generation===5?52:32,maxRadius=Math.max(minRadius+20,context.halfSize*.76);
  let candidateId=0;
  for(let attempt=0;attempt<desired*36&&candidateId<desired;attempt++){
    const angle=random()*Math.PI*2,radius=minRadius+random()*(maxRadius-minRadius),x=context.spawn.x+Math.cos(angle)*radius,z=context.spawn.z+Math.sin(angle)*radius;
    if(Math.abs(x)>margin||Math.abs(z)>margin)continue;
    const y=context.heightAt(x,z);if(!Number.isFinite(y)||y<.5)continue;
    const biome=context.biomeAt(x,z),temperature=biome.includes('SNOW')?.18:biome.includes('COAST')?.62:biome.includes('ARID')?.72:.55,species=wildlifeSpeciesForBiome(biome,temperature);
    if(!species)continue;
    const id=`fauna-${context.seed}-${candidateId++}`,savedHealth=context.nodeChanges?.[id];if(savedHealth===0)continue;
    const seed=Math.floor(random()*0x7fffffff),position={x,y,z},maxHealth=SPECIES[species].health,health=Number.isFinite(savedHealth)?Math.max(1,Math.min(maxHealth,savedHealth!)):maxHealth,actor:WildlifeActor={id,species,state:'wander',position:{...position},home:position,health,maxHealth,yaw:angle+Math.PI,angered:false,attackCooldown:random()*1.2,wanderTime:0,wanderCycle:0,wanderX:x,wanderZ:z,seed,
      takeDamage(packet:DamagePacket,mitigation=0):DamageResult {const result=resolveDamage(actor.health,actor.maxHealth,packet,mitigation);actor.health=result.healthAfter;if(result.applied>0)actor.angered=true;if(result.killed)actor.state='dead';return result;}};
    actors.push(actor);
  }
  const sites=context.scavengerSites??[];
  for(let index=0;index<Math.min(3,sites.length);index++){
    const site=sites[index]!,angle=(context.seed%997)*.013+index*2.399963,radius=5.5+index*.8,x=site.x+Math.cos(angle)*radius,z=site.z+Math.sin(angle)*radius;
    if(Math.abs(x)>margin||Math.abs(z)>margin)continue;const y=context.heightAt(x,z);if(!Number.isFinite(y)||y<.5)continue;
    const id=`scavenger-${context.seed}-${index}`,savedHealth=context.nodeChanges?.[id];if(savedHealth===0)continue;
    const seed=Math.floor(random()*0x7fffffff),position={x,y,z},maxHealth=SPECIES.islandScavenger.health,health=Number.isFinite(savedHealth)?Math.max(1,Math.min(maxHealth,savedHealth!)):maxHealth;
    const actor:WildlifeActor={id,species:'islandScavenger',state:'wander',position:{...position},home:position,health,maxHealth,yaw:angle+Math.PI,angered:false,attackCooldown:random()*.8,wanderTime:0,wanderCycle:0,wanderX:x,wanderZ:z,seed,
      takeDamage(packet:DamagePacket,mitigation=0):DamageResult{const result=resolveDamage(actor.health,actor.maxHealth,packet,mitigation);actor.health=result.healthAfter;if(result.applied>0)actor.angered=true;if(result.killed)actor.state='dead';return result;}};
    actors.push(actor);
  }
  return actors;
}

export function tickWildlife(actor:WildlifeActor,dt:number,player:Vec3,heightAt:(x:number,z:number)=>number,onAttack:(damage:number,sourceId:string)=>void):void {
  if(actor.state==='dead')return;
  const spec=SPECIES[actor.species],dx=player.x-actor.position.x,dz=player.z-actor.position.z,distance=Math.hypot(dx,dz);
  actor.attackCooldown=Math.max(0,actor.attackCooldown-dt);
  if(distance>92){actor.state='wander';return;}
  const hostile=actor.angered||(spec.aggro>0&&distance<spec.aggro);
  if(hostile&&distance<38){
    actor.yaw=Math.atan2(dx,dz);
    if(distance<1.55){actor.state='attack';if(actor.attackCooldown<=0){onAttack(spec.damage,actor.id);actor.attackCooldown=1.35;}}
    else {actor.state='chase';const step=Math.min(distance-1.25,spec.speed*dt);actor.position.x+=dx/distance*step;actor.position.z+=dz/distance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;}
    return;
  }
  actor.state='wander';actor.wanderTime+=dt;
  const wanderInterval=4+actor.seed%4;if(actor.wanderTime>wanderInterval){actor.wanderTime-=wanderInterval;actor.wanderCycle++;const phase=actor.seed*.00001+actor.wanderCycle*2.399;actor.wanderX=actor.home.x+Math.sin(phase)*4;actor.wanderZ=actor.home.z+Math.cos(phase*.71)*4;}
  const wx=actor.wanderX-actor.position.x,wz=actor.wanderZ-actor.position.z,wd=Math.hypot(wx,wz);
  if(wd>.22){const step=Math.min(wd,spec.speed*.18*dt);actor.position.x+=wx/wd*step;actor.position.z+=wz/wd*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;actor.yaw=Math.atan2(wx,wz);}
}

export class WildlifeSystem {
  readonly actors:WildlifeActor[];
  private readonly objects=new Map<string,THREE.Mesh>();
  private readonly materials=new Map<WildlifeSpecies,THREE.MeshStandardMaterial>();
  private readonly geometries=new Map<WildlifeSpecies,THREE.BufferGeometry>();
  constructor(private scene:THREE.Scene,context:WildlifeSpawnContext){
    this.actors=createWildlifePopulation(context);
    for(const actor of this.actors){const object=this.createModel(actor);this.objects.set(actor.id,object);scene.add(object);}
  }
  private geometryFor(species:WildlifeSpecies){
    const cached=this.geometries.get(species);if(cached)return cached;
    const parts:THREE.BufferGeometry[]=[],coat=SPECIES[species].color,bone=0xd0c2a2,dark=0x272a27;
    const add=(geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,rotationZ=0)=>{const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,rotationZ)),new THREE.Vector3(sx,sy,sz));geometry.applyMatrix4(matrix);const base=new THREE.Color(color),position=geometry.getAttribute('position'),colors=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){colors[i*3]=base.r;colors[i*3+1]=base.g;colors[i*3+2]=base.b;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geometry);};
    const ellipsoid=(color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>add(new THREE.SphereGeometry(1,16,12),color,x,y,z,sx,sy,sz);
    if(species==='islandScavenger'){
      add(new THREE.BoxGeometry(.58,.70,.30),coat,0,1.03,0,1,1,1);
      add(new THREE.BoxGeometry(.30,.32,.28),0x887c60,0,1.57,0,1,1,1);
      add(new THREE.BoxGeometry(.34,.38,.22),0x393a34,0,.98,.24,1,1,1);
      add(new THREE.BoxGeometry(.19,.68,.20),0x51483a,-.20,.38,0,1,1,1);
      add(new THREE.BoxGeometry(.19,.68,.20),0x51483a,.20,.38,0,1,1,1);
      add(new THREE.BoxGeometry(.16,.66,.19),coat,-.39,1.02,0,1,1,1);
      add(new THREE.BoxGeometry(.16,.66,.19),coat,.39,1.02,0,1,1,1);
      add(new THREE.BoxGeometry(.08,.12,.06),dark,-.075,1.59,-.145,1,1,1);
      add(new THREE.BoxGeometry(.08,.12,.06),dark,.075,1.59,-.145,1,1,1);
    } else {
      ellipsoid(coat,0,.68,0,.36,.37,.64);ellipsoid(coat,0,.78,-.49,.30,.31,.34);ellipsoid(coat,0,.66,-.72,.23,.16,.22);
      for(const x of [-.20,.20]){ellipsoid(coat,x,1.02,-.5,.10,.19,.075);ellipsoid(dark,x*.72,.81,-.73,.034,.035,.025);if(species==='coastalBoar')ellipsoid(bone,x*1.12,.60,-.82,.045,.105,.04);}
      for(const x of [-.23,.23])for(const z of [-.42,.42])add(new THREE.CapsuleGeometry(.075,.28,3,6),coat,x,.30,z,1,1,1);
      if(species==='islandWolf'){for(const x of [-.12,.12])ellipsoid(coat,x,.98,-.47,.075,.17,.07);ellipsoid(dark,0,.72,-.91,.052,.04,.045);ellipsoid(coat,0,.78,.66,.075,.08,.24);ellipsoid(0xb0aaa0,0,.48,-.43,.22,.16,.22);}
    }
    const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();if(!geometry)throw new Error('Could not combine wildlife model geometry');geometry.computeBoundingSphere();this.geometries.set(species,geometry);
    let material=this.materials.get(species);if(!material){material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});this.materials.set(species,material);}return geometry;
  }
  private createModel(actor:WildlifeActor){const mesh=new THREE.Mesh(this.geometryFor(actor.species),this.materials.get(actor.species)!);mesh.scale.setScalar(SPECIES[actor.species].scale);mesh.position.set(actor.position.x,actor.position.y,actor.position.z);mesh.rotation.y=actor.yaw;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;return mesh;}
  object(id:string){return this.objects.get(id)??null;}
  update(dt:number,player:Vec3,heightAt:(x:number,z:number)=>number,onAttack:(damage:number,sourceId:string)=>void){
    for(const actor of this.actors){const object=this.objects.get(actor.id);if(actor.state==='dead'){if(object)object.visible=false;continue;}const distance=Math.hypot(player.x-actor.position.x,player.z-actor.position.z);if(distance>100){if(object)object.visible=false;continue;}tickWildlife(actor,dt,player,heightAt,onAttack);if(object){object.visible=true;object.position.set(actor.position.x,actor.position.y+(actor.state==='attack'?Math.sin(actor.attackCooldown*7)*.018:0),actor.position.z);object.rotation.y=actor.yaw;}}
  }
  dispose(){for(const object of this.objects.values())object.removeFromParent();for(const geometry of this.geometries.values())geometry.dispose();for(const material of this.materials.values())material.dispose();this.materials.clear();this.geometries.clear();this.objects.clear();}
}

export const wildlifeDefinition=(species:WildlifeSpecies)=>SPECIES[species];
