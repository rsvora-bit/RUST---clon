import * as THREE from 'three';

// Narrow the exact Three.js triangle raycast to a regular terrain grid rectangle.
// The proxy shares attributes/index buffers but owns its draw range.
export function createTerrainRaycastMesh(source:THREE.PlaneGeometry):THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  geometry.setIndex(source.index);
  geometry.boundingBox=source.boundingBox?.clone()??null;
  geometry.boundingSphere=source.boundingSphere?.clone()??null;
  geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const {width,height}=source.parameters;
  const columns=Math.floor(source.parameters.widthSegments),rows=Math.floor(source.parameters.heightSegments);
  const inverse=new THREE.Matrix4(),from=new THREE.Vector3(),to=new THREE.Vector3();
  const exact=THREE.Mesh.prototype.raycast;
  mesh.raycast=function(raycaster:THREE.Raycaster,hits:THREE.Intersection[]){
    if(!Number.isFinite(raycaster.near)||!Number.isFinite(raycaster.far)||raycaster.far<raycaster.near){exact.call(this,raycaster,hits);return;}
    inverse.copy(this.matrixWorld).invert();
    raycaster.ray.at(raycaster.near,from).applyMatrix4(inverse);
    raycaster.ray.at(raycaster.far,to).applyMatrix4(inverse);
    const minColumn=Math.max(0,Math.floor((Math.min(from.x,to.x)+width/2)*columns/width)-1);
    const maxColumn=Math.min(columns-1,Math.floor((Math.max(from.x,to.x)+width/2)*columns/width)+1);
    const minRow=Math.max(0,Math.floor((Math.min(from.z,to.z)+height/2)*rows/height)-1);
    const maxRow=Math.min(rows-1,Math.floor((Math.max(from.z,to.z)+height/2)*rows/height)+1);
    if(minColumn>maxColumn||minRow>maxRow)return;
    if((maxColumn-minColumn+1)*(maxRow-minRow+1)>columns*rows/2){exact.call(this,raycaster,hits);return;}
    const {start,count}=geometry.drawRange;
    try{
      for(let row=minRow;row<=maxRow;row++){
        const first=Math.max(start,(row*columns+minColumn)*6),last=Math.min(start+count,(row*columns+maxColumn+1)*6);
        if(last<=first)continue;
        geometry.setDrawRange(first,last-first);exact.call(this,raycaster,hits);
      }
    }finally{geometry.setDrawRange(start,count);}
  };
  return mesh;
}
