import {FALL_DAMAGE} from '../config/balance';

/** Pure landing-speed curve shared by runtime, diagnostics and regression tests. */
export function fallDamageForSpeed(speed:number):number {
  if(!Number.isFinite(speed)||speed<=FALL_DAMAGE.DAMAGE_START)return 0;
  const range=FALL_DAMAGE.FATAL_SPEED-FALL_DAMAGE.DAMAGE_START;
  const t=Math.max(0,Math.min(1,(speed-FALL_DAMAGE.DAMAGE_START)/range));
  return Math.min(FALL_DAMAGE.MAX_DAMAGE,Math.round(FALL_DAMAGE.MAX_DAMAGE*Math.pow(t,1.55)));
}
