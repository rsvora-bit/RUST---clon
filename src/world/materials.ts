import * as THREE from 'three';
import {Noise,randomSource} from './noise';

function canvas(size:number):[HTMLCanvasElement,CanvasRenderingContext2D]{const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');return [c,ctx];}
function texture(c:HTMLCanvasElement,repeat=1):THREE.CanvasTexture {const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;}
export function groundTexture(kind:'grass'|'dry'|'sand'|'rock'|'dirt'|'snow',seed:number,worldRevision=0):THREE.CanvasTexture {
  const [c,ctx]=canvas(512),n=new Noise(seed),rand=randomSource(seed),revision6Snow=kind==='snow'&&worldRevision>=6;const img=ctx.createImageData(512,512);
  const base=kind==='grass'?[88,98,69]:kind==='dry'?[139,122,76]:kind==='sand'?[172,162,138]:kind==='dirt'?[101,82,58]:kind==='snow'?(revision6Snow?[190,204,210]:[211,218,218]):[108,107,96];
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
  if(revision6Snow){
    // Low-contrast, wind-combed sastrugi and ice grains add scale to the
    // bright alpine ground without introducing another shader sample.
    ctx.lineCap='round';
    for(let i=0;i<228;i++){
      const x=rand()*512,y=rand()*512,length=20+rand()*68,drift=(rand()-.5)*17;
      ctx.strokeStyle=i%4===0?'rgba(239,246,247,.42)':`rgba(54,83,101,${.10+rand()*.13})`;ctx.lineWidth=.9+rand()*2;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+length*.48,y+drift*.35,x+length,y+drift);ctx.stroke();
    }
    for(let i=0;i<4200;i++){
      const x=rand()*512,y=rand()*512,r=.35+rand()*1.35;ctx.fillStyle=i%5===0?'rgba(239,246,247,.38)':'rgba(54,83,101,.19)';ctx.beginPath();ctx.ellipse(x,y,r,r*(.45+rand()*.65),rand()*6.28,0,Math.PI*2);ctx.fill();
    }
  }
  for(let i=0;i<2200;i++){const x=rand()*512,y=rand()*512,r=.3+rand()*(kind==='sand'?1.3:3);ctx.fillStyle=i%2?'rgba(25,27,21,.18)':'rgba(218,210,181,.24)';ctx.beginPath();ctx.ellipse(x,y,r,r*.63,rand()*6.28,0,Math.PI*2);ctx.fill();}
  return texture(c);
}
/** Seamless, linear-space tangent normals for sub-meter terrain grain. */
export function terrainDetailNormalTexture(seed=8241,size=256):THREE.DataTexture {
  const rand=randomSource(seed),waves=Array.from({length:9},()=>{
    const frequency=2+Math.floor(rand()*33),angle=rand()*Math.PI*2;
    return{kx:Math.round(Math.cos(angle)*frequency),ky:Math.round(Math.sin(angle)*frequency),phase:rand()*Math.PI*2,amplitude:.028/(.55+frequency*.055)};
  }),data=new Uint8Array(size*size*4),tau=Math.PI*2,strength=.42;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;let dx=0,dy=0;
    for(const wave of waves){const phase=tau*(wave.kx*u+wave.ky*v)+wave.phase,slope=Math.cos(phase)*wave.amplitude*tau;dx+=slope*wave.kx;dy+=slope*wave.ky;}
    let nx=-dx*strength,ny=-dy*strength,nz=1;const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
    const offset=(y*size+x)*4;data[offset]=Math.round((nx*.5+.5)*255);data[offset+1]=Math.round((ny*.5+.5)*255);data[offset+2]=Math.round((nz*.5+.5)*255);data[offset+3]=255;
  }
  const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.colorSpace=THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(224,224);map.anisotropy=8;map.needsUpdate=true;return map;
}
/** Shared-shape, linear-space micro relief and roughness variation for stone. */
export function rockSurfaceMaps(seed=773,size=128):{normal:THREE.DataTexture;roughness:THREE.DataTexture}{
  const rand=randomSource(seed),waves=Array.from({length:13},()=>({x:2+Math.floor(rand()*43),y:2+Math.floor(rand()*43),phase:rand()*Math.PI*2,amplitude:.008+rand()*.018})),normalData=new Uint8Array(size*size*4),roughData=new Uint8Array(size*size*4),tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;let dx=0,dy=0,rough=.88;
    for(let j=0;j<waves.length;j++){const w=waves[j]!,phase=tau*(w.x*u+w.y*v)+w.phase,s=Math.sin(phase),slope=Math.cos(phase)*w.amplitude*tau;dx+=slope*w.x;dy+=slope*w.y;rough+=s*([.012,.019,.026,.034][j%4]!);}
    const nx=-dx*.15,ny=-dy*.15,nz=1,length=Math.hypot(nx,ny,nz),i=(y*size+x)*4;normalData[i]=Math.round((nx/length*.5+.5)*255);normalData[i+1]=Math.round((ny/length*.5+.5)*255);normalData[i+2]=Math.round((nz/length*.5+.5)*255);normalData[i+3]=255;
    const value=Math.round(Math.max(.70,Math.min(.99,rough))*255);roughData[i]=roughData[i+1]=roughData[i+2]=value;roughData[i+3]=255;
  }
  const create=(data:Uint8Array)=>{const map=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);map.colorSpace=THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(3,3);map.anisotropy=4;map.needsUpdate=true;return map;};
  return{normal:create(normalData),roughness:create(roughData)};
}
export function barkTexture(revision6=false):THREE.CanvasTexture {
  const [c,ctx]=canvas(512),rand=randomSource(449);ctx.fillStyle=revision6?'#88765d':'#75664f';ctx.fillRect(0,0,512,512);
  const streaks=revision6?['#625442','#ad9575','#9a8364','#7b674d']:['#50483a','#998568','#87765b','#695a43'];
  for(let i=0;i<1150;i++){const x=rand()*512,y=rand()*512,w=1+rand()*9;ctx.fillStyle=streaks[i%4]!;ctx.fillRect(x,y,w,8+rand()*72);ctx.fillStyle=revision6?'rgba(215,194,158,.28)':'rgba(196,173,132,.27)';ctx.fillRect(x,y,1,rand()*50);}
  for(let i=0;i<86;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle=i%2?'rgba(181,166,127,.2)':'rgba(48,57,39,.18)';ctx.lineWidth=1+rand()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+(rand()-.5)*12,y+6,x+(rand()-.5)*5,y+14+rand()*24);ctx.stroke();}
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
export function pineTexture(fuller=false):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(789);
  // Irregular bundles grow around secondary twigs rather than a comb-like fern.
  ctx.lineCap='round';ctx.strokeStyle='#655e4c';ctx.lineWidth=2.4;
  ctx.beginPath();ctx.moveTo(128,254);ctx.quadraticCurveTo(115,137,137,20);ctx.stroke();
  const palette=fuller?['#45613f','#587346','#6b824e','#7e9259','#8b9c63']:['#344d38','#45613f','#5a714a','#718258','#87935a'];
  for(let b=0;b<(fuller?23:19);b++){
    const y=40+rand()*184,side=b%2?1:-1,len=(24+y*.28)*(.55+rand()*.55);
    const ex=128+side*len,ey=y-18-rand()*32;
    ctx.strokeStyle='#676752';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(126,y+12);ctx.lineTo(ex,ey);ctx.stroke();
    for(let j=0;j<8;j++){
      const t=.15+j*.11,cx=126+(ex-126)*t,cy=y+12+(ey-y-12)*t;
      // Short, overlapping sprays make each bough read as evergreen foliage
      // at medium distance instead of a bare twig with isolated line needles.
      for(let k=0;k<(fuller?20:18);k++){
        const angle=-Math.PI*.5+side*.5+(rand()-.5)*2.9,length=(fuller?7:6)+rand()*(fuller?13:12);
        ctx.strokeStyle=palette[Math.floor(rand()*palette.length)]!;
        ctx.lineWidth=(fuller?1.65:1.2)+rand()*(fuller?1.35:1.15);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*(length+1),cy+Math.sin(angle)*(length+1));ctx.stroke();
      }
    }
  }
  return texture(c);
}
/** Original palm leaflet mask; UV length follows each bent frond. */
export function palmTexture(seed=905):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed);ctx.lineCap='round';
  ctx.strokeStyle='#8b9859';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(128,255);ctx.lineTo(128,12);ctx.stroke();
  for(let i=0;i<33;i++){const y=25+i*6.7,width=Math.sin((y-12)/245*Math.PI)*108;
    for(const side of [-1,1]){ctx.strokeStyle=['#547041','#668047','#7d9457'][Math.floor(rand()*3)]!;ctx.lineWidth=3.5+rand()*2;ctx.beginPath();ctx.moveTo(128,y+14);ctx.quadraticCurveTo(128+side*width*.5,y+4,128+side*width,y-13);ctx.stroke();}}
  return texture(c);
}
export function leavesTexture(seed=667,revision6=false):THREE.CanvasTexture {
  if(revision6){
    const [c,ctx]=canvas(256),rand=randomSource(seed),palette=['#506b39','#648047','#78924d','#8da258','#a0ae65'];
    ctx.lineCap='round';ctx.strokeStyle='#596044';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(127,249);ctx.quadraticCurveTo(115,138,129,20);ctx.stroke();
    const drawLeaf=(x:number,y:number,dx:number,dy:number,width:number,color:string)=>{
      const length=Math.hypot(dx,dy)||1,px=-dy/length*width,py=dx/length*width,mx=x+dx*.5,my=y+dy*.5;
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(mx+px,my+py,x+dx,y+dy);ctx.quadraticCurveTo(mx-px,my-py,x,y);ctx.fill();
      ctx.strokeStyle='rgba(190,197,132,.38)';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
    };
    // Broad, forked shoots form a loose oval crown on each instanced card;
    // this avoids the narrow upright sprig silhouette at ordinary play distance.
    for(let branch=0;branch<10;branch++){
      const side=branch%2===0?-1:1,baseY=68+Math.floor(branch/2)*34+rand()*8,baseX=128+(rand()-.5)*12,reach=34+rand()*36,rise=22+rand()*28,endX=baseX+side*reach,endY=baseY-rise,controlX=baseX+side*reach*.52,controlY=baseY-rise*.12;
      ctx.strokeStyle=branch%3===0?'#665d3e':'#596044';ctx.lineWidth=1.2+rand()*.65;ctx.beginPath();ctx.moveTo(baseX,baseY);ctx.quadraticCurveTo(controlX,controlY,endX,endY);ctx.stroke();
      for(let leaf=0;leaf<6;leaf++){
        const t=.14+leaf*.125,u=1-t,x=(u*u*baseX+2*u*t*controlX+t*t*endX),y=(u*u*baseY+2*u*t*controlY+t*t*endY),out=side*(10+rand()*12),riseLeaf=5+rand()*10,width=13+rand()*5;
        const color=palette[Math.floor(rand()*palette.length)]!;drawLeaf(x,y,out,-riseLeaf,width,color);drawLeaf(x,y,out*.78,riseLeaf*.46,width*.88,palette[Math.floor(rand()*palette.length)]!);
      }
    }
    return texture(c);
  }
  const [c,ctx]=canvas(256),rand=randomSource(seed);ctx.strokeStyle='#686040';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(128,255);ctx.lineTo(133,34);ctx.stroke();
  for(let i=0;i<120;i++){const x=25+rand()*205,y=15+rand()*220,dx=x-128,dy=y-125;if(dx*dx/15000+dy*dy/15000>1)continue;const a=rand()*6.28,l=6+rand()*13;ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=['#384a2b','#4d6036','#657a3f','#7b8745','#849452'][Math.floor(rand()*5)]!;ctx.beginPath();ctx.moveTo(0,-l);ctx.quadraticCurveTo(l*.8,-l*.1,0,l);ctx.quadraticCurveTo(-l*.8,-l*.1,0,-l);ctx.fill();ctx.strokeStyle='rgba(175,180,107,.3)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,-l);ctx.lineTo(0,l);ctx.stroke();ctx.restore();}
  return texture(c);
}
/** Opaque leaf breakup for the shaded volume behind Revision-6 cutout sprays. */
export function leafMassTexture(seed=741):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed),palette=['#48623b','#5b7542','#70874a','#829653','#94a45e','#a2ad68'];
  // Lift the shaded opaque core so its low-poly form remains legible under a
  // canopy; leaf-card highlights retain the brighter, cooler accent.
  ctx.fillStyle='#627749';ctx.fillRect(0,0,256,256);
  const leaf=(x:number,y:number,w:number,h:number,angle:number,color:string)=>{
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,w,h,angle,0,Math.PI*2);ctx.fill();
  };
  for(let i=0;i<1050;i++){
    const x=rand()*256,y=rand()*256,w=1.1+rand()*2.5,h=.55+rand()*1.3,angle=(rand()-.5)*2.8,color=palette[Math.floor(rand()*palette.length)]!;
    leaf(x,y,w,h,angle,color);
    if(x<4)leaf(x+256,y,w,h,angle,color);else if(x>252)leaf(x-256,y,w,h,angle,color);
  }
  return texture(c);
}
export function terrainMaterial(worldRevision=0):THREE.MeshStandardMaterial {
  const grass=groundTexture('grass',184),dry=groundTexture('dry',318),sand=groundTexture('sand',921),rock=groundTexture('rock',541),dirt=groundTexture('dirt',712),mud=groundTexture('dirt',1962),snow=groundTexture('snow',1181,worldRevision),detailNormal=terrainDetailNormalTexture(8241);
  const revision6=worldRevision>=6,surfaceWetness={value:0},revision6Moss={value:revision6?1:0},mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,normalMap:detailNormal,normalScale:new THREE.Vector2(.16,.16)});
  mat.userData.surfaceWetness=surfaceWetness;
  mat.userData.textures=[grass,dry,sand,rock,dirt,mud,snow,detailNormal];
  mat.onBeforeCompile=shader=>{
    const sharedRev6Fields=`float macro=groundNoise(gp.xz*.13+warp*2.)*.62+groundNoise(gp.xz*.034)*.38;float micro=groundNoise(gp.xz*3.7)*.72+groundNoise(gp.xz*11.3)*.28;float snowDrift=macro*.62+micro*.38;float duneField=macro*.72+micro*.28;float strata=macro*.42+micro*.58;`;
    const legacyFields=`float snowDrift=groundNoise(gp.xz*.12+warp*.35)*.62+groundNoise(gp.xz*.43+vec2(19.,-7.))*.38;float duneField=groundNoise(gp.xz*.035+warp*.24)*.62+groundNoise(gp.xz*.11+vec2(37.,-19.))*.38;float strata=groundNoise(gp.xz*.052+8.)*.62+groundNoise(gp.xz*.21-14.)*.38;`;
    const sharedFields=revision6?sharedRev6Fields:legacyFields,macroField=revision6?'':'float macro=groundNoise(gp.xz*.13+warp*2.)*.62+groundNoise(gp.xz*.034)*.38;',microField=revision6?'':'float micro=groundNoise(gp.xz*3.7)*.72+groundNoise(gp.xz*11.3)*.28;',mossField=revision6?'float mossNoise=macro*.68+micro*.32;':'float mossNoise=macro*.58+micro*.27+groundNoise(gp.xz*.47+vec2(29.,-13.))*.15;',reliefField=revision6?'float relief=(micro-.5)*.10;':'float relief=(groundNoise(vGroundPosition.xz*5.)*.044+groundNoise(vGroundPosition.xz*21.)*.010)*(1.-smoothstep(10.,72.,viewDist));';
    shader.uniforms.grassTex={value:grass};shader.uniforms.dryTex={value:dry};shader.uniforms.sandTex={value:sand};shader.uniforms.rockTex={value:rock};shader.uniforms.dirtTex={value:dirt};shader.uniforms.mudTex={value:mud};shader.uniforms.snowTex={value:snow};shader.uniforms.surfaceWetness=surfaceWetness;shader.uniforms.revision6Moss=revision6Moss;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 surfaceWeights; attribute vec4 surfaceClimate; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights; varying vec4 vGroundClimate;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition=position; vGroundNormal=normal; vGroundWeights=surfaceWeights; vGroundClimate=surfaceClimate;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D grassTex; uniform sampler2D dryTex; uniform sampler2D sandTex; uniform sampler2D rockTex; uniform sampler2D dirtTex; uniform sampler2D mudTex; uniform sampler2D snowTex; uniform float surfaceWetness; uniform float revision6Moss; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights; varying vec4 vGroundClimate;\nfloat groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+1.),f.x),f.y);}');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 gp=vGroundPosition;vec3 blend=pow(abs(vGroundNormal),vec3(4.0));blend/=max(.001,blend.x+blend.y+blend.z);
      vec2 warp=vec2(groundNoise(gp.xz*.09),groundNoise(gp.zx*.07+17.));${sharedFields}vec2 guv=gp.xz*.23+warp*.72;
      vec3 grassCol=mix(texture2D(grassTex,guv).rgb,texture2D(grassTex,mat2(.8,.6,-.6,.8)*guv*.43+7.).rgb,.38);
      vec3 dryCol=mix(texture2D(dryTex,guv*.82).rgb,texture2D(dryTex,mat2(.6,.8,-.8,.6)*guv*.37+19.).rgb,.36);
      vec3 snowTri=texture2D(snowTex,gp.zy*.48).rgb*blend.x+texture2D(snowTex,gp.xz*.48).rgb*blend.y+texture2D(snowTex,gp.xy*.48).rgb*blend.z;vec3 snowCol=mix(snowTri,texture2D(snowTex,guv*1.9+31.).rgb,.18);snowCol*=mix(.88+.20*snowDrift,.72+.52*snowDrift,revision6Moss);
      // Reuse the snow texture's existing drift field to break up the Rev6
      // treeline/snowline. Legacy snapshots keep their original climate mask.
      float snowCover=mix(vGroundClimate.y,smoothstep(.24,.66,vGroundClimate.y+(snowDrift-.5)*.42),revision6Moss);
      vec3 sandCol=mix(texture2D(sandTex,gp.xz*.16).rgb,texture2D(sandTex,gp.xz*.73+warp).rgb,.20);sandCol*=mix(1.,.38+duneField*1.24,revision6Moss);
      vec3 dirtCol=mix(texture2D(dirtTex,gp.xz*.27).rgb,texture2D(dirtTex,gp.xz*.91+13.).rgb,.25);vec3 mudCol=mix(texture2D(mudTex,guv*.72).rgb,texture2D(mudTex,mat2(.8,.6,-.6,.8)*guv*.42+29.).rgb,.32)*vec3(1.03,.98,.88);
      vec3 rockCol=texture2D(rockTex,gp.zy*.19).rgb*blend.x+texture2D(rockTex,gp.xz*.19).rgb*blend.y+texture2D(rockTex,gp.xy*.19).rgb*blend.z;rockCol*=mix(vec3(.53,.57,.55),vec3(.82,.79,.70),smoothstep(.28,.72,strata));
      ${macroField}float soil=smoothstep(.43,.69,macro)*(1.-vGroundWeights.x)*(1.-vGroundWeights.y*.65);grassCol=mix(grassCol,dirtCol,soil*.68);
      ${microField}grassCol*=.83+.25*micro;dirtCol*=.86+.22*micro;
      float wetHeight=mix(gp.y,gp.y+(duneField-.5)*.85,revision6Moss);float shorelineWet=mix((1.-smoothstep(.08,2.6,gp.y))*.72,(1.-smoothstep(.08,1.35,wetHeight))*.78,revision6Moss);float wet=max(max(surfaceWetness*.58,shorelineWet),vGroundClimate.w*.62);float tidalBand=(1.-smoothstep(mix(1.1,.28,revision6Moss),mix(6.4,2.8,revision6Moss),wetHeight))*smoothstep(.16,.92,vGroundWeights.x)*revision6Moss;float sandWet=mix(max(wet*.64,tidalBand*.58),clamp(max(wet*.86,tidalBand*1.10),0.,1.),revision6Moss);sandCol=mix(sandCol,sandCol*vec3(.49,.57,.56),sandWet);dirtCol=mix(dirtCol,dirtCol*vec3(.67,.73,.75),wet*.48);mudCol=mix(mudCol,mudCol*vec3(.64,.72,.72),wet*.22);grassCol=mix(grassCol,grassCol*vec3(.73,.80,.76),wet*.24);rockCol=mix(rockCol,rockCol*vec3(.70,.76,.79),wet*.28);
      vec3 climateGrass=mix(grassCol,dryCol,vGroundClimate.x);float shelteredSnow=snowCover*(1.-smoothstep(.20,.62,vGroundWeights.y))*(1.-smoothstep(.24,.72,1.-vGroundNormal.y));climateGrass=mix(climateGrass,snowCol,shelteredSnow);climateGrass=mix(climateGrass,climateGrass*vec3(.72,.88,.69),vGroundClimate.z*.24);climateGrass=mix(climateGrass,mudCol,vGroundClimate.w*.88);
      vec3 groundColor=sandCol*vGroundWeights.x+rockCol*vGroundWeights.y+climateGrass*vGroundWeights.z;float exposedSnow=snowCover*smoothstep(.16,.58,vGroundWeights.y)*smoothstep(.24,.72,1.-vGroundNormal.y)*.20;groundColor=mix(groundColor,snowCol,exposedSnow);
      float mossClimate=max(vGroundClimate.z*.62,vGroundClimate.w*.84)*(1.-vGroundClimate.x*.82)*(1.-vGroundClimate.y*.92);${mossField}float mossMask=smoothstep(.49,.72,mossNoise)*mossClimate*(1.-smoothstep(.22,.66,vGroundWeights.y))*(1.-smoothstep(.36,.82,vGroundWeights.x));mossMask*=revision6Moss*.32;vec3 mossTint=groundColor*vec3(.76,.91,.67);groundColor=mix(groundColor,mossTint,mossMask);
      // Reuse existing macro/micro fields to break up uniform Rev6 marsh mud
      // without adding texture fetches or changing any legacy revision.
      float mirePatch=macro*.62+micro*.38;float mireWetness=revision6Moss*smoothstep(.12,.46,vGroundClimate.w)*smoothstep(.34,.72,mirePatch);float mireSediment=smoothstep(.25,.78,mirePatch);vec3 mireTint=groundColor*mix(vec3(.54,.70,.68),vec3(.78,.80,.69),mireSediment);groundColor=mix(groundColor,mireTint,mireWetness*.62);diffuseColor.rgb*=groundColor;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float viewDist=length(vViewPosition);if(viewDist<72.){${reliefField}vec3 dx=dFdx(vViewPosition),dy=dFdy(vViewPosition);vec3 r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat surfaceWet= max(max(surfaceWetness*.68,(1.-smoothstep(.08,2.6,vGroundPosition.y))*.46),max(vGroundClimate.w*.50,mireWetness*.45)); roughnessFactor=mix(roughnessFactor,.48,surfaceWet);roughnessFactor=mix(roughnessFactor,.94,mossMask*.65);');
  };return mat;
}
export function rockMaterialStyle(worldRevision:number):{resourceTint:number;outcropTint:number;vertexColors:boolean} {
  const revision6=worldRevision>=6;return{resourceTint:revision6?0x999b93:0xd5d0bf,outcropTint:0xd5d0bf,vertexColors:revision6};
}
export function stoneWeatherShader(enabled:boolean):{uniform:string;diffuse:string;roughness:string}{
  return{uniform:'uniform float surfaceWetness;',diffuse:`float stoneWet=surfaceWetness*${enabled?'1.':'0.'};diffuseColor.rgb*=mix(1.,.78,clamp(stoneWet*.58,0.,.58));`,roughness:'roughnessFactor=mix(roughnessFactor,.56,clamp(stoneWet*.58,0.,.58));'};
}
export function stoneMaterial(tint=0xb0ada0,vertexColors=true,surfaceWetness?:{value:number}):THREE.MeshStandardMaterial {
  const tex=groundTexture('rock',773),detail=rockSurfaceMaps((Number(tint)^773)>>>0),wetnessUniform=surfaceWetness??{value:0};const mat=new THREE.MeshStandardMaterial({map:tex,color:tint,vertexColors,roughness:.90,roughnessMap:detail.roughness,normalMap:detail.normal,normalScale:new THREE.Vector2(.16,.16),metalness:.015});
  mat.userData.textures=[tex,detail.roughness,detail.normal];
  if(surfaceWetness)mat.userData.surfaceWetness=surfaceWetness;
  const weather=stoneWeatherShader(!!surfaceWetness);mat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStonePos; varying vec3 vStoneNormal;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStonePos=position;vStoneNormal=normal;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${weather.uniform} varying vec3 vStonePos; varying vec3 vStoneNormal;`);shader.uniforms.surfaceWetness=wetnessUniform;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 bn=pow(abs(vStoneNormal),vec3(4.));bn/=max(.001,bn.x+bn.y+bn.z);vec3 stoneDetail=texture2D(map,vStonePos.yz*.7).rgb*bn.x+texture2D(map,vStonePos.xz*.7).rgb*bn.y+texture2D(map,vStonePos.xy*.7).rgb*bn.z;diffuseColor.rgb*=.78+stoneDetail*1.1;${weather.diffuse}`);shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${weather.roughness}`);};return mat;
}


export function groundDecalTexture(seed:number,kind:'soil'|'leaves'|'stone'):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed);ctx.clearRect(0,0,256,256);
  const base=kind==='soil'?'92,70,45':kind==='leaves'?'72,66,37':'88,91,84';
  for(let i=0;i<180;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*104,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r,s=kind==='leaves'?2+rand()*8:4+rand()*17;const alpha=(1-r/112)*(.035+rand()*.12);ctx.fillStyle=`rgba(${base},${Math.max(0,alpha)})`;ctx.beginPath();ctx.ellipse(x,y,s,s*(.3+rand()*.55),rand()*6.28,0,Math.PI*2);ctx.fill();}
  const radial=ctx.createRadialGradient(128,128,18,128,128,122);radial.addColorStop(0,`rgba(${base},.10)`);radial.addColorStop(.72,`rgba(${base},.035)`);radial.addColorStop(1,`rgba(${base},0)`);ctx.fillStyle=radial;ctx.fillRect(0,0,256,256);return texture(c);
}
