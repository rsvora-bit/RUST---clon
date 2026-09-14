// @ts-nocheck
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

describe('v0.7.6 loot and harvesting interaction fixes',()=>{
  it('keeps a breakup animation path for consumed loot caches',()=>{
    const renderer=readFileSync(new URL('../src/survival/StationRenderer.ts',import.meta.url),'utf8');
    const app=readFileSync(new URL('../src/app/GameApp.ts',import.meta.url),'utf8');
    expect(renderer).toContain('collapseLoot(id:string):boolean');
    expect(renderer).toContain('this.collapsing.set(id');
    expect(renderer).toContain('if(t>=1){this.collapsing.delete(id);this.disposeObject(fx.group);this.objects.delete(id);}');
    expect(app).toContain('consumeEmptyContainer(this.simulation.state,s.id)');
    expect(app).toContain('this.stationRenderer.collapseContainer(s.id)');
  });

  it('keeps hard-resource HP visible and does not bind Interact/E to harvesting',()=>{
    const app=readFileSync(new URL('../src/app/GameApp.ts',import.meta.url),'utf8'),ui=readFileSync(new URL('../src/ui/UI.ts',import.meta.url),'utf8');
    expect(app).toContain("detail:`${Math.ceil(node.remaining)} / ${Math.ceil(node.capacity)} HP`");
    expect(app).toContain("interact:()=>{if(pickup)this.gather(node,true,this.resourceStrike(node,object));}");
    expect(ui).toContain('resource-health-track');expect(ui).toContain('resource-hp');
  });

  it('uses a base-matrix perturbation for resource hit feedback instead of decomposing the tree transform',()=>{
    const environment=readFileSync(new URL('../src/rendering/environment.ts',import.meta.url),'utf8');
    expect(environment).toContain('this.matrixDummy.matrix.copy(ref.matrix).multiply(this.hitRotation)');
    expect(environment).not.toContain('this.matrixDummy.matrix.decompose(this.matrixDummy.position,this.matrixDummy.quaternion,this.matrixDummy.scale);this.matrixDummy.rotation.z=amount');
  });
});
