import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {addWeatherSurfaceResponse} from '../src/rendering/materials';

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
});
