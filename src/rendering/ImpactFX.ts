import * as THREE from 'three';
import type {Vec3} from '../core/types';

type Particle={life:number;max:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;color:THREE.Color};

/** Small pooled bursts for gathering and building feedback. */
export class ImpactFX {
  readonly points:THREE.Points;
  private readonly maxParticles=96;
  private readonly particles:Particle[]=[];
  private readonly positions=new Float32Array(this.maxParticles*3);
  private readonly colors=new Float32Array(this.maxParticles*3);
  private readonly sizes=new Float32Array(this.maxParticles);
  private next=0;
  private seed=1;
  private readonly positionAttribute:THREE.BufferAttribute;
  private readonly colorAttribute:THREE.BufferAttribute;
  private readonly sizeAttribute:THREE.BufferAttribute;

  constructor(scene:THREE.Scene){
    const geometry=new THREE.BufferGeometry();
    this.positionAttribute=new THREE.BufferAttribute(this.positions,3);this.colorAttribute=new THREE.BufferAttribute(this.colors,3);this.sizeAttribute=new THREE.BufferAttribute(this.sizes,1);
    geometry.setAttribute('position',this.positionAttribute);geometry.setAttribute('color',this.colorAttribute);geometry.setAttribute('particleSize',this.sizeAttribute);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{pixelRatio:{value:Math.min(devicePixelRatio||1,2)}},vertexShader:`attribute float particleSize;varying vec3 vColor;uniform float pixelRatio;void main(){vColor=color;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_PointSize=particleSize*pixelRatio*(150.0/max(1.0,-mvPosition.z));gl_Position=projectionMatrix*mvPosition;}`,fragmentShader:`varying vec3 vColor;void main(){float d=length(gl_PointCoord-vec2(.5));float a=smoothstep(.5,.12,d);if(a<=.01)discard;gl_FragColor=vec4(vColor,a*.82);}`});
    this.points=new THREE.Points(geometry,material);this.points.name='Gathering impact particles';this.points.frustumCulled=false;scene.add(this.points);
    for(let i=0;i<this.maxParticles;i++){this.particles.push({life:0,max:0,x:0,y:-1000,z:0,vx:0,vy:0,vz:0,size:0,color:new THREE.Color()});this.positions[i*3+1]=-1000;this.sizes[i]=0;}
    this.positionAttribute.needsUpdate=true;this.sizeAttribute.needsUpdate=true;
  }

  private random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}

  burst(position:Vec3,kind:'wood'|'stone'|'metal'|'fiber'|'berries'|'build'='stone'){
    const palette:{[key:string]:number}={wood:0xb88a58,stone:0xc4c1ae,metal:0xc5a47b,fiber:0x9caf63,berries:0xb85155,build:0xd4b276};
    const color=new THREE.Color(palette[kind]??palette.stone);const amount=kind==='build'?14:10;
    for(let i=0;i<amount;i++){
      const index=this.next++%this.maxParticles,p=this.particles[index],angle=this.random()*Math.PI*2,rad=.35+this.random()*.65;
      p.life=p.max=.24+this.random()*.28;p.x=position.x+(this.random()-.5)*.18;p.y=position.y+.35+this.random()*.25;p.z=position.z+(this.random()-.5)*.18;
      p.vx=Math.cos(angle)*rad*1.35;p.vz=Math.sin(angle)*rad*1.35;p.vy=.65+this.random()*1.65;p.size=kind==='build'?.08+this.random()*.055:.045+this.random()*.04;p.color.copy(color).offsetHSL((this.random()-.5)*.04,(this.random()-.5)*.08,(this.random()-.5)*.1);
      this.write(index,p);
    }
    this.positionAttribute.needsUpdate=true;this.colorAttribute.needsUpdate=true;this.sizeAttribute.needsUpdate=true;
  }

  update(dt:number){
    let dirty=false;
    for(let i=0;i<this.particles.length;i++){
      const p=this.particles[i]!;if(p.life<=0)continue;p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=4.8*dt;p.vx*=Math.max(0,1-dt*2.6);p.vz*=Math.max(0,1-dt*2.6);this.write(i,p);dirty=true;
    }
    if(dirty){this.positionAttribute.needsUpdate=true;this.colorAttribute.needsUpdate=true;this.sizeAttribute.needsUpdate=true;}
  }

  private write(index:number,p:Particle){
    const i=index*3,alive=p.life>0;this.positions[i]=alive?p.x:0;this.positions[i+1]=alive?p.y:-1000;this.positions[i+2]=alive?p.z:0;this.colors[i]=p.color.r;this.colors[i+1]=p.color.g;this.colors[i+2]=p.color.b;this.sizes[index]=alive?p.size*(.55+.45*Math.min(1,p.life/.14)):0;
  }

  dispose(){this.points.geometry.dispose();(this.points.material as THREE.Material).dispose();this.points.removeFromParent();}
}
