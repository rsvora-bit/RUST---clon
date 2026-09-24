import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

/** Contact obscurance from the actual color-pass depth. Alpha cutouts, instancing
 * and invisible interaction proxies therefore agree with the visible scene.
 * Must run immediately after RenderPass, before any ping-pong color effects. */
export class DepthAO extends ShaderPass {
  constructor(private readonly camera:THREE.PerspectiveCamera){
    super({
      name:'TidelandDepthAO',
      uniforms:{tDiffuse:{value:null},tDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},resolution:{value:new THREE.Vector2(1,1)},projectionScale:{value:1},strength:{value:.65}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform sampler2D tDiffuse,tDepth;
        uniform mat4 inverseProjection;
        uniform vec2 resolution;
        uniform float projectionScale,strength;
        varying vec2 vUv;
        vec3 viewPosition(vec2 uv,float depth){vec4 p=inverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
        void main(){
          vec4 color=texture2D(tDiffuse,vUv);float depth=texture2D(tDepth,vUv).x;
          vec3 p=viewPosition(vUv,depth);
          vec3 rawNormal=cross(dFdx(p),dFdy(p));
          vec3 normal=rawNormal/max(length(rawNormal),.000001);
          if(depth>=.999999||-p.z>100.){gl_FragColor=color;return;}
          float radius=clamp(.65*projectionScale*resolution.y/max(-p.z,.1),2.,24.);
          float occlusion=0.;
          for(int i=0;i<8;i++){
            float angle=float(i)*2.399963;
            vec2 uv=clamp(vUv+vec2(cos(angle),sin(angle))*radius*(.35+.65*float(i)/7.)/resolution,vec2(0.),vec2(1.));
            float sampleDepth=texture2D(tDepth,uv).x;
            vec3 delta=viewPosition(uv,sampleDepth)-p;
            float distanceToSample=length(delta);
            float horizon=max(0.,dot(normal,delta)/max(distanceToSample,.001)-.12);
            occlusion+=horizon*(1.-smoothstep(.15,1.4,distanceToSample))*step(sampleDepth,.999998);
          }
          float amount=min(.18,occlusion*strength/8.)*(1.-smoothstep(45.,100.,-p.z));
          gl_FragColor=vec4(color.rgb*(1.-amount),color.a);
        }`
    });
    this.material.depthTest=false;this.material.depthWrite=false;
  }
  override setSize(width:number,height:number):void{this.uniforms.resolution.value.set(width,height);}
  override render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget,deltaTime:number,maskActive:boolean):void{
    this.uniforms.tDepth.value=readBuffer.depthTexture;
    this.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
    this.uniforms.projectionScale.value=this.camera.projectionMatrix.elements[5]*.5;
    super.render(renderer,writeBuffer,readBuffer,deltaTime,maskActive);
  }
}
