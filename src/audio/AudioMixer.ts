import type {Settings} from '../core/types';
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
  play(kind:'step'|'wood'|'stone'|'pickup'|'build'|'ui'|'door'|'eat'|'error'){
    if(!this.ctx||!this.sfx||!this.buffer)return;const ctx=this.ctx,t=ctx.currentTime;
    const noise=ctx.createBufferSource();noise.buffer=this.buffer;const filter=ctx.createBiquadFilter(),gain=ctx.createGain();filter.type='lowpass';filter.frequency.value=kind==='stone'?2400:kind==='step'?450:kind==='wood'?1000:700;
    noise.connect(filter);filter.connect(gain);gain.connect(this.sfx);gain.gain.setValueAtTime(kind==='step'?.12:.45,t);gain.gain.exponentialRampToValueAtTime(.001,t+(kind==='build'?.25:.11));noise.start(t);noise.stop(t+.28);
    if(['pickup','build','ui','error','eat'].includes(kind)){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(kind==='error'?100:kind==='build'?180:720,t);o.frequency.exponentialRampToValueAtTime(kind==='error'?75:kind==='build'?80:1120,t+.12);g.gain.setValueAtTime(.075,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+.16);}
  }
}
