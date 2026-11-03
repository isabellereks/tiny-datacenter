import { money, note, ownerName, siteName, today, type GameState } from './state';

/*
 * The CEO: a little person in a suit who walks the lot, and the things they buy with the company's money.
 * Some show up in the world; buying toys while the town or the staff are hurting makes the news.
 */

export interface Ceo { suit: string; hair: string; owned: string[] }
export const CEO_DEFAULT: Ceo = { suit: '#1F2A44', hair: '#3B2A1A', owned: [] };
export const SUITS = ['#1F2A44', '#5A5F6B', '#7A1F2B', '#2E8B57', '#F2F2F2', '#F2B43C'];
export const HAIRS = ['#3B2A1A', '#111111', '#C9A66B', '#B5482B', '#BFBFBF', '#E86FA6'];

export interface Toy { key: string; name: string; cost: number; trust?: number; head: string }
export const TOYS: Toy[] = [
  { key: 'watch', name: 'Gold watch', cost: 80_000, head: 'wears a $80K watch to the town meeting' },
  { key: 'car', name: 'Sports car', cost: 350_000, head: 'parks a sports car out front' },
  { key: 'heli', name: 'Helicopter', cost: 6_000_000, head: 'commutes by helicopter' },
  { key: 'art', name: 'Painting', cost: 12_000_000, head: 'buys a $12M painting' },
  { key: 'mansion', name: 'Mansion', cost: 30_000_000, head: 'builds a mansion on the hill' },
  { key: 'jet', name: 'Private jet', cost: 75_000_000, head: 'buys a private jet' },
  { key: 'yacht', name: 'Superyacht', cost: 90_000_000, head: 'buys a superyacht' },
  { key: 'island', name: 'Private island', cost: 180_000_000, head: 'buys a private island' },
  { key: 'space', name: 'Trip to space', cost: 250_000_000, head: 'flies to space' },
  // the one toy the town likes
  { key: 'team', name: 'The local team', cost: 2_000_000_000, trust: 10, head: 'buys the local team' },
];

export const ceoOf = (s: GameState): Ceo => s.ceo ?? CEO_DEFAULT;
export const owns = (s: GameState, key: string) => ceoOf(s).owned.includes(key);
export const toyCost = (s: GameState, t: Toy) => today(s, t.cost);

/** The town and the techs notice when the boss buys toys during hard times. */
export const hardTimes = (s: GameState) => s.trust < 50 || s.staff.strike || s.staff.cuts > 0 || s.debt > 0;

export function buyToy(s: GameState, key: string) {
  const t = TOYS.find(x => x.key === key);
  if (!t || owns(s, key)) return false;
  const cost = toyCost(s, t);
  if (s.cash < cost) return false;
  s.cash -= cost;
  const c = ceoOf(s);
  s.ceo = { ...c, owned: [...c.owned, key] };
  const bad = !t.trust && hardTimes(s);
  const d = t.trust ?? (bad ? -3 : 0);
  s.trust = Math.max(0, Math.min(100, s.trust + d));
  if (bad) s.staff.cheer -= 3;
  s.news = {
    id: (s.news?.id ?? 0) + 1, tag: t.trust ? 'Sports news' : 'Local news', headline: `${ownerName(s)} ${t.head}`,
    ticker: t.trust ? ['Fans cheer the new owner', `${siteName(s)} on the jerseys`] : bad ? [`${money(cost)} from ${siteName(s)}`, 'Townspeople and techs are not amused'] : [`${money(cost)} from ${siteName(s)}`],
  };
  note(s, `Bought ${t.name.toLowerCase()}: −${money(cost)}${d ? `. Trust ${d > 0 ? '+' : ''}${d}` : ''}`);
  return true;
}
