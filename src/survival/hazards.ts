import type {Vec3,WorldGeneration} from '../core/types';

export interface HazardLandmark {id:string;kind:number;position:Vec3}
export const TOXIC_RELAY_RADIUS=19;

/** Generation 5's fixed relay POI contains leaking legacy batteries. The zone is
 * derived from the deterministic POI layout and never enters save data. */
export function toxicExposureAt(position:Vec3,pois:readonly HazardLandmark[],generation:WorldGeneration,revision:number):number{
  if(generation!==5||revision<3)return 0;
  let exposure=0;
  for(const poi of pois){if(poi.kind!==1)continue;const distance=Math.hypot(position.x-poi.position.x,position.z-poi.position.z);if(distance>=TOXIC_RELAY_RADIUS)continue;const edge=Math.max(.2,Math.min(1,(TOXIC_RELAY_RADIUS-distance)/5));exposure=Math.max(exposure,edge);}
  return exposure;
}
