import {smoothstep} from './noise';
import type {ClimateSample} from '../terrain/island';

/** Continuous cover bands shared by terrain colors and decorative vegetation. */
export function surfaceClimate(c:ClimateSample,elevation:number,slope:number,wetlandNoise=0){
  const snow=Math.max((1-smoothstep(.28,.49,c.temperature))*smoothstep(14,48,elevation),smoothstep(48,73,elevation))*(1-smoothstep(.42,.82,slope));
  const arid=smoothstep(.48,.69,c.temperature)*(1-smoothstep(.34,.62,c.moisture))*(1-snow);
  const forest=smoothstep(.43,.69,c.moisture)*(1-arid)*(1-snow)*smoothstep(2.5,8,elevation)*(1-smoothstep(38,60,elevation));
  const marsh=smoothstep(.61,.75,c.moisture)*(1-smoothstep(8,15,elevation))*(1-smoothstep(.28,.58,slope))*smoothstep(.38,.64,wetlandNoise);
  return {arid,snow,forest,marsh};
}
export function palmSuitability(c:ClimateSample,elevation:number,biome:string){
  if(biome==='SNOW / ALPINE'||biome==='ROCKY MOUNTAIN')return 0;
  const context=biome==='COAST'?1:biome==='ARID'?.85:.16;
  return smoothstep(.53,.65,c.temperature)*(1-smoothstep(12,26,elevation))*(1-smoothstep(.72,.9,c.moisture))*context;
}
export function vegetationCover(c:ClimateSample,elevation:number,slope:number,wetlandNoise=0){
  const w=surfaceClimate(c,elevation,slope,wetlandNoise);return (.18+.70*w.forest)*(1-w.arid*.72)*(1-w.snow*.87)*(1-w.marsh*.82)*(1-smoothstep(.38,.72,slope))*(1-smoothstep(46,65,elevation));
}
/** Rev6 grass thins beneath dense canopy so forest floors read as shaded ground, not open meadow. */
export function grassSurfaceCover(c:ClimateSample,elevation:number,slope:number,wetlandNoise=0){
  const w=surfaceClimate(c,elevation,slope,wetlandNoise);return (1-w.forest*.30)*(1-w.arid*.80)*(1-w.snow*.94)*(1-w.marsh*.52);
}
/** Favor shallow, damp lowland basins for temporary rainwater without adding
 * persistent world state or placing puddles on beaches, steep ground, or snow. */
export function rainPuddleSuitability(c:ClimateSample,elevation:number,slope:number,patch:number):number{
  const climate=surfaceClimate(c,elevation,slope);
  return smoothstep(3.35,4.6,elevation)*(1-smoothstep(10.5,14.5,elevation))
    *(1-smoothstep(.035,.15,slope))*smoothstep(.48,.72,c.moisture)
    *(1-climate.arid)*(1-climate.snow)*smoothstep(.36,.62,patch);
}
export function rainPuddleOpacity(wetness:number):number{return smoothstep(.08,.62,wetness)*.70;}
