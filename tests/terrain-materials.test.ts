import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {groundTexture,leafMassTexture} from '../src/world/materials';

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

describe('revision-6 opaque canopy texture',()=>{
  it('creates deterministic leaf breakup with an opaque base and wrapped edge detail',()=>{
    const canvases=installCanvasStub(),first=leafMassTexture(741),repeat=leafMassTexture(741);
    try{
      expect(canvases[0]!.rects).toEqual(['#50653a']);
      expect(canvases[0]!.fills.length).toBeGreaterThan(1050);
      expect(canvases[0]!.fills).toEqual(canvases[1]!.fills);
      expect(first.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.wrapS).toBe(THREE.RepeatWrapping);
    }finally{first.dispose();repeat.dispose();}
  });
});
