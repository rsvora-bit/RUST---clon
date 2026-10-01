import type {GameState,Vec3} from '../core/types';
import {createStation} from './stations';
import {fillSalvageLoot} from './economy';
import {randomSource} from '../world/noise';
import {ensureProgression} from './progression';
import {insertItem} from '../inventory/inventory';

export const WASHED_ASHORE_ID='event-washed-ashore';
export const WASHED_ASHORE_COOLDOWN=900;
export const washedAshoreStationId=(sequence:number)=>`${WASHED_ASHORE_ID}-${sequence}`;
export const RADIO_SIGNAL_ID='event-radio-signal';
export const isRadioSignalStationId=(id:string)=>id===RADIO_SIGNAL_ID;
export const isWashedAshoreStationId=(id:string)=>id===WASHED_ASHORE_ID||id.startsWith(`${WASHED_ASHORE_ID}-`);

/** Storm salvage repeats only after its cache is recovered and a quiet period has elapsed. */
export function updateWashedAshoreEvent(state:GameState,generation:number,findCoast:(sequence:number)=>Vec3|null):boolean{
  if(generation!==5)return false;
  const progress=ensureProgression(state),event=progress.washedAshore??={stormSeen:false,resolved:false,sequence:0};
  if(event.position&&!event.resolved)return false;
  if(event.resolved&&event.nextSpawnAt===undefined){event.stormSeen=false;event.nextSpawnAt=state.elapsed+WASHED_ASHORE_COOLDOWN;return false;}
  if(event.resolved&&state.elapsed<(event.nextSpawnAt??Infinity)){event.stormSeen=false;return false;}
  if(progress.weather.kind==='storm'){event.stormSeen=true;return false;}
  if(!event.stormSeen)return false;
  const sequence=(event.sequence??(event.position?1:0))+1,position=findCoast(sequence);if(!position)return false;
  event.sequence=sequence;event.position={...position};event.appearedAt=state.elapsed;event.resolved=false;delete event.nextSpawnAt;
  const eventSeed=(state.seed^Math.imul(sequence,0x45d9f3b))>>>0,station=createStation(washedAshoreStationId(sequence),'loot',position,randomSource(eventSeed^0x5a17)()*Math.PI*2);
  fillSalvageLoot(station,sequence===1?'lucky':'decent',randomSource(eventSeed^0x5a18));progress.stations.push(station);
  return true;
}

export function resolveWashedAshoreEvent(state:GameState,stationId:string):boolean{
  if(!isWashedAshoreStationId(stationId))return false;
  const event=state.progression?.washedAshore;
  if(!event?.position||event.resolved)return false;
  const expected=event.sequence?washedAshoreStationId(event.sequence):WASHED_ASHORE_ID;if(stationId!==expected)return false;
  event.resolved=true;event.stormSeen=false;event.nextSpawnAt=state.elapsed+WASHED_ASHORE_COOLDOWN;return true;
}

/** A defeated Gen5 guard exposes one deterministic, saved relay cache for late-tier salvage. */
export function createRadioSignalEvent(state:GameState,position:Vec3):boolean{
  if(state.worldGeneration!==5)return false;
  const progress=ensureProgression(state);if(progress.radioSignal)return false;
  const station=createStation(RADIO_SIGNAL_ID,'loot',position);
  fillSalvageLoot(station,'lucky',randomSource((state.seed^0x72616469)>>>0));
  insertItem(station.inventory,'techParts',1);
  progress.radioSignal={position:{...position},appearedAt:state.elapsed,resolved:false};progress.stations.push(station);return true;
}

export function resolveRadioSignalEvent(state:GameState,stationId:string):boolean{
  if(!isRadioSignalStationId(stationId))return false;
  const event=state.progression?.radioSignal;if(!event||event.resolved)return false;
  event.resolved=true;return true;
}
