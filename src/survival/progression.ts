import type {GameState,Structure} from '../core/types';
import {BUILDING_GRADES,demolishStructure,repairStructure,upgradeStructure} from '../building/grades';
export function ensureProgression(state:GameState){return state.progression??=( {version:1,stations:[],weather:{kind:'clear',blend:0,remaining:240},lootGenerated:false});}
export const GRADES=BUILDING_GRADES;
export function upgrade(state:GameState,s:Structure){return upgradeStructure(state,s).ok;}
/** Legacy maintenance command keeps its v0.7.6 full-repair behavior; the hammer uses bounded repairStructure steps. */
export function repair(state:GameState,s:Structure){let repaired=false;while(s.health<(s.maxHealth??BUILDING_GRADES[s.grade??'wood'].health)){if(!repairStructure(state,s).ok)break;repaired=true;}return repaired;}
/** Refuse demolition of supports with descendants; no invisible floating child colliders. */
export function demolish(state:GameState,id:string){return demolishStructure(state,id).ok;}
