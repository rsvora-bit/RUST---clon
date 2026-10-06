import {beforeEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {DEFAULT_SETTINGS} from '../src/config/balance';
import type {GameState} from '../src/core/types';
import {loadSettings,saveSettings} from '../src/save/storage';
import {Atmosphere} from '../src/world/atmosphere';
import {Weather} from '../src/survival/Weather';

class MemoryStorage {
  private readonly data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,String(value));}
  removeItem(key:string){this.data.delete(key);}
  clear(){this.data.clear();}
}

describe('independent water and weather effect quality settings',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',new MemoryStorage()));

  it('migrates older settings and persists independent effect choices',()=>{
    localStorage.setItem('tideland:settings:v1',JSON.stringify({quality:'high'}));
    expect(loadSettings()).toMatchObject({waterQuality:'high',weatherEffectsQuality:'high'});
    localStorage.setItem('tideland:settings:v1',JSON.stringify({quality:'low'}));
    expect(loadSettings()).toMatchObject({quality:'low',waterQuality:'low',weatherEffectsQuality:'low'});
    localStorage.setItem('tideland:settings:v1',JSON.stringify({quality:'medium'}));
    expect(loadSettings()).toMatchObject({quality:'medium',waterQuality:'medium',weatherEffectsQuality:'medium'});
    saveSettings({...DEFAULT_SETTINGS,waterQuality:'low',weatherEffectsQuality:'medium',keybinds:{...DEFAULT_SETTINGS.keybinds}});
    expect(loadSettings()).toMatchObject({waterQuality:'low',weatherEffectsQuality:'medium'});
    localStorage.setItem('tideland:settings:v1',JSON.stringify({waterQuality:'ultra',weatherEffectsQuality:'invalid'}));
    expect(loadSettings()).toMatchObject({waterQuality:'high',weatherEffectsQuality:'high'});
  });

  it('selects distinct shader detail levels without changing legacy quality tiers',()=>{
    const pixels=new Uint8Array(64),height=new THREE.DataTexture(pixels,4,4,THREE.RGBAFormat),atmosphere=new Atmosphere(new THREE.Scene(),height,1280,731942,6);
    try{
      const detail=atmosphere.ocean.material.uniforms.waterDetail;
      atmosphere.setWaterQuality('low');expect(detail.value).toBe(.35);
      atmosphere.setWaterQuality('medium');expect(detail.value).toBe(.68);
      atmosphere.setWaterQuality('high');expect(detail.value).toBe(1);
      expect(atmosphere.ocean.material.fragmentShader).toContain('if(waterDetail>.4)choppy');
      expect(atmosphere.ocean.material.fragmentShader).toContain('if(revision6>.5&&waterDetail>.4)');
    }finally{atmosphere.dispose();height.dispose();}
  });

  it('scales rain streak work independently from the overall graphics preset',()=>{
    const state={seed:42,elapsed:12,progression:{version:1,stations:[],weather:{kind:'rain',blend:1,rain:1,storm:0,mist:0,remaining:30},lootGenerated:true}} as unknown as GameState;
    const pixels=new Uint8Array(64),height=new THREE.DataTexture(pixels,4,4,THREE.RGBAFormat),scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height),weather=new Weather(scene);
    const submitted=()=>((weather as unknown as {geometry:THREE.BufferGeometry}).geometry.drawRange.count);
    try{
      weather.update(0,state,atmosphere,new THREE.Vector3(),'high',undefined,undefined,'low');const low=submitted();
      weather.update(0,state,atmosphere,new THREE.Vector3(),'high',undefined,undefined,'medium');const medium=submitted();
      weather.update(0,state,atmosphere,new THREE.Vector3(),'high',undefined,undefined,'high');const high=submitted();
      expect([low,medium,high]).toEqual([700,1800,3600]);
    }finally{weather.dispose();atmosphere.dispose();height.dispose();}
  });
});
