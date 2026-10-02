import {describe,expect,it,vi} from 'vitest';
import {createWildlifePopulation,guardHitChance,lookoutHitChance,scavengerRaidDamage,tickWildlife,wildlifeSpeciesForBiome} from '../src/combat/wildlife';
import * as THREE from 'three';
import {WildlifeSystem} from '../src/combat/wildlife';
import {hasLineOfSight} from '../src/combat/visibility';

const context={seed:731942,generation:5 as const,spawn:{x:0,y:3,z:0},halfSize:640,heightAt:()=>3,biomeAt:()=>'TEMPERATE FOREST'};

describe('seeded island wildlife',()=>{
  it('makes upgraded structure grades progressively harder for scavenger raids',()=>{
    expect(scavengerRaidDamage('wood')).toBe(14);expect(scavengerRaidDamage('stone')).toBe(8);expect(scavengerRaidDamage('metal')).toBe(4);
  });
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
  it('places persistent hostile scavengers deterministically beside industrial sites',()=>{
    const sites=[{x:180,y:3,z:40},{x:-220,y:3,z:60}],first=createWildlifePopulation({...context,scavengerSites:sites}),again=createWildlifePopulation({...context,scavengerSites:sites}),scavengers=first.filter(a=>a.species==='islandScavenger');
    expect(scavengers).toHaveLength(3);expect(scavengers.map(a=>[a.id,a.position])).toEqual(again.filter(a=>a.species==='islandScavenger').map(a=>[a.id,a.position]));
    expect(scavengers.map(a=>a.archetype)).toEqual(['scavenger','lookout','guard']);expect(scavengers.map(a=>a.archetype)).toEqual(again.filter(a=>a.species==='islandScavenger').map(a=>a.archetype));
    const saved={ [scavengers[0]!.id]:46,[scavengers[1]!.id]:0,[scavengers[2]!.id]:0 },reloaded=createWildlifePopulation({...context,scavengerSites:sites,nodeChanges:saved});
    expect(reloaded.find(a=>a.id===scavengers[0]!.id)?.health).toBe(46);expect(reloaded.some(a=>a.id===scavengers[1]!.id||a.id===scavengers[2]!.id)).toBe(false);
  });
  it('lets armored guards absorb projectile damage while remaining vulnerable to melee',()=>{
    const sites=[{x:180,y:3,z:40},{x:-220,y:3,z:60}],actors=createWildlifePopulation({...context,scavengerSites:sites}),guard=actors.find(a=>a.archetype==='guard')!,scavenger=actors.find(a=>a.archetype==='scavenger')!;
    const bullet=guard.takeDamage({amount:50,type:'projectile',sourceId:'player-test'});expect(bullet.requested).toBe(50);expect(bullet.applied).toBe(40);expect(bullet.absorbed).toBeCloseTo(10);expect(bullet.healthAfter).toBe(106);
    const strike=guard.takeDamage({amount:20,type:'melee',sourceId:'player-test'});expect(strike).toMatchObject({requested:20,applied:20,absorbed:0,healthAfter:86});
    expect(scavenger.takeDamage({amount:50,type:'projectile'}).applied).toBe(50);
    const reloaded=createWildlifePopulation({...context,scavengerSites:sites,nodeChanges:{[guard.id]:guard.health}});expect(reloaded.find(a=>a.id===guard.id)?.health).toBe(86);
  });
  it('keeps legacy generation wildlife layouts free of scavengers',()=>{
    const legacy=createWildlifePopulation({...context,generation:4,scavengerSites:[{x:180,y:3,z:40}]});expect(legacy.every(actor=>actor.species!=='islandScavenger')).toBe(true);
  });
  it('lets a scavenger attack nearby and keeps one shared humanoid model per species',()=>{
    const sites=[{x:180,y:3,z:40}],scene=new THREE.Scene(),system=new WildlifeSystem(scene,{...context,scavengerSites:sites}),actor=system.actors.find(a=>a.species==='islandScavenger')!;
    const attacks=vi.fn();actor.alerted=true;actor.attackCooldown=0;tickWildlife(actor,1/60,{x:actor.position.x,y:actor.position.y,z:actor.position.z+1},()=>3,attacks);
    expect(attacks).toHaveBeenCalledOnce();expect(attacks).toHaveBeenCalledWith(12,actor.id);
    const sameSpecies=system.actors.filter(a=>a.species==='islandScavenger');expect(sameSpecies).toHaveLength(1);expect(system.object(actor.id)).toBeInstanceOf(THREE.Mesh);
    system.dispose();
  });
  it('requires clear line of sight for an alerted scavenger to pursue and attack',()=>{
    const actor=createWildlifePopulation({...context,scavengerSites:[{x:180,y:3,z:40}]}).find(a=>a.species==='islandScavenger')!;
    actor.angered=true;actor.attackCooldown=0;const player={x:actor.position.x,y:actor.position.y,z:actor.position.z+1},attacks=vi.fn();
    tickWildlife(actor,1/60,player,()=>3,attacks,false);expect(actor.state).toBe('wander');expect(attacks).not.toHaveBeenCalled();
    tickWildlife(actor,1/60,player,()=>3,attacks,true);expect(actor.state).toBe('attack');expect(attacks).toHaveBeenCalledOnce();
  });
  it('lets a hostile scavenger breach a claimed locked door without attacking through it',()=>{
    const actor=createWildlifePopulation({...context,scavengerSites:[{x:180,y:3,z:40}]}).find(a=>a.species==='islandScavenger')!;
    actor.position={x:0,y:3,z:3};actor.alerted=true;actor.angered=true;actor.attackCooldown=0;actor.blockedRaidDoor={id:'claimed-door',position:{x:0,y:3,z:0}};
    const player={x:0,y:3,z:-4},playerAttacks=vi.fn(),doorAttacks=vi.fn();
    for(let i=0;i<24;i++)tickWildlife(actor,.1,player,()=>3,playerAttacks,false,(id,damage)=>doorAttacks(id,damage));
    expect(actor.state).toBe('raid');expect(actor.position.z).toBeGreaterThanOrEqual(1.24);expect(doorAttacks).toHaveBeenCalledWith('claimed-door',14);expect(playerAttacks).not.toHaveBeenCalled();
  });
  it('gives deterministic lookouts a shared bow model and imperfect ranged attacks with spacing',()=>{
    const sites=[{x:180,y:3,z:40},{x:-220,y:3,z:60}],scene=new THREE.Scene(),system=new WildlifeSystem(scene,{...context,scavengerSites:sites}),lookout=system.actors.find(a=>a.archetype==='lookout')!,guard=system.actors.find(a=>a.archetype==='scavenger')!;
    expect(lookout).toBeTruthy();expect(system.object(lookout.id)!.geometry).not.toBe(system.object(guard.id)!.geometry);expect(system.object(lookout.id)!.rotation.y).toBeCloseTo(lookout.yaw+Math.PI);
    lookout.alerted=true;lookout.awareness=1;lookout.attackCooldown=0;expect(lookoutHitChance(lookout,20)).toBeLessThan(lookoutHitChance(lookout,10));const player={x:lookout.position.x,y:lookout.position.y,z:lookout.position.z+15},attacks=vi.fn();
    for(let i=0;i<600;i++)tickWildlife(lookout,.1,player,()=>3,attacks,true);
    expect(lookout.state).toBe('attack');expect(attacks).toHaveBeenCalled();expect(attacks.mock.calls.length).toBeLessThan(lookout.shotSequence??0);expect(attacks.mock.calls.every(call=>call[2]==='projectile'&&call[0]===9)).toBe(true);
    const close={x:lookout.position.x,y:lookout.position.y,z:lookout.position.z+3},before=lookout.position.z;tickWildlife(lookout,.1,close,()=>3,attacks,true);
    expect(lookout.state).toBe('reposition');expect(lookout.position.z).toBeLessThan(before);
    const overlap={...lookout.position};tickWildlife(lookout,.1,overlap,()=>3,attacks,true);expect(Object.values(lookout.position).every(Number.isFinite)).toBe(true);
    const calls=attacks.mock.calls.length;lookout.memorySeconds=1;tickWildlife(lookout,.1,player,()=>3,attacks,false);expect(attacks).toHaveBeenCalledTimes(calls);
    const gunner=system.actors.find(a=>a.archetype==='guard')!;expect(gunner.maxHealth).toBeGreaterThan(lookout.maxHealth);expect(system.object(gunner.id)!.geometry).not.toBe(system.object(lookout.id)!.geometry);gunner.alerted=true;gunner.awareness=1;gunner.attackCooldown=0;const target={x:gunner.position.x,y:gunner.position.y,z:gunner.position.z+18},gunfire=vi.fn();expect(guardHitChance(gunner,20)).toBeLessThan(guardHitChance(gunner,10));for(let i=0;i<600;i++)tickWildlife(gunner,.1,target,()=>3,gunfire,true);expect(gunner.state).toBe('attack');expect(gunfire).toHaveBeenCalled();expect(gunfire.mock.calls.length).toBeLessThan(gunner.shotSequence??0);expect(gunfire.mock.calls.every(call=>call[2]==='projectile'&&call[0]===14)).toBe(true);const guardClose={x:gunner.position.x,y:gunner.position.y,z:gunner.position.z+5},guardZ=gunner.position.z;tickWildlife(gunner,.1,guardClose,()=>3,gunfire,true);expect(gunner.state).toBe('reposition');expect(gunner.position.z).toBeLessThan(guardZ);
    system.dispose();
  });
  it('uses restrained deterministic lateral movement while ranged scavengers hold their firing distance',()=>{
    const sites=[{x:180,y:3,z:40},{x:-220,y:3,z:60}],first=createWildlifePopulation({...context,scavengerSites:sites}),second=createWildlifePopulation({...context,scavengerSites:sites});
    for(const archetype of ['lookout','guard'] as const){
      const actor=first.find(entry=>entry.archetype===archetype)!,replay=second.find(entry=>entry.id===actor.id)!;actor.alerted=true;actor.awareness=1;actor.attackCooldown=100;replay.alerted=true;replay.awareness=1;replay.attackCooldown=100;
      const player={x:actor.position.x,y:actor.position.y,z:actor.position.z+16},start={...actor.position},attacks=vi.fn();
      for(let i=0;i<45;i++){tickWildlife(actor,.1,player,()=>3,attacks,true);tickWildlife(replay,.1,player,()=>3,vi.fn(),true);}
      expect(actor.state).toBe('attack');expect(Math.hypot(actor.position.x-start.x,actor.position.z-start.z)).toBeGreaterThan(.35);
      expect(Math.hypot(actor.position.x-player.x,actor.position.z-player.z)).toBeGreaterThan(14);
      expect(Math.hypot(actor.position.x-replay.position.x,actor.position.z-replay.position.z)).toBeLessThan(1e-8);
      expect(attacks).not.toHaveBeenCalled();expect(actor.position.y).toBeCloseTo(3.05);
    }
  });
  it('throttles scavenger perception instead of ray testing every frame',()=>{
    const scene=new THREE.Scene(),site={x:5,y:3,z:5},system=new WildlifeSystem(scene,{...context,scavengerSites:[site]}),actor=system.actors.find(a=>a.species==='islandScavenger')!,canSee=vi.fn(()=>true),player={x:site.x,y:3,z:site.z};
    actor.yaw=Math.atan2(player.x-actor.position.x,player.z-actor.position.z);actor.perceptionCooldown=0;system.update(.05,player,()=>3,()=>{},canSee);system.update(.05,player,()=>3,()=>{},canSee);
    expect(canSee).toHaveBeenCalledOnce();expect(actor.canSeePlayer).toBe(true);system.dispose();
  });
  it('shares a confirmed POI sighting with a nearby ally without granting wall-penetrating attacks',()=>{
    const sites=[{x:180,y:3,z:40},{x:-220,y:3,z:60}],scene=new THREE.Scene(),system=new WildlifeSystem(scene,{...context,scavengerSites:sites}),guard=system.actors.find(a=>a.archetype==='guard')!,lookout=system.actors.find(a=>a.archetype==='lookout')!,player={x:guard.position.x+14,y:3,z:guard.position.z};
    guard.yaw=Math.atan2(player.x-guard.position.x,player.z-guard.position.z);guard.awareness=.99;guard.perceptionCooldown=0;lookout.perceptionCooldown=10;lookout.canSeePlayer=false;
    const attacks=vi.fn();system.update(.1,player,()=>3,attacks,actor=>actor.id===guard.id);system.update(.1,player,()=>3,attacks,actor=>actor.id===guard.id);
    expect(guard.alerted).toBe(true);expect(lookout.alerted).toBe(true);expect(lookout.awareness).toBeGreaterThan(0);expect(lookout.memorySeconds).toBeGreaterThan(2);expect(lookout.lastKnownPlayer).toEqual(player);expect(lookout.canSeePlayer).toBe(false);expect(lookout.state).toBe('investigate');expect(attacks.mock.calls.every(call=>call[1]===guard.id)).toBe(true);system.dispose();
  });
  it('shares a secured-door raid alarm so a nearby scavenger joins the same breach',()=>{
    const scene=new THREE.Scene(),system=new WildlifeSystem(scene,{...context,scavengerSites:[{x:180,y:3,z:40},{x:195,y:3,z:40}]}),source=system.actors.find(actor=>actor.archetype==='scavenger')!,ally=system.actors.find(actor=>actor.archetype==='lookout')!,door={id:'homestead-door',position:{x:0,y:3,z:0}},player={x:0,y:3,z:-4},doorHits=vi.fn();
    source.position={x:0,y:3,z:3};source.yaw=Math.PI;source.alerted=true;source.angered=true;source.attackCooldown=0;source.perceptionCooldown=0;
    ally.position={x:2,y:3,z:3};ally.yaw=Math.PI;ally.alerted=false;ally.angered=false;ally.attackCooldown=0;ally.perceptionCooldown=0;
    for(let i=0;i<32;i++)system.update(.1,player,()=>3,()=>{},()=>false,actor=>actor===source||actor===ally?door:null,(id,damage,actor)=>doorHits(id,damage,actor.id));
    expect(source.state).toBe('raid');expect(ally.alerted).toBe(true);expect(ally.lastKnownPlayer).toEqual(player);expect(ally.state).toBe('raid');
    expect(doorHits.mock.calls.some(call=>call[0]===door.id&&call[2]===source.id)).toBe(true);expect(doorHits.mock.calls.some(call=>call[0]===door.id&&call[2]===ally.id)).toBe(true);system.dispose();
  });
  it('requires time in the scavenger view cone before raising an alarm',()=>{
    const site={x:10,y:3,z:10},scene=new THREE.Scene(),system=new WildlifeSystem(scene,{...context,scavengerSites:[site]}),actor=system.actors.find(a=>a.species==='islandScavenger')!,player={x:actor.position.x+2,y:3,z:actor.position.z};
    actor.perceptionCooldown=0;actor.yaw=Math.atan2(actor.position.x-player.x,actor.position.z-player.z);system.update(.1,player,()=>3,()=>{});
    expect(actor.canSeePlayer).toBe(false);expect(actor.awareness).toBe(0);expect(actor.alerted).toBe(false);
    actor.yaw=Math.atan2(player.x-actor.position.x,player.z-actor.position.z);actor.perceptionCooldown=0;
    for(let i=0;i<16;i++)system.update(.1,player,()=>3,()=>{});
    expect(actor.awareness).toBe(1);expect(actor.alerted).toBe(true);system.dispose();
  });
  it('investigates the last seen position after losing sight without attacking blindly',()=>{
    const actor=createWildlifePopulation({...context,scavengerSites:[{x:180,y:3,z:40}]}).find(a=>a.species==='islandScavenger')!;
    actor.alerted=true;actor.memorySeconds=2;actor.lastKnownPlayer={x:actor.position.x+6,y:3,z:actor.position.z};const start=actor.position.x,attacks=vi.fn();
    tickWildlife(actor,.1,{x:actor.position.x+10,y:3,z:actor.position.z},()=>3,attacks,false);
    expect(actor.state).toBe('investigate');expect(actor.position.x).toBeGreaterThan(start);expect(attacks).not.toHaveBeenCalled();
  });
  it('returns a non-angered alerted scavenger home after its last-known search expires',()=>{
    const actor=createWildlifePopulation({...context,scavengerSites:[{x:180,y:3,z:40}]}).find(a=>a.archetype==='scavenger')!,home={...actor.home};actor.alerted=true;actor.awareness=1;actor.memorySeconds=0;actor.position.x+=6;const farPlayer={x:home.x+60,y:3,z:home.z+60};
    tickWildlife(actor,.1,farPlayer,()=>3,vi.fn(),false);expect(actor.state).toBe('return');expect(actor.position.x).toBeLessThan(home.x+6);
    for(let i=0;i<80&&actor.state==='return';i++)tickWildlife(actor,.1,farPlayer,()=>3,vi.fn(),false);
    expect(actor.state).toBe('wander');expect(Math.hypot(actor.position.x-home.x,actor.position.z-home.z)).toBeLessThan(1.3);expect(actor.alerted).toBe(false);expect(actor.awareness).toBe(0);
  });
  it('blocks scavenger perception behind solid geometry',()=>{
    const ray=new THREE.Raycaster(),origin=new THREE.Vector3(0,1.5,0),target=new THREE.Vector3(0,1.5,-5),scratch=new THREE.Vector3(),wall=new THREE.Mesh(new THREE.BoxGeometry(3,3,.3),new THREE.MeshBasicMaterial());wall.position.set(0,1.5,-2);wall.updateMatrixWorld(true);
    expect(hasLineOfSight(ray,origin,target,[wall],scratch)).toBe(false);expect(hasLineOfSight(ray,origin,target,[],scratch)).toBe(true);wall.geometry.dispose();(wall.material as THREE.Material).dispose();
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
  it('raises a brief runtime hit reaction without persisting animation state',()=>{
    const scene=new THREE.Scene(),system=new WildlifeSystem(scene,context),actor=system.actors[0]!,object=system.object(actor.id)!;
    expect(actor.hitReaction).toBe(0);actor.takeDamage({amount:8,type:'melee'});expect(actor.hitReaction).toBe(1);
    const before=object.position.y;system.update(.1,actor.position,()=>3,()=>{});expect(actor.hitReaction).toBeCloseTo(.58);expect(object.position.y).toBeGreaterThan(before);
    system.dispose();
  });
  it('shares one low-poly model geometry per species and disposes its scene objects',()=>{
    const scene=new THREE.Scene(),system=new WildlifeSystem(scene,context),wolves=system.actors.filter(actor=>actor.species==='islandWolf'),models=wolves.map(actor=>system.object(actor.id));
    expect(models.length).toBeGreaterThan(1);expect(models.every(model=>model instanceof THREE.Mesh)).toBe(true);expect(new Set(models.map(model=>model!.geometry)).size).toBe(1);
    expect(scene.children).toHaveLength(system.actors.length);const actor=system.actors[0]!,object=system.object(actor.id)!;system.update(1/60,{x:1000,y:0,z:1000},()=>3,()=>{});expect(object.visible).toBe(false);system.update(1/60,actor.position,()=>3,()=>{});expect(object.visible).toBe(true);system.dispose();expect(scene.children).toHaveLength(0);
  });
});
