import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {DepthAO} from '../src/rendering/DepthAO';

describe('depth AO render integration',()=>{
  it('reads the current color buffer depth after composer buffers swap',()=>{
    const camera=new THREE.PerspectiveCamera(75,16/9,.075,1700),pass=new DepthAO(camera);
    const a=new THREE.WebGLRenderTarget(16,16,{depthTexture:new THREE.DepthTexture(16,16)}),b=a.clone();
    let destination:THREE.WebGLRenderTarget|null=null;
    const renderer={setRenderTarget:(target:THREE.WebGLRenderTarget)=>destination=target,render:()=>{}} as unknown as THREE.WebGLRenderer;
    try {
      pass.render(renderer,b,a,0,false);
      expect(pass.uniforms.tDepth.value).toBe(a.depthTexture);expect(destination).toBe(b);
      pass.render(renderer,a,b,0,false);
      expect(pass.uniforms.tDepth.value).toBe(b.depthTexture);expect(destination).toBe(a);
      expect(a.depthTexture).not.toBe(b.depthTexture);
    }finally{pass.dispose();a.dispose();b.dispose();}
  });
  it('updates depth reconstruction after FOV and aspect changes without writing depth',()=>{
    const camera=new THREE.PerspectiveCamera(75,16/9,.075,1700),pass=new DepthAO(camera);
    const a=new THREE.WebGLRenderTarget(16,16),b=a.clone();
    const renderer={setRenderTarget:()=>{},render:()=>{}} as unknown as THREE.WebGLRenderer;
    try {
      pass.render(renderer,b,a,0,false);const initial=pass.uniforms.inverseProjection.value.clone();
      camera.fov=60;camera.aspect=4/3;camera.updateProjectionMatrix();pass.setSize(800,600);
      pass.render(renderer,b,a,0,false);
      expect(pass.uniforms.inverseProjection.value.equals(camera.projectionMatrixInverse)).toBe(true);
      expect(pass.uniforms.inverseProjection.value.equals(initial)).toBe(false);
      expect(pass.uniforms.resolution.value.toArray()).toEqual([800,600]);
      expect(pass.material.depthWrite).toBe(false);expect(pass.material.depthTest).toBe(false);
    }finally{pass.dispose();a.dispose();b.dispose();}
  });
});
