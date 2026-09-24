import * as THREE from 'three';
import type {Vec3} from '../core/types';
import type {IslandTerrain} from './island';

/** A bounded 12m grid is built once, then shared by the four POI routes. */
export class TerrainRoadRouter {
  private readonly step=12;
  private readonly n:number;
  private readonly heights:Float32Array;
  private readonly cost:Float32Array;
  constructor(private readonly terrain:IslandTerrain){
    this.n=Math.floor(terrain.size/this.step)+1;this.heights=new Float32Array(this.n*this.n);this.cost=new Float32Array(this.heights.length);
    for(let i=0;i<this.heights.length;i++){const p=this.point(i);this.heights[i]=terrain.heightAt(p.x,p.z);}
    for(let i=0;i<this.cost.length;i++){const p=this.point(i),h=this.heights[i]!,s=terrain.slopeAt(p.x,p.z);this.cost[i]=h<1.4||s>1.2?Infinity:1+s*s*45+Math.pow(Math.max(0,h-18)/24,2)*3;}
  }
  private point(i:number):Vec3{return {x:(i%this.n)*this.step-this.terrain.halfSize,y:0,z:Math.floor(i/this.n)*this.step-this.terrain.halfSize};}
  private cell(p:Vec3):number{
    const x=Math.max(0,Math.min(this.n-1,Math.round((p.x+this.terrain.halfSize)/this.step))),z=Math.max(0,Math.min(this.n-1,Math.round((p.z+this.terrain.halfSize)/this.step)));
    let best=-1,distance=Infinity;for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const cx=x+dx,cz=z+dz;if(cx<0||cz<0||cx>=this.n||cz>=this.n)continue;const id=cz*this.n+cx,q=this.point(id),d=Math.hypot(p.x-q.x,p.z-q.z);if(d<distance&&Number.isFinite(this.cost[id])&&this.safe(p,q)){best=id;distance=d;}}
    if(best<0)throw new Error('No dry road endpoint near island POI');return best;
  }
  private safe(a:Vec3,b:Vec3,maxSlope=1.2):boolean{
    const length=Math.hypot(b.x-a.x,b.z-a.z),samples=Math.max(1,Math.ceil(length/2));let previous=this.terrain.heightAt(a.x,a.z);
    for(let i=1;i<=samples;i++){const t=i/samples,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=this.terrain.heightAt(x,z);if(h<1.2||Math.abs(h-previous)/Math.max(.01,length/samples)>maxSlope)return false;previous=h;}return previous>=1.2;
  }
  route(from:Vec3,to:Vec3):Vec3[]{
    const start=this.cell(from),goal=this.cell(to),score=new Float64Array(this.cost.length);score.fill(Infinity);score[start]=0;
    const previous=new Int32Array(score.length);previous.fill(-1);const closed=new Uint8Array(score.length);
    // Binary heap; ties use stable insertion order for seed/generation determinism.
    const heap:{id:number;f:number}[]=[];
    const push=(id:number,f:number)=>{let i=heap.length;heap.push({id,f});while(i){const p=(i-1)>>1;if(heap[p]!.f<=f)break;heap[i]=heap[p]!;i=p;}heap[i]={id,f};};
    const pop=()=>{const first=heap[0]!,last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1]!.f<heap[child]!.f)child++;if(heap[child]!.f>=last.f)break;heap[i]=heap[child]!;i=child;}heap[i]=last;}return first.id;};
    push(start,0);
    while(heap.length){const id=pop();if(closed[id])continue;closed[id]=1;if(id===goal)break;const a=this.point(id),ix=id%this.n,iz=Math.floor(id/this.n);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=ix+dx,z=iz+dz;if(x<0||z<0||x>=this.n||z>=this.n)continue;const next=z*this.n+x;if(closed[next]||!Number.isFinite(this.cost[next]))continue;const b=this.point(next),length=this.step*Math.hypot(dx,dz),grade=Math.abs(this.heights[next]!-this.heights[id]!)/length;if(!this.safe(a,b))continue;const value=score[id]!+length*((this.cost[id]!+this.cost[next]!)*.5+grade*grade*65);if(value>=score[next]!)continue;score[next]=value;previous[next]=id;push(next,value+Math.hypot(b.x-to.x,b.z-to.z));}
    }
    if(previous[goal]===-1)throw new Error('No dry terrain route between island POIs');
    const path:Vec3[]=[];for(let i=goal;i!==-1;i=previous[i]!)path.push(this.point(i));path.reverse();path.unshift({...from});path.push({...to});for(let i=path.length-1;i>0;i--)if(Math.hypot(path[i]!.x-path[i-1]!.x,path[i]!.z-path[i-1]!.z)<.001)path.splice(i,1);
    // Three conservative relaxation passes round grid corners without cutting into water/cliffs.
    for(let pass=0;pass<3;pass++)for(let i=1;i<path.length-1;i++){const a=path[i-1]!,p=path[i]!,b=path[i+1]!,q={x:(a.x+2*p.x+b.x)/4,y:0,z:(a.z+2*p.z+b.z)/4};if(this.safe(a,q,.75)&&this.safe(q,b,.75)&&this.terrain.slopeAt(q.x,q.z)<=Math.max(.55,this.terrain.slopeAt(p.x,p.z)))path[i]=q;}
    const samples:Vec3[]=[];for(let i=0;i<path.length-1;i++){const a=path[i]!,b=path[i+1]!,count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2.5));for(let j=0;j<count;j++){const t=j/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;samples.push({x,y:this.terrain.heightAt(x,z)+.08,z});}}samples.push({x:to.x,y:this.terrain.heightAt(to.x,to.z)+.08,z:to.z});return samples;
  }
}

/** Five vertices across the strip follow hillside relief; edges blend into soil. */
export function roadGeometry(points:Vec3[],terrain:IslandTerrain):THREE.BufferGeometry{
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];let distance=0;
  for(let i=0;i<points.length;i++){const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,width=2.5+(terrain.noise.at(p.x*.037,p.z*.037)-.5)*.65;if(i)distance+=Math.hypot(p.x-a.x,p.z-a.z);
    for(let j=0;j<5;j++){const side=(j/4*2-1)*width,x=p.x-dz/len*side,z=p.z+dx/len*side;positions.push(x,terrain.heightAt(x,z)+.075,z);uv.push(j/4,distance/5);}
    if(i<points.length-1)for(let j=0;j<4;j++){const k=i*5+j;indices.push(k,k+1,k+5,k+1,k+6,k+5);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
