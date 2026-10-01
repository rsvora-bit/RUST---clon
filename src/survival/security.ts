import type {WildlifeActor} from '../combat/wildlife';
import {HOMESTEAD_RADIUS,type Station} from './stations';

export interface HomesteadIntrusion {coreId:string;actorId:string}

/** Returns alerted living scavengers that have crossed into a powered claim. */
export function homesteadIntrusions(cores:readonly Station[],actors:readonly WildlifeActor[]):HomesteadIntrusion[]{
  const intrusions:HomesteadIntrusion[]=[];
  const poweredCores=cores.filter(station=>station.kind==='homesteadCore');
  for(const actor of actors){
    if(actor.species!=='islandScavenger'||actor.state==='dead'||(!actor.alerted&&!actor.angered))continue;
    for(const core of poweredCores){
      if(Math.hypot(actor.position.x-core.position.x,actor.position.z-core.position.z)<=HOMESTEAD_RADIUS)intrusions.push({coreId:core.id,actorId:actor.id});
    }
  }
  return intrusions;
}
