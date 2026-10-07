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
  it('gives the twin barrels a merged raised rib and a readable break-action latch',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('fieldShotgun');held.update(.2,0);const barrels=['Shotgun twin barrel 1','Shotgun twin barrel 2'].map(name=>held.scene.getObjectByName(name)),stock=held.scene.getObjectByName('Shotgun weathered field stock') as THREE.Mesh,detail=held.scene.getObjectByName('Shotgun barrel rib and retaining bands') as THREE.Mesh,action=held.scene.getObjectByName('Shotgun action hinge and latch') as THREE.Mesh;
    expect(barrels.every(barrel=>barrel instanceof THREE.Mesh)).toBe(true);expect(stock).toBeInstanceOf(THREE.Mesh);expect(stock.scale.x).toBeCloseTo(.86);expect(detail).toBeInstanceOf(THREE.Mesh);expect(detail.geometry.getAttribute('position').count).toBeGreaterThan(300);expect(detail.material).toBe((barrels[0] as THREE.Mesh).material);expect(action).toBeInstanceOf(THREE.Mesh);expect(action.geometry.getAttribute('position').count).toBeGreaterThan(80);expect(action.material).not.toBe(detail.material);
  });
  it('faces a single merged six-port dark chamber plate outward on the revolver',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('salvageRevolver');held.update(.2,0);const cylinder=held.scene.getObjectByName('Revolver cylinder'),face=held.scene.getObjectByName('Revolver six chamber face');
    expect(cylinder).toBeTruthy();expect(face).toBeTruthy();expect((cylinder as THREE.Mesh).rotation.x).toBeCloseTo(Math.PI/2);expect((cylinder as THREE.Mesh).position.z).toBeCloseTo(-.55);expect((face as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(48);(face as THREE.Mesh).geometry.computeBoundingBox();expect((face as THREE.Mesh).geometry.boundingBox?.max.z).toBeCloseTo(.071);expect((face as THREE.Mesh).material).toBeInstanceOf(THREE.MeshStandardMaterial);const steel=(cylinder as THREE.Mesh).material as THREE.MeshStandardMaterial,steelObjects:THREE.Object3D[]=[];held.scene.traverse(object=>{if(object instanceof THREE.Mesh&&object.material===steel)steelObjects.push(object);});expect(steel.map).toBeInstanceOf(THREE.DataTexture);expect(steelObjects.length).toBe(4);
  });
  it('uses authored PBR surface detail on close-range steel, rust and brass parts',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('fieldShotgun');held.update(.2,0);const names=['Shotgun twin barrel 1','Shotgun action hinge and latch','Shotgun shell brass bases'],materials=names.map(name=>(held.scene.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial);
    expect(materials.every(material=>material.map instanceof THREE.DataTexture&&material.normalMap instanceof THREE.DataTexture&&material.roughnessMap instanceof THREE.DataTexture)).toBe(true);
    expect(materials[0]!.metalness).toBeGreaterThan(.4);expect(materials[1]!.roughness).toBeGreaterThan(.7);expect(materials[2]!.metalness).toBeGreaterThan(.5);
    for(const material of materials){expect(material.normalMap!.colorSpace).toBe(THREE.NoColorSpace);expect(material.roughnessMap!.colorSpace).toBe(THREE.NoColorSpace);}
  });
  it('batches Dockside cleaver corrosion and rivets into one readable surface-detail mesh',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('docksideCleaver');held.update(.2,0);const wear=held.scene.getObjectByName('Dockside cleaver corrosion and rivets'),blade=held.scene.getObjectByName('Dockside cleaver forged blade') as THREE.Mesh;expect(wear).toBeInstanceOf(THREE.Mesh);expect((wear as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(100);expect(blade.material).toBeInstanceOf(THREE.MeshStandardMaterial);expect((blade.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture);expect((blade.material as THREE.MeshStandardMaterial).normalMap).toBeInstanceOf(THREE.DataTexture);expect((blade.material as THREE.MeshStandardMaterial).roughnessMap).toBeInstanceOf(THREE.DataTexture);
  });
  it('uses one shared forged texture for the Quarry Maul head and struck face',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('quarryMaul');held.update(.2,0);const head=held.scene.getObjectByName('Quarry Maul forged head') as THREE.Mesh,face=held.scene.getObjectByName('Quarry Maul struck face') as THREE.Mesh;
    expect(head).toBeTruthy();expect(face).toBeTruthy();expect(head.material).toBe(face.material);expect((head.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture);expect((head.material as THREE.MeshStandardMaterial).normalMap).toBeInstanceOf(THREE.DataTexture);expect((head.material as THREE.MeshStandardMaterial).roughnessMap).toBeInstanceOf(THREE.DataTexture);
  });
  it('uses a textured chipped stone head and one merged set of haft bindings on the pickaxe',()=>{
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})});
    const held=new HeldItem();held.set('pickaxe');held.update(.2,0);const head=held.scene.getObjectByName('Stone pickaxe chipped head') as THREE.Mesh,binding=held.scene.getObjectByName('Stone pickaxe haft binding') as THREE.Mesh;
    expect(head).toBeTruthy();expect(head.material).toBeInstanceOf(THREE.MeshStandardMaterial);expect((head.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.CanvasTexture);expect((head.material as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);expect((head.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0);expect(binding).toBeTruthy();expect(binding.material).toBeInstanceOf(THREE.MeshStandardMaterial);expect(binding.geometry.getAttribute('position').count).toBeGreaterThan(200);
  });
});
