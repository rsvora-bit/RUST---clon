import {describe,expect,it} from 'vitest';
import {createWildlifePopulation} from '../src/combat/wildlife';
import {alertScavengersToNoise} from '../src/combat/noise';

const context={seed:731942,generation:5 as const,spawn:{x:0,y:3,z:0},halfSize:640,heightAt:()=>3,biomeAt:()=>'TEMPERATE FOREST',scavengerSites:[{x:180,y:3,z:40},{x:-220,y:3,z:60}]};

describe('combat noise perception',()=>{
  it('alerts only living scavengers within the audible radius and records the noise origin',()=>{
    const actors=createWildlifePopulation(context),guards=actors.filter(actor=>actor.species==='islandScavenger');
    guards[0]!.position={x:8,y:4,z:0};guards[1]!.position={x:30,y:3,z:0};const wolf=actors.find(actor=>actor.species==='islandWolf')!;wolf.position={x:2,y:3,z:0};
    expect(alertScavengersToNoise(actors,{x:0,y:3,z:0},12,5)).toBe(1);
    expect(guards[0]).toMatchObject({alerted:true,awareness:1,canSeePlayer:false,memorySeconds:5,lastKnownPlayer:{x:0,y:3,z:0}});
    expect(guards[1]).toMatchObject({alerted:false,awareness:0});expect(wolf.alerted).toBe(false);
  });

  it('extends existing investigation memory without angering or reviving an actor',()=>{
    const actors=createWildlifePopulation(context),guards=actors.filter(actor=>actor.species==='islandScavenger'),guard=guards[0]!;
    guard.position={x:3,y:3,z:0};guard.memorySeconds=8;guard.alerted=true;guard.angered=false;
    expect(alertScavengersToNoise([guard],{x:0,y:3,z:0},10,4)).toBe(1);
    expect(guard.memorySeconds).toBe(8);expect(guard.angered).toBe(false);
    guard.state='dead';expect(alertScavengersToNoise([guard],{x:0,y:3,z:0},10,10)).toBe(0);expect(guard.memorySeconds).toBe(8);
  });
});
