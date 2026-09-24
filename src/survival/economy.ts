import type {GameState,ItemId,Vec3} from '../core/types';
import type {Station,StationKind} from './stations';
import {insertItem} from '../inventory/inventory';
import {randomSource} from '../world/noise';
import {ensureProgression} from './progression';

export const ECONOMY_VERSION=1;
export const SALVAGE_COMPONENTS=['wiring','gears','machineParts','techParts'] as const satisfies readonly ItemId[];
export type SalvageComponent=typeof SALVAGE_COMPONENTS[number];

export interface RecycleRecipe {input:SalvageComponent;scrap:number;metal:number;seconds:number}
export const RECYCLE_RECIPES:Record<SalvageComponent,RecycleRecipe>={
  wiring:{input:'wiring',scrap:6,metal:4,seconds:1.5},
  gears:{input:'gears',scrap:10,metal:10,seconds:2},
  machineParts:{input:'machineParts',scrap:16,metal:14,seconds:2.5},
  techParts:{input:'techParts',scrap:28,metal:8,seconds:3},
};

export const isSalvageComponent=(value:unknown):value is SalvageComponent=>typeof value==='string'&&SALVAGE_COMPONENTS.includes(value as SalvageComponent);

export type LootTier='common'|'decent'|'lucky';
export const SALVAGE_LOOT:Record<LootTier,{item:ItemId;min:number;max:number;chance:number}[]>={
  common:[{item:'scrap',min:4,max:15,chance:.72},{item:'wiring',min:1,max:2,chance:.48},{item:'gears',min:1,max:1,chance:.12},{item:'wood',min:25,max:90,chance:.82},{item:'stone',min:20,max:75,chance:.72},{item:'fiber',min:10,max:40,chance:.58},{item:'berries',min:2,max:8,chance:.34},{item:'ore',min:8,max:28,chance:.30}],
  decent:[{item:'scrap',min:10,max:30,chance:.88},{item:'wiring',min:1,max:4,chance:.75},{item:'gears',min:1,max:3,chance:.48},{item:'machineParts',min:1,max:2,chance:.25},{item:'ore',min:28,max:75,chance:.88},{item:'metal',min:8,max:28,chance:.72},{item:'sulfurOre',min:15,max:55,chance:.68},{item:'bandage',min:1,max:3,chance:.48},{item:'canteen',min:1,max:2,chance:.35},{item:'hatchet',min:1,max:1,chance:.18},{item:'pickaxe',min:1,max:1,chance:.18}],
  lucky:[{item:'scrap',min:25,max:60,chance:.96},{item:'gears',min:1,max:5,chance:.82},{item:'wiring',min:2,max:5,chance:.68},{item:'machineParts',min:1,max:3,chance:.72},{item:'techParts',min:1,max:2,chance:.28},{item:'hqMetalOre',min:8,max:28,chance:.95},{item:'sulfurOre',min:45,max:130,chance:.92},{item:'ore',min:65,max:180,chance:.92},{item:'metal',min:20,max:65,chance:.85},{item:'bandage',min:2,max:5,chance:.68},{item:'canteen',min:1,max:3,chance:.55},{item:'pickaxe',min:1,max:1,chance:.42},{item:'hatchet',min:1,max:1,chance:.36}],
};

export function fillSalvageLoot(station:Station,tier:LootTier,rand:()=>number){
  let added=0,salvage=0;for(const entry of SALVAGE_LOOT[tier]){if(rand()>entry.chance)continue;const amount=entry.min+Math.floor(rand()*(entry.max-entry.min+1));if(insertItem(station.inventory,entry.item,amount)<amount){added++;if(entry.item==='scrap'||isSalvageComponent(entry.item))salvage++;}}
  if(!salvage)insertItem(station.inventory,tier==='common'?'wiring':'scrap',tier==='common'?1:tier==='decent'?12:30);if(!added)insertItem(station.inventory,'wood',45);
}

interface EconomyLandmark {id:string;position:Vec3;kind:number}
type StationFactory=(id:string,kind:StationKind,position:Vec3,rotation?:number)=>Station;
export function initializeWorldEconomy(state:GameState,pois:EconomyLandmark[],heightAt:(x:number,z:number)=>number,seed:number,factory:StationFactory,legacy=ensureProgression(state).lootGenerated&&ensureProgression(state).economyVersion===undefined):Vec3[]{
  const progress=ensureProgression(state),existing=new Set(progress.stations.map(s=>s.id));
  if(legacy)for(let index=0;index<Math.min(3,pois.length);index++){const poi=pois[index]!,id=`salvage-v079-${index}`,angle=index*2.17+.45,x=poi.position.x+Math.cos(angle)*6,z=poi.position.z+Math.sin(angle)*6,pos={x,y:heightAt(x,z)+.02,z},rand=randomSource(seed+79000+index*421);if(!existing.has(id)){const station=factory(id,'loot',pos,rand()*Math.PI*2);fillSalvageLoot(station,index===2?'lucky':index===1?'decent':'common',rand);progress.stations.push(station);existing.add(id);}}
  const targets=[pois.find(p=>p.kind===0),pois.find(p=>p.kind===2)].filter((p):p is EconomyLandmark=>!!p);for(const poi of pois)if(targets.length<2&&!targets.includes(poi))targets.push(poi);
  const positions:Vec3[]=[];for(let index=0;index<Math.min(2,targets.length);index++){const poi=targets[index]!,side=index?-1:1,x=poi.position.x+side*5.6,z=poi.position.z+4.7,pos={x,y:heightAt(x,z)+.02,z},id=`world-recycler-${index}`;positions.push(pos);if(!existing.has(id)){progress.stations.push(factory(id,'recycler',pos,index?Math.PI*.82:-Math.PI*.18));existing.add(id);}}
  progress.economyVersion=ECONOMY_VERSION;return positions;
}
