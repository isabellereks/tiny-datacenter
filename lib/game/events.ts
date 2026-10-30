import { FOUND_ORDER, FOUNDS, LOCS, MAX_TECHS, SHAPES, type FoundKey } from './data';
import { govMonth, resolveDecision } from './gov';
import { staffMonth } from './staff';
import { callMonth } from './calls';
import { strategyMonth } from './strategy';
import { dealsMonth, SMR_COST, SMR_MONTHS } from './deals';
import { eventsMonth } from './rival';
import {
  floorLabel, genOf, turbineCount, gridLevel, hasLaw, hallCount, inflation, isBroken, liveDeals, locals, ledger, money, note, ownerName, techsOn, today, utilization,
  type GameState, type Ledger, type Upgrades,
} from './state';

export interface Impact { trees: number; cleared: number; waterML: number; carbonT: number }

/** Trees cleared for the site: more land and more floors clear more. */
export function impact(s: GameState, l: Ledger = ledger(s)): Impact {
  const L = LOCS[s.loc];
  const raw = Math.round((FOUNDS[s.found].acres * s.campus * 0.8 + s.floors.length * 0.6) * SHAPES[s.shape].trees);
  const cleared = Math.max(0, Math.min(L.trees, raw - s.replanted));
  return { trees: L.trees, cleared, waterML: l.waterML, carbonT: l.carbonT };
}

export interface Choice { label: string; cost?: number | ((s: GameState) => number); trust?: number; apply: (s: GameState) => void }
export const choiceCost = (s: GameState, ch: Choice) => (typeof ch.cost === 'function' ? ch.cost(s) : today(s, ch.cost ?? 0));

export interface Complaint {
  id: string;
  from: string;
  title: (s: GameState, i: Impact) => string;
  body: (s: GameState, i: Impact) => string;
  /** true while the problem behind the complaint is still there */
  active: (s: GameState, i: Impact, l: Ledger) => boolean;
  /** months the problem has to last before someone complains */
  wait: number;
  choices: Choice[];
  /** trust lost when ignored */
  sting: number;
}

const siteNameOf = (s: GameState) => s.look.name.trim() || 'the datacenter';
const addTrust = (s: GameState, d: number) => { s.trust = Math.max(0, Math.min(100, s.trust + d)); };
const treesNow = (s: GameState) => impact(s).cleared >= 8;

/** The town only ever complains about the four things it can see, plus protests when trust is low. */
export const COMPLAINTS: Complaint[] = [
  {
    id: 'jobs', from: 'Town council', wait: 2, sting: 10,
    title: () => 'Where are the jobs?',
    body: s => `You promised work, but only ${locals(s)} locals work at ${siteNameOf(s)}.`,
    active: s => hallCount(s) >= 2 && locals(s) < hopedJobs(s) * 0.5,
    choices: [
      { label: 'Hold a job fair', cost: 300_000, trust: 6, apply: s => addTrust(s, 6) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'noise', from: 'Neighbors', wait: 3, sting: 10,
    title: () => 'Your fans hum all night',
    body: s => `People can hear ${siteNameOf(s)} from their bedrooms. They want a sound wall.`,
    active: s => (s.floors.length >= 7 || s.up.turbines) && !s.up.soundWalls,
    choices: [
      { label: 'Build a sound wall', cost: 1_500_000, trust: 6, apply: s => { s.up.soundWalls = true; addTrust(s, 6); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'bills', from: 'Residents', wait: 2, sting: 10,
    title: () => 'Our power bills went up',
    body: s => `The utility blames new demand from ${siteNameOf(s)}. Families want ${ownerName(s)} to help pay.`,
    active: (_, __, l) => l.strain >= 0.6,
    choices: [
      { label: 'Fund bill relief', cost: 1_000_000, trust: 7, apply: s => addTrust(s, 7) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'nature', from: 'Neighbors', wait: 2, sting: 10,
    title: (s, i) => (i.cleared >= 8 ? `You cut down ${i.cleared} trees` : 'You use too much water'),
    body: s => (treesNow(s) ? `They want ${ownerName(s)} to replant them.` : 'The creek is low. They want water-saving cooling.'),
    active: (s, i) => i.cleared >= 8 || (i.waterML >= 4 && !s.up.closedLoop && !s.up.liquid),
    choices: [
      {
        label: 'Fix it', trust: 7, cost: s => today(s, treesNow(s) ? 300_000 : 4_000_000),
        apply: s => { if (treesNow(s)) s.replanted += 8; else s.up.closedLoop = true; addTrust(s, 7); },
      },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'protest', from: 'Protesters', wait: 0, sting: 6,
    title: s => `People are protesting ${ownerName(s)}`,
    body: s => `Their signs say "${ownerName(s).toUpperCase()} OUT". At 0 trust the town shuts you down.`,
    active: s => s.trust < 40,
    choices: [
      { label: 'Hold a town meeting', cost: 200_000, trust: 12, apply: s => addTrust(s, 12) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
];

/** Things you build on the site. Some quiet the town, some make power, some unlock as you grow. */
export const UPGRADES: { key: keyof Upgrades; name: string; cost: number; tier: number; note: string }[] = [
  { key: 'soundWalls', name: 'Sound wall', cost: 1_500_000, tier: 0, note: 'Quiets the fans.' },
  { key: 'closedLoop', name: 'Water-saving cooling', cost: 4_000_000, tier: 0, note: '85% less water.' },
  { key: 'renewables', name: 'Wind power deal', cost: 3_000_000, tier: 0, note: 'Clean power. 90% less CO₂, power +5%.' },
  { key: 'solar', name: 'Solar farm', cost: 9_000_000, tier: 0, note: 'Clean power. +3 MW on site each.' },
  { key: 'batteries', name: 'Batteries', cost: 6_000_000, tier: 0, note: 'Cuts your grid peak 15%.' },
  { key: 'heat', name: 'Heat homes nearby', cost: 5_000_000, tier: 0, note: 'Server heat warms the town.' },
  { key: 'turbines', name: 'Gas turbines', cost: 18_000_000, tier: 1, note: '+12 MW on site each. Loud, and burns gas.' },
  { key: 'liquid', name: 'Liquid cooling', cost: 25_000_000, tier: 2, note: 'For dense chips. Cooling +50%, less water.' },
  { key: 'smr', name: 'Small reactor', cost: SMR_COST, tier: 3, note: `+60 MW of clean power. ${SMR_MONTHS / 12} years to build.` },
];

/** Things you can do for the town again and again, with a wait between them. */
export const GIFTS = [
  { key: 'trees', name: 'Plant trees', cost: 200_000, trust: 3, wait: 0, note: 'Replants 6 trees.' },
  { key: 'school', name: 'Fund the school', cost: 1_000_000, trust: 8, wait: 12, note: 'Once a year.' },
] as const;
export type GiftKey = (typeof GIFTS)[number]['key'];
/** months until a gift can be given again, 0 when ready */
export const giftWait = (s: GameState, key: GiftKey) => Math.max(0, Math.ceil((s.cooldown[`gift-${key}`] ?? 0) - s.month));

/** Jobs the town expects: 2 techs per server hall. */
export const hopedJobs = (s: GameState) => hallCount(s) * 2;

export interface MoodPart { key: 'jobs' | 'noise' | 'bills' | 'nature' | 'deeds' | 'grudge'; label: string; value: number; note: string }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the town thinks of you and why. Trust moves toward `target` a little every month. */
export function townMood(s: GameState, l: Ledger = ledger(s), i: Impact = impact(s, l)) {
  const floors = s.floors.filter(f => f.done).length;
  const techs = locals(s), hoped = hopedJobs(s);
  const loud = (Math.max(0, floors - 5) * 1.2 + Math.min(12, turbineCount(s) * 5)) * (s.up.soundWalls ? 0.4 : 1);
  const parts: MoodPart[] = [
    { key: 'jobs', label: 'Jobs', value: Math.round(clamp((techs - hoped) * 1.5, -20, 8)), note: `${techs} of ${hoped} locals` },
    { key: 'noise', label: 'Noise', value: -Math.round(clamp(loud, 0, 18)), note: s.up.soundWalls ? 'Sound wall' : `${floors} floors${s.up.turbines ? ', turbines' : ''}` },
    { key: 'bills', label: 'Power bills', value: -Math.round(clamp((l.strain - 0.5) * 40, 0, 25)), note: `${Math.round(l.strain * 100)}% of the grid` },
    { key: 'nature', label: 'Nature', value: -Math.round(clamp(i.cleared * 0.5 + i.waterML * 1.5 + i.carbonT / 400, 0, 20)), note: `${i.cleared} trees, ${i.waterML.toFixed(1)} ML water` },
    { key: 'deeds', label: 'Good deeds', value: Math.round(s.goodwill + (s.up.heat ? 6 : 0)), note: 'Fades' },
    { key: 'grudge', label: 'Ignored complaints', value: -Math.round(s.grudge), note: 'Fades' },
  ];
  const BASE = 60;
  const target = clamp(BASE + parts.reduce((t, p) => t + p.value, 0), 0, 100);
  return { base: BASE, parts, target };
}

const COOLDOWN = 6;

const GRID_NEWS: ((s: GameState) => string)[] = [
  () => '',
  () => 'The grid is getting tight. Power costs more.',
  s => `Brownouts in town. People blame ${ownerName(s)}.`,
  () => 'Blackouts in town. The utility is cutting your power.',
];

export interface Goal { text: string; hint: string; reward: number; done: (s: GameState, l: Ledger) => boolean }

const doneFloors = (s: GameState) => s.floors.filter(f => f.done).length;

/** The first goals double as a tutorial; later ones push you through the tiers. */
export const GOALS: Goal[] = [
  { text: 'Hire a tech', reward: 500_000, hint: 'Tap a server hall.', done: s => s.workers.length > 0 },
  { text: 'Sign a customer', reward: 1_000_000, hint: 'Deals tab.', done: s => s.deals.length >= 2 },
  { text: 'Join the grid queue', reward: 2_000_000, hint: 'Build tab.', done: s => !!s.gridQueue || s.gridAdded > 0 },
  { text: 'Make $250K profit in a month', reward: 2_000_000, hint: '', done: s => (s.books?.net ?? 0) >= 250_000 },
  { text: 'Build a second server hall', reward: 4_000_000, hint: 'Build tab.', done: s => hallCount(s) >= 2 },
  { text: 'Run every hall at 100%', reward: 3_000_000, hint: '', done: (s, l) => hallCount(s) >= 2 && l.eff >= 0.999 && s.floors.every((f, i) => f.type !== 'hall' || !f.done || techsOn(s, i) >= MAX_TECHS) },
  { text: 'Grow into colocation', reward: 6_000_000, hint: '', done: s => s.tier >= 1 },
  { text: 'Do something for the town', reward: 1_000_000, hint: 'Town tab.', done: s => s.goodwill > 0.5 || s.up.heat || s.up.soundWalls },
  { text: 'Get staff morale to 70', reward: 2_000_000, hint: 'Staff tab.', done: s => s.workers.length >= 3 && s.staff.morale >= 70 },
  { text: 'Serve 3 customers at once', reward: 5_000_000, hint: 'Deals tab.', done: s => liveDeals(s).length >= 3 },
  { text: 'Refit a hall with new chips', reward: 5_000_000, hint: 'Floors tab.', done: s => s.floors.some(f => (f.gen ?? 1) >= 2) },
  { text: 'Make $1M profit in a month', reward: 10_000_000, hint: '', done: s => (s.books?.net ?? 0) >= 1_000_000 },
  { text: 'Build 12 floors', reward: 15_000_000, hint: '', done: s => doneFloors(s) >= 12 },
  { text: 'Grow into hyperscale', reward: 25_000_000, hint: '', done: s => s.tier >= 2 },
  { text: 'Open a second building', reward: 15_000_000, hint: 'Gov tab, then Build.', done: s => s.campus >= 2 },
  { text: 'Install liquid cooling', reward: 10_000_000, hint: 'Build tab.', done: s => s.up.liquid },
  { text: 'Reach year 10 with trust above 60', reward: 40_000_000, hint: '', done: s => s.month >= 108 && s.trust > 60 },
  { text: 'Make $5M profit in a month', reward: 40_000_000, hint: '', done: s => (s.books?.net ?? 0) >= 5_000_000 },
  { text: 'Make it through an AI crash', reward: 30_000_000, hint: '', done: s => s.fired.includes('glutSurvived') },
  { text: 'Outgrow your rival', reward: 50_000_000, hint: '', done: s => s.fired.includes('rivalBeaten') },
  { text: 'Grow into an AI factory', reward: 100_000_000, hint: '', done: s => s.tier >= 3 },
  { text: 'Switch on your own reactor', reward: 100_000_000, hint: 'Build tab.', done: s => s.up.smr },
  { text: 'Build 40 floors', reward: 150_000_000, hint: '', done: s => doneFloors(s) >= 40 },
];

/** Checks the current goal and pays out when it's met. */
export function checkGoal(s: GameState, l: Ledger) {
  const g = GOALS[s.goal];
  if (!g || !g.done(s, l)) return false;
  s.cash += g.reward;
  if (s.q) s.q.rewards += g.reward;
  s.goal++;
  s.tally.goals++;
  note(s, `Goal complete: +${money(g.reward)}`);
  return true;
}

/** Runs once at the end of each month: books, trust, outages, complaints and endings. */
export function endOfMonth(s: GameState) {
  const l = ledger(s);
  s.books = l;
  const i = impact(s, l);

  // trust drifts toward what the town thinks of you; gifts and grudges fade
  s.tally.best = Math.max(s.tally.best, rating(s, l).total);
  const mood = townMood(s, l, i);
  addTrust(s, (mood.target - s.trust) * 0.2);
  s.goodwill *= 0.95;
  s.grudge *= 0.97;

  // the grid reacts to how hard you push it, and the town feels it at home
  const lvl = gridLevel(l.strain);
  if (lvl > s.gridLevel) note(s, GRID_NEWS[lvl](s));
  else if (lvl === 0 && s.gridLevel > 0) note(s, 'The grid is back to normal');
  s.gridLevel = lvl;
  if (lvl === 2) addTrust(s, -1.5);
  if (lvl === 3) addTrust(s, -3);

  // a hall can go down, and there is always a reason. With backup gear a healthy hall rarely fails;
  // short power or cooling, a strained grid, old chips and no one watching make it likely
  const halls = s.floors.map((f, k) => ({ f, k })).filter(o => o.f.done && o.f.type === 'hall' && !s.broken.some(b => b.floor === o.k));
  const before = s.broken.length;
  for (const { f, k } of halls) {
    const gens = Math.max(0, s.chip - genOf(f));
    const causes: [string, number][] = [
      ['A power supply failed', 0.003],
      [`Old chips failing (${gens} ${gens === 1 ? 'generation' : 'generations'} behind)`, gens * 0.01],
      [l.pe <= l.ce ? 'Not enough electrical floors for the halls' : 'Not enough cooling for the halls', l.eff < 1 ? 0.08 : 0],
      [lvl === 3 ? 'Blackout on the town grid' : 'Brownout on the town grid', [0, 0, 0.05, 0.1][lvl]],
      ['No tech watching it', techsOn(s, k) === 0 ? 0.02 : 0],
    ];
    const p = causes.reduce((t, c) => t + c[1], 0);
    if (s.broken.length < 2 && Math.random() < p) {
      // name the cause, likelier ones more often
      let r = Math.random() * p;
      const why = (causes.find(c => (r -= c[1]) < 0) ?? causes[0])[0];
      s.broken.push({ floor: k, t: 0, why });
      note(s, `${floorLabel(s, k)} is down: ${why.toLowerCase()}`);
    }
  }

  // cascades: say out loud when one problem caused the next
  const newDown = s.broken.length - before;
  if (newDown > 0 && hasLaw(s, 'heat') && !s.fired.includes(`heat-${Math.floor(s.month / 12)}`)) {
    s.fired.push(`heat-${Math.floor(s.month / 12)}`);
    s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Breaking news', headline: `Heat wave knocks ${siteNameOf(s)} offline`, ticker: ['Chillers could not keep up', 'Customers left waiting', 'Techs work through the night'] };
  }
  if (newDown > 0 && lvl === 3) note(s, 'Blackout in town took floors down with it');

  if (s.cash < 0) {
    s.debt++;
    if (s.debt === 1) note(s, 'You are in the red. After 3 months like this you go bankrupt.');
  } else s.debt = 0;

  if (s.trust <= 0) { endGame(s, 'town'); return; }
  if (s.debt >= 3) { endGame(s, 'broke'); return; }

  // every system runs every month; the first one with a question gets to ask it
  dealsMonth(s, l);
  quarterMonth(s, l);
  milestones(s, l);
  const asks = [govMonth(s, l), staffMonth(s), strategyMonth(s, l), eventsMonth(s, l)];
  // the bank calls the first month you're in the red, before anything else
  const rescue = s.debt === 1 && (s.cooldown.rescue ?? 0) <= s.month ? 'rescue' : null;
  const decision = rescue ?? asks.find(x => x) ?? null;
  if (Math.floor(s.month) % 12 === 0 && s.month >= 12) s.briefing = true;
  if (s.phase !== 'play') return;
  // one thing at a time: a letter waits behind the briefing, and the phone only rings on a quiet month
  if (decision) s.complaint = decision;
  else if (!s.complaint && s.month >= s.calm) {
    const atSize = s.month - s.stageMonth;
    const c = COMPLAINTS.find(x => (s.cooldown[x.id] ?? 0) <= s.month && x.active(s, i, l) && atSize >= x.wait);
    if (c) s.complaint = c.id;
  }
  if (!s.complaint && !s.briefing && !s.report && s.tierUp === null && s.month >= s.calm) callMonth(s);
}

/** Big moments, once each: the game throws a little party. */
const MILESTONES: { id: string; text: string; hit: (s: GameState, l: Ledger) => boolean }[] = [
  { id: 'm1m', text: 'First $1M month', hit: (_, l) => l.net >= 1_000_000 },
  { id: 'm5m', text: 'A $5M month', hit: (_, l) => l.net >= 5_000_000 },
  { id: 'mw10', text: '10 MW running', hit: (_, l) => l.itMW >= 10 },
  { id: 'mw25', text: '25 MW running', hit: (_, l) => l.itMW >= 25 },
  { id: 'mw50', text: '50 MW running', hit: (_, l) => l.itMW >= 50 },
  { id: 'mw100', text: '100 MW running', hit: (_, l) => l.itMW >= 100 },
  { id: 'f10', text: '10 floors', hit: s => s.floors.length >= 10 },
  { id: 'f20', text: '20 floors', hit: s => s.floors.length >= 20 },
  { id: 'f30', text: '30 floors', hit: s => s.floors.length >= 30 },
  { id: 'f40', text: '40 floors', hit: s => s.floors.length >= 40 },
  { id: 'c100', text: '$100M in the bank', hit: s => s.cash >= 100_000_000 },
  { id: 'c1b', text: 'A billion in the bank', hit: s => s.cash >= 1_000_000_000 },
];

function milestones(s: GameState, l: Ledger) {
  const m = MILESTONES.find(x => !s.fired.includes(x.id) && x.hit(s, l));
  if (!m) return;
  s.fired.push(m.id);
  s.party = { id: (s.party?.id ?? 0) + 1, text: m.text };
  note(s, m.text);
}

const Q_LINES: { key: keyof Ledger; label: string; income?: boolean }[] = [
  { key: 'dealIncome', label: 'Customers', income: true },
  { key: 'spot', label: 'Spot market', income: true },
  { key: 'sla', label: 'Credits to customers' },
  { key: 'power', label: 'Power' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'water', label: 'Water' },
  { key: 'staff', label: 'Staff' },
  { key: 'upkeep', label: 'Upkeep' },
  { key: 'propertyTax', label: 'Property tax' },
  { key: 'incomeTax', label: 'Profit tax' },
  { key: 'interest', label: 'Loan interest' },
  { key: 'principal', label: 'Loan principal' },
];

/** Adds the month to the quarter, and every three months writes up the statement. */
function quarterMonth(s: GameState, l: Ledger) {
  s.q ??= { cash0: s.cash, sums: {}, rewards: 0, borrowed: 0 };
  for (const x of Q_LINES) s.q.sums[x.key] = (s.q.sums[x.key] ?? 0) + Number(l[x.key]);
  const m = Math.floor(s.month);
  if (m % 3 !== 0 || m === 0) return;
  const q = s.q;
  const income = Q_LINES.filter(x => x.income && q.sums[x.key] > 0).map(x => ({ label: x.label, value: q.sums[x.key] }));
  const costs = Q_LINES.filter(x => !x.income && q.sums[x.key] > 0).map(x => ({ label: x.label, value: q.sums[x.key] }));
  const operating = income.reduce((t, x) => t + x.value, 0) - costs.reduce((t, x) => t + x.value, 0);
  const change = s.cash - q.cash0;
  const spent = Math.min(0, change - operating - q.rewards - q.borrowed);
  const qn = Math.floor(((m - 1) % 12) / 3) + 1;
  s.report = {
    label: `Q${qn}, year ${Math.floor((m - 1) / 12) + 1}`, income, costs, operating, spent: -spent, rewards: q.rewards, borrowed: q.borrowed,
    change, prev: s.lastQuarter ?? null,
  };
  s.lastQuarter = change;
  s.q = { cash0: s.cash, sums: {}, rewards: 0, borrowed: 0 };
}

export function resolveComplaint(s: GameState, choice: number) {
  if (resolveDecision(s, choice)) return;
  const c = COMPLAINTS.find(x => x.id === s.complaint);
  if (!c) return;
  const ch = c.choices[choice];
  const cost = choiceCost(s, ch);
  if (s.cash < cost) return;
  s.cash -= cost;
  ch.apply(s);
  if (cost) s.goodwill += (ch.trust ?? 0) / 2;
  if (!cost) {
    addTrust(s, -c.sting);
    s.grudge += c.sting / 2;
    s.tally.ignored++;
    note(s, `Ignored ${c.from.toLowerCase()}. Trust −${c.sting}`);
  } else {
    note(s, `${ch.label}. Trust +${ch.trust ?? 0}`);
  }
  s.cooldown[c.id] = s.month + COOLDOWN;
  s.complaint = null;
  s.calm = s.month + 1;
  if (s.trust <= 0) endGame(s, 'town');
}

export function endGame(s: GameState, reason: 'town' | 'broke') {
  s.phase = 'over';
  s.over = { reason, t0: Date.now(), done: reason === 'broke' };
  s.complaint = null;
  s.inside = false;
  s.spin = false;
  note(s, reason === 'town' ? 'The town shut you down' : 'You went bankrupt');
}

/** How well the datacenter is run right now, 0 to 100. It doesn't grow on its own; it moves with your choices. */
export function rating(s: GameState, l: Ledger = ledger(s)) {
  const halls = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.done && o.f.type === 'hall');
  const running = halls.length
    ? (halls.reduce((t, o) => t + (isBroken(s, o.i) ? 0 : utilization(s, o.i)), 0) / halls.length) * l.eff
    : 0;
  // keeping promises to customers counts most once you have some
  const kept = l.promised > 0 ? l.served / l.promised : running;
  const hoped = hopedJobs(s);
  const parts = {
    trust: (s.trust / 100) * 30,
    profit: Math.max(0, Math.min(1, l.revenue ? l.net / l.revenue / 0.4 : 0)) * 25,
    running: kept * 20,
    jobs: (hoped ? Math.min(1, locals(s) / hoped) : 1) * 15,
    grid: (1 - Math.max(0, Math.min(1, (l.strain - 0.6) / 0.4))) * 10,
  };
  const total = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  return { total, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])) as Record<keyof typeof parts, number> };
}

/** Rating as 0 to 5 stars. */
export const stars = (r: number) => Math.round(r / 20 * 2) / 2;

export function nextFoundation(s: GameState): FoundKey | null {
  return FOUND_ORDER[FOUND_ORDER.indexOf(s.found) + 1] ?? null;
}

/** Moving to a bigger foundation: the new foundation plus the extra land it needs. */
export const foundationUpgradeCost = (s: GameState, to: FoundKey) =>
  Math.round(inflation(s) * s.campus * (FOUNDS[to].cost + LOCS[s.loc].land * Math.max(0, FOUNDS[to].acres - FOUNDS[s.found].acres)));
