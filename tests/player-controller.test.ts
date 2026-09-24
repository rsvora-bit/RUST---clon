import {describe,expect,it} from 'vitest';
import {PerspectiveCamera} from 'three';
import {PlayerController} from '../src/player/PlayerController';
import {DEFAULT_SETTINGS,PLAYER} from '../src/config/balance';
import type {GameState} from '../src/core/types';
import type {Input} from '../src/input/Input';
import type {PhysicsWorld} from '../src/physics/PhysicsWorld';

function state():GameState{return {version:1,seed:1,elapsed:0,timeOfDay:9,player:{position:{x:0,y:2,z:0},yaw:0,pitch:0,stats:{health:100,hunger:100,thirst:100,stamina:100}},inventory:Array(30).fill(null),activeSlot:0,structures:[],nodeChanges:{},drops:[],craftQueue:[],nextId:1};}

function rig(){
  const pressed=new Set<string>();
  const input={down:(...codes:string[])=>codes.some(code=>pressed.has(code))} as unknown as Input;
  const position={x:0,y:2,z:0};
  const mock={grounded:true,position:()=>({...position}),move:(delta:{x:number;y:number;z:number})=>{position.x+=delta.x;position.z+=delta.z;if(!mock.grounded)position.y+=delta.y;return mock.grounded;},teleport:(p:{x:number;y:number;z:number})=>{Object.assign(position,p);},body:{rotation:()=>({x:0,y:0,z:0,w:1})}};
  const physics=mock as unknown as PhysicsWorld;
  const game=state(),settings={...DEFAULT_SETTINGS,keybinds:{...DEFAULT_SETTINGS.keybinds}};
  const player=new PlayerController(physics,new PerspectiveCamera(),input,settings,game);player.grounded=true;
  return {player,game,pressed,mock,position};
}

describe('first-person movement feel',()=>{
  it('accelerates and decelerates instead of snapping to target speed',()=>{
    const {player,game,pressed}=rig();pressed.add('KeyW');
    player.tick(1/60,game,true);expect(player.speed).toBeGreaterThan(0);expect(player.speed).toBeLessThan(PLAYER.WALK_SPEED*.5);
    for(let i=0;i<120;i++)player.tick(1/60,game,true);expect(player.speed).toBeCloseTo(PLAYER.WALK_SPEED,1);
    const cruising=player.speed;pressed.clear();player.tick(1/60,game,true);expect(player.speed).toBeLessThan(cruising);expect(player.speed).toBeGreaterThan(.1);
    for(let i=0;i<90;i++)player.tick(1/60,game,true);expect(player.speed).toBeLessThan(.05);
  });

  it('auto-runs forward and backward input cancels it',()=>{
    const {player,game,pressed,position}=rig();expect(player.toggleAutoRun()).toBe(true);
    for(let i=0;i<60;i++)player.tick(1/60,game,true);expect(position.z).toBeLessThan(-1);expect(player.autoRun).toBe(true);
    pressed.add('KeyS');player.tick(1/60,game,true);expect(player.autoRun).toBe(false);
  });

  it('blocks sprint while crouched then allows it after standing',()=>{
    const {player,game,pressed}=rig();pressed.add('KeyW');pressed.add('ShiftLeft');pressed.add('ControlLeft');
    for(let i=0;i<45;i++)player.tick(1/60,game,true);expect(player.crouching).toBe(true);expect(player.sprinting).toBe(false);expect(player.speed).toBeLessThanOrEqual(PLAYER.WALK_SPEED);
    pressed.delete('ControlLeft');for(let i=0;i<45;i++)player.tick(1/60,game,true);expect(player.crouching).toBe(false);expect(player.sprinting).toBe(true);expect(player.speed).toBeGreaterThan(PLAYER.WALK_SPEED);
  });

  it('enforces jump cooldown even if contact is restored immediately',()=>{
    const {player,game,mock}=rig();mock.grounded=false;player.jump();player.tick(1/60,game,true);const first=player.cameraDebug().jumpCooldown;expect(first).toBeGreaterThan(.2);
    player.grounded=true;mock.grounded=false;player.jump();player.tick(1/60,game,true);const second=player.cameraDebug().jumpCooldown;expect(second).toBeLessThan(first);expect(second).toBeGreaterThan(0);
  });

  it('emits one landing impact for a real fall but suppresses safe teleports',()=>{
    const {player,game,mock}=rig(),landings:number[]=[];player.onLand=speed=>landings.push(speed);
    player.grounded=false;mock.grounded=true;(player as unknown as {vertical:number;suppressLanding:boolean}).vertical=-20;(player as unknown as {suppressLanding:boolean}).suppressLanding=false;player.tick(1/60,game,true);
    expect(landings).toHaveLength(1);expect(landings[0]).toBeGreaterThan(20);
    player.teleport({x:2,y:20,z:2});mock.grounded=true;(player as unknown as {vertical:number}).vertical=-25;player.tick(1/60,game,true);
    expect(landings).toHaveLength(1);
  });
});
