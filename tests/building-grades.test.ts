import {beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {damageStructure,demolishStructure,migrateStructure,repairStructure,rotateStructure,structureCurrentHealth,upgradeStructure} from '../src/building/grades';
import {getSockets} from '../src/building/rules';
import {loadGame,resetSave,saveGame} from '../src/save/storage';
import {initPhysics,PhysicsWorld} from '../src/physics/PhysicsWorld';
import type {Structure} from '../src/core/types';

class MemoryStorage {private data=new Map<string,string>();getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){this.data.set(key,String(value));}removeItem(key:string){this.data.delete(key);}clear(){this.data.clear();}}
const position={x:0,y:0,z:0};
const structure=(pieceType:Structure['pieceType']='foundation'):Structure=>({id:'structure-1',pieceType,position:{...position},rotation:0,health:250,currentHealth:250,maxHealth:250,grade:'wood',createdAt:0});
const game=()=>{const simulation=new GameSimulation(77,{x:8,y:2,z:8});simulation.state.structures=[structure()];simulation.state.nextId=2;return simulation;};

describe('v0.7.7 building grades and durability',()=>{
  beforeEach(()=>{vi.stubGlobal('localStorage',new MemoryStorage());resetSave();});
  beforeAll(async()=>{await initPhysics();});

  it('migrates a v0.7.6 structure to full-health wood when loading',()=>{
    const simulation=game(),legacy=structuredClone(simulation.state),old=legacy.structures[0]!;delete old.grade;delete old.maxHealth;delete old.currentHealth;delete (old as Partial<Structure>).health;
    localStorage.setItem('tideland:save:v1:slot:1',JSON.stringify({savedAt:1,state:legacy}));
    const loaded=loadGame(1)!;expect(loaded.structures[0]).toMatchObject({grade:'wood',currentHealth:250,maxHealth:250,health:250});
  });

  it('upgrades wood to stone at the piece-specific cost',()=>{const simulation=game();simulation.addItem('stone',160);expect(upgradeStructure(simulation.state,simulation.state.structures[0]!).ok).toBe(true);expect(simulation.state.structures[0]).toMatchObject({grade:'stone',currentHealth:600,maxHealth:600});expect(simulation.count('stone')).toBe(0);});
  it('upgrades stone to metal',()=>{const simulation=game(),target=simulation.state.structures[0]!;target.grade='stone';target.health=target.currentHealth=target.maxHealth=600;simulation.addItem('metal',140);expect(upgradeStructure(simulation.state,target).ok).toBe(true);expect(target).toMatchObject({grade:'metal',currentHealth:1000,maxHealth:1000});});
  it('does not upgrade metal further',()=>{const simulation=game(),target=simulation.state.structures[0]!;target.grade='metal';target.health=target.currentHealth=target.maxHealth=1000;simulation.addItem('metal',500);expect(upgradeStructure(simulation.state,target)).toMatchObject({ok:false,reason:'max-grade'});expect(simulation.count('metal')).toBe(500);});
  it('leaves inventory and structure untouched when upgrade resources are missing',()=>{const simulation=game(),before=structuredClone(simulation.state);expect(upgradeStructure(simulation.state,simulation.state.structures[0]!)).toMatchObject({ok:false,reason:'missing-resources'});expect(simulation.state).toEqual(before);});
  it('consumes upgrade resources exactly once',()=>{const simulation=game(),target=simulation.state.structures[0]!;simulation.addItem('stone',320);expect(upgradeStructure(simulation.state,target).ok).toBe(true);expect(simulation.count('stone')).toBe(160);expect(upgradeStructure(simulation.state,target).reason).toBe('missing-resources');expect(simulation.count('stone')).toBe(160);});

  it('repairs one durability step and charges the current grade resource',()=>{const simulation=game(),target=simulation.state.structures[0]!;target.health=target.currentHealth=100;simulation.addItem('wood',100);expect(repairStructure(simulation.state,target).ok).toBe(true);expect(structureCurrentHealth(target)).toBe(163);expect(simulation.count('wood')).toBeLessThan(100);});
  it('never repairs beyond maximum health',()=>{const simulation=game(),target=simulation.state.structures[0]!;target.health=target.currentHealth=245;simulation.addItem('wood',100);expect(repairStructure(simulation.state,target).ok).toBe(true);expect(structureCurrentHealth(target)).toBe(250);expect(repairStructure(simulation.state,target).reason).toBe('full-health');});
  it('demolishes a leaf piece from persistent state',()=>{const simulation=game();expect(demolishStructure(simulation.state,'structure-1').ok).toBe(true);expect(simulation.state.structures).toEqual([]);});
  it('removes a structure collider from Rapier',()=>{const terrain=new THREE.PlaneGeometry(20,20,1,1);terrain.rotateX(-Math.PI/2);const physics=new PhysicsWorld(terrain,[],{x:0,y:2,z:0});physics.setStructure('structure-1',[{position:{x:0,y:.25,z:0},halfExtents:{x:1.5,y:.25,z:1.5}}]);expect(physics.hasStructure('structure-1')).toBe(true);physics.removeStructure('structure-1');expect(physics.hasStructure('structure-1')).toBe(false);physics.dispose();terrain.dispose();});
  it('decreases health through the future damage API',()=>{const simulation=game();expect(damageStructure(simulation.state,'structure-1',70).ok).toBe(true);expect(structureCurrentHealth(simulation.state.structures[0]!)).toBe(180);});
  it('destroys a piece and dependent descendants at zero health',()=>{const simulation=game(),parent=simulation.state.structures[0]!;simulation.state.structures.push({...structure('wall'),id:'structure-2',parentId:parent.id,socketId:getSockets(parent)[0]!.id,position:{...getSockets(parent)[0]!.position}});expect(damageStructure(simulation.state,parent.id,250).removedIds).toEqual(expect.arrayContaining(['structure-1','structure-2']));expect(simulation.state.structures).toEqual([]);});
  it('preserves grade and current health across save/reload',()=>{const simulation=game(),target=simulation.state.structures[0]!;target.grade='stone';target.maxHealth=600;target.health=target.currentHealth=438;expect(saveGame(simulation.state,1)).toBe(true);expect(loadGame(1)?.structures[0]).toMatchObject({grade:'stone',currentHealth:438,maxHealth:600});});
  it('keeps doorway and door persistence functional, including hinge rotation',()=>{const simulation=game(),foundation=simulation.state.structures[0]!,edge=getSockets(foundation)[0]!,doorway:Structure={...structure('doorway'),id:'structure-2',position:{...edge.position},rotation:edge.rotation,parentId:foundation.id,socketId:edge.id},doorSocket=getSockets(doorway).find(socket=>socket.accepts.includes('door'))!,door:Structure={...structure('door'),id:'structure-3',position:{...doorSocket.position},rotation:doorSocket.rotation,parentId:doorway.id,socketId:doorSocket.id,open:true};simulation.state.structures.push(doorway,door);simulation.state.nextId=4;expect(rotateStructure(door).ok).toBe(true);expect(saveGame(simulation.state,2)).toBe(true);expect(loadGame(2)?.structures[2]).toMatchObject({pieceType:'door',open:true,flipped:true,grade:'wood',currentHealth:250});});
  it('keeps migration idempotent',()=>{const target=structure();target.currentHealth=91;target.health=91;expect(migrateStructure(migrateStructure(target))).toMatchObject({grade:'wood',currentHealth:91,maxHealth:250,health:91});});
});
