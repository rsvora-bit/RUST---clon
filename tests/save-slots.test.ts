import {beforeEach,describe,expect,it,vi} from 'vitest';
import {GameSimulation} from '../src/simulation/GameSimulation';
import {deleteSave,latestSaveSlot,listSaveSlots,loadGame,resetSave,saveGame} from '../src/save/storage';

class MemoryStorage {
  private data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,String(value));}
  removeItem(key:string){this.data.delete(key);}
  clear(){this.data.clear();}
}

describe('multi-slot local saves',()=>{
  beforeEach(()=>{vi.stubGlobal('localStorage',new MemoryStorage());resetSave();});
  it('keeps independent worlds and deletes only the selected slot',()=>{
    const a=new GameSimulation(101,{x:0,y:2,z:0}),b=new GameSimulation(202,{x:0,y:2,z:0});
    expect(saveGame(a.state,1)).toBe(true);expect(saveGame(b.state,2)).toBe(true);
    expect(loadGame(1)?.seed).toBe(101);expect(loadGame(2)?.seed).toBe(202);
    expect(listSaveSlots().filter(slot=>slot.exists).map(slot=>slot.slot)).toEqual([1,2]);
    deleteSave(1);expect(loadGame(1)).toBeNull();expect(loadGame(2)?.seed).toBe(202);
  });
  it('reports a latest save and reset clears every slot',async()=>{
    const a=new GameSimulation(303,{x:0,y:2,z:0}),b=new GameSimulation(404,{x:0,y:2,z:0});
    saveGame(a.state,3);await new Promise(resolve=>setTimeout(resolve,2));saveGame(b.state,4);
    expect(latestSaveSlot()).toBe(4);resetSave();expect(listSaveSlots().every(slot=>!slot.exists)).toBe(true);
  });
});
