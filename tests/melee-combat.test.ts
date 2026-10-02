import {describe,expect,it} from 'vitest';
import {MELEE_WEAPONS,MeleeSwing,resolveMeleeHit} from '../src/combat/melee';
import {PLAYER} from '../src/config/balance';

const origin={x:0,y:1.5,z:0},forward={x:0,y:0,z:-1};
const target=(id:string,x=0,y=1,z=-1.2,radius=.25)=>({id,position:{x,y,z},radius});

describe('melee reach and swing rules',()=>{
  it('keeps the existing improvised tools inside a grounded damage/range progression',()=>{
    expect(MELEE_WEAPONS.rock.damage).toBeLessThan(MELEE_WEAPONS.hatchet.damage);
    expect(MELEE_WEAPONS.rock.range).toBeLessThan(MELEE_WEAPONS.pickaxe.range);
    expect(MELEE_WEAPONS.hatchet.staminaCost).toBeGreaterThan(0);
  });
  it('gives the research-gated field spear longer reach, higher damage and a narrower thrust arc',()=>{
    expect(MELEE_WEAPONS.spear.damage).toBeGreaterThan(MELEE_WEAPONS.hatchet.damage);
    expect(MELEE_WEAPONS.spear.range).toBeGreaterThan(MELEE_WEAPONS.pickaxe.range);
    expect(MELEE_WEAPONS.spear.arcCosine).toBeGreaterThan(MELEE_WEAPONS.hatchet.arcCosine);
    expect(resolveMeleeHit(MELEE_WEAPONS.spear,origin,forward,target('boar',0,1,-2.4,.25)).hit).toBe(true);
  });
  it('adds a durable salvage blade with heavier damage and a broader but shorter arc than the spear',()=>{
    expect(MELEE_WEAPONS.docksideCleaver.damage).toBeGreaterThan(MELEE_WEAPONS.spear.damage);
    expect(MELEE_WEAPONS.docksideCleaver.range).toBeLessThan(MELEE_WEAPONS.spear.range);
    expect(MELEE_WEAPONS.docksideCleaver.arcCosine).toBeLessThan(MELEE_WEAPONS.spear.arcCosine);
    expect(MELEE_WEAPONS.docksideCleaver.staminaCost).toBeGreaterThan(MELEE_WEAPONS.hatchet.staminaCost);
    expect(resolveMeleeHit(MELEE_WEAPONS.docksideCleaver,origin,forward,target('boar',.7,1,-1.7,.25)).hit).toBe(true);
  });
  it('adds a slow, wide quarry maul with endgame damage and stamina cost',()=>{
    expect(MELEE_WEAPONS.quarryMaul.damage).toBeGreaterThan(MELEE_WEAPONS.docksideCleaver.damage);
    expect(MELEE_WEAPONS.quarryMaul.range).toBeLessThan(MELEE_WEAPONS.docksideCleaver.range);
    expect(MELEE_WEAPONS.quarryMaul.cooldown).toBeGreaterThan(MELEE_WEAPONS.docksideCleaver.cooldown);
    expect(MELEE_WEAPONS.quarryMaul.staminaCost).toBeGreaterThan(MELEE_WEAPONS.docksideCleaver.staminaCost);
    expect(MELEE_WEAPONS.quarryMaul.durabilityCost).toBeGreaterThan(MELEE_WEAPONS.docksideCleaver.durabilityCost);
    expect(resolveMeleeHit(MELEE_WEAPONS.quarryMaul,origin,forward,target('boar',.8,1,-1.45,.25)).hit).toBe(true);
  });
  it('makes advanced melee cadence draw stamina instead of being self-sustaining at rest',()=>{
    const sustainedRate=(weapon:typeof MELEE_WEAPONS[keyof typeof MELEE_WEAPONS])=>weapon.staminaCost/weapon.cooldown;
    expect(sustainedRate(MELEE_WEAPONS.spear)).toBeLessThan(PLAYER.STAMINA_REGEN);
    expect(sustainedRate(MELEE_WEAPONS.docksideCleaver)).toBeGreaterThan(PLAYER.STAMINA_REGEN);
    expect(sustainedRate(MELEE_WEAPONS.quarryMaul)).toBeGreaterThan(sustainedRate(MELEE_WEAPONS.docksideCleaver));
  });
  it('hits a target in front inside reach',()=>{
    expect(resolveMeleeHit(MELEE_WEAPONS.rock,origin,forward,target('wolf'))).toMatchObject({hit:true,reason:'hit',targetId:'wolf'});
  });
  it('rejects targets outside reach or the forward arc',()=>{
    expect(resolveMeleeHit(MELEE_WEAPONS.rock,origin,forward,target('far',0,1,-5)).reason).toBe('out-of-range');
    expect(resolveMeleeHit(MELEE_WEAPONS.rock,origin,forward,target('side',1,1,-.5)).reason).toBe('outside-arc');
  });
  it('does not permit a melee hit through a nearer obstruction',()=>{
    expect(resolveMeleeHit(MELEE_WEAPONS.hatchet,origin,forward,target('wolf',0,1,-1.2),.45)).toMatchObject({hit:false,reason:'occluded'});
    expect(resolveMeleeHit(MELEE_WEAPONS.hatchet,origin,forward,target('wolf',0,1,-1.2),1.1).hit).toBe(true);
  });
  it('allows one hit per target per swing while allowing a later swing',()=>{
    const swing=new MeleeSwing(1,'hatchet');expect(swing.claimHit('wolf')).toBe(true);expect(swing.claimHit('wolf')).toBe(false);expect(swing.claimHit('boar')).toBe(true);
    const next=new MeleeSwing(2,'hatchet');expect(next.claimHit('wolf')).toBe(true);
  });
});
