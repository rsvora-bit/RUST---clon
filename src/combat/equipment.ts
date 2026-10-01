import type {DamageType} from './damage';
import type {EquipmentCondition,EquipmentSlot,ItemId,PlayerEquipment} from '../core/types';
import {maxDurability} from './durability';

export interface EquipmentDefinition {slot:EquipmentSlot; mitigation:Partial<Record<DamageType,number>>}

/** Field-made clothing offers modest, type-specific protection. */
export const EQUIPMENT:Partial<Record<ItemId,EquipmentDefinition>>={
  shirt:{slot:'body',mitigation:{melee:.04}},
  warmJacket:{slot:'body',mitigation:{melee:.06,cold:.28,projectile:.03}},
  pants:{slot:'legs',mitigation:{melee:.04,environmental:.04}},
  boots:{slot:'feet',mitigation:{melee:.03,environmental:.08,cold:.06}},
  protectiveHood:{slot:'head',mitigation:{melee:.04,cold:.12,toxic:.35}},
  salvageVest:{slot:'body',mitigation:{melee:.16,projectile:.24,environmental:.03}},
  yardPlate:{slot:'body',mitigation:{melee:.28,projectile:.38,environmental:.08}},
};

export function equipmentMitigation(equipment:PlayerEquipment|undefined,type:DamageType,condition?:EquipmentCondition):number {
  const total=(Object.entries(equipment??{}) as [EquipmentSlot,ItemId][]).reduce((sum,[slot,itemId])=>{
    const durability=maxDurability(itemId),remaining=Math.max(0,Math.min(durability,condition?.[slot]??durability));
    return sum+(EQUIPMENT[itemId]?.mitigation[type]??0)*(durability?remaining/durability:1);
  },0);
  return Math.min(.55,total);
}

export function canEquip(itemId:ItemId):boolean{return EQUIPMENT[itemId]!==undefined;}

export function equipmentWear(amount:number,type:DamageType):number{
  if(!Number.isFinite(amount)||amount<=0)return 0;
  return type==='melee'||type==='projectile'?1+Math.min(60,amount)*.08:Math.min(20,amount)*.025;
}
