import {it,expect} from 'vitest';
import {IslandTerrain} from '../../src/terrain/island';
import {generateWorldLayout} from '../../src/survival/WorldSurvival';

const revision6RouteSeeds=[...new Set([...Array.from({length:96},(_,index)=>(Math.imul(index+1,2654435761)>>>0)%1_000_000_000),0,17,81,61417,447701,84172522,123456789,555555555,987654321])];

// Three files keep each seed sweep below Vitest's 60-second worker RPC timeout.
export function registerRevision6CoastRouteCases(shard:number):void{
  const seeds=revision6RouteSeeds.filter((_,index)=>index%3===shard);
  for(const seed of seeds)it(`keeps revision-6 coast POIs routable for seed ${seed}`,()=>{
    const terrain=new IslandTerrain(seed,5,6);
    try{
      const layout=generateWorldLayout(terrain,terrain.spawn,[],seed,6);
      expect(layout.pois.length).toBe(8);
      expect(layout.pois.filter(poi=>poi.kind===5||poi.kind===6).every(poi=>poi.position.y>=1.8)).toBe(true);
      expect(layout.trails).toHaveLength(layout.pois.length);
      expect(layout.trails.every(road=>road.length>20)).toBe(true);
      expect(layout.trails.flat().every(point=>terrain.heightAt(point.x,point.z)>=.95)).toBe(true);
    }finally{terrain.geometry.dispose();terrain.heightTexture.dispose();}
  });
}
