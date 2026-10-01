import {describe,it,expect,vi} from 'vitest';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {ensureProgression} from '../src/survival/progression';
import {resolveWashedAshoreEvent,updateWashedAshoreEvent} from '../src/survival/events';
import {validateGameState} from '../src/save/storage';

const spawn={x:0,y:5,z:0},coast={x:300,y:1.5,z:-450};
function stormState(seed=93){const game=new GameSimulation(seed,spawn);game.state.worldGeneration=5;return game.state;}

describe('Generation 5 washed-ashore salvage event',()=>{
  it('waits for a storm to pass and creates one deterministic saved cache',()=>{
    const state=stormState(),findCoast=vi.fn(()=>coast),progress=ensureProgression(state);
    expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(findCoast).not.toHaveBeenCalled();
    progress.weather.kind='storm';expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.washedAshore?.stormSeen).toBe(true);
    progress.weather.kind='clear';state.elapsed=420;expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(true);
    expect(progress.washedAshore).toMatchObject({stormSeen:true,resolved:false,position:coast,appearedAt:420});
    expect(progress.stations.filter(s=>s.id==='event-washed-ashore')).toHaveLength(1);
    expect(validateGameState(structuredClone(state))).toBe(true);
    expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.stations.filter(s=>s.id==='event-washed-ashore')).toHaveLength(1);
    const second=stormState();ensureProgression(second).weather.kind='storm';updateWashedAshoreEvent(second,5,()=>coast);ensureProgression(second).weather.kind='clear';updateWashedAshoreEvent(second,5,()=>coast);
    expect(ensureProgression(second).stations.find(s=>s.id==='event-washed-ashore')?.inventory).toEqual(progress.stations.find(s=>s.id==='event-washed-ashore')?.inventory);
  });

  it('resolves only after the event cache is collected, preserving a valid save',()=>{
    const state=stormState(),progress=ensureProgression(state);progress.weather.kind='storm';updateWashedAshoreEvent(state,5,()=>coast);progress.weather.kind='clear';updateWashedAshoreEvent(state,5,()=>coast);
    expect(resolveWashedAshoreEvent(state,'unrelated-cache')).toBe(false);
    progress.stations=progress.stations.filter(s=>s.id!=='event-washed-ashore');expect(resolveWashedAshoreEvent(state,'event-washed-ashore')).toBe(true);
    expect(progress.washedAshore?.resolved).toBe(true);expect(validateGameState(structuredClone(state))).toBe(true);
  });

  it('leaves legacy generations and old Gen5 saves without the optional field unchanged',()=>{
    const legacy=stormState();legacy.worldGeneration=4;const legacyProgress=ensureProgression(legacy);legacyProgress.weather.kind='storm';
    expect(updateWashedAshoreEvent(legacy,4,()=>coast)).toBe(false);expect(legacyProgress.washedAshore).toBeUndefined();
    const old=stormState();expect(validateGameState(structuredClone(old))).toBe(true);expect(ensureProgression(old).washedAshore).toBeUndefined();
  });

  it('rejects an active event whose saved cache is missing',()=>{
    const state=stormState(),progress=ensureProgression(state);progress.weather.kind='storm';updateWashedAshoreEvent(state,5,()=>coast);progress.weather.kind='clear';updateWashedAshoreEvent(state,5,()=>coast);progress.stations=[];
    expect(validateGameState(structuredClone(state))).toBe(false);
  });
});
