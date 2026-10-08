import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {Atmosphere} from '../src/world/atmosphere';

describe('world atmosphere coordinates',()=>{
  it('evaluates the water height and camera distance in world space',()=>{
    const heightMap=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat),atmosphere=new Atmosphere(new THREE.Scene(),heightMap,720,731942,6);
    try{
      expect(atmosphere.ocean.position.y).toBe(-.12);
      expect(atmosphere.ocean.material.vertexShader).toContain('vWorld=(modelMatrix*vec4(p,1.)).xyz;');
      expect(atmosphere.ocean.material.fragmentShader).toContain('float shore=abs(terrain-vWorld.y)');
      expect(atmosphere.ocean.material.fragmentShader).toContain('length(cameraPos-vWorld)');
    }finally{atmosphere.dispose();heightMap.dispose();}
  });
});
