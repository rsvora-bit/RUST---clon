import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import {GameApp} from './app/GameApp';
const canvas=document.querySelector<HTMLCanvasElement>('#game-canvas')!;
try {const app=new GameApp(canvas,document.querySelector<HTMLElement>('#ui')!);app.init().catch(showError);}catch(error){showError(error);}
function showError(error:unknown){console.error(error);const panel=document.createElement('div');panel.style.cssText='position:fixed;inset:0;display:grid;place-content:center;background:#202822;color:#ede5d5;font:18px sans-serif;padding:10vw;z-index:9999';panel.innerHTML='<h1>The shore is out of reach.</h1><p>The game could not start. Make sure WebGL 2 is enabled, then reload.</p><button onclick="location.reload()" style="padding:15px;cursor:pointer">RETRY</button>';document.body.append(panel);}
