import * as THREE from 'three';
/** Original procedural fire: rising noise erodes a tapered plume, with a warm core. */
export function flameMaterial(){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
  varying vec2 vUv;uniform float time;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
  void main(){float y=vUv.y;float n=noise(vec2(vUv.x*7.,y*5.-time*2.1));float fine=noise(vec2(vUv.x*17.+time*.25,y*11.-time*3.7));float bend=(noise(vec2(y*3.,time*.7))-.5)*y*.35;
    float x=abs(vUv.x-.5+bend);float width=.29*pow(max(0.,1.-y),.65);float plume=width-x+(n-.5)*(.05+y*.18)+(fine-.5)*.05;
    float tongues=.5+.5*sin(vUv.x*29.+n*5.+y*9.-time*1.3);plume-=smoothstep(.28,.8,y)*tongues*.085;
    float alpha=smoothstep(-.015,.055,plume)*smoothstep(0.,.10,y)*(1.-smoothstep(.80,1.,y));
    float core=smoothstep(.025,.16,plume)*(1.-smoothstep(.18,.68,y));
    vec3 col=mix(vec3(1.,.15,.015),vec3(1.,.43,.035),smoothstep(-.01,.1,plume));col=mix(col,vec3(1.,.83,.38),core*core);
    gl_FragColor=vec4(col*.94,alpha*.67);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});
}
