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
  it('derives water shading normals from the same animated wave field as the vertex displacement',()=>{
    const heightMap=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat),atmosphere=new Atmosphere(new THREE.Scene(),heightMap,720,731942,6);
    try{
      const vertex=atmosphere.ocean.material.vertexShader,fragment=atmosphere.ocean.material.fragmentShader;
      for(const wave of ['p.x*.095+p.z*.043+clock*.55','p.z*.077-p.x*.023+clock*.38','p.x*.037-p.z*.12-clock*.46','weather*sin(p.x*.06+p.z*.04+clock)','storm*sin(p.x*.014-p.z*.021+clock*.28)','sin(p.x*.024+p.z*.017+clock*.21)','sin(p.z*.018-p.x*.009-clock*.17)','sin(p.x*.032+p.z*.009+clock*.18)','sin(p.z*.019-p.x*.014-clock*.13)'])expect(vertex).toContain(wave);
      for(const wave of ['p.x*.095+p.y*.043+clock*.55','p.y*.077-p.x*.023+clock*.38','p.x*.037-p.y*.12-clock*.46','weather*sin(p.x*.06+p.y*.04+clock)','storm*sin(p.x*.014-p.y*.021+clock*.28)','sin(p.x*.024+p.y*.017+clock*.21)','sin(p.y*.018-p.x*.009-clock*.17)','sin(p.x*.032+p.y*.009+clock*.18)','sin(p.y*.019-p.x*.014-clock*.13)'])expect(fragment).toContain(wave);
      expect(fragment).not.toContain('swellNormal');
    }finally{atmosphere.dispose();heightMap.dispose();}
  });
});
