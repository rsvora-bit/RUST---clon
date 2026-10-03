import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {DamagePacket,DamageResult,Damageable,DamageType} from './damage';
import {resolveDamage} from './damage';
import type {Vec3,WorldGeneration} from '../core/types';
import type {StructureGrade} from '../core/types';
import {randomSource} from '../world/noise';

export type WildlifeSpecies='islandWolf'|'coastalBoar'|'islandScavenger'|'islandDeer';
export type WildlifeState='wander'|'investigate'|'chase'|'reposition'|'stagger'|'return'|'raid'|'attack'|'flee'|'dead';
export type ScavengerArchetype='scavenger'|'lookout'|'guard';
export interface WildlifeRaidTarget {id:string;position:Vec3}
export interface WildlifeActor extends Damageable {id:string;species:WildlifeSpecies;archetype?:ScavengerArchetype;state:WildlifeState;position:Vec3;health:number;maxHealth:number;yaw:number;angered:boolean;alerted:boolean;attackCooldown:number;shotSequence?:number;combatMoveTime:number;combatMoveDirection:number;wanderTime:number;wanderCycle:number;wanderX:number;wanderZ:number;hitReaction:number;staggerSeconds:number;perceptionCooldown:number;canSeePlayer:boolean;awareness:number;memorySeconds:number;lastKnownPlayer:Vec3;blockedRaidDoor?:WildlifeRaidTarget;readonly home:Vec3;readonly seed:number}
export interface WildlifeSpawnContext {seed:number;generation:WorldGeneration;spawn:Vec3;halfSize:number;heightAt:(x:number,z:number)=>number;biomeAt:(x:number,z:number)=>string;temperatureAt?:(x:number,z:number)=>number;moistureAt?:(x:number,z:number)=>number;slopeAt?:(x:number,z:number)=>number;scavengerSites?:readonly Vec3[];nodeChanges?:Record<string,number>}

const SPECIES:Record<WildlifeSpecies,{health:number;radius:number;scale:number;speed:number;damage:number;aggro:number;name:string;color:number}>={
  islandWolf:{health:78,radius:.64,scale:1.05,speed:3.25,damage:17,aggro:24,name:'Island wolf',color:0x696d69},
  coastalBoar:{health:92,radius:.72,scale:.95,speed:2.8,damage:13,aggro:0,name:'Coastal boar',color:0x735641},
  islandScavenger:{health:112,radius:.58,scale:1,speed:2.55,damage:12,aggro:21,name:'Island scavenger',color:0x71664c},
  islandDeer:{health:64,radius:.56,scale:1.08,speed:4.15,damage:0,aggro:0,name:'Island deer',color:0x927653},
};

/** Higher construction grades slow a raid, keeping structure upgrades defensively meaningful. */
export function scavengerRaidDamage(grade:StructureGrade='wood'):number{return grade==='metal'?4:grade==='stone'?8:14;}

export function wildlifeSpeciesForBiome(biome:string,temperature:number):WildlifeSpecies|null {
  if(biome.includes('SNOW')||biome.includes('ALPINE'))return temperature<.34?'islandWolf':null;
  if(biome.includes('FOREST'))return 'islandWolf';
  if((biome.includes('GRASS')||biome.includes('COAST'))&&temperature>.3)return 'coastalBoar';
  return null;
}

function createScavenger(id:string,archetype:ScavengerArchetype,position:Vec3,yaw:number,seed:number,attackCooldown:number,savedHealth:number|undefined):WildlifeActor|null {
  if(savedHealth===0)return null;
  const maxHealth=archetype==='guard'?146:SPECIES.islandScavenger.health,health=Number.isFinite(savedHealth)?Math.max(1,Math.min(maxHealth,savedHealth!)):maxHealth;
  const actor:WildlifeActor={id,species:'islandScavenger',archetype,state:'wander',position:{...position},home:{...position},health,maxHealth,yaw,angered:false,alerted:false,attackCooldown,shotSequence:0,combatMoveTime:(seed%71)/100,combatMoveDirection:0,wanderTime:0,wanderCycle:0,wanderX:position.x,wanderZ:position.z,hitReaction:0,staggerSeconds:0,perceptionCooldown:(seed%251)/1000,canSeePlayer:false,awareness:0,memorySeconds:0,lastKnownPlayer:{...position},seed,
    takeDamage(packet:DamagePacket,mitigation=0):DamageResult{const armour=archetype==='guard'&&packet.type==='projectile'?.2:0,combined=1-(1-Math.max(0,Math.min(.85,mitigation)))*(1-armour),result=resolveDamage(actor.health,actor.maxHealth,packet,combined);actor.health=result.healthAfter;if(result.applied>0){actor.angered=true;actor.hitReaction=1;if(packet.type==='melee'&&packet.amount>=24)actor.staggerSeconds=Math.max(actor.staggerSeconds,Math.min(.62,.22+packet.amount/160));}if(result.killed)actor.state='dead';return result;}};
  return actor;
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
    const seed=Math.floor(random()*0x7fffffff),position={x,y,z},maxHealth=SPECIES[species].health,health=Number.isFinite(savedHealth)?Math.max(1,Math.min(maxHealth,savedHealth!)):maxHealth,actor:WildlifeActor={id,species,state:'wander',position:{...position},home:position,health,maxHealth,yaw:angle+Math.PI,angered:false,alerted:false,attackCooldown:random()*1.2,combatMoveTime:(seed%71)/100,combatMoveDirection:0,wanderTime:0,wanderCycle:0,wanderX:x,wanderZ:z,hitReaction:0,staggerSeconds:0,perceptionCooldown:(seed%251)/1000,canSeePlayer:false,awareness:0,memorySeconds:0,lastKnownPlayer:{...position},seed,
      takeDamage(packet:DamagePacket,mitigation=0):DamageResult {const result=resolveDamage(actor.health,actor.maxHealth,packet,mitigation);actor.health=result.healthAfter;if(result.applied>0){actor.angered=true;actor.hitReaction=1;if(packet.type==='melee'&&packet.amount>=24)actor.staggerSeconds=Math.max(actor.staggerSeconds,Math.min(.62,.22+packet.amount/160));}if(result.killed)actor.state='dead';return result;}};
    actors.push(actor);
  }
  const sites=context.generation===5?(context.scavengerSites??[]):[];
  for(let index=0;index<Math.min(4,sites.length);index++){
    const site=sites[index]!,angle=(context.seed%997)*.013+index*2.399963,radius=5.5+index*.8,x=site.x+Math.cos(angle)*radius,z=site.z+Math.sin(angle)*radius;
    if(Math.abs(x)>margin||Math.abs(z)>margin)continue;const y=context.heightAt(x,z);if(!Number.isFinite(y)||y<.5)continue;
    const id=`scavenger-${context.seed}-${index}`,seed=Math.floor(random()*0x7fffffff),position={x,y,z},archetype:ScavengerArchetype=index===1?'lookout':'scavenger',actor=createScavenger(id,archetype,position,angle+Math.PI,seed,random()*.8,context.nodeChanges?.[id]);if(actor)actors.push(actor);
    if(index===1){const guardAngle=angle+Math.PI,guardX=site.x+Math.cos(guardAngle)*8,guardZ=site.z+Math.sin(guardAngle)*8,guardY=context.heightAt(guardX,guardZ),guardId=`${id}-guard`,guardSeed=(context.seed^Math.imul(index+1,0x45d9f3b))>>>0;if(Number.isFinite(guardY)&&guardY>.5&&Math.abs(guardX)<=margin&&Math.abs(guardZ)<=margin){const guard=createScavenger(guardId,'guard',{x:guardX,y:guardY,z:guardZ},angle,guardSeed,guardSeed%80/100,context.nodeChanges?.[guardId]);if(guard)actors.push(guard);}}
  }
  // A separate random stream and namespace keep all established fauna IDs and positions stable.
  if(context.generation===5){
    const deerRandom=randomSource(context.seed^0x2c1b3c6d),desiredDeer=2,deerMargin=Math.max(24,context.halfSize*.88),deerMinRadius=72,deerMaxRadius=Math.max(deerMinRadius+20,context.halfSize*.68);let placed=0;
    for(let attempt=0;attempt<desiredDeer*80&&placed<desiredDeer;attempt++){
      const angle=deerRandom()*Math.PI*2,radius=deerMinRadius+deerRandom()*(deerMaxRadius-deerMinRadius),x=context.spawn.x+Math.cos(angle)*radius,z=context.spawn.z+Math.sin(angle)*radius;
      if(Math.abs(x)>deerMargin||Math.abs(z)>deerMargin)continue;const y=context.heightAt(x,z),biome=context.biomeAt(x,z),temperature=context.temperatureAt?.(x,z)??(biome.includes('SNOW')?.18:biome.includes('ARID')?.68:.58),moisture=context.moistureAt?.(x,z)??(biome.includes('ARID')?.32:.58),slope=context.slopeAt?.(x,z)??0;
      if(!Number.isFinite(y)||y<2||y>28||slope>.38||!biome.includes('GRASS')||temperature<.48||moisture<.28||moisture>.82)continue;
      const id=`deer-${context.seed}-${placed}`,seed=Math.floor(deerRandom()*0x7fffffff),savedHealth=context.nodeChanges?.[id];if(savedHealth===0){placed++;continue;}
      const position={x,y,z},maxHealth=SPECIES.islandDeer.health,health=Number.isFinite(savedHealth)?Math.max(1,Math.min(maxHealth,savedHealth!)):maxHealth,actor:WildlifeActor={id,species:'islandDeer',state:'wander',position:{...position},home:position,health,maxHealth,yaw:angle+Math.PI,angered:false,alerted:false,attackCooldown:0,combatMoveTime:0,combatMoveDirection:0,wanderTime:0,wanderCycle:0,wanderX:x,wanderZ:z,hitReaction:0,staggerSeconds:0,perceptionCooldown:0,canSeePlayer:false,awareness:0,memorySeconds:0,lastKnownPlayer:{...position},seed,
        takeDamage(packet:DamagePacket,mitigation=0):DamageResult{const result=resolveDamage(actor.health,actor.maxHealth,packet,mitigation);actor.health=result.healthAfter;if(result.applied>0){actor.angered=true;actor.hitReaction=1;}if(result.killed)actor.state='dead';return result;}};
      actors.push(actor);placed++;
    }
  }
  return actors;
}

export function lookoutHitChance(actor:WildlifeActor,distance:number):number{return Math.max(.3,Math.min(.76,.7-Math.max(0,distance-8)*.014+actor.awareness*.04));}
export function guardHitChance(actor:WildlifeActor,distance:number):number{return Math.max(.2,Math.min(.58,.52-Math.max(0,distance-8)*.012+actor.awareness*.025));}
function deterministicShotRoll(actor:WildlifeActor):number{const sequence=actor.shotSequence??1;let value=(actor.seed^Math.imul(sequence,0x9e3779b1))>>>0;value=Math.imul(value^(value>>>16),0x85ebca6b);value=Math.imul(value^(value>>>13),0xc2b2ae35);value^=value>>>16;return (value>>>0)/0x1_0000_0000;}

/** Ranged scavengers make restrained, seed-phased lateral moves while holding their firing lane. */
function strafeRangedScavenger(actor:WildlifeActor,dt:number,player:Vec3,heightAt:(x:number,z:number)=>number):void {
  actor.combatMoveTime-=dt;
  if(actor.combatMoveTime<=0){actor.combatMoveDirection=actor.combatMoveDirection===0?((actor.seed&1)?1:-1):-actor.combatMoveDirection;actor.combatMoveTime=1.15+((actor.seed>>>3)%37)/100;}
  const dx=player.x-actor.position.x,dz=player.z-actor.position.z,distance=Math.hypot(dx,dz);if(distance<.01)return;
  const step=Math.min(.72*dt,actor.combatMoveTime*.72);
  actor.position.x+=dz/distance*actor.combatMoveDirection*step;
  actor.position.z-=dx/distance*actor.combatMoveDirection*step;
  actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;
}

/** A confirmed Gen5 sighting or first raid alarm alerts nearby human allies with a short-lived last-known position. */
export function shareScavengerAlarm(source:WildlifeActor,actors:readonly WildlifeActor[],player:Vec3,radius=24):void{
  if(source.species!=='islandScavenger'||!source.alerted)return;
  for(const ally of actors){if(ally===source||ally.species!=='islandScavenger'||ally.state==='dead'||ally.angered||Math.hypot(ally.position.x-source.position.x,ally.position.z-source.position.z)>radius)continue;
    ally.alerted=true;ally.awareness=Math.max(ally.awareness,.4);ally.lastKnownPlayer.x=player.x;ally.lastKnownPlayer.y=player.y;ally.lastKnownPlayer.z=player.z;ally.memorySeconds=Math.max(ally.memorySeconds,2.6);
  }
}

export function tickWildlife(actor:WildlifeActor,dt:number,player:Vec3,heightAt:(x:number,z:number)=>number,onAttack:(damage:number,sourceId:string,type?:DamageType)=>void,canSeePlayer=true,onRaid?:(targetId:string,damage:number)=>void):void {
  if(actor.state==='dead')return;
  const spec=SPECIES[actor.species],dx=player.x-actor.position.x,dz=player.z-actor.position.z,distance=Math.hypot(dx,dz);
  actor.attackCooldown=Math.max(0,actor.attackCooldown-dt);
  if(actor.staggerSeconds>0){actor.staggerSeconds=Math.max(0,actor.staggerSeconds-dt);if(actor.staggerSeconds>0){actor.state='stagger';return;}}
  if(actor.species==='islandDeer'){
    actor.memorySeconds=Math.max(0,actor.memorySeconds-dt);
    if(actor.angered){actor.memorySeconds=Math.max(actor.memorySeconds,7);actor.angered=false;}
    if(distance<15)actor.memorySeconds=Math.max(actor.memorySeconds,3.8);
    if(actor.memorySeconds>0&&distance<64){const awayX=actor.position.x-player.x,awayZ=actor.position.z-player.z,awayLength=Math.hypot(awayX,awayZ)||1,homeX=actor.home.x-actor.position.x,homeZ=actor.home.z-actor.position.z,homeLength=Math.hypot(homeX,homeZ),steerX=awayX/awayLength+(homeLength>5?homeX/homeLength*.8:0),steerZ=awayZ/awayLength+(homeLength>5?homeZ/homeLength*.8:0),steerLength=Math.hypot(steerX,steerZ)||1,step=Math.min(4.15*dt,Math.max(.08,distance));actor.state='flee';actor.combatMoveTime+=dt;actor.yaw=Math.atan2(steerX,steerZ);actor.position.x+=steerX/steerLength*step;actor.position.z+=steerZ/steerLength*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    if(distance>92){actor.state='wander';return;}
  }
  if(distance>92){actor.state='wander';return;}
  const animalAggro=actor.species!=='islandScavenger'&&spec.aggro>0&&distance<spec.aggro;
  const hostile=actor.angered||actor.alerted||animalAggro;
  const raidDoor=actor.species==='islandScavenger'&&hostile&&!canSeePlayer?actor.blockedRaidDoor:undefined;
  if(raidDoor){
    const awayX=actor.position.x-raidDoor.position.x,awayZ=actor.position.z-raidDoor.position.z,sideLength=Math.hypot(awayX,awayZ)||1,approachX=raidDoor.position.x+awayX/sideLength*1.25,approachZ=raidDoor.position.z+awayZ/sideLength*1.25,dx=approachX-actor.position.x,dz=approachZ-actor.position.z,approachDistance=Math.hypot(dx,dz);
    actor.yaw=Math.atan2(raidDoor.position.x-actor.position.x,raidDoor.position.z-actor.position.z);
    if(approachDistance>.12){actor.state='raid';const step=Math.min(approachDistance,spec.speed*dt);actor.position.x+=dx/approachDistance*step;actor.position.z+=dz/approachDistance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    actor.state='raid';if(actor.attackCooldown<=0){onRaid?.(raidDoor.id,14);actor.attackCooldown=1.8+(actor.seed%41)/100;}return;
  }
  if(actor.species==='islandScavenger'&&hostile&&!canSeePlayer&&actor.memorySeconds>0){
    const lx=actor.lastKnownPlayer.x-actor.position.x,lz=actor.lastKnownPlayer.z-actor.position.z,knownDistance=Math.hypot(lx,lz);
    if(knownDistance>1.45&&knownDistance<38){actor.state='investigate';actor.yaw=Math.atan2(lx,lz);const step=Math.min(knownDistance-1.2,spec.speed*dt);actor.position.x+=lx/knownDistance*step;actor.position.z+=lz/knownDistance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;}
    else actor.state='investigate';
    return;
  }
  if(actor.species==='islandScavenger'&&actor.alerted&&!actor.angered&&!canSeePlayer&&actor.memorySeconds<=0){
    const dx=actor.home.x-actor.position.x,dz=actor.home.z-actor.position.z,distanceHome=Math.hypot(dx,dz);actor.awareness=Math.max(0,actor.awareness-dt*.4);
    if(distanceHome>1.2){actor.state='return';actor.yaw=Math.atan2(dx,dz);const step=Math.min(distanceHome,spec.speed*.68*dt);actor.position.x+=dx/distanceHome*step;actor.position.z+=dz/distanceHome*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    actor.state='wander';actor.alerted=false;actor.awareness=0;return;
  }
  if(actor.species==='islandScavenger'&&actor.archetype==='guard'&&hostile&&distance<34&&canSeePlayer){
    actor.yaw=Math.atan2(dx,dz);
    if(distance<10){actor.state='reposition';const step=Math.min(11-distance,spec.speed*.75*dt),inverseDistance=distance>.001?1/distance:0;actor.position.x-=dx*inverseDistance*step;actor.position.z-=dz*inverseDistance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    if(distance>25){actor.state='chase';const step=Math.min(distance-22,spec.speed*.65*dt);actor.position.x+=dx/distance*step;actor.position.z+=dz/distance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    actor.state='attack';strafeRangedScavenger(actor,dt,player,heightAt);if(actor.attackCooldown<=0){const sequence=actor.shotSequence??0;actor.shotSequence=sequence+1;if(deterministicShotRoll(actor)<guardHitChance(actor,distance))onAttack(14,actor.id,'projectile');actor.attackCooldown=2.55+(actor.seed%76)/100;}
    return;
  }
  if(actor.species==='islandScavenger'&&actor.archetype==='lookout'&&hostile&&distance<38&&canSeePlayer){
    actor.yaw=Math.atan2(dx,dz);
    if(distance<9){actor.state='reposition';const step=Math.min(10-distance,spec.speed*.8*dt),inverseDistance=distance>.001?1/distance:0;actor.position.x-=dx*inverseDistance*step;actor.position.z-=dz*inverseDistance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    if(distance>21){actor.state='chase';const step=Math.min(distance-16,spec.speed*.8*dt);actor.position.x+=dx/distance*step;actor.position.z+=dz/distance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;return;}
    actor.state='attack';strafeRangedScavenger(actor,dt,player,heightAt);if(actor.attackCooldown<=0){const sequence=actor.shotSequence??0;actor.shotSequence=sequence+1;if(deterministicShotRoll(actor)<lookoutHitChance(actor,distance))onAttack(9,actor.id,'projectile');actor.attackCooldown=2.15+(actor.seed%46)/100;}
    return;
  }
  if(hostile&&distance<38&&canSeePlayer){
    actor.yaw=Math.atan2(dx,dz);
    if(distance<1.55){actor.state='attack';if(actor.attackCooldown<=0){onAttack(spec.damage,actor.id);actor.attackCooldown=1.35;}}
    else {actor.state='chase';const step=Math.min(distance-1.25,spec.speed*dt);actor.position.x+=dx/distance*step;actor.position.z+=dz/distance*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;}
    return;
  }
  if(actor.species==='islandScavenger'&&hostile&&actor.memorySeconds<=0){actor.awareness=Math.max(0,actor.awareness-dt*.35);if(actor.awareness<.2&&!actor.angered)actor.alerted=false;}
  actor.state='wander';actor.wanderTime+=dt;
  const wanderInterval=4+actor.seed%4;if(actor.wanderTime>wanderInterval){actor.wanderTime-=wanderInterval;actor.wanderCycle++;const phase=actor.seed*.00001+actor.wanderCycle*2.399;actor.wanderX=actor.home.x+Math.sin(phase)*4;actor.wanderZ=actor.home.z+Math.cos(phase*.71)*4;}
  const wx=actor.wanderX-actor.position.x,wz=actor.wanderZ-actor.position.z,wd=Math.hypot(wx,wz);
  if(wd>.22){const step=Math.min(wd,spec.speed*.18*dt);actor.position.x+=wx/wd*step;actor.position.z+=wz/wd*step;actor.position.y=heightAt(actor.position.x,actor.position.z)+.05;actor.yaw=Math.atan2(wx,wz);}
}

export class WildlifeSystem {
  readonly actors:WildlifeActor[];
  private readonly objects=new Map<string,THREE.Mesh>();
  private readonly materials=new Map<string,THREE.MeshStandardMaterial>();
  private readonly geometries=new Map<string,THREE.BufferGeometry>();
  private readonly raidAlarmSources=new Set<string>();
  constructor(private scene:THREE.Scene,context:WildlifeSpawnContext){
    this.actors=createWildlifePopulation(context);
    for(const actor of this.actors){const object=this.createModel(actor);this.objects.set(actor.id,object);scene.add(object);}
  }
  private geometryKey(actor:WildlifeActor){return `${actor.species}:${actor.archetype??'default'}`;}
  private geometryFor(actor:WildlifeActor){
    const key=this.geometryKey(actor),species=actor.species,cached=this.geometries.get(key);if(cached)return cached;
    const parts:THREE.BufferGeometry[]=[],coat=actor.archetype==='lookout'?0x635d4c:actor.archetype==='guard'?0x505650:SPECIES[species].color,bone=0xd0c2a2,dark=0x272a27;
    const add=(geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,rotationZ=0)=>{const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,rotationZ)),new THREE.Vector3(sx,sy,sz));geometry.applyMatrix4(matrix);const base=new THREE.Color(color),position=geometry.getAttribute('position'),colors=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){colors[i*3]=base.r;colors[i*3+1]=base.g;colors[i*3+2]=base.b;}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geometry);};
    const ellipsoid=(color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>add(new THREE.SphereGeometry(1,16,12),color,x,y,z,sx,sy,sz);
    if(species==='islandScavenger'){
      add(new THREE.CapsuleGeometry(.235,.34,5,10),coat,0,1.03,0,1,1,1);
      add(new THREE.SphereGeometry(.16,12,10),0x887c60,0,1.56,0,1,1,1);
      add(new THREE.CapsuleGeometry(.066,.12,3,8),0x766d58,0,1.405,0,1,1,1);
      add(new THREE.TorusGeometry(.132,.025,5,14),0x403f36,0,1.37,0,1,1,1);
      // Layered field clothing breaks up the smooth mannequin silhouette while
      // staying in the same shared, merged geometry for each scavenger role.
      add(new THREE.BoxGeometry(.32,.17,.25),0x49463c,0,.59,-.015,1,1,1);
      const collar=new THREE.TorusGeometry(.14,.035,5,12);collar.rotateX(Math.PI/2);add(collar,actor.archetype==='guard'?0x555b54:0x756449,0,1.40,0,1,1,1);
      add(new THREE.BoxGeometry(.038,.53,.052),0xb2935d,-.092,1.08,-.235,1,1,1,-.12);
      add(new THREE.BoxGeometry(.038,.53,.052),0xb2935d,.092,1.08,-.235,1,1,1,.12);
      add(new THREE.BoxGeometry(.12,.10,.025),0x76705b,0,.91,-.255,1,1,1);
      add(new THREE.BoxGeometry(.30,.29,.075),0x393a34,0,1.02,-.14,1,1,1);
      add(new THREE.BoxGeometry(.29,.34,.15),0x51483a,0,1.05,.19,1,1,1);
      add(new THREE.BoxGeometry(.052,.52,.035),0x6b604a,-.105,1.105,-.202,1,1,1,-.16);
      add(new THREE.BoxGeometry(.052,.52,.035),0x6b604a,.105,1.105,-.202,1,1,1,.16);
      add(new THREE.BoxGeometry(.31,.082,.04),0x302f2b,0,.82,-.204,1,1,1);
      add(new THREE.BoxGeometry(.115,.15,.075),0x75634a,-.145,1.09,-.225,1,1,1);
      add(new THREE.BoxGeometry(.115,.15,.075),0x635b47,.145,1.09,-.225,1,1,1);
      add(new THREE.BoxGeometry(.12,.035,.26),0x282a27,-.13,.025,-.025,1,1,1);
      add(new THREE.BoxGeometry(.12,.035,.26),0x282a27,.13,.025,-.025,1,1,1);
      const headwear=actor.archetype==='guard'?0x414943:actor.archetype==='lookout'?0x4b5148:0x5c5545;
      add(new THREE.SphereGeometry(.18,12,8,0,Math.PI*2,0,Math.PI*.55),headwear,0,1.64,.012,1,1,1);
      add(new THREE.BoxGeometry(.34,.045,.22),headwear,0,1.625,-.075,1,1,1);
      if(actor.archetype==='guard'){
        add(new THREE.BoxGeometry(.23,.075,.028),0x343a38,0,1.565,-.149,1,1,1);
        add(new THREE.BoxGeometry(.16,.018,.012),0xa48c61,0,1.57,-.168,1,1,1);
      }else if(actor.archetype==='lookout'){
        add(new THREE.BoxGeometry(.24,.065,.032),0x343a35,0,1.585,-.148,1,1,1);
        add(new THREE.BoxGeometry(.075,.038,.012),0x879080,-.052,1.585,-.168,1,1,1);
        add(new THREE.BoxGeometry(.075,.038,.012),0x879080,.052,1.585,-.168,1,1,1);
      }else{
        add(new THREE.BoxGeometry(.23,.105,.035),0x514c40,0,1.405,-.139,1,1,1);
      }
      for(const side of [-1,1]){
        ellipsoid(actor.archetype==='guard'?0x687068:coat,side*.235,1.245,.005,.13,.145,.145);
        add(new THREE.CapsuleGeometry(.074,.40,4,8),coat,side*.34,1.00,0,1,1,1,side*-.08);
        add(new THREE.CapsuleGeometry(.058,.22,4,7),actor.archetype==='guard'?0x464c47:0x51483a,side*.35,.77,-.018,1,1,1,side*-.055);
        ellipsoid(0x343630,side*.35,.575,-.06,.068,.065,.067);
        add(new THREE.CapsuleGeometry(.09,.48,4,8),0x51483a,side*.13,.40,.015,1,1,1,side*-.025);
        add(new THREE.BoxGeometry(.18,.11,.24),dark,side*.13,.085,-.015,1,1,1);
        add(new THREE.BoxGeometry(.135,.10,.07),actor.archetype==='guard'?0x555b54:0x5f5948,side*.13,.36,-.115,1,1,1);
        add(new THREE.SphereGeometry(.032,8,6),0xc3a274,side*.066,1.58,-.137,1,1,1);
      }
      if(actor.archetype==='lookout'){
        add(new THREE.TorusGeometry(.42,.034,7,20,Math.PI*1.42),0xa77a40,.39,1.08,-.24,1,1,1);
        add(new THREE.CylinderGeometry(.012,.012,.82,5),0x30332f,.39,1.08,-.24,1,1,1);
        add(new THREE.BoxGeometry(.11,.20,.12),0x4a5149,.23,1.02,-.24,1,1,1);
      }else if(actor.archetype==='guard'){
        // A faceted, layered plate breaks the smooth capsule torso and reads
        // clearly at gameplay distance without adding another render object.
        add(new THREE.CylinderGeometry(1,1,1,8,1),0x73796d,0,1.055,-.235,.17,.185,.065);
        add(new THREE.BoxGeometry(.30,.075,.055),0x515950,0,.91,-.255,1,1,1);
        for(const side of [-1,1]){
          ellipsoid(0x62695f,side*.245,1.30,-.045,.15,.115,.15);
          add(new THREE.BoxGeometry(.09,.105,.065),side<0?0x514c40:0x625a48,side*.13,.925,-.275,1,1,1);
          add(new THREE.BoxGeometry(.075,.17,.045),0x555d55,side*.13,.43,-.14,1,1,1);
        }
        add(new THREE.BoxGeometry(.06,.06,.035),0xb08a4b,0,1.19,-.297,1,1,1);
        add(new THREE.BoxGeometry(.055,.31,.09),0x3e4642,-.12,1.05,-.23,1,1,1);
        add(new THREE.BoxGeometry(.055,.31,.09),0x3e4642,.12,1.05,-.23,1,1,1);
        add(new THREE.BoxGeometry(.10,.09,.34),0x292d2c,.40,1.08,-.30,1,1,1);
        add(new THREE.BoxGeometry(.045,.05,.62),0x363a37,.40,1.08,-.66,1,1,1);
        add(new THREE.BoxGeometry(.11,.12,.18),0x454b47,.40,1.08,.02,1,1,1);
        add(new THREE.BoxGeometry(.13,.19,.17),0x514d42,.22,1.01,-.30,1,1,1);
      }
    } else if(species==='islandDeer'){
      ellipsoid(coat,0,.83,.02,.34,.40,.60);
      const neck=new THREE.CapsuleGeometry(.125,.30,4,8);neck.rotateX(-.42);add(neck,coat,0,1.10,-.34,1,1,1);
      ellipsoid(coat,0,1.36,-.53,.15,.15,.16);ellipsoid(0x6e5741,0,1.315,-.665,.095,.064,.085);
      for(const side of [-1,1]){
        add(new THREE.CapsuleGeometry(.055,.48,4,7),coat,side*.17,.34,-.34,1,1,1,side*-.035);
        add(new THREE.CapsuleGeometry(.05,.42,4,7),coat,side*.17,.34,.34,1,1,1,side*.035);
        ellipsoid(0xd5c2a0,side*.17,.75,-.01,.075,.14,.37);
        ellipsoid(dark,side*.075,1.39,-.653,.018,.021,.018);
        ellipsoid(0x9c7753,side*.15,1.48,-.48,.105,.055,.145);
        ellipsoid(0xd0ad83,side*.15,1.48,-.505,.065,.029,.10);
        const mainAntler=new THREE.CapsuleGeometry(.022,.20,3,5);add(mainAntler,0x806447,side*.08,1.60,-.48,1,1,1,side*-.26);
        const tine=new THREE.CapsuleGeometry(.014,.105,3,5);add(tine,0x806447,side*.165,1.72,-.49,1,1,1,-side*.52);
        const tineTip=new THREE.CapsuleGeometry(.012,.075,3,5);add(tineTip,0x8a6c4b,side*.115,1.76,-.49,1,1,1,side*.16);
        const outerFork=new THREE.CapsuleGeometry(.012,.10,3,5);add(outerFork,0x806447,side*.22,1.74,-.48,1,1,1,-side*.72);
        const hoof=new THREE.SphereGeometry(1,8,6);add(hoof,0x332e27,side*.17,.075,-.36,.06,.075,.085);
        const rearHoof=new THREE.SphereGeometry(1,8,6);add(rearHoof,0x332e27,side*.17,.075,.33,.06,.075,.085);
      }
      ellipsoid(coat,0,.94,.62,.09,.105,.16);ellipsoid(0xe0d0b5,0,.96,.75,.055,.065,.07);
    } else {
      const wolf=species==='islandWolf';
      // Give the two common animals distinct mass and posture while keeping one
      // shared merged mesh per species. Their gameplay capsules remain untouched.
      ellipsoid(coat,0,wolf?.69:.68,.015,wolf?.31:.39,wolf?.31:.39,wolf?.76:.66);
      ellipsoid(wolf?0x62645f:0x684b39,0,wolf?.77:.73,-.32,wolf?.27:.36,wolf?.30:.34,wolf?.32:.42);
      ellipsoid(wolf?0x77766e:0x765841,0,.70,.35,wolf?.30:.31,wolf?.32:.34,wolf?.32:.37);
      ellipsoid(coat,0,.80,-.51,wolf?.235:.30,wolf?.23:.27,wolf?.27:.34);
      ellipsoid(wolf?0xa4a096:0x80654e,0,.50,-.22,wolf?.215:.27,wolf?.15:.18,wolf?.42:.45);
      for(const x of [-.20,.20]){
        if(wolf){
          const ear=new THREE.ConeGeometry(.09,.23,7);add(ear,0x555650,x,1.075,-.49,1,1,1,x<0?-.10:.10);
          ellipsoid(0x87857c,x*.70,.83,-.595,.044,.038,.024);
          ellipsoid(dark,x*.70,.835,-.614,.018,.020,.012);
      }else{
        ellipsoid(0x745541,x*1.14,1.005,-.49,.105,.14,.095);
        ellipsoid(0x8a6950,x*1.16,1.03,-.51,.062,.085,.045);
        const tusk=new THREE.ConeGeometry(.065,.22,7);add(tusk,bone,x*1.12,.64,-.82,1,1,1,x<0?.34:-.34);
      }
      }
      if(wolf){
        const muzzle=new THREE.CylinderGeometry(.07,.14,.28,8,1);muzzle.rotateX(-Math.PI/2);add(muzzle,0x62645f,0,.75,-.76,1,1,1);
        ellipsoid(dark,0,.75,-.92,.064,.05,.062);
        for(const x of [-.045,.045])ellipsoid(0x241f1b,x,.735,-.964,.014,.012,.008);
        ellipsoid(coat,0,.78,.66,.075,.08,.24);
        ellipsoid(0xb0aaa0,0,.48,-.43,.22,.16,.22);
      }else{
        ellipsoid(0x57473c,0,.64,-.79,.245,.145,.19);
        ellipsoid(0x302c28,0,.68,-.975,.118,.075,.052);
        // A low, weather-darkened mantle and short backward-leaning bristles
        // break up the smooth toy-like back while staying in the merged mesh.
        ellipsoid(0x725540,0,.90,-.01,.29,.105,.47);
        for(let tuft=0;tuft<8;tuft++){
          const z=-.39+tuft*.105,top=.91+.12*Math.sqrt(Math.max(.12,1-(z/.48)**2)),bristle=new THREE.ConeGeometry(.029,.13,5,1);
          bristle.rotateX(.32);add(bristle,tuft%3===0?0x594438:0x604a3c,tuft%2?-.012:.012,top+.045,z,1,1,1);
        }
        const tail=new THREE.CatmullRomCurve3([
          new THREE.Vector3(0,.82,.54),new THREE.Vector3(.025,.96,.68),
          new THREE.Vector3(.12,1.04,.78),new THREE.Vector3(.19,1.00,.82),
          new THREE.Vector3(.17,.91,.79),new THREE.Vector3(.12,.89,.73),
        ]);
        add(new THREE.TubeGeometry(tail,14,.026,5,false),0x514034,0,0,0,1,1,1);
        for(const x of [-.055,.055])ellipsoid(0x171614,x,.685,-1.018,.018,.014,.008);
        for(let tuft=0;tuft<3;tuft++){
          const bristle=new THREE.ConeGeometry(.052,.16,5);bristle.rotateX(.34);
          add(bristle,tuft===1?0x40352e:0x493b32,0,.965,.16+tuft*.17,1,1,1);
        }
      }
      for(const x of [-.23,.23])for(const z of [-.42,.42]){
        add(new THREE.CapsuleGeometry(wolf?.064:.072,wolf?.38:.29,3,6),coat,x,wolf?.28:.31,z,1,1,1);
        ellipsoid(wolf?0x4b4d49:0x574336,x,.075,z-(z<0?.035:-.01),.084,.075,.12);
      }
    }
    const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();if(!geometry)throw new Error('Could not combine wildlife model geometry');geometry.computeBoundingSphere();this.geometries.set(key,geometry);
    let material=this.materials.get(key);if(!material){material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94});this.materials.set(key,material);}return geometry;
  }
  private createModel(actor:WildlifeActor){const key=this.geometryKey(actor),mesh=new THREE.Mesh(this.geometryFor(actor),this.materials.get(key)!);mesh.scale.setScalar(SPECIES[actor.species].scale);mesh.position.set(actor.position.x,actor.position.y,actor.position.z);mesh.rotation.y=actor.yaw+Math.PI;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;return mesh;}
  object(id:string){return this.objects.get(id)??null;}
  update(dt:number,player:Vec3,heightAt:(x:number,z:number)=>number,onAttack:(damage:number,sourceId:string,type?:DamageType)=>void,lineOfSight?:(actor:WildlifeActor,player:Vec3)=>boolean,raidTarget?:(actor:WildlifeActor,player:Vec3)=>WildlifeRaidTarget|null,onRaid?:(targetId:string,damage:number,actor:WildlifeActor)=>void){
    for(const actor of this.actors){const object=this.objects.get(actor.id);if(actor.state==='dead'){if(object)object.visible=false;this.raidAlarmSources.delete(actor.id);continue;}const distance=Math.hypot(player.x-actor.position.x,player.z-actor.position.z);if(distance>100){if(object)object.visible=false;continue;}let canSeePlayer=true;if(actor.species==='islandScavenger'){actor.perceptionCooldown-=dt;if(actor.perceptionCooldown<=0){const dx=player.x-actor.position.x,dz=player.z-actor.position.z,forwardX=Math.sin(actor.yaw),forwardZ=Math.cos(actor.yaw),inView=distance<.01||(dx*forwardX+dz*forwardZ)/distance>=.5;actor.canSeePlayer=distance<SPECIES.islandScavenger.aggro+5&&inView&&(lineOfSight?.(actor,player)??true);actor.blockedRaidDoor=!actor.canSeePlayer&&(actor.alerted||actor.angered)?raidTarget?.(actor,player)??undefined:undefined;actor.perceptionCooldown=.20+(actor.seed%51)/1000;}canSeePlayer=actor.canSeePlayer;if(canSeePlayer){actor.awareness=Math.min(1,actor.awareness+dt*(distance<8?.85:.42));if(actor.awareness>=1&&!actor.alerted){actor.alerted=true;shareScavengerAlarm(actor,this.actors,player);}actor.lastKnownPlayer.x=player.x;actor.lastKnownPlayer.y=player.y;actor.lastKnownPlayer.z=player.z;actor.memorySeconds=3.25;}else{actor.awareness=Math.max(0,actor.awareness-dt*.16);actor.memorySeconds=Math.max(0,actor.memorySeconds-dt);}}
      else if(distance<38&&(actor.angered||distance<SPECIES[actor.species].aggro)){actor.perceptionCooldown-=dt;if(actor.perceptionCooldown<=0){actor.canSeePlayer=lineOfSight?.(actor,player)??true;actor.perceptionCooldown=.20+(actor.seed%51)/1000;}canSeePlayer=actor.canSeePlayer;}
      tickWildlife(actor,dt,player,heightAt,onAttack,canSeePlayer,(id,damage)=>onRaid?.(id,damage,actor));if(actor.species==='islandScavenger'&&actor.state==='raid'&&!this.raidAlarmSources.has(actor.id)){actor.alerted=true;actor.awareness=Math.max(actor.awareness,.5);shareScavengerAlarm(actor,this.actors,player);this.raidAlarmSources.add(actor.id);}else if(actor.state!=='raid')this.raidAlarmSources.delete(actor.id);actor.hitReaction=Math.max(0,actor.hitReaction-dt*4.2);const gallopPhase=actor.species==='islandDeer'&&actor.state==='flee'?actor.combatMoveTime*15+actor.seed*.0001:0,gallopLift=gallopPhase?.025+Math.abs(Math.sin(gallopPhase))*.075:0;if(object){object.visible=true;object.position.set(actor.position.x,actor.position.y+(actor.state==='attack'?Math.sin(actor.attackCooldown*7)*.018:0)+actor.hitReaction*.055+gallopLift,actor.position.z);object.rotation.y=actor.yaw+Math.PI;object.rotation.x=-actor.hitReaction*.13-(actor.state==='stagger'?.2:0)+(gallopPhase?Math.sin(gallopPhase+1)*.06:0);object.rotation.z=actor.state==='stagger'?((actor.seed&1)?1:-1)*.2:0;}}
  }
  dispose(){for(const object of this.objects.values())object.removeFromParent();for(const geometry of this.geometries.values())geometry.dispose();for(const material of this.materials.values())material.dispose();this.materials.clear();this.geometries.clear();this.objects.clear();this.raidAlarmSources.clear();}
}

export const wildlifeDefinition=(species:WildlifeSpecies)=>SPECIES[species];
