import type {Vec3,WorldGeneration} from '../core/types';

export interface HazardLandmark {id:string;kind:number;position:Vec3}
export interface ColdClimate {temperature:number}
export const TOXIC_RELAY_RADIUS=19;

/** Generation 5's fixed relay POI contains leaking legacy batteries. The zone is
 * derived from the deterministic POI layout and never enters save data. */
export function toxicExposureAt(position:Vec3,pois:readonly HazardLandmark[],generation:WorldGeneration,revision:number):number{
  if(generation!==5||revision<3)return 0;
  let exposure=0;
  for(const poi of pois){if(poi.kind!==1)continue;const distance=Math.hypot(position.x-poi.position.x,position.z-poi.position.z);if(distance>=TOXIC_RELAY_RADIUS)continue;const edge=Math.max(.2,Math.min(1,(TOXIC_RELAY_RADIUS-distance)/5));exposure=Math.max(exposure,edge);}
  return exposure;
}

/** Cold exposure is derived from Gen5 climate, darkness and saved weather; it adds no world/save layout. */
export function coldExposureAt(climate:ColdClimate,hour:number,weather:'clear'|'rain'|'fog'|'storm',generation:WorldGeneration,revision:number):number{
  if(generation!==5||revision<3||!Number.isFinite(climate.temperature)||!Number.isFinite(hour))return 0;
  const time=((hour%24)+24)%24,daylight=Math.max(0,Math.min(1,(time-6)/2,(20-time)/2)),darkness=1-daylight;
  const weatherCold=weather==='storm'?.14:weather==='rain'?.06:weather==='fog'?.025:0;
  return Math.max(0,Math.min(1,(.42-climate.temperature)*2.7+darkness*.10+weatherCold));
}
