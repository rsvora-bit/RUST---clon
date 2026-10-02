import {describe,expect,it} from 'vitest';
import {rockGeometry} from '../src/world/models';

describe('procedural rock geometry',()=>{
  it('keeps each seed deterministic while producing distinct faceted silhouettes',()=>{
    const a=rockGeometry(51),again=rockGeometry(51),b=rockGeometry(114);
    const positions=(geometry:ReturnType<typeof rockGeometry>)=>Array.from(geometry.getAttribute('position').array);
    expect(positions(a)).toEqual(positions(again));
    expect(positions(a)).not.toEqual(positions(b));
    for(const geometry of [a,again,b]){
      const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
      expect(position.count).toBeGreaterThan(20);
      for(let i=0;i<position.count;i++){
        expect(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i))).toBe(true);
        expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,3);
      }
      geometry.dispose();
    }
  });
});
