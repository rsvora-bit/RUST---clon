import type {Vec3} from '../core/types';
import type {WildlifeActor} from './wildlife';

/** A loud combat action gives nearby human scavengers a short-lived last-known position. */
export function alertScavengersToNoise(actors:readonly WildlifeActor[],position:Vec3,radius:number,memorySeconds=4):number{
  if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(memorySeconds)||memorySeconds<=0)return 0;
  let alerted=0;
  for(const actor of actors){
    if(actor.species!=='islandScavenger'||actor.state==='dead')continue;
    const distance=Math.hypot(actor.position.x-position.x,actor.position.z-position.z)+Math.abs(actor.position.y-position.y)*.5;
    if(distance>radius)continue;
    actor.alerted=true;actor.awareness=1;actor.canSeePlayer=false;
    actor.lastKnownPlayer.x=position.x;actor.lastKnownPlayer.y=position.y;actor.lastKnownPlayer.z=position.z;
    actor.memorySeconds=Math.max(actor.memorySeconds,memorySeconds);alerted++;
  }
  return alerted;
}
