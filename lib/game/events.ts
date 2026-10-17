import { FOUNDS, LOCS, MAX_TECHS, SHAPES, type FoundKey } from './data';
import { hallCount, ledger, money, note, techsOn, type GameState, type Ledger } from './state';

export interface Impact { trees: number; cleared: number; waterML: number; carbonT: number }

/** Trees cleared for the site: more land and more floors clear more. */
export function impact(s: GameState, l: Ledger = ledger(s)): Impact {
  const L = LOCS[s.loc];
  const raw = Math.round((FOUNDS[s.found].acres * 0.8 + s.floors.length * 0.6) * SHAPES[s.shape].trees);
  const cleared = Math.max(0, Math.min(L.trees, raw - s.replanted));
  return { trees: L.trees, cleared, waterML: l.waterML, carbonT: l.carbonT };
}

export interface Choice { label: string; cost?: number; apply: (s: GameState) => void }
export interface Complaint {
  id: string;
  from: string;
  title: (s: GameState, i: Impact) => string;
  body: string;
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
    id: 'trees', from: 'Neighbors', wait: 2, sting: 12,
    title: (_, i) => `You cut down ${i.cleared} trees`,
    body: 'They want them replanted.',
    active: (_, i) => i.cleared >= 8,
    choices: [
      { label: 'Plant trees', cost: 200_000, apply: s => { s.replanted += 6; addTrust(s, 8); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'noise', from: 'Neighbors', wait: 3, sting: 10,
    title: () => 'Your fans are too loud',
    body: 'They want a sound wall.',
    active: s => s.floors.length >= 6 && !s.up.soundWalls,
    choices: [
      { label: 'Build a sound wall', cost: 1_500_000, apply: s => { s.up.soundWalls = true; addTrust(s, 6); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'water', from: 'Water board', wait: 2, sting: 12,
    title: () => 'You use too much water',
    body: 'They want you to switch to water-saving cooling.',
    active: (s, i) => i.waterML >= 4 && !s.up.closedLoop,
    choices: [
      { label: 'Switch cooling', cost: 4_000_000, apply: s => { s.up.closedLoop = true; addTrust(s, 8); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'grid', from: 'Power company', wait: 2, sting: 8,
    title: () => 'You are overloading the grid',
    body: 'They want you to buy wind power.',
    active: (s, _, l) => l.itMW >= 10 && !s.up.renewables,
    choices: [
      { label: 'Buy wind power', cost: 3_000_000, apply: s => { s.up.renewables = true; addTrust(s, 6); } },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'carbon', from: 'Newspaper', wait: 4, sting: 8,
    title: () => 'You pollute too much',
    body: 'They are writing a story about you.',
    active: (s, i) => i.carbonT >= 1000 && !s.up.renewables,
    choices: [
      { label: 'Buy offsets', cost: 100_000, apply: s => addTrust(s, 4) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
  {
    id: 'protest', from: 'Protesters', wait: 0, sting: 6,
    title: () => 'People are protesting outside',
    body: 'If trust hits zero, the town shuts you down.',
    active: s => s.trust < 40,
    choices: [
      { label: 'Hold a meeting', cost: 200_000, apply: s => addTrust(s, 12) },
      { label: 'Ignore', apply: () => {} },
    ],
  },
];

/** Upgrades you can buy before anyone complains. */
export const UPGRADES = [
  { key: 'soundWalls', name: 'Sound wall', cost: 1_500_000, note: 'Stops noise complaints.' },
  { key: 'closedLoop', name: 'Water-saving cooling', cost: 4_000_000, note: '85% less water.' },
  { key: 'renewables', name: 'Wind power', cost: 3_000_000, note: '90% less pollution.' },
] as const;
export const REPLANT_COST = 200_000;

const COOLDOWN = 8;

export interface Goal { text: string; hint: string; reward: number; done: (s: GameState, l: Ledger) => boolean }

/** The first goals double as a tutorial. */
export const GOALS: Goal[] = [
  {
    text: 'Hire a tech', reward: 250_000,
    hint: 'Tap the server hall, then tap Hire.',
    done: s => s.workers.length > 0,
  },
  {
    text: 'Earn $250k in a month', reward: 500_000,
    hint: 'More techs means more money.',
    done: s => (s.books?.net ?? 0) >= 250_000,
  },
  {
    text: 'Build a second server hall', reward: 1_000_000,
    hint: 'Tap the bar at the top, then Build. Keep an eye on power and cooling.',
    done: s => hallCount(s) >= 2,
  },
  {
    text: 'Fill a hall with 3 techs', reward: 750_000,
    hint: 'Full halls earn the most.',
    done: s => s.floors.some((f, i) => f.type === 'hall' && techsOn(s, i) >= MAX_TECHS),
  },
  {
    text: 'Keep trust above 50 for 2 years', reward: 2_000_000,
    hint: 'Handle complaints and buy upgrades in Town.',
    done: s => s.month >= 24 && s.trust > 50,
  },
  {
    text: 'Earn $1M in a month', reward: 3_000_000,
    hint: 'Add halls and network floors.',
    done: s => (s.books?.net ?? 0) >= 1_000_000,
  },
  {
    text: 'Build 12 floors', reward: 5_000_000,
    hint: 'You may need a bigger foundation.',
    done: s => s.floors.filter(f => f.done).length >= 12,
  },
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

  // problems nobody has fixed wear down trust; a quiet month builds it back
  const open = COMPLAINTS.filter(c => c.id !== 'protest' && c.active(s, i, l)).length;
  addTrust(s, open ? -1.5 * open : 1);

  // a hall can go down; it's likelier when power or cooling is short or nobody is watching it
  const halls = s.floors.map((f, k) => ({ f, k })).filter(o => o.f.done && o.f.type === 'hall' && !s.broken.some(b => b.floor === o.k));
  for (const { k } of halls) {
    const p = 0.05 + (l.eff < 1 ? 0.15 : 0) + (techsOn(s, k) === 0 ? 0.05 : 0);
    if (s.broken.length < 2 && Math.random() < p) {
      s.broken.push({ floor: k, t: 0 });
      note(s, techsOn(s, k) ? `Floor ${k} is down. Your crew is fixing it.` : `Floor ${k} is down. Tap it to fix.`);
    }
  }

  if (s.cash < 0) {
    s.debt++;
    if (s.debt === 1) note(s, 'You are in debt. 3 months like this and you go bankrupt.');
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
  if (ch.cost && s.cash < ch.cost) return;
  if (ch.cost) s.cash -= ch.cost;
  ch.apply(s);
  if (!ch.cost) {
    addTrust(s, -c.sting);
    s.tally.ignored++;
    note(s, `Trust −${c.sting}`);
  } else {
    note(s, `${ch.label}: −${money(ch.cost)}`);
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
    months: Math.floor(s.month) * 5,
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
