import type {ItemId,ItemStack,Vec3} from '../core/types';
import {ITEMS,isItemId} from '../items/definitions';
import {copyInventory,insertItem,moveStack} from '../inventory/inventory';
import {DEATH} from '../config/gameplay';
import {isSalvageComponent,RECYCLE_RECIPES,type RecycleRecipe} from './economy';

export const MAX_PLAYER_STATIONS=500;
export const MAX_WORLD_STATIONS=64;
const MAX_PERSISTED_STATIONS=MAX_PLAYER_STATIONS+MAX_WORLD_STATIONS+DEATH.MAX_LOST_PACKS;
export const STATION_KINDS=['storage','furnace','workbench1','workbench2','workbench3','campfire','bedroll','loot','deathbag','recycler'] as const;
export type StationKind=typeof STATION_KINDS[number];
export interface Station {id:string;kind:StationKind;position:Vec3;rotation:number;inventory:(ItemStack|null)[];active:boolean;job:{recipe:string;remaining:number}|null;createdAt?:number}
export const STATIONS:Record<StationKind,{name:string;slots:number;size:[number,number,number]}>= {
  storage:{name:'Timber storage',slots:18,size:[1.3,.75,.85]},furnace:{name:'Field processor',slots:5,size:[1.1,1.5,1.1]},
  workbench1:{name:'Workbench level 1',slots:0,size:[1.8,1,.8]},workbench2:{name:'Workbench level 2',slots:0,size:[1.8,1,.8]},workbench3:{name:'Workbench level 3',slots:0,size:[1.8,1,.8]},
  campfire:{name:'Campfire',slots:1,size:[1,.3,1]},bedroll:{name:'Sleeping roll',slots:0,size:[.85,.2,1.9]},loot:{name:'Salvage cache',slots:12,size:[1,.8,.8]},
  deathbag:{name:'Lost Pack',slots:30,size:[1.15,.58,.82]},recycler:{name:'SALVAGE RECYCLER',slots:6,size:[2.05,1.45,1.35]},
};
export const PROCESSING={metal:{input:'ore' as ItemId,count:10,fuel:5,output:'metal' as ItemId,amount:10,seconds:8},fire:{input:'wood' as ItemId,count:0,fuel:1,output:null,amount:0,seconds:30}};

export function createStation(id:string,kind:StationKind,position:Vec3,rotation=0):Station{return {id,kind,position:{...position},rotation,inventory:Array(STATIONS[kind].slots).fill(null),active:false,job:null};}
export const isStationInputSlot=(s:Station,index:number)=>s.kind==='furnace'?index<3:s.kind==='campfire'?index===0:s.kind==='recycler'?index<3:true;
export const isStationOutputSlot=(s:Station,index:number)=>s.kind==='furnace'?index>=3:s.kind==='recycler'?index>=3:false;
export function accepts(s:Station,index:number,item:ItemStack|null){
  if(!item)return true;
  if(s.kind==='furnace')return index<2?item.itemId==='ore':index===2?item.itemId==='wood':false;
  if(s.kind==='campfire')return index===0&&item.itemId==='wood';
  if(s.kind==='recycler')return index<3&&isSalvageComponent(item.itemId);
  return true;
}
export type SlotRef={container:'player'|'station';slot:number};
export function transfer(player:(ItemStack|null)[],s:Station,from:SlotRef,to:SlotRef,split:boolean,fits:(p:(ItemStack|null)[])=>boolean){
  const offset=player.length,a=from.slot+(from.container==='station'?offset:0),b=to.slot+(to.container==='station'?offset:0);
  if(from.slot<0||to.slot<0||from.slot>=(from.container==='player'?offset:s.inventory.length)||to.slot>=(to.container==='player'?offset:s.inventory.length))return false;
  const joined=[...copyInventory(player),...copyInventory(s.inventory)];if(!moveStack(joined,a,b,split))return false;
  const next=joined.slice(offset);
  for(const i of [from.container==='station'?from.slot:-1,to.container==='station'?to.slot:-1])if(i>=0&&JSON.stringify(next[i])!==JSON.stringify(s.inventory[i])&&next[i]&&!accepts(s,i,next[i])){
    const original=s.inventory[i],reduced=isStationOutputSlot(s,i)&&original?.itemId===next[i]?.itemId&&next[i]!.count<original.count;
    if(!reduced)return false;
  }
  const p=joined.slice(0,offset);if(!fits(p))return false;player.splice(0,player.length,...p);s.inventory=next;return true;
}
export function takeAll(player:(ItemStack|null)[],s:Station,fits:(p:(ItemStack|null)[])=>boolean){let moved=0;for(let i=0;i<s.inventory.length;i++){const item=s.inventory[i];if(!item)continue;const p=copyInventory(player),remaining=insertItem(p,item.itemId,item.count);if(!fits(p))continue;moved+=item.count-remaining;player.splice(0,player.length,...p);s.inventory[i]=remaining?{...item,count:remaining}:null;}return moved;}

export function currentRecyclerRecipe(s:Station):RecycleRecipe|undefined{
  if(s.kind!=='recycler')return undefined;
  if(s.job&&isSalvageComponent(s.job.recipe))return RECYCLE_RECIPES[s.job.recipe];
  const input=s.inventory.slice(0,3).find(stack=>stack&&isSalvageComponent(stack.itemId));
  return input&&isSalvageComponent(input.itemId)?RECYCLE_RECIPES[input.itemId]:undefined;
}
function recyclerOutputsFit(s:Station,recipe:RecycleRecipe){const output=copyInventory(s.inventory.slice(3,6));return insertItem(output,'scrap',recipe.scrap)===0&&insertItem(output,'metal',recipe.metal)===0;}
function completeRecycler(s:Station,recipe:RecycleRecipe){const output=copyInventory(s.inventory.slice(3,6));if(insertItem(output,'scrap',recipe.scrap)||insertItem(output,'metal',recipe.metal))return false;s.inventory.splice(3,3,...output);return true;}

export function stationStatus(s:Station){
  if(!s.active)return 'OFF';
  if(s.kind==='recycler'){
    const recipe=currentRecyclerRecipe(s);if(!recipe)return 'BLOCKED_NO_INPUT';
    if(s.job&&s.job.remaining>0)return 'PROCESSING';
    return recyclerOutputsFit(s,recipe)?(s.job?'PROCESSING':'ON'):'BLOCKED_OUTPUT_FULL';
  }
  if(s.job){if(s.job.remaining<=0)return 'BLOCKED_OUTPUT_FULL';return 'PROCESSING';}
  if(s.kind==='campfire')return s.inventory[0]?'ON':'BLOCKED_NO_FUEL';if(s.kind!=='furnace')return 'ON';
  const count=s.inventory.slice(0,2).reduce((n,x)=>n+(x?.itemId==='ore'?x.count:0),0);return count<10?'BLOCKED_NO_INPUT':(s.inventory[2]?.count??0)<5?'BLOCKED_NO_FUEL':'ON';
}

export function tickStation(s:Station,dt:number){
  if(!s.active||!Number.isFinite(dt)||dt<=0||!['furnace','campfire','recycler'].includes(s.kind))return;
  let budget=Math.min(dt,3600);
  for(let n=0;n<500&&budget>=0;n++){
    if(s.kind==='recycler'){
      let recipe=currentRecyclerRecipe(s);if(!recipe)return;
      if(!s.job){if(stationStatus(s)!=='ON'||!recyclerOutputsFit(s,recipe))return;const index=s.inventory.slice(0,3).findIndex(stack=>stack?.itemId===recipe!.input);if(index<0)return;const stack=s.inventory[index]!;if(--stack.count===0)s.inventory[index]=null;s.job={recipe:recipe.input,remaining:recipe.seconds};}
      recipe=currentRecyclerRecipe(s);if(!recipe)return;
      const used=Math.min(budget,s.job!.remaining);s.job!.remaining-=used;budget-=used;if(s.job!.remaining>0)return;
      if(!completeRecycler(s,recipe))return;s.job=null;if(budget<=0)return;continue;
    }
    const recipe=s.kind==='furnace'?PROCESSING.metal:PROCESSING.fire;
    if(!s.job){if(stationStatus(s)!=='ON')return;if(s.kind==='furnace'){let need=recipe.count;for(let i=0;i<2&&need;i++){const x=s.inventory[i];if(!x)continue;const amount=Math.min(x.count,need);x.count-=amount;need-=amount;if(!x.count)s.inventory[i]=null;}}const fuel=s.kind==='furnace'?2:0,stack=s.inventory[fuel];if(!stack)return;stack.count-=recipe.fuel;if(!stack.count)s.inventory[fuel]=null;s.job={recipe:s.kind==='furnace'?'metal':'fire',remaining:recipe.seconds};}
    const used=Math.min(budget,s.job.remaining);s.job.remaining-=used;budget-=used;if(s.job.remaining>0)return;
    if(recipe.output){const output=copyInventory(s.inventory.slice(3));if(insertItem(output,recipe.output,recipe.amount))return;s.inventory.splice(3,2,...output);}s.job=null;if(budget<=0)return;
  }
}

export function nearbyWorkbench(stations:Station[],p:Vec3){let level=0;for(const s of stations)if(s.kind.startsWith('workbench')&&Math.hypot(p.x-s.position.x,p.y-s.position.y,p.z-s.position.z)<=5)level=Math.max(level,Number(s.kind.slice(-1)));return level;}
export const isDisposableContainer=(s:Station)=>s.kind==='loot'||s.kind==='deathbag';
export const isWorldStation=(s:Station)=>s.kind==='loot'||s.kind==='recycler';
export const isPlayerPlaceableStationKind=(kind:StationKind)=>kind!=='loot'&&kind!=='deathbag'&&kind!=='recycler';
export const isPlaceableStationKind=isPlayerPlaceableStationKind;
export const countPlayerStations=(stations:Station[])=>stations.filter(s=>isPlayerPlaceableStationKind(s.kind)).length;

export function validateStations(value:unknown):value is Station[]{
  if(!Array.isArray(value)||value.length>MAX_PERSISTED_STATIONS)return false;
  const stations=value as Station[];
  if(countPlayerStations(stations)>MAX_PLAYER_STATIONS||stations.filter(isWorldStation).length>MAX_WORLD_STATIONS||stations.filter(s=>s.kind==='deathbag').length>DEATH.MAX_LOST_PACKS)return false;
  const ids=new Set();return stations.every(s=>{
    if(!s||typeof s.id!=='string'||s.id.length>100||ids.has(s.id)||!STATION_KINDS.includes(s.kind)||!s.position||![s.position.x,s.position.y,s.position.z,s.rotation].every(Number.isFinite)||!Array.isArray(s.inventory)||s.inventory.length!==STATIONS[s.kind].slots||typeof s.active!=='boolean'||s.createdAt!==undefined&&(!Number.isFinite(s.createdAt)||s.createdAt<0))return false;
    ids.add(s.id);if(s.kind==='deathbag'&&(s.active||s.job!==null||s.createdAt===undefined))return false;
    if(!s.inventory.every(x=>x===null||(x&&isItemId(x.itemId)&&Number.isSafeInteger(x.count)&&x.count>0&&x.count<=ITEMS[x.itemId].maxStack)))return false;
    if(s.kind==='furnace'&&!s.inventory.every((x,i)=>!x||(i<2?x.itemId==='ore':i===2?x.itemId==='wood':x.itemId==='metal')))return false;
    if(s.kind==='campfire'&&s.inventory[0]&&s.inventory[0].itemId!=='wood')return false;
    if(s.kind==='recycler'&&!s.inventory.every((x,i)=>!x||(i<3?isSalvageComponent(x.itemId):x.itemId==='scrap'||x.itemId==='metal')))return false;
    if(s.job===null)return true;
    if(!Number.isFinite(s.job.remaining)||s.job.remaining<0)return false;
    if(s.kind==='furnace')return s.job.recipe==='metal'&&s.job.remaining<=PROCESSING.metal.seconds;
    if(s.kind==='campfire')return s.job.recipe==='fire'&&s.job.remaining<=PROCESSING.fire.seconds;
    if(s.kind==='recycler'&&isSalvageComponent(s.job.recipe))return s.job.remaining<=RECYCLE_RECIPES[s.job.recipe].seconds;
    return false;
  });
}
