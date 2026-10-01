import {describe,expect,it} from 'vitest';
import type {WildlifeActor} from '../src/combat/wildlife';
import {createStation} from '../src/survival/stations';
import {homesteadIntrusions} from '../src/survival/security';

function actor(id:string,patch:Partial<WildlifeActor>={}):WildlifeActor{return {id,species:'islandScavenger',state:'investigate',position:{x:1,y:0,z:0},alerted:true,angered:false,...patch} as unknown as WildlifeActor;}

describe('powered Homestead security',()=>{
  it('alarms only for a living alerted scavenger inside a powered claim',()=>{
    const beacon=createStation('core','homesteadCore',{x:0,y:0,z:0});
    expect(homesteadIntrusions([beacon],[actor('inside')])).toEqual([{coreId:'core',actorId:'inside'}]);
    expect(homesteadIntrusions([beacon],[actor('outside',{position:{x:43,y:0,z:0}})])).toEqual([]);
    expect(homesteadIntrusions([beacon],[actor('dead',{state:'dead'})])).toEqual([]);
    expect(homesteadIntrusions([beacon],[actor('quiet',{alerted:false})])).toEqual([]);
    expect(homesteadIntrusions([],[actor('offline')])).toEqual([]);
  });

  it('uses horizontal claim distance and flags angered scavengers even after alert decays',()=>{
    const beacon=createStation('core','homesteadCore',{x:0,y:0,z:0});
    expect(homesteadIntrusions([beacon],[actor('high',{position:{x:42,y:100,z:0},alerted:false,angered:true})])).toHaveLength(1);
  });
});
