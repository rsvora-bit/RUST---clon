import {describe,expect,it} from 'vitest';
import {DAMAGE_TYPES,damageTypeForCause,resolveDamage} from '../src/combat/damage';
import {GameSimulation} from '../src/simulation/GameSimulation';

const spawn={x:4,y:2,z:-3};

describe('combat damage foundation',()=>{
  it('defines useful damage categories without coupling them to UI text',()=>{
    expect(DAMAGE_TYPES).toEqual(['melee','projectile','environmental','cold','toxic']);
    expect(damageTypeForCause('bite from wolf')).toBe('melee');
    expect(damageTypeForCause('arrow projectile')).toBe('projectile');
    expect(damageTypeForCause('cold exposure')).toBe('cold');
    expect(damageTypeForCause('industrial contamination')).toBe('toxic');
    expect(damageTypeForCause('fall')).toBe('environmental');
  });

  it('applies bounded percentage mitigation and reports the resolved hit',()=>{
    expect(resolveDamage(100,100,{amount:40,type:'projectile',sourceId:'scavenger-2'},.25)).toEqual({
      ok:true,type:'projectile',requested:40,applied:30,absorbed:10,
      healthBefore:100,healthAfter:70,killed:false,sourceId:'scavenger-2',
    });
    expect(resolveDamage(100,100,{amount:40,type:'melee'},1).applied).toBeCloseTo(6);
    expect(resolveDamage(100,100,{amount:40,type:'melee'},Number.NaN).applied).toBe(40);
  });

  it('rejects invalid or empty damage and clamps fatal hits at zero',()=>{
    expect(resolveDamage(70,100,{amount:0,type:'melee'})).toMatchObject({ok:false,healthAfter:70,killed:false});
    expect(resolveDamage(70,100,{amount:Number.NaN,type:'toxic'})).toMatchObject({ok:false,healthAfter:70,killed:false});
    expect(resolveDamage(12,100,{amount:200,type:'environmental'})).toMatchObject({ok:true,applied:12,absorbed:0,healthAfter:0,killed:true});
  });

  it('lets the existing simulation act as a reusable damageable player',()=>{
    const simulation=new GameSimulation(77,spawn);
    expect(simulation.takeDamage({amount:18,type:'cold',sourceId:'alpine-exposure'})).toMatchObject({ok:true,type:'cold',applied:18,healthAfter:82,killed:false});
    expect(simulation.state.player.stats.health).toBe(82);
    expect(simulation.takeDamage({amount:100,type:'melee',sourceId:'boar'})).toMatchObject({ok:true,type:'melee',healthAfter:0,killed:true,sourceId:'boar'});
    expect(simulation.state.player.stats.health).toBe(0);
  });

  it('keeps the established damagePlayer signature and cause values compatible',()=>{
    const simulation=new GameSimulation(77,spawn);
    expect(simulation.damagePlayer(12,'fall')).toEqual({ok:true,health:88,killed:false,cause:'fall'});
    expect(simulation.damagePlayer(-1,'legacy-qa')).toEqual({ok:false,health:88,killed:false,cause:'legacy-qa'});
    expect(simulation.damagePlayer(100,'legacy-qa')).toEqual({ok:true,health:0,killed:true,cause:'legacy-qa'});
  });
});
