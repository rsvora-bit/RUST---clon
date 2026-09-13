import type {GameState,ItemId,PieceType,Structure,StructureGrade} from '../core/types';
import {copyInventory,deductCosts,itemCount} from '../inventory/inventory';

export interface GradeDefinition {health:number;label:string;resource:ItemId}
export const BUILDING_GRADES:Record<StructureGrade,GradeDefinition>={
  wood:{health:250,label:'Wood',resource:'wood'},
  stone:{health:600,label:'Stone',resource:'stone'},
  metal:{health:1000,label:'Metal',resource:'metal'},
};

const UPGRADE_COSTS:Record<PieceType,Record<'stone'|'metal',number>>={
  foundation:{stone:160,metal:140},wall:{stone:100,metal:90},doorway:{stone:90,metal:80},
  floor:{stone:120,metal:110},roof:{stone:120,metal:110},door:{stone:60,metal:55},
};
const WOOD_REPAIR_BASE:Record<PieceType,number>={foundation:60,wall:45,doorway:35,floor:45,roof:45,door:35};

export interface StructureActionResult {ok:boolean;reason:'ok'|'missing-resources'|'max-grade'|'full-health'|'not-found'|'has-dependents'|'rotation-unavailable'|'invalid';cost?:Partial<Record<ItemId,number>>;removedIds?:string[]}

export function structureGrade(structure:Structure):StructureGrade{return structure.grade??'wood';}
export function structureMaxHealth(structure:Structure):number{return BUILDING_GRADES[structureGrade(structure)].health;}
export function structureCurrentHealth(structure:Structure):number{
  const max=structureMaxHealth(structure),value=Number.isFinite(structure.currentHealth)&&Number.isFinite(structure.health)?Math.min(structure.currentHealth!,structure.health):structure.currentHealth??structure.health;
  return Math.max(0,Math.min(max,Number.isFinite(value)?value:max));
}

/** Canonicalizes a legacy building piece in place while retaining the old health mirror. */
export function migrateStructure(structure:Structure):Structure{
  structure.grade=structureGrade(structure);structure.maxHealth=structureMaxHealth(structure);
  structure.currentHealth=structureCurrentHealth(structure);structure.health=structure.currentHealth;
  if(structure.pieceType!=='door')delete structure.flipped;
  return structure;
}

export function nextGrade(structure:Structure):StructureGrade|null{const grade=structureGrade(structure);return grade==='wood'?'stone':grade==='stone'?'metal':null;}
export function upgradeCost(structure:Structure):Partial<Record<ItemId,number>>|null{const next=nextGrade(structure);return next?{[BUILDING_GRADES[next].resource]:UPGRADE_COSTS[structure.pieceType][next as 'stone'|'metal']}:null;}
export function resourceCount(state:GameState,cost:Partial<Record<ItemId,number>>):{required:number;have:number;item:ItemId}{const [item,required]=Object.entries(cost)[0] as [ItemId,number];return {item,required,have:itemCount(state.inventory,item)};}

/** Validate on a copy, then consume once and apply. Failed upgrades never mutate inventory or structure state. */
export function upgradeStructure(state:GameState,structure:Structure):StructureActionResult{
  const next=nextGrade(structure),cost=upgradeCost(structure);if(!next||!cost)return {ok:false,reason:'max-grade'};
  const inventory=copyInventory(state.inventory);if(!deductCosts(inventory,cost))return {ok:false,reason:'missing-resources',cost};
  state.inventory=inventory;structure.grade=next;structure.maxHealth=BUILDING_GRADES[next].health;structure.currentHealth=structure.maxHealth;structure.health=structure.currentHealth;
  return {ok:true,reason:'ok',cost};
}

export function repairCost(structure:Structure):{cost:Partial<Record<ItemId,number>>;amount:number}|null{
  const grade=structureGrade(structure),max=structureMaxHealth(structure),current=structureCurrentHealth(structure),amount=Math.min(max-current,Math.ceil(max*.25));
  if(amount<=0)return null;
  const base=grade==='wood'?WOOD_REPAIR_BASE[structure.pieceType]:UPGRADE_COSTS[structure.pieceType][grade];
  return {cost:{[BUILDING_GRADES[grade].resource]:Math.max(1,Math.ceil(base*amount/max))},amount};
}

export function repairStructure(state:GameState,structure:Structure):StructureActionResult{
  const quote=repairCost(structure);if(!quote)return {ok:false,reason:'full-health'};
  const inventory=copyInventory(state.inventory);if(!deductCosts(inventory,quote.cost))return {ok:false,reason:'missing-resources',cost:quote.cost};
  state.inventory=inventory;structure.currentHealth=Math.min(structureMaxHealth(structure),structureCurrentHealth(structure)+quote.amount);structure.health=structure.currentHealth;structure.maxHealth=structureMaxHealth(structure);structure.grade=structureGrade(structure);
  return {ok:true,reason:'ok',cost:quote.cost};
}

export function demolishStructure(state:GameState,id:string):StructureActionResult{
  const index=state.structures.findIndex(structure=>structure.id===id);if(index<0)return {ok:false,reason:'not-found'};
  if(state.structures.some(structure=>structure.parentId===id))return {ok:false,reason:'has-dependents'};
  state.structures.splice(index,1);return {ok:true,reason:'ok',removedIds:[id]};
}

export function rotateStructure(structure:Structure):StructureActionResult{
  if(structure.pieceType!=='door')return {ok:false,reason:'rotation-unavailable'};
  structure.flipped=!structure.flipped;return {ok:true,reason:'ok'};
}

/** Future combat/decay entrypoint. Lethal damage removes the piece and all dependent descendants. */
export function damageStructure(state:GameState,id:string,amount:number):StructureActionResult{
  const structure=state.structures.find(entry=>entry.id===id);if(!structure)return {ok:false,reason:'not-found'};
  if(!Number.isFinite(amount)||amount<=0)return {ok:false,reason:'invalid'};
  migrateStructure(structure);structure.currentHealth=Math.max(0,structure.currentHealth!-amount);structure.health=structure.currentHealth;
  if(structure.currentHealth>0)return {ok:true,reason:'ok',removedIds:[]};
  const removed=new Set<string>([id]);let changed=true;while(changed){changed=false;for(const entry of state.structures)if(entry.parentId&&removed.has(entry.parentId)&&!removed.has(entry.id)){removed.add(entry.id);changed=true;}}
  state.structures=state.structures.filter(entry=>!removed.has(entry.id));return {ok:true,reason:'ok',removedIds:[...removed]};
}
