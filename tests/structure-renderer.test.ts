import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {StructureRenderer} from '../src/building/StructureRenderer';
import {BUILD} from '../src/config/balance';
import type {BuildCandidate,Structure} from '../src/core/types';
function renderer(){
  // Geometry tests never upload textures; a minimal drawing surface is sufficient.
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
  return new StructureRenderer(new THREE.Scene());
}
afterEach(()=>vi.unstubAllGlobals());
describe('rendered structure regressions',()=>{
  it('keeps the door target continuous across plank seams and follows the open hinge',()=>{
    const r=renderer();const door:Structure={id:'door',pieceType:'door',position:{x:0,y:0,z:0},rotation:0,health:250,createdAt:0,open:false};
    r.sync([door]);const root=r.objects.get('door')!;root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(0,1.6,2),new THREE.Vector3(0,0,-1),0,3);
    expect(ray.intersectObject(root,true).length).toBeGreaterThan(0);
    door.open=true;r.sync([door]);root.updateMatrixWorld(true);
    expect(ray.intersectObject(root,true)).toHaveLength(0);r.dispose();
  });
  it('adds a visible padlock only while a door is locked and keeps old door data valid',()=>{
    const r=renderer(),door:Structure={id:'door-lock',pieceType:'door',position:{x:0,y:0,z:0},rotation:0,health:250,createdAt:0,open:false};r.sync([door]);expect(r.objects.get(door.id)?.getObjectByName('Visible door padlock')).toBeUndefined();door.locked=true;r.sync([door]);expect(r.objects.get(door.id)?.getObjectByName('Visible door padlock')).toBeTruthy();door.locked=false;r.sync([door]);expect(r.objects.get(door.id)?.getObjectByName('Visible door padlock')).toBeUndefined();r.dispose();
  });
  it('uses the socket thickness for upper-floor collision and batches repeated boards',()=>{
    const r=renderer();const floor:Structure={id:'floor',pieceType:'floor',position:{x:0,y:5,z:0},rotation:0,health:250,createdAt:0};
    const box=r.boxes(floor)[0];expect(box.halfExtents.y*2).toBe(BUILD.THICKNESS);expect(box.position.y+box.halfExtents.y).toBeCloseTo(5+BUILD.THICKNESS);
    const wall=r.make('wall');expect(wall.children.length).toBeLessThanOrEqual(3);r.dispose();
  });
  it('renders and collides with derived support posts under elevated floors only',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const scene=new THREE.Scene(),r=new StructureRenderer(scene,()=>0),raised:Structure={id:'raised',pieceType:'floor',position:{x:0,y:3,z:0},rotation:0,health:250,createdAt:0};
    r.sync([raised]);expect(r.objects.get(raised.id)?.getObjectByName('Derived foundation support posts')?.children.length).toBe(2);expect(r.boxes(raised)).toHaveLength(5);
    const low:Structure={...raised,id:'low',position:{x:8,y:.45,z:0}};expect(r.boxes(low)).toHaveLength(1);r.dispose();
  });
  it('shows derived floor supports in the same translucent valid/invalid preview state as the floor',()=>{
    const r=renderer(),candidate:BuildCandidate={pieceType:'floor',position:{x:0,y:3,z:0},rotation:0,valid:true,reason:'Snapped · ready to build',snapped:true};
    r.preview(candidate);const supports=r.ghost.getObjectByName('Derived foundation support posts')!,meshes:THREE.Mesh[]=[];supports.traverse(object=>{if(object instanceof THREE.Mesh)meshes.push(object);});
    expect(meshes.length).toBeGreaterThan(0);for(const mesh of meshes){expect((mesh.material as THREE.Material).transparent).toBe(true);expect((mesh.material as THREE.Material).opacity).toBe(.35);}
    candidate.valid=false;r.preview(candidate);for(const mesh of meshes)expect((mesh.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xda684c);r.dispose();
  });
  it('keeps grade silhouettes distinct within a small draw-call budget',()=>{
    const r=renderer(),wood=r.make('wall',false,'wood'),stone=r.make('wall',false,'stone'),metal=r.make('wall',false,'metal');
    const signature=(group:THREE.Group)=>group.children.map(child=>child instanceof THREE.Mesh?Array.from(child.geometry.getAttribute('position').array).map(value=>Number(value).toFixed(3)).join(','):'').join('|');
    expect([wood,stone,metal].every(group=>group.children.length<=3)).toBe(true);
    expect(new Set([signature(wood),signature(stone),signature(metal)]).size).toBe(3);r.dispose();
  });
});
