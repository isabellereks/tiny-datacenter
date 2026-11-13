import {
  END_MONTH, GENS, SEGS, baselineRevenue, dateOf, grossMargin, histGen, histOpex, histTeams, mixAt, priceToSales, realMarketCap,
  teamCost, ym, type Seg,
} from './history';

/*
 * The chip company: design a generation with your engineering teams, tape it out, order wafers from the foundry,
 * and sell into markets that grow and crash the way they really did. Your revenue is the real company's revenue
 * scaled by how you're doing: a chip behind the times, no software for AI, or no console deal all cost you.
 * In story mode it runs on the real numbers and decisions go the way they really went.
 */

export type Mode = 'choices' | 'story';
export type Bet = 'safe' | 'bold';

export interface Project { gen: number; progress: number; need: number; bet: Bet; respins: number; from: number }

export interface NvBooks {
  revenue: number;
  bySeg: Record<Seg, number>;
  demand: number;
  /** chips made this month, at cost, and what's left unsold */
  made: number; cogs: number;
  opex: number;
  tax: number;
  net: number;
  margin: number;
}

export interface NvState {
  mode: Mode;
  /** generation you sell now (-1 before the first chip), when it launched, and how good it turned out */
  gen: number; launched: number; quality: number;
  project: Project | null;
  /** 0 value, 1 standard, 2 premium */
  price: number;
  /** wafers ordered against demand: 0 tight, 1 matched, 2 ample */
  supply: number;
  /** chips made and not sold, at cost */
  inventory: number;
  ipo: boolean;
  flags: string[];
  /** monthly revenue, newest first, for the market's view of growth */
  revs: number[];
  books: NvBooks;
  peakCap: number;
  /** month a pending deal is decided (the ARM bid) */
  armAt?: number;
  /** money paid ahead to the foundry, used up as chips are made */
  prepaid?: number;
  /** the founders' share of the company after every round of funding */
  stake?: number;
  /** a chip launch on stage, until it's been seen */
  reveal?: { gen: number; id: number } | null;
}

export const has = (n: NvState, f: string) => n.flags.includes(f);

export const PRICES = [{ label: 'Value', share: 1.08, margin: -0.06 }, { label: 'Standard', share: 1, margin: 0 }, { label: 'Premium', share: 0.92, margin: 0.06 }];
export const SUPPLY = [{ label: 'Tight', k: 0.85 }, { label: 'Matched', k: 1 }, { label: 'Ample', k: 1.25 }];

export function freshNv(mode: Mode): NvState {
  return {
    mode, gen: -1, launched: 0, quality: 1, project: null, price: 1, supply: 1, inventory: 0, ipo: false, flags: [], revs: [],
    books: emptyBooks(), peakCap: 0,
  };
}
const emptyBooks = (): NvBooks => ({ revenue: 0, bySeg: { gaming: 0, pro: 0, console: 0, mobile: 0, crypto: 0, dc: 0 }, demand: 0, made: 0, cogs: 0, opex: 0, tax: 0, net: 0, margin: 0 });

// ---------- design ----------

/** Team-months a generation takes: what the real company put into it, more for a bold design. */
export function designNeed(g: number, bet: Bet) {
  // the team-months the real company had between its last launch and this one
  const prev = g > 0 ? GENS[g - 1].at : 0;
  let need = 0;
  for (let m = prev; m < Math.max(prev + 8, GENS[g].at); m++) need += histTeams(m);
  return Math.round(need * 0.85 * (bet === 'bold' ? 1.15 : 1));
}
/** Odds the first silicon works. An emulator lets you test before you commit. */
export const tapeoutOdds = (n: NvState, bet: Bet) => Math.min(0.95, (bet === 'bold' ? 0.55 : 0.85) + (has(n, 'emulator') ? 0.15 : 0));
/** Masks and tape-out for a generation: cheap in 1995, hundreds of millions by the end. */
export const tapeoutCost = (m: number) => Math.round(Math.max(300e3, baselineRevenue(m) * 0.05));

export function startProject(n: NvState, month: number, bet: Bet) {
  const g = n.gen + 1;
  if (n.project || g >= GENS.length) return false;
  n.project = { gen: g, progress: 0, need: designNeed(g, bet), bet, respins: 0, from: month };
  return true;
}

// ---------- the month's numbers ----------

/** How your current chip stacks up: a generation behind halves what you sell. */
export function chipFactor(n: NvState, m: number) {
  if (n.gen < 0) return 0;
  const gap = histGen(m) - n.gen;
  const behind = gap > 0 ? 0.5 ** gap : 1 + 0.12 * Math.min(2, -gap);
  return behind * n.quality;
}

/** What each market would buy from you this month, before supply. */
export function demandBySeg(n: NvState, m: number, brand: number): Record<Seg, number> {
  const base = baselineRevenue(m), mix = mixAt(m);
  const chips = chipFactor(n, m), fans = 0.8 + 0.4 * (brand / 100), price = PRICES[n.price].share;
  const f: Record<Seg, number> = { gaming: chips * fans, pro: chips, console: 0, mobile: chips, crypto: chips, dc: chips };
  // console money comes from deals: Sega's development fees, then the Xbox; the PS3 chip came with the times
  if (m < ym(1997, 1)) f.console = has(n, 'sega') ? 1 : 0;
  else if (m >= ym(2001, 1) && m < ym(2006, 1)) f.console = has(n, 'xbox') ? 1 : 0;
  else f.console = chips;
  if (m >= ym(1997, 1) && m < ym(1998, 6) && has(n, 'segaStay')) f.console = 0.5;
  // no chip yet: only console development fees
  if (n.gen < 0) for (const k of Object.keys(f) as Seg[]) if (k !== 'console') f[k] = 0;
  // the real company's numbers already include its own calls; only different calls move you off them
  if (has(n, 'triangles') && n.gen === 0) f.gaming *= 1.8;
  if (m >= ym(2001, 1) && m < ym(2005, 1) && !has(n, '3dfx')) f.gaming *= 0.95;
  // data center: CUDA everywhere and a bet on deep learning built that market
  if (m >= ym(2007, 1)) {
    let dc = has(n, 'cudaAll') ? 1 : 0.3;
    if (m >= ym(2013, 1)) dc *= has(n, 'deepLearning') ? 1 : 0.4;
    if (m >= ym(2020, 5) && !has(n, 'mellanox')) dc *= 0.93;
    if (m >= ym(2022, 12) && !has(n, 'dgx')) dc *= 0.97;
    if (m >= ym(2022, 10)) dc *= has(n, 'chinaChip') ? 1 : 0.85;
    if (has(n, 'armOwned')) dc *= 1.05;
    // the AI rush in 2023: without wafers locked in you can't make enough
    if (m >= ym(2023, 1) && m < ym(2025, 1) && !has(n, 'allIn')) dc *= 0.75;
    f.dc *= dc;
  }
  if (has(n, 'armOwned')) f.mobile *= 2;
  f.crypto *= has(n, 'cryptoCap') ? 0.5 : 1;
  const out = {} as Record<Seg, number>;
  for (const k of Object.keys(SEGS) as Seg[]) out[k] = base * mix[k] * f[k] * (k === 'console' ? 1 : price);
  return out;
}

/** The month ahead: what sells, what you make, what it all costs. */
export function computeBooks(n: NvState, m: number, teams: number, brand: number, story: boolean): NvBooks {
  // skipping CUDA saves a little margin for a while
  const margin = Math.max(0.05, grossMargin(m) + PRICES[n.price].margin + (!has(n, 'cudaAll') && m >= ym(2006, 11) && m < ym(2012, 1) ? 0.02 : 0));
  let bySeg: Record<Seg, number>;
  if (story) {
    const mix = mixAt(m), base = baselineRevenue(m);
    bySeg = {} as Record<Seg, number>;
    for (const k of Object.keys(SEGS) as Seg[]) bySeg[k] = base * mix[k];
  } else bySeg = demandBySeg(n, m, brand);
  const demand = Object.values(bySeg).reduce((t, x) => t + x, 0);
  // the foundry makes what you ordered against last month's sales; console fees aren't chips
  const chipDemand = demand - bySeg.console * (m < ym(1997, 1) ? 1 : 0);
  const made = story ? chipDemand : chipDemand * SUPPLY[n.supply].k;
  const available = made + n.inventory / Math.max(0.05, 1 - margin);
  const sold = Math.min(chipDemand, available);
  const scale = chipDemand > 0 ? sold / chipDemand : 0;
  for (const k of Object.keys(bySeg) as Seg[]) if (!(k === 'console' && m < ym(1997, 1))) bySeg[k] *= scale;
  const revenue = Object.values(bySeg).reduce((t, x) => t + x, 0);
  const cogs = made * (1 - margin);
  const opex = story ? histOpex(m) : teams * teamCost(m);
  const pre = revenue - cogs - opex;
  const tax = Math.max(0, pre) * 0.2;
  return { revenue, bySeg, demand, made: cogs, cogs, opex, tax, net: pre - tax, margin };
}

/** Unsold chips at the end of the month: made, less what sold, at cost. */
export function settleInventory(n: NvState) {
  const b = n.books;
  const soldCost = b.revenue * (1 - b.margin);
  n.inventory = Math.max(0, n.inventory + b.made - soldCost);
}

/** What the market would pay for you: a year of revenue at the multiple it paid the real company that month. */
export function marketCap(n: NvState, m: number, cash: number) {
  if (!n.ipo) return 0;
  const recent = n.revs.slice(0, 3);
  const run = recent.length ? recent.reduce((t, x) => t + x, 0) / recent.length : 0;
  return Math.max(0, run * 12 * priceToSales(m) + Math.max(0, cash));
}
export { realMarketCap, dateOf, END_MONTH };

/** Raising money: a venture round before the IPO, selling new shares after. Every round shrinks the founders' stake. */
export function raiseSize(n: NvState, m: number, cash: number) {
  const run = n.revs[0] ?? 0;
  return n.ipo ? Math.round(marketCap(n, m, cash) * 0.05) : Math.round(Math.max(5e6, run * 12 * 0.6));
}
export const raiseCut = (n: NvState) => (n.ipo ? 0.95 : 0.85);
