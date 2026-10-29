import {
  BUDGET, CHIPS, COOL_MW, CUSTS, FH, FOUNDS, FW, HOURS_PER_MONTH, LIQUID_GEN, LOCS, HIRE_FEE, POWER_MW, SHAPES, SOLAR_MW, TECH_SALARY, TIERS, TYPES,
  type BuildableType, type CustKey, type Fill, type FloorType, type FoundKey,
  type LocKey, type SetupStep, type ShapeKey, type StitchSize,
} from './data';

/** `b` is which building on the campus the floor is in (older saves: 0). */
import type { Call } from './calls';

/** A quarter's statement: what came in, what went out, and the change in cash. */
export interface QuarterReport {
  label: string;
  income: { label: string; value: number }[];
  costs: { label: string; value: number }[];
  operating: number;
  /** building, refits, hires, projects, permits, fines and gifts */
  spent: number;
  rewards: number; borrowed: number;
  change: number;
  prev: number | null;
}

/** A bank loan, paid back in equal monthly payments. */
export interface Loan { id: number; balance: number; rate: number; payment: number }

/** `gen` is the chip generation a server hall was fitted with. */
export interface Floor { type: FloorType; fill: Fill; done: boolean; cost: number; b?: number; gen?: number }

/** What a customer asks for: the power they want, what they pay per kW a month, for how long,
 *  how many months until they move in, and anything special they need. */
export type Need = 'green' | 'uptime' | 'fresh';
export interface Offer { id: number; who: string; kind: CustKey; mw: number; price: number; months: number; lead: number; needs: Need[]; expires: number }
/** A signed deal. Months you can't supply their power cost you credits and strikes; three strikes and they leave. */
export interface Deal extends Offer { start: number; until: number; strikes: number; lastNews?: number }

export interface Worker {
  id: number; name: string; floor: number;
  x: number; dir: 1 | -1; speed: number; pause: number;
  /** hired from the town, or brought in from overseas on a work visa (older saves: local) */
  overseas?: boolean;
  /** month their work visa next renews */
  visaAt?: number;
}

export interface Look {
  stitch: StitchSize;
  outline: string;
  shade: string;
  accent: string;
  name: string;
  /** the player, named on the permit; the town blames them by name */
  owner: string;
}

export type PermitKey = 'zoning' | 'height' | 'air' | 'water' | 'campus';
export type Board = 'pro' | 'neutral' | 'anti';
export interface Law { id: string; until: number }
export interface Headline { id: number; tag: string; headline: string; ticker: string[] }

export interface Staff {
  /** how your techs feel, 0 to 100 */
  morale: number;
  /** 0 standard pay, 1 +10%, 2 +20% */
  pay: number;
  health: boolean; retire: boolean; overtime: boolean;
  union: boolean; strike: boolean;
  /** months the current strike has lasted */
  struck: number;
  /** lingering lift from team events, or anger from saying no; fades */
  cheer: number;
  /** months in a row morale has been low */
  low: number;
  /** recent layoffs; fades each month */
  cuts: number;
}

export interface Upgrades {
  soundWalls: boolean; closedLoop: boolean; renewables: boolean;
  solar: boolean; batteries: boolean; heat: boolean;
  /** on-site gas turbines, liquid cooling for dense chips, and a small nuclear reactor */
  turbines: boolean; liquid: boolean; smr: boolean;
}

export interface Tally { profit: number; fixed: number; ignored: number; goals: number; best: number }

export interface GameState {
  phase: 'setup' | 'play' | 'over';
  step: SetupStep;
  cash: number;
  loc: LocKey;
  found: FoundKey;
  /** foundation picked at setup, so upgrading it later can be a goal */
  startFound: FoundKey;
  shape: ShapeKey;
  cust: CustKey;
  inside: boolean;
  spin: boolean;
  smoke: boolean;
  sel: number;
  next: BuildableType;
  nextFill: Fill;
  build: { idx: number; t0: number; dur: number } | null;
  /** construction in play takes months: each job is a floor going up (or being refitted), one per building */
  jobs?: { idx: number; from: number; to: number; what: 'build' | 'refit' }[];
  /** a transformer shortage stretches power floor builds until this month */
  shortageUntil?: number;
  /** construction crews on contract */
  crews?: number;
  /** how many gas turbines and solar farms you've built */
  units?: { turbines: number; solar: number };
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
  /** lingering good feeling from gifts, and anger from ignored complaints; both fade */
  goodwill: number; grudge: number;
  /** grid the utility has connected for you beyond what the town could spare */
  gridAdded: number;
  /** your place in the utility's interconnection queue */
  gridQueue: { mw: number; done: number; from?: number; paid?: boolean; flex?: boolean } | null;
  /** customers: signed deals, and offers waiting on an answer */
  deals: Deal[];
  offers: Offer[];
  /** the newest chip generation on the market, and when the next one ships */
  chip: number;
  chipAt: number;
  /** size tier, and the most IT power you've run */
  tier: number;
  peakMW: number;
  /** month the reactor comes online, while it's being built */
  smrAt: number | null;
  /** a tier you just reached, until you've seen what it unlocks */
  tierUp: number | null;
  /** sound off */
  muted: boolean;
  /** recent calls: topics, callers and lines, so the phone doesn't repeat itself */
  heard?: string[];
  /** hints on: show predictions (profit changes, targets, forecasts), not just prices and results */
  hints?: boolean;
  /** this quarter so far: cash at the start, the books added up, and money from rewards and loans */
  q?: { cash0: number; sums: Record<string, number>; rewards: number; borrowed: number };
  /** the last quarter's statement, while it's on screen */
  report?: QuarterReport | null;
  /** last quarter's profit or loss, to compare against */
  lastQuarter?: number | null;
  /** the details of a one-off event on screen: a rush order, a poaching attempt */
  event?: { who: string; mw: number; price: number; months: number } | null;
  /** a competing datacenter across town */
  rival?: { name: string; mw: number; since: number } | null;
  /** a milestone you just hit, for the celebration */
  party?: { id: number; text: string } | null;
  /** how hard you push the town grid: 0 fine, 1 tight, 2 brownouts, 3 blackouts */
  gridLevel: number;
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
  /** laws and deals in force, each until a month (1e9 means for good) */
  laws: Law[];
  /** how far each permit has been approved */
  permits: Record<PermitKey, number>;
  /** applications waiting on a decision */
  applying: { key: PermitKey; done: number; reviews?: number }[];
  /** the last decision on each permit, in words, for the Gov tab */
  permitLog: Partial<Record<PermitKey, { ok: boolean | null; text: string }>>;
  inspectAt: number;
  electionAt: number;
  board: Board;
  /** national election (US sites), and who won the last one */
  nationalAt: number;
  admin: 'none' | 'build' | 'green';
  /** one-time story beats already played */
  fired: string[];
  /** times the air regulator caught you running generators */
  strikes: number;
  /** no new alert before this month, so decisions don't pile up */
  calm: number;
  news: Headline | null;
  staff: Staff;
  /** buildings on the campus, and the one new floors go on */
  campus: number;
  bld: number;
  /** index into SPEEDS: 0 paused, 1 normal, 2 fast, 3 fastest */
  speed: number;
  /** someone from town on the phone */
  call: Call | null;

  // ---------- the long game: see strategy.ts ----------
  /** the state's moratorium bill: 0 to 100, passes at 100 */
  bill: { progress: number; stage: number; name: string } | null;
  loans: Loan[];
  market: { phase: 'normal' | 'boom' | 'glut'; until: number };
  /** the wider economy: which phase it's in, and how far costs and prices have moved since you opened */
  econ: { phase: EconPhase; until: number; cost: number; price: number };
  /** things you did that come back later */
  seeds: { id: string; at: number }[];
  /** megalitres of water used since opening */
  waterUsed: number;
  briefing: boolean;
  /** halls running hot for a while */
  boosts: { floor: number; until: number }[];
}

/** One month of the datacenter's books, plus the physical numbers behind them. */
export interface Ledger {
  revenue: number;
  /** income from deals, and from spare capacity sold on the spot market */
  dealIncome: number; spot: number;
  /** credits paid to customers you couldn't supply */
  sla: number;
  /** MW promised to customers who've moved in, and how much of it you delivered */
  promised: number; served: number;
  /** fuel for on-site turbines and the reactor */
  fuel: number;
  power: number;
  water: number;
  staff: number;
  /** repairs and parts, about 1% of what you've built each year */
  upkeep: number;
  /** loan interest (tax-deductible) and the principal paid down */
  interest: number; principal: number;
  propertyTax: number;
  incomeTax: number;
  net: number;
  /** MW of IT load in use, and the most the halls could draw */
  itMW: number; hallMW: number;
  powerMW: number; coolMW: number;
  pe: number; ce: number; eff: number;
  pue: number;
  /** what the site wants from the town grid, what the grid can give, and the ratio */
  gridMW: number; gridCap: number; strain: number;
  /** megalitres of water and tonnes of CO2 per month */
  waterML: number; carbonT: number;
  /** MW made on site, and how much the chips' age cuts what customers pay (1 is all current) */
  onsite: number; chipValue: number;
}

const KEY = 'tiny-datacenter-v5';

/** Price of a floor: taller floors cost a little more to build. */
/** A floor's price: halls by the MW they hold, cooling dearer in hot places, and higher floors cost a little more. */
export const floorPrice = (loc: LocKey, type: FloorType, index: number, hallMW = CHIPS[1].mw) =>
  Math.round(TYPES[type].cost * (type === 'hall' ? hallMW : 1) * (type === 'cool' ? LOCS[loc].coolCost : 1) * (1 + 0.03 * index));

export function fresh(): GameState {
  const floors: Floor[] = (['lobby', 'hall', 'power', 'cool'] as FloorType[]).map((type, i) => ({ type, fill: 'cloth', done: true, cost: floorPrice('dalles', type, i) }));
  return {
    phase: 'setup', step: 'loc', cash: 0,
    loc: 'dalles', found: 'slab', startFound: 'slab', shape: 'box', cust: 'ai',
    inside: false, spin: true, smoke: true, sel: 0, next: 'hall', nextFill: 'cloth', build: null, nid: 1,
    floors,
    workers: [],
    log: [],
    look: { stitch: 'S', outline: '#0045D1', shade: '#99BBFF', accent: '#FF7A45', name: '', owner: '' },
    month: 0, stageMonth: 0, trust: 70, replanted: 0, gridAdded: 0, gridQueue: null, gridLevel: 0, goodwill: 0, grudge: 0,
    deals: [], offers: [], chip: 1, chipAt: 24, tier: 0, peakMW: 0, smrAt: null, tierUp: null, muted: false,
    up: { soundWalls: false, closedLoop: false, renewables: false, solar: false, batteries: false, heat: false, turbines: false, liquid: false, smr: false },
    complaint: null, cooldown: {}, broken: [], goal: 0, debt: 0,
    tally: { profit: 0, fixed: 0, ignored: 0, goals: 0, best: 0 },
    books: null, over: null,
    laws: [], permits: { zoning: 0, height: 0, air: 0, water: 0, campus: 0 }, applying: [], permitLog: {},
    inspectAt: 10, electionAt: 24, board: 'neutral', nationalAt: 34, admin: 'none', fired: [], strikes: 0, calm: 0, news: null,
    staff: { morale: 50, pay: 0, health: false, retire: false, overtime: false, union: false, strike: false, struck: 0, cheer: 0, low: 0, cuts: 0 },
    boosts: [], campus: 1, bld: 0, speed: 1, call: null,
    bill: null, loans: [], market: { phase: 'normal', until: 30 },
    econ: { phase: 'steady', until: 48, cost: 1, price: 1 },
    seeds: [], waterUsed: 0, briefing: false,
  };
}

/** A save from before customers, chips and the grid queue: keep everything built and hand it the new pieces. */
function upgradeOld(old: Record<string, unknown>): Partial<GameState> {
  const saved = { ...old } as Partial<GameState> & Record<string, unknown>;
  const subs = Number(old.substations ?? 0);
  for (const k of ['substations', 'notoriety', 'codename', 'lobby', 'sites', 'contract']) delete saved[k];
  if (saved.up) delete (saved.up as unknown as Record<string, unknown>).fund;
  saved.gridAdded = subs * 20;
  if (saved.phase !== 'play') return saved;
  const s = { ...fresh(), ...saved, deals: [], offers: [] } as GameState;
  const l = ledger(s);
  const m = Math.floor(s.month);
  const kind = s.cust ?? 'ai';
  // the customer you had becomes a deal for most of what you run today
  const mw = Math.max(1, Math.floor(l.itMW * 0.8));
  saved.deals = [{
    id: 1, who: CUSTS[kind].names[0], kind, mw, price: Math.round(marketPrice(s, kind)), months: 36, lead: 0, needs: [],
    expires: m, start: m, until: m + 36, strikes: 0,
  }];
  saved.offers = [];
  saved.peakMW = l.itMW;
  saved.tier = tierOf(l.itMW);
  saved.chipAt = m + 12;
  saved.nid = Math.max(Number(saved.nid ?? 1), 2);
  return saved;
}

export function load(): GameState {
  try {
    let raw = localStorage.getItem(KEY);
    let old = false;
    if (!raw) { raw = localStorage.getItem('tiny-datacenter-v4'); old = !!raw; }
    if (raw) {
      const parsed = JSON.parse(raw);
      const saved = (old ? upgradeOld(parsed) : parsed) as Partial<GameState>;
      const base = fresh();
      return {
        ...base, ...saved,
        look: { ...base.look, ...saved.look }, up: { ...base.up, ...saved.up }, tally: { ...base.tally, ...saved.tally },
        permits: { ...base.permits, ...saved.permits }, permitLog: saved.permitLog ?? {}, staff: { ...base.staff, ...saved.staff },
        econ: { ...base.econ, ...saved.econ },
        build: null,
      };
    }
  } catch { /* storage unavailable */ }
  return fresh();
}

export function save(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export const isBoosted = (s: GameState, i: number) => s.boosts.some(b => b.floor === i && b.until > s.month);

/** Pay level and deals that raise every tech's wage. */
export const wageMult = (s: GameState) =>
  [1, 1.1, 1.2][s.staff.pay] * (s.staff.union ? 1.15 : 1) * (s.staff.overtime ? 1.3 : 1);
/** Monthly benefits per tech. */
export const benefitsPer = (s: GameState) => (s.staff.health ? 1_500 : 0) + (s.staff.retire ? 600 : 0);
export const locals = (s: GameState) => s.workers.filter(w => !w.overseas).length;
export const overseas = (s: GameState) => s.workers.filter(w => w.overseas).length;
/** A local tech's wage: each local you add pushes local wages up 3%, as the town's labor pool runs dry. */
export const wageFor = (s: GameState, n = locals(s)) => TECH_SALARY * (1 + 0.03 * Math.max(0, n - 1)) * wageMult(s);
/** Overseas techs on work visas earn less and don't touch the local wage. */
export const OVERSEAS_WAGE = 0.5;
export const overseasWage = (s: GameState) => TECH_SALARY * OVERSEAS_WAGE * wageMult(s);
/** Monthly staff cost before inflation. */
export const payroll = (s: GameState) =>
  locals(s) * wageFor(s) + overseas(s) * overseasWage(s) + s.workers.length * benefitsPer(s);
/** A work visa: filing and legal fees when you hire, then again every year. */
export const VISA_FEE = 10_000;
/** Recruiting gets harder as you hire more; overseas hires also pay the first year's visa. */
// an overseas agency recruits for less than a local search; the visa is on top
export const hireFee = (s: GameState, abroad = false) => today(s, HIRE_FEE * (1 + 0.15 * s.workers.length) * (abroad ? 0.35 : 1) + (abroad ? VISA_FEE : 0));

/** What the AI market pays compared to normal. */
export const MARKET_MULT = { normal: 1, boom: 1.3, glut: 0.65 } as const;
/** Interest rates move with the market. */
export const MARKET_RATE = { normal: 0.06, boom: 0.05, glut: 0.085 } as const;
/** What a kW a month goes for today, for a kind of customer here. Deals lock this in when signed. */
export const marketPrice = (s: GameState, kind: CustKey) =>
  CUSTS[kind].price * LOCS[s.loc].demand * priceGrowth(s) * MARKET_MULT[s.market.phase];
/** Spare capacity sold by the hour on the spot market: cheap, and it swings with the market. */
export const spotPrice = (s: GameState) => 0.85 * marketPrice(s, 'games');

export const hasLaw = (s: GameState, id: string) => s.laws.some(x => x.id === id && x.until > s.month);

export const ownerName = (s: GameState) => s.look.owner.trim() || 'The owner';
export const siteName = (s: GameState) => s.look.name.trim() || 'the datacenter';

export const note = (s: GameState, line: string) => { s.log = [line, ...s.log].slice(0, 8); };

export function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
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
  const floors = s.floors.reduce((t, f, i) => t + floorPrice(s.loc, f.type, i), 0);
  return { land, found, shape, floors, total: land + found + shape + floors, left: BUDGET - (land + found + shape + floors) };
}

/** Deals customers have moved into and that haven't ended. */
export const liveDeals = (s: GameState) => s.deals.filter(d => d.start <= s.month && d.until > s.month);
/** MW you've promised, now and once everyone signed has moved in. */
export const promisedMW = (s: GameState) => liveDeals(s).reduce((t, d) => t + d.mw, 0);
export const signedMW = (s: GameState) => s.deals.filter(d => d.until > s.month).reduce((t, d) => t + d.mw, 0);
/** Deals rise 2.5% a year from when the customer moved in, like real colocation contracts. */
export const dealPrice = (s: GameState, d: Deal) => d.price * 1.025 ** (Math.max(0, s.month - d.start) / 12);
/** Customers are served in the order they signed. Returns what each live deal gets. */
export function allocate(s: GameState, itMW: number) {
  let left = itMW;
  return liveDeals(s).map(d => { const got = Math.min(d.mw, left); left -= got; return { d, got }; });
}

/** Your size tier, from the most IT power you've run. */
export const tierOf = (mw: number) => TIERS.reduce((k, t, i) => (mw >= t.mw ? i : k), 0);
/** A hall's chip generation; halls from older saves have the first GPUs. */
export const genOf = (f: Floor) => f.gen ?? 1;
/** MW a hall draws when it's full. */
export const hallMWOf = (f: Floor) => CHIPS[Math.min(CHIPS.length - 1, genOf(f))].mw;
/** What customers pay for a hall's chips compared to the newest ones. */
export const chipValue = (s: GameState, f: Floor) => 0.9 ** Math.max(0, s.chip - genOf(f));
/** The newest chips you can fit: without liquid cooling, only the best air-cooled ones. */
export const fitGen = (s: GameState) => (s.up.liquid ? s.chip : Math.min(s.chip, LIQUID_GEN - 1));
/** Halls with chips that need liquid cooling run at half without it. */
export const needsLiquid = (s: GameState, f: Floor) => genOf(f) >= LIQUID_GEN && !s.up.liquid;
/** On-site power: solar, turbines and the reactor. */
export const onsiteMW = (s: GameState) => solarCount(s) * SOLAR_MW + turbineCount(s) * TURBINE_MW + (s.up.smr ? SMR_MW : 0);
/** Turbines and solar farms can be added again and again; older saves had at most one of each. */
export const turbineCount = (s: GameState) => s.units?.turbines ?? (s.up.turbines ? 1 : 0);
export const solarCount = (s: GameState) => s.units?.solar ?? (s.up.solar ? 1 : 0);
/** Things you can build more of, a few months apart. */
export const REPEATABLE = ['turbines', 'solar'] as const;
export const REPEAT_WAIT = 4;
export const unitCost = (s: GameState, key: 'turbines' | 'solar', n: number) => today(s, (key === 'turbines' ? 18_000_000 : 9_000_000) * (1 + 0.2 * n));
export const TURBINE_MW = 12;
export const SMR_MW = 60;

/** What you've built, for property tax. */
export const assets = (s: GameState) =>
  (FOUNDS[s.found].cost + SHAPES[s.shape].cost) * s.campus + s.floors.reduce((t, f) => t + (f.done ? f.cost : 0), 0);

/*
 * The economy moves in phases instead of a straight line. Each phase sets how fast costs (power, wages,
 * parts, construction) and customer prices change a year, what power costs, and where interest rates sit.
 */
export type EconPhase = 'steady' | 'inflation' | 'recession' | 'energy';
export const ECON: Record<EconPhase, { name: string; cost: number; price: number; power: number; rate: number; months: [number, number] }> = {
  steady: { name: 'Steady growth', cost: 0.025, price: 0.02, power: 1, rate: 0, months: [36, 96] },
  inflation: { name: 'Inflation spike', cost: 0.09, price: 0.05, power: 1.1, rate: 0.03, months: [12, 30] },
  recession: { name: 'Recession', cost: 0.005, price: -0.04, power: 0.9, rate: -0.015, months: [12, 24] },
  energy: { name: 'Energy crisis', cost: 0.04, price: 0.02, power: 1.7, rate: 0.01, months: [6, 18] },
};
/** prices never fall more than this far behind costs, so a long run stays playable */
export const SQUEEZE_MAX = 1.2;
export const inflation = (s: GameState) => (s.phase === 'setup' ? 1 : s.econ.cost);
export const priceGrowth = (s: GameState) => (s.phase === 'setup' ? 1 : s.econ.price);
/** One month of the economy's drift. */
export function econDrift(s: GameState) {
  const E = ECON[s.econ.phase];
  s.econ.cost *= (1 + E.cost) ** (1 / 12);
  s.econ.price = Math.min(s.econ.cost, Math.max(s.econ.cost / SQUEEZE_MAX, s.econ.price * (1 + E.price) ** (1 / 12)));
}
/** A price from the data tables, in today's dollars. */
export const today = (s: GameState, base: number) => Math.round(base * inflation(s));

/** Sales tax breaks on equipment knock about 5% off new floors. */
export const taxBreak = (s: GameState) => (hasLaw(s, 'vaExempt') || hasLaw(s, 'azExempt') ? 0.95 : 1);
export const buildCost = (s: GameState) => Math.round(today(s, floorPrice(s.loc, s.next, heightOf(s, s.bld), CHIPS[fitGen(s)].mw)) * taxBreak(s));
// ---------- the campus: several buildings side by side, each with its own stack of floors ----------

/** Buildings that fit on this location's lot (never more than 3). */
export const maxBuildings = (s: GameState) => Math.min(3, LOCS[s.loc].space.buildings);
/** Buildings sit left and right of the first one. */
const BUILDING_X = [0, -12.5, 12.5];
export const bOf = (s: GameState, i: number) => s.floors[i]?.b ?? 0;
export const buildingX = (b: number) => BUILDING_X[b] ?? 0;
/** How far up its own building a floor is: 0 is the ground floor. */
export const level = (s: GameState, i: number) => {
  const b = bOf(s, i);
  let n = 0;
  for (let j = 0; j < i; j++) if ((s.floors[j].b ?? 0) === b) n++;
  return n;
};
export const heightOf = (s: GameState, b: number) => s.floors.filter(f => (f.b ?? 0) === b).length;
export const tallest = (s: GameState) => Math.max(...Array.from({ length: s.campus }, (_, b) => heightOf(s, b)));
/** Where a building's floor of this level sits. */
export const levelY = (s: GameState, lv: number) => FOUNDS[s.found].h + lv * FH;
export const baseY = (s: GameState, i: number) => levelY(s, level(s, i));
export const levelW = (s: GameState, lv: number) => (s.shape === 'tower' ? FW * (1 - Math.min(Math.floor(lv / 3), 3) * 0.12) : FW);
export const floorW = (s: GameState, i: number) => levelW(s, level(s, i));
/** "Floor 4", or "B2 floor 4" on a campus. */
export const floorLabel = (s: GameState, i: number) =>
  s.campus > 1 ? `B${bOf(s, i) + 1} floor ${level(s, i) + 1}` : `Floor ${i + 1}`;
/** A new building: land plus a foundation like the others. */
export const buildingCost = (s: GameState) => today(s, landCost(s.loc, s.found) + FOUNDS[s.found].cost);
export const perRow = (s: GameState, i: number) => Math.max(2, Math.floor((floorW(s, i) - 1.4) / 2));
export const techsOn = (s: GameState, i: number) => s.workers.filter(w => w.floor === i).length;
export const isBroken = (s: GameState, i: number) => s.broken.some(b => b.floor === i);
export const hallCount = (s: GameState) => s.floors.filter(f => f.done && f.type === 'hall').length;

/** Share of a hall running: it takes techs to keep racks up. A hall with no techs can't run. */
export function utilization(s: GameState, i: number) {
  const Sh = SHAPES[s.shape], f = s.floors[i];
  if (!techsOn(s, i) || !f) return 0;
  // overtime squeezes more out of a hall, a boost runs it hot, a strike nearly stops it
  const push = (s.staff.overtime ? 1.1 : 1) * (isBoosted(s, i) ? 1.25 : 1) * (s.staff.strike ? 0.3 : 1) * (needsLiquid(s, f) ? 0.5 : 1);
  const breaks = s.floors.filter(x => x.done && x.type === 'break').length;
  return Math.min(1, 0.35 + 0.22 * techsOn(s, i) * Sh.crew * (1 + 0.1 * breaks)) * push;
}

export function ledger(s: GameState): Ledger {
  const L = LOCS[s.loc], F = FOUNDS[s.found], Sh = SHAPES[s.shape];
  const done = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.done);
  const count = (t: FloorType) => done.filter(o => o.f.type === t).length;
  const halls = done.filter(o => o.f.type === 'hall');
  const working = halls.filter(o => !isBroken(s, o.i));

  const hallMW = halls.reduce((t, o) => t + hallMWOf(o.f), 0);
  const powerMW = count('power') * POWER_MW;
  // hot climates make chillers work harder; liquid cooling carries far more heat
  const coolMW = count('cool') * COOL_MW * F.cool * Sh.cool * (1.2 / L.pue) * (hasLaw(s, 'heat') ? 0.8 : 1) * (s.up.liquid ? 1.5 : 1);
  const pe = hallMW ? Math.min(1, powerMW / hallMW) : 1;
  const ce = hallMW ? Math.min(1, coolMW / hallMW) : 1;
  // halls run as far as the tighter of power and cooling allows
  const eff = Math.min(pe, ce);

  const pue = L.pue + (s.up.closedLoop ? 0.05 : 0) - (s.up.liquid ? 0.05 : 0);
  // in a dry winter the utility caps big users
  const load = working.map(o => ({ mw: hallMWOf(o.f) * utilization(s, o.i), v: chipValue(s, o.f) }));
  const wanted = load.reduce((t, x) => t + x.mw, 0) * eff * (hasLaw(s, 'dry') ? 0.7 : 1);
  const value = wanted ? load.reduce((t, x) => t + x.mw * x.v, 0) / Math.max(1e-9, load.reduce((t, x) => t + x.mw, 0)) : 1;
  // the town grid can only give so much; past that the utility cuts you back
  // on-site power covers part of the load; batteries shave the peaks
  const gridCap = (L.grid + s.gridAdded) * (hasLaw(s, 'curtail') ? 0.9 : 1);
  const onsite = onsiteMW(s);
  const peak = s.up.batteries ? 0.85 : 1;
  const gridMW = Math.max(0, wanted * pue - onsite);
  const strain = (gridMW * peak) / gridCap;
  // a stop-work order after a failed inspection: most servers idle while the bills keep coming
  const stopped = hasLaw(s, 'stopWork');
  const itMW = Math.min(wanted, (gridCap / peak + onsite) / pue) * (stopped ? 0.3 : 1);

  // customers are served in the order they signed; what's left goes to the spot market
  const net = count('net');
  let dealIncome = 0, sla = 0, served = 0, promised = 0;
  for (const { d, got } of allocate(s, itMW)) {
    // picky customers pay less when you don't meet what they asked for
    const green = d.needs.includes('green') && !s.up.renewables && !s.up.solar && !s.up.smr ? 0.8 : 1;
    const fresh = d.needs.includes('fresh') && value < 0.99 ? 0.8 : 1;
    const mult = (1 + 0.08 * net * CUSTS[d.kind].net) * Sh.rev * green * fresh;
    const paid = got * 1000 * dealPrice(s, d) * value * mult;
    dealIncome += paid;
    // credits for what you missed: half its fee, or all of it for strict customers, but never more than they paid
    sla += Math.min(paid, (d.mw - got) * 1000 * d.price * (d.needs.includes('uptime') ? 1 : 0.5));
    served += got;
    promised += d.mw;
  }
  const spare = Math.max(0, itMW - served);
  const spot = spare * 1000 * spotPrice(s) * value * Sh.rev;
  const revenue = dealIncome + spot;

  const infl = inflation(s);
  // on-site power comes first: solar is free, the reactor is cheap, turbines burn gas
  let need = itMW * pue;
  const sun = Math.min(need, solarCount(s) * SOLAR_MW); need -= sun;
  const nuke = Math.min(need, s.up.smr ? SMR_MW : 0); need -= nuke;
  const gas = Math.min(need, turbineCount(s) * TURBINE_MW); need -= gas;
  const fuel = infl * HOURS_PER_MONTH * (gas * 65 + nuke * 25);
  const mwh = need * HOURS_PER_MONTH;
  // a strained grid charges more for peak power
  const surcharge = 1 + 0.5 * Math.max(0, Math.min(strain, 1.2) - 0.6);
  const rate = L.power * surcharge * (s.up.renewables ? 1.05 : 1) * (hasLaw(s, 'priority') ? 1.15 : 1) * (hasLaw(s, 'aepTariff') ? 1.1 : 1)
    + (hasLaw(s, 'vaKwh') ? 11 : 0) + (hasLaw(s, 'seTax') ? 35 : 0);
  const power = infl * mwh * rate * ECON[s.econ.phase].power;
  const litres = itMW * 1000 * HOURS_PER_MONTH * L.water * (s.up.closedLoop || s.up.liquid ? 0.15 : 1);
  const water = infl * (litres / 1000) * L.waterPrice;
  // extra construction crews on contract are paid with the staff
  const staff = infl * (payroll(s) + Math.max(0, crews(s) - 2) * CREW_COST);
  // maintenance runs about 1% of what you've built each year
  const upkeep = (infl * assets(s) * 0.01) / 12;
  // an abatement taxes a fraction of the value, plus a community fee on what it saves
  const propertyTax = ((assets(s) * L.propertyTax) / 12) * (hasLaw(s, 'orAbate') ? 0.475 : 1) * (hasLaw(s, 'txAbate') || hasLaw(s, 'ohAbate') ? 0.4 : 1);
  const interest = s.loans.reduce((t, x) => t + x.balance * x.rate / 12, 0);
  const principal = s.loans.reduce((t, x) => t + Math.min(x.balance, x.payment - x.balance * x.rate / 12), 0);
  const pre = revenue - sla - power - fuel - water - staff - upkeep - interest - propertyTax;
  const incomeTax = Math.max(0, pre) * (hasLaw(s, 'pillar2') ? 0.15 : L.incomeTax);

  return {
    revenue, dealIncome, spot, sla, promised, served, fuel,
    power, water, staff, upkeep, interest, principal, propertyTax, incomeTax, net: pre - incomeTax - principal,
    itMW, hallMW, powerMW, coolMW, pe, ce, eff, pue, gridMW, gridCap, strain,
    waterML: litres / 1e6, carbonT: mwh * L.carbon * (s.up.renewables ? 0.1 : 1) + gas * HOURS_PER_MONTH * 0.45,
    onsite, chipValue: value,
  };
}

/** How the town grid is holding up at a given strain. */
export const gridLevel = (strain: number) => (strain >= 1 ? 3 : strain >= 0.85 ? 2 : strain >= 0.6 ? 1 : 0);
export const GRID_LABEL = ['Fine', 'Tight', 'Brownouts', 'Blackouts'];

/** Monthly profit change from adding a finished floor of this type on top. */
export function buildDelta(s: GameState, type: FloorType) {
  const extra: Floor = { type, fill: 'cloth', done: true, cost: floorPrice(s.loc, type, heightOf(s, s.bld), CHIPS[fitGen(s)].mw), b: s.bld, gen: type === 'hall' ? fitGen(s) : undefined };
  return ledger({ ...s, floors: [...s.floors, extra] }).net - ledger(s).net;
}

/** Monthly profit change from hiring one more tech on a floor, salary included. */
export function hireDelta(s: GameState, floor: number, abroad = false) {
  const w: Worker = { id: -1, name: '', floor, x: 0, dir: 1, speed: 0, pause: 0, overseas: abroad };
  return ledger({ ...s, workers: [...s.workers, w] }).net - ledger(s).net;
}

/** One hall's share of monthly income. */
export function hallIncome(s: GameState, l: Ledger, i: number) {
  if (isBroken(s, i) || !s.floors[i]?.done) return 0;
  const used = s.floors.reduce((t, f, k) => t + (f.done && f.type === 'hall' && !isBroken(s, k) ? utilization(s, k) : 0), 0);
  return used ? (l.revenue * utilization(s, i)) / used : 0;
}

/** Months each kind of floor takes to build. Power gear waits on transformers. */
export const BUILD_MONTHS: Record<FloorType, number> = { hall: 3, power: 6, cool: 3, net: 2, break: 1, lobby: 2 };
export const buildMonths = (s: GameState, type: FloorType) => BUILD_MONTHS[type] * (type === 'power' && (s.shortageUntil ?? 0) > s.month ? 2 : 1);
/** A building with a crew already on it. */
export const busy = (s: GameState, b: number) => (s.jobs ?? []).some(j => bOf(s, j.idx) === b);
/** Construction crews: two to start, more on contract for a monthly fee. */
export const crews = (s: GameState) => s.crews ?? 2;
export const CREW_COST = 150_000;
export const noCrew = (s: GameState) => (s.jobs ?? []).length >= crews(s);
export const jobOn = (s: GameState, i: number) => (s.jobs ?? []).find(j => j.idx === i);

/** Advances money, the calendar, workers, repairs and construction. */
export function simulate(s: GameState, realDt: number, monthSeconds: number, speed = 1): { built: boolean; newMonth: boolean; fixed: boolean } {
  let newMonth = false, fixed = false;
  // game time runs at the chosen speed; people still walk at their own pace
  const dt = realDt * speed;
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
        note(s, `${crew[0].name} fixed ${floorLabel(s, b.floor).toLowerCase()}`);
        s.tally.fixed++;
        fixed = true;
      }
    }
    if (fixed) s.broken = s.broken.filter(b => b.t < 4);
  }
  for (const w of s.workers) {
    const hw = floorW(s, w.floor) / 2 - 0.9;
    if (w.pause > 0) { w.pause -= realDt; continue; }
    w.x += w.dir * w.speed * realDt;
    if (w.x < -hw) { w.x = -hw; w.dir = 1; }
    if (w.x > hw) { w.x = hw; w.dir = -1; }
    if (Math.random() < realDt * 0.35) {
      w.pause = 0.8 + Math.random() * 2.2;
      if (Math.random() < 0.5) w.dir = w.dir === 1 ? -1 : 1;
    }
  }
  if (s.build && Date.now() - s.build.t0 >= s.build.dur) {
    const f = s.floors[s.build.idx];
    f.done = true;
    s.build = null;
    return { built: true, newMonth, fixed };
  }
  // construction crews finish when the months are up
  const due = (s.jobs ?? []).filter(j => s.month >= j.to);
  if (due.length) {
    for (const j of due) {
      const f = s.floors[j.idx];
      if (!f) continue;
      f.done = true;
      note(s, j.what === 'refit' ? `${floorLabel(s, j.idx)} refitted` : `${TYPES[f.type].name} finished on ${floorLabel(s, j.idx).toLowerCase()}`);
    }
    s.jobs = (s.jobs ?? []).filter(j => s.month < j.to);
    return { built: true, newMonth, fixed };
  }
  return { built: false, newMonth, fixed };
}
