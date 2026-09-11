import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const outputDir=process.env.TIDELAND_QA_DIR||'artifacts/polish';fs.mkdirSync(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--use-gl=angle','--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[],warnings=[],results=[];
page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());if(m.type()==='error')errors.push(m.text()+' '+JSON.stringify(m.location()))});
const check=(label,value)=>{assert.ok(value,label);results.push(label);console.log('PASS',label)};
const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:`${outputDir}/${name}.png`,timeout:60000})};
try{
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__TIDELAND);await page.getByRole('button',{name:'01 NEW GAME'}).click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');await page.waitForTimeout(800);
check('New Game',await page.evaluate(()=>window.__TIDELAND.snapshot().structures.length===0));
const movement=await page.evaluate(()=>window.__TIDELAND.physics().position);await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');check('W movement',await page.evaluate(p=>Math.hypot(window.__TIDELAND.physics().position.x-p.x,window.__TIDELAND.physics().position.z-p.z)>.5,movement));
await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.up('Shift');results.push('Sprint input exercised');
await page.keyboard.press('Space');await page.waitForTimeout(140);check('Jump leaves ground',await page.evaluate(()=>!window.__TIDELAND.physics().grounded));await page.waitForTimeout(700);
await page.keyboard.down('c');await page.waitForTimeout(300);await page.keyboard.up('c');results.push('Crouch input exercised');
await page.evaluate(()=>{window.__TIDELAND.dev('spawn');window.__TIDELAND.dev('day')});await shot('forest-day');
await page.evaluate(()=>{const a=window.__TIDELAND,n=a.nodes().find(n=>n.kind==='stone'&&n.position.x===24);a.teleport({x:n.position.x,y:n.position.y+.1,z:n.position.z+2.3});a.lookAt({x:n.position.x,y:n.position.y+.55,z:n.position.z})});await page.waitForTimeout(300);const stoneBefore=await page.evaluate(()=>window.__TIDELAND.sim().count('stone'));await page.mouse.click(640,360);await page.waitForTimeout(400);check('LMB gathering delivers resource after impact',await page.evaluate(n=>window.__TIDELAND.sim().count('stone')>n,stoneBefore));await shot('gathering');await page.evaluate(()=>window.__TIDELAND.dev('spawn'));
await page.keyboard.press('Digit2');await page.waitForTimeout(400);await shot('torch-day');
await page.evaluate(()=>window.__TIDELAND.dev('night'));await shot('torch-night');await page.evaluate(()=>window.__TIDELAND.dev('time',17.5));await shot('forest-evening');
await page.evaluate(()=>{const a=window.__TIDELAND;a.dev('day');a.teleport({x:30,y:a.height(30,265)+.1,z:265});a.lookAt({x:20,y:0,z:330})});await page.waitForTimeout(300);await shot('coast');
// Browser simulation transactions supply exact boundary fixtures; UI drags below
// exercise the real DOM handlers. These are explicitly automated, not a human manual pass.
const inventoryResults=await page.evaluate(()=>{
 const g=window.__TIDELAND.sim(),out=[];const ok=(n,v)=>{if(!v)throw Error(n);out.push(n)};
 g.state.inventory=Array(30).fill(null);g.state.craftQueue=[];g.state.drops=[];
 ok('Empty inventory',g.count('wood')===0);ok('Pickup empty slot',g.addItem('wood',990)===0);ok('Compatible stack exactly max',g.addItem('wood',10)===0&&g.state.inventory[0].count===1000);ok('Overflow occupies next slot',g.addItem('wood',1001)===0&&g.state.inventory[1].count===1000&&g.state.inventory[2].count===1);
 g.state.inventory=Array.from({length:30},()=>({itemId:'wood',count:1000}));ok('Full inventory preserves rejected items',g.addItem('stone',17)===17);g.state.inventory[4].count=990;ok('Partial insertion full inventory',g.addItem('wood',25)===15&&g.state.inventory[4].count===1000);
 g.state.inventory=Array(30).fill(null);g.state.inventory[6]={itemId:'wood',count:10};g.moveItem(6,7,true);ok('Even split',g.state.inventory[6].count===5&&g.state.inventory[7].count===5);g.state.inventory[6].count=9;g.moveItem(6,8,true);ok('Odd split',g.state.inventory[6].count===4&&g.state.inventory[8].count===5);g.state.inventory[9]={itemId:'stone',count:1};g.moveItem(9,10,true);ok('Split one conserves item',!g.state.inventory[9]&&g.state.inventory[10].count===1);
 const drop=g.dropItem(8,{x:28,y:4.2,z:211});ok('Drop full stack',drop.stack.count===5&&!g.state.inventory[8]);ok('Pickup dropped stack',g.pickup(drop.id)&&g.state.drops.length===0);
 g.state.inventory=Array.from({length:30},()=>({itemId:'wood',count:1000}));g.state.drops=[{id:'drop-999',stack:{itemId:'stone',count:3},position:{x:28,y:4,z:211}}];ok('World drop survives full pickup',!g.pickup('drop-999')&&g.state.drops[0].stack.count===3);g.state.drops=[];
 g.state.inventory=Array(30).fill(null);g.state.inventory[6]={itemId:'wood',count:9};g.state.inventory[7]={itemId:'wood',count:998};g.state.inventory[8]={itemId:'stone',count:20};g.state.inventory[0]={itemId:'rock',count:1};return out;
});inventoryResults.forEach(x=>check(x,true));
await page.keyboard.press('Tab');await page.waitForTimeout(200);
// Find the visible inventory root without relying on its layout class.
const visibleSlot=n=>page.locator(`[data-slot="${n}"]:visible`).first();
await visibleSlot(6).dragTo(visibleSlot(7));await page.waitForTimeout(150);check('DOM merge capped at stack max',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[7].count===1000&&window.__TIDELAND.snapshot().inventory[6].count===7));
await visibleSlot(6).dragTo(visibleSlot(8));await page.waitForTimeout(150);check('DOM swap unlike items',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[8].itemId==='wood'&&window.__TIDELAND.snapshot().inventory[6].itemId==='stone'));
await visibleSlot(8).dragTo(visibleSlot(2));await page.waitForTimeout(150);check('Inventory to belt',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[2]?.count===7));
await visibleSlot(2).dragTo(visibleSlot(0));await page.waitForTimeout(150);check('Belt occupied swap',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[2]?.itemId==='rock'));
await visibleSlot(0).dragTo(visibleSlot(9));await page.waitForTimeout(150);check('Belt to inventory',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[9]?.count===7));
await page.keyboard.down('Shift');await visibleSlot(9).dragTo(visibleSlot(10));await page.keyboard.up('Shift');await page.waitForTimeout(150);check('DOM Shift split',await page.evaluate(()=>window.__TIDELAND.snapshot().inventory[9]?.count===3&&window.__TIDELAND.snapshot().inventory[10]?.count===4));
await visibleSlot(9).dispatchEvent('dragstart',{dataTransfer:await page.evaluateHandle(()=>new DataTransfer())});await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.evaluate(()=>window.__TIDELAND.sim().addItem('fiber',12));await page.waitForTimeout(200);check('Close inventory during drag clears drag styling',await page.locator('.dragging').count()===0);await shot('inventory-720');await page.locator('[data-recipe="plan"]:visible').click();await page.locator('[data-action="craft"]:visible').click();await page.waitForTimeout(100);check('Craft button queues selected recipe',await page.evaluate(()=>window.__TIDELAND.snapshot().craftQueue.some(j=>j.recipeId==='plan')));
await page.keyboard.press('Escape');check('Pause from inventory',await page.evaluate(()=>window.__TIDELAND.getScreen()==='pause'));await page.keyboard.press('Escape');await page.waitForTimeout(150);
const craftResults=await page.evaluate(()=>{const g=window.__TIDELAND.sim(),out=[];const ok=(n,v)=>{if(!v)throw Error(n);out.push(n)};g.state.inventory=Array(30).fill(null);g.state.craftQueue=[];ok('Insufficient craft atomic',!g.craft('hatchet')&&g.state.craftQueue.length===0);g.addItem('wood',90);g.addItem('stone',60);g.addItem('fiber',10);ok('Exact ingredients',g.craft('hatchet')&&g.count('wood')===0);g.tick(3,false);ok('Exact craft delivered',g.count('hatchet')===1);
g.addItem('fiber',60);ok('Multiple queue',g.craft('bandage')&&g.craft('bandage'));const ix=g.state.inventory.findIndex(x=>x?.itemId==='fiber');g.moveItem(ix,29);g.tick(4,false);ok('Moving ingredients with queue',g.count('bandage')===2&&g.count('fiber')===20);g.craft('bandage');g.state.inventory=Array.from({length:30},()=>({itemId:'wood',count:1000}));g.tick(3,false);ok('Full queue finish retains output',g.state.craftQueue.length===1&&g.state.craftQueue[0].remaining===0);g.state.inventory[3]=null;g.tick(.1,false);ok('Blocked output delivered once',g.count('bandage')===1&&g.state.craftQueue.length===0);
g.state.inventory=Array(30).fill(null);g.addItem('fiber',60);g.craft('bandage');g.craft('bandage');g.tick(.5,false);return out;});craftResults.forEach(x=>check(x,true));
await page.keyboard.press('Tab');await shot('crafting-queue');await page.keyboard.press('Tab');
// Large base: place through the production candidate + simulation + renderer bridge.
const base=await page.evaluate(async()=>{const a=window.__TIDELAND,g=a.sim(),{getSockets}=await import('/src/building/rules.ts');g.state.craftQueue=[];g.state.inventory=Array(30).fill(null);for(const id of ['wood','stone','metal'])g.addItem(id,6000);g.addItem('plan',1);const failures=[];
 const place=(piece,p)=>{const player={x:p.x+4,y:p.y+.1,z:p.z+4};a.teleport(player);g.state.player.position={...player};const result=a.placeAt(piece,p);if(!result.structure)failures.push({piece,p,reason:result.candidate.reason});return result.structure};
 for(let z=0;z<3;z++)for(let x=0;x<3;x++)place('foundation',{x:22+x*3,y:a.height(22+x*3,218+z*3),z:218+z*3});
 const foundations=g.state.structures.filter(s=>s.pieceType==='foundation');let doorway;
 for(const f of foundations)for(const sock of getSockets(f).filter(s=>s.accepts.includes('wall'))){const p=sock.position;if(p.x<21||p.x>29||p.z<217||p.z>225){const door=p.z<217&&p.x===25;const s=place(door?'doorway':'wall',p);if(door)doorway=s;}}
 if(doorway){const d=place('door',doorway.position);if(d)a.toggleDoor(d.id);}
 const woodBefore=g.count('wood');const repeated=place('foundation',foundations[0].position);if(repeated)throw Error('Duplicate foundation accepted');failures.pop();if(g.count('wood')!==woodBefore)throw Error('Rejected placement spent resources');
 const walls=g.state.structures.filter(s=>s.pieceType==='wall'||s.pieceType==='doorway');
 for(const w of walls){const p=getSockets(w).find(s=>s.accepts.includes('floor')).position;if(!g.state.structures.some(s=>s.pieceType==='floor'&&Math.hypot(s.position.x-p.x,s.position.z-p.z)<.1))place('floor',p);}
 const y=g.state.structures.find(s=>s.pieceType==='floor')?.position.y;
 if(y!==undefined&&!g.state.structures.some(s=>s.pieceType==='floor'&&s.position.x===25&&s.position.z===221))place('floor',{x:25,y,z:221});
 const floors=g.state.structures.filter(s=>s.pieceType==='floor');
 for(const f of floors)for(const sock of getSockets(f).filter(s=>s.accepts.includes('wall'))){const p=sock.position;if(p.x<21||p.x>29||p.z<217||p.z>225)place('wall',p);}
 const upper=g.state.structures.filter(s=>s.pieceType==='wall'&&s.position.y>y);
 for(const w of upper){const p=getSockets(w).find(s=>s.accepts.includes('roof')).position;if(!g.state.structures.some(s=>s.pieceType==='roof'&&Math.hypot(s.position.x-p.x,s.position.z-p.z)<.1))place('roof',p);}
 const roofY=g.state.structures.find(s=>s.pieceType==='roof')?.position.y;if(roofY!==undefined)place('roof',{x:25,y:roofY,z:221});
 a.teleport({x:25,y:4.5,z:230});a.lookAt({x:25,y:8,z:221});return {failures,counts:Object.fromEntries(['foundation','wall','doorway','door','floor','roof'].map(p=>[p,g.state.structures.filter(s=>s.pieceType===p).length])),structures:g.state.structures};});
console.log('BASE',JSON.stringify(base.counts),JSON.stringify(base.failures));check('3x3 foundations',base.counts.foundation===9);check('Complete upper floor including center',base.counts.floor===9);check('Two external wall levels',base.counts.wall===23&&base.counts.doorway===1);check('Door and roof',base.counts.door===1&&base.counts.roof===9);check('No failed intended placements',base.failures.length===0);
await shot('base-before-reload');
const before=await page.evaluate(()=>{const a=window.__TIDELAND,g=a.sim();g.state.inventory[0]={itemId:'torch',count:1};g.state.activeSlot=0;g.addItem('fiber',60);g.craft('bandage');g.craft('bandage');a.save();return a.snapshot()});
await page.reload();await page.waitForFunction(()=>window.__TIDELAND);await page.getByRole('button',{name:/02 CONTINUE/}).click();await page.waitForFunction(()=>window.__TIDELAND.getScreen()==='playing');await page.keyboard.press('Escape');const after=await page.evaluate(()=>window.__TIDELAND.snapshot());check('Exact structure transforms/open state after reload',JSON.stringify(before.structures)===JSON.stringify(after.structures));check('Exact inventory arrangement after reload',JSON.stringify(before.inventory)===JSON.stringify(after.inventory));check('Active slot persists',before.activeSlot===after.activeSlot);check('Craft queue survives reload',after.craftQueue.length===before.craftQueue.length&&after.craftQueue.length===2);
await page.keyboard.press('Escape');await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:25,y:4.5,z:230});a.lookAt({x:25,y:8,z:221})});await shot('base-after-reload');
const post=await page.evaluate(async()=>{const a=window.__TIDELAND,g=a.sim(),{getSockets}=await import('/src/building/rules.ts');const d=g.state.structures.find(s=>s.pieceType==='door');a.toggleDoor(d.id);const closed=!d.open;a.toggleDoor(d.id);const f=g.state.structures.find(s=>s.pieceType==='foundation'&&s.position.x===22&&s.position.z===218);const sock=getSockets(f).find(s=>s.id.endsWith('adjacent:3'));const p={x:sock.position.x-3,y:sock.position.y+.1,z:sock.position.z+3};a.teleport(p);g.state.player.position={...p};const extra=a.placeAt('foundation',sock.position);return {closed,open:d.open,added:!!extra.structure}});check('Door toggles after reload',post.closed&&post.open);check('New socket attachment after reload',post.added);
// Real Rapier movement probes: fall onto both levels and walk into an exterior wall.
await page.evaluate(()=>window.__TIDELAND.teleport({x:25,y:6,z:221}));await page.waitForTimeout(1200);const lower=await page.evaluate(()=>window.__TIDELAND.physics());check('Ground floor collider after reload',lower.grounded&&lower.position.y>4.3&&lower.position.y<5);
await page.evaluate(()=>window.__TIDELAND.teleport({x:25,y:8.2,z:221}));await page.waitForTimeout(1000);const upper=await page.evaluate(()=>window.__TIDELAND.physics());check('Upper floor collider after reload',upper.grounded&&upper.position.y>7&&upper.position.y<8);
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:22,y:4.6,z:218});a.lookAt({x:22,y:6,z:210})});await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');check('Wall blocks physical movement after reload',await page.evaluate(()=>window.__TIDELAND.physics().position.z>216.7));
// Every floor tile must support the actual character after persistence.
for(const tile of base.structures.filter(s=>s.pieceType==='foundation'||s.pieceType==='floor')){
  const top=tile.position.y+(tile.pieceType==='foundation'?.48:.16);
  await page.evaluate(({p,top})=>window.__TIDELAND.teleport({x:p.x,y:top+.10,z:p.z}),{p:tile.position,top});await page.waitForTimeout(300);
  const physics=await page.evaluate(()=>window.__TIDELAND.physics());check(`Restored collider ${tile.id}`,physics.grounded&&Math.abs(physics.position.y-top)<.08);
}
await page.evaluate(()=>{const a=window.__TIDELAND,d=a.sim().state.structures.find(s=>s.pieceType==='door');if(d.open)a.toggleDoor(d.id);a.teleport({x:25,y:4.6,z:218});a.lookAt({x:25,y:5.5,z:216.5})});
await page.waitForTimeout(250);await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');check('Closed restored door blocks player',await page.evaluate(()=>window.__TIDELAND.physics().position.z>216.7));
await shot('door-target');await page.keyboard.press('e');await page.waitForTimeout(150);check('E opens restored door',await page.evaluate(()=>window.__TIDELAND.snapshot().structures.find(s=>s.pieceType==='door').open));
await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');check('Open restored door permits passage',await page.evaluate(()=>window.__TIDELAND.physics().position.z<216.3));
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:25,y:4.6,z:221});a.lookAt({x:23,y:5.7,z:218});a.dev('night')});await shot('torch-interior');
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:25,y:7.5,z:221});a.lookAt({x:23,y:8.6,z:218});a.dev('day')});await shot('upper-floor-after-reload');
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:35,y:4.8,z:236});a.lookAt({x:25,y:7.2,z:221})});await shot('base-overview');
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:32,y:4.8,z:226});a.lookAt({x:29,y:6.1,z:223})});await shot('building-close-up');
await page.evaluate(()=>{const a=window.__TIDELAND;a.teleport({x:35,y:4.8,z:236});a.lookAt({x:25,y:7.2,z:221})});
await page.keyboard.press('b');await page.evaluate(()=>window.__TIDELAND.lookAt({x:34,y:4.2,z:233}));await page.waitForTimeout(200);await shot('building-preview');await page.keyboard.press('b');
await page.setViewportSize({width:1920,height:1080});await page.keyboard.press('Tab');await shot('inventory-1080');await page.keyboard.press('Tab');await page.setViewportSize({width:1280,height:720});
await page.keyboard.press('Escape');await page.getByRole('button',{name:/SETTINGS/}).filter({visible:true}).click();
for(const q of ['LOW','MEDIUM','HIGH']){await page.getByRole('button',{name:q,exact:true}).click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.evaluate(()=>{const a=window.__TIDELAND;a.dev('spawn');a.lookAt({x:28,y:6,z:155})});await page.waitForTimeout(900);await shot(`world-${q.toLowerCase()}`);console.log('PRESET',q,await page.evaluate(()=>window.__TIDELAND.stats()));await page.keyboard.press('Escape');await page.getByRole('button',{name:/SETTINGS/}).filter({visible:true}).click();}
await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('F3');await shot('diagnostics');
console.log('CONSOLE ERRORS',errors);check('No application console errors',errors.length===0);
fs.writeFileSync(`${outputDir}/qa-results.json`,JSON.stringify({results,errors,warnings,baseCounts:base.counts,stats:await page.evaluate(()=>window.__TIDELAND.stats())},null,2));
}finally{await browser.close()}
