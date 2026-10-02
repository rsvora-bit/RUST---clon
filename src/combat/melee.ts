import type {ItemId,Vec3} from '../core/types';

export interface MeleeWeapon {
  itemId:Extract<ItemId,'rock'|'hatchet'|'pickaxe'|'spear'|'docksideCleaver'|'quarryMaul'>;
  damage:number;
  range:number;
  cooldown:number;
  staminaCost:number;
  durabilityCost:number;
  arcCosine:number;
}

/** Existing gathering tools double as modest improvised weapons. */
export const MELEE_WEAPONS:Record<MeleeWeapon['itemId'],MeleeWeapon>={
  rock:{itemId:'rock',damage:18,range:1.7,cooldown:.62,staminaCost:5,durabilityCost:0,arcCosine:.55},
  hatchet:{itemId:'hatchet',damage:27,range:2.0,cooldown:.62,staminaCost:7,durabilityCost:1,arcCosine:.45},
  pickaxe:{itemId:'pickaxe',damage:24,range:2.05,cooldown:.68,staminaCost:8,durabilityCost:1,arcCosine:.42},
  spear:{itemId:'spear',damage:36,range:2.7,cooldown:.76,staminaCost:9,durabilityCost:1,arcCosine:.72},
  docksideCleaver:{itemId:'docksideCleaver',damage:43,range:2.2,cooldown:.7,staminaCost:10,durabilityCost:1,arcCosine:.62},
  quarryMaul:{itemId:'quarryMaul',damage:58,range:1.95,cooldown:.96,staminaCost:16,durabilityCost:2,arcCosine:.38},
};

export interface MeleeTarget {id:string;position:Vec3;radius:number}
export interface MeleeHitResult {hit:boolean;reason:'hit'|'out-of-range'|'outside-arc'|'occluded'|'invalid';distance:number;targetId?:string}

/** Deterministic first-person reach test. Call only during an attack's impact frame. */
export function resolveMeleeHit(weapon:MeleeWeapon,origin:Vec3,forward:Vec3,target:MeleeTarget,obstructionDistance=Infinity):MeleeHitResult {
  const values=[origin.x,origin.y,origin.z,forward.x,forward.y,forward.z,target.position.x,target.position.y,target.position.z,target.radius,obstructionDistance];
  if(!values.every(Number.isFinite)&&obstructionDistance!==Infinity)return {hit:false,reason:'invalid',distance:Infinity};
  if(!values.slice(0,10).every(Number.isFinite)||target.radius<0)return {hit:false,reason:'invalid',distance:Infinity};
  const dx=target.position.x-origin.x,dy=target.position.y-origin.y,dz=target.position.z-origin.z;
  const distance=Math.hypot(dx,dy,dz);if(distance>weapon.range+target.radius)return {hit:false,reason:'out-of-range',distance};
  const directionLength=Math.hypot(forward.x,forward.y,forward.z);if(directionLength<1e-6||distance<1e-6)return {hit:false,reason:'invalid',distance};
  const facing=(dx*forward.x+dy*forward.y+dz*forward.z)/(distance*directionLength);
  if(facing<weapon.arcCosine)return {hit:false,reason:'outside-arc',distance};
  if(obstructionDistance<distance-target.radius-.08)return {hit:false,reason:'occluded',distance};
  return {hit:true,reason:'hit',distance,targetId:target.id};
}

/** A swing can damage each actor at most once, even if a render frame repeats its impact callback. */
export class MeleeSwing {
  private hitIds=new Set<string>();
  constructor(readonly id:number,readonly itemId:MeleeWeapon['itemId']){}
  claimHit(targetId:string):boolean {if(this.hitIds.has(targetId))return false;this.hitIds.add(targetId);return true;}
  clear(){this.hitIds.clear();}
}
