import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {delimiter,join,resolve} from 'node:path';

const candidates=[process.env.BLENDER_BIN,'blender','/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean);
const onPath=name=>(process.env.PATH??'').split(delimiter).map(dir=>join(dir,name)).find(existsSync);
const executable=candidates.map(candidate=>candidate==='blender'?onPath(candidate):candidate).find(candidate=>candidate&&existsSync(candidate));
if(!executable){console.error('Blender was not found. Set BLENDER_BIN to its executable path.');process.exit(1);}
const result=spawnSync(executable,['--background','--python',resolve('tools/world-assets/export_world_assets.py')],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
