import {smoothstep} from './noise';
import type {ClimateSample} from '../terrain/island';

/** Continuous cover bands shared by terrain colors and decorative vegetation. */
export function surfaceClimate(c:ClimateSample,elevation:number,slope:number){
  const snow=Math.max((1-smoothstep(.28,.49,c.temperature))*smoothstep(14,48,elevation),smoothstep(48,73,elevation))*(1-smoothstep(.42,.82,slope));
  const arid=smoothstep(.48,.69,c.temperature)*(1-smoothstep(.34,.62,c.moisture))*(1-snow);
  const forest=smoothstep(.43,.69,c.moisture)*(1-arid)*(1-snow)*smoothstep(2.5,8,elevation)*(1-smoothstep(38,60,elevation));
  return {arid,snow,forest};
}
export function palmSuitability(c:ClimateSample,elevation:number,biome:string){
  if(biome==='SNOW / ALPINE'||biome==='ROCKY MOUNTAIN')return 0;
  const context=biome==='COAST'?1:biome==='ARID'?.85:.16;
  return smoothstep(.53,.65,c.temperature)*(1-smoothstep(12,26,elevation))*(1-smoothstep(.72,.9,c.moisture))*context;
}
export function vegetationCover(c:ClimateSample,elevation:number,slope:number){
  const w=surfaceClimate(c,elevation,slope);return (.18+.70*w.forest)*(1-w.arid*.72)*(1-w.snow*.87)*(1-smoothstep(.38,.72,slope))*(1-smoothstep(46,65,elevation));
}
