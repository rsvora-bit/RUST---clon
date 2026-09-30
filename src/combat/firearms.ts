import type {ItemId,ItemStack,Vec3} from '../core/types';

export interface FirearmDefinition {itemId:'salvageRevolver';ammoItemId:'pistolAmmo';magazineSize:number;damage:number;fireInterval:number;reloadSeconds:number;range:number;spreadRadians:number;recoil:number;durabilityPerShot:number}
export const FIREARMS:Record<FirearmDefinition['itemId'],FirearmDefinition>={
  salvageRevolver:{itemId:'salvageRevolver',ammoItemId:'pistolAmmo',magazineSize:6,damage:34,fireInterval:.42,reloadSeconds:1.55,range:58,spreadRadians:.006,recoil:.012,durabilityPerShot:1},
};
export const isFirearm=(itemId:ItemId|undefined|null):itemId is FirearmDefinition['itemId']=>!!itemId&&Object.hasOwn(FIREARMS,itemId);
export function loadedRounds(stack:ItemStack,weapon=FIREARMS.salvageRevolver):number{return Math.max(0,Math.min(weapon.magazineSize,Math.floor(stack.loadedAmmo??0)));}
export function firearmShotDirection(forward:Vec3,shotIndex:number,weapon=FIREARMS.salvageRevolver):Vec3{
  const length=Math.hypot(forward.x,forward.y,forward.z);if(length<1e-8||!Number.isFinite(length))return {x:0,y:0,z:-1};
  const f={x:forward.x/length,y:forward.y/length,z:forward.z/length},phase=shotIndex*2.399963229728653,yaw=Math.sin(phase)*weapon.spreadRadians,pitch=Math.cos(phase*.73)*weapon.spreadRadians*.58;
  const x=f.x+Math.cos(Math.atan2(f.x,f.z))*yaw+Math.sin(Math.atan2(f.x,f.z))*pitch*f.y,z=f.z-Math.sin(Math.atan2(f.x,f.z))*yaw+Math.cos(Math.atan2(f.x,f.z))*pitch*f.y,y=f.y+pitch;
  const n=Math.hypot(x,y,z);return {x:x/n,y:y/n,z:z/n};
}
export function roundsToLoad(stack:ItemStack,available:number,weapon=FIREARMS.salvageRevolver):number{return Math.max(0,Math.min(weapon.magazineSize-loadedRounds(stack,weapon),Math.floor(available)));}
export function consumeLoadedRound(stack:ItemStack,weapon=FIREARMS.salvageRevolver):boolean{const loaded=loadedRounds(stack,weapon);if(!loaded)return false;stack.loadedAmmo=loaded-1;return true;}
