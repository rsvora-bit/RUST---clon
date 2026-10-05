import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {delimiter,join,resolve} from 'node:path';

const candidates=[process.env.BLENDER_BIN,'blender','/Applications/Blender.app/Contents/MacOS/Blender'].filter(Boolean);
const onPath=name=>(process.env.PATH??'').split(delimiter).map(dir=>join(dir,name)).find(existsSync);
let executable=candidates.map(candidate=>candidate==='blender'?onPath(candidate):candidate).find(candidate=>candidate&&existsSync(candidate));
if(!executable){console.error('Blender was not found. Set BLENDER_BIN to its executable path.');process.exit(1);}
const args=['--background','--python',resolve('tools/icon-render/render_icons.py')];
const ids=process.argv.slice(2);
if(ids.length)args.push('--','--ids',...ids);
const result=spawnSync(executable,args,{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
