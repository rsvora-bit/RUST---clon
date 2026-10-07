// @ts-nocheck — Node built-in filesystem typings are not part of this browser-only project.
import {readFileSync,existsSync,statSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {ITEMS} from '../src/items/definitions';
import {itemDescription,itemName} from '../src/items/localization';

const catalog=JSON.parse(readFileSync(new URL('../tools/icon-render/catalog.json',import.meta.url),'utf8')) as string[];

describe('Blender item icon catalog',()=>{
  it('covers every runtime item exactly once',()=>{
    expect([...catalog].sort()).toEqual(Object.keys(ITEMS).sort());
  });
  it('points item art at a shipped generated asset and uses original steel art for metal fragments',()=>{
    for(const [id,item] of Object.entries(ITEMS)){
      const extension=id==='metal'?'svg':'webp';
      expect(item.icon,`${id} runtime path`).toBe(`assets/items/${id}.${extension}`);
      const asset=new URL(`../public/assets/items/${id}.${extension}`,import.meta.url);
      expect(existsSync(asset),`${id} icon file`).toBe(true);
      expect(statSync(asset).size,`${id} icon size`).toBeLessThan(150_000);
    }
    const metal=readFileSync(new URL('../public/assets/items/metal.svg',import.meta.url),'utf8');
    expect(metal).toContain('steel');expect(metal).toContain('rust');
  });
  it('provides localized Czech item names and detail text',()=>{
    for(const [id,item] of Object.entries(ITEMS)){
      expect(itemName(id as keyof typeof ITEMS,'cs'),`${id} Czech name`).not.toBe(item.displayName);
      expect(itemDescription(id as keyof typeof ITEMS,'cs',item.description),`${id} Czech description`).not.toBe(item.description);
    }
  });
});
