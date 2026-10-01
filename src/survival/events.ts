import type {GameState,Vec3} from '../core/types';
import {createStation} from './stations';
import {fillSalvageLoot} from './economy';
import {randomSource} from '../world/noise';
import {ensureProgression} from './progression';

export const WASHED_ASHORE_ID='event-washed-ashore';

/** A single deterministic Gen5 event. It is gated by a storm ending and persisted with its cache. */
export function updateWashedAshoreEvent(state:GameState,generation:number,findCoast:()=>Vec3|null):boolean{
  if(generation!==5)return false;
  const progress=ensureProgression(state),event=progress.washedAshore??={stormSeen:false,resolved:false};
  if(event.resolved||event.position)return false;
  if(progress.weather.kind==='storm'){event.stormSeen=true;return false;}
  if(!event.stormSeen)return false;
  const position=findCoast();if(!position)return false;
  event.position={...position};event.appearedAt=state.elapsed;
  const station=createStation(WASHED_ASHORE_ID,'loot',position,randomSource(state.seed+0x5a17)()*Math.PI*2);
  fillSalvageLoot(station,'lucky',randomSource(state.seed+0x5a18));progress.stations.push(station);
  return true;
}

export function resolveWashedAshoreEvent(state:GameState,stationId:string):boolean{
  if(stationId!==WASHED_ASHORE_ID)return false;
  const event=state.progression?.washedAshore;
  if(!event?.position||event.resolved)return false;
  event.resolved=true;return true;
}
