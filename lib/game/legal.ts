import { impact } from './events';
import { ledger, money, note, today, type GameState } from './state';

/*
 * Legal: claims that build up from what you do (diesel runs, cut trees, ignored noise), what it costs
 * to settle them early or fix the cause, a law firm on retainer, and the record of every case.
 */

export interface Case { what: string; result: 'settled' | 'won' | 'lost' | 'paid' | 'denied' | 'fined'; cost: number; month: number }

export const LAWYER_COST = 120_000;

export interface Claim {
  name: string;
  cause: (s: GameState) => string;
  /** settling before they file: a share of what they'll ask for later */
  early: (s: GameState) => number;
  /** a fix that makes the claim go away */
  fix?: { label: string; cost: (s: GameState) => number };
}

export const CLAIMS: Record<string, Claim> = {
  dieselSuit: { name: 'Diesel exhaust', cause: () => 'Generators ran during strikes', early: s => today(s, 3_000_000) },
  flood: {
    name: 'Stormwater flooding', cause: s => `${impact(s, ledger(s)).cleared} trees cut`, early: s => today(s, 1_800_000),
    fix: { label: 'Stormwater pond', cost: s => today(s, 1_500_000) },
  },
  sleepStudy: {
    name: 'Hum and sleep', cause: s => `${s.tally.ignored} noise complaints ignored`, early: s => today(s, 4_500_000),
    fix: { label: 'Sound wall', cost: s => today(s, 1_500_000) },
  },
};

export const record = (s: GameState, c: Omit<Case, 'month'>) => { s.cases = [{ ...c, month: Math.floor(s.month) }, ...(s.cases ?? [])].slice(0, 20); };

/** Pay to settle a claim before it's filed. */
export function settleEarly(s: GameState, id: string) {
  const c = CLAIMS[id], cost = c?.early(s) ?? 0;
  if (!c || !s.seeds.some(x => x.id === id) || s.cash < cost) return false;
  s.cash -= cost;
  s.seeds = s.seeds.filter(x => x.id !== id);
  record(s, { what: c.name, result: 'settled', cost });
  note(s, `Settled the ${c.name.toLowerCase()} claim: −${money(cost)}`);
  return true;
}

/** Fix what the claim is about, and it goes away. */
export function fixClaim(s: GameState, id: string) {
  const c = CLAIMS[id], cost = c?.fix?.cost(s) ?? 0;
  if (!c?.fix || !s.seeds.some(x => x.id === id) || s.cash < cost) return false;
  s.cash -= cost;
  s.seeds = s.seeds.filter(x => x.id !== id);
  if (id === 'sleepStudy') s.up.soundWalls = true;
  note(s, `${c.fix.label} built. ${c.name} claim dropped`);
  return true;
}
