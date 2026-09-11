import {describe,it,expect} from 'vitest';
import {PerspectiveCamera} from 'three';
import {FirstPersonProjection,horizontalFov,normalizeFov} from '../src/camera/FirstPersonProjection';

describe('first person camera projection',()=>{
 it('maps the menu FOV directly to the Three.js vertical camera FOV',()=>{
  const camera=new PerspectiveCamera(),projection=new FirstPersonProjection(camera);projection.resize(16/9);
  let previousScale=Infinity;
  for(const fov of [60,70,75,80,90,100]){
    projection.setBaseFov(fov);
    expect(camera.fov).toBeCloseTo(fov,9);
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(1/Math.tan(fov*Math.PI/360),9);
    expect(camera.projectionMatrix.elements[5]).toBeLessThan(previousScale);previousScale=camera.projectionMatrix.elements[5];
  }
 });
 it('keeps vertical FOV stable across aspect ratios while horizontal coverage grows',()=>{
  const camera=new PerspectiveCamera(),projection=new FirstPersonProjection(camera);projection.setBaseFov(90);
  const horizontal=[];for(const aspect of [16/10,16/9,2560/1080]){projection.resize(aspect);expect(camera.fov).toBeCloseTo(90,9);horizontal.push(horizontalFov(camera.fov,aspect));}
  expect(horizontal[0]).toBeLessThan(horizontal[1]);expect(horizontal[1]).toBeLessThan(horizontal[2]);
 });
 it('adds a small sprint offset and clamps safely at the configured maximum',()=>{
  const camera=new PerspectiveCamera(),projection=new FirstPersonProjection(camera);projection.setBaseFov(75);
  projection.update(1/60,true);expect(camera.fov).toBeGreaterThan(75);expect(camera.fov).toBeLessThan(77);
  for(let i=0;i<120;i++)projection.update(1/60,true);expect(camera.fov).toBeCloseTo(77,8);
  projection.setBaseFov(100);for(let i=0;i<120;i++)projection.update(1/60,true);expect(camera.fov).toBeCloseTo(100,8);
  for(let i=0;i<120;i++)projection.update(1/60,false);expect(camera.fov).toBeCloseTo(100,8);
  expect(normalizeFov(500)).toBe(100);expect(normalizeFov(-4)).toBe(60);expect(normalizeFov(NaN)).toBe(90);
 });
});
