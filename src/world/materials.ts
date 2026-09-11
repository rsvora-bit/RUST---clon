import * as THREE from 'three';
import {Noise,randomSource} from './noise';

function canvas(size:number):[HTMLCanvasElement,CanvasRenderingContext2D]{const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');return [c,ctx];}
function texture(c:HTMLCanvasElement,repeat=1):THREE.CanvasTexture {const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;}
export function groundTexture(kind:'grass'|'sand'|'rock',seed:number):THREE.CanvasTexture {
  const [c,ctx]=canvas(512),n=new Noise(seed),rand=randomSource(seed);const img=ctx.createImageData(512,512);
  const base=kind==='grass'?[88,98,69]:kind==='sand'?[172,162,138]:[108,107,96];
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const u=x/512,vv=y/512,u2=u*u*(3-2*u),v2=vv*vv*(3-2*vv);
    const sample=(dx:number,dy:number)=>n.fbm(dx*.025,dy*.025,4);
    const broad=(sample(x,y)*(1-u2)+sample(x-512,y)*u2)*(1-v2)+(sample(x,y-512)*(1-u2)+sample(x-512,y-512)*u2)*v2,fine=n.at(x*.6,y*.6),r=rand();
    const v=(broad-.5)*.5+(fine-.5)*.2+(r-.5)*.18;const i=(y*512+x)*4;
    for(let k=0;k<3;k++)img.data[i+k]=base[k]!*(1+v);img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  if(kind==='grass')for(let i=0;i<12500;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle=i%4===0?'rgba(151,143,89,.35)':'rgba(37,53,28,.22)';ctx.lineWidth=.5+rand();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*5-2.5,y-rand()*7);ctx.stroke();}
  if(kind==='rock')for(let i=0;i<190;i++){let x=rand()*512,y=rand()*512;ctx.strokeStyle='rgba(34,37,31,.26)';ctx.lineWidth=.4+rand()*1.1;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<6;j++){x+=rand()*29-12;y+=rand()*19;ctx.lineTo(x,y);}ctx.stroke();}
  for(let i=0;i<2200;i++){const x=rand()*512,y=rand()*512,r=.3+rand()*(kind==='sand'?1.3:3);ctx.fillStyle=i%2?'rgba(25,27,21,.18)':'rgba(218,210,181,.24)';ctx.beginPath();ctx.ellipse(x,y,r,r*.63,rand()*6.28,0,Math.PI*2);ctx.fill();}
  return texture(c);
}
export function barkTexture():THREE.CanvasTexture {
  const [c,ctx]=canvas(512),rand=randomSource(449);ctx.fillStyle='#625340';ctx.fillRect(0,0,512,512);
  for(let i=0;i<900;i++){const x=rand()*512,y=rand()*512,w=1+rand()*9;ctx.fillStyle=i%3===0?'#3d3930':i%2?'#786950':'#524b3d';ctx.fillRect(x,y,w,8+rand()*72);ctx.fillStyle='rgba(170,155,123,.24)';ctx.fillRect(x,y,1,rand()*50);}
  return texture(c);
}
export function grassTexture(seed:number,straw=false):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed);
  for(let i=0;i<25;i++){
    const x=91+rand()*74,h=40+Math.pow(rand(),.65)*205,lean=(rand()-.5)*185,w=1.1+rand()*2.3;
    const gradient=ctx.createLinearGradient(x,256,x+lean,256-h);gradient.addColorStop(0,straw?'#605937':'#354424');gradient.addColorStop(.5,straw?'#85866c':'#637357');gradient.addColorStop(1,straw?'#aba68a':'#899379');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-w,256);ctx.quadraticCurveTo(x+lean*.4,256-h*.63,x+lean,256-h);ctx.quadraticCurveTo(x+lean*.4,256-h*.5,x+w,256);ctx.fill();
    if(i%9===0){ctx.strokeStyle=straw?'#b9ad76':'#90955d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,251);ctx.quadraticCurveTo(x+lean*.25,256-h*.6,x+lean*.7,256-h-10);ctx.stroke();for(let j=0;j<6;j++){ctx.fillStyle='#a69d69';ctx.beginPath();ctx.ellipse(x+lean*.7+(j%2?2:-2),256-h+j*3-10,1.6,3.5,j%2?.4:-.4,0,6.28);ctx.fill();}}
  }
  return texture(c);
}
export function pineTexture():THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(789);
  // Irregular bundles grow around secondary twigs rather than a comb-like fern.
  ctx.lineCap='round';ctx.strokeStyle='#655e4c';ctx.lineWidth=2.4;
  ctx.beginPath();ctx.moveTo(128,254);ctx.quadraticCurveTo(115,137,137,20);ctx.stroke();
  for(let b=0;b<19;b++){
    const y=40+rand()*184,side=b%2?1:-1,len=(24+y*.28)*(.55+rand()*.55);
    const ex=128+side*len,ey=y-18-rand()*32;
    ctx.strokeStyle='#676752';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(126,y+12);ctx.lineTo(ex,ey);ctx.stroke();
    for(let j=0;j<8;j++){
      const t=.15+j*.11,cx=126+(ex-126)*t,cy=y+12+(ey-y-12)*t;
      for(let k=0;k<14;k++){
        const angle=-Math.PI*.5+side*.5+(rand()-.5)*2.9,length=5+rand()*11;
        ctx.strokeStyle=['#405440','#566d50','#718365','#839177'][Math.floor(rand()*4)]!;
        ctx.lineWidth=.8+rand()*.85;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*length,cy+Math.sin(angle)*length);ctx.stroke();
      }
    }
  }
  return texture(c);
}
export function leavesTexture(seed=667):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed);ctx.strokeStyle='#686040';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(128,255);ctx.lineTo(133,34);ctx.stroke();
  for(let i=0;i<120;i++){const x=25+rand()*205,y=15+rand()*220,dx=x-128,dy=y-125;if(dx*dx/15000+dy*dy/15000>1)continue;const a=rand()*6.28,l=6+rand()*13;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=['#384a2b','#4d6036','#657a3f','#7b8745','#849452'][Math.floor(rand()*5)]!;ctx.beginPath();ctx.moveTo(0,-l);ctx.quadraticCurveTo(l*.8,-l*.1,0,l);ctx.quadraticCurveTo(-l*.8,-l*.1,0,-l);ctx.fill();ctx.strokeStyle='rgba(175,180,107,.3)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,-l);ctx.lineTo(0,l);ctx.stroke();ctx.restore();}
  return texture(c);
}
export function terrainMaterial():THREE.MeshStandardMaterial {
  const grass=groundTexture('grass',184),sand=groundTexture('sand',921),rock=groundTexture('rock',541);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
  mat.userData.textures=[grass,sand,rock];
  mat.onBeforeCompile=shader=>{
    shader.uniforms.grassTex={value:grass};shader.uniforms.sandTex={value:sand};shader.uniforms.rockTex={value:rock};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 surfaceWeights; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition=position; vGroundNormal=normal; vGroundWeights=surfaceWeights;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D grassTex; uniform sampler2D sandTex; uniform sampler2D rockTex; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights;\nfloat groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\nfloat groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+1.),f.x),f.y);}');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 gp=vGroundPosition; vec3 blend=pow(abs(vGroundNormal),vec3(4.0)); blend/=max(.001,blend.x+blend.y+blend.z);
      vec2 warp=vec2(groundNoise(gp.xz*.09),groundNoise(gp.zx*.07+17.));
      vec2 guv=gp.xz*.23+warp*.7;
      vec3 grassCol=mix(texture2D(grassTex,guv).rgb,texture2D(grassTex,mat2(.8,.6,-.6,.8)*guv*.43+7.).rgb,.38);
      vec3 sandCol=texture2D(sandTex,gp.xz*.16).rgb;
      vec3 rockCol=texture2D(rockTex,gp.zy*.19).rgb*blend.x+texture2D(rockTex,gp.xz*.19).rgb*blend.y+texture2D(rockTex,gp.xy*.19).rgb*blend.z;
      float macro=groundNoise(gp.xz*.13+warp*2.)*.65+groundNoise(gp.xz*.034)*.35;
      float soil=smoothstep(.38,.72,macro)*.72;
      grassCol=mix(grassCol,texture2D(sandTex,gp.xz*.37).rgb*vec3(.48,.40,.29),soil);
      grassCol*=.82+.28*groundNoise(gp.xz*3.7);
      float pebbles=smoothstep(.79,.88,groundNoise(gp.xz*12.));
      grassCol=mix(grassCol,grassCol*.78,pebbles*.22);
      sandCol*=mix(.57,1.,smoothstep(.0,2.1,gp.y+groundNoise(gp.xz*.8)*.4));
      diffuseColor.rgb*=sandCol*vGroundWeights.x+rockCol*vGroundWeights.y+grassCol*vGroundWeights.z;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float relief=(groundNoise(vGroundPosition.xz*5.)*.035+groundNoise(vGroundPosition.xz*19.)*.008)*(1.-smoothstep(12.,65.,length(vViewPosition)));
      vec3 dx=dFdx(vViewPosition),dy=dFdy(vViewPosition);
      vec3 r1=cross(dy,normal),r2=cross(normal,dx);
      float det=dot(dx,r1);
      normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));`);
  };return mat;
}
export function stoneMaterial(tint=0xb0ada0):THREE.MeshStandardMaterial {
  const tex=groundTexture('rock',773);const mat=new THREE.MeshStandardMaterial({map:tex,color:tint,roughness:.96,bumpMap:tex,bumpScale:.055});
  mat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePos; varying vec3 vStoneNormal;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePos=position;vStoneNormal=normal;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePos; varying vec3 vStoneNormal;');shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 bn=pow(abs(vStoneNormal),vec3(4.));bn/=max(.001,bn.x+bn.y+bn.z);diffuseColor.rgb*=texture2D(map,vStonePos.yz*.7).rgb*bn.x+texture2D(map,vStonePos.xz*.7).rgb*bn.y+texture2D(map,vStonePos.xy*.7).rgb*bn.z;`);};return mat;
}
