import {describe,expect,it} from 'vitest';
import {coldExposureAt,toxicExposureAt,TOXIC_RELAY_RADIUS} from '../src/survival/hazards';

const relay={id:'poi-relay',kind:1,position:{x:80,y:12,z:-40}};

describe('deterministic world hazards',()=>{
  it('derives a finite toxic exposure band only from the Generation 5 relay POI',()=>{
    expect(toxicExposureAt({x:80,y:12,z:-40},[relay],5,3)).toBe(1);
    expect(toxicExposureAt({x:80+TOXIC_RELAY_RADIUS-1,y:12,z:-40},[relay],5,3)).toBeGreaterThan(0);
    expect(toxicExposureAt({x:80+TOXIC_RELAY_RADIUS+1,y:12,z:-40},[relay],5,3)).toBe(0);
    expect(toxicExposureAt({x:80,y:12,z:-40},[relay],4,3)).toBe(0);
    expect(toxicExposureAt({x:80,y:12,z:-40},[relay],5,2)).toBe(0);
    expect(toxicExposureAt({x:80,y:12,z:-40},[{...relay,kind:0}],5,3)).toBe(0);
  });

  it('uses horizontal exposure distance so small terrain height changes do not disable the zone',()=>{
    expect(toxicExposureAt({x:81,y:30,z:-42},[relay],5,3)).toBeCloseTo(toxicExposureAt({x:81,y:0,z:-42},[relay],5,3));
  });

  it('derives alpine exposure from climate, darkness and weather without affecting legacy worlds',()=>{
    const cold={temperature:.18};expect(coldExposureAt(cold,12,'clear',5,3)).toBeGreaterThan(0);
    expect(coldExposureAt(cold,2,'storm',5,3)).toBeGreaterThan(coldExposureAt(cold,12,'clear',5,3));
    expect(coldExposureAt({temperature:.8},12,'clear',5,3)).toBe(0);
    expect(coldExposureAt(cold,2,'storm',4,3)).toBe(0);expect(coldExposureAt(cold,2,'storm',5,2)).toBe(0);
  });
});
