import { LOCS, type LocKey } from './game/data';
import { rating } from './game/events';
import { bOf, ledger, ownerName, siteName, type GameState } from './game/state';

/*
 * A share link carries the run in its query string, so the link preview on X can draw the card
 * on the server without storing anything.
 */

export interface Run {
  name: string; owner: string; loc: LocKey; years: number; rating: number; floors: number; techs: number;
  profit: number; end: '' | 'bankrupt' | 'town';
  /** each building's floors, bottom up: thread hex, or '' for bare cloth */
  towers: string[][]; outline: string;
}

export function runOf(s: GameState): Run {
  const over = s.phase === 'over';
  const towers: string[][] = Array.from({ length: Math.max(1, s.campus) }, () => []);
  s.floors.forEach((f, i) => towers[bOf(s, i)]?.push(f.fill === 'cloth' ? '' : f.fill.replace('#', '')));
  return {
    name: siteName(s), owner: ownerName(s), loc: s.loc,
    years: Math.max(1, Math.floor(s.month / 12) + 1),
    rating: over ? s.tally.best : rating(s).total,
    floors: s.floors.length, techs: s.workers.length,
    profit: Math.round(over ? s.tally.profit : ledger(s).net),
    end: over ? (s.over?.reason === 'town' ? 'town' : 'bankrupt') : '',
    towers, outline: s.look.outline.replace('#', ''),
  };
}

export function encodeRun(r: Run) {
  const q = new URLSearchParams({
    n: r.name.slice(0, 40), o: r.owner.slice(0, 40), l: r.loc, y: String(r.years), r: String(r.rating),
    f: String(r.floors), t: String(r.techs), p: String(r.profit), c: r.towers.map(t => t.map(x => x || 'x').join('.')).join('-'), k: r.outline,
  });
  if (r.end) q.set('e', r.end);
  return q.toString();
}

const HEX = /^[0-9a-fA-F]{6}$/;
const num = (v: string | null, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** Reads a run back from a link, keeping only sane values. */
export function decodeRun(q: URLSearchParams): Run {
  const loc = (q.get('l') ?? '') in LOCS ? (q.get('l') as LocKey) : 'dalles';
  const towers = (q.get('c') ?? '').split('-').slice(0, 3)
    .map(t => t.split('.').slice(0, 120).map(x => (HEX.test(x) ? x : '')));
  const e = q.get('e');
  return {
    name: (q.get('n') ?? 'My datacenter').slice(0, 40), owner: (q.get('o') ?? '').slice(0, 40), loc,
    years: num(q.get('y'), 1, 9999), rating: num(q.get('r'), 0, 100), floors: num(q.get('f'), 0, 999), techs: num(q.get('t'), 0, 9999),
    profit: Number(q.get('p')) || 0, end: e === 'bankrupt' || e === 'town' ? e : '',
    towers: towers.length && towers[0].length ? towers : [['', '', '', '']],
    outline: HEX.test(q.get('k') ?? '') ? q.get('k')! : '1F4FD8',
  };
}
