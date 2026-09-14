import {INVENTORY} from '../config/gameplay';
import type {ItemStack} from '../core/types';

/** The common baseline for a fresh survivor and every post-death respawn. */
export function createStarterInventory():(ItemStack|null)[]{
  return Array.from({length:INVENTORY.SLOTS},(_,index)=>index===0?{itemId:'rock',count:1}:index===1?{itemId:'torch',count:1}:null);
}
