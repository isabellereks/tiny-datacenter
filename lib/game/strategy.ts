import { CHIPS, LOCS, TIERS, type LocKey } from './data';
import { hopedJobs, impact } from './events';
import type { Decision } from './gov';
import {
  assets, ECON, econDrift, hasLaw, landCost, ledger, locals, MARKET_RATE, money, note, ownerName, signedMW, siteName, today,
  type EconPhase, type GameState, type Ledger,
} from './state';
import { chipSummary } from './deals';

/*
 * The long game. The state legislature races a moratorium bill against your growth, the economy and
 * the AI market swing, loans let you build faster and sink you in a bust, and some things you do
 * come back years later.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const addTrust = (s: GameState, d: number) => { s.trust = clamp(s.trust + d, 0, 100); };

function headline(s: GameState, tag: string, text: string, ticker: string[]) {
  s.news = { id: (s.news?.id ?? 0) + 1, tag, headline: text, ticker };
  note(s, text);
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
    { label: 'Size', value: Math.min(2, l.gridMW * 0.02) },
    { label: 'Power bills', value: Math.max(0, l.strain - 0.6) * 6 },
    { label: 'Water', value: Math.min(1.5, i.waterML * 0.15) },
    { label: 'Low trust', value: s.trust < 50 ? (50 - s.trust) * 0.05 : 0 },
    { label: 'Good neighbor', value: s.trust > 70 ? -(s.trust - 70) * 0.04 : 0 },
    { label: 'Local jobs', value: locals(s) >= hopedJobs(s) && hopedJobs(s) > 0 ? -0.5 : 0 },
  ].filter(p => Math.abs(p.value) >= 0.05);
  const total = 0.2 + parts.reduce((t, p) => t + p.value, 0);
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
export const debt = (s: GameState) => s.loans.reduce((t, x) => t + x.balance, 0);
/** Banks lend up to 65% of what you've built and the land under it, and finance most of the build for signed leases. */
export const borrowLimit = (s: GameState) =>
  Math.max(0, (assets(s) + landCost(s.loc, s.found) * s.campus) * 0.65 + signedMW(s) * 7_000_000 - debt(s));
/** The rate a bank offers now: the market rate, plus more the deeper in debt you are. */
/** Close to real datacenter debt: about 6.5% in normal times, more in a crash, more again the deeper in debt you are. */
export const loanRate = (s: GameState) => MARKET_RATE[s.market.phase] + ECON[s.econ.phase].rate + 0.005 + Math.min(0.03, (debt(s) / Math.max(1, assets(s))) * 0.04);

/** Datacenter construction loans are interest only: you pay the interest every month and the loan itself when you choose. */
const paymentFor = (amount: number, rate: number) => amount * (rate / 12);

/** A loan outside the normal limit, for when the bank steps in. */
function lend(s: GameState, amount: number, rate: number) {
  s.loans.push({ id: Date.now() + Math.random(), balance: amount, rate, payment: paymentFor(amount, rate) });
  s.cash += amount;
  if (s.q) s.q.borrowed += amount;
}

export function takeLoan(s: GameState, amount: number) {
  if (amount > borrowLimit(s)) return false;
  const rate = loanRate(s);
  const payment = paymentFor(amount, rate);
  s.loans.push({ id: Date.now(), balance: amount, rate, payment });
  s.cash += amount;
  if (s.q) s.q.borrowed += amount;
  note(s, `Borrowed ${money(amount)} at ${(rate * 100).toFixed(1)}%. ${money(payment)} a month in interest`);
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

// ---------- decisions ----------

export const STRAT_DECISIONS: Decision[] = [
  {
    id: 'rescue', from: () => 'Your bank',
    title: () => 'You missed a payment',
    body: s => `${siteName(s)} is ${money(Math.max(0, -s.cash))} in the red. Three months like this and the bank takes the site.`,
    choices: [
      {
        label: 'Bridge loan', note: 'Enough to get back above zero, at a higher rate',
        apply: s => {
          lend(s, Math.max(5_000_000, -s.cash + 5_000_000), loanRate(s) + 0.03);
          s.debt = 0;
          note(s, 'Took a bridge loan from the bank. Back in the black.');
        },
      },
      {
        label: 'Emergency loan', note: '5 years at 14%. Costly, but fast',
        apply: s => {
          lend(s, Math.max(5_000_000, -s.cash + 10_000_000), 0.14);
          s.debt = 0;
          note(s, 'Took an emergency loan at 14%.');
        },
      },
      { label: 'Go it alone', note: 'Two more months to fix it', apply: () => {} },
    ],
  },
  {
    id: 'hearing', from: s => LOCS[s.loc].gov.state,
    title: s => `Hearing on the ${billName(s)}`,
    body: s => `Lawmakers want ${ownerName(s)} to answer for ${siteName(s)}. The bill is ${Math.round(s.bill?.progress ?? 0)}% of the way to passing.`,
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
        label: 'Offer a community deal', note: 'Bill −10, trust +3', cost: s => today(s, 2_000_000),
        apply: s => { if (s.bill) s.bill.progress = clamp(s.bill.progress - 10, 0, 100); addTrust(s, 3); },
      },
      { label: 'Say nothing', note: 'Bill +5', apply: s => { if (s.bill) s.bill.progress = clamp(s.bill.progress + 5, 0, 100); } },
    ],
  },
  {
    id: 'dieselSuit', from: () => 'Neighbors\' lawyers',
    title: () => 'Lawsuit over diesel exhaust',
    body: s => `Residents say years of generator runs at ${siteName(s)} made their kids sick. They're suing ${ownerName(s)}.`,
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
    body: s => `A university study found people near ${siteName(s)} sleep worse. A class action follows.`,
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

// ---------- the monthly tick ----------

/** End of month for the long game. Returns a decision to ask about, if any. */
export function strategyMonth(s: GameState, l: Ledger): string | null {
  const m = Math.floor(s.month);
  const i = impact(s, l);

  // loans: pay down each one
  for (const x of s.loans) x.balance = Math.max(0, x.balance - (x.payment - x.balance * x.rate / 12));
  if (s.loans.some(x => x.balance <= 1)) note(s, 'A loan is paid off');
  s.loans = s.loans.filter(x => x.balance > 1);

  // the wider economy drifts each month and shifts phase now and then
  econDrift(s);
  if (s.month >= s.econ.until) {
    const from = s.econ.phase;
    const next: EconPhase = from !== 'steady' ? 'steady' : (['inflation', 'recession', 'energy'] as const)[Math.floor(Math.random() * 3)];
    const [lo, hi] = ECON[next].months;
    s.econ.phase = next;
    s.econ.until = s.month + Math.round(lo + Math.random() * (hi - lo));
    if (next === 'inflation') headline(s, 'Business news', 'Inflation hits a 20-year high', ['Wages, parts and power all cost more', 'The central bank raises rates', 'Customers push back on price hikes']);
    else if (next === 'recession') headline(s, 'Breaking news', 'The economy slips into recession', ['Companies cut cloud budgets', 'Prices for capacity fall', 'Costs barely move']);
    else if (next === 'energy') headline(s, 'Breaking news', 'Energy crisis: power prices soar', ['Gas supplies tighten', `Power bills up about ${Math.round((ECON.energy.power - 1) * 100)}%`, 'Utilities ask big users to cut back']);
    else note(s, from === 'recession' ? 'The recession is over' : from === 'energy' ? 'Power prices settle down' : 'Inflation cools off');
  }

  // the AI market: booms, crashes and back. Signed deals keep their price; new offers and the spot market move.
  if (s.month >= s.market.until) {
    const next = s.market.phase === 'normal' ? (Math.random() < 0.6 ? 'boom' : 'glut') : s.market.phase === 'boom' ? 'glut' : 'normal';
    s.market = { phase: next, until: s.month + (next === 'boom' ? 18 + Math.random() * 18 : next === 'glut' ? 12 + Math.random() * 18 : 24 + Math.random() * 24) };
    if (next === 'boom') headline(s, 'Business news', 'AI boom: everyone wants datacenters', ['Offers pour in at higher prices', 'Banks lend cheaply', 'Analysts warn of a bubble']);
    else if (next === 'glut') headline(s, 'Breaking news', 'The AI bubble pops', ['Spot prices crash 35%', 'Fewer new customers', 'Signed deals still pay']);
    else { note(s, 'The datacenter market is back to normal'); if (!s.fired.includes('glutSurvived')) s.fired.push('glutSurvived'); }
  }

  // the bill: filed once you're big or the town turns on you, then moves every month
  if (!s.bill && !hasLaw(s, 'moratorium') && (m >= 36 || (m >= 12 && s.trust < 40) || l.gridMW >= 30)) {
    s.bill = { progress: 0, stage: 0, name: billName(s) };
    headline(s, 'Breaking news', `${LOCS[s.loc].gov.state} files the ${billName(s)}`, [`A moratorium on new datacenters like ${siteName(s)}`, 'It has a long way to go. For now.']);
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
      headline(s, 'Breaking news', `${billName(s)} becomes law`, ['No new server halls for 5 years', `${ownerName(s)}'s expansion plans frozen`, 'Other states draft copies']);
      s.bill = null;
    }
  }

  // supply chains: big transformers can be backordered for a year or more
  if (m >= 18 && (s.shortageUntil ?? 0) <= s.month && Math.random() < 0.02) {
    s.shortageUntil = s.month + 12 + Math.round(Math.random() * 12);
    headline(s, 'Business news', 'Transformer shortage hits datacenters', ['Lead times for big transformers double', 'Electrical floors take twice as long to build', 'Utilities blame the AI boom']);
  }

  // things that come back years later
  if (s.strikes > 0 && !s.fired.includes('seed-diesel')) { s.fired.push('seed-diesel'); s.seeds.push({ id: 'dieselSuit', at: s.month + 36 + Math.random() * 24 }); }
  if (i.cleared >= 15 && !s.fired.includes('seed-flood')) { s.fired.push('seed-flood'); s.seeds.push({ id: 'flood', at: s.month + 24 + Math.random() * 18 }); }
  if (s.tally.ignored >= 3 && !s.up.soundWalls && !s.fired.includes('seed-hum')) {
    s.fired.push('seed-hum'); s.seeds.push({ id: 'sleepStudy', at: s.month + 30 + Math.random() * 24 });
  }
  s.waterUsed += i.waterML;
  if ((s.loc === 'phoenix' || s.loc === 'abilene') && s.waterUsed > 400 && !s.fired.includes('wellsDry')) {
    s.fired.push('wellsDry');
    s.laws.push({ id: 'waterCap', until: 1e9 });
    addTrust(s, -10);
    headline(s, 'Breaking news', 'Wells run dry near the datacenters', [`${siteName(s)} has used ${Math.round(s.waterUsed)} million litres`, 'New halls must use water-saving cooling']);
  }
  if (decision) return decision;
  const due = s.seeds.find(x => x.at <= s.month);
  // the seed is cleared when you answer it, so it can't get lost behind another alert
  if (due && !s.complaint && s.month >= s.calm) return due.id;
  return null;
}

// ---------- the yearly briefing ----------

export interface Brief { label: string; value: string; bad?: boolean }

export function briefing(s: GameState): Brief[] {
  const l = ledger(s);
  const eta = billEta(s, l);
  const c = chipSummary(s);
  const signed = signedMW(s);
  return [
    { label: 'Size', value: `${TIERS[s.tier].name}, ${l.itMW.toFixed(1)} MW running` },
    { label: 'Customers', value: `${signed.toFixed(0)} MW signed, ${s.offers.length} ${s.offers.length === 1 ? 'offer' : 'offers'} waiting`, bad: signed > l.itMW + 0.5 },
    { label: 'Chips', value: c.stale ? `${c.stale} of ${c.halls} halls behind ${CHIPS[s.chip].name}` : `All on ${CHIPS[s.chip].name}`, bad: c.value < 0.8 },
    { label: 'Grid', value: s.gridQueue ? `${Math.round(l.strain * 100)}% used, ${s.gridQueue.mw} MW coming in ${Math.ceil(s.gridQueue.done - s.month)} mo` : `${Math.round(l.strain * 100)}% used`, bad: l.strain > 0.85 },
    { label: 'Economy', value: `${ECON[s.econ.phase].name}, AI market ${s.market.phase === 'boom' ? 'booming' : s.market.phase === 'glut' ? 'crashed' : 'normal'}`, bad: s.econ.phase !== 'steady' || s.market.phase === 'glut' },
    {
      label: 'Moratorium bill',
      value: hasLaw(s, 'moratorium') ? 'In force, no new halls' : s.bill ? `${Math.round(s.bill.progress)}%, ${billStageName(s).toLowerCase()}${s.hints ? (eta ? `, passes in about ${eta} mo` : ', stalled') : ''}` : 'None yet',
      bad: !!s.bill && billOdds(s, l) > 40,
    },
    { label: 'Rival', value: s.rival ? `${s.rival.name}, ${Math.round(s.rival.mw)} MW vs your ${l.itMW.toFixed(0)}` : s.fired.includes('rivalBeaten') ? 'Gone. You won the town' : 'None yet', bad: !!s.rival && s.rival.mw > l.itMW },
    { label: 'Debt', value: s.loans.length ? `${money(debt(s))}, ${money(s.loans.reduce((t, x) => t + x.payment, 0))}/mo` : 'None', bad: debt(s) > assets(s) * 0.5 },
    {
      label: 'Lawyers',
      value: s.seeds.length ? s.seeds.map(x => ({ dieselSuit: 'Neighbors are logging your generator runs', flood: 'Downhill homeowners are counting the trees you cut', sleepStudy: 'A university is studying the hum' }[x.id] ?? 'Someone is asking questions')).join('. ') : 'Quiet',
      bad: s.seeds.length > 0,
    },
  ];
}
