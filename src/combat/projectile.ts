import type {Vec3} from '../core/types';

export interface ArrowFlight {position:Vec3;velocity:Vec3;age:number}
export interface SegmentHit {hit:boolean;fraction:number;distance:number;point:Vec3}

export function bowStrength(drawSeconds:number):number{return Math.max(0,Math.min(1,drawSeconds/1.15));}
export function arrowLaunchVelocity(forward:Vec3,strength:number):Vec3{
  const length=Math.hypot(forward.x,forward.y,forward.z);if(length<1e-6)return {x:0,y:0,z:0};
  const speed=15+strength*20;return {x:forward.x/length*speed,y:forward.y/length*speed,z:forward.z/length*speed};
}
export function advanceArrow(flight:ArrowFlight,dt:number):{from:Vec3;to:Vec3}{
  const from={...flight.position};flight.velocity.y-=9.81*dt;flight.position.x+=flight.velocity.x*dt;flight.position.y+=flight.velocity.y*dt;flight.position.z+=flight.velocity.z*dt;flight.age+=dt;return {from,to:{...flight.position}};
}
/** Segment-sphere sweep prevents fast arrows tunneling through small targets. */
export function segmentSphereHit(from:Vec3,to:Vec3,center:Vec3,radius:number):SegmentHit{
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,lengthSq=dx*dx+dy*dy+dz*dz;
  if(![from.x,from.y,from.z,to.x,to.y,to.z,center.x,center.y,center.z,radius].every(Number.isFinite)||radius<0||lengthSq<1e-12)return {hit:false,fraction:0,distance:Math.sqrt(lengthSq),point:{...from}};
  const t=Math.max(0,Math.min(1,((center.x-from.x)*dx+(center.y-from.y)*dy+(center.z-from.z)*dz)/lengthSq));
  const point={x:from.x+dx*t,y:from.y+dy*t,z:from.z+dz*t},distance=Math.hypot(point.x-center.x,point.y-center.y,point.z-center.z);
  return {hit:distance<=radius,fraction:t,distance,point};
}
