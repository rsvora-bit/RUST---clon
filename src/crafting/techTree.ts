import type {GameState,ItemStack,Vec3} from '../core/types';
import {deductCosts,itemCount,type InventorySlots} from '../inventory/inventory';
import {nearbyWorkbench,type Station} from '../survival/stations';

export type TechNodeId='efficiencyTooling'|'fieldEngineering'|'workbench2Research'|'fieldMedicine'|'advancedFabrication'|'workbench3Research'|'workshopLighting';
export const TECH_NODE_IDS:TechNodeId[]=['efficiencyTooling','fieldEngineering','workbench2Research','fieldMedicine','advancedFabrication','workbench3Research','workshopLighting'];
export interface TechNodeDefinition{id:TechNodeId;displayName:string;description:string;tier:1|2|3;scrapCost:number;requiredWorkbenchLevel:1|2|3;prerequisites:TechNodeId[];unlocksRecipes:string[]}
export interface TechState{version:1;unlocked:TechNodeId[]}
export const TECH_NODES:Record<TechNodeId,TechNodeDefinition>={
  efficiencyTooling:{id:'efficiencyTooling',displayName:'Efficiency Tooling',description:'Refined fabrication methods for improved gathering tools.',tier:1,scrapCost:35,requiredWorkbenchLevel:1,prerequisites:[],unlocksRecipes:['workshop_pickaxe']},
  fieldEngineering:{id:'fieldEngineering',displayName:'Field Engineering',description:'Practical island fabrication for dependable field infrastructure.',tier:1,scrapCost:50,requiredWorkbenchLevel:1,prerequisites:[],unlocksRecipes:['storage','furnace']},
  workbench2Research:{id:'workbench2Research',displayName:'Workbench II Research',description:'Unlocks the next research and fabrication tier.',tier:1,scrapCost:80,requiredWorkbenchLevel:1,prerequisites:[],unlocksRecipes:['workbench2']},
  fieldMedicine:{id:'fieldMedicine',displayName:'Field Medicine',description:'Reliable dressings for longer expeditions away from shore.',tier:2,scrapCost:65,requiredWorkbenchLevel:2,prerequisites:['workbench2Research'],unlocksRecipes:['workshop_dressings']},
  advancedFabrication:{id:'advancedFabrication',displayName:'Advanced Fabrication',description:'Reinforced workshop methods for durable field storage.',tier:2,scrapCost:90,requiredWorkbenchLevel:2,prerequisites:['workbench2Research'],unlocksRecipes:['reinforced_storage']},
  workbench3Research:{id:'workbench3Research',displayName:'Workbench III Research',description:'Opens the final workshop research tier.',tier:2,scrapCost:150,requiredWorkbenchLevel:2,prerequisites:['workbench2Research'],unlocksRecipes:['workbench3']},
  workshopLighting:{id:'workshopLighting',displayName:'Workshop Lighting',description:'Compact lights keep advanced fabrication readable after dusk.',tier:3,scrapCost:100,requiredWorkbenchLevel:3,prerequisites:['workbench3Research'],unlocksRecipes:['workshop_lights']},
};
export const createTechState=():TechState=>({version:1,unlocked:[]});
export const validTechNode=(id:unknown):id is TechNodeId=>typeof id==='string'&&TECH_NODE_IDS.includes(id as TechNodeId);
export const uniqueTech=(ids:readonly TechNodeId[]):TechNodeId[]=>TECH_NODE_IDS.filter(id=>ids.includes(id));
export function highestWorkbench(stations:Station[]):1|2|3|0{let level:1|2|3|0=0;for(const station of stations)if(station.kind.startsWith('workbench'))level=Math.max(level,Number(station.kind.slice(-1)) as 1|2|3) as 1|2|3;return level;}
export function grandfatherUnlocks(level:1|2|3|0):TechNodeId[]{if(level===0)return [];if(level===1)return ['efficiencyTooling','workbench2Research'];if(level===2)return ['efficiencyTooling','fieldEngineering','workbench2Research','fieldMedicine','advancedFabrication','workbench3Research'];return [...TECH_NODE_IDS];}
export function ensureTech(state:GameState):TechState{const progression=state.progression??(state.progression={version:1,stations:[],weather:{kind:'clear',blend:0,remaining:240},lootGenerated:false});if(progression.tech){progression.tech.unlocked=uniqueTech(progression.tech.unlocked.filter(validTechNode));return progression.tech;}const migrated:TechState={version:1,unlocked:grandfatherUnlocks(highestWorkbench(progression.stations))};progression.tech=migrated;return migrated;}
export type ResearchReason='ok'|'unknown-node'|'already-unlocked'|'prerequisite'|'workbench'|'resources';
export interface ResearchResult{ok:boolean;reason:ResearchReason;node?:TechNodeDefinition;remainingScrap?:number}
export function researchTech(state:GameState,nodeId:TechNodeId,playerPosition:Vec3):ResearchResult{
  const node=TECH_NODES[nodeId];if(!node)return {ok:false,reason:'unknown-node'};const tech=ensureTech(state);
  if(tech.unlocked.includes(nodeId))return {ok:false,reason:'already-unlocked',node,remainingScrap:itemCount(state.inventory,'scrap')};
  if(!node.prerequisites.every(id=>tech.unlocked.includes(id)))return {ok:false,reason:'prerequisite',node,remainingScrap:itemCount(state.inventory,'scrap')};
  if(nearbyWorkbench(state.progression?.stations??[],playerPosition)<node.requiredWorkbenchLevel)return {ok:false,reason:'workbench',node,remainingScrap:itemCount(state.inventory,'scrap')};
  const preview=state.inventory.map(stack=>stack?{...stack}:null) as InventorySlots;if(!deductCosts(preview,{scrap:node.scrapCost}))return {ok:false,reason:'resources',node,remainingScrap:itemCount(state.inventory,'scrap')};
  state.inventory=preview;tech.unlocked=uniqueTech([...tech.unlocked,nodeId]);return {ok:true,reason:'ok',node,remainingScrap:itemCount(state.inventory,'scrap')};
}
