import { FOUNDS, LOCS, MAX_TECHS, SHAPES, SUBSTATION_COST, type FoundKey } from './data';
import { gridLevel, hallCount, ledger, money, note, ownerName, techsOn, type GameState, type Ledger } from './state';

export interface Impact { trees: number; cleared: number; waterML: number; carbonT: number }

/** Trees cleared for the site: more land and more floors clear more. */
export function impact(s: GameState, l: Ledger = ledger(s)): Impact {
  const L = LOCS[s.loc];
  const raw = Math.round((FOUNDS[s.found].acres * 0.8 + s.floors.length * 0.6) * SHAPES[s.shape].trees);
  const cleared = Math.max(0, Math.min(L.trees, raw - s.replanted));
  return { trees: L.trees, cleared, waterML: l.waterML, carbonT: l.carbonT };
}

export interface Choice { label: string; cost?: number | ((s: GameState) => number); trust?: number; apply: (s: GameState) => void }
export const choiceCost = (s: GameState, ch: Choice) => (typeof ch.cost === 'function' ? ch.cost(s) : ch.cost ?? 0);

/** Each substation costs more than the last. */
export const substationCost = (s: GameState) => SUBSTATION_COST * (1 + s.substations);
export interface Complaint {
  id: string;
  from: string;
  title: (s: GameState, i: Impact) => string;
  body: (s: GameState) => string;
  /** true while the problem behind the complaint is still there */
  active: (s: GameState, i: Impact, l: Ledger) => boolean;
  /** months the problem has to last before someone complains */
  wait: number;
  choices: Choice[];
  /** trust lost when ignored */
  sting: number;
}

const addTrust = (s: GameState, d: number) => { s.trust = Math.max(0, Math.min(100, s.trust + d)); };

export const COMPLAINTS: Complaint[] = [
  {
    id: 'trees', from: 'Neighbors', wait: 4, sting: 12,
    title: (_, i) => `You cut down ${i.cleared} trees`,
    body: s => `They want ${ownerName(s)} to replant them.`,
    active: (_, i) => i.cleared >= 8,
    choices: [
      { label: 'Plant trees', cost: 200_000, trust: 8, apply: s => { s.replanted += 6; addTrust(s, 8); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'noise', from: 'Neighbors', wait: 6, sting: 10,
    title: () => 'Your fans are too loud',
    body: s => `They want ${ownerName(s)} to build a sound wall.`,
    active: s => s.floors.length >= 6 && !s.up.soundWalls,
    choices: [
      { label: 'Build a sound wall', cost: 1_500_000, trust: 6, apply: s => { s.up.soundWalls = true; addTrust(s, 6); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'water', from: 'Water board', wait: 4, sting: 12,
    title: () => 'You use too much water',
    body: s => `They want ${ownerName(s)} to switch to water-saving cooling.`,
    active: (s, i) => i.waterML >= 4 && !s.up.closedLoop,
    choices: [
      { label: 'Switch cooling', cost: 4_000_000, trust: 8, apply: s => { s.up.closedLoop = true; addTrust(s, 8); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'grid', from: 'Power company', wait: 2, sting: 10,
    title: () => 'You are straining the grid',
    body: s => `${ownerName(s)} is using ${Math.round(ledger(s).strain * 100)}% of what the town grid can give. They want you to pay for a substation.`,
    active: (_, __, l) => l.strain >= 0.85,
    choices: [
      { label: 'Pay for a substation', cost: substationCost, trust: 6, apply: s => { s.substations++; addTrust(s, 6); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'jobs', from: 'Town council', wait: 3, sting: 10,
    title: () => 'Where are the jobs?',
    body: s => `You promised work, but only ${s.workers.length} people work at ${s.look.name.trim() || 'the datacenter'}. They want ${ownerName(s)} to hire locals.`,
    active: s => hallCount(s) >= 2 && s.workers.length < hopedJobs(s) * 0.5,
    choices: [
      { label: 'Hold a job fair', cost: 300_000, trust: 6, apply: s => addTrust(s, 6) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'carbon', from: 'Newspaper', wait: 8, sting: 8,
    title: s => `${ownerName(s)} named a top polluter`,
    body: () => 'The paper is running a story about your CO₂.',
    active: (s, i) => i.carbonT >= 1000 && !s.up.renewables,
    choices: [
      { label: 'Buy offsets', cost: 100_000, trust: 4, apply: s => addTrust(s, 4) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'protest', from: 'Protesters', wait: 0, sting: 6,
    title: s => `People are protesting ${ownerName(s)}`,
    body: s => `Their signs say "${ownerName(s).toUpperCase()} OUT". At 0 trust the town shuts you down.`,
    active: s => s.trust < 40,
    choices: [
      { label: 'Hold a meeting', cost: 200_000, trust: 12, apply: s => addTrust(s, 12) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
];

/** One-time projects. Each one fixes a problem before anyone complains, and the town notices. */
export const UPGRADES = [
  { key: 'soundWalls', name: 'Sound wall', cost: 1_500_000, note: 'No more noise complaints.' },
  { key: 'closedLoop', name: 'Water-saving cooling', cost: 4_000_000, note: '85% less water. Uses a bit more power.' },
  { key: 'renewables', name: 'Wind power deal', cost: 3_000_000, note: '90% less CO₂. Power costs 5% more.' },
  { key: 'solar', name: 'Solar farm', cost: 9_000_000, note: 'Makes 3 MW. Less load on the grid.' },
  { key: 'batteries', name: 'Batteries', cost: 6_000_000, note: 'Cuts your peak load on the grid by 15%.' },
  { key: 'heat', name: 'Heat homes nearby', cost: 5_000_000, note: 'Server heat warms the town. Trust +1/mo.' },
] as const;
export const UPGRADE_TRUST = 4;
export const REPLANT_COST = 200_000;

/** Things you can do for the town again and again, with a wait between some of them. */
export const GIFTS = [
  { key: 'trees', name: 'Plant trees', cost: REPLANT_COST, trust: 3, wait: 0, note: 'Replants 6 trees.' },
  { key: 'openHouse', name: 'Open house', cost: 150_000, trust: 3, wait: 6, note: 'Show people around. Every 6 months.' },
  { key: 'school', name: 'Fund the school', cost: 1_000_000, trust: 8, wait: 12, note: 'Once a year.' },
] as const;
export type GiftKey = (typeof GIFTS)[number]['key'];
/** months until a gift can be given again, 0 when ready */
export const giftWait = (s: GameState, key: GiftKey) => Math.max(0, Math.ceil((s.cooldown[`gift-${key}`] ?? 0) - s.month));

/** Jobs the town expects from a building this size: about 2 techs per hall plus a few more. */
export const hopedJobs = (s: GameState) =>
  Math.round(hallCount(s) * 2 + s.floors.filter(f => f.done).length * 0.3);

export interface MoodPart { label: string; value: number; note: string }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What the town thinks of you and why. Trust moves toward `target` a little every month. */
export function townMood(s: GameState, l: Ledger = ledger(s), i: Impact = impact(s, l)) {
  const floors = s.floors.filter(f => f.done).length;
  const techs = s.workers.length;
  // big buildings promise jobs; the town expects about 2 techs per hall plus a few more
  const hoped = hopedJobs(s);
  const loud = s.up.soundWalls ? 0 : Math.max(0, floors - 5);
  const parts: MoodPart[] = [
    { label: 'Local jobs', value: Math.round(clamp((techs - hoped) * 1.5, -20, 6)), note: `${techs} of ${hoped} hoped for` },
    { label: 'Noise', value: -Math.round(clamp(loud * 1.5, 0, 15)), note: s.up.soundWalls ? 'Sound wall' : `${floors} floors of fans` },
    { label: 'Trees cut', value: -Math.round(clamp(i.cleared * 0.6, 0, 15)), note: `${i.cleared} trees` },
    { label: 'Water', value: -Math.round(clamp(i.waterML * 2, 0, 15)), note: `${i.waterML.toFixed(1)} ML a month` },
    { label: 'Power bills', value: -Math.round(clamp((l.strain - 0.5) * 40, 0, 25)), note: `Grid ${Math.round(l.strain * 100)}% used` },
    { label: 'Pollution', value: -Math.round(clamp(i.carbonT / 150, 0, 12)), note: `${Math.round(i.carbonT).toLocaleString()} t CO₂ a month` },
    { label: 'Taxes paid', value: Math.round(clamp(l.propertyTax / 20_000, 0, 10)), note: `${money(l.propertyTax)} a month` },
    { label: 'Heat for homes', value: s.up.heat ? 8 : 0, note: 'Server heat' },
    { label: 'Community fund', value: s.up.fund ? 8 : 0, note: '$100k a month' },
    { label: 'Gifts', value: Math.round(s.goodwill), note: 'Fades over time' },
    { label: 'Ignored complaints', value: -Math.round(s.grudge), note: 'Fades slowly' },
  ];
  const BASE = 60;
  const target = clamp(BASE + parts.reduce((t, p) => t + p.value, 0), 0, 100);
  return { base: BASE, parts: parts.filter(p => p.value !== 0), target };
}

const COOLDOWN = 10;

const GRID_NEWS: ((s: GameState) => string)[] = [
  () => '',
  () => 'The grid is getting tight. Power costs more.',
  s => `Brownouts in town. People blame ${ownerName(s)}.`,
  () => 'Blackouts in town. The utility is cutting your power.',
];

export interface Goal { text: string; hint: string; reward: number; done: (s: GameState, l: Ledger) => boolean }

const doneFloors = (s: GameState) => s.floors.filter(f => f.done).length;
const has = (s: GameState, type: string) => s.floors.some(f => f.done && f.type === type);

/** The first goals double as a tutorial; later ones push you to grow without angering the town. */
export const GOALS: Goal[] = [
  { text: 'Hire a tech', reward: 500_000, hint: 'Tap the server hall, then tap Hire.', done: s => s.workers.length > 0 },
  { text: 'Make $250k profit in a month', reward: 2_000_000, hint: 'Each tech brings more customers into the hall.', done: s => (s.books?.net ?? 0) >= 250_000 },
  { text: 'Build a second server hall', reward: 5_000_000, hint: 'Open the top bar and tap Build. Each hall needs power and cooling.', done: s => hallCount(s) >= 2 },
  { text: 'Run every hall at 100%', reward: 3_000_000, hint: 'Halls need enough power and cooling. Check the meters in Build.', done: (s, l) => hallCount(s) >= 2 && l.eff >= 0.999 },
  { text: 'Fill a hall with 3 techs', reward: 3_000_000, hint: 'A hall with 3 techs is 100% in use.', done: s => s.floors.some((f, i) => f.type === 'hall' && techsOn(s, i) >= MAX_TECHS) },
  { text: 'Do something for the town', reward: 1_000_000, hint: 'Open Town and pick something under Help the town.', done: s => s.goodwill > 0.5 || s.up.fund },
  { text: 'Build a network floor', reward: 2_000_000, hint: 'Network floors make every hall earn more.', done: s => has(s, 'net') },
  { text: 'Fix an outage', reward: 1_500_000, hint: 'When a floor goes down, tap it. Techs fix their own floor.', done: s => s.tally.fixed >= 1 },
  { text: 'Give the town the jobs it hoped for', reward: 6_000_000, hint: 'The Staff tab shows how many jobs the town expects.', done: s => hallCount(s) >= 2 && s.workers.length >= hopedJobs(s) },
  { text: 'Finish a project in Town', reward: 4_000_000, hint: 'Projects stop complaints before they start.', done: s => UPGRADES.some(u => s.up[u.key]) },
  { text: 'Run 4 server halls', reward: 12_000_000, hint: 'Watch the town grid as you grow.', done: s => hallCount(s) >= 4 },
  { text: 'Make $1M profit in a month', reward: 15_000_000, hint: 'Add more halls, plus network floors to raise prices.', done: s => (s.books?.net ?? 0) >= 1_000_000 },
  { text: 'Reach year 5 with trust above 50', reward: 10_000_000, hint: 'Answer complaints and keep an eye on What the town thinks.', done: s => s.month >= 48 && s.trust > 50 },
  { text: 'Pay for a substation', reward: 5_000_000, hint: 'More grid means no brownouts in town.', done: s => s.substations >= 1 },
  { text: 'Upgrade your foundation', reward: 10_000_000, hint: 'When all floors are used, Build offers a bigger foundation.', done: s => s.found !== s.startFound },
  { text: 'Build 12 floors', reward: 25_000_000, hint: 'Taller buildings make more noise. A sound wall helps.', done: s => doneFloors(s) >= 12 },
  { text: 'Make $3M profit in a month', reward: 40_000_000, hint: 'Full halls, lots of network floors, and a happy town.', done: s => (s.books?.net ?? 0) >= 3_000_000 },
  { text: 'Finish every project in Town', reward: 30_000_000, hint: 'Solar, batteries and heat reuse all help.', done: s => UPGRADES.every(u => s.up[u.key]) },
  { text: 'Reach year 10 with trust above 70', reward: 50_000_000, hint: 'Big and loved. That is the whole game.', done: s => s.month >= 108 && s.trust > 70 },
  { text: 'Build 20 floors', reward: 80_000_000, hint: 'You will need steel piles or bedrock.', done: s => doneFloors(s) >= 20 },
];

/** Checks the current goal and pays out when it's met. */
export function checkGoal(s: GameState, l: Ledger) {
  const g = GOALS[s.goal];
  if (!g || !g.done(s, l)) return false;
  s.cash += g.reward;
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

  // a hall can go down; it's likelier when power, cooling or the grid is short, or nobody is watching it
  const halls = s.floors.map((f, k) => ({ f, k })).filter(o => o.f.done && o.f.type === 'hall' && !s.broken.some(b => b.floor === o.k));
  for (const { k } of halls) {
    const p = 0.015 + (l.eff < 1 ? 0.08 : 0) + [0, 0, 0.05, 0.1][lvl] + (techsOn(s, k) === 0 ? 0.02 : 0);
    if (s.broken.length < 2 && Math.random() < p) {
      s.broken.push({ floor: k, t: 0 });
      note(s, techsOn(s, k) ? `Floor ${k + 1} is down. Your techs are fixing it.` : `Floor ${k + 1} is down`);
    }
  }

  if (s.cash < 0) {
    s.debt++;
    if (s.debt === 1) note(s, 'You are in debt. After 3 months in debt you go bankrupt.');
  } else s.debt = 0;

  if (s.trust <= 0) { endGame(s, 'town'); return; }
  if (s.debt >= 3) { endGame(s, 'broke'); return; }

  if (s.complaint) return;
  const atSize = s.month - s.stageMonth;
  for (const c of COMPLAINTS) {
    if ((s.cooldown[c.id] ?? 0) > s.month) continue;
    if (c.active(s, i, l) && atSize >= c.wait) {
      s.complaint = c.id;
      return;
    }
  }
}

export function resolveComplaint(s: GameState, choice: number) {
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

/** Score: profit and time survived, plus goals and fixes, minus every complaint you ignored. */
export function score(s: GameState) {
  const parts = {
    profit: Math.round(Math.max(0, s.tally.profit) / 100_000),
    months: Math.floor(s.month) * 2,
    goals: s.tally.goals * 100,
    fixed: s.tally.fixed * 20,
    ignored: -s.tally.ignored * 150,
  };
  return { total: Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0)), parts };
}

export function nextFoundation(s: GameState): FoundKey | null {
  const order: FoundKey[] = ['slab', 'raised', 'piles', 'bedrock'];
  return order[order.indexOf(s.found) + 1] ?? null;
}

/** Moving to a bigger foundation: the new foundation plus the extra land it needs. */
export const foundationUpgradeCost = (s: GameState, to: FoundKey) =>
  FOUNDS[to].cost + LOCS[s.loc].land * Math.max(0, FOUNDS[to].acres - FOUNDS[s.found].acres);
