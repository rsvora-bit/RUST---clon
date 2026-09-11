import type {GameState,Structure} from '../core/types';import {deductCosts} from '../inventory/inventory';
export function ensureProgression(state:GameState){return state.progression??=( {version:1,stations:[],weather:{kind:'clear',blend:0,remaining:240},lootGenerated:false});}
export const GRADES={wood:{health:250,cost:{wood:20}},stone:{health:600,cost:{stone:120}},metal:{health:1000,cost:{metal:100}}};
export function upgrade(state:GameState,s:Structure){const next=s.grade==='metal'?null:s.grade==='stone'?'metal':'stone';if(!next||!deductCosts(state.inventory,GRADES[next].cost))return false;s.grade=next;s.maxHealth=GRADES[next].health;s.health=s.maxHealth;return true;}
export function repair(state:GameState,s:Structure){const grade=GRADES[s.grade??'wood'],max=s.maxHealth??grade.health;if(s.health>=max)return false;const costs=Object.fromEntries(Object.entries(grade.cost).map(([k,n])=>[k,Math.max(1,Math.ceil(n*(max-s.health)/max*.4))]));if(!deductCosts(state.inventory,costs))return false;s.health=max;return true;}
/** Refuse demolition of supports with descendants; no invisible floating child colliders. */
export function demolish(state:GameState,id:string){if(state.structures.some(s=>s.parentId===id))return false;const index=state.structures.findIndex(s=>s.id===id);if(index<0)return false;state.structures.splice(index,1);return true;}
