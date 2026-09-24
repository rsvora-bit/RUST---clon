import * as THREE from 'three';
import {WORLD,WORLD_GENERATION_5} from '../config/balance';
import type {WorldGeneration} from '../core/types';
import {Noise,randomSource,smoothstep} from '../world/noise';
import {surfaceClimate} from '../world/climate';

export type TerrainBiome='COAST'|'TEMPERATE FOREST'|'TEMPERATE GRASSLAND'|'ARID'|'SNOW / ALPINE'|'ROCKY MOUNTAIN';
export interface ClimateSample{temperature:number;moisture:number;continentalness:number}
export interface SatelliteIsland{x:number;z:number;radiusX:number;radiusZ:number;height:number}

export class IslandTerrain {
  readonly noise:Noise;
  readonly geometry:THREE.PlaneGeometry;
  readonly heights:Float32Array;
  readonly heightTexture:THREE.DataTexture;
  readonly spawn:{x:number;y:number;z:number};
  readonly size:number;readonly halfSize:number;readonly resolution:number;readonly bounds:{minX:number;maxX:number;minZ:number;maxZ:number};readonly satellites:SatelliteIsland[]=[];
  private readonly step:number;
  constructor(seed:number,readonly generation:WorldGeneration=5){
    this.noise=new Noise(seed);
    this.size=generation===5?WORLD_GENERATION_5.SIZE:WORLD.SIZE;this.resolution=generation===5?WORLD_GENERATION_5.RESOLUTION:WORLD.RESOLUTION;this.halfSize=this.size/2;this.step=this.size/this.resolution;this.bounds={minX:-this.halfSize,maxX:this.halfSize,minZ:-this.halfSize,maxZ:this.halfSize};
    const rand=randomSource(seed+0x31a7);
    if(generation===5){const count=3+Math.floor(rand()*5);for(let i=0;i<count;i++){const a=i/count*Math.PI*2+(rand()-.5)*.32,r=525+rand()*62,base=34+rand()*34;this.satellites.push({x:Math.cos(a)*r,z:Math.sin(a)*r,radiusX:base*(.78+rand()*.48),radiusZ:base*(.72+rand()*.5),height:7+rand()*10});}const angle=2.25+rand()*.34,radius=414+rand()*18;this.spawn={x:Math.cos(angle)*radius,y:6.1,z:Math.sin(angle)*radius};}
    else if(generation>=3){const angle=rand()*Math.PI*2,radius=generation>=4?238+rand()*28:174+rand()*34;this.spawn={x:Math.cos(angle)*radius,y:6.1,z:Math.sin(angle)*radius};}
    else this.spawn={x:28,y:6.1,z:212};
    const n=this.resolution;
    this.geometry=new THREE.PlaneGeometry(this.size,this.size,n,n);this.geometry.rotateX(-Math.PI/2);
    const p=this.geometry.getAttribute('position');this.heights=new Float32Array((n+1)*(n+1));
    const colors=new Float32Array(p.count*3),weights=new Float32Array(p.count*3),climateWeights=new Float32Array(p.count*3),texData=new Uint8Array(p.count*4);
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=this.rawHeight(x,z);p.setY(i,h);this.heights[i]=h;const v=Math.round(Math.max(0,Math.min(1,(h+20)/100))*255);texData.set([v,v,v,255],i*4);}
    this.geometry.computeVertexNormals();const normals=this.geometry.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),h=p.getY(i),slope=1-normals.getY(i),n1=this.noise.fbm(x*.09,z*.09,3);
      const rock=Math.max(smoothstep(.13,.43,slope),smoothstep(this.generation===5?43:31,this.generation===5?70:52,h))*.95;
      const sand=(1-smoothstep(1.6,4.8,h))*(1-rock);
      weights.set([sand,rock,1-sand-rock],i*3);
      const variation=.87+n1*.24;let tr=1,tg=1,tb=1,arid=0,snow=0,forest=0;if(this.generation===5){const c=this.climateAtRaw(x,z,h);({snow,arid,forest}=surfaceClimate(c,h,slope));tr=.95+(.78-.95)*forest;tg=1+(.94-1)*forest;tb=.86+(.72-.86)*forest;tr+=(1.08-tr)*arid;tg+=(.93-tg)*arid;tb+=(.70-tb)*arid;tr+=(1.28-tr)*snow;tg+=(1.30-tg)*snow;tb+=(1.34-tb)*snow;tr+=(.91-tr)*rock;tg+=(.94-tg)*rock;tb+=(.96-tb)*rock;}colors.set([variation*tr,variation*tg,variation*tb],i*3);
      climateWeights.set([arid,snow,forest],i*3);
    }
    this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));this.geometry.setAttribute('surfaceWeights',new THREE.BufferAttribute(weights,3));this.geometry.setAttribute('surfaceClimate',new THREE.BufferAttribute(climateWeights,3));
    this.heightTexture=new THREE.DataTexture(texData,n+1,n+1,THREE.RGBAFormat);this.heightTexture.minFilter=THREE.LinearFilter;this.heightTexture.magFilter=THREE.LinearFilter;this.heightTexture.needsUpdate=true;
    this.spawn.y=this.heightAt(this.spawn.x,this.spawn.z)+2;
  }
  private rawHeight(x:number,z:number):number {
    if(this.generation===1)return this.legacyHeight(x,z);
    const base=this.generation===5?this.generation5Height(x,z):this.generation>=4?this.expandedHeight(x,z):this.geologicalHeight(x,z);
    if(this.generation===2)return base;
    const starter=1-smoothstep(13,35,Math.hypot(x-this.spawn.x,z-this.spawn.z));
    return base*(1-starter)+4.3*starter;
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
  /** Generation 4 spreads elevation across several ridges and uses a warped,
   * lobed coastline so the island reads as a broad landmass rather than a
   * near-perfect circle with one mountain in the middle. */
  private expandedHeight(x:number,z:number):number {
    const n=this.noise;
    const wx=x+(n.fbm(x*.0043+7,z*.0043-13,3)-.5)*84;
    const wz=z+(n.fbm(x*.0043-21,z*.0043+9,3)-.5)*70;
    const angle=Math.atan2(wz,wx),radius=Math.hypot(wx/1.035,wz/.965);
    const coastNoise=(n.fbm(Math.cos(angle)*1.55+31,Math.sin(angle)*1.55-17,3)-.5)*48;
    const edge=319+Math.sin(angle*2+.6)*31+Math.sin(angle*5-1.15)*17+Math.sin(angle*9+.4)*7+coastNoise-radius;
    let h=-12+14.2*smoothstep(-38,22,edge)+3.9*smoothstep(12,96,edge);
    const land=smoothstep(20,112,edge);
    const ridgeWest=Math.exp(-Math.pow((wx*.78+wz*.24+104)/67,2)-Math.pow((wz+55)/178,2));
    const ridgeNorth=Math.exp(-Math.pow((wx-18)/142,2)-Math.pow((wz+178)/62,2));
    const ridgeEast=Math.exp(-Math.pow((wx-151)/74,2)-Math.pow((wz-24)/128,2));
    const southHills=Math.exp(-Math.pow((wx+34)/155,2)-Math.pow((wz-146)/80,2));
    const centralValley=Math.exp(-Math.pow((wx+5)/86,2)-Math.pow((wz+3)/108,2));
    const folded=n.fbm(wx*.013+5,wz*.012-7,4),detail=n.fbm(wx*.031-11,wz*.028+4,3);
    h+=(ridgeWest*(22+folded*18)+ridgeNorth*(18+folded*16)+ridgeEast*(24+detail*14)+southHills*(9+folded*8)-centralValley*8.5)*land;
    h+=(folded-.48)*8.5*land+(detail-.5)*3.2*smoothstep(8,70,edge);
    return h;
  }

  /** Generation 5 combines a warped continental shelf, broad directional lobes,
   * several independent massifs and deterministic satellite islands. */
  private generation5Height(x:number,z:number):number{
    const n=this.noise,wx=x+(n.fbm(x*.0027+17,z*.0027-9,4)-.5)*132,wz=z+(n.fbm(x*.0025-31,z*.0025+22,4)-.5)*112;
    const angle=Math.atan2(wz,wx),radius=Math.hypot(wx/1.08,wz/.94),coast=(n.fbm(Math.cos(angle)*1.8+41,Math.sin(angle)*1.8-27,4)-.5)*76;
    const coastalLobe=(center:number,width:number)=>Math.exp(-Math.pow(Math.atan2(Math.sin(angle-center),Math.cos(angle-center))/width,2));
    let edge=505+Math.sin(angle*2+.5)*48+Math.sin(angle*3-1.1)*31+Math.sin(angle*7+.9)*15+coast-radius;
    // A few broad directional cuts and shelves create readable bays and
    // peninsulas without high-frequency coastline noise or isolated slivers.
    edge+=72*coastalLobe(-.22,.23)+54*coastalLobe(2.72,.31)-82*coastalLobe(1.31,.20)-62*coastalLobe(-2.08,.26);
    let satelliteHeight=-20;
    for(const island of this.satellites){const dx=(x-island.x)/island.radiusX,dz=(z-island.z)/island.radiusZ,d=Math.hypot(dx,dz),islandEdge=(1-d)*Math.min(island.radiusX,island.radiusZ);edge=Math.max(edge,islandEdge);satelliteHeight=Math.max(satelliteHeight,-8+smoothstep(-8,18,islandEdge)*(island.height+3)+(n.fbm(x*.025,z*.025,3)-.5)*2.8);}
    const land=smoothstep(12,96,edge);let h=-13+15.2*smoothstep(-42,24,edge)+4.1*smoothstep(12,110,edge);
    const ridge=(cx:number,cz:number,sx:number,sz:number,rotation:number)=>{const c=Math.cos(rotation),s=Math.sin(rotation),dx=wx-cx,dz=wz-cz,u=(dx*c-dz*s)/sx,v=(dx*s+dz*c)/sz;return Math.exp(-(u*u+v*v));};
    const massifNorth=ridge(-70,-245,215,52,-.28),massifCentral=ridge(55,-35,245,60,.64),massifEast=ridge(285,105,150,50,-.75),massifSouth=ridge(-180,245,130,58,.35);
    const valley=ridge(-40,70,110,245,-.18),basin=ridge(275,220,155,120,.2),fold=n.fbm(wx*.008+7,wz*.008-13,5),detail=n.fbm(wx*.023-5,wz*.021+19,3);
    h+=(massifNorth*(45+fold*31)+massifCentral*(37+fold*27)+massifEast*(34+detail*25)+massifSouth*(24+fold*18)-valley*12-basin*8)*land;
    h+=(fold-.47)*12*land+(detail-.5)*4.2*smoothstep(5,85,edge);
    if(satelliteHeight>-19)h=Math.max(h,satelliteHeight);
    const starter=1-smoothstep(18,48,Math.hypot(x-this.spawn.x,z-this.spawn.z));return h*(1-starter)+4.6*starter;
  }

  /** Triangle interpolation is identical to the indexed Rapier ground mesh. */
  heightAt(x:number,z:number):number {
    const n=this.resolution,u=(x+this.halfSize)/this.step,v=(z+this.halfSize)/this.step;
    if(u<0||v<0||u>=n||v>=n)return -10;
    const ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,i=iz*(n+1)+ix;
    const a=this.heights[i]!,b=this.heights[i+1]!,c=this.heights[i+n+1]!,d=this.heights[i+n+2]!;
    return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
  }
  slopeAt(x:number,z:number):number{return Math.hypot(this.heightAt(x+2,z)-this.heightAt(x-2,z),this.heightAt(x,z+2)-this.heightAt(x,z-2))/4;}
  private climateAtRaw(x:number,z:number,h:number):ClimateSample{const macro=this.noise.fbm(x*.0021+70,z*.0021-33,4),wet=this.noise.fbm(x*.0027-12,z*.0027+57,4);return {temperature:Math.max(0,Math.min(1,.62+z/this.size*.42-h*.006+(macro-.5)*.18)),moisture:Math.max(0,Math.min(1,.54-x/this.size*.20+(wet-.5)*.38)),continentalness:Math.max(0,Math.min(1,(h+5)/45))};}
  climateAt(x:number,z:number):ClimateSample{const h=this.heightAt(x,z);if(this.generation<5)return {temperature:Math.max(0,Math.min(1,.58-h*.004)),moisture:this.forestAt(x,z),continentalness:Math.max(0,Math.min(1,(h+4)/30))};return this.climateAtRaw(x,z,h);}
  private biomeAtRaw(x:number,z:number,h:number,slope:number):TerrainBiome|string{if(this.generation<5){if(h<3.5)return 'COAST';if(h>29||slope>.7)return 'ROCKY UPLAND';if(this.forestAt(x,z)>.48)return 'FOREST';return 'GRASSLAND';}if(h<3.2)return 'COAST';const c=this.climateAtRaw(x,z,h);if(slope>.86||h>67)return 'ROCKY MOUNTAIN';if((c.temperature<.38&&h>18)||h>54)return slope>.72?'ROCKY MOUNTAIN':'SNOW / ALPINE';if(c.temperature>.57&&c.moisture<.50)return 'ARID';if(c.moisture>.55&&h<46)return 'TEMPERATE FOREST';return 'TEMPERATE GRASSLAND';}
  biomeAt(x:number,z:number):TerrainBiome|string {const h=this.heightAt(x,z);return this.biomeAtRaw(x,z,h,this.slopeAt(x,z));}
  forestAt(x:number,z:number):number{if(this.generation===2)return (this.noise.fbm(x*.007+8,z*.007+11,3)*.78+this.noise.at(x*.039,z*.039)*.22)*(1-smoothstep(38,57,this.heightAt(x,z)));if(this.generation>=4)return (this.noise.fbm(x*.011+8,z*.011+11,4)*.82+this.noise.at(x*.031,z*.031)*.18)*(1-smoothstep(34,50,this.heightAt(x,z)));return this.noise.fbm(x*.018+8,z*.018+11,3)*(1-smoothstep(26,43,this.heightAt(x,z)));}
}
