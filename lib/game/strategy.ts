import { CUSTS, LOCS, type LocKey } from './data';
import { hopedJobs, impact } from './events';
import type { Decision } from './gov';
import {
  assets, hallCount, hasLaw, inflation, landCost, ledger, locals, MARKET_MULT, MARKET_RATE, money, note, ownerName, siteName, tallest, today,
  type GameState, type Ledger,
} from './state';

/*
 * The long game. Notoriety brings customers and backlash; the state legislature races a moratorium
 * bill against your growth; the AI market booms and crashes; loans let you build faster and sink you
 * in a bust; long contracts protect you and bind you; and some things you do come back years later.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const addTrust = (s: GameState, d: number) => { s.trust = clamp(s.trust + d, 0, 100); };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shown = (s: GameState) => s.codename ?? siteName(s);

function headline(s: GameState, tag: string, text: string, ticker: string[]) {
  s.news = { id: (s.news?.id ?? 0) + 1, tag, headline: text, ticker };
  note(s, text);
}

// ---------- code names ----------

const CODES = ['Hydra', 'Bluebird', 'Granite', 'Sparrow', 'Atlas', 'Lantern', 'Tamarack', 'Kestrel', 'Juniper', 'Basalt'];
export const newCodename = () => `Project ${pick(CODES)}`;

// ---------- notoriety ----------

/** How much attention you'd draw, before a code name hides some of it. */
export function notorietyTarget(s: GameState, l: Ledger) {
  const size = l.gridMW * 1.6 + tallest(s) * 0.8 + s.campus * 4 + s.sites.length * 5;
  return clamp(size * (s.codename ? 0.4 : 1) + s.tally.ignored * 2 + Math.max(0, l.strain - 0.6) * 30, 0, 100);
}

// ---------- the moratorium bill ----------

const BILL_NAMES: Partial<Record<LocKey, string>> = {
  dublin: 'Data Centre Moratorium Motion', lulea: 'Datacenter Power Act', reykjavik: 'Energy Priority Act',
};
export const billName = (s: GameState) => BILL_NAMES[s.loc] ?? `${LOCS[s.loc].short} Datacenter Accountability Act`;
const STAGES = ['In committee', 'Floor vote', 'On the governor\'s desk'];
export const billStage = (p: number) => (p >= 80 ? 2 : p >= 40 ? 1 : 0);
export const billStageName = (s: GameState) => {
  const k = billStage(s.bill?.progress ?? 0);
  return LOCS[s.loc].gov.us ? STAGES[k] : ['In committee', 'Debate', 'Final vote'][k];
};

/** Months of moratorium when a bill passes. */
const MORATORIUM = 60;

/** How fast the bill moves this month, and why. Positive pushes it toward passing. */
export function billForces(s: GameState, l: Ledger) {
  const i = impact(s, l);
  const parts = [
    { label: 'Notoriety', value: s.notoriety * 0.03 },
    { label: 'Power bills', value: Math.max(0, l.strain - 0.6) * 6 },
    { label: 'Water', value: Math.min(1.5, i.waterML * 0.15) },
    { label: 'Low trust', value: s.trust < 50 ? (50 - s.trust) * 0.05 : 0 },
    { label: 'Lobbyists', value: s.lobby ? -1.6 : 0 },
    { label: 'Good neighbor', value: s.trust > 70 ? -(s.trust - 70) * 0.04 : 0 },
    { label: 'Local jobs', value: locals(s) >= hopedJobs(s) && hopedJobs(s) > 0 ? -0.5 : 0 },
  ].filter(p => Math.abs(p.value) >= 0.05);
  const total = 0.3 + parts.reduce((t, p) => t + p.value, 0);
  return { parts, total };
}

/** Months until the bill passes at today's pace, or null if it's going nowhere. */
export function billEta(s: GameState, l: Ledger) {
  if (!s.bill) return null;
  const f = billForces(s, l).total;
  return f > 0.05 ? Math.ceil((100 - s.bill.progress) / f) : null;
}

/** Odds the bill passes in the next year, roughly, for the briefing. */
export function billOdds(s: GameState, l: Ledger) {
  const eta = billEta(s, l);
  if (eta == null) return s.bill ? 5 : 0;
  return clamp(Math.round(100 - (eta - 12) * 4), 5, 95);
}

// ---------- loans ----------

export const LOAN_SIZES = [10_000_000, 25_000_000, 50_000_000, 150_000_000];
const LOAN_MONTHS = 120;
export const debt = (s: GameState) => s.loans.reduce((t, x) => t + x.balance, 0);
/** Banks lend up to 80% of what you've built, the land under it, and the sites you bought. */
export const borrowLimit = (s: GameState) =>
  Math.max(0, (assets(s) + landCost(s.loc, s.found) * s.campus) * 0.8 + s.sites.length * 40_000_000 - debt(s));
/** The rate a bank offers now: the market rate, plus more the deeper in debt you are. */
export const loanRate = (s: GameState) => MARKET_RATE[s.market.phase] + 0.02 + Math.min(0.06, (debt(s) / Math.max(1, assets(s))) * 0.08);

export function takeLoan(s: GameState, amount: number) {
  if (amount > borrowLimit(s)) return false;
  const rate = loanRate(s), r = rate / 12;
  const payment = (amount * r) / (1 - Math.pow(1 + r, -LOAN_MONTHS));
  s.loans.push({ id: Date.now(), balance: amount, rate, payment });
  s.cash += amount;
  note(s, `Borrowed ${money(amount)} at ${(rate * 100).toFixed(1)}%. ${money(payment)} a month for 10 years`);
  return true;
}

export function payOff(s: GameState, id: number) {
  const x = s.loans.find(y => y.id === id);
  if (!x || s.cash < x.balance) return false;
  s.cash -= x.balance;
  s.loans = s.loans.filter(y => y.id !== id);
  note(s, `Paid off a loan: −${money(x.balance)}`);
  return true;
}

// ---------- other sites ----------

/** Buying an existing 10 MW datacenter somewhere else. */
export const SITE_MW = 10;
export const siteCost = (s: GameState, loc: LocKey) => today(s, 40_000_000 + LOCS[loc].land * 20);
/** What a bought site makes a month: 80% full, after running costs. */
export function siteNet(s: GameState, site: { loc: LocKey; copycat: boolean }) {
  const L = LOCS[site.loc], K = CUSTS[s.cust];
  const revenue = SITE_MW * 0.8 * 1000 * K.price * L.demand * MARKET_MULT[s.market.phase];
  const costs = SITE_MW * 0.8 * 730 * L.pue * L.power * inflation(s) + today(s, 250_000);
  return (revenue - costs) * (site.copycat ? 0.75 : 1) * (1 - L.incomeTax);
}
export const sitesNet = (s: GameState) => s.sites.reduce((t, x) => t + siteNet(s, x), 0);

export function buySite(s: GameState, loc: LocKey) {
  const cost = siteCost(s, loc);
  if (loc === s.loc || s.sites.some(x => x.loc === loc) || s.cash < cost) return false;
  s.cash -= cost;
  s.sites.push({ loc, since: s.month, copycat: false });
  headline(s, 'Business news', `${ownerName(s)} buys a datacenter in ${LOCS[loc].short}`, [`${s.sites.length + 1} sites now`, 'Critics say they are spreading out to dodge local rules']);
  return true;
}

// ---------- decisions ----------

export const STRAT_DECISIONS: Decision[] = [
  {
    id: 'hearing', from: s => LOCS[s.loc].gov.state,
    title: s => `Hearing on the ${billName(s)}`,
    body: s => `Lawmakers want ${ownerName(s)} to answer for ${shown(s)}. The bill is ${Math.round(s.bill?.progress ?? 0)}% of the way to passing.`,
    choices: [
      {
        label: 'Testify about jobs', note: 'Works if you hired locals',
        apply: s => {
          if (!s.bill) return;
          const honest = locals(s) >= hopedJobs(s);
          s.bill.progress = clamp(s.bill.progress + (honest ? -12 : 4), 0, 100);
          addTrust(s, honest ? 3 : -4);
          note(s, honest ? 'Your testimony landed. Bill slowed.' : 'Lawmakers asked why so few locals work there. It backfired.');
        },
      },
      {
        label: 'Send lobbyists', note: 'Bill −10, may leak', cost: s => today(s, 1_000_000),
        apply: s => {
          if (!s.bill) return;
          s.bill.progress = clamp(s.bill.progress - 10, 0, 100);
          if (Math.random() < 0.3) scandal(s, 'lobbying');
        },
      },
      { label: 'Say nothing', note: 'Bill +5', apply: s => { if (s.bill) s.bill.progress = clamp(s.bill.progress + 5, 0, 100); } },
    ],
  },
  {
    id: 'contractOffer', from: () => 'A hyperscaler',
    title: () => 'A 10-year contract',
    body: s => `They want 80% of your capacity for 10 years at ${Math.round(MARKET_MULT[s.market.phase] * 95)}% of normal prices. Outages cost you.`,
    choices: [
      {
        label: 'Sign', note: 'Locked price, outage penalties',
        apply: s => {
          s.contract = { share: 0.8, mult: MARKET_MULT[s.market.phase] * 0.95, until: s.month + 120, misses: 0 };
          headline(s, 'Business news', `${shown(s)} signs 10-year deal`, ['Big tech customer locks in capacity', 'Penalties if servers go down']);
        },
      },
      { label: 'Stay flexible', note: 'Keep market prices', apply: () => {} },
    ],
  },
  {
    id: 'dieselSuit', from: () => 'Neighbors\' lawyers',
    title: () => 'Lawsuit over diesel exhaust',
    body: s => `Residents say years of generator runs at ${shown(s)} made their kids sick. They're suing ${ownerName(s)}.`,
    choices: [
      { label: 'Settle', note: 'Trust +3', cost: s => today(s, 5_000_000), apply: s => addTrust(s, 3) },
      { label: 'Fight it in court', note: '50%: win, or pay 3x and trust −10', apply: s => court(s, 0.5, today(s, 15_000_000), 'diesel') },
    ],
  },
  {
    id: 'flood', from: () => 'Homeowners downhill',
    title: () => 'Your site flooded our homes',
    body: () => 'With the trees gone, stormwater ran off your lot into the neighborhood.',
    choices: [
      { label: 'Pay for repairs', note: 'Trust +3', cost: s => today(s, 3_000_000), apply: s => addTrust(s, 3) },
      { label: 'Deny it', note: 'Trust −10', apply: s => addTrust(s, -10) },
    ],
  },
  {
    id: 'sleepStudy', from: () => 'A class action firm',
    title: () => 'Study links your hum to illness',
    body: s => `A university study found people near ${shown(s)} sleep worse and get sick more. A class action follows.`,
    choices: [
      { label: 'Settle', note: 'Trust +4', cost: s => today(s, 8_000_000), apply: s => addTrust(s, 4) },
      { label: 'Fight it in court', note: '40%: win, or pay 2.5x and trust −12', apply: s => court(s, 0.4, today(s, 20_000_000), 'hum') },
    ],
  },
];

function court(s: GameState, odds: number, loss: number, what: string) {
  if (Math.random() < odds) {
    headline(s, 'Local news', `${ownerName(s)} wins ${what} lawsuit`, ['Residents vow to appeal', 'Judge rules evidence too thin']);
    addTrust(s, -3);
  } else {
    s.cash -= loss;
    addTrust(s, -10);
    headline(s, 'Breaking news', `Jury orders ${ownerName(s)} to pay ${money(loss)}`, [`${what === 'diesel' ? 'Diesel exhaust' : 'Low-frequency hum'} harmed residents, jury finds`, 'Other towns take note']);
  }
}

/** A leak: the shell company, or the lobbying, gets out. */
function scandal(s: GameState, kind: 'codename' | 'lobbying') {
  s.notoriety = clamp(s.notoriety + 22, 0, 100);
  addTrust(s, -12);
  if (s.bill) s.bill.progress = clamp(s.bill.progress + 12, 0, 100);
  if (kind === 'codename') {
    headline(s, 'Breaking news', `Leak: ${s.codename} is ${siteName(s)}`, [`Shell company hid ${ownerName(s)} behind a code name`, 'Residents feel lied to']);
    s.codename = null;
  } else {
    s.lobby = false;
    headline(s, 'Breaking news', `${ownerName(s)} caught lobbying against the ${billName(s)}`, ['Emails show money behind the scenes', 'Bill gains new backers']);
  }
}

// ---------- the monthly tick ----------

/** End of month for the long game. Returns a decision to ask about, if any. */
export function strategyMonth(s: GameState, l: Ledger): string | null {
  const m = Math.floor(s.month);
  const i = impact(s, l);
  const ready = (id: string) => (s.cooldown[id] ?? 0) <= s.month;

  // loans: pay down each one
  for (const x of s.loans) x.balance = Math.max(0, x.balance - (x.payment - x.balance * x.rate / 12));
  if (s.loans.some(x => x.balance <= 1)) note(s, 'A loan is paid off');
  s.loans = s.loans.filter(x => x.balance > 1);
  // other sites send their profit home
  s.cash += sitesNet(s);

  // notoriety drifts toward what you'd draw
  s.notoriety = clamp(s.notoriety + (notorietyTarget(s, l) - s.notoriety) * 0.15, 0, 100);

  // a code name can leak, likelier as you grow
  if (s.codename && Math.random() < 0.015 + s.notoriety / 900 + s.campus * 0.01) scandal(s, 'codename');
  if (s.lobby && Math.random() < 0.03) scandal(s, 'lobbying');

  // the market: booms, gluts and back
  if (s.month >= s.market.until) {
    const next = s.market.phase === 'normal' ? (Math.random() < 0.6 ? 'boom' : 'glut') : s.market.phase === 'boom' ? 'glut' : 'normal';
    s.market = { phase: next, until: s.month + (next === 'boom' ? 18 + Math.random() * 18 : next === 'glut' ? 12 + Math.random() * 18 : 24 + Math.random() * 24) };
    if (next === 'boom') headline(s, 'Business news', 'AI boom: everyone wants datacenters', ['Prices for capacity jump 30%', 'Banks lend cheaply', 'Analysts warn of a bubble']);
    else if (next === 'glut') headline(s, 'Breaking news', 'The AI bubble pops', ['Capacity prices crash 35%', 'AI labs cancel orders', 'Banks raise rates on datacenter loans']);
    else { note(s, 'The datacenter market is back to normal'); if (!s.fired.includes('glutSurvived')) s.fired.push('glutSurvived'); }
  }

  // the bill: starts once you're noticed, then moves every month
  if (!s.bill && !hasLaw(s, 'moratorium') && (s.notoriety >= 25 || m >= 30)) {
    s.bill = { progress: 0, stage: 0, name: billName(s) };
    headline(s, 'Breaking news', `${LOCS[s.loc].gov.state} files the ${billName(s)}`, [`A moratorium on new datacenters like ${shown(s)}`, 'It has a long way to go. For now.']);
  }
  let decision: string | null = null;
  if (s.bill) {
    s.bill.progress = clamp(s.bill.progress + billForces(s, l).total, 0, 100);
    const stage = billStage(s.bill.progress);
    if (stage > s.bill.stage) {
      s.bill.stage = stage;
      headline(s, 'Breaking news', `${billName(s)} ${stage === 1 ? 'clears committee' : 'passes, heads to the governor'}`, [`${Math.round(s.bill.progress)}% of the way to a moratorium`, `${ownerName(s)} called to testify`]);
      decision = 'hearing';
    }
    if (s.bill.progress >= 100) {
      s.laws.push({ id: 'moratorium', until: s.month + MORATORIUM });
      headline(s, 'Breaking news', `${billName(s)} becomes law`, ['No new datacenter construction for 5 years', `${ownerName(s)}'s expansion plans frozen`, 'Other states draft copies']);
      s.bill = null;
      // backlash spreads: copycat laws hit some of your other US sites
      for (const x of s.sites) if (LOCS[x.loc].gov.us && Math.random() < 0.5) x.copycat = true;
    }
  }

  // things that come back years later
  if (s.strikes > 0 && !s.fired.includes('seed-diesel')) { s.fired.push('seed-diesel'); s.seeds.push({ id: 'dieselSuit', at: s.month + 36 + Math.random() * 24 }); }
  if (i.cleared >= 15 && !s.fired.includes('seed-flood')) { s.fired.push('seed-flood'); s.seeds.push({ id: 'flood', at: s.month + 24 + Math.random() * 18 }); }
  if (s.tally.ignored >= 3 && tallest(s) >= 6 && !s.up.soundWalls && !s.fired.includes('seed-hum')) {
    s.fired.push('seed-hum'); s.seeds.push({ id: 'sleepStudy', at: s.month + 30 + Math.random() * 24 });
  }
  s.waterUsed += i.waterML;
  if ((s.loc === 'phoenix' || s.loc === 'abilene') && s.waterUsed > 400 && !s.fired.includes('wellsDry')) {
    s.fired.push('wellsDry');
    s.laws.push({ id: 'waterCap', until: 1e9 });
    addTrust(s, -10);
    headline(s, 'Breaking news', 'Wells run dry near the datacenters', [`${shown(s)} has used ${Math.round(s.waterUsed)} million litres`, 'City caps datacenter water: no new halls']);
  }
  if (decision) return decision;
  const due = s.seeds.find(x => x.at <= s.month);
  // the seed is cleared when you answer it, so it can't get lost behind another alert
  if (due && !s.complaint && s.month >= s.calm) return due.id;

  // contract offers, and penalties when you break uptime
  if (s.contract && s.contract.until <= s.month) { note(s, 'Your 10-year contract ended'); s.contract = null; }
  if (s.contract && s.broken.length) {
    const fine = today(s, 250_000) * s.broken.length;
    s.cash -= fine;
    s.contract.misses++;
    note(s, `Uptime penalty: −${money(fine)}`);
    if (s.contract.misses >= 5) {
      s.contract = null;
      headline(s, 'Business news', `Big customer walks out of ${shown(s)}`, ['Too many outages', 'Contract cancelled']);
    }
  }
  if (!s.contract && hallCount(s) >= 2 && ready('contractOffer') && Math.random() < 0.08) { s.cooldown.contractOffer = s.month + 18; return 'contractOffer'; }
  return null;
}

// ---------- the yearly briefing ----------

export interface Brief { label: string; value: string; bad?: boolean }

export function briefing(s: GameState): Brief[] {
  const l = ledger(s);
  const eta = billEta(s, l);
  const rows: Brief[] = [
    { label: 'Market', value: s.market.phase === 'boom' ? 'Boom, prices +30%' : s.market.phase === 'glut' ? 'AI crash, prices −35%' : 'Normal', bad: s.market.phase === 'glut' },
    { label: 'Notoriety', value: `${Math.round(s.notoriety)}/100${s.codename ? `, hidden as ${s.codename}` : ''}`, bad: s.notoriety > 50 },
    {
      label: 'Moratorium bill',
      value: hasLaw(s, 'moratorium') ? 'In force, no building' : s.bill ? `${Math.round(s.bill.progress)}%, ${eta ? `passes in about ${eta} mo` : 'stalled'}, ${billOdds(s, l)}% within a year` : 'None yet',
      bad: !!s.bill && billOdds(s, l) > 40,
    },
    { label: 'Grid', value: `${Math.round(l.strain * 100)}% used`, bad: l.strain > 0.85 },
    { label: 'Debt', value: s.loans.length ? `${money(debt(s))}, ${money(s.loans.reduce((t, x) => t + x.payment, 0))}/mo` : 'None', bad: debt(s) > assets(s) * 0.5 },
    { label: 'Contract', value: s.contract ? `${Math.ceil((s.contract.until - s.month) / 12)} yrs left, ${s.contract.misses}/5 outage strikes` : 'None' },
    { label: 'Other sites', value: s.sites.length ? `${s.sites.length}, ${money(sitesNet(s))}/mo` : 'None' },
    { label: 'Lawsuit risk', value: s.seeds.length ? 'Something is brewing' : 'Quiet', bad: s.seeds.length > 0 },
  ];
  return rows;
}
