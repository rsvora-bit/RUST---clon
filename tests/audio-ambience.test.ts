import {describe,expect,it} from 'vitest';
import {ambientLayerLevels} from '../src/audio/AudioMixer';

describe('biome ambient layers',()=>{
  it('brings surf forward on the coast and keeps a faint distant ocean bed inland',()=>{
    const coast=ambientLayerLevels('COAST'),grassland=ambientLayerLevels('TEMPERATE GRASSLAND');
    expect(coast.ocean).toBeGreaterThan(grassland.ocean*5);
    expect(coast.foliage).toBeLessThan(grassland.foliage);
  });

  it('adds a restrained foliage bed in forests and marshes while keeping arid areas sparse',()=>{
    const forest=ambientLayerLevels('TEMPERATE FOREST'),marsh=ambientLayerLevels('WETLAND / MARSH'),arid=ambientLayerLevels('ARID');
    expect(forest.foliage).toBeGreaterThan(marsh.foliage);
    expect(marsh.foliage).toBeGreaterThan(arid.foliage);
    expect(forest.ocean).toBeGreaterThan(0);
    expect(arid.foliage).toBeGreaterThan(0);
  });
});
