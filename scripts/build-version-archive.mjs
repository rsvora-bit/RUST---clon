import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const output=path.resolve(process.argv[2]||'site');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const npmPrefix=process.env.TIDELAND_NPM_PREFIX?JSON.parse(process.env.TIDELAND_NPM_PREFIX):[];
const run=(file,args,cwd=root)=>execFileSync(file,args,{cwd,stdio:'inherit',encoding:'utf8',shell:process.platform==='win32'});
const capture=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const validTag=/^v\d+\.\d+\.\d+$/;
const tags=capture(['tag','--list','v*']).split(/\r?\n/).filter(t=>validTag.test(t));
const versionKey=t=>t.slice(1).split('.').map(Number);
tags.sort((a,b)=>{const av=versionKey(a),bv=versionKey(b);for(let i=0;i<3;i++)if(av[i]!==bv[i])return bv[i]-av[i];return b.localeCompare(a);});
if(!tags.length) throw new Error('No immutable release tags matching vX.Y.Z were found.');

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(path.join(output,'versions'),{recursive:true});
const copyTree=(from,to)=>{fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){const src=path.join(from,entry.name),dst=path.join(to,entry.name);if(entry.isDirectory())copyTree(src,dst);else fs.copyFileSync(src,dst);}};
const readTagSource=(tag,file)=>{try{return capture(['show',`${tag}:${file}`]);}catch{return '';}};
const metadata=tag=>{
  const source=readTagSource(tag,'src/config/version.ts');
  const changelog=readTagSource(tag,'CHANGELOG.md');
  const build=source.match(/GAME_BUILD='([^']+)'/)?.[1]||'';
  const entry=changelog.match(new RegExp(`## v${tag.slice(1).replaceAll('.','\\.')}[^\\n]*?\\((\\d{4}-\\d{2}-\\d{2})\\)[\\s\\S]*?(?=\\n## |$)`));
  const title=entry?.[0]?.match(/## [^—]+— ([^\(\n]+)/)?.[1]?.trim()||tag;
  const date=entry?.[1]||capture(['show','-s','--format=%cs',tag]);
  const changes=(entry?.[0]||'').split(/\r?\n/).filter(line=>line.startsWith('- ')).map(line=>line.slice(2).trim());
  return {tag,version:tag.slice(1),build,date,title,changes,commit:capture(['rev-list','-1',tag])};
};
const releases=tags.map(metadata);

const shim=tag=>`<script>(function(){const p='tideland-archive:${tag}:';const s=window.localStorage;const proto=Storage.prototype;const g=proto.getItem,set=proto.setItem,rm=proto.removeItem;proto.getItem=function(k){return this===s?g.call(this,p+k):g.call(this,k)};proto.setItem=function(k,v){return this===s?set.call(this,p+k,v):set.call(this,k,v)};proto.removeItem=function(k){return this===s?rm.call(this,p+k):rm.call(this,k)};})();</script>`;
const injectArchiveShim=file=>{let html=fs.readFileSync(file,'utf8');const marker=html.indexOf('<script type="module"');if(marker<0)throw new Error(`Unable to locate module script in ${file}`);const tag=path.basename(path.dirname(file));html=html.slice(0,marker)+shim(tag)+html.slice(marker);fs.writeFileSync(file,html);};

copyTree(path.join(root,'dist'),output);
for(const release of releases){
  const worktree=fs.mkdtempSync(path.join(os.tmpdir(),`tideland-${release.tag}-`));
  try{
    run('git',['worktree','add','--detach',worktree,release.tag]);
    run(process.env.TIDELAND_NPM||npm,[...npmPrefix,'ci'],worktree);
    run(process.env.TIDELAND_NPM||npm,[...npmPrefix,'run','build'],worktree);
    const target=path.join(output,'versions',release.tag);
    copyTree(path.join(worktree,'dist'),target);
    injectArchiveShim(path.join(target,'index.html'));
  }catch(error){throw new Error(`Failed to build archived release ${release.tag}: ${error.message}`);}
  finally{try{run('git',['worktree','remove','--force',worktree]);}catch{}fs.rmSync(worktree,{recursive:true,force:true});}
}

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=releases.map((r,i)=>`<article class="release-card${i===0?' latest':''}"><div class="release-meta"><span>${esc(r.tag)}</span><b>${esc(r.build||'RELEASE')}</b>${i===0?'<em>LATEST</em>':''}</div><h2>${esc(r.title)}</h2><time datetime="${esc(r.date)}">${new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</time><p>${esc(r.changes[0]||'Preserved playable Tideland release snapshot.')}</p><a href="./${r.tag}/">PLAY VERSION <span>↗</span></a></article>`).join('');
const archive=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TIDELAND · VERSION ARCHIVE</title><style>:root{color-scheme:dark;font-family:Arial,sans-serif;background:#101715;color:#eee}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 0,#27443b,#101715 48%)}main{max-width:980px;margin:auto;padding:64px 24px}.eyebrow{letter-spacing:.2em;color:#b9d4a8;font-size:12px}.brand{font-weight:700;letter-spacing:.18em;color:#d8e6c4}.hero h1{font-size:clamp(42px,8vw,82px);line-height:.9;margin:18px 0 12px;letter-spacing:-.04em}.hero p{color:#aab7ac;font-size:18px;margin:0 0 40px}.links{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:44px}.links a,.release-card a{color:#d9e8b3;text-decoration:none;border:1px solid #698269;padding:10px 14px;font-weight:700;letter-spacing:.08em;font-size:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px}.release-card{border:1px solid #34463d;background:#17231f;padding:22px;box-shadow:0 10px 30px #07100dcc}.release-card.latest{border-color:#b9d4a8}.release-meta{display:flex;gap:10px;align-items:center;color:#d9e8b3}.release-meta b{font-size:12px;color:#9bb0a0}.release-meta em{margin-left:auto;color:#18221d;background:#b9d4a8;font-style:normal;font-size:11px;padding:5px 7px}.release-card h2{font-size:22px;margin:18px 0 6px}.release-card time{color:#82958a;font-size:13px}.release-card p{min-height:52px;color:#b6c2b7;line-height:1.5}.release-card a{display:inline-block;margin-top:10px}</style></head><body><main><div class="brand">TIDELAND</div><section class="hero"><div class="eyebrow">PRESERVED PLAYABLE SNAPSHOTS</div><h1>VERSION ARCHIVE</h1><p>Play preserved snapshots of previous Tideland releases.</p></section><nav class="links"><a href="../">PLAY LATEST</a><a href="https://github.com/rsvora-bit/RUST---clon/releases">GITHUB RELEASES</a></nav><section class="grid">${cards}</section></main></body></html>`;
fs.writeFileSync(path.join(output,'versions','index.html'),archive.replace('<title>TIDELAND · VERSION ARCHIVE</title>','<link rel="icon" href="../favicon.svg"><title>TIDELAND · VERSION ARCHIVE</title>'));
console.log(`Built latest plus ${releases.length} archived releases in ${output}`);
