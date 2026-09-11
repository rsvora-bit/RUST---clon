import * as THREE from 'three';
import {WORLD} from '../config/balance';

export class Atmosphere {
  readonly sky:THREE.Mesh<THREE.SphereGeometry,THREE.ShaderMaterial>;
  readonly ocean:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  readonly sun=new THREE.DirectionalLight(0xfff0ce,3.1);
  readonly fill=new THREE.HemisphereLight(0xbacfe0,0x525944,2.1);
  readonly fog=new THREE.FogExp2(0xb1c6cf,.00145);
  readonly sunDirection=new THREE.Vector3(-.5,.72,.4).normalize();
  private elapsed=0;
  private daylight=1;
  constructor(readonly scene:THREE.Scene,heightTexture:THREE.DataTexture){
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1600,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDir:{value:this.sunDirection},daylight:{value:1},clock:{value:0},weather:{value:0}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
      varying vec3 vDirection;uniform vec3 sunDir;uniform float daylight;uniform float clock;uniform float weather;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){float f=0.;f+=.5*noise(p);p=p*2.03+17.2;f+=.25*noise(p);p=p*2.01-12.7;f+=.125*noise(p);p=p*2.04+8.2;f+=.0625*noise(p);return f;}
      void main(){vec3 d=normalize(vDirection);float altitude=max(d.y,0.);vec3 horizon=mix(vec3(.055,.075,.12),vec3(.50,.67,.75),daylight);vec3 zenith=mix(vec3(.012,.021,.055),vec3(.12,.34,.62),daylight);vec3 col=mix(horizon,zenith,pow(altitude,.45));float alignment=max(0.,dot(d,sunDir));float sunset=(1.-smoothstep(.04,.45,sunDir.y))*smoothstep(-.2,.1,sunDir.y);col+=vec3(.34,.11,.025)*pow(alignment,6.)*sunset;col+=vec3(1.,.83,.57)*pow(alignment,130.)*.32*daylight;col+=vec3(1.,.96,.83)*smoothstep(.9995,.99985,alignment)*daylight*4.;
        vec2 cloudUv=d.xz/max(.11,d.y+.08)*2.6+vec2(clock*.002,clock*.0004);float broad=fbm(cloudUv*.63);float cloud=smoothstep(.53,.72,fbm(cloudUv*1.4)*.53+broad*.52);cloud*=smoothstep(.015,.17,d.y);vec3 cloudColor=mix(vec3(.12,.14,.19),mix(vec3(.72,.77,.78),vec3(.98,.97,.89),smoothstep(.46,.75,broad)),daylight);col=mix(col,cloudColor,min(1.,cloud*.92+weather*.55));
        float stars=step(.9989,hash(floor(d.xz/max(.06,d.y)*560.)))*smoothstep(.05,.4,d.y)*(1.-daylight);col+=stars*.55;gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);
    const oceanGeo=new THREE.PlaneGeometry(2600,2600,160,160);oceanGeo.rotateX(-Math.PI/2);
    this.ocean=new THREE.Mesh(oceanGeo,new THREE.ShaderMaterial({transparent:false,uniforms:{clock:{value:0},weather:{value:0},sunDir:{value:this.sunDirection},cameraPos:{value:new THREE.Vector3()},daylight:{value:1},heightMap:{value:heightTexture},islandSize:{value:WORLD.SIZE},fogColor:{value:this.fog.color}},vertexShader:`uniform float clock;uniform float weather;varying vec3 vWorld;void main(){vec3 p=position;p.y+=sin(p.x*.095+p.z*.043+clock*.55)*.10+sin(p.z*.077-p.x*.023+clock*.38)*.11+sin(p.x*.037-p.z*.12-clock*.46)*.07;p.y+=weather*sin(p.x*.06+p.z*.04+clock)*.18;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`
      uniform float clock;uniform float weather;uniform vec3 sunDir;uniform vec3 cameraPos;uniform float daylight;uniform sampler2D heightMap;uniform float islandSize;uniform vec3 fogColor;varying vec3 vWorld;
      float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),mix(waterHash(i+vec2(0.,1.)),waterHash(i+1.),f.x),f.y);}
      float waves(vec2 p){vec2 drift=vec2(clock*.13,-clock*.19);float swell=waterNoise(p*.16+drift*.4);return waterNoise(p*.72+drift+swell)*.8+waterNoise(mat2(.8,.6,-.6,.8)*p*1.7-drift)*.34+waterNoise(p*4.3+drift*1.3)*.1;}

      void main(){vec2 p=vWorld.xz;float w=waves(p);float ripple=1.-smoothstep(45.,240.,length(cameraPos.xz-p));vec3 n=normalize(vec3((waves(p+vec2(.17,0.))-w)*ripple,1.2,(waves(p+vec2(0.,.17))-w)*ripple));vec3 v=normalize(cameraPos-vWorld);float fres=pow(1.-max(.0,dot(n,v)),3.);vec3 water=mix(vec3(.035,.13,.155),vec3(.23,.36,.43),fres);water*=.24+daylight*.76;float spec=pow(max(0.,dot(reflect(-sunDir,n),v)),110.);water+=vec3(1.,.86,.61)*spec*1.5*daylight;
        vec2 huv=p/islandSize+.5;float terrain=texture2D(heightMap,huv).r*100.-20.;float inBounds=step(0.,huv.x)*step(huv.x,1.)*step(0.,huv.y)*step(huv.y,1.);float foam=(1.-smoothstep(.04,.8,abs(terrain-vWorld.y)))*inBounds;float foamPattern=smoothstep(.79,.98,waves(p*2.7)*.5+.5);water=mix(water,vec3(.13,.23,.22)*(.24+daylight*.76),inBounds*(1.-smoothstep(0.,5.,-terrain))*(1.-fres)*.5);water=mix(water,vec3(.79,.83,.78)*(.3+.7*daylight),foam*foamPattern*.35);float distanceToCamera=length(cameraPos-vWorld);float haze=1.-exp(-distanceToCamera*.0015);water=mix(water,fogColor,haze);gl_FragColor=vec4(water,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')}));
    this.ocean.position.y=-.12;this.ocean.receiveShadow=true;scene.add(this.ocean);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=this.sun.shadow.camera.bottom=-65;this.sun.shadow.camera.right=this.sun.shadow.camera.top=65;this.sun.shadow.camera.near=.5;this.sun.shadow.camera.far=210;this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.07;this.sun.shadow.radius=3;scene.add(this.sun,this.sun.target,this.fill);scene.fog=this.fog;
  }
  update(dt:number,time:number,camera:THREE.Vector3):void {
    this.elapsed+=dt;const hour=time;const a=(hour-6)/24*Math.PI*2;this.sunDirection.set(-Math.cos(a)*.75,Math.sin(a),.42).normalize();this.daylight=THREE.MathUtils.smoothstep(this.sunDirection.y,-.16,.26);
    this.sun.intensity=.06+this.daylight*2.65;this.sun.color.setRGB(1,.73+this.daylight*.2,.56+this.daylight*.3);this.fill.intensity=.34+this.daylight*.94;this.fill.color.setRGB(.5+this.daylight*.2,.6+this.daylight*.2,.82);this.fill.groundColor.setRGB(.15+this.daylight*.15,.17+this.daylight*.17,.16+this.daylight*.13);
    this.fog.color.setRGB(.055+.47*this.daylight,.09+.54*this.daylight,.15+.6*this.daylight);this.fog.density=.0012+(1-this.daylight)*.0017;
    const sx=Math.round(camera.x/2)*2,sz=Math.round(camera.z/2)*2;this.sun.target.position.set(sx,camera.y-5,sz);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection,100);this.sky.position.copy(camera);
    this.sky.material.uniforms.daylight!.value=this.daylight;this.sky.material.uniforms.clock!.value=this.elapsed;this.ocean.material.uniforms.clock!.value=this.elapsed;this.ocean.material.uniforms.daylight!.value=this.daylight;this.ocean.material.uniforms.cameraPos!.value.copy(camera);
  }
  setQuality(q:'low'|'medium'|'high'):void {this.sun.castShadow=q!=='low';const size=q==='high'?2048:1024;if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}}
  dispose():void {this.sky.geometry.dispose();this.sky.material.dispose();this.ocean.geometry.dispose();this.ocean.material.dispose();this.scene.remove(this.sky,this.ocean,this.sun,this.sun.target,this.fill);this.sun.shadow.map?.dispose();}
}
