import {describe,expect,it} from 'vitest';
import {roadGeometry} from '../src/terrain/roads';
import type {IslandTerrain} from '../src/terrain/island';

function middleRoadWidth(generation:number,revision:number,biome:string):number {
  const terrain={generation,revision,noise:{at:()=>.5,fbm:()=>.5},biomeAt:()=>biome,heightAt:()=>0} as unknown as IslandTerrain;
  const geometry=roadGeometry([{x:-1,y:.08,z:0},{x:0,y:.08,z:0},{x:1,y:.08,z:0}],terrain);
  try{
    const positions=geometry.getAttribute('position'),start=5;
    return Math.hypot(positions.getX(start)-positions.getX(start+4),positions.getZ(start)-positions.getZ(start+4));
  }finally{geometry.dispose();}
}

describe('procedural road width by revision and biome',()=>{
  it('narrows exposed revision-6 coastal tracks while preserving legacy and inland widths',()=>{
    expect(middleRoadWidth(5,6,'COAST')).toBeCloseTo(3.9,5);
    expect(middleRoadWidth(5,6,'TEMPERATE GRASSLAND')).toBeCloseTo(4.5,5);
    expect(middleRoadWidth(5,5,'COAST')).toBeCloseTo(5,5);
    expect(middleRoadWidth(4,6,'COAST')).toBeCloseTo(5,5);
  });
});
