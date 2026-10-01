import {describe,expect,it} from 'vitest';
import {advanceArrow,arrowLaunchVelocity,bowStrength,segmentSphereHit,segmentWildlifeHit} from '../src/combat/projectile';

describe('bow projectile rules',()=>{
  it('clamps draw strength and normalizes strength-scaled launch speed',()=>{
    expect(bowStrength(-1)).toBe(0);expect(bowStrength(.575)).toBeCloseTo(.5);expect(bowStrength(2)).toBe(1);
    expect(arrowLaunchVelocity({x:0,y:0,z:-2},.5)).toEqual({x:0,y:0,z:-25});
    expect(arrowLaunchVelocity({x:0,y:0,z:0},1)).toEqual({x:0,y:0,z:0});
  });
  it('advances deterministically under gravity and sweeps fast movement against a target sphere',()=>{
    const flight={position:{x:0,y:2,z:0},velocity:{x:0,y:0,z:-20},age:0};
    const segment=advanceArrow(flight,.1);expect(segment.from).toEqual({x:0,y:2,z:0});expect(segment.to.z).toBe(-2);expect(segment.to.y).toBeCloseTo(1.9019);expect(flight.age).toBe(.1);
    expect(segmentSphereHit({x:0,y:2,z:0},{x:0,y:2,z:-4},{x:0,y:2,z:-2},.3)).toMatchObject({hit:true,fraction:.5});
    expect(segmentSphereHit({x:0,y:2,z:0},{x:0,y:2,z:-1},{x:2,y:2,z:0},.3).hit).toBe(false);
  });
  it('rewards a precise humanoid head hit while keeping torso and animal hit values unchanged',()=>{
    const from={x:0,y:1.56,z:2},to={x:0,y:1.56,z:-2},base={x:0,y:0,z:0};
    expect(segmentWildlifeHit(from,to,base,.95,.62,true)).toMatchObject({hit:true,zone:'head',damageMultiplier:1.5});
    expect(segmentWildlifeHit({x:0,y:1.03,z:2},{x:0,y:1.03,z:-2},base,.95,.62,true)).toMatchObject({hit:true,zone:'body',damageMultiplier:1});
    expect(segmentWildlifeHit(from,to,base,.68,.55,false)).toMatchObject({hit:false,zone:'body',damageMultiplier:1});
  });
});
