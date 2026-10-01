import {afterEach,describe,expect,it,vi} from 'vitest';
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
});
