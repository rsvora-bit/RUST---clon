import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {DepthAO} from './DepthAO';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
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
  private readonly ssao:DepthAO;
  private readonly antialias:ShaderPass;
  private readonly bloom:UnrealBloomPass;
  private readonly grade:ShaderPass;
  private readonly output:OutputPass;
  private enabled=false;
  private quality:GraphicsQuality='high';
  private userEnabled=true;
  private userSsao=true;
  private userBloom=true;

  constructor(private readonly renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(1,1,THREE.UnsignedIntType)});
    this.composer=new EffectComposer(renderer,target);
    this.renderPass=new RenderPass(scene,camera);this.composer.addPass(this.renderPass);
    this.ssao=new DepthAO(camera);this.composer.addPass(this.ssao);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.15,.38,.94);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass(gradingShader);this.composer.addPass(this.grade);
    this.output=new OutputPass();this.composer.addPass(this.output);
    this.antialias=new ShaderPass(FXAAShader);this.composer.addPass(this.antialias);
    this.setQuality('high');
  }

  private syncPasses():void{
    const qualityAllows=this.quality==='high'||this.quality==='ultra';this.enabled=this.userEnabled&&qualityAllows;this.ssao.enabled=this.enabled&&this.userSsao;this.bloom.enabled=this.enabled&&this.userBloom;this.grade.enabled=this.enabled;this.output.enabled=this.enabled;
  }
  setQuality(q:GraphicsQuality):void{
    this.quality=q;this.ssao.uniforms.strength.value=q==='ultra'?.8:.65;this.bloom.strength=q==='ultra'?.09:.055;this.bloom.radius=q==='ultra'?.46:.34;this.bloom.threshold=q==='ultra'?.91:.95;this.syncPasses();
  }
  setUserSettings(enabled:boolean,ssao:boolean,bloom:boolean):void{this.userEnabled=enabled;this.userSsao=ssao;this.userBloom=bloom;this.syncPasses();}

  update(timeOfDay:number,weatherBlend:number,storm:number):void{
    const night=1-THREE.MathUtils.smoothstep(Math.sin((timeOfDay-6)/24*Math.PI*2),-.16,.28);
    const dusk=Math.max(0,1-Math.abs((((timeOfDay+6)%24)-12)/3));
    this.grade.uniforms.night.value=THREE.MathUtils.clamp(night,0,1);this.grade.uniforms.storm.value=THREE.MathUtils.clamp(Math.max(weatherBlend*.45,storm),0,1);this.grade.uniforms.dusk.value=THREE.MathUtils.clamp(dusk,0,1);
  }

  render():void{if(this.enabled)this.composer.render();else this.renderer.render(this.renderPass.scene,this.renderPass.camera);}
  resize(width:number,height:number,pixelRatio:number):void{this.composer.setPixelRatio(Math.max(.5,pixelRatio));this.composer.setSize(Math.max(1,width),Math.max(1,height));this.antialias.uniforms.resolution.value.set(1/Math.max(1,width*pixelRatio),1/Math.max(1,height*pixelRatio));}
  dispose():void{for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();}
  diagnostics(){return {enabled:this.enabled,quality:this.quality,ssao:this.ssao.enabled,bloom:this.bloom.enabled,bloomStrength:this.bloom.strength,userEnabled:this.userEnabled};}
}
