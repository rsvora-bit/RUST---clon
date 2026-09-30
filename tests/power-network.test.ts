import {describe,expect,it} from 'vitest';
import {createStation,poweredLampIds,stationStatus,tickStation,validateStations,type Station} from '../src/survival/stations';

const station=(id:string,kind:Station['kind'],x:number)=>createStation(id,kind,{x,y:2,z:0});

describe('persistent field power network',()=>{
  it('burns one wood for two game minutes and keeps the running fuel cycle save-valid',()=>{
    const generator=station('generator','generator',0);generator.active=true;generator.inventory[0]={itemId:'wood',count:2};
    tickStation(generator,60);expect(generator.inventory[0]?.count).toBe(1);expect(generator.job).toEqual({recipe:'power',remaining:60});
    expect(validateStations([generator])).toBe(true);tickStation(generator,60);expect(generator.job).toBeNull();expect(generator.inventory[0]?.count).toBe(1);
    tickStation(generator,1);expect(generator.inventory[0]?.count).toBeUndefined();expect(generator.job?.remaining).toBe(119);expect(stationStatus(generator)).toBe('ON');
  });

  it('routes fueled generation through an active nearby switch to lamps and respects range and switch state',()=>{
    const generator=station('generator','generator',0),control=station('switch','powerSwitch',8),lamp=station('lamp','lamp',15),farLamp=station('far-lamp','lamp',40);
    generator.active=true;generator.job={recipe:'power',remaining:80};control.active=true;
    expect([...poweredLampIds([generator,control,lamp,farLamp])]).toEqual(['lamp']);control.active=false;expect(poweredLampIds([generator,control,lamp]).size).toBe(0);
    control.active=true;generator.active=false;expect(poweredLampIds([generator,control,lamp]).size).toBe(0);
  });

  it('accepts old station snapshots and rejects invalid generator fuel or power jobs',()=>{
    const old=createStation('old','storage',{x:0,y:0,z:0}),generator=station('generator','generator',0);expect(validateStations([old,generator])).toBe(true);
    generator.inventory[0]={itemId:'stone',count:1};expect(validateStations([generator])).toBe(false);generator.inventory[0]=null;generator.job={recipe:'power',remaining:120};expect(validateStations([generator])).toBe(true);generator.job={recipe:'metal',remaining:2};expect(validateStations([generator])).toBe(false);
  });
});
