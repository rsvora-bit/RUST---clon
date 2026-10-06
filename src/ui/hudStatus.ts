export interface EnvironmentalExposure {wetness:number;cold:number;toxic:number}
export type EnvironmentalIndicator = {kind:'wet'|'cold'|'toxic';intensity:number;level:'warning'|'critical'};

/** Keep HUD warnings aligned with the exposure values used by survival damage. */
export function environmentalIndicators(exposure:EnvironmentalExposure):EnvironmentalIndicator[]{
  const indicators:EnvironmentalIndicator[]=[];
  const add=(kind:EnvironmentalIndicator['kind'],value:number,threshold:number)=>{
    if(!Number.isFinite(value)||value<=threshold)return;
    const intensity=Math.max(0,Math.min(1,value));
    indicators.push({kind,intensity,level:intensity>=.7?'critical':'warning'});
  };
  add('wet',exposure.wetness,.2);
  add('cold',exposure.cold,.18);
  add('toxic',exposure.toxic,0);
  return indicators;
}
