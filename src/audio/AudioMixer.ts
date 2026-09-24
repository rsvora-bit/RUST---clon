import type {Settings} from '../core/types';

export type FootstepSurface='sand'|'grass'|'forest'|'rock'|'wood';
export type GatherTool='rock'|'hatchet'|'pickaxe';

export class AudioMixer {
  private ctx:AudioContext|null=null;private master:GainNode|null=null;private sfx:GainNode|null=null;private ambience:GainNode|null=null;private music:GainNode|null=null;private buffer:AudioBuffer|null=null;private lastRain=0;
  constructor(private settings:Settings){}
  async start(){
    if(this.ctx){await this.ctx.resume();return;}
    this.ctx=new AudioContext();const ctx=this.ctx;
    this.master=ctx.createGain();this.master.connect(ctx.destination);
    this.sfx=ctx.createGain();this.sfx.connect(this.master);
    this.ambience=ctx.createGain();this.ambience.connect(this.master);
    this.music=ctx.createGain();this.music.connect(this.master);
    this.buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=this.buffer.getChannelData(0);let prev=0;for(let i=0;i<data.length;i++){prev=(prev+Math.random()*.08-.04)/1.025;data[i]=prev;}
    const wind=ctx.createBufferSource();wind.buffer=this.buffer;wind.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=680;wind.connect(filter);filter.connect(this.ambience);wind.start();
    const pad=ctx.createGain();pad.gain.value=.24;pad.connect(this.music);const low=ctx.createOscillator(),high=ctx.createOscillator(),padFilter=ctx.createBiquadFilter();padFilter.type='lowpass';padFilter.frequency.value=260;low.type='sine';high.type='sine';low.frequency.value=82.4;high.frequency.value=123.5;low.connect(padFilter);high.connect(padFilter);padFilter.connect(pad);low.start();high.start();
    this.setSettings(this.settings);
  }
  setSettings(s:Settings){this.settings=s;if(this.master)this.master.gain.value=s.masterVolume;if(this.sfx)this.sfx.gain.value=s.effectsVolume;if(this.music)this.music.gain.value=s.musicVolume*.045;this.updateAmbience();}
  setWeather(rain:number){this.lastRain=rain;this.updateAmbience();}
  private updateAmbience(){if(this.ambience&&this.ctx)this.ambience.gain.setTargetAtTime((.038+this.lastRain*.075)*this.settings.ambientVolume,this.ctx.currentTime,.4);}

  footstep(surface:FootstepSurface,speed:number){
    if(!this.ctx||!this.sfx||!this.buffer)return;
    const ctx=this.ctx,t=ctx.currentTime,pace=Math.max(.65,Math.min(1.25,speed/5.2));
    const profiles:Record<FootstepSurface,{cutoff:number;gain:number;duration:number;pitch:number}>={
      sand:{cutoff:520,gain:.10,duration:.13,pitch:72},
      grass:{cutoff:840,gain:.105,duration:.11,pitch:82},
      forest:{cutoff:690,gain:.12,duration:.12,pitch:68},
      rock:{cutoff:2200,gain:.095,duration:.075,pitch:155},
      wood:{cutoff:1450,gain:.105,duration:.09,pitch:118},
    };
    const profile=profiles[surface];
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.buffer;filter.type='lowpass';filter.frequency.value=profile.cutoff*(.94+Math.random()*.12);noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(profile.gain*pace,t);gain.gain.exponentialRampToValueAtTime(.001,t+profile.duration);noise.start(t);noise.stop(t+profile.duration+.03);
    const tone=ctx.createOscillator(),toneGain=ctx.createGain();tone.type=surface==='rock'?'triangle':'sine';tone.frequency.setValueAtTime(profile.pitch*(.94+Math.random()*.12),t);tone.frequency.exponentialRampToValueAtTime(profile.pitch*.72,t+.055);toneGain.gain.setValueAtTime(((surface==='rock'||surface==='wood') ? .027 : .016)*pace,t);toneGain.gain.exponentialRampToValueAtTime(.001,t+.075);tone.connect(toneGain);toneGain.connect(this.sfx);tone.start(t);tone.stop(t+.08);
  }

  gather(tool:GatherTool|null,resource:'tree'|'stone'|'metal'|'wood'|'fiber'|'berries',weakSpot=false){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const hard=resource==='stone'||resource==='metal',axe=tool==='hatchet',pick=tool==='pickaxe';
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.buffer;filter.type=hard?'bandpass':'lowpass';filter.frequency.value=hard?(pick?2600:1450):(axe?1350:720);filter.Q.value=hard?1.1:.35;noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime((weakSpot?.34:.25)*(tool==='rock'?.82:1),t);gain.gain.exponentialRampToValueAtTime(.001,t+(hard?.10:.14));noise.start(t);noise.stop(t+.18);
    const tone=ctx.createOscillator(),toneGain=ctx.createGain();tone.type=hard?(pick?'triangle':'sine'):'sine';const base=resource==='metal'?(pick?510:260):resource==='stone'?(pick?350:190):(axe?118:76);tone.frequency.setValueAtTime(base*(.94+Math.random()*.12),t);tone.frequency.exponentialRampToValueAtTime(base*(hard?.72:.55),t+.09);toneGain.gain.setValueAtTime(weakSpot?.09:.052,t);toneGain.gain.exponentialRampToValueAtTime(.001,t+.12);tone.connect(toneGain);toneGain.connect(this.sfx);tone.start(t);tone.stop(t+.13);
    if(weakSpot){const ping=ctx.createOscillator(),pg=ctx.createGain();ping.type='sine';ping.frequency.setValueAtTime(hard?980:620,t);ping.frequency.exponentialRampToValueAtTime(hard?1320:880,t+.055);pg.gain.setValueAtTime(.055,t);pg.gain.exponentialRampToValueAtTime(.001,t+.095);ping.connect(pg);pg.connect(this.sfx);ping.start(t);ping.stop(t+.1);}
  }

  treeFall(){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const creak=ctx.createOscillator(),cg=ctx.createGain();creak.type='sawtooth';creak.frequency.setValueAtTime(92,t);creak.frequency.exponentialRampToValueAtTime(48,t+.85);cg.gain.setValueAtTime(.035,t);cg.gain.linearRampToValueAtTime(.07,t+.52);cg.gain.exponentialRampToValueAtTime(.001,t+1.02);creak.connect(cg);cg.connect(this.sfx);creak.start(t);creak.stop(t+1.04);
    const crashAt=t+.82,noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=this.buffer;filter.type='lowpass';filter.frequency.value=680;noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(.001,t);gain.gain.setValueAtTime(.62,crashAt);gain.gain.exponentialRampToValueAtTime(.001,crashAt+.48);noise.start(t);noise.stop(crashAt+.52);
    const thump=ctx.createOscillator(),tg=ctx.createGain();thump.type='sine';thump.frequency.setValueAtTime(72,crashAt);thump.frequency.exponentialRampToValueAtTime(34,crashAt+.32);tg.gain.setValueAtTime(.22,crashAt);tg.gain.exponentialRampToValueAtTime(.001,crashAt+.38);thump.connect(tg);tg.connect(this.sfx);thump.start(crashAt);thump.stop(crashAt+.4);
  }

  play(kind:'step'|'wood'|'stone'|'pickup'|'build'|'ui'|'door'|'eat'|'error'){
    if(kind==='step'){this.footstep('grass',4.4);return;}
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const noise=ctx.createBufferSource();noise.buffer=this.buffer;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='lowpass';filter.frequency.value=kind==='stone'?2400:kind==='wood'?1000:700;
    noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(.45,t);gain.gain.exponentialRampToValueAtTime(.001,t+(kind==='build'?.25:.11));noise.start(t);noise.stop(t+.28);
    if(['pickup','build','ui','error','eat'].includes(kind)){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='error'?100:kind==='build'?180:720,t);o.frequency.exponentialRampToValueAtTime(kind==='error'?75:kind==='build'?80:1120,t+.12);g.gain.setValueAtTime(.075,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+.16);}
  }
}
