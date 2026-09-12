import {beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_SETTINGS} from '../src/config/balance';
import {loadSettings,saveSettings} from '../src/save/storage';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.1 expanded graphics settings',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists independent graphics controls',()=>{
    saveSettings({...DEFAULT_SETTINGS,showFps:true,showTutorialHints:false,foliageDensity:.55,shadowQuality:'high',shadowDistance:95,postProcessing:true,ambientOcclusion:false,bloom:true,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    const settings=loadSettings();
    expect(settings.showFps).toBe(true);expect(settings.showTutorialHints).toBe(false);expect(settings.foliageDensity).toBe(.55);expect(settings.shadowQuality).toBe('high');expect(settings.shadowDistance).toBe(95);expect(settings.ambientOcclusion).toBe(false);expect(settings.bloom).toBe(true);
  });
});
