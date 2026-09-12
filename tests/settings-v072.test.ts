import {beforeEach,describe,expect,it,vi} from 'vitest';
import {loadSettings,saveSettings} from '../src/save/storage';
import {DEFAULT_SETTINGS} from '../src/config/balance';

class MemoryStorage {private data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,String(v));}removeItem(k:string){this.data.delete(k);}clear(){this.data.clear();}}

describe('v0.7.2 telemetry settings',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));
  it('persists telemetry layout and falls back safely for older settings',()=>{
    saveSettings({...DEFAULT_SETTINGS,telemetryScale:1.25,telemetryOpacity:.73,telemetryPerformance:false,telemetryPlayer:true,telemetryCamera:true,telemetryWorld:false,keybinds:{...DEFAULT_SETTINGS.keybinds}});
    expect(loadSettings()).toMatchObject({telemetryScale:1.25,telemetryOpacity:.73,telemetryPerformance:false,telemetryPlayer:true,telemetryCamera:true,telemetryWorld:false});
    localStorage.setItem('tideland:settings:v1',JSON.stringify({language:'en'}));
    expect(loadSettings()).toMatchObject({telemetryScale:DEFAULT_SETTINGS.telemetryScale,telemetryOpacity:DEFAULT_SETTINGS.telemetryOpacity,telemetryPerformance:true,telemetryWorld:true});
  });
});
