import {describe,expect,it,vi} from 'vitest';
import {createWildlifePopulation,tickWildlife,wildlifeSpeciesForBiome} from '../src/combat/wildlife';
import * as THREE from 'three';
import {WildlifeSystem} from '../src/combat/wildlife';

const context={seed:731942,generation:5 as const,spawn:{x:0,y:3,z:0},halfSize:640,heightAt:()=>3,biomeAt:()=>'TEMPERATE FOREST'};

describe('seeded island wildlife',()=>{
  it('uses climate and biome to avoid inappropriate fauna',()=>{
    expect(wildlifeSpeciesForBiome('TEMPERATE FOREST',.55)).toBe('islandWolf');
    expect(wildlifeSpeciesForBiome('SNOW / ALPINE',.18)).toBe('islandWolf');
    expect(wildlifeSpeciesForBiome('SNOW / ALPINE',.7)).toBeNull();
    expect(wildlifeSpeciesForBiome('COAST',.62)).toBe('coastalBoar');
    expect(wildlifeSpeciesForBiome('COAST',.1)).toBeNull();
    expect(wildlifeSpeciesForBiome('ARID INTERIOR',.7)).toBeNull();
  });
  it('places wildlife deterministically and keeps defeated ids out after reload',()=>{
    const first=createWildlifePopulation(context),again=createWildlifePopulation(context);
    expect(first.length).toBe(10);
    expect(first.map(a=>[a.id,a.species,a.position])).toEqual(again.map(a=>[a.id,a.species,a.position]));
    const nodeChanges={[first[0]!.id]:0,[first[1]!.id]:37},reloaded=createWildlifePopulation({...context,nodeChanges});
    expect(reloaded).toHaveLength(9);expect(reloaded.map(a=>a.id)).not.toContain(first[0]!.id);
    expect(reloaded.map(a=>a.id)).toContain(first[1]!.id);expect(reloaded.find(a=>a.id===first[1]!.id)?.health).toBe(37);
  });
  it('keeps boars calm until hit, then lets nearby wolves and boars attack on a cooldown',()=>{
    const boar=createWildlifePopulation({...context,biomeAt:()=>'GRASSLAND'})[0]!,wolf=createWildlifePopulation(context)[0]!;
    expect(boar.species).toBe('coastalBoar');expect(wolf.species).toBe('islandWolf');
    const player={x:boar.position.x,y:boar.position.y,z:boar.position.z+1};const attacks=vi.fn();boar.attackCooldown=0;wolf.attackCooldown=0;
    tickWildlife(boar,1/60,player,()=>3,attacks);expect(attacks).not.toHaveBeenCalled();
    boar.takeDamage({amount:1,type:'melee'});tickWildlife(boar,1/60,player,()=>3,attacks);expect(attacks).toHaveBeenCalledTimes(1);
    tickWildlife(boar,1/60,player,()=>3,attacks);expect(attacks).toHaveBeenCalledTimes(1);
    const close={x:wolf.position.x,y:wolf.position.y,z:wolf.position.z+1};tickWildlife(wolf,1/60,close,()=>3,attacks);expect(attacks).toHaveBeenCalledTimes(2);
  });
  it('removes health exactly once and has a terminal dead state',()=>{
    const actor=createWildlifePopulation(context)[0]!;
    const result=actor.takeDamage({amount:actor.maxHealth,type:'projectile',sourceId:'qa-arrow'});
    expect(result).toMatchObject({ok:true,killed:true,healthAfter:0,sourceId:'qa-arrow'});
    expect(actor.state).toBe('dead');
    expect(actor.takeDamage({amount:10,type:'melee'}).applied).toBe(0);
  });
  it('shares one low-poly model geometry per species and disposes its scene objects',()=>{
    const scene=new THREE.Scene(),system=new WildlifeSystem(scene,context),wolves=system.actors.filter(actor=>actor.species==='islandWolf'),models=wolves.map(actor=>system.object(actor.id));
    expect(models.length).toBeGreaterThan(1);expect(models.every(model=>model instanceof THREE.Mesh)).toBe(true);expect(new Set(models.map(model=>model!.geometry)).size).toBe(1);
    expect(scene.children).toHaveLength(system.actors.length);const actor=system.actors[0]!,object=system.object(actor.id)!;system.update(1/60,{x:1000,y:0,z:1000},()=>3,()=>{});expect(object.visible).toBe(false);system.update(1/60,actor.position,()=>3,()=>{});expect(object.visible).toBe(true);system.dispose();expect(scene.children).toHaveLength(0);
  });
});
