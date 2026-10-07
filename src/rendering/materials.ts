import * as THREE from 'three';
export interface WeatherWetnessUniform{value:number}
export interface WoodSurfaceMaps{roughness:THREE.DataTexture;normal:THREE.DataTexture}
/** Linear, tileable maps keep wood color separate from its PBR surface response. */
export function woodSurfaceMaps(seed=4108,size=128):WoodSurfaceMaps{
  let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const waves=Array.from({length:11},()=>({x:2+Math.floor(rand()*27),y:Math.floor(rand()*7),phase:rand()*Math.PI*2,amplitude:.018+rand()*.028}));
  const normalData=new Uint8Array(size*size*4),roughData=new Uint8Array(size*size*4),tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;let dx=0,dy=0,rough=.76;
    for(let i=0;i<waves.length;i++){const wave=waves[i]!,phase=tau*(wave.x*u+wave.y*v)+wave.phase,s=Math.sin(phase),slope=Math.cos(phase)*wave.amplitude*tau;dx+=slope*wave.x;dy+=slope*wave.y;rough+=s*([.004,.006,.009,.012,.016][i%5]!);}
    // Narrow longitudinal grooves follow the vertical wood grain while a small
    // cross-wave bend avoids a perfectly manufactured stripe pattern.
    const nx=-dx*.12,ny=-dy*.12,nz=1,length=Math.hypot(nx,ny,nz),i=(y*size+x)*4;
    normalData[i]=Math.round((nx/length*.5+.5)*255);normalData[i+1]=Math.round((ny/length*.5+.5)*255);normalData[i+2]=Math.round((nz/length*.5+.5)*255);normalData[i+3]=255;
    const value=Math.round(Math.max(.56,Math.min(.94,rough))*255);roughData[i]=roughData[i+1]=roughData[i+2]=value;roughData[i+3]=255;
  }
  const make=(data:Uint8Array)=>{const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.colorSpace=THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,1);map.anisotropy=4;map.needsUpdate=true;return map;};
  return{roughness:make(roughData),normal:make(normalData)};
}
export function addWeatherSurfaceResponse(material:THREE.MeshStandardMaterial,wetness:WeatherWetnessUniform,strength=.72,minRoughness=.46){
  if(material.userData.tidelandWeatherResponse)return;
  const previousCompile=material.onBeforeCompile,previousCacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    if(shader.fragmentShader.includes('tidelandWeatherWetness'))return;
    shader.uniforms.tidelandWeatherWetness=wetness;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float tidelandWeatherWetness;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat tidelandWet=clamp(tidelandWeatherWetness*${strength.toFixed(3)},0.0,1.0);diffuseColor.rgb*=1.0-tidelandWet*.105;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(${minRoughness.toFixed(3)},roughnessFactor*.76),tidelandWet*.72);`);
  };
  material.customProgramCacheKey=()=>`${previousCacheKey.call(material)}|tideland-weather-response-v1-${strength.toFixed(3)}-${minRoughness.toFixed(3)}`;
  material.userData.tidelandWeatherResponse=true;material.userData.tidelandWeatherWetness=wetness;material.needsUpdate=true;
}
export function woodMaterial(color:string){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;const c=canvas.getContext('2d')!;
  c.fillStyle='#969183';c.fillRect(0,0,128,512);let n=42;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  for(let i=0;i<1500;i++){const x=rand()*128,y=rand()*512;c.strokeStyle=`rgba(${rand()>.5?'43,42,37':'220,216,199'},${rand()*.22})`;c.lineWidth=rand()*1.4;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+rand()*5,y+18,x-2,y+40,x+rand()*2,y+rand()*160);c.stroke();}
  for(let i=0;i<8;i++){c.strokeStyle='rgba(44,32,20,.27)';c.lineWidth=1;c.beginPath();c.ellipse(rand()*128,rand()*512,2+rand()*4,10+rand()*16,0,0,Math.PI*2);c.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  const seed=[...color].reduce((hash,character)=>(Math.imul(hash,31)+character.charCodeAt(0))>>>0,4108),surface=woodSurfaceMaps(seed);
  const material=new THREE.MeshStandardMaterial({color,map:texture,roughness:.84,roughnessMap:surface.roughness,normalMap:surface.normal,normalScale:new THREE.Vector2(.12,.12)});
  material.userData.textures=[texture,surface.roughness,surface.normal];return material;
}
export function stoneMaterial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;let n=356;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  c.fillStyle='#8a887e';c.fillRect(0,0,256,256);
  for(let i=0;i<15000;i++){const v=Math.floor(80+rand()*110);c.fillStyle=`rgba(${v},${v-2},${v-8},${.08+rand()*.18})`;c.fillRect(rand()*256,rand()*256,rand()*9+1,rand()*7+1);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({color:'#b2ad98',map:t,roughness:1,bumpMap:t,bumpScale:.13});
}
