import type {DamageType} from './damage';
import type {EquipmentSlot,ItemId,PlayerEquipment} from '../core/types';

export interface EquipmentDefinition {slot:EquipmentSlot; mitigation:Partial<Record<DamageType,number>>}

/** Field-made clothing offers modest, type-specific protection. */
export const EQUIPMENT:Partial<Record<ItemId,EquipmentDefinition>>={
  shirt:{slot:'body',mitigation:{melee:.04}},
  warmJacket:{slot:'body',mitigation:{melee:.06,cold:.28,projectile:.03}},
  pants:{slot:'legs',mitigation:{melee:.04,environmental:.04}},
  boots:{slot:'feet',mitigation:{melee:.03,environmental:.08,cold:.06}},
  protectiveHood:{slot:'head',mitigation:{melee:.04,cold:.12,toxic:.08}},
};

export function equipmentMitigation(equipment:PlayerEquipment|undefined,type:DamageType):number {
  const total=Object.values(equipment??{}).reduce((sum,itemId)=>sum+(EQUIPMENT[itemId]?.mitigation[type]??0),0);
  return Math.min(.55,total);
}

export function canEquip(itemId:ItemId):boolean{return EQUIPMENT[itemId]!==undefined;}
