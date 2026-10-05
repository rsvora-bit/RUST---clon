import type {GameState,Language} from '../core/types';
import {ITEMS} from '../items/definitions';
import {itemName} from '../items/localization';
import {RECIPES} from './recipes';
import {ensureTech,TECH_NODES,type TechNodeId,type ResearchResult} from './techTree';
import type {Station} from '../survival/stations';
import './tech-tree.css';

export interface TechTreeActions{research:(id:TechNodeId)=>ResearchResult;close:()=>void}
const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const nodeCs:Record<TechNodeId,{name:string;description:string}>={
  efficiencyTooling:{name:'Zdokonalené nástroje',description:'Vylepšené výrobní postupy pro účinnější těžební nástroje.'},
  fieldEngineering:{name:'Polní inženýrství',description:'Praktické ostrovní postupy pro spolehlivou infrastrukturu a lovecký oštěp.'},
  workbench2Research:{name:'Výzkum pracovního stolu II',description:'Odemkne další úroveň výzkumu a výroby.'},
  fieldMedicine:{name:'Polní medicína',description:'Obvazy, oděv do chladného počasí a filtrační kukla prodlouží výpravy do nehostinných míst.'},
  advancedFabrication:{name:'Pokročilá výroba',description:'Průmyslové postupy ze šrotu umožní pevné vybavení, elektřinu, zbraně i munici.'},
  workbench3Research:{name:'Výzkum pracovního stolu III',description:'Otevře závěrečnou úroveň dílenského výzkumu.'},
  workshopLighting:{name:'Osvětlení dílny',description:'Kompaktní a odolná pracovní světla zpřehlední pokročilé úkryty po setmění.'},
  armoryEngineering:{name:'Zbrojní inženýrství',description:'Odemkne brokovnici na krátkou vzdálenost, těžké kladivo a jejich munici.'},
  industrialArmor:{name:'Průmyslová zbroj',description:'Lomový plátový komplet chrání před projektily a nárazy, ale nehřeje.'},
  advancedMedicine:{name:'Pokročilá polní medicína',description:'Zapečetěné postupy pro traumatickou péči na nebezpečných výpravách.'}
};
const copy=(language:Language,en:string,cs:string)=>language==='cs'?cs:en;

export class TechTreeUI{
  readonly root=document.createElement('section');
  private state:GameState|null=null;
  private station:Station|null=null;
  private actions:TechTreeActions;
  private hash='';

  constructor(container:HTMLElement,actions:TechTreeActions){
    this.actions=actions;this.root.className='tech-tree-overlay';this.root.hidden=true;container.append(this.root);
    this.root.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLElement>('[data-tech-action]');if(!target)return;
      const action=target.dataset.techAction;if(action==='close')this.actions.close();
      if(action==='research'&&target.dataset.techId){const result=this.actions.research(target.dataset.techId as TechNodeId);this.hash='';if(result.ok)this.render();else this.flash(this.reason(result));}
    });
  }
  get isOpen(){return !this.root.hidden;}
  open(station:Station,state:GameState){this.station=station;this.state=state;this.root.hidden=false;this.hash='';this.render();}
  close(){this.root.hidden=true;this.station=null;this.state=null;this.hash='';}
  update(state:GameState){if(!this.isOpen)return;this.state=state;this.render();}

  private reason(result:ResearchResult){
    const cs=document.documentElement.lang==='cs';
    if(result.reason==='resources')return cs?`NEDOSTATEK ŠROTU · POTŘEBA ${result.node?.scrapCost} · U SEBE ${result.remainingScrap??0}`:`NOT ENOUGH SCRAP · ${result.node?.scrapCost} REQUIRED · ${result.remainingScrap??0} CARRIED`;
    if(result.reason==='workbench')return cs?`JE POTŘEBA PRACOVNÍ STŮL ÚROVNĚ ${result.node?.requiredWorkbenchLevel}`:`WORKBENCH LEVEL ${result.node?.requiredWorkbenchLevel} REQUIRED`;
    if(result.reason==='prerequisite')return cs?'CHYBÍ PŘEDCHOZÍ VÝZKUM':'PREREQUISITE LOCKED';
    if(result.reason==='already-unlocked')return cs?'JIŽ ODEMČENO':'ALREADY UNLOCKED';
    return cs?'VÝZKUM NENÍ DOSTUPNÝ':'RESEARCH UNAVAILABLE';
  }
  private flash(message:string){const note=document.createElement('p');note.className='tech-tree-notice';note.textContent=message;this.root.querySelector('.tech-tree-shell')?.prepend(note);window.setTimeout(()=>note.remove(),2600);}

  private render(){
    if(!this.state||!this.station)return;
    const language:Language=document.documentElement.lang==='cs'?'cs':'en';
    const tech=ensureTech(this.state),level=Math.max(1,Number(this.station.kind.slice(-1))||1);
    const scrap=this.state.inventory.reduce((n,x)=>n+(x?.itemId==='scrap'?x.count:0),0);
    const cards=([1,2,3] as const).map(tier=>{
      const tierStatus=tier<=level?copy(language,'AVAILABLE','DOSTUPNÉ'):copy(language,`REQUIRES WORKBENCH ${tier}`,`VYŽADUJE PRACOVNÍ STŮL ${tier}`);
      const nodes=Object.values(TECH_NODES).filter(node=>node.tier===tier).map(node=>{
        const unlocked=tech.unlocked.includes(node.id),prereq=node.prerequisites.every(id=>tech.unlocked.includes(id)),bench=level>=node.requiredWorkbenchLevel,available=!unlocked&&prereq&&bench&&scrap>=node.scrapCost;
        const state=unlocked?'unlocked':!bench?'workbench':!prereq?'prerequisite':scrap<node.scrapCost?'resources':'available';
        const label=unlocked?copy(language,'✓ UNLOCKED','✓ ODEMČENO'):!bench?copy(language,`LOCKED · WORKBENCH ${node.requiredWorkbenchLevel}`,`ZAMČENO · PRACOVNÍ STŮL ${node.requiredWorkbenchLevel}`):!prereq?copy(language,'LOCKED · PREREQUISITE','ZAMČENO · CHYBÍ PŘEDCHOZÍ VÝZKUM'):scrap<node.scrapCost?copy(language,'NOT ENOUGH SCRAP','NEDOSTATEK ŠROTU'):copy(language,'AVAILABLE','DOSTUPNÉ');
        const names=node.unlocksRecipes.map(id=>{const recipe=RECIPES[id];return recipe?itemName(recipe.resultItemId,language):id;}).join(', ');
        const text=language==='cs'?nodeCs[node.id]:null;
        return `<article class="tech-node ${state}"><div class="tech-node-top"><span>${copy(language,`TIER ${node.tier}`,`ÚROVEŇ ${node.tier}`)}</span><b>${node.scrapCost} ${copy(language,'SCRAP','ŠROTU')}</b></div><h3>${esc(text?.name??node.displayName)}</h3><p>${esc(text?.description??node.description)}</p><small>${copy(language,'UNLOCKS','ODEMKNE')} · ${esc(names)}</small><strong>${label}</strong>${available?`<button data-tech-action="research" data-tech-id="${node.id}">${copy(language,'RESEARCH','ZKOUMAT')}</button>`:''}</article>`;
      }).join('');
      return `<section class="tech-tier"><header><span>${copy(language,`TECH TIER ${tier}`,`VÝZKUMNÁ ÚROVEŇ ${tier}`)}</span><b>${tierStatus}</b></header><div class="tech-node-grid">${nodes}</div></section>`;
    }).join('');
    const workbench=copy(language,`Workbench level ${level} · Crafting tier ${level} · Research up to tier ${level}`,`Pracovní stůl úrovně ${level} · Výroba úrovně ${level} · Výzkum do úrovně ${level}`);
    const knowledge=copy(language,'Research knowledge persists with this world.','Výzkum se ukládá společně s tímto světem.');
    this.root.innerHTML=`<div class="tech-tree-shell"><header class="tech-tree-header"><div><span class="eyebrow">TIDELAND / ${copy(language,'WORKBENCH RESEARCH','VÝZKUM NA PRACOVNÍM STOLU')}</span><h2>${copy(language,'TECH TREE','STROM VÝZKUMU')}</h2><p>${workbench} · ${knowledge}</p></div><button data-tech-action="close">${copy(language,'CLOSE · ESC','ZAVŘÍT · ESC')}</button></header><div class="tech-tree-summary"><span>${copy(language,'SCRAP','ŠROT')}</span><b>${scrap}</b><span>${copy(language,'WORKBENCH LEVEL','ÚROVEŇ PRACOVNÍHO STOLU')}</span><b>${level}</b></div>${cards}</div>`;
  }
}
