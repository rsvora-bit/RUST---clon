import * as THREE from 'three';
import {WORLD} from '../config/balance';
import {Noise,smoothstep} from '../world/noise';

export class IslandTerrain {
  readonly noise:Noise;
  readonly geometry:THREE.PlaneGeometry;
  readonly heights:Float32Array;
  readonly heightTexture:THREE.DataTexture;
  readonly spawn={x:28,y:6.1,z:212};
  private readonly step=WORLD.SIZE/WORLD.RESOLUTION;
  constructor(seed:number,readonly generation:1|2=2){
    this.noise=new Noise(seed);const n=WORLD.RESOLUTION;
    this.geometry=new THREE.PlaneGeometry(WORLD.SIZE,WORLD.SIZE,n,n);this.geometry.rotateX(-Math.PI/2);
    const p=this.geometry.getAttribute('position');this.heights=new Float32Array((n+1)*(n+1));
    const colors=new Float32Array(p.count*3),weights=new Float32Array(p.count*3),texData=new Uint8Array(p.count*4);
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=this.rawHeight(x,z);p.setY(i,h);this.heights[i]=h;const v=Math.round(Math.max(0,Math.min(1,(h+20)/100))*255);texData.set([v,v,v,255],i*4);}
    this.geometry.computeVertexNormals();const normals=this.geometry.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),h=p.getY(i),slope=1-normals.getY(i),n1=this.noise.fbm(x*.09,z*.09,3);
      const rock=Math.max(smoothstep(.13,.43,slope),smoothstep(31,52,h))*.95;
      const sand=(1-smoothstep(1.6,4.8,h))*(1-rock);
      weights.set([sand,rock,1-sand-rock],i*3);
      const variation=.87+n1*.24;colors.set([variation,variation,variation],i*3);
    }
    this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));this.geometry.setAttribute('surfaceWeights',new THREE.BufferAttribute(weights,3));
    this.heightTexture=new THREE.DataTexture(texData,n+1,n+1,THREE.RGBAFormat);this.heightTexture.minFilter=THREE.LinearFilter;this.heightTexture.magFilter=THREE.LinearFilter;this.heightTexture.needsUpdate=true;
    this.spawn.y=this.heightAt(this.spawn.x,this.spawn.z)+2;
  }
  private rawHeight(x:number,z:number):number {
    return this.generation===2?this.geologicalHeight(x,z):this.legacyHeight(x,z);
  }
  private legacyHeight(x:number,z:number):number {
    const n=this.noise;const wx=x+(n.fbm(x*.007,z*.007,3)-.5)*40,wz=z+(n.fbm(x*.007+32,z*.007-11,3)-.5)*35;
    const radius=Math.sqrt(wx*wx+wz*wz*.92);const edge=269+(n.at(x*.009+12,z*.009-20)-.5)*43-radius;
    let h=-10+12*smoothstep(-32,22,edge)+3.5*smoothstep(13,70,edge);
    const broad=n.fbm(x*.008+3,z*.008-2,5);const ridge=Math.pow(1-Math.abs(n.fbm(x*.013-9,z*.013+2,4)*2-1),2);
    const north=smoothstep(140,-120,z);const hills=(Math.pow(broad,1.7)*46+ridge*12)*(0.4+north*.9);
    h+=hills*smoothstep(28,145,edge);
    h+=(n.fbm(x*.08,z*.08,3)-.5)*1.7*smoothstep(4,45,edge);
    // Two naturally broad open meadows support freely placed starter foundations.
    const clearing=1-smoothstep(14,36,Math.hypot(x-28,z-212));h=h*(1-clearing)+4.1*clearing;
    const meadow=1-smoothstep(17,46,Math.hypot(x+54,z-102));h=h*(1-meadow)+11.8*meadow;
    return h;
  }
  /** Broad folded ridges, a sheltered valley and broken coastal shelves.
   * Generation 1 remains byte-for-byte above for existing saves and node IDs. */
  private geologicalHeight(x:number,z:number):number {
    const n=this.noise;
    const wx=x+(n.fbm(x*.005,z*.005,3)-.5)*65;
    const wz=z+(n.fbm(x*.005+37,z*.005-19,3)-.5)*52;
    const angle=Math.atan2(wz,wx),radius=Math.hypot(wx,wz*.96);
    const edge=267+Math.sin(angle*3+.8)*17+Math.sin(angle*7-1.3)*8+(n.at(x*.021,z*.021)-.5)*15-radius;
    let h=-11+13*smoothstep(-34,21,edge)+3*smoothstep(15,75,edge);
    const ridgeAxis=wx*.78+wz*.29+16;
    const spine=Math.exp(-Math.pow(ridgeAxis/65,2))*Math.exp(-Math.pow((wz+65)/165,2));
    const shoulder=Math.exp(-Math.pow((wx-111)/92,2)-Math.pow((wz+53)/112,2));
    const valley=Math.exp(-Math.pow((wx-40)/33,2)-Math.pow((wz-12)/132,2));
    const meso=n.fbm(wx*.017+2,wz*.012-4,3);
    const folded=spine*(43+meso*25)+shoulder*30-valley*14;
    h+=Math.max(0,folded)*smoothstep(24,100,edge);
    h+=(n.fbm(wx*.034,wz*.029,3)-.5)*3.6*smoothstep(10,65,edge);
    const clearing=1-smoothstep(14,36,Math.hypot(x-28,z-212));h=h*(1-clearing)+4.1*clearing;
    const meadow=1-smoothstep(17,46,Math.hypot(x+54,z-102));h=h*(1-meadow)+11.8*meadow;
    const preserveSpawn=1-smoothstep(20,44,Math.hypot(x-28,z-212));
    return h*(1-preserveSpawn)+this.legacyHeight(x,z)*preserveSpawn;
  }
  /** Triangle interpolation is identical to the indexed Rapier ground mesh. */
  heightAt(x:number,z:number):number {
    const n=WORLD.RESOLUTION,u=(x+WORLD.SIZE/2)/this.step,v=(z+WORLD.SIZE/2)/this.step;
    if(u<0||v<0||u>=n||v>=n)return -10;
    const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,i=iz*(n+1)+ix;
    const a=this.heights[i]!,b=this.heights[i+1]!,c=this.heights[i+n+1]!,d=this.heights[i+n+2]!;
    return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
  }
  slopeAt(x:number,z:number):number{return Math.hypot(this.heightAt(x+2,z)-this.heightAt(x-2,z),this.heightAt(x,z+2)-this.heightAt(x,z-2))/4;}
  biomeAt(x:number,z:number):string {const h=this.heightAt(x,z);if(h<3.5)return 'COAST';if(h>29||this.slopeAt(x,z)>.7)return 'ROCKY UPLAND';if(this.forestAt(x,z)>.48)return 'FOREST';return 'GRASSLAND';}
  forestAt(x:number,z:number):number{if(this.generation===2)return (this.noise.fbm(x*.007+8,z*.007+11,3)*.78+this.noise.at(x*.039,z*.039)*.22)*(1-smoothstep(38,57,this.heightAt(x,z)));return this.noise.fbm(x*.018+8,z*.018+11,3)*(1-smoothstep(26,43,this.heightAt(x,z)));}
}
