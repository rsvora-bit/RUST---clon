import type {ItemId,ItemStack} from '../core/types';

export const TOOL_DURABILITY:Partial<Record<ItemId,number>>={rock:70,hatchet:110,pickaxe:110,hammer:150,bow:95,spear:90,docksideCleaver:135,quarryMaul:180,salvageRevolver:120,fieldShotgun:145,shirt:65,pants:75,boots:90,warmJacket:115,protectiveHood:95,salvageVest:150,yardPlate:220};
export function maxDurability(itemId:ItemId):number{return TOOL_DURABILITY[itemId]??0;}
export function itemCondition(stack:ItemStack):number{const max=maxDurability(stack.itemId);return max?Math.max(0,Math.min(max,stack.condition??max)):0;}
