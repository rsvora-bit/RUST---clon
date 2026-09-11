import {describe,expect,it} from 'vitest';
import {MouseLookFilter} from '../src/input/MouseLookFilter';

describe('MouseLookFilter',()=>{
  it('normalizes high-DPI pointer deltas',()=>{const f=new MouseLookFilter();f.add(20,-10,2);expect(f.consume()).toEqual({x:10,y:-5});});
  it('coalesces multiple events and clears after consume',()=>{const f=new MouseLookFilter();f.add(4,3);f.add(6,2);expect(f.consume()).toEqual({x:10,y:5});expect(f.consume()).toEqual({x:0,y:0});});
  it('caps a stalled event burst while preserving direction',()=>{const f=new MouseLookFilter(180);f.add(3000,4000);const d=f.consume();expect(Math.hypot(d.x,d.y)).toBeCloseTo(180,6);expect(d.x/d.y).toBeCloseTo(3/4,6);});
  it('ignores non-finite browser deltas',()=>{const f=new MouseLookFilter();f.add(Number.NaN,4);expect(f.consume()).toEqual({x:0,y:0});});
});
