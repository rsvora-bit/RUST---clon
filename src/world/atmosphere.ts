import * as THREE from 'three';
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
