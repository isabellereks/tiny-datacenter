import {
  CUSTS, FH, FOUNDS, FW, LOCS, TYPES,
  type BuildableType, type CustKey, type FloorType, type FoundKey, type InkKey,
  type LocKey, type ShapeKey, type Step, type StitchKey,
} from './data';

export interface Floor { type: FloorType; color: string; done: boolean }

export interface Worker {
  id: number; name: string; floor: number;
  x: number; dir: 1 | -1; speed: number; pause: number;
  hair: string; skin: string; shirt: string;
}

export interface GameState {
  cash: number;
  step: Step;
  loc: LocKey;
  found: FoundKey;
  shape: ShapeKey;
  cust: CustKey;
  ink: InkKey;
  stitch: StitchKey;
  inside: boolean;
  sel: number;
  next: BuildableType;
  build: { idx: number; t0: number; dur: number } | null;
  nid: number;
  floors: Floor[];
  workers: Worker[];
  log: string[];
}

export interface Stats {
  rev: number; eff: number; pe: number; ce: number;
  demand: number; pSup: number; cSup: number;
}

const KEY = 'tiny-datacenter-v1';

export function fresh(): GameState {
  return {
    cash: 300, step: 'floors', loc: 'dalles', found: 'slab', shape: 'shed', cust: 'ai',
    ink: 'delft', stitch: 'M', inside: true, sel: 1, next: 'hall', build: null, nid: 2,
    floors: [
      { type: 'lobby', color: '#FFFFFF', done: true },
      { type: 'hall', color: '#FFFFFF', done: true },
      { type: 'power', color: '#FFFFFF', done: true },
      { type: 'cool', color: '#FFFFFF', done: true },
    ],
    workers: [{ id: 1, name: 'Dana', floor: 1, x: 0, dir: 1, speed: 1.1, pause: 0, hair: '#5B3A1E', skin: '#D9A27E', shirt: '#F2B43C' }],
    log: ['Opened with a lobby, one server hall, power and cooling.'],
  };
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<GameState>) };
  } catch { /* storage unavailable */ }
  return fresh();
}

export function save(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const note = (s: GameState, line: string) => { s.log = [line, ...s.log].slice(0, 6); };

export const money = (n: number) =>
  n < 1000 ? '$' + Math.floor(n) : n < 1e6 ? '$' + (n / 1e3).toFixed(n < 1e4 ? 2 : 1) + 'k' : '$' + (n / 1e6).toFixed(2) + 'M';

export const floorCost = (s: GameState) => Math.round(120 * Math.pow(1.35, s.floors.length - 1));
export const hireCost = (s: GameState) => Math.round(80 * Math.pow(1.3, s.workers.length));
export const baseY = (s: GameState, i: number) => FOUNDS[s.found].h + i * FH;
export const floorW = (s: GameState, i: number) => (s.shape === 'tower' ? FW * (1 - Math.min(Math.floor(i / 3), 3) * 0.12) : FW);
export const perRow = (s: GameState, i: number) => Math.max(2, Math.floor((floorW(s, i) - 1.4) / 2));
export const racksFor = (s: GameState, i: number) => perRow(s, i) * 2;

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
    const techs = s.workers.filter(w => w.floor === i).length;
    rev += racksFor(s, i) * K.rate * Math.min(1, K.base + K.per * techs + 0.08 * breaks);
  }
  rev = rev * eff * (1 + 0.2 * count('net') * K.net) * L.rev + 2;
  return { rev, eff, pe, ce, demand, pSup, cSup };
}

export function typeNote(s: GameState, t: BuildableType): string {
  const L = LOCS[s.loc], F = FOUNDS[s.found], K = CUSTS[s.cust];
  const i = s.floors.length;
  switch (t) {
    case 'hall': return `${racksFor(s, i)} racks · uses ${K.power} MW`;
    case 'cool': return `Removes ${(3 * L.cool * F.cool).toFixed(1)} MW of heat`;
    case 'power': return `UPS and batteries · ${(3 * L.power).toFixed(1)} MW`;
    case 'net': return `Network ops · revenue +${Math.round(20 * K.net)}%`;
    case 'break': return 'Couch and coffee · techs +8%';
  }
}

/** Advances money, workers and construction. Returns true when a floor finished building. */
export function simulate(s: GameState, dt: number, st: Stats): boolean {
  s.cash += st.rev * dt;
  for (const w of s.workers) {
    const hw = floorW(s, w.floor) / 2 - 0.8;
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
    s.build = null;
    note(s, `Floor ${s.floors.length - 1} finished: ${TYPES[f.type].name.toLowerCase()}.`);
    return true;
  }
  return false;
}
