import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {HeldItem} from '../src/rendering/HeldItem';

describe('first-person firearm presentation',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it.each(['salvageRevolver','fieldShotgun'] as const)('%s emits a short muzzle flash and automatically hides it',item=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set(item);held.update(.2,0);held.update(.2,0);
    expect(held.diagnostics().active).toBe(item);expect(held.diagnostics().muzzleFlash).toBe(false);
    held.firearmShot();expect(held.diagnostics().muzzleFlash).toBe(true);expect(held.diagnostics().muzzleFlashOpacity).toBeGreaterThan(.8);
    held.update(.1,0);expect(held.diagnostics().muzzleFlash).toBe(false);expect(held.diagnostics().muzzleFlashOpacity).toBe(0);
  });
  it('batches the shotgun stock shells into two shared-material meshes',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('fieldShotgun');held.update(.2,0);const names:string[]=[];held.scene.traverse(object=>{if(object.name.startsWith('Shotgun stock shell')||object.name.startsWith('Shotgun shell brass'))names.push(object.name);});
    expect(names).toEqual(['Shotgun stock shell bodies','Shotgun shell brass bases']);
  });
  it('faces a single merged six-port dark chamber plate outward on the revolver',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('salvageRevolver');held.update(.2,0);const cylinder=held.scene.getObjectByName('Revolver cylinder'),face=held.scene.getObjectByName('Revolver six chamber face');
    expect(cylinder).toBeTruthy();expect(face).toBeTruthy();expect((cylinder as THREE.Mesh).rotation.x).toBeCloseTo(Math.PI/2);expect((cylinder as THREE.Mesh).position.z).toBeCloseTo(-.55);expect((face as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(48);(face as THREE.Mesh).geometry.computeBoundingBox();expect((face as THREE.Mesh).geometry.boundingBox?.max.z).toBeCloseTo(.071);expect((face as THREE.Mesh).material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });
  it('batches Dockside cleaver corrosion and rivets into one readable surface-detail mesh',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('docksideCleaver');held.update(.2,0);const wear=held.scene.getObjectByName('Dockside cleaver corrosion and rivets'),blade=held.scene.getObjectByName('Dockside cleaver forged blade') as THREE.Mesh;expect(wear).toBeInstanceOf(THREE.Mesh);expect((wear as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(100);expect(blade.material).toBeInstanceOf(THREE.MeshStandardMaterial);expect((blade.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture);
  });
});
