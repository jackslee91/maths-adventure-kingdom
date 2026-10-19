// 音效与背景音乐（Web Audio）
// 浏览器规定：必须等使用者点击后才能播放声音，所以第一次点击前不会出声。
// 如果 public/assets/audio/ 有上传音效或音乐（见素材清单），就播放文件；没有就用程序合成的声音。
import { assetUrl } from './assets/loader.js';
const PREF_KEY = 'ma_audio';
let ctx = null, master = null, musicGain = null, sfxGain = null, musicTimer = null, musicOn = false;
const prefs = (() => { try { return { volume: 0.6, music: true, sfx: true, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { volume: 0.6, music: true, sfx: true }; } })();
const save = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* 忽略 */ } };

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = prefs.volume; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
  return true;
}

// 第一次与页面互动后才建立音频
let unlocked = false;
const unlock = () => { unlocked = true; ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); if (wantMusic && prefs.music) startMusic(); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
let wantMusic = false;

function tone(freq, t0, dur, { type = 'triangle', gain = 0.3, dest = sfxGain, slide } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, gain = 0.25) {
  const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400; s.buffer = buf; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t0);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  click: (t) => tone(880, t, 0.06, { type: 'square', gain: 0.08 }),
  correct: (t) => [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.07, 0.18, { gain: 0.22 })),
  wrong: (t) => { tone(N(55), t, 0.25, { type: 'sawtooth', gain: 0.08, slide: N(50) }); },
  hint: (t) => [79, 84].forEach((n, i) => tone(N(n), t + i * 0.09, 0.2, { type: 'sine', gain: 0.18 })),
  step: (t) => tone(N(81), t, 0.08, { type: 'sine', gain: 0.12 }),
  door: (t) => { tone(N(60), t, 0.15, { type: 'square', gain: 0.1 }); tone(N(67), t + 0.12, 0.25, { type: 'square', gain: 0.1 }); },
  chest: (t) => [67, 71, 74, 79, 83, 86].forEach((n, i) => tone(N(n), t + i * 0.06, 0.25, { type: 'sine', gain: 0.18 })),
  hit: (t) => { noise(t, 0.25, 0.35); tone(N(43), t, 0.3, { type: 'square', gain: 0.15, slide: N(31) }); },
  bossHit: (t) => { noise(t, 0.4, 0.3); tone(N(38), t, 0.45, { type: 'sawtooth', gain: 0.12, slide: N(26) }); },
  level: (t) => [60, 64, 67, 72, 67, 72, 76].forEach((n, i) => tone(N(n), t + i * 0.11, 0.3, { gain: 0.2 })),
  victory: (t) => { [60, 64, 67, 72].forEach((n, i) => tone(N(n), t + i * 0.12, 0.25, { gain: 0.2 })); [72, 76, 79, 84].forEach((n) => tone(N(n), t + 0.55, 0.9, { gain: 0.12 })); },
};

const sfxCache = new Map();
export function play(name) {
  if (!prefs.sfx) return;
  const url = assetUrl(`sfx.${name}`);
  if (url && unlocked) {
    let base = sfxCache.get(url);
    if (!base) { base = new Audio(url); base.preload = 'auto'; sfxCache.set(url, base); }
    const a = base.cloneNode();
    a.volume = Math.min(1, prefs.volume);
    a.play().catch(() => { if (ensure() && SFX[name]) SFX[name](ctx.currentTime + 0.01); });
    return;
  }
  if (!ensure() || !SFX[name]) return;
  SFX[name](ctx.currentTime + 0.01);
}

// 背景音乐：轻快的五声音阶小曲，循环播放
const MELODY = [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 69, 67, 69, 72, 76, 79, 81, 79, 76, 74, 72, 74];
const BASS = [48, 48, 55, 55, 53, 53, 55, 55];
const BOSS_MELODY = [57, 60, 63, 60, 57, 56, 57, 60, 62, 63, 62, 60, 57, 55, 57, 60];
let theme = 'map';
// 背景音乐文件：用 Web Audio 解码后无缝循环（HTML <audio> 的 loop 在接头处会有短暂停顿）
const bufCache = new Map();
let fileSrc = null, fileGain = null, fileUrl = null, fileToken = 0;
async function startFileMusic(url) {
  if (fileUrl === url && fileSrc) return true;
  stopFileMusic();
  if (!ensure()) return false;
  const token = ++fileToken;
  fileUrl = url; musicOn = true;
  try {
    let buf = bufCache.get(url);
    if (!buf) {
      const data = await (await fetch(url)).arrayBuffer();
      buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
      bufCache.set(url, buf);
    }
    if (token !== fileToken) return false;          // 期间已换页或关掉音乐
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2); // 淡入
    g.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(g); src.start();
    fileSrc = src; fileGain = g;
    return true;
  } catch (e) {
    console.warn('背景音乐读取失败，改用合成音乐', e);
    if (token === fileToken) { fileUrl = null; startSynthMusic(); }
    return false;
  }
}
function stopFileMusic() {
  fileToken++;
  if (fileSrc) {
    const src = fileSrc, g = fileGain, t = ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.4); // 淡出
    setTimeout(() => { try { src.stop(); } catch { /* 忽略 */ } g.disconnect(); }, 450);
  }
  fileSrc = null; fileGain = null; fileUrl = null;
}
function startMusic() {
  const url = assetUrl(theme === 'boss' ? 'bgm.boss' : theme === 'maze' ? 'bgm.maze' : 'bgm.map') || assetUrl('bgm.map');
  if (url && unlocked) { startFileMusic(url); return; }
  startSynthMusic();
}
function startSynthMusic() {
  if (!ensure() || musicTimer) return;
  musicOn = true;
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const beat = theme === 'boss' ? 0.2 : 0.28;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.4) {
      const mel = theme === 'boss' ? BOSS_MELODY : MELODY;
      tone(N(mel[step % mel.length]), next, beat * 0.9, { type: theme === 'boss' ? 'square' : 'triangle', gain: 0.12, dest: musicGain });
      if (step % 2 === 0) tone(N((theme === 'boss' ? [45, 45, 44, 44] : BASS)[(step / 2) % (theme === 'boss' ? 4 : 8)]), next, beat * 1.8, { type: 'sine', gain: 0.16, dest: musicGain });
      next += beat; step++;
    }
  }, 120);
}
function stopMusic() { clearInterval(musicTimer); musicTimer = null; stopFileMusic(); musicOn = false; }

export function music(on, which = 'map') {
  wantMusic = on;
  if (which !== theme) { theme = which; if (musicOn) { stopMusic(); } }
  if (on && prefs.music && ctx) startMusic(); else if (!on) stopMusic();
}

export const audioPrefs = () => ({ ...prefs });
export function setAudioPrefs(p) {
  Object.assign(prefs, p); save();
  if (master) master.gain.value = prefs.volume;
  if (!prefs.music) stopMusic(); else if (wantMusic && ctx) startMusic();
}

/** 音量控制面板（静音、音乐、音效、音量） */
export function audioControlHTML() {
  return `<div class="audio-ctl">
    <label><input type="checkbox" data-a="sfx" ${prefs.sfx ? 'checked' : ''}> 音效</label>
    <label><input type="checkbox" data-a="music" ${prefs.music ? 'checked' : ''}> 背景音乐</label>
    <label class="vol">音量 <input type="range" min="0" max="1" step="0.05" value="${prefs.volume}" data-a="volume" aria-label="音量"></label>
  </div>`;
}
export function bindAudioControls(root) {
  root.querySelectorAll('[data-a]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.a;
      setAudioPrefs({ [k]: k === 'volume' ? Number(inp.value) : inp.checked });
      if (k !== 'volume') play('click');
    });
  });
}
