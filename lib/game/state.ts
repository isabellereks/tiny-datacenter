import {
  BUDGET, COOL_MW, CUSTS, FH, FOUNDS, FW, HOURS_PER_MONTH, LOCS, POWER_MW, SHAPES, TECH_SALARY, TYPES,
  type BuildableType, type CustKey, type Fill, type FloorType, type FoundKey,
  type LocKey, type SetupStep, type ShapeKey, type StitchSize,
} from './data';

export interface Floor { type: FloorType; fill: Fill; done: boolean; cost: number }

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

export interface Upgrades { soundWalls: boolean; closedLoop: boolean; renewables: boolean }

export interface Tally { profit: number; fixed: number; ignored: number; goals: number }

export interface GameState {
  phase: 'setup' | 'play' | 'over';
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
  /** months since opening; the fraction is progress through the current month */
  month: number;
  /** month the building last grew; some complaints wait on time spent at one size */
  stageMonth: number;
  /** how much the town trusts you, 0 to 100. At 0 the town shuts you down. */
  trust: number;
  replanted: number;
  up: Upgrades;
  complaint: string | null;
  cooldown: Record<string, number>;
  /** server halls that are down; t counts seconds a tech has spent fixing it */
  broken: { floor: number; t: number }[];
  goal: number;
  /** months in a row that ended with less than $0 */
  debt: number;
  tally: Tally;
  /** last full month's books */
  books: Ledger | null;
  over: { reason: 'town' | 'broke'; t0: number; done: boolean } | null;
}

/** One month of the datacenter's books, plus the physical numbers behind them. */
export interface Ledger {
  revenue: number;
  power: number;
  water: number;
  staff: number;
  propertyTax: number;
  incomeTax: number;
  net: number;
  /** MW of IT load in use, and the most the halls could draw */
  itMW: number; hallMW: number;
  powerMW: number; coolMW: number;
  pe: number; ce: number; eff: number;
  pue: number;
  /** megalitres of water and tonnes of CO2 per month */
  waterML: number; carbonT: number;
}

const KEY = 'tiny-datacenter-v4';

/** Price of a floor: taller floors cost a little more to build. */
export const floorPrice = (type: FloorType, index: number) => Math.round(TYPES[type].cost * (1 + 0.08 * index));

export function fresh(): GameState {
  const floors: Floor[] = (['lobby', 'hall', 'power', 'cool'] as FloorType[]).map((type, i) => ({ type, fill: 'cloth', done: true, cost: floorPrice(type, i) }));
  return {
    phase: 'setup', step: 'loc', cash: 0,
    loc: 'dalles', found: 'slab', shape: 'box', cust: 'ai',
    inside: false, spin: true, smoke: true, sel: 0, next: 'hall', nextFill: 'cloth', build: null, nid: 1,
    floors,
    workers: [],
    log: [],
    look: { stitch: 'M', outline: '#0045D1', shade: '#99BBFF', accent: '#FF7A45', name: '' },
    month: 0, stageMonth: 0, trust: 70, replanted: 0,
    up: { soundWalls: false, closedLoop: false, renewables: false },
    complaint: null, cooldown: {}, broken: [], goal: 0, debt: 0,
    tally: { profit: 0, fixed: 0, ignored: 0, goals: 0 },
    books: null, over: null,
  };
}

export function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GameState>;
      const base = fresh();
      return {
        ...base, ...saved,
        look: { ...base.look, ...saved.look }, up: { ...base.up, ...saved.up }, tally: { ...base.tally, ...saved.tally },
        build: null,
      };
    }
  } catch { /* storage unavailable */ }
  return fresh();
}

export function save(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const note = (s: GameState, line: string) => { s.log = [line, ...s.log].slice(0, 8); };

export function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${Math.round(a)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateLabel = (month: number) => `${MONTHS[Math.floor(month) % 12]}, year ${Math.floor(month / 12) + 1}`;

export const landCost = (loc: LocKey, found: FoundKey) => LOCS[loc].land * FOUNDS[found].acres;

/** Everything the setup choices cost, paid from the budget. */
export function setupCost(s: GameState) {
  const land = landCost(s.loc, s.found);
  const found = FOUNDS[s.found].cost;
  const shape = SHAPES[s.shape].cost;
  const floors = s.floors.reduce((t, f, i) => t + floorPrice(f.type, i), 0);
  return { land, found, shape, floors, total: land + found + shape + floors, left: BUDGET - (land + found + shape + floors) };
}

/** What you've built, for property tax. */
export const assets = (s: GameState) =>
  FOUNDS[s.found].cost + SHAPES[s.shape].cost + s.floors.reduce((t, f) => t + (f.done ? f.cost : 0), 0);

export const buildCost = (s: GameState) => floorPrice(s.next, s.floors.length);
export const baseY = (s: GameState, i: number) => FOUNDS[s.found].h + i * FH;
export const floorW = (s: GameState, i: number) => (s.shape === 'tower' ? FW * (1 - Math.min(Math.floor(i / 3), 3) * 0.12) : FW);
export const perRow = (s: GameState, i: number) => Math.max(2, Math.floor((floorW(s, i) - 1.4) / 2));
export const techsOn = (s: GameState, i: number) => s.workers.filter(w => w.floor === i).length;
export const isBroken = (s: GameState, i: number) => s.broken.some(b => b.floor === i);
export const hallCount = (s: GameState) => s.floors.filter(f => f.done && f.type === 'hall').length;

/** Share of a hall in use: customers fill it as the crew can keep up. */
export function utilization(s: GameState, i: number) {
  const K = CUSTS[s.cust], Sh = SHAPES[s.shape];
  const breaks = s.floors.filter(f => f.done && f.type === 'break').length;
  return Math.min(1, K.base + K.per * techsOn(s, i) * Sh.crew * (1 + 0.1 * breaks));
}

export function ledger(s: GameState): Ledger {
  const L = LOCS[s.loc], F = FOUNDS[s.found], K = CUSTS[s.cust], Sh = SHAPES[s.shape];
  const done = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.done);
  const count = (t: FloorType) => done.filter(o => o.f.type === t).length;
  const halls = done.filter(o => o.f.type === 'hall');
  const working = halls.filter(o => !isBroken(s, o.i));

  const hallMW = halls.length * K.mw;
  const powerMW = count('power') * POWER_MW;
  // hot climates make chillers work harder
  const coolMW = count('cool') * COOL_MW * F.cool * Sh.cool * (1.2 / L.pue);
  const pe = hallMW ? Math.min(1, powerMW / hallMW) : 1;
  const ce = hallMW ? Math.min(1, coolMW / hallMW) : 1;
  const eff = pe * ce;

  const itMW = working.reduce((t, o) => t + K.mw * utilization(s, o.i), 0) * eff;
  const trustPay = 0.85 + 0.15 * (s.trust / 100);
  const revenue = itMW * 1000 * K.price * L.demand * Sh.rev * (1 + 0.08 * count('net') * K.net) * trustPay;

  const pue = L.pue + (s.up.closedLoop ? 0.05 : 0);
  const mwh = itMW * HOURS_PER_MONTH * pue;
  const power = mwh * L.power * (s.up.renewables ? 1.05 : 1);
  const litres = itMW * 1000 * HOURS_PER_MONTH * L.water * (s.up.closedLoop ? 0.15 : 1);
  const water = (litres / 1000) * L.waterPrice;
  const staff = s.workers.length * TECH_SALARY;
  const propertyTax = (assets(s) * L.propertyTax) / 12;
  const pre = revenue - power - water - staff - propertyTax;
  const incomeTax = Math.max(0, pre) * L.incomeTax;

  return {
    revenue, power, water, staff, propertyTax, incomeTax, net: pre - incomeTax,
    itMW, hallMW, powerMW, coolMW, pe, ce, eff, pue,
    waterML: litres / 1e6, carbonT: mwh * L.carbon * (s.up.renewables ? 0.1 : 1),
  };
}

/** Advances money, the calendar, workers, repairs and construction. */
export function simulate(s: GameState, dt: number, monthSeconds: number): { built: boolean; newMonth: boolean; fixed: boolean } {
  let newMonth = false, fixed = false;
  if (s.phase === 'play') {
    const l = ledger(s);
    s.cash += (l.net * dt) / monthSeconds;
    s.tally.profit += (l.net * dt) / monthSeconds;
    const before = Math.floor(s.month);
    s.month += dt / monthSeconds;
    newMonth = Math.floor(s.month) > before;

    // techs on a broken floor fix it in a few seconds
    for (const b of s.broken) {
      const crew = s.workers.filter(w => w.floor === b.floor);
      if (crew.length) b.t += dt * crew.length;
      if (b.t >= 4) {
        note(s, `${crew[0].name} fixed floor ${b.floor}`);
        s.tally.fixed++;
        fixed = true;
      }
    }
    if (fixed) s.broken = s.broken.filter(b => b.t < 4);
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
    if (s.phase === 'play') note(s, `${TYPES[f.type].name} built`);
    s.build = null;
    return { built: true, newMonth, fixed };
  }
  return { built: false, newMonth, fixed };
}
