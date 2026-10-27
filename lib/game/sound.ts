/*
 * Every sound is made on the fly with WebAudio: no files to load. A low hum that rises with the
 * load, and small effects for clicks, coins, stamps, the phone, the alarm, the news and new tiers.
 * Browsers only allow sound after the player interacts, so nothing plays until the first tap.
 */

type Sfx = 'click' | 'coin' | 'loss' | 'build' | 'stamp' | 'ring' | 'alarm' | 'news' | 'tier' | 'sign';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { gain: GainNode; filter: BiquadFilterNode } | null = null;
let muted = false;
let level = 0;

function start() {
  if (ctx || typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
  // the hum: two low tones through a soft filter
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  for (const f of [55, 110.5, 165]) {
    const o = ctx.createOscillator();
    o.type = f === 55 ? 'sawtooth' : 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = f === 55 ? 0.5 : 0.25;
    o.connect(g).connect(filter);
    o.start();
  }
  filter.connect(gain).connect(master);
  hum = { gain, filter };
  setHum(level);
}

/** Call once: the first tap anywhere unlocks sound. */
export function armSound() {
  if (typeof window === 'undefined') return;
  const go = () => { start(); void ctx?.resume(); };
  window.addEventListener('pointerdown', go, { once: true });
  window.addEventListener('keydown', go, { once: true });
}

export function setMuted(m: boolean) {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
}

/** 0 to 1: how hard the halls are running. */
export function setHum(k: number) {
  level = Math.max(0, Math.min(1, k));
  if (!ctx || !hum) return;
  hum.gain.gain.setTargetAtTime(0.012 + level * 0.05, ctx.currentTime, 0.8);
  hum.filter.frequency.setTargetAtTime(180 + level * 260, ctx.currentTime, 0.8);
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slide?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

function noise(at: number, dur: number, vol = 0.2, cutoff = 900) {
  if (!ctx || !master) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(at);
}

export function sfx(name: Sfx) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'click': tone(1400, t, 0.03, 'square', 0.04); break;
    case 'coin': tone(988, t, 0.07, 'square', 0.06); tone(1319, t + 0.07, 0.14, 'square', 0.06); break;
    case 'loss': tone(330, t, 0.12, 'triangle', 0.08, 220); break;
    case 'sign': tone(523, t, 0.08, 'triangle', 0.1); tone(659, t + 0.08, 0.08, 'triangle', 0.1); tone(784, t + 0.16, 0.16, 'triangle', 0.1); break;
    case 'build':
      // a needle going in and out
      for (let k = 0; k < 7; k++) { noise(t + k * 0.09, 0.04, 0.12, 3000); tone(700 + k * 40, t + k * 0.09, 0.03, 'square', 0.03); }
      break;
    case 'stamp': noise(t, 0.18, 0.5, 400); tone(90, t, 0.18, 'sine', 0.35, 50); break;
    case 'ring':
      for (let k = 0; k < 2; k++) { tone(440, t + k * 0.5, 0.35, 'sine', 0.08); tone(480, t + k * 0.5, 0.35, 'sine', 0.08); }
      break;
    case 'alarm': tone(880, t, 0.15, 'square', 0.07); tone(660, t + 0.18, 0.15, 'square', 0.07); tone(880, t + 0.36, 0.15, 'square', 0.07); break;
    case 'news': tone(523, t, 0.12, 'sawtooth', 0.06); tone(784, t + 0.12, 0.12, 'sawtooth', 0.06); tone(1047, t + 0.24, 0.3, 'sawtooth', 0.06); break;
    case 'tier':
      [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, t + k * 0.1, 0.22, 'triangle', 0.1));
      break;
  }
}
