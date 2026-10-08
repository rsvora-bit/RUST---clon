import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {addWeatherSurfaceResponse,authoredSurfaceFamilyForName,materialWithSurfaceFamily} from '../src/rendering/materials';
import {stoneMaterial} from '../src/world/materials';

describe('weather surface response',()=>{
  it('classifies the authored Breakwater wood, corrosion, enamel and steel materials',()=>{
    expect(authoredSurfaceFamilyForName('Tideland salt-worn timber')).toBe('weathered-wood');
    expect(authoredSurfaceFamilyForName('Tideland soaked end grain')).toBe('weathered-wood');
    expect(authoredSurfaceFamilyForName('Tideland exposed timber')).toBe('weathered-wood');
    expect(authoredSurfaceFamilyForName('Tideland oxidized steel')).toBe('oxidized-metal');
    expect(authoredSurfaceFamilyForName('Tideland flaking drum corrosion')).toBe('oxidized-metal');
    expect(authoredSurfaceFamilyForName('Tideland faded harbor drum enamel')).toBe('painted-metal');
    expect(authoredSurfaceFamilyForName('Tideland drum bung recess')).toBeUndefined();
  });

  it('reuses shared PBR maps on authored GLB surfaces while preserving their palette and metalness',()=>{
    const map=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1),normal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1),roughness=new THREE.DataTexture(new Uint8Array([220,220,220,255]),1,1),family=new THREE.MeshStandardMaterial({map,normalMap:normal,roughnessMap:roughness,roughness:.84,metalness:.12}),source=new THREE.MeshStandardMaterial({color:0x315a78,roughness:.42,metalness:.68});family.userData.textures=[map,normal,roughness];source.name='Tideland oxidized steel';
    const result=materialWithSurfaceFamily(source,family,'oxidized-metal');
    expect(result).not.toBe(source);expect(result.map).toBe(map);expect(result.normalMap).toBe(normal);expect(result.roughnessMap).toBe(roughness);expect(result.color.equals(source.color)).toBe(true);expect(result.roughness).toBe(.84);expect(result.metalness).toBe(.68);expect(result.userData.tidelandSurfaceFamily).toBe('oxidized-metal');expect(result.userData.textures).toEqual([map,normal,roughness]);expect(result.userData.textures.every((value:unknown)=>value instanceof THREE.Texture)).toBe(true);expect(source.map).toBeNull();
  });

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
        createImageData:(width:number,height:number)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),getImageData:(_x:number,_y:number,width:number,height:number)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:()=>{},
        beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},quadraticCurveTo:()=>{},ellipse:()=>{},fill:()=>{},stroke:()=>{},fillRect:()=>{},
        fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',
      };
      return Object.assign(canvas,{getContext:()=>context});
    }});
    const compile=(material:THREE.MeshStandardMaterial)=>{
      const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <defaultnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>'};
      material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);return shader;
    };
    const legacy=stoneMaterial(),wetness={value:.35},revision6=stoneMaterial(0xb0ada0,true,wetness);
    try{
      const oldShader=compile(legacy),newShader=compile(revision6);
      expect(oldShader.vertexShader).toContain('vStonePos=position;vStoneNormal=normal;vStoneWorldNormal=normal;');
      expect(oldShader.vertexShader).not.toContain('stoneWorldPosition');
      expect(newShader.vertexShader).toContain('mat3 stoneViewRotation=mat3(viewMatrix)');
      expect(newShader.vertexShader).toContain('dot(stoneViewRotation[2],transformedNormal)');
      expect(newShader.vertexShader).toContain('stoneWorldPosition=instanceMatrix*stoneWorldPosition');
      expect(newShader.vertexShader).toContain('vStonePos=(modelMatrix*stoneWorldPosition).xyz');
      expect(newShader.vertexShader).toContain('vec3 stoneWorldNormal=objectNormal;');
      expect(newShader.vertexShader).toContain('stoneWorldNormal=mat3(instanceMatrix)*stoneWorldNormal;');
      expect(newShader.vertexShader).toContain('vStoneWorldNormal=normalize(mat3(modelMatrix)*stoneWorldNormal);');
      expect(newShader.uniforms.surfaceWetness?.value).toBe(.35);
      expect(legacy.normalMap).toBeTruthy();
      expect(revision6.normalMap).toBeNull();
      expect((revision6.userData.textures as THREE.Texture[]).length).toBe(2);
      expect(newShader.fragmentShader).toContain('texture2D(map,vStonePos.yz*.7)');
      expect(newShader.fragmentShader).toContain('vec3 bn=pow(abs(vStoneWorldNormal),vec3(4.))');
      expect(newShader.fragmentShader).not.toContain('vec3 bn=pow(abs(vStoneNormal),vec3(4.))');
      expect(oldShader.fragmentShader).not.toContain('stoneDx');
      expect(newShader.fragmentShader).toContain('float stoneHeight=dot(stoneDetail,vec3(.333))');
      expect(newShader.fragmentShader).toContain('stoneDx=dFdx(vViewPosition)');
      expect(newShader.fragmentShader).toContain('dFdx(stoneHeight)*stoneR1+dFdy(stoneHeight)*stoneR2');
      expect(revision6.customProgramCacheKey()).toBe('tideland-stone-detail-v3-world-weather');
      expect(legacy.customProgramCacheKey()).toBe('tideland-stone-detail-v3-local-static');
    }finally{
      for(const material of [legacy,revision6])for(const texture of material.userData.textures as THREE.Texture[])texture.dispose();
      vi.unstubAllGlobals();
    }
  });
});
