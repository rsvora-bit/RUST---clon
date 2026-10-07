import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {groundTexture,leavesTexture,leafMassTexture,terrainDetailNormalTexture,terrainMaterial} from '../src/world/materials';

type TestCanvas=HTMLCanvasElement&{pixelData?:Uint8ClampedArray;strokes:string[];fills:string[];rects:string[]};
function installCanvasStub():TestCanvas[]{
  const canvases:TestCanvas[]=[];
  vi.stubGlobal('document',{createElement:()=>{
    const canvas={width:0,height:0,strokes:[],fills:[],rects:[]} as unknown as TestCanvas;canvases.push(canvas);
    let ctx:{fillStyle:string;strokeStyle:string};
    ctx={fillStyle:'#000',strokeStyle:'#000',
      createImageData:(width:number,height:number)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
      putImageData:(image:ImageData)=>{canvas.pixelData=image.data.slice();},
      fillRect:()=>canvas.rects.push(ctx.fillStyle),
      beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},quadraticCurveTo:()=>{},
      ellipse:()=>{},fill:()=>canvas.fills.push(ctx.fillStyle),stroke:()=>canvas.strokes.push(ctx.strokeStyle),
    } as unknown as {fillStyle:string;strokeStyle:string};
    (canvas as unknown as {getContext:(kind:string)=>unknown}).getContext=()=>ctx;
    return canvas;
  }});
  return canvases;
}

afterEach(()=>vi.unstubAllGlobals());

describe('revision-6 alpine snow texture',()=>{
  it('adds deterministic wind grain only to revision 6 while preserving legacy pixels',()=>{
    const canvases=installCanvasStub(),legacy=groundTexture('snow',1181),legacyRepeat=groundTexture('snow',1181),revision6=groundTexture('snow',1181,6);
    try{
      expect(canvases[0]!.pixelData).toEqual(canvases[1]!.pixelData);
      expect(canvases[0]!.pixelData).not.toEqual(canvases[2]!.pixelData);
      expect(canvases[0]!.strokes).toHaveLength(0);
      expect(canvases[2]!.strokes).toHaveLength(228);
      expect(canvases[0]!.fills).toHaveLength(2200);
      expect(canvases[2]!.fills).toHaveLength(6400);
    }finally{legacy.dispose();legacyRepeat.dispose();revision6.dispose();}
  });
});

describe('revision-6 tidal terrain band',()=>{
  it('breaks up a narrow wet-sand band while retaining legacy shoreline blending',()=>{
    installCanvasStub();
    const legacy=terrainMaterial(5),revision6=terrainMaterial(6);
    const compile=(material:THREE.MeshStandardMaterial)=>{
      const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>'};
      material.onBeforeCompile(shader as never,{} as THREE.WebGLRenderer);
      return shader;
    };
    try{
      const oldShader=compile(legacy),newShader=compile(revision6);
      expect(oldShader.uniforms.revision6Moss?.value).toBe(0);
      expect(newShader.uniforms.revision6Moss?.value).toBe(1);
      expect(oldShader.fragmentShader).toContain('groundNoise(gp.xz*.12+warp*.35)');
      expect(oldShader.fragmentShader).toContain('groundNoise(gp.xz*.47+vec2(29.,-13.))');
      expect(oldShader.fragmentShader).toContain('groundNoise(vGroundPosition.xz*21.)');
      expect(newShader.fragmentShader).toContain('float snowDrift=macro*.62+micro*.38');
      expect(newShader.fragmentShader).toContain('float duneField=macro*.72+micro*.28');
      expect(newShader.fragmentShader).toContain('float strata=macro*.42+micro*.58');
      expect(newShader.fragmentShader).toContain('float mossNoise=macro*.68+micro*.32');
      expect(newShader.fragmentShader).toContain('float relief=(micro-.5)*.10');
      expect(newShader.fragmentShader).toContain('texture2D(snowTex,gp.zy*.48).rgb*blend.x');
      expect(newShader.fragmentShader).toContain('texture2D(snowTex,gp.xz*.48).rgb*blend.y');
      expect(newShader.fragmentShader).toContain('texture2D(snowTex,gp.xy*.48).rgb*blend.z');
      expect(newShader.fragmentShader).not.toContain('groundNoise(gp.xz*.12+warp*.35)');
      expect(newShader.fragmentShader).not.toContain('groundNoise(gp.xz*.47+vec2(29.,-13.))');
      expect(newShader.fragmentShader).not.toContain('groundNoise(vGroundPosition.xz*21.)');
      expect(newShader.fragmentShader).toContain('gp.y+(duneField-.5)*.85');
      expect(newShader.fragmentShader).toContain('smoothstep(.08,1.35,wetHeight)');
      expect(newShader.fragmentShader).toContain('mix(6.4,2.8,revision6Moss)');
      expect(newShader.fragmentShader).toContain('clamp(max(wet*.86,tidalBand*1.10),0.,1.)');
      expect(newShader.fragmentShader).toContain('mirePatch=macro*.62+micro*.38');
      expect(newShader.fragmentShader).toContain('revision6Moss*smoothstep(.12,.46,vGroundClimate.w)*smoothstep(.34,.72,mirePatch)');
      expect(newShader.fragmentShader).toContain('mireSediment=smoothstep(.25,.78,mirePatch)');
      expect(newShader.fragmentShader).toContain('mix(vec3(.54,.70,.68),vec3(.78,.80,.69),mireSediment)');
      expect(newShader.fragmentShader).toContain('mireWetness*.45');
      expect(revision6.userData.textures).toHaveLength(8);
      expect(revision6.normalMap).toBe(revision6.userData.textures[7]);
      expect(revision6.normalScale.x).toBeCloseTo(.16);
    }finally{
      for(const material of [legacy,revision6])for(const tex of material.userData.textures as THREE.Texture[])tex.dispose();
    }
  });
});

describe('terrain micro-normal map',()=>{
  it('creates deterministic seamless linear-space normal detail for PBR lighting',()=>{
    const first=terrainDetailNormalTexture(8241,64),repeat=terrainDetailNormalTexture(8241,64),other=terrainDetailNormalTexture(8242,64);
    try{
      expect(first.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.wrapS).toBe(THREE.RepeatWrapping);expect(first.wrapT).toBe(THREE.RepeatWrapping);
      expect(first.repeat.x).toBe(224);expect(first.repeat.y).toBe(224);
      expect(first.image.data).toEqual(repeat.image.data);expect(first.image.data).not.toEqual(other.image.data);
      const pixels=first.image.data as Uint8Array,normal=(index:number)=>new THREE.Vector3(pixels[index]!/127.5-1,pixels[index+1]!/127.5-1,pixels[index+2]!/127.5-1).normalize();
      for(let x=0;x<64;x+=7)for(const y of [0,63])expect(normal((y*64+x)*4).length()).toBeCloseTo(1,2);
      const unique=new Set(Array.from({length:64*64},(_,index)=>`${pixels[index*4]},${pixels[index*4+1]},${pixels[index*4+2]}`));
      expect(unique.size).toBeGreaterThan(500);
    }finally{first.dispose();repeat.dispose();other.dispose();}
  });
});

describe('revision-6 opaque canopy texture',()=>{
  it('creates deterministic leaf breakup with an opaque base and wrapped edge detail',()=>{
    const canvases=installCanvasStub(),first=leafMassTexture(741),repeat=leafMassTexture(741);
    try{
      expect(canvases[0]!.rects).toEqual(['#627749']);
      expect(canvases[0]!.fills.length).toBeGreaterThan(1050);
      expect(canvases[0]!.fills).toEqual(canvases[1]!.fills);
      expect(canvases[0]!.fills).toContain('#48623b');
      expect(canvases[0]!.fills).toContain('#a2ad68');
      expect(first.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.wrapS).toBe(THREE.RepeatWrapping);
    }finally{first.dispose();repeat.dispose();}
  });
});

describe('revision-6 broadleaf sprig texture',()=>{
  it('draws a deterministic branched canopy mask with paired leaf detail',()=>{
    const canvases=installCanvasStub(),first=leavesTexture(667,true),repeat=leavesTexture(667,true);
    try{
      expect(canvases[0]!.fills.length).toBeGreaterThan(100);
      expect(canvases[0]!.fills).toEqual(canvases[1]!.fills);
      expect(canvases[0]!.strokes).toEqual(canvases[1]!.strokes);
      expect(canvases[0]!.fills).toContain('#506b39');
      expect(canvases[0]!.fills).toContain('#a0ae65');
      expect(first.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.wrapS).toBe(THREE.RepeatWrapping);
    }finally{first.dispose();repeat.dispose();}
  });
});
