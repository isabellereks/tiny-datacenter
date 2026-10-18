import { FOUND_ORDER, FOUNDS, LOCS, type FoundKey } from './data';
import { STAFF_DECISIONS } from './staff';
import {
  hallCount, hasLaw, ledger, money, note, ownerName, siteName, techsOn, today,
  type Board, type GameState, type Ledger, type PermitKey,
} from './state';

/*
 * Bureaucracy, loosely based on real datacenter rules: permits that gate growth and take months,
 * yearly inspections with a checklist you can see ahead of time, county elections decided by
 * trust, and laws that come and go on each location's timeline.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const addTrust = (s: GameState, d: number) => { s.trust = clamp(s.trust + d, 0, 100); };
const FOREVER = 1e9;

// ---------- laws ----------

export interface LawInfo { name: string; by: (s: GameState) => string; effect: string }

export const LAWS: Record<string, LawInfo> = {
  itc: { name: 'Clean energy tax credit', by: () => 'Congress', effect: 'Solar farm 30% off' },
  fasttrack: { name: 'Fast-track permitting order', by: () => 'The White House', effect: 'Permits take half as long' },
  vaExempt: { name: 'Equipment sales tax break', by: s => LOCS[s.loc].gov.state, effect: 'New floors 5% off' },
  vaKwh: { name: 'Datacenter power tax', by: s => LOCS[s.loc].gov.state, effect: 'Power +$11/MWh' },
  azExempt: { name: 'Equipment sales tax break', by: s => LOCS[s.loc].gov.state, effect: 'New floors 5% off' },
  azFreeze: { name: 'Tax break freeze', by: s => LOCS[s.loc].gov.state, effect: 'No equipment tax break' },
  orAbate: { name: 'Strategic investment deal', by: s => LOCS[s.loc].gov.local, effect: 'Property tax −52%' },
  specialException: { name: 'Special exception rule', by: s => LOCS[s.loc].gov.local, effect: 'Zoning hearings take 6 mo' },
  pause: { name: 'Pause on new datacenters', by: s => LOCS[s.loc].gov.local, effect: 'No zoning or height permits' },
  boardPro: { name: 'Pro-growth board', by: s => LOCS[s.loc].gov.local, effect: 'Permits faster, hearings easier' },
  boardAnti: { name: 'Slow-growth board', by: s => LOCS[s.loc].gov.local, effect: 'Permits slower, hearings harder' },
  heat: { name: 'Heat wave', by: () => 'Weather', effect: 'Cooling −20%' },
  dry: { name: 'Power curtailment', by: s => LOCS[s.loc].gov.utility, effect: 'Servers capped at 70%' },
  priority: { name: 'Priority power contract', by: s => LOCS[s.loc].gov.utility, effect: 'Power +15%, never cut' },
  curtail: { name: 'Curtailable large load', by: s => LOCS[s.loc].gov.state, effect: 'Grid −10%' },
};

export const activeLaws = (s: GameState) => s.laws.filter(x => x.until > s.month);

function enact(s: GameState, id: string, months = FOREVER) {
  s.laws = s.laws.filter(x => x.id !== id && x.until > s.month);
  s.laws.push({ id, until: months >= FOREVER ? FOREVER : s.month + months });
}
function repeal(s: GameState, id: string) { s.laws = s.laws.filter(x => x.id !== id); }

function headline(s: GameState, tag: string, text: string, ticker: string[]) {
  s.news = { id: (s.news?.id ?? 0) + 1, tag, headline: text, ticker };
  note(s, text);
}

/** Laws already in force when you open. */
export function startLaws(s: GameState) {
  const G = LOCS[s.loc].gov;
  s.laws = [];
  if (G.us) enact(s, 'itc', 30);
  if (s.loc === 'ashburn') { enact(s, 'vaExempt'); enact(s, 'specialException'); }
  if (s.loc === 'phoenix') enact(s, 'azExempt');
  if (s.loc === 'dalles') enact(s, 'orAbate', 180);
  // you got zoning and height for what you built at setup
  s.permits = { zoning: FOUND_ORDER.indexOf(s.found), height: 0, air: 0, water: 0 };
  s.inspectAt = 10;
  s.electionAt = 24;
}

// ---------- permits ----------

export interface PermitInfo {
  name: string;
  what: (s: GameState) => string;
  by: (s: GameState) => string;
  fee: number;
  wait: number;
  /** false when this permit doesn't apply here */
  here: (s: GameState) => boolean;
  /** highest level you can reach */
  max: (s: GameState) => number;
}

export const PERMITS: Record<PermitKey, PermitInfo> = {
  zoning: {
    name: 'Zoning approval', by: s => LOCS[s.loc].gov.local, fee: 500_000, wait: 4, here: () => true,
    what: s => { const f = FOUND_ORDER[s.permits.zoning + 1]; return f ? `Allows ${FOUNDS[f].name.toLowerCase()}` : 'Biggest foundation allowed'; },
    max: () => FOUND_ORDER.length - 1,
  },
  height: {
    name: 'Height permit', fee: 750_000, wait: 4, here: () => true, max: () => 3,
    by: s => (s.permits.height === 1 ? (LOCS[s.loc].gov.us ? 'FAA' : 'Icelandic Transport Authority') : LOCS[s.loc].gov.local),
    what: s => ['Up to 20 floors', 'Up to 40 floors, flight safety review', 'Skyscraper review, no limit', 'No height limit'][s.permits.height],
  },
  air: {
    name: 'Air permit', by: s => LOCS[s.loc].gov.air, fee: 150_000, wait: 3, here: () => true, max: () => 20,
    what: () => '+2 power floors of backup generators',
  },
  water: {
    name: 'Water allocation', by: s => LOCS[s.loc].gov.local, fee: 300_000, wait: 4, max: () => 20,
    here: s => s.loc === 'phoenix', what: () => '+2 server halls of water',
  },
};

/** Floors allowed by your height permit. */
export const heightLimit = (s: GameState) => [12, 20, 40, 999][Math.min(3, s.permits.height)];
/** Power floors your air permit covers; each has diesel backup generators. */
export const powerLimit = (s: GameState) => 2 + 2 * s.permits.air;
/** Server halls your water allocation covers (only in Arizona, and not once you use water-saving cooling). */
export const hallLimit = (s: GameState) => (s.loc === 'phoenix' && !s.up.closedLoop ? 2 + 2 * s.permits.water : 999);
export const zoningAllows = (s: GameState, f: FoundKey) => FOUND_ORDER.indexOf(f) <= s.permits.zoning;

export function permitWait(s: GameState, key: PermitKey) {
  const base = key === 'zoning' && hasLaw(s, 'specialException') ? 6 : PERMITS[key].wait;
  const k = (hasLaw(s, 'fasttrack') ? 0.5 : 1) * (hasLaw(s, 'boardPro') ? 0.75 : hasLaw(s, 'boardAnti') ? 1.5 : 1);
  return Math.max(1, Math.round(base * k));
}
export const permitFee = (s: GameState, key: PermitKey) => today(s, PERMITS[key].fee * (1 + s.permits[key] * 0.5));
/** Trust a hearing needs to pass. */
export const hearingBar = (s: GameState) => (hasLaw(s, 'boardPro') ? 40 : hasLaw(s, 'boardAnti') ? 60 : 50);

/** Why you can't apply right now, or null. */
export function permitBlock(s: GameState, key: PermitKey): string | null {
  const P = PERMITS[key];
  if (!P.here(s)) return 'Not needed here';
  if (s.permits[key] >= P.max(s)) return 'Fully approved';
  if (s.applying.some(a => a.key === key)) return 'Under review';
  if ((key === 'zoning' || key === 'height') && hasLaw(s, 'pause')) return 'Paused by the county';
  const retry = Math.ceil((s.cooldown[`permit-${key}`] ?? 0) - s.month);
  if (retry > 0) return `Denied. Reapply in ${retry} mo`;
  return null;
}

export function applyPermit(s: GameState, key: PermitKey) {
  const fee = permitFee(s, key);
  if (permitBlock(s, key) || s.cash < fee) return false;
  s.cash -= fee;
  const wait = permitWait(s, key);
  s.applying.push({ key, done: s.month + wait });
  note(s, `Applied for ${PERMITS[key].name.toLowerCase()}. Decision in ${wait} mo`);
  return true;
}

function decidePermit(s: GameState, key: PermitKey) {
  const P = PERMITS[key];
  const by = P.by(s);
  let ok = true, why = '';
  if (key === 'zoning' || key === 'height') {
    ok = s.trust >= hearingBar(s);
    why = `Trust ${Math.round(s.trust)}, needed ${hearingBar(s)}`;
  } else if (key === 'air') {
    ok = s.strikes < 3;
    why = 'Too many generator violations';
  } else if (key === 'water') {
    ok = s.trust >= 35;
    why = `Trust ${Math.round(s.trust)}, needed 35`;
  }
  if (ok) {
    s.permits[key]++;
    note(s, `${by} approved your ${P.name.toLowerCase()}`);
    if (key === 'height' || key === 'zoning') headline(s, 'Local news', `${by} approves ${siteName(s)} expansion`, [`${ownerName(s)} can build bigger`, `Vote follows public hearing`]);
  } else {
    s.cooldown[`permit-${key}`] = s.month + 6;
    note(s, `${by} denied your ${P.name.toLowerCase()}. ${why}`);
    if (key === 'height' || key === 'zoning') headline(s, 'Local news', `${by} rejects ${siteName(s)} expansion`, [`Residents packed the hearing`, `${ownerName(s)} can reapply in 6 months`]);
  }
}

/** What stops the next floor from being built, or null. */
export function buildBlock(s: GameState): string | null {
  const n = s.floors.length;
  if (n >= heightLimit(s)) return ['Needs a height permit', 'Needs flight safety review', 'Needs skyscraper review'][Math.min(2, s.permits.height)];
  if (s.next === 'power' && s.floors.filter(f => f.type === 'power').length >= powerLimit(s)) return 'Needs an air permit';
  if (s.next === 'hall' && s.floors.filter(f => f.type === 'hall').length >= hallLimit(s)) return 'Needs more water';
  return null;
}

// ---------- inspections ----------

export interface Check { label: string; ok: boolean }

export const inspectionName = (s: GameState) =>
  s.loc === 'reykjavik' && Math.round(s.inspectAt / 12) % 2 === 0 ? 'EU energy report'
    : Math.round(s.inspectAt / 12) % 2 === 0 ? 'electrical inspection' : 'fire marshal inspection';
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
export const inspectionTitle = (s: GameState) => cap(inspectionName(s));

/** The checklist the inspector will use. Visible ahead of time. */
export function checklist(s: GameState, l: Ledger = ledger(s)): Check[] {
  const halls = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.done && o.f.type === 'hall');
  const list: Check[] = [
    { label: 'No floors down', ok: s.broken.length === 0 },
    { label: 'A tech on every hall', ok: halls.every(o => techsOn(s, o.i) > 0) },
    { label: 'Enough power and cooling', ok: l.eff >= 0.999 },
  ];
  if (s.loc === 'reykjavik') list.push({ label: 'PUE 1.2 or better', ok: l.pue <= 1.2 });
  if (s.loc === 'ashburn') list.push({ label: 'Under 55 dB at homes', ok: s.up.soundWalls || s.floors.length <= 5 });
  if (s.loc === 'phoenix') list.push({ label: 'Water within allocation', ok: hallCount(s) <= hallLimit(s) });
  if (s.loc === 'dalles' && hasLaw(s, 'orAbate')) list.push({ label: '10 local jobs for the tax deal', ok: s.workers.length >= 10 || s.month < 36 });
  return list;
}

function inspect(s: GameState, l: Ledger) {
  const name = inspectionName(s);
  const fails = checklist(s, l).filter(c => !c.ok);
  if (!fails.length) {
    addTrust(s, 3);
    note(s, `Passed the ${name}. Trust +3`);
  } else {
    const fine = today(s, 250_000 * fails.length);
    s.cash -= fine;
    addTrust(s, -2 * fails.length);
    headline(s, 'Local news', `${siteName(s)} fails ${name}`, [`${fails.map(f => f.label).join(', ')}`, `Fined ${money(fine)}`, `${ownerName(s)} promises fixes`]);
  }
  s.inspectAt = s.month + 12;
}

// ---------- elections ----------

/** Chance the pro-growth side wins, from how the town feels about you. */
export const pollPro = (s: GameState) => clamp((s.trust - 20) / 60, 0.05, 0.95);

function election(s: GameState) {
  const local = LOCS[s.loc].gov.local;
  const pro = Math.random() < pollPro(s);
  const board: Board = pro ? 'pro' : 'anti';
  s.board = board;
  repeal(s, 'boardPro'); repeal(s, 'boardAnti');
  enact(s, pro ? 'boardPro' : 'boardAnti', 48);
  headline(s, 'Election night', pro ? `Pro-growth slate wins ${local}` : `Datacenter critics sweep ${local}`,
    pro ? ['Permits expected to move faster', `${ownerName(s)} welcomes the result`] : ['New board promises tougher hearings', `A win against ${ownerName(s)}, say voters`]);
  s.electionAt = s.month + 48;
}

// ---------- decisions ----------

export interface GovChoice { label: string; cost?: (s: GameState) => number; note: string; apply: (s: GameState) => void }
export interface Decision { id: string; from: (s: GameState) => string; title: (s: GameState) => string; body: (s: GameState) => string; choices: GovChoice[] }

export const DECISIONS: Decision[] = [
  {
    id: 'gridAlert', from: s => LOCS[s.loc].gov.utility,
    title: () => 'Grid emergency',
    body: () => 'The grid is short on power tonight. They ask big users to run backup generators or cut load.',
    choices: [
      {
        label: 'Run generators', note: 'Paid, trust −4, air strike',
        cost: s => -today(s, 300_000),
        apply: s => {
          addTrust(s, -4);
          s.strikes++;
          if (s.strikes >= 3) {
            const fine = today(s, 1_000_000);
            s.cash -= fine;
            headline(s, 'Local news', `${siteName(s)} fined for diesel exhaust`, [`${LOCS[s.loc].gov.air} fines ${ownerName(s)} ${money(fine)}`, 'Generators ran over permit limits']);
          }
        },
      },
      { label: 'Cut your load', note: 'Lose 15% of a month, trust +3', cost: s => Math.round(ledger(s).revenue * 0.15), apply: s => addTrust(s, 3) },
    ],
  },
  {
    id: 'dryWinter', from: s => LOCS[s.loc].gov.utility,
    title: () => 'Dry winter',
    body: () => 'Reservoirs are low. Big users on standard contracts will be cut to 70% for 3 months.',
    choices: [
      { label: 'Priority contract', note: 'Power +15% for good', cost: s => today(s, 1_000_000), apply: s => enact(s, 'priority') },
      { label: 'Take the cuts', note: 'Servers at 70% for 3 mo', apply: s => enact(s, 'dry', 3) },
    ],
  },
  {
    id: 'largeLoad', from: s => LOCS[s.loc].gov.state,
    title: () => 'New large-load law',
    body: () => 'Big users must let the grid operator disconnect them in an emergency, or accept less grid.',
    choices: [
      { label: 'Install remote disconnect', note: 'One-time cost', cost: s => today(s, 2_000_000), apply: () => {} },
      { label: 'Accept curtailment', note: 'Grid −10% for good', apply: s => enact(s, 'curtail') },
    ],
  },
  {
    id: 'waterHearing', from: s => LOCS[s.loc].gov.local,
    title: () => 'Water hearing',
    body: s => `The city wants ${ownerName(s)} to explain how ${siteName(s)} will cut water use in a drought.`,
    choices: [
      { label: 'Switch to reclaimed water', note: 'Trust +6', cost: s => today(s, 1_500_000), apply: s => addTrust(s, 6) },
      { label: 'Send a lawyer', note: 'Trust −6', cost: s => today(s, 100_000), apply: s => addTrust(s, -6) },
    ],
  },
];

/** Every decision that can pop up: government, utilities and your own staff. */
export const ALL_DECISIONS = (): Decision[] => [...DECISIONS, ...STAFF_DECISIONS];

export const decisionCost = (s: GameState, c: GovChoice) => (c.cost ? c.cost(s) : 0);

export function resolveDecision(s: GameState, choice: number) {
  const d = ALL_DECISIONS().find(x => x.id === s.complaint);
  if (!d) return false;
  const c = d.choices[choice];
  const cost = decisionCost(s, c);
  if (cost > 0 && s.cash < cost) return true;
  s.cash -= cost;
  c.apply(s);
  note(s, `${c.label}. ${c.note}`);
  s.cooldown[d.id] = s.month + 12;
  s.complaint = null;
  s.calm = s.month + 2;
  return true;
}

// ---------- the monthly tick ----------

/** Runs at the end of each month, before complaints. Returns a decision to ask about, if any. */
export function govMonth(s: GameState, l: Ledger): string | null {
  const G = LOCS[s.loc].gov;
  const m = Math.floor(s.month);
  const once = (id: string) => (s.fired.includes(id) ? false : (s.fired.push(id), true));

  // laws that run out
  for (const law of s.laws) {
    if (law.until <= s.month && law.until > s.month - 1) {
      if (law.id === 'azFreeze') { enact(s, 'azExempt'); note(s, 'The tax break freeze ended'); }
      else if (law.id === 'orAbate') headline(s, 'Local news', `${siteName(s)} tax deal ends`, ['Property tax goes to the full rate', `${G.local} expects a windfall`]);
      else if (LAWS[law.id] && !law.id.startsWith('board')) note(s, `${LAWS[law.id].name} ended`);
    }
  }
  s.laws = s.laws.filter(x => x.until > s.month);

  // each place's timeline
  if (G.us && m >= 6 && once('fasttrack')) {
    enact(s, 'fasttrack', 24);
    headline(s, 'Breaking news', 'President signs order to fast-track datacenters', ['Federal permits to move faster for 2 years', 'Critics warn of rushed reviews']);
  }
  if (G.us && m >= 18 && once('budgetBill')) {
    headline(s, 'Breaking news', 'Congress passes budget bill', ['Solar tax credit ends in 12 months', 'Clean energy groups object']);
  }
  if (s.loc === 'ashburn' && m >= 30 && once('vaKwh')) {
    enact(s, 'vaKwh', 24);
    headline(s, 'Breaking news', `${G.state} taxes datacenter power`, ['$11 per MWh for 2 years', 'Sales tax break survives']);
  }
  if (s.loc === 'ashburn' && m >= 54 && hasLaw(s, 'boardAnti') && once('pause')) {
    enact(s, 'pause', 24);
    headline(s, 'Breaking news', `${G.local} pauses new datacenters`, ['No new zoning or height approvals for 2 years', `${ownerName(s)} calls it a setback`]);
  }
  if (s.loc === 'phoenix' && m >= 24 && once('azFreeze')) {
    repeal(s, 'azExempt');
    enact(s, 'azFreeze', 36);
    headline(s, 'Breaking news', `${G.state} freezes datacenter tax breaks`, ['No equipment tax break for 3 years', 'Water fees under discussion']);
  }
  if (s.loc === 'dalles' && m >= 36 && hasLaw(s, 'orAbate') && once('ezCheck')) {
    if (s.workers.length >= 10) note(s, `${G.local} renewed your tax deal. You have the jobs.`);
    else {
      repeal(s, 'orAbate');
      headline(s, 'Local news', `${siteName(s)} loses tax deal`, [`Deal needed 10 local jobs, ${s.workers.length} were hired`, 'Property tax goes to the full rate']);
    }
  }

  // permits come back
  const due = s.applying.filter(a => a.done <= s.month);
  s.applying = s.applying.filter(a => a.done > s.month);
  for (const a of due) decidePermit(s, a.key);

  // inspections, announced two months ahead
  if (m === Math.floor(s.inspectAt) - 2) note(s, `${inspectionTitle(s)} in 2 months. Check the Gov tab.`);
  if (s.month >= s.inspectAt) inspect(s, l);

  // elections, announced six months ahead
  if (m === Math.floor(s.electionAt) - 6) note(s, `${G.local} election in 6 months. Pro-growth side polls at ${Math.round(pollPro(s) * 100)}%`);
  if (s.month >= s.electionAt) election(s);

  // weather that just happens
  const mo = m % 12;
  if (s.loc === 'phoenix' && mo >= 5 && mo <= 7 && !hasLaw(s, 'heat') && Math.random() < 0.35) {
    enact(s, 'heat', 2);
    note(s, 'Heat wave. Cooling works 20% worse for 2 months.');
  }

  // decisions, if nothing else is on the table
  if (s.complaint || s.month < s.calm) return null;
  const ready = (id: string) => (s.cooldown[id] ?? 0) <= s.month;
  if (G.us && m >= 40 && l.gridMW >= 10 && once('largeLoad')) return 'largeLoad';
  if (G.us && l.strain >= 0.6 && ready('gridAlert') && Math.random() < 0.12) return 'gridAlert';
  if (s.loc === 'reykjavik' && (mo === 11 || mo <= 1) && !hasLaw(s, 'priority') && ready('dryWinter') && Math.random() < 0.3) return 'dryWinter';
  if (s.loc === 'phoenix' && mo >= 5 && mo <= 8 && !s.up.closedLoop && hallCount(s) >= 2 && ready('waterHearing') && Math.random() < 0.15) return 'waterHearing';
  return null;
}
