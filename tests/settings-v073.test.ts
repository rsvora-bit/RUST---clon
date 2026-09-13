import {beforeEach,describe,expect,it,vi} from 'vitest';
import {DEFAULT_SETTINGS} from '../src/config/balance';
import {loadSettings,saveSettings} from '../src/save/storage';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.3 small polish',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists V-Sync and defaults older settings to synchronized rendering',()=>{
    expect(DEFAULT_SETTINGS.vsync).toBe(true);
    saveSettings({...DEFAULT_SETTINGS,vsync:false,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    expect(loadSettings().vsync).toBe(false);
    localStorage.setItem('tideland:settings:v1',JSON.stringify({language:'en'}));
    expect(loadSettings().vsync).toBe(true);
  });
});
