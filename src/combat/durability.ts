import type {ItemId,ItemStack} from '../core/types';

export const TOOL_DURABILITY:Partial<Record<ItemId,number>>={rock:70,hatchet:110,pickaxe:110,hammer:150,bow:95};
export function maxDurability(itemId:ItemId):number{return TOOL_DURABILITY[itemId]??0;}
export function itemCondition(stack:ItemStack):number{const max=maxDurability(stack.itemId);return max?Math.max(0,Math.min(max,stack.condition??max)):0;}
