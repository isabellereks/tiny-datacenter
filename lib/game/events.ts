import { CUSTS, FOUNDS, LOCS, type FoundKey } from './data';
import { money, note, stats, type GameState } from './state';

/** Real seconds per in-game day. */
export const DAY_SECONDS = 12;

export interface Impact {
  trees: number;
  cleared: number;
  water: number;
  carbon: number;
}

const FOUND_TIER: Record<FoundKey, number> = { slab: 0, raised: 1, piles: 2, bedrock: 3 };

export function impact(s: GameState): Impact {
  const L = LOCS[s.loc];
  const floors = s.floors.length;
  const raw = Math.round(1.2 * floors + FOUND_TIER[s.found] * 1.5 + Math.max(0, floors - 6) * 0.8);
  const cleared = Math.max(0, Math.min(L.trees, raw - s.replanted));
  const cools = s.floors.filter(f => f.done && f.type === 'cool').length;
  const water = cools * L.water * (s.up.closedLoop ? 0.3 : 1);
  const carbon = stats(s).demand * L.carbon * (s.up.renewables ? 0.3 : 1);
  return { trees: L.trees, cleared, water, carbon };
}

export interface Choice { label: string; cost?: number; apply: (s: GameState) => void }
export interface Complaint {
  id: string;
  from: string;
  title: (s: GameState, i: Impact) => string;
  body: string;
  when: (s: GameState, i: Impact, daysAtStage: number) => boolean;
  choices: Choice[];
}

const rep = (s: GameState, d: number) => { s.rep = Math.max(0, Math.min(100, s.rep + d)); };

export const COMPLAINTS: Complaint[] = [
  {
    id: 'trees', from: 'Friends of the Forest',
    title: (_, i) => `You’ve cleared ${i.cleared} trees`,
    body: 'People walk their dogs out here. They want the woods back.',
    when: (_, i, d) => i.cleared >= 6 && d >= 2,
    choices: [
      { label: 'Plant a grove', cost: 600, apply: s => { s.replanted += 5; rep(s, 8); } },
      { label: 'Ignore', apply: s => rep(s, -12) },
    ],
  },
  {
    id: 'noise', from: 'Your neighbors',
    title: () => 'The fans hum all night',
    body: 'Three households signed a letter. Nobody has slept since floor five.',
    when: (s, _, d) => s.floors.length >= 5 && d >= 3 && !s.up.soundWalls,
    choices: [
      { label: 'Build sound walls', cost: 500, apply: s => { s.up.soundWalls = true; rep(s, 6); } },
      { label: 'Ignore', apply: s => rep(s, -10) },
    ],
  },
  {
    id: 'water', from: 'County water board',
    title: (_, i) => `Your cooling drinks ${i.water.toFixed(1)} ML a day`,
    body: 'That’s a lot of water during a dry year. The board wants a plan.',
    when: (s, i, d) => i.water >= 1.5 && d >= 2 && !s.up.closedLoop,
    choices: [
      { label: 'Closed-loop cooling', cost: 900, apply: s => { s.up.closedLoop = true; rep(s, 8); } },
      { label: 'Ignore', apply: s => rep(s, -10) },
    ],
  },
  {
    id: 'grid', from: 'The utility',
    title: () => 'You’re straining the grid',
    body: 'Brownouts hit the neighborhood twice this week. They’d like you to bring your own power.',
    when: (s, _, d) => stats(s).demand >= 6 && d >= 2 && !s.up.renewables,
    choices: [
      { label: 'Sign a wind contract', cost: 1200, apply: s => { s.up.renewables = true; rep(s, 6); } },
      { label: 'Ignore', apply: s => rep(s, -8) },
    ],
  },
  {
    id: 'carbon', from: 'A local reporter',
    title: (_, i) => `${i.carbon.toFixed(1)} tons of CO₂ a day`,
    body: 'They’re running a story on the town’s biggest polluters. You made the list.',
    when: (s, i) => i.carbon >= 2.5 && s.day >= 8,
    choices: [
      { label: 'Buy offsets', cost: 400, apply: s => rep(s, 4) },
      { label: 'No comment', apply: s => rep(s, -8) },
    ],
  },
  {
    id: 'protest', from: 'Out front',
    title: () => 'There’s a protest at the gate',
    body: '“Data centers drink our future.” A few dozen people and one very loud drum.',
    when: s => s.rep < 50,
    choices: [
      { label: 'Hold a town hall', cost: 300, apply: s => rep(s, 12) },
      { label: 'Ignore', apply: s => rep(s, -5) },
    ],
  },
];

const COOLDOWN_DAYS = 8;

/** Called once per new day. Opens the first complaint whose moment has come. */
export function checkComplaints(s: GameState) {
  if (s.complaint) return;
  const i = impact(s);
  const days = s.day - s.stageDay;
  for (const c of COMPLAINTS) {
    if ((s.cooldown[c.id] ?? 0) > s.day) continue;
    if (c.when(s, i, days)) {
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
  s.cooldown[c.id] = s.day + COOLDOWN_DAYS;
  s.complaint = null;
  note(s, ch.cost ? `${ch.label} · −${money(ch.cost)}` : `Ignored: ${c.from.toLowerCase()}`);
}

export const repMultiplier = (s: GameState) => 0.6 + 0.4 * (s.rep / 100);

export function nextFoundation(s: GameState): FoundKey | null {
  const order: FoundKey[] = ['slab', 'raised', 'piles', 'bedrock'];
  return order[order.indexOf(s.found) + 1] ?? null;
}

export const customerName = (s: GameState) => CUSTS[s.cust].name;
export const foundationName = (s: GameState) => FOUNDS[s.found].name;
