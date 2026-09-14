import {DEATH,INVENTORY,SURVIVAL} from '../config/gameplay';
import type {GameState,Vec3} from '../core/types';
import {createStarterInventory} from '../inventory/starter';
import {ensureProgression} from './progression';
import {createStation,isDisposableContainer,type Station} from './stations';

export interface DeathResult {processed:boolean;packId?:string;removedPackIds:string[];lostItemCount:number}

const lostPacks=(state:GameState)=>ensureProgression(state).stations.filter(station=>station.kind==='deathbag');
const ageOrder=(a:Station,b:Station)=>(a.createdAt??0)-(b.createdAt??0)||(Number(a.id.match(/(\d+)$/)?.[1])||0)-(Number(b.id.match(/(\d+)$/)?.[1])||0)||a.id.localeCompare(b.id);

/** Atomic and idempotent: inventory is copied to one pack, then cleared, and the event is marked processed. */
export function handlePlayerDeath(state:GameState,position:Vec3,cause?:string):DeathResult{
  const progress=ensureProgression(state),previous=progress.death;
  if(previous?.phase==='dead')return {processed:false,packId:previous.packId,removedPackIds:[],lostItemCount:0};
  const snapshot=state.inventory.map(stack=>stack?{...stack}:null),lostItemCount=snapshot.reduce((sum,stack)=>sum+(stack?.count??0),0);
  const removedPackIds:string[]=[];
  while(lostItemCount>0&&lostPacks(state).length>=DEATH.MAX_LOST_PACKS){const oldest=lostPacks(state).sort(ageOrder)[0]!;progress.stations.splice(progress.stations.indexOf(oldest),1);removedPackIds.push(oldest.id);}
  let packId:string|undefined;
  if(lostItemCount>0){const pack=createStation(`deathbag-${state.nextId++}`,'deathbag',position);pack.inventory=snapshot;pack.createdAt=state.elapsed;progress.stations.push(pack);packId=pack.id;}
  state.inventory=Array(INVENTORY.SLOTS).fill(null);state.activeSlot=0;state.player.stats.health=0;
  progress.death={sequence:(previous?.sequence??0)+1,phase:'dead',position:{...position},occurredAt:state.elapsed,...(cause?{cause:cause.slice(0,80)}:{}),...(packId?{packId}:{})};
  return {processed:true,packId,removedPackIds,lostItemCount};
}

export function respawnPlayerState(state:GameState):boolean{
  const death=ensureProgression(state).death;if(!death||death.phase!=='dead')return false;
  state.player.stats={...SURVIVAL.STARTING_STATS};state.inventory=createStarterInventory();state.activeSlot=0;death.phase='respawned';return true;
}

/** Removes either disposable container only after the final item has left it. */
export function consumeEmptyContainer(state:GameState,id:string):Station|null{
  const progress=ensureProgression(state),index=progress.stations.findIndex(station=>station.id===id),station=progress.stations[index];
  if(!station||!isDisposableContainer(station)||station.inventory.some(Boolean))return null;
  progress.stations.splice(index,1);if(progress.death?.packId===id)delete progress.death.packId;return station;
}

export function activeLostPacks(state:GameState){return lostPacks(state).sort(ageOrder);}

/** Resolves the selected sleeping roll and clears stale references in-place. */
export function resolveRespawnBedroll(state:GameState):Station|undefined{
  const progress=ensureProgression(state),bed=progress.stations.find(station=>station.id===progress.spawnId&&station.kind==='bedroll');
  if(progress.spawnId&&!bed)delete progress.spawnId;return bed;
}
