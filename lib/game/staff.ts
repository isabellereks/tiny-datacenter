import type { Decision } from './gov';
import { note, ownerName, siteName, today, type GameState } from './state';

/*
 * How your techs feel. Morale drifts toward what their pay, benefits and break rooms deserve.
 * Low morale brings requests, then a union drive, then a strike, and people quit.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const addTrust = (s: GameState, d: number) => { s.trust = clamp(s.trust + d, 0, 100); };

/** One break room keeps up to 8 techs rested. */
export const breaksNeeded = (s: GameState) => Math.ceil(s.workers.length / 8);
export const breakRooms = (s: GameState) => s.floors.filter(f => f.done && f.type === 'break').length;

export interface MoraleParts { base: number; parts: { label: string; value: number; note: string }[]; target: number }

export function moraleMood(s: GameState): MoraleParts {
  const S = s.staff;
  const need = breaksNeeded(s), have = breakRooms(s);
  const parts = [
    { label: 'Pay', value: [0, 8, 15][S.pay], note: ['Standard', '+10%', '+20%'][S.pay] },
    { label: 'Health insurance', value: S.health ? 10 : -8, note: S.health ? 'Covered' : 'None' },
    { label: 'Retirement plan', value: S.retire ? 5 : 0, note: S.retire ? 'Yes' : 'None' },
    {
      label: 'Break rooms', note: `${have}/${need} needed`,
      value: !s.workers.length ? 0 : have === 0 ? -15 : have < need ? -8 : 5,
    },
    { label: 'Overtime', value: S.overtime ? -12 : 0, note: 'Long shifts' },
    { label: 'Outages', value: -4 * s.broken.length, note: `${s.broken.length} floors down` },
    { label: 'Union contract', value: S.union ? 8 : 0, note: 'Protected' },
    { label: 'Team events', value: Math.round(S.cheer), note: 'Fades over time' },
  ].filter(p => p.value !== 0);
  const BASE = 55;
  return { base: BASE, parts, target: clamp(BASE + parts.reduce((t, p) => t + p.value, 0), 0, 100) };
}

export const TEAM_EVENT_WAIT = 6;
export const teamEventCost = (s: GameState) => today(s, 20_000 + 2_000 * s.workers.length);
export const BOOST_MONTHS = 3;
export const BOOST_WAIT = 6;
export const boostCost = (s: GameState) => today(s, 250_000);

export const STAFF_DECISIONS: Decision[] = [
  {
    id: 'staffAsk', from: () => 'Your techs',
    title: () => 'Techs ask for benefits',
    body: s => `Morale is ${Math.round(s.staff.morale)}. They want health insurance and enough break rooms.`,
    choices: [
      { label: 'Add health insurance', note: '$1.5k per tech a month', apply: s => { s.staff.health = true; } },
      { label: 'Say no', note: 'Morale −6', apply: s => { s.staff.cheer -= 6; } },
    ],
  },
  {
    id: 'union', from: () => 'Your techs',
    title: () => 'Techs are forming a union',
    body: s => `The ${s.workers.length} techs at ${siteName(s)} want a contract with better pay and benefits.`,
    choices: [
      {
        label: 'Recognize the union', note: 'Wages +15%, health insurance, trust +3',
        apply: s => { s.staff.union = true; s.staff.health = true; s.staff.cheer += 10; addTrust(s, 3); },
      },
      {
        label: 'Fight it', note: 'Lawyers, morale −15, trust −5', cost: s => today(s, 500_000),
        apply: s => {
          s.staff.cheer -= 15;
          addTrust(s, -5);
          s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Local news', headline: `${ownerName(s)} fights union at ${siteName(s)}`, ticker: ['Techs say pay is too low', 'Labor board complaint filed'] };
        },
      },
    ],
  },
  {
    id: 'strike', from: () => 'The union',
    title: () => 'Your techs are on strike',
    body: () => 'Halls run at 30% until you settle.',
    choices: [
      {
        label: 'Meet their demands', note: 'Pay +10%, union, health and retirement',
        apply: s => {
          Object.assign(s.staff, { union: true, health: true, retire: true, strike: false, pay: Math.max(s.staff.pay, 1) });
          s.staff.cheer += 15;
          note(s, 'Strike over. Techs are back at work.');
        },
      },
      { label: 'Wait it out', note: 'Trust −3', apply: s => addTrust(s, -3) },
    ],
  },
];

/** End of month for your staff. Returns a decision to ask about, if any. */
export function staffMonth(s: GameState): string | null {
  const S = s.staff;
  const mood = moraleMood(s);
  S.morale = clamp(S.morale + (mood.target - S.morale) * 0.25, 0, 100);
  S.cheer *= 0.9;
  S.low = S.morale < 45 ? S.low + 1 : 0;
  s.boosts = s.boosts.filter(b => b.until > s.month);

  // unhappy techs leave
  if (S.morale < 30 && !S.strike) {
    const quit = s.workers.filter(() => Math.random() < 0.05);
    if (quit.length) {
      s.workers = s.workers.filter(w => !quit.includes(w));
      note(s, `${quit.map(w => w.name).join(', ')} quit. Morale is low.`);
    }
  }

  // walkouts
  if (!S.strike && S.morale < 20 && s.workers.length >= 3) {
    S.strike = true;
    if (!s.fired.includes('strike')) s.fired.push('strike');
    s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Breaking news', headline: `Techs walk out at ${siteName(s)}`, ticker: [`Workers say ${ownerName(s)} ignored them`, 'Halls slow to a crawl'] };
    note(s, 'Your techs are on strike');
  } else if (S.strike && S.morale >= 45) {
    S.strike = false;
    note(s, 'Strike over. Techs are back at work.');
  }

  if (s.complaint || s.month < s.calm) return null;
  const ready = (id: string) => (s.cooldown[id] ?? 0) <= s.month;
  if (S.strike && ready('strike')) return 'strike';
  if (S.morale < 35 && !S.union && s.workers.length >= 4 && ready('union')) return 'union';
  if (S.low >= 3 && !S.health && ready('staffAsk')) return 'staffAsk';
  return null;
}
