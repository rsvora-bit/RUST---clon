/** Deterministic, allocation-free terrain noise. */
export function randomSource(seed:number):()=>number {let s=seed|0;return ()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function smoothstep(a:number,b:number,x:number):number {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
export class Noise {
  constructor(readonly seed:number){}
  hash(x:number,y:number):number {let h=Math.imul(x,374761393)^Math.imul(y,668265263)^this.seed;h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967295;}
  at(x:number,y:number):number {const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=this.hash(ix,iy),b=this.hash(ix+1,iy),c=this.hash(ix,iy+1),d=this.hash(ix+1,iy+1);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
  fbm(x:number,y:number,octaves=5):number {let result=0,amp=.55,total=0;for(let i=0;i<octaves;i++){result+=this.at(x,y)*amp;total+=amp;x=x*2.03+31.13;y=y*2.01+7.77;amp*=.49;}return result/total;}
}
