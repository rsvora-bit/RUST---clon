import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const tag=process.argv[2]||process.env.GITHUB_REF_NAME;
if(!/^v\d+\.\d+\.\d+$/.test(tag||'')) throw new Error(`Invalid release tag: ${tag}`);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=git('show',`${tag}:src/config/version.ts`);
const changelog=git('show',`${tag}:CHANGELOG.md`);
const version=tag.slice(1),build=source.match(/GAME_BUILD='([^']+)'/)?.[1]||'';
const block=changelog.match(new RegExp(`## v${version.replaceAll('.','\\.')}[^\\n]*[\\s\\S]*?(?=\\n## |$)`))?.[0]||'';
const title=block.match(/## [^—]+— ([^\(\n]+)/)?.[1]?.trim()||tag;
const body=`# Tideland ${tag}\n\n## 🎮 Play this release\n\n[▶ PLAY TIDELAND ${tag}](https://rsvora-bit.github.io/RUST---clon/versions/${tag}/)\n\n> This is a preserved playable snapshot of this Tideland release.\n\n## Links\n\n[Play latest version](https://rsvora-bit.github.io/RUST---clon/)\n\n[Version archive](https://rsvora-bit.github.io/RUST---clon/versions/)\n\n## What's new\n\n${block.replace(/^## .*$/m,`**${title}** · ${build}`).trim()}\n`;
fs.writeFileSync(process.env.RELEASE_NOTES_FILE||`release-notes-${tag}.md`,body);
fs.writeFileSync(process.env.RELEASE_TITLE_FILE||'release-title.txt',`Tideland ${tag} / ${build} — ${title}`);
console.log(body);
