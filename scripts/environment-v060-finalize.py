from pathlib import Path
import json,re


def replace_once(path:str,old:str,new:str):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'Expected block not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

def regex_once(path:str,pattern:str,replacement:str):
    p=Path(path); text=p.read_text(); out,count=re.subn(pattern,lambda _:replacement,text,count=1,flags=re.S)
    if count!=1: raise SystemExit(f'Expected one regex match in {path}, got {count}: {pattern[:100]}')
    p.write_text(out)

# ---------------------------------------------------------------------------
# GFX-11/12/13: quality-gated post pipeline: SSAO, grading and subtle bloom.
# ---------------------------------------------------------------------------
Path('src/rendering/WorldPostFX.ts').write_text(r'''import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import type {GraphicsQuality} from '../core/types';

const gradingShader={
  uniforms:{tDiffuse:{value:null},night:{value:0},storm:{value:0},dusk:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float night;uniform float storm;uniform float dusk;varying vec2 vUv;
    void main(){vec4 src=texture2D(tDiffuse,vUv);vec3 c=src.rgb;float l=dot(c,vec3(.2126,.7152,.0722));float saturation=1.055-storm*.075;c=mix(vec3(l),c,saturation);float contrast=1.045-storm*.025;c=(c-.5)*contrast+.5;c*=vec3(1.015+dusk*.045,1.-night*.018,1.-night*.045);c+=vec3(.012,.004,-.006)*dusk;c=mix(c,vec3(l*.83,l*.91,l),night*.075);gl_FragColor=vec4(max(c,0.),src.a);}`
};

/** Optional world-only post processing. LOW/MEDIUM stay on the direct renderer path. */
export class WorldPostFX {
  private readonly composer:EffectComposer;
  private readonly renderPass:RenderPass;
  private readonly ssao:SSAOPass;
  private readonly bloom:UnrealBloomPass;
  private readonly grade:ShaderPass;
  private readonly output:OutputPass;
  private enabled=false;
  private quality:GraphicsQuality='high';

  constructor(private readonly renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
    this.composer=new EffectComposer(renderer);
    this.renderPass=new RenderPass(scene,camera);this.composer.addPass(this.renderPass);
    this.ssao=new SSAOPass(scene,camera,1,1);this.ssao.kernelRadius=7;this.ssao.minDistance=.0025;this.ssao.maxDistance=.075;this.composer.addPass(this.ssao);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.15,.38,.94);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass(gradingShader);this.composer.addPass(this.grade);
    this.output=new OutputPass();this.composer.addPass(this.output);
    this.setQuality('high');
  }

  setQuality(q:GraphicsQuality):void{
    this.quality=q;this.enabled=q==='high'||q==='ultra';
    this.ssao.enabled=this.enabled;this.bloom.enabled=this.enabled;this.grade.enabled=this.enabled;this.output.enabled=this.enabled;
    this.ssao.kernelRadius=q==='ultra'?10:7;this.ssao.minDistance=q==='ultra'?.002:.0025;this.ssao.maxDistance=q==='ultra'?.09:.07;
    this.bloom.strength=q==='ultra'?.19:.12;this.bloom.radius=q==='ultra'?.46:.34;this.bloom.threshold=q==='ultra'?.91:.95;
  }

  update(timeOfDay:number,weatherBlend:number,storm:number):void{
    const night=1-THREE.MathUtils.smoothstep(Math.sin((timeOfDay-6)/24*Math.PI*2),-.16,.28);
    const dusk=Math.max(0,1-Math.abs((((timeOfDay+6)%24)-12)/3));
    this.grade.uniforms.night.value=THREE.MathUtils.clamp(night,0,1);this.grade.uniforms.storm.value=THREE.MathUtils.clamp(Math.max(weatherBlend*.45,storm),0,1);this.grade.uniforms.dusk.value=THREE.MathUtils.clamp(dusk,0,1);
  }

  render():void{if(this.enabled)this.composer.render();else this.renderer.render(this.renderPass.scene,this.renderPass.camera);}
  resize(width:number,height:number,pixelRatio:number):void{this.composer.setPixelRatio(Math.max(.5,pixelRatio));this.composer.setSize(Math.max(1,width),Math.max(1,height));}
  dispose():void{this.composer.dispose();}
  diagnostics(){return {enabled:this.enabled,quality:this.quality,ssao:this.ssao.enabled,bloom:this.bloom.enabled,bloomStrength:this.bloom.strength};}
}
''')

# ---------------------------------------------------------------------------
# GFX-1/2/5/6: richer procedural ground blend, near detail, rock relief, decals.
# ---------------------------------------------------------------------------
replace_once('src/world/materials.ts',"export function groundTexture(kind:'grass'|'sand'|'rock',seed:number):THREE.CanvasTexture {","export function groundTexture(kind:'grass'|'sand'|'rock'|'dirt',seed:number):THREE.CanvasTexture {")
replace_once('src/world/materials.ts',"  const base=kind==='grass'?[88,98,69]:kind==='sand'?[172,162,138]:[108,107,96];","  const base=kind==='grass'?[88,98,69]:kind==='sand'?[172,162,138]:kind==='dirt'?[101,82,58]:[108,107,96];")
new_terrain=r'''export function terrainMaterial():THREE.MeshStandardMaterial {
  const grass=groundTexture('grass',184),sand=groundTexture('sand',921),rock=groundTexture('rock',541),dirt=groundTexture('dirt',712);
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0});
  mat.userData.textures=[grass,sand,rock,dirt];
  mat.onBeforeCompile=shader=>{
    shader.uniforms.grassTex={value:grass};shader.uniforms.sandTex={value:sand};shader.uniforms.rockTex={value:rock};shader.uniforms.dirtTex={value:dirt};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 surfaceWeights; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPosition=position; vGroundNormal=normal; vGroundWeights=surfaceWeights;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D grassTex; uniform sampler2D sandTex; uniform sampler2D rockTex; uniform sampler2D dirtTex; varying vec3 vGroundPosition; varying vec3 vGroundNormal; varying vec3 vGroundWeights;\nfloat groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+1.),f.x),f.y);}');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 gp=vGroundPosition;vec3 blend=pow(abs(vGroundNormal),vec3(4.0));blend/=max(.001,blend.x+blend.y+blend.z);
      vec2 warp=vec2(groundNoise(gp.xz*.09),groundNoise(gp.zx*.07+17.));vec2 guv=gp.xz*.23+warp*.72;
      vec3 grassCol=mix(texture2D(grassTex,guv).rgb,texture2D(grassTex,mat2(.8,.6,-.6,.8)*guv*.43+7.).rgb,.38);
      vec3 sandCol=mix(texture2D(sandTex,gp.xz*.16).rgb,texture2D(sandTex,gp.xz*.73+warp).rgb,.20);
      vec3 dirtCol=mix(texture2D(dirtTex,gp.xz*.27).rgb,texture2D(dirtTex,gp.xz*.91+13.).rgb,.25);
      vec3 rockCol=texture2D(rockTex,gp.zy*.19).rgb*blend.x+texture2D(rockTex,gp.xz*.19).rgb*blend.y+texture2D(rockTex,gp.xy*.19).rgb*blend.z;
      float macro=groundNoise(gp.xz*.13+warp*2.)*.62+groundNoise(gp.xz*.034)*.38;float soil=smoothstep(.43,.69,macro)*(1.-vGroundWeights.x)*(1.-vGroundWeights.y*.65);grassCol=mix(grassCol,dirtCol,soil*.68);
      float micro=groundNoise(gp.xz*3.7)*.72+groundNoise(gp.xz*11.3)*.28;grassCol*=.83+.25*micro;dirtCol*=.86+.22*micro;
      float wet=smoothstep(2.4,.0,gp.y);sandCol=mix(sandCol,sandCol*vec3(.62,.68,.69),wet*.55);
      diffuseColor.rgb*=sandCol*vGroundWeights.x+rockCol*vGroundWeights.y+grassCol*vGroundWeights.z;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float viewDist=length(vViewPosition);float relief=(groundNoise(vGroundPosition.xz*5.)*.044+groundNoise(vGroundPosition.xz*21.)*.010)*(1.-smoothstep(10.,72.,viewDist));vec3 dx=dFdx(vViewPosition),dy=dFdy(vViewPosition);vec3 r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));`);
  };return mat;
}
'''
regex_once('src/world/materials.ts',r"export function terrainMaterial\(\):THREE\.MeshStandardMaterial \{.*?\n\}\n(?=export function stoneMaterial)",new_terrain)
replace_once('src/world/materials.ts',"const tex=groundTexture('rock',773);const mat=new THREE.MeshStandardMaterial({map:tex,color:tint,roughness:.96,bumpMap:tex,bumpScale:.055});","const tex=groundTexture('rock',773);const mat=new THREE.MeshStandardMaterial({map:tex,color:tint,roughness:.92,metalness:.015,bumpMap:tex,bumpScale:.075});")
Path('src/world/materials.ts').write_text(Path('src/world/materials.ts').read_text()+r'''

export function groundDecalTexture(seed:number,kind:'soil'|'leaves'|'stone'):THREE.CanvasTexture {
  const [c,ctx]=canvas(256),rand=randomSource(seed);ctx.clearRect(0,0,256,256);
  const base=kind==='soil'?'92,70,45':kind==='leaves'?'72,66,37':'88,91,84';
  for(let i=0;i<180;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*104,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r,s=kind==='leaves'?2+rand()*8:4+rand()*17;const alpha=(1-r/112)*(.035+rand()*.12);ctx.fillStyle=`rgba(${base},${Math.max(0,alpha)})`;ctx.beginPath();ctx.ellipse(x,y,s,s*(.3+rand()*.55),rand()*6.28,0,Math.PI*2);ctx.fill();}
  const radial=ctx.createRadialGradient(128,128,18,128,128,122);radial.addColorStop(0,`rgba(${base},.10)`);radial.addColorStop(.72,`rgba(${base},.035)`);radial.addColorStop(1,`rgba(${base},0)`);ctx.fillStyle=radial;ctx.fillRect(0,0,256,256);return texture(c);
}
''')

# ---------------------------------------------------------------------------
# GFX-3/4/8: richer procedural tree/understory/coast geometry.
# ---------------------------------------------------------------------------
Path('src/world/models.ts').write_text(Path('src/world/models.ts').read_text()+r'''

export function fernGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  for(let arm=0;arm<9;arm++){
    const g=new THREE.PlaneGeometry(.34,.95,4,7),p=g.getAttribute('position');
    for(let i=0;i<p.count;i++){const y=p.getY(i)+.475,t=Math.max(0,Math.min(1,y/.95)),w=Math.sin(t*Math.PI)*(.92-.22*t);p.setX(i,p.getX(i)*w);p.setZ(i,Math.sin(t*Math.PI)*.13);}
    g.translate(0,.46,0);temp.position.set(0,.02,0);temp.rotation.set(-.72+(arm%3)*.08,arm/9*Math.PI*2,(arm%2?1:-1)*.08);temp.scale.set(1,1,1);temp.updateMatrix();g.applyMatrix4(temp.matrix);parts.push(g);
  }
  const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}

export function twigGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  const add=(x:number,z:number,len:number,rot:number)=>{const g=new THREE.CylinderGeometry(.012,.021,len,5);g.rotateZ(Math.PI/2);g.rotateY(rot);g.translate(x,.025,z);parts.push(g);};
  add(0,0,.95,.2);add(.08,.03,.62,-.55);add(-.14,-.04,.48,.83);const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return geo;
}

export function seaweedGeometry():THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];
  for(let blade=0;blade<6;blade++){const g=new THREE.PlaneGeometry(.14,.9,2,7),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i)+.45,t=y/.9;p.setX(i,p.getX(i)*(1-t*.72)+Math.sin(t*8+blade)*.05*t);p.setZ(i,Math.sin(t*5+blade)*.055);}g.translate((blade-2.5)*.045,.44,0);g.rotateY(blade/6*Math.PI*2);parts.push(g);}const geo=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geo.computeVertexNormals();return geo;
}
''')

# ---------------------------------------------------------------------------
# GFX-7/9/10/14: upgraded sky/clouds/moon, ocean reflection/foam, depth fog,
# and quality-sensitive shadow maps.
# ---------------------------------------------------------------------------
Path('src/world/atmosphere.ts').write_text(r'''import * as THREE from 'three';
import {WORLD} from '../config/balance';
import type {GraphicsQuality} from '../core/types';

export class Atmosphere {
  readonly sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
  readonly ocean:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  readonly sun=new THREE.DirectionalLight(0xfff0ce,3.1);
  readonly fill=new THREE.HemisphereLight(0xbacfe0,0x525944,2.1);
  readonly fog=new THREE.FogExp2(0xb1c6cf,.00145);
  readonly sunDirection=new THREE.Vector3(-.5,.72,.4).normalize();
  private elapsed=0;private daylight=1;
  get daylightAmount(){return this.daylight;}

  constructor(readonly scene:THREE.Scene,heightTexture:THREE.DataTexture){
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1600,40,20),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDir:{value:this.sunDirection},daylight:{value:1},clock:{value:0},weather:{value:0}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      varying vec3 vDirection;uniform vec3 sunDir;uniform float daylight;uniform float clock;uniform float weather;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float f=0.;f+=.5*noise(p);p=p*2.03+17.2;f+=.25*noise(p);p=p*2.01-12.7;f+=.125*noise(p);p=p*2.04+8.2;f+=.0625*noise(p);return f;}
      void main(){vec3 d=normalize(vDirection);float altitude=max(d.y,0.);float horizonHaze=pow(1.-altitude,5.);vec3 horizon=mix(vec3(.045,.065,.115),vec3(.54,.69,.76),daylight);vec3 zenith=mix(vec3(.008,.015,.048),vec3(.095,.31,.62),daylight);vec3 col=mix(horizon,zenith,pow(altitude,.46));col=mix(col,vec3(.61,.68,.70),horizonHaze*weather*.34);
        float alignment=max(0.,dot(d,sunDir)),sunset=(1.-smoothstep(.04,.45,sunDir.y))*smoothstep(-.2,.1,sunDir.y);col+=vec3(.42,.12,.025)*pow(alignment,5.)*sunset;col+=vec3(1.,.84,.57)*pow(alignment,110.)*.38*daylight;col+=vec3(1.,.95,.80)*smoothstep(.99935,.99982,alignment)*daylight*5.;
        vec3 moonDir=-sunDir;float moon=max(0.,dot(d,moonDir));col+=vec3(.56,.67,.86)*smoothstep(.99945,.99982,moon)*(1.-daylight)*1.35;col+=vec3(.15,.20,.31)*pow(moon,55.)*(1.-daylight)*.22;
        vec2 baseUv=d.xz/max(.10,d.y+.075)*2.55,drift=vec2(clock*.0018,clock*.00045);float broad=fbm(baseUv*.58+drift),detail=fbm(baseUv*1.43+drift*1.7+11.),high=fbm(baseUv*2.4-drift*.8-23.);float cloud=smoothstep(.52-weather*.07,.72-weather*.12,broad*.50+detail*.42+high*.15);cloud*=smoothstep(.012,.16,d.y);float lining=pow(max(0.,dot(normalize(vec3(d.x,.16,d.z)),sunDir)),7.)*cloud;vec3 cloudDark=mix(vec3(.10,.12,.17),vec3(.58,.64,.67),daylight);vec3 cloudLight=mix(cloudDark,vec3(.98,.96,.86),.55+.35*daylight);vec3 cloudColor=mix(cloudDark,cloudLight,smoothstep(.44,.78,broad));cloudColor+=vec3(1.,.78,.48)*lining*sunset*.45;col=mix(col,cloudColor,min(.95,cloud*(.77+weather*.20)));
        float stars=step(.9987,hash(floor(d.xz/max(.055,d.y)*620.)))*smoothstep(.045,.4,d.y)*(1.-daylight);col+=stars*vec3(.62,.72,.95);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);

    const oceanGeo=new THREE.PlaneGeometry(2600,2600,176,176);oceanGeo.rotateX(-Math.PI/2);
    this.ocean=new THREE.Mesh(oceanGeo,new THREE.ShaderMaterial({uniforms:{clock:{value:0},weather:{value:0},sunDir:{value:this.sunDirection},cameraPos:{value:new THREE.Vector3()},daylight:{value:1},heightMap:{value:heightTexture},islandSize:{value:WORLD.SIZE},fogColor:{value:this.fog.color}},vertexShader:`uniform float clock;uniform float weather;varying vec3 vWorld;void main(){vec3 p=position;p.y+=sin(p.x*.095+p.z*.043+clock*.55)*.10+sin(p.z*.077-p.x*.023+clock*.38)*.11+sin(p.x*.037-p.z*.12-clock*.46)*.07;p.y+=weather*sin(p.x*.06+p.z*.04+clock)*.18;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`
      uniform float clock;uniform float weather;uniform vec3 sunDir;uniform vec3 cameraPos;uniform float daylight;uniform sampler2D heightMap;uniform float islandSize;uniform vec3 fogColor;varying vec3 vWorld;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}float waves(vec2 p){vec2 d=vec2(clock*.13,-clock*.19);float s=n(p*.16+d*.4);return n(p*.72+d+s)*.78+n(mat2(.8,.6,-.6,.8)*p*1.7-d)*.36+n(p*4.3+d*1.3)*.11;}
      void main(){vec2 p=vWorld.xz;float w=waves(p),near=1.-smoothstep(55.,270.,length(cameraPos.xz-p));float eps=.14;vec3 normal=normalize(vec3((waves(p-vec2(eps,0.))-waves(p+vec2(eps,0.)))*near,1.22,(waves(p-vec2(0.,eps))-waves(p+vec2(0.,eps)))*near));vec3 view=normalize(cameraPos-vWorld);float fres=pow(1.-max(.0,dot(normal,view)),3.25);vec3 deep=mix(vec3(.018,.085,.12),vec3(.05,.19,.22),daylight);vec3 skyReflect=mix(vec3(.025,.045,.095),vec3(.31,.48,.60),daylight);vec3 water=mix(deep,skyReflect,.18+fres*.72);float spec=pow(max(0.,dot(reflect(-sunDir,normal),view)),95.);water+=vec3(1.,.82,.53)*spec*(1.15+fres)*daylight;
        vec2 huv=p/islandSize+.5;float terrain=texture2D(heightMap,huv).r*100.-20.;float bounds=step(0.,huv.x)*step(huv.x,1.)*step(0.,huv.y)*step(huv.y,1.);float shore=abs(terrain-vWorld.y),shallow=(1.-smoothstep(0.,4.8,-terrain))*bounds;water=mix(water,vec3(.075,.24,.245)*(.35+.65*daylight),shallow*(1.-fres)*.54);float band=(1.-smoothstep(.05,.95,shore))*bounds;float foamNoise=n(p*3.2+vec2(clock*.19,-clock*.11))*.62+n(p*7.7-clock*.07)*.38;float foam=band*smoothstep(.58,.82,foamNoise+sin(shore*9.-clock*1.7)*.10);water=mix(water,vec3(.82,.87,.82)*(.35+.65*daylight),foam*.58);float dist=length(cameraPos-vWorld);float haze=1.-exp(-dist*.00165);water=mix(water,fogColor,haze);gl_FragColor=vec4(water,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.ocean.position.y=-.12;this.ocean.receiveShadow=true;scene.add(this.ocean);

    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=this.sun.shadow.camera.bottom=-72;this.sun.shadow.camera.right=this.sun.shadow.camera.top=72;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=225;this.sun.shadow.bias=-.00016;this.sun.shadow.normalBias=.055;this.sun.shadow.radius=3;scene.add(this.sun,this.sun.target,this.fill);scene.fog=this.fog;
  }

  update(dt:number,time:number,camera:THREE.Vector3):void{
    this.elapsed+=dt;const a=(time-6)/24*Math.PI*2;this.sunDirection.set(-Math.cos(a)*.75,Math.sin(a),.42).normalize();this.daylight=THREE.MathUtils.smoothstep(this.sunDirection.y,-.16,.26);
    this.sun.intensity=.055+this.daylight*2.72;this.sun.color.setRGB(1,.72+this.daylight*.21,.53+this.daylight*.34);this.fill.intensity=.31+this.daylight*.98;this.fill.color.setRGB(.49+this.daylight*.21,.59+this.daylight*.21,.84);this.fill.groundColor.setRGB(.14+this.daylight*.15,.16+this.daylight*.17,.15+this.daylight*.13);
    this.fog.color.setRGB(.05+.48*this.daylight,.078+.55*this.daylight,.14+.61*this.daylight);this.fog.density=.00128+(1-this.daylight)*.00162;
    const sx=Math.round(camera.x/2)*2,sz=Math.round(camera.z/2)*2;this.sun.target.position.set(sx,camera.y-5,sz);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection,105);this.sky.position.copy(camera);
    this.sky.material.uniforms.daylight.value=this.daylight;this.sky.material.uniforms.clock.value=this.elapsed;this.ocean.material.uniforms.clock.value=this.elapsed;this.ocean.material.uniforms.daylight.value=this.daylight;this.ocean.material.uniforms.cameraPos.value.copy(camera);
  }

  setQuality(q:GraphicsQuality):void{
    this.sun.castShadow=q!=='low';const size=q==='ultra'?3072:q==='high'?2048:q==='medium'?1024:768;this.sun.shadow.radius=q==='ultra'?4:q==='high'?3:2;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
  }
  dispose():void{this.sky.geometry.dispose();this.sky.material.dispose();this.ocean.geometry.dispose();this.ocean.material.dispose();this.scene.remove(this.sky,this.ocean,this.sun,this.sun.target,this.fill);this.sun.shadow.map?.dispose();}
}
''')

# Weather exposes storm/blend for grading and keeps fog/weather coupled.
replace_once('src/survival/Weather.ts',"return {rain,wind:1+storm*1.5};","return {rain,storm,fog,blend:w.blend,wind:1+storm*1.5};")

# ---------------------------------------------------------------------------
# Environment: tree variety tint, ferns/twigs/dry tufts, decals, seaweed,
# quality scaling and improved shadow policy.
# ---------------------------------------------------------------------------
replace_once('src/rendering/environment.ts',"import {barkTexture,grassTexture,pineTexture,leavesTexture,stoneMaterial,terrainMaterial} from '../world/materials';","import {barkTexture,grassTexture,pineTexture,leavesTexture,stoneMaterial,terrainMaterial,groundDecalTexture} from '../world/materials';")
replace_once('src/rendering/environment.ts',"import {pineGeometry,broadleafGeometry,trunkGeometry,rockGeometry,bushGeometry,grassGeometry,fiberGeometry,berryGeometry} from '../world/models';","import {pineGeometry,broadleafGeometry,trunkGeometry,rockGeometry,bushGeometry,grassGeometry,fiberGeometry,berryGeometry,fernGeometry,twigGeometry,seaweedGeometry} from '../world/models';")
replace_once('src/rendering/environment.ts',"  private readonly grassMaterials:THREE.MeshLambertMaterial[]=[];","  private readonly grassMaterials:THREE.MeshLambertMaterial[]=[];\n  private readonly detailMeshes:{mesh:THREE.InstancedMesh;fullCount:number;minimum:'low'|'medium'|'high'}[]=[];\n  private readonly decalMeshes:THREE.InstancedMesh[]=[];")
replace_once('src/rendering/environment.ts',"  private quality:'low'|'medium'|'high'='high';","  private quality:'low'|'medium'|'high'|'ultra'='high';")
replace_once('src/rendering/environment.ts',"this.populateTrees();this.populateRocks();this.populatePlants();this.populateGrass();this.populateShore();this.setQuality('high');","this.populateTrees();this.populateRocks();this.populatePlants();this.populateUnderstory();this.populateGrass();this.populateShore();this.populateGroundDecals();this.setQuality('high');")
replace_once('src/rendering/environment.ts',"    await stage(48,'Planting ground resources','Adding fiber, berries and shoreline pickups');this.populatePlants();\n    await stage(57,'Seeding windblown grass','Preparing vegetation chunks and distance culling');this.populateGrass();\n    await stage(63,'Finishing the shoreline','Placing coastal detail and natural cover');this.populateShore();","    await stage(47,'Planting ground resources','Adding fiber, berries and shoreline pickups');this.populatePlants();\n    await stage(53,'Layering forest understory','Adding ferns, fallen twigs and dry meadow tufts');this.populateUnderstory();\n    await stage(59,'Seeding windblown grass','Preparing vegetation chunks and distance culling');this.populateGrass();\n    await stage(63,'Finishing the shoreline','Placing pebbles, driftwood and tidal seaweed');this.populateShore();\n    await stage(64,'Painting terrain detail','Scattering low-cost soil, leaf-litter and rock decals');this.populateGroundDecals();")
replace_once('src/rendering/environment.ts',"trunks.setMatrixAt(index,m);crowns.setMatrixAt(index,m);","trunks.setMatrixAt(index,m);crowns.setMatrixAt(index,m);trunks.setColorAt(index,new THREE.Color().setHSL(.08+(rand()-.5)*.018,.18,.78+rand()*.12));")
replace_once('src/rendering/environment.ts',"      });if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;trunks.computeBoundingSphere();crowns.computeBoundingSphere();this.treeBatches.push({trunks,crowns,fullCount:entries.length});","      });if(crowns.instanceColor)crowns.instanceColor.needsUpdate=true;if(trunks.instanceColor)trunks.instanceColor.needsUpdate=true;trunks.computeBoundingSphere();crowns.computeBoundingSphere();this.treeBatches.push({trunks,crowns,fullCount:entries.length});")

understory=r'''  private populateUnderstory():void {
    const rand=randomSource(this.seed+4421),fernG=this.own(fernGeometry()),twigG=this.own(twigGeometry()),tuftG=this.own(grassGeometry());
    const fernM=new THREE.MeshLambertMaterial({color:0x526d40,side:THREE.DoubleSide,roughness:1 as never});delete (fernM as unknown as {roughness?:number}).roughness;
    const tuftTex=grassTexture(991,true),tuftM=new THREE.MeshLambertMaterial({map:tuftTex,color:0xc1b78d,alphaTest:.42,side:THREE.DoubleSide});this.materials.add(fernM);this.materials.add(tuftM);
    const fernPos:{x:number;y:number;z:number;s:number;r:number}[]=[],twigPos:{x:number;y:number;z:number;s:number;r:number}[]=[],tuftPos:{x:number;y:number;z:number;s:number;r:number}[]=[];
    for(let i=0;i<9000&&(fernPos.length<720||twigPos.length<620||tuftPos.length<680);i++){
      const x=(rand()-.5)*550,z=(rand()-.5)*550,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z);if(h<2||h>34||slope>.68||Math.hypot(x-this.spawn.x,z-this.spawn.z)<12)continue;const forest=this.terrain.forestAt(x,z),biome=this.biomeAt(x,z);
      if(fernPos.length<720&&forest>.45&&rand()<.23)fernPos.push({x,y:h,z,s:.35+rand()*.52,r:rand()*6.28});
      if(twigPos.length<620&&forest>.34&&rand()<.18)twigPos.push({x,y:h+.025,z,s:.42+rand()*.85,r:rand()*6.28});
      if(tuftPos.length<680&&biome==='GRASSLAND'&&rand()<.20)tuftPos.push({x,y:h-.01,z,s:.32+rand()*.62,r:rand()*6.28});
    }
    const build=(positions:typeof fernPos,geometry:THREE.BufferGeometry,material:THREE.Material,name:string,minimum:'low'|'medium'|'high')=>{const mesh=new THREE.InstancedMesh(geometry,material,positions.length);mesh.name=name;mesh.receiveShadow=true;positions.forEach((p,i)=>{this.matrixDummy.position.set(p.x,p.y,p.z);this.matrixDummy.rotation.set(0,p.r,0);this.matrixDummy.scale.setScalar(p.s);this.matrixDummy.updateMatrix();mesh.setMatrixAt(i,this.matrixDummy.matrix);if(name.includes('Fern'))mesh.setColorAt(i,new THREE.Color().setHSL(.24+rand()*.045,.28,.52+rand()*.13));});if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();this.root.add(mesh);this.detailMeshes.push({mesh,fullCount:positions.length,minimum});};
    build(fernPos,fernG,fernM,'Forest fern understory','medium');build(twigPos,twigG,this.bark,'Fallen twig litter','medium');build(tuftPos,tuftG,tuftM,'Dry meadow tufts','low');
  }

  private populateGroundDecals():void {
    const rand=randomSource(this.seed+7719),geometry=this.own(new THREE.CircleGeometry(1,14));geometry.rotateX(-Math.PI/2);
    const configs=[['soil',groundDecalTexture(251,'soil'),240],['leaves',groundDecalTexture(617,'leaves'),220],['stone',groundDecalTexture(877,'stone'),150]] as const;
    for(const [kind,tex,count] of configs){const mat=new THREE.MeshStandardMaterial({map:tex,transparent:true,opacity:kind==='stone'?.30:.36,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});this.materials.add(mat);const matrices:THREE.Matrix4[]=[];
      for(let i=0,tries=0;i<count&&tries<count*12;tries++){const x=(rand()-.5)*540,z=(rand()-.5)*540,h=this.heightAt(x,z),slope=this.terrain.slopeAt(x,z),forest=this.terrain.forestAt(x,z);if(h<1.4||h>36||slope>.45)continue;if(kind==='leaves'&&forest<.42)continue;if(kind==='stone'&&h<18&&slope<.28)continue;if(kind==='soil'&&forest>.68)continue;this.matrixDummy.position.set(x,h+.028,z);this.matrixDummy.rotation.set(0,rand()*6.28,0);this.matrixDummy.scale.set(.75+rand()*2.1,1,.45+rand()*1.5);this.matrixDummy.updateMatrix();matrices.push(this.matrixDummy.matrix.clone());i++;}
      const mesh=new THREE.InstancedMesh(geometry,mat,matrices.length);mesh.name=`${kind} ground decals`;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.renderOrder=1;mesh.computeBoundingSphere();this.root.add(mesh);this.decalMeshes.push(mesh);this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'high'});
    }
  }

'''
replace_once('src/rendering/environment.ts',"  private populateShore():void {",understory+"  private populateShore():void {")

new_shore=r'''  private populateShore():void {
    const rand=randomSource(this.seed+29119),stones:THREE.Matrix4[]=[],wood:THREE.Matrix4[]=[],weed:THREE.Matrix4[]=[];
    for(let i=0;i<4200;i++){
      const x=(rand()-.5)*590,z=(rand()-.5)*590,h=this.heightAt(x,z);if(h<.15||h>2.35||this.terrain.noise.at(x*.06,z*.06)<.54)continue;
      const choice=rand();if(choice<.075){const s=.55+rand()*.8;this.matrixDummy.position.set(x,h,z);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();wood.push(this.matrixDummy.matrix.clone());}
      else if(choice<.19){const s=.28+rand()*.55;this.matrixDummy.position.set(x,h-.03,z);this.matrixDummy.rotation.set(0,rand()*6.28,0);this.matrixDummy.scale.set(s,s*(.65+rand()*.6),s);this.matrixDummy.updateMatrix();weed.push(this.matrixDummy.matrix.clone());}
      else{const s=.10+rand()*.32;this.matrixDummy.position.set(x,h-s*.3,z);this.matrixDummy.rotation.set(0,rand()*6.28,(rand()-.5)*.12);this.matrixDummy.scale.setScalar(s);this.matrixDummy.updateMatrix();stones.push(this.matrixDummy.matrix.clone());}
    }
    const log=this.own(new THREE.CylinderGeometry(.055,.10,1.9,7));log.rotateZ(Math.PI/2);const weedG=this.own(seaweedGeometry()),weedM=new THREE.MeshStandardMaterial({color:0x596340,roughness:.92,side:THREE.DoubleSide});this.materials.add(weedM);
    for(const [matrices,geometry,material,name] of [[stones,this.own(rockGeometry(811)),this.stone,'Tide-washed pebbles'],[wood,log,this.bark,'Stranded branches'],[weed,weedG,weedM,'Tidal seaweed']] as const){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.name=name;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.root.add(mesh);if(name==='Tidal seaweed')this.detailMeshes.push({mesh,fullCount:matrices.length,minimum:'medium'});}
  }
'''
regex_once('src/rendering/environment.ts',r"  private populateShore\(\):void \{.*?\n  \}\n(?=  private populateGrass)",new_shore)

replace_once('src/rendering/environment.ts',"const resourceDistance=this.quality==='low'?115:180;","const resourceDistance=this.quality==='low'?115:this.quality==='medium'?165:215;")
new_quality=r'''  setQuality(quality:'low'|'medium'|'high'|'ultra'):void {
    this.quality=quality;this.atmosphere.setQuality(quality);this.grassDistanceUniform.value=quality==='low'?62:quality==='medium'?86:quality==='high'?112:128;
    const fraction=quality==='low'?.30:quality==='medium'?.58:quality==='high'?.82:1;for(const c of this.grassChunks)c.mesh.count=Math.floor(c.fullCount*fraction);
    const rank={low:0,medium:1,high:2,ultra:3} as const;for(const d of this.detailMeshes){const allowed=rank[quality]>=rank[d.minimum],f=quality==='low'?.25:quality==='medium'?.55:quality==='high'?.82:1;d.mesh.count=allowed?Math.floor(d.fullCount*f):0;}
    for(const batch of this.treeBatches){batch.trunks.count=batch.fullCount;batch.crowns.count=batch.fullCount;}
    this.root.traverse(o=>{if(o instanceof THREE.InstancedMesh&&(o.name==='Oak canopy'||o.name==='Pine canopy'))o.castShadow=quality==='high'||quality==='ultra';});this.cullClock=0;
  }
'''
regex_once('src/rendering/environment.ts',r"  setQuality\(quality:'low'\|'medium'\|'high'\):void \{.*?\n  \}\n(?=  syncNodes)",new_quality)

# ---------------------------------------------------------------------------
# GameApp post pipeline hookup, direct ULTRA quality, and warmup of FX shaders.
# ---------------------------------------------------------------------------
replace_once('src/app/GameApp.ts',"import {ImpactFX} from '../rendering/ImpactFX';","import {ImpactFX} from '../rendering/ImpactFX';\nimport {WorldPostFX} from '../rendering/WorldPostFX';")
replace_once('src/app/GameApp.ts',"  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly gatheringFeedback:GatheringFeedback;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();","  readonly ui:UI;readonly input:Input;readonly audio:AudioMixer;readonly held=new HeldItem();readonly impactFx:ImpactFX;readonly gatheringFeedback:GatheringFeedback;readonly postFX:WorldPostFX;readonly torchLight=new THREE.PointLight(0xffd0a0,0,14,2);readonly interactions=new InteractionSystem();")
replace_once('src/app/GameApp.ts',"    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;","    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.postFX=new WorldPostFX(this.renderer,this.scene,this.camera);")
replace_once('src/app/GameApp.ts',"this.camera.quaternion.copy(original).premultiply(turn);this.renderer.render(this.scene,this.camera);","this.camera.quaternion.copy(original).premultiply(turn);this.postFX.render();")
replace_once('src/app/GameApp.ts',"this.renderer.render(this.scene,this.camera);this.ui.setLoadingProgress(97+Math.min(2.4,(i+1)*.1)","this.postFX.render();this.ui.setLoadingProgress(97+Math.min(2.4,(i+1)*.1)")
replace_once('src/app/GameApp.ts',"this.environment.update(dt,hour,this.camera.position);const weather=this.weather.update(running?dt:0,this.simulation.state,this.environment.atmosphere,this.camera.position,this.settings.quality==='ultra'?'high':this.settings.quality);","this.environment.update(dt,hour,this.camera.position);const weather=this.weather.update(running?dt:0,this.simulation.state,this.environment.atmosphere,this.camera.position,this.settings.quality);")
replace_once('src/app/GameApp.ts',"    this.renderer.render(this.scene,this.camera);this.camera.position.set(px,py,pz);this.camera.rotation.set(rx,ry,rz,'YXZ');if(playing)this.held.render(this.renderer);","    this.postFX.update(hour,weather.blend,weather.storm);this.postFX.render();this.camera.position.set(px,py,pz);this.camera.rotation.set(rx,ry,rz,'YXZ');if(playing)this.held.render(this.renderer);")
replace_once('src/app/GameApp.ts',"this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.environment?.setQuality(s.quality==='ultra'?'high':s.quality);this.resize();","this.renderer.setPixelRatio(Math.max(.5,qualityDpr*s.renderScale));this.renderer.shadowMap.enabled=s.shadows&&s.quality!=='low';this.postFX.setQuality(s.quality);this.environment?.setQuality(s.quality);this.resize();")
replace_once('src/app/GameApp.ts',"private resize(){const w=window.innerWidth,h=window.innerHeight;this.projection.resize(w/Math.max(1,h));this.renderer.setSize(w,h,false);this.held.resize(w,h);}","private resize(){const w=window.innerWidth,h=window.innerHeight;this.projection.resize(w/Math.max(1,h));this.renderer.setSize(w,h,false);this.postFX.resize(w,h,this.renderer.getPixelRatio());this.held.resize(w,h);}")
replace_once('src/app/GameApp.ts',"stats:()=>({fps:this.fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles})","stats:()=>({fps:this.fps,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,postFX:this.postFX.diagnostics()})")

# ---------------------------------------------------------------------------
# Visual regression tests that do not require a browser/WebGL context.
# ---------------------------------------------------------------------------
Path('tests/environment-visuals.test.ts').write_text(r'''import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {fernGeometry,twigGeometry,seaweedGeometry} from '../src/world/models';
import {Atmosphere} from '../src/world/atmosphere';

describe('environment visual building blocks',()=>{
  it('builds non-empty low-cost understory and coast geometry',()=>{
    for(const geometry of [fernGeometry(),twigGeometry(),seaweedGeometry()]){expect(geometry.getAttribute('position').count).toBeGreaterThan(20);geometry.dispose();}
  });

  it('exposes upgraded sky/ocean uniforms and scales shadow quality through ultra',()=>{
    const data=new Uint8Array(4*4*4);const height=new THREE.DataTexture(data,4,4,THREE.RGBAFormat);height.needsUpdate=true;const scene=new THREE.Scene(),atmosphere=new Atmosphere(scene,height);
    expect(atmosphere.sky.material.uniforms.weather).toBeTruthy();expect(atmosphere.ocean.material.uniforms.heightMap.value).toBe(height);
    atmosphere.setQuality('ultra');expect(atmosphere.sun.castShadow).toBe(true);expect(atmosphere.sun.shadow.mapSize.x).toBe(3072);
    atmosphere.setQuality('low');expect(atmosphere.sun.castShadow).toBe(false);atmosphere.dispose();height.dispose();
  });
});
''')

# ---------------------------------------------------------------------------
# v0.6 release metadata/docs.
# ---------------------------------------------------------------------------
replace_once('src/config/version.ts',"export const GAME_VERSION='0.5.0';\nexport const GAME_BUILD='EA-05';","export const GAME_VERSION='0.6.0';\nexport const GAME_BUILD='EA-06';")
replace_once('src/config/version.ts',"export const CHANGELOG:ChangeEntry[]=[\n",'''export const CHANGELOG:ChangeEntry[]=[
  {version:'0.6.0',date:'2026-09-11',title:'Environment graphics overhaul',changes:[
    'Expanded terrain material blending with dedicated dirt, wet shoreline sand and stronger close-range procedural surface detail.',
    'Added more tree bark/canopy variation plus instanced ferns, fallen twigs, dry meadow tufts and terrain decals.',
    'Improved procedural rock relief and enriched the shoreline with denser pebbles, driftwood and tidal seaweed.',
    'Reworked ocean shading with multi-scale wave normals, sky reflection, shallows and animated shoreline foam.',
    'Upgraded the sky with layered moving clouds, stronger horizon depth, stars and a moon opposite the sun.',
    'Improved dynamic distance fog and shadow quality, including a higher-resolution Ultra shadow profile.',
    'Added quality-gated screen-space ambient occlusion/contact shading, restrained highlight bloom and color grading on High/Ultra.',
    'Kept Low/Medium on the direct renderer path so the visual upgrade does not force expensive post-processing on slower hardware.'
  ]},
''')
pkg=json.loads(Path('package.json').read_text());pkg['version']='0.6.0';Path('package.json').write_text(json.dumps(pkg,indent=2)+"\n")
lock=json.loads(Path('package-lock.json').read_text());lock['version']='0.6.0';lock['packages']['']['version']='0.6.0';Path('package-lock.json').write_text(json.dumps(lock,indent=2)+"\n")
replace_once('CHANGELOG.md','# Tideland changelog\n','# Tideland changelog\n\n## 0.6.0 — 2026-09-11\n\nEnvironment graphics overhaul.\n\n- Expanded grass/dirt/rock/sand terrain blending with wet shoreline sand and stronger close-range detail.\n- Added tree color variation, ferns, fallen twigs, dry meadow tufts and low-cost ground decals.\n- Improved procedural rock relief and shoreline detail with seaweed, driftwood and pebbles.\n- Reworked water with multi-scale wave normals, reflected sky tones, shallows and animated shoreline foam.\n- Improved distance fog, shadows, layered clouds, moonlight sky detail and night stars.\n- Added High/Ultra SSAO/contact shading, subtle bloom and color grading while keeping Low/Medium on the direct renderer path.\n')
readme=Path('README.md').read_text();readme=readme.replace('version-v0.5.0%20%7C%20EA--05','version-v0.6.0%20%7C%20EA--06',1).replace('**Current release:** `v0.5.0 / EA-05`','**Current release:** `v0.6.0 / EA-06`',1)
readme=readme.replace('**v0.5.x** is focused on tactile gathering, weak spots and resource feedback.','**v0.6.x** is focused on environment rendering, atmosphere and scalable graphics quality.',1)
readme=readme.replace('- ✅ Tool-specific gathering audio and material impact particles','- ✅ Tool-specific gathering audio and material impact particles\n- ✅ Rich terrain blending, understory vegetation, decals and shoreline detail\n- ✅ Improved ocean, layered sky/clouds and distance fog\n- ✅ High/Ultra SSAO, subtle bloom and color grading with Low/Medium performance fallback',1)
if '| `v0.5.0` |' in readme:readme=readme.replace('| `v0.5.0` |','| `v0.6.0` | Environment rendering, water, vegetation, atmosphere and scalable post FX |\n| `v0.5.0` |',1)
else:readme=readme.replace('| Version | Focus |\n| --- | --- |','| Version | Focus |\n| --- | --- |\n| `v0.6.0` | Environment rendering, water, vegetation, atmosphere and scalable post FX |',1)
readme=readme.replace('`EARLY ACCESS DEVELOPMENT · v0.5.0 / EA-05`','`EARLY ACCESS DEVELOPMENT · v0.6.0 / EA-06`')
Path('README.md').write_text(readme)

print('v0.6.0 environment overhaul applied')
