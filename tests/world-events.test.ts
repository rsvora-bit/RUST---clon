import {describe,it,expect,vi} from 'vitest';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {ensureProgression} from '../src/survival/progression';
import {createRadioSignalEvent,isRadioSignalStationId,resolveRadioSignalEvent,resolveWashedAshoreEvent,updateWashedAshoreEvent,WASHED_ASHORE_COOLDOWN,washedAshoreStationId} from '../src/survival/events';
import {createStation} from '../src/survival/stations';
import {validateGameState} from '../src/save/storage';

const spawn={x:0,y:5,z:0},coast={x:300,y:1.5,z:-450};
function stormState(seed=93){const game=new GameSimulation(seed,spawn);game.state.worldGeneration=5;return game.state;}

describe('Generation 5 washed-ashore salvage event',()=>{
  it('keeps the initial zero-sequence event state save-valid before the first storm',()=>{
    const state=stormState(),progress=ensureProgression(state);
    expect(updateWashedAshoreEvent(state,5,()=>coast)).toBe(false);
    expect(progress.washedAshore).toMatchObject({stormSeen:false,resolved:false,sequence:0});
    expect(validateGameState(structuredClone(state))).toBe(true);
  });

  it('waits for a storm to pass and creates one deterministic saved cache',()=>{
    const state=stormState(),findCoast=vi.fn(()=>coast),progress=ensureProgression(state);
    expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(findCoast).not.toHaveBeenCalled();
    progress.weather.kind='storm';expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.washedAshore?.stormSeen).toBe(true);
    progress.weather.kind='clear';state.elapsed=420;expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(true);
    expect(progress.washedAshore).toMatchObject({stormSeen:true,resolved:false,position:coast,appearedAt:420});
    expect(progress.washedAshore?.sequence).toBe(1);expect(progress.stations.filter(s=>s.id===washedAshoreStationId(1))).toHaveLength(1);
    expect(validateGameState(structuredClone(state))).toBe(true);
    expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.stations.filter(s=>s.id===washedAshoreStationId(1))).toHaveLength(1);
    const second=stormState();ensureProgression(second).weather.kind='storm';updateWashedAshoreEvent(second,5,()=>coast);ensureProgression(second).weather.kind='clear';updateWashedAshoreEvent(second,5,()=>coast);
    expect(ensureProgression(second).stations.find(s=>s.id===washedAshoreStationId(1))?.inventory).toEqual(progress.stations.find(s=>s.id===washedAshoreStationId(1))?.inventory);
  });

  it('resolves only after the event cache is collected, preserving a valid save',()=>{
    const state=stormState(),progress=ensureProgression(state);progress.weather.kind='storm';updateWashedAshoreEvent(state,5,()=>coast);progress.weather.kind='clear';updateWashedAshoreEvent(state,5,()=>coast);
    expect(resolveWashedAshoreEvent(state,'unrelated-cache')).toBe(false);
    progress.stations=progress.stations.filter(s=>s.id!==washedAshoreStationId(1));expect(resolveWashedAshoreEvent(state,washedAshoreStationId(1))).toBe(true);
    expect(progress.washedAshore).toMatchObject({resolved:true,stormSeen:false,sequence:1,nextSpawnAt:WASHED_ASHORE_COOLDOWN});expect(validateGameState(structuredClone(state))).toBe(true);
    const findCoast=vi.fn((sequence:number)=>({x:300+sequence*10,y:1.5,z:-450-sequence*10}));state.elapsed=WASHED_ASHORE_COOLDOWN-1;progress.weather.kind='storm';expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.washedAshore?.stormSeen).toBe(false);expect(findCoast).not.toHaveBeenCalled();
    state.elapsed=WASHED_ASHORE_COOLDOWN+1;expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(false);expect(progress.washedAshore?.stormSeen).toBe(true);progress.weather.kind='clear';expect(updateWashedAshoreEvent(state,5,findCoast)).toBe(true);
    expect(progress.washedAshore).toMatchObject({resolved:false,sequence:2,position:{x:320,z:-470}});expect(progress.stations.some(s=>s.id===washedAshoreStationId(2))).toBe(true);expect(validateGameState(structuredClone(state))).toBe(true);
  });

  it('leaves legacy generations and old Gen5 saves without the optional field unchanged',()=>{
    const legacy=stormState();legacy.worldGeneration=4;const legacyProgress=ensureProgression(legacy);legacyProgress.weather.kind='storm';
    expect(updateWashedAshoreEvent(legacy,4,()=>coast)).toBe(false);expect(legacyProgress.washedAshore).toBeUndefined();
    const old=stormState();expect(validateGameState(structuredClone(old))).toBe(true);expect(ensureProgression(old).washedAshore).toBeUndefined();
  });

  it('continues an older active event save with its original cache id',()=>{
    const state=stormState(),progress=ensureProgression(state);progress.washedAshore={stormSeen:true,resolved:false,position:coast,appearedAt:0};progress.stations.push(createStation('event-washed-ashore','loot',coast));
    expect(validateGameState(structuredClone(state))).toBe(true);expect(updateWashedAshoreEvent(state,5,vi.fn())).toBe(false);
    progress.stations=[];expect(resolveWashedAshoreEvent(state,'event-washed-ashore')).toBe(true);expect(progress.washedAshore).toMatchObject({resolved:true,nextSpawnAt:WASHED_ASHORE_COOLDOWN});expect(validateGameState(structuredClone(state))).toBe(true);
  });

  it('rejects an active event whose saved cache is missing',()=>{
    const state=stormState(),progress=ensureProgression(state);progress.weather.kind='storm';updateWashedAshoreEvent(state,5,()=>coast);progress.weather.kind='clear';updateWashedAshoreEvent(state,5,()=>coast);progress.stations=[];
    expect(validateGameState(structuredClone(state))).toBe(false);
  });

  it('unlocks one deterministic late-tier relay cache for Gen5 and preserves it through save/reload',()=>{
    const first=stormState(812),second=stormState(812),site={x:212,y:18,z:-176};
    expect(createRadioSignalEvent(first,site)).toBe(true);expect(createRadioSignalEvent(first,site)).toBe(false);
    expect(createRadioSignalEvent(second,site)).toBe(true);
    const progress=ensureProgression(first),cache=progress.stations.find(s=>isRadioSignalStationId(s.id))!;
    expect(cache.position).toEqual(site);expect(cache.inventory.some(item=>item?.itemId==='techParts'&&item.count>=1)).toBe(true);
    expect(cache.inventory).toEqual(ensureProgression(second).stations.find(s=>isRadioSignalStationId(s.id))?.inventory);
    expect(validateGameState(structuredClone(first))).toBe(true);
    progress.stations=progress.stations.filter(s=>!isRadioSignalStationId(s.id));
    expect(resolveRadioSignalEvent(first,'unrelated-cache')).toBe(false);expect(resolveRadioSignalEvent(first,'event-radio-signal')).toBe(true);
    expect(validateGameState(structuredClone(first))).toBe(true);
    const invalid=structuredClone(first);invalid.progression!.radioSignal!.resolved=false;
    expect(validateGameState(invalid)).toBe(false);
  });

  it('does not create radio signal progression in legacy generations or old saves',()=>{
    const legacy=stormState();legacy.worldGeneration=4;
    expect(createRadioSignalEvent(legacy,coast)).toBe(false);expect(legacy.progression?.radioSignal).toBeUndefined();
    const old=stormState();expect(validateGameState(structuredClone(old))).toBe(true);expect(old.progression?.radioSignal).toBeUndefined();
  });
});
