import { CHIPS, CHIP_EVERY, CUSTS, GRID_ASK, HYPERSCALERS, LIQUID_GEN, LOCS, TIERS, TYPES, type CustKey } from './data';
import {
  allocate, chipValue, fitGen, genOf, hallCount, hasLaw, ledger, marketPrice, money, note, signedMW, siteName, tierOf, today,
  type Deal, type GameState, type Ledger, type Need, type Offer,
} from './state';

/*
 * The business: customers offer deals and you choose which to sign, chips age as new ones ship,
 * the utility makes you wait in line for more grid, and you grow through tiers that unlock more.
 */

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function headline(s: GameState, tag: string, text: string, ticker: string[]) {
  s.news = { id: (s.news?.id ?? 0) + 1, tag, headline: text, ticker };
  note(s, text);
}

// ---------- offers and deals ----------

/** Deal sizes grow with you: MW a customer asks for at each tier. */
const SIZES: [number, number][] = [[1, 4], [3, 10], [8, 24], [20, 60]];
const TERMS = [24, 36, 60, 120];

export const NEED_LABEL: Record<Need, string> = {
  green: 'Clean power', uptime: 'No outages', fresh: 'Newest chips',
};
export const NEED_NOTE: Record<Need, string> = {
  green: 'Needs a wind deal or solar, or pays 20% less',
  uptime: 'Shortfalls refund the whole fee',
  fresh: 'Pays 20% less on chips a generation old',
};

/** A new offer from a customer, sized for where you are. */
export function makeOffer(s: GameState, kind?: CustKey, mw?: number): Offer {
  const tier = s.tier;
  const big = tier >= 2 && Math.random() < 0.3;
  const k: CustKey = kind ?? (big ? 'ai' : pick(['ai', 'ai', 'stream', 'bank', 'games'] as CustKey[]));
  const [lo, hi] = SIZES[tier];
  const size = mw ?? Math.max(1, Math.round(rnd(lo, hi) * (big ? 1.6 : 1)));
  const months = pick(TERMS.slice(0, tier >= 2 ? 4 : 3));
  const needs: Need[] = [];
  if ((k === 'ai' || k === 'stream') && Math.random() < 0.3) needs.push('green');
  if (k === 'bank' || Math.random() < 0.1) needs.push('uptime');
  if (k === 'ai' && tier >= 1 && Math.random() < 0.4) needs.push('fresh');
  // longer deals and bigger customers get a discount; picky ones pay a little more
  // a bigger rival across town wins the best customers
  const rivalCut = s.rival && s.rival.mw > s.peakMW ? 0.93 : 1;
  const price = rivalCut * marketPrice(s, k) * rnd(0.92, 1.12) * (months >= 60 ? 0.92 : 1) * (big ? 0.9 : 1) * (1 + 0.04 * needs.length);
  return {
    id: s.nid++, who: big ? pick(HYPERSCALERS) : pick(CUSTS[k].names), kind: k, mw: size,
    price: Math.round(price), months, lead: Math.round(rnd(2, 6)), needs, expires: s.month + Math.round(rnd(3, 6)),
  };
}

export function sign(s: GameState, id: number) {
  const o = s.offers.find(x => x.id === id);
  if (!o) return false;
  s.offers = s.offers.filter(x => x.id !== id);
  const start = s.month + o.lead;
  s.deals.push({ ...o, start, until: start + o.months, strikes: 0 });
  note(s, `Signed ${o.who}: ${o.mw} MW from ${Math.ceil(o.lead)} months out`);
  return true;
}

/** Walking away from a deal: half of up to a year of their fees, or a month's worth if they haven't moved in yet. */
export function exitFee(s: GameState, d: Deal) {
  const monthly = d.mw * 1000 * d.price;
  if (d.start > s.month) return Math.round(monthly);
  return Math.round(monthly * 0.5 * Math.min(12, Math.max(1, d.until - s.month)));
}

export function endDeal(s: GameState, id: number) {
  const d = s.deals.find(x => x.id === id);
  if (!d) return false;
  const fee = exitFee(s, d);
  if (s.cash < fee) return false;
  s.cash -= fee;
  s.deals = s.deals.filter(x => x.id !== id);
  note(s, `Ended the deal with ${d.who}: −${money(fee)}`);
  if (d.mw >= 15) headline(s, 'Business news', `${siteName(s)} drops ${d.who}`, [`${d.mw} MW contract ended early`, `${money(fee)} paid to walk away`]);
  return true;
}

export function decline(s: GameState, id: number) {
  const o = s.offers.find(x => x.id === id);
  if (!o) return false;
  s.offers = s.offers.filter(x => x.id !== id);
  note(s, `Passed on ${o.who}`);
  return true;
}

/** The first customer, signed at opening for what your halls can run. */
export function anchorDeal(s: GameState, kind: CustKey, mw: number): Deal {
  const o = makeOffer(s, kind, Math.max(1, Math.floor(mw)));
  return { ...o, months: 36, lead: 0, needs: [], price: Math.round(marketPrice(s, kind)), start: 0, until: 36, strikes: 0 };
}

// ---------- chips ----------

/** Halls fitted with chips older than the newest. */
export const staleHalls = (s: GameState) => s.floors.filter(f => f.done && f.type === 'hall' && genOf(f) < s.chip).length;
/** Refitting a hall with today's chips costs most of a new hall. */
export const refreshCost = (s: GameState) => today(s, TYPES.hall.cost * 0.7 * (1 + 0.25 * (s.chip - 1)));
export const canRefresh = (s: GameState, i: number) => {
  const f = s.floors[i];
  return !!f && f.done && f.type === 'hall' && genOf(f) < fitGen(s) && !s.build;
};

// ---------- the grid queue ----------

/** The most grid you can ask for at your size. */
export const gridAsk = (s: GameState) => GRID_ASK[s.tier];
export const gridDeposit = (s: GameState, mw: number) => today(s, 400_000 * mw);
export const gridWait = (s: GameState, mw: number) => Math.round(LOCS[s.loc].queue * (1 + mw / 100));
export function gridBlock(s: GameState): string | null {
  if (s.gridQueue) return `In the queue: ${Math.max(1, Math.ceil(s.gridQueue.done - s.month))} mo`;
  if (hasLaw(s, 'eirgrid')) return 'Grid connections paused';
  return null;
}
export function requestGrid(s: GameState, mw: number) {
  const fee = gridDeposit(s, mw);
  if (gridBlock(s) || mw > gridAsk(s) || s.cash < fee) return false;
  s.cash -= fee;
  const wait = gridWait(s, mw);
  s.gridQueue = { mw, done: s.month + wait };
  note(s, `Joined the ${LOCS[s.loc].gov.utility} queue for ${mw} MW. About ${wait} months`);
  return true;
}

// ---------- the reactor ----------

export const SMR_COST = 450_000_000;
export const SMR_MONTHS = 36;

// ---------- the monthly tick ----------

/** End of month for the business: deals, offers, chips, the grid queue and tiers. */
export function dealsMonth(s: GameState, l: Ledger) {
  // customers you can't supply strike; three strikes and they leave
  for (const { d, got } of allocate(s, l.itMW)) {
    if (got < d.mw * 0.9) {
      d.strikes++;
      note(s, `${d.who} got ${got.toFixed(1)} of ${d.mw} MW. Strike ${d.strikes}/3`);
      if (d.strikes >= 3) {
        d.until = s.month;
        s.trust = Math.max(0, s.trust - 2);
        headline(s, 'Business news', `${d.who} walks out of ${siteName(s)}`, [`Promised ${d.mw} MW, never got it`, 'Other customers take note']);
      }
    } else if (d.strikes > 0 && Math.random() < 0.15) d.strikes--;
  }
  // deals that end may come back as a renewal at today's price
  for (const d of s.deals.filter(x => x.until <= s.month && x.until > s.month - 1 && x.strikes < 3)) {
    note(s, `${d.who}'s deal ended`);
    if (Math.random() < (s.rival && s.rival.mw > l.itMW ? 0.45 : 0.7)) s.offers.push({ ...makeOffer(s, d.kind, d.mw), who: d.who, lead: 0 });
    else if (s.rival) note(s, `${d.who} moved to ${s.rival.name}`);
  }
  s.deals = s.deals.filter(d => d.until > s.month);

  // offers expire, and new ones come in; more in a boom, fewer in a crash
  const gone = s.offers.filter(o => o.expires <= s.month);
  if (gone.length) note(s, `${gone.map(o => o.who).join(', ')} went elsewhere`);
  s.offers = s.offers.filter(o => o.expires > s.month);
  const p = { normal: 0.45, boom: 0.7, glut: 0.2 }[s.market.phase];
  if (s.offers.length < 4 && Math.random() < p * (s.rival && s.rival.mw > l.itMW ? 0.7 : 1)) s.offers.push(makeOffer(s));

  // new chips ship now and then; your halls get older without changing
  if (s.month >= s.chipAt && s.chip < CHIPS.length - 1) {
    s.chip++;
    s.chipAt = s.month + CHIP_EVERY + Math.round(rnd(-6, 6));
    const c = CHIPS[s.chip];
    headline(s, 'Tech news', `${c.name} ship`, [
      `${c.mw} MW per hall`, 'Older chips are worth less to customers',
      s.chip >= LIQUID_GEN ? 'They need liquid cooling' : 'Labs rush to upgrade',
    ]);
  }

  // the utility connects you when your turn comes
  if (s.gridQueue && s.month >= s.gridQueue.done) {
    s.gridAdded += s.gridQueue.mw;
    headline(s, 'Local news', `${LOCS[s.loc].gov.utility} connects ${s.gridQueue.mw} MW to ${siteName(s)}`, ['New lines and a substation are live', 'Neighbors ask who pays for it']);
    s.gridQueue = null;
  }
  if (s.smrAt !== null && s.month >= s.smrAt) {
    s.up.smr = true;
    s.smrAt = null;
    headline(s, 'Breaking news', `${siteName(s)} switches on its own reactor`, ['60 MW of carbon-free power on site', 'A first for the town']);
  }

  // growing into the next tier
  s.peakMW = Math.max(s.peakMW, l.itMW);
  const tier = tierOf(s.peakMW);
  if (tier > s.tier) {
    s.tier = tier;
    s.tierUp = tier;
    headline(s, 'Business news', `${siteName(s)} is now a ${TIERS[tier].name.toLowerCase()}`, [TIERS[tier].unlock, `${Math.round(s.peakMW)} MW and climbing`]);
    // a big customer comes calling
    s.offers.push(makeOffer(s));
  }
}

/** Halls short of the newest chips, and what customers pay for them. */
export function chipSummary(s: GameState) {
  const halls = s.floors.filter(f => f.done && f.type === 'hall');
  const avg = halls.length ? halls.reduce((t, f) => t + chipValue(s, f), 0) / halls.length : 1;
  return { halls: halls.length, stale: staleHalls(s), value: avg };
}

/** MW signed against what you can run today, for warnings. */
export function capacityGap(s: GameState, l: Ledger = ledger(s)) {
  return signedMW(s) - l.itMW;
}

export const dealMonthly = (d: Offer) => d.mw * 1000 * d.price;
export const dealLabel = (d: Offer) => `${d.mw} MW · ${money(d.price)}/kW · ${d.months / 12} yrs`;
export { hallCount };
