import * as THREE from 'three';
export function woodMaterial(color:string){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;const c=canvas.getContext('2d')!;
  c.fillStyle='#969183';c.fillRect(0,0,128,512);let n=42;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  for(let i=0;i<1500;i++){const x=rand()*128,y=rand()*512;c.strokeStyle=`rgba(${rand()>.5?'43,42,37':'220,216,199'},${rand()*.22})`;c.lineWidth=rand()*1.4;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+rand()*5,y+18,x-2,y+40,x+rand()*2,y+rand()*160);c.stroke();}
  for(let i=0;i<8;i++){c.strokeStyle='rgba(44,32,20,.27)';c.lineWidth=1;c.beginPath();c.ellipse(rand()*128,rand()*512,2+rand()*4,10+rand()*16,0,0,Math.PI*2);c.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  return new THREE.MeshStandardMaterial({color,map:texture,roughness:.97,bumpMap:texture,bumpScale:.018});
}
export function stoneMaterial(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;let n=356;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  c.fillStyle='#8a887e';c.fillRect(0,0,256,256);
  for(let i=0;i<15000;i++){const v=Math.floor(80+rand()*110);c.fillStyle=`rgba(${v},${v-2},${v-8},${.08+rand()*.18})`;c.fillRect(rand()*256,rand()*256,rand()*9+1,rand()*7+1);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({color:'#b2ad98',map:t,roughness:1,bumpMap:t,bumpScale:.13});
}
