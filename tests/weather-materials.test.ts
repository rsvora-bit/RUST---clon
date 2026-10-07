import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {addWeatherSurfaceResponse} from '../src/rendering/materials';
import {stoneMaterial} from '../src/world/materials';

describe('weather surface response',()=>{
  it('chains existing material hooks and applies live wetness to diffuse and roughness',()=>{
    const material=new THREE.MeshStandardMaterial();
    const priorCompile=vi.fn();
    material.onBeforeCompile=priorCompile;
    material.customProgramCacheKey=()=> 'existing-material-key';
    const wetness={value:0};
    addWeatherSurfaceResponse(material,wetness,.68,.46);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>'};

    material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);

    expect(priorCompile).toHaveBeenCalledOnce();
    expect(shader.uniforms.tidelandWeatherWetness?.value).toBe(0);
    expect(shader.fragmentShader).toContain('uniform float tidelandWeatherWetness;');
    expect(shader.fragmentShader).toContain('tidelandWeatherWetness*0.680');
    expect(shader.fragmentShader).toContain('roughnessFactor=mix(roughnessFactor,max(0.460,roughnessFactor*.76)');
    expect(material.customProgramCacheKey()).toContain('existing-material-key|tideland-weather-response-v1-0.680-0.460');
    expect(material.userData.tidelandWeatherWetness).toBe(wetness);
    wetness.value=.8;
    expect(shader.uniforms.tidelandWeatherWetness?.value).toBe(.8);
  });

  it('does not install the shader hook twice',()=>{
    const material=new THREE.MeshStandardMaterial(),wetness={value:.5};
    addWeatherSurfaceResponse(material,wetness);
    const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
    addWeatherSurfaceResponse(material,{value:1},.2,.9);
    expect(material.onBeforeCompile).toBe(compile);
    expect(material.customProgramCacheKey()).toBe(cacheKey);
  });

  it('uses world-space triplanar stone detail for Revision 6 instances while keeping legacy projection unchanged',()=>{
    vi.stubGlobal('document',{createElement:()=>{
      const canvas={width:0,height:0},context={
        createImageData:(width:number,height:number)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>{},
        beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},quadraticCurveTo:()=>{},ellipse:()=>{},fill:()=>{},stroke:()=>{},fillRect:()=>{},
        fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',
      };
      return Object.assign(canvas,{getContext:()=>context});
    }});
    const compile=(material:THREE.MeshStandardMaterial)=>{
      const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <defaultnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>'};
      material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);return shader;
    };
    const legacy=stoneMaterial(),wetness={value:.35},revision6=stoneMaterial(0xb0ada0,true,wetness);
    try{
      const oldShader=compile(legacy),newShader=compile(revision6);
      expect(oldShader.vertexShader).toContain('vStonePos=position;vStoneNormal=normal;');
      expect(oldShader.vertexShader).not.toContain('stoneWorldPosition');
      expect(newShader.vertexShader).toContain('mat3 stoneViewRotation=mat3(viewMatrix)');
      expect(newShader.vertexShader).toContain('dot(stoneViewRotation[2],transformedNormal)');
      expect(newShader.vertexShader).toContain('stoneWorldPosition=instanceMatrix*stoneWorldPosition');
      expect(newShader.vertexShader).toContain('vStonePos=(modelMatrix*stoneWorldPosition).xyz');
      expect(newShader.uniforms.surfaceWetness?.value).toBe(.35);
      expect(newShader.fragmentShader).toContain('texture2D(map,vStonePos.yz*.7)');
    }finally{
      for(const material of [legacy,revision6])for(const texture of material.userData.textures as THREE.Texture[])texture.dispose();
      vi.unstubAllGlobals();
    }
  });
});
