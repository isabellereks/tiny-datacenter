import {
  CUSTS, FH, FOUNDS, FW, LOCS, TYPES,
  type BuildableType, type CustKey, type Fill, type FloorType, type FoundKey,
  type LocKey, type SetupStep, type ShapeKey, type StitchSize,
} from './data';

export interface Floor { type: FloorType; fill: Fill; done: boolean }

export interface Worker {
  id: number; name: string; floor: number;
  x: number; dir: 1 | -1; speed: number; pause: number;
}

export interface Look {
  stitch: StitchSize;
  outline: string;
  shade: string;
  accent: string;
  name: string;
}

export interface GameState {
  phase: 'setup' | 'play';
  step: SetupStep;
  cash: number;
  loc: LocKey;
  found: FoundKey;
  shape: ShapeKey;
  cust: CustKey;
  inside: boolean;
  spin: boolean;
  smoke: boolean;
  sel: number;
  next: BuildableType;
  nextFill: Fill;
  build: { idx: number; t0: number; dur: number } | null;
  nid: number;
  floors: Floor[];
  workers: Worker[];
  log: string[];
  look: Look;
  day: number;
  /** day the building last changed height; complaints wait on time spent at a stage */
  stageDay: number;
  rep: number;
  replanted: number;
  up: { soundWalls: boolean; closedLoop: boolean; renewables: boolean };
  complaint: string | null;
  cooldown: Record<string, number>;
}

export interface Stats {
  rev: number; eff: number; pe: number; ce: number;
  demand: number; pSup: number; cSup: number;
}

const KEY = 'tiny-datacenter-v3';

export function fresh(): GameState {
  return {
    phase: 'setup', step: 'found', cash: 0,
    loc: 'dalles', found: 'slab', shape: 'shed', cust: 'ai',
    inside: false, spin: true, smoke: true, sel: 0, next: 'hall', nextFill: 'cloth', build: null, nid: 1,
    floors: [
      { type: 'lobby', fill: 'cloth', done: true },
      { type: 'hall', fill: 'cloth', done: true },
      { type: 'power', fill: 'cloth', done: true },
    ],
    workers: [],
    log: [],
    look: { stitch: 'M', outline: '#0045D1', shade: '#99BBFF', accent: '#FF7A45', name: '' },
    day: 0, stageDay: 0, rep: 80, replanted: 0,
    up: { soundWalls: false, closedLoop: false, renewables: false },
    complaint: null, cooldown: {},
  };
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GameState>;
      const base = fresh();
      return { ...base, ...saved, look: { ...base.look, ...saved.look }, up: { ...base.up, ...saved.up }, build: null };
    }
  } catch { /* storage unavailable */ }
  return fresh();
}

export function save(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const note = (s: GameState, line: string) => { s.log = [line, ...s.log].slice(0, 8); };

export const money = (n: number) =>
  n < 1000 ? '$' + Math.floor(n) : n < 1e6 ? '$' + (n / 1e3).toFixed(n < 1e4 ? 2 : 1) + 'k' : '$' + (n / 1e6).toFixed(2) + 'M';

export const floorCost = (s: GameState) => Math.round(120 * Math.pow(1.35, s.floors.length - 1));
export const hireCost = (s: GameState) => Math.round(80 * Math.pow(1.3, s.workers.length));
export const baseY = (s: GameState, i: number) => FOUNDS[s.found].h + i * FH;
export const floorW = (s: GameState, i: number) => (s.shape === 'tower' ? FW * (1 - Math.min(Math.floor(i / 3), 3) * 0.12) : FW);
export const perRow = (s: GameState, i: number) => Math.max(2, Math.floor((floorW(s, i) - 1.4) / 2));
export const racksFor = (s: GameState, i: number) => perRow(s, i) * 2;
export const techsOn = (s: GameState, i: number) => s.workers.filter(w => w.floor === i).length;

export function stats(s: GameState): Stats {
  const L = LOCS[s.loc], F = FOUNDS[s.found], K = CUSTS[s.cust];
  const done = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.done);
  const count = (t: FloorType) => done.filter(o => o.f.type === t).length;
  const halls = done.filter(o => o.f.type === 'hall');
  const demand = halls.length * K.power;
  const pSup = count('power') * 3 * L.power;
  const cSup = count('cool') * 3 * L.cool * F.cool;
  const pe = demand ? Math.min(1, pSup / demand) : 1;
  const ce = demand ? Math.min(1, cSup / demand) : 1;
  const eff = pe * ce;
  const breaks = count('break');
  let rev = 0;
  for (const { i } of halls) {
    rev += racksFor(s, i) * K.rate * Math.min(1, K.base + K.per * techsOn(s, i) + 0.08 * breaks);
  }
  rev = rev * eff * (1 + 0.2 * count('net') * K.net) * L.rev * (0.6 + 0.4 * s.rep / 100) + 2;
  return { rev, eff, pe, ce, demand, pSup, cSup };
}

export function typeNote(s: GameState, t: BuildableType): string {
  const L = LOCS[s.loc], F = FOUNDS[s.found], K = CUSTS[s.cust];
  switch (t) {
    case 'hall': return `${racksFor(s, s.floors.length)} racks`;
    case 'cool': return `−${(3 * L.cool * F.cool).toFixed(1)} MW heat`;
    case 'power': return `+${(3 * L.power).toFixed(1)} MW`;
    case 'net': return `+${Math.round(20 * K.net)}% revenue`;
    case 'break': return 'techs +8%';
  }
}

/** Advances money, days, workers and construction. */
export function simulate(s: GameState, dt: number, st: Stats, daySeconds: number): { built: boolean; newDay: boolean } {
  let newDay = false;
  if (s.phase === 'play') {
    s.cash += st.rev * dt;
    const before = Math.floor(s.day);
    s.day += dt / daySeconds;
    newDay = Math.floor(s.day) > before;
  }
  for (const w of s.workers) {
    const hw = floorW(s, w.floor) / 2 - 0.9;
    if (w.pause > 0) { w.pause -= dt; continue; }
    w.x += w.dir * w.speed * dt;
    if (w.x < -hw) { w.x = -hw; w.dir = 1; }
    if (w.x > hw) { w.x = hw; w.dir = -1; }
    if (Math.random() < dt * 0.35) {
      w.pause = 0.8 + Math.random() * 2.2;
      if (Math.random() < 0.5) w.dir = w.dir === 1 ? -1 : 1;
    }
  }
  if (s.build && Date.now() - s.build.t0 >= s.build.dur) {
    const f = s.floors[s.build.idx];
    f.done = true;
    if (s.phase === 'play') note(s, `Floor ${s.build.idx} is up · ${TYPES[f.type].name}`);
    s.build = null;
    return { built: true, newDay };
  }
  return { built: false, newDay };
}
