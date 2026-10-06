import {describe,expect,it} from 'vitest';
import {environmentalIndicators} from '../src/ui/hudStatus';

describe('survival HUD exposure indicators',()=>{
  it('does not infer cold from time of day or show clear-air hazards',()=>{
    expect(environmentalIndicators({wetness:0,cold:0,toxic:0})).toEqual([]);
  });
  it('shows measured wetness and cold exposure at the survival warning thresholds',()=>{
    expect(environmentalIndicators({wetness:.4,cold:.3,toxic:0})).toEqual([
      {kind:'wet',intensity:.4,level:'warning'},
      {kind:'cold',intensity:.3,level:'warning'},
    ]);
  });
  it('marks severe and toxic exposure with severity that can be read without color',()=>{
    expect(environmentalIndicators({wetness:.8,cold:.7,toxic:.25})).toEqual([
      {kind:'wet',intensity:.8,level:'critical'},
      {kind:'cold',intensity:.7,level:'critical'},
      {kind:'toxic',intensity:.25,level:'warning'},
    ]);
  });
  it('ignores non-finite values and clamps displayed intensity',()=>{
    expect(environmentalIndicators({wetness:Infinity,cold:NaN,toxic:4})).toEqual([
      {kind:'toxic',intensity:1,level:'critical'},
    ]);
  });
});
