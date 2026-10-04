import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {InteractionSystem,type Interactable} from '../src/entities/InteractionSystem';

const camera=()=>{const camera=new THREE.PerspectiveCamera(70,1,.1,100);camera.updateMatrixWorld();return camera;};
const entry=(id:string,z:number):Interactable=>{
  const object=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial());object.position.z=z;
  return {id,object,position:()=>object.position,enabled:()=>true,info:()=>({title:id,action:'USE',key:'E'}),interact:vi.fn(),kind:'resource'};
};

describe('interaction targeting',()=>{
  it('selects the nearest visible enabled target and clears hits between candidates and frames',()=>{
    const system=new InteractionSystem(),near=entry('near',-1),far=entry('far',-2),miss=entry('miss',-1.5);miss.object.position.x=2;
    system.register(near);system.register(far);system.register(miss);
    system.update(camera(),3);expect(system.current).toBe(near);
    near.enabled=()=>false;system.update(camera(),3);expect(system.current).toBe(far);
    far.object.visible=false;system.update(camera(),3);expect(system.current).toBeNull();
    far.object.visible=true;system.update(camera(),3);system.trigger();expect(far.interact).toHaveBeenCalledOnce();
  });
  it('retains the horizontal candidate boundary, vertical offsets and ray distance limit',()=>{
    const system=new InteractionSystem(),target=entry('target',-2);
    const raycast=vi.spyOn(target.object,'raycast');
    target.position=()=>({x:6,y:100,z:0});system.register(target);
    system.update(camera(),3);expect(system.current).toBe(target);expect(raycast).toHaveBeenCalledOnce();
    target.position=()=>({x:6.001,y:100,z:0});system.update(camera(),3);expect(raycast).toHaveBeenCalledOnce();expect(system.current).toBeNull();
    target.position=()=>target.object.position;target.object.position.z=-4;system.update(camera(),3);expect(system.current).toBeNull();
  });
  it('keeps occlusion checks independent across frames and stops removed targets from triggering',()=>{
    const system=new InteractionSystem(),target=entry('target',-2),wall=entry('wall',-1).object;wall.updateMatrixWorld();system.register(target);
    system.update(camera(),3,[wall]);expect(system.current).toBeNull();
    system.update(camera(),3,[]);expect(system.current).toBe(target);
    system.remove(target.id);system.trigger();expect(target.interact).not.toHaveBeenCalled();
  });
});
