import type { Decision } from './gov';
import { hallCount, money, note, ownerName, siteName, today, VISA_FEE, type GameState } from './state';

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
    { label: 'Pay', value: [-5, 3, 10][S.pay], note: ['Below market', '+10%', '+20%'][S.pay] },
    { label: 'Health insurance', value: S.health ? 10 : -6, note: S.health ? 'Covered' : 'None' },
    { label: 'Retirement plan', value: S.retire ? 5 : 0, note: S.retire ? 'Yes' : 'None' },
    {
      label: 'Break rooms', note: `${have}/${need} needed`,
      // a few techs share the lobby kitchen; a real crew needs its own rooms
      value: s.workers.length < 6 ? 0 : have === 0 ? -12 : have < need ? -6 : 5,
    },
    { label: 'Overtime', value: S.overtime ? -12 : 0, note: 'Long shifts' },
    // fewer than 2 techs per hall means everyone covers too much
    { label: 'Workload', value: s.workers.length && s.workers.length < hallCount(s) * 2 ? -8 : 0, note: `${s.workers.length} techs for ${hallCount(s)} halls` },
    { label: 'Big company feel', value: -Math.round(Math.max(0, s.workers.length - 20) * 0.3), note: `${s.workers.length} techs` },
    { label: 'Outages', value: -4 * s.broken.length, note: `${s.broken.length} floors down` },
    { label: 'Union contract', value: S.union ? 8 : 0, note: 'Protected' },
    { label: 'Team events and layoffs', value: Math.round(S.cheer), note: 'Fades over time' },
  ].filter(p => p.value !== 0);
  const BASE = 58;
  return { base: BASE, parts, target: clamp(BASE + parts.reduce((t, p) => t + p.value, 0), 0, 100) };
}

export const TEAM_EVENT_WAIT = 6;
export const teamEventCost = (s: GameState) => today(s, 20_000 + 2_000 * s.workers.length);
export const BOOST_MONTHS = 3;
export const BOOST_WAIT = 6;
export const boostCost = (s: GameState) => today(s, 250_000);

/** Give the union what it asked for and end the strike. */
export function settle(s: GameState) {
  Object.assign(s.staff, { union: true, health: true, retire: true, strike: false, struck: 0, pay: Math.max(s.staff.pay, 1) });
  s.staff.cheer += 15;
  note(s, 'Strike over. Techs are back at work.');
}

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
        apply: settle,
      },
      { label: 'Wait it out', note: 'Trust −3', apply: s => addTrust(s, -3) },
    ],
  },
];

/** End of month for your staff. Returns a decision to ask about, if any. */
export function staffMonth(s: GameState): string | null {
  const S = s.staff;
  const mood = moraleMood(s);
  // morale moves slowly: people put up with a lot before they organize
  S.morale = clamp(S.morale + (mood.target - S.morale) * 0.1, 0, 100);
  S.cheer *= 0.9;
  S.cuts *= 0.6;
  S.low = S.morale < 45 ? S.low + 1 : 0;
  s.boosts = s.boosts.filter(b => b.until > s.month);

  // overseas techs' visas renew every year
  const due = s.workers.filter(w => w.overseas && (w.visaAt ?? 0) <= s.month);
  if (due.length) {
    const fee = today(s, VISA_FEE) * due.length;
    s.cash -= fee;
    for (const w of due) w.visaAt = s.month + 12;
    note(s, `Visa renewals for ${due.length} ${due.length === 1 ? 'tech' : 'techs'}: −${money(fee)}`);
  }

  // unhappy techs leave
  if (S.morale < 30 && !S.strike) {
    const quit = s.workers.filter(() => Math.random() < 0.05);
    if (quit.length) {
      s.workers = s.workers.filter(w => !quit.includes(w));
      note(s, `${quit.map(w => w.name).join(', ')} quit. Morale is low.`);
    }
  }

  // walkouts
  // strikes come from a union that isn't being heard
  if (!S.strike && S.union && S.morale < 25 && S.low >= 6 && s.workers.length >= 6) {
    S.strike = true;
    if (!s.fired.includes('strike')) s.fired.push('strike');
    s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Breaking news', headline: `Techs walk out at ${siteName(s)}`, ticker: [`Workers say ${ownerName(s)} ignored them`, 'Halls slow to a crawl'] };
    note(s, 'Your techs are on strike');
  } else if (S.strike && S.morale >= 45) {
    S.strike = false;
    S.struck = 0;
    note(s, 'Strike over. Techs are back at work.');
  } else if (S.strike) {
    // a long strike becomes a story, and the town picks a side
    S.struck++;
    const n = S.struck;
    if (n === 3) {
      addTrust(s, -4);
      s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Local news', headline: `Strike at ${siteName(s)} enters month three`, ticker: ['Picket line grows outside the gate', `Families ask ${ownerName(s)} to settle`] };
    } else if (n >= 6 && n % 6 === 0) {
      addTrust(s, -6);
      if (s.bill) s.bill.progress = clamp(s.bill.progress + 5, 0, 100);
      s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Breaking news', headline: `${n}-month strike at ${siteName(s)} goes national`, ticker: ['Other unions join the picket', `Senators question ${ownerName(s)}`, 'Customers ask about outages'] };
    }
  }

  if (s.complaint || s.month < s.calm) return null;
  const ready = (id: string) => (s.cooldown[id] ?? 0) <= s.month;
  if (S.strike && ready('strike')) return 'strike';
  if (S.morale < 40 && !S.union && s.workers.length >= 8 && s.month >= 12 && S.low >= 6 && ready('union')) return 'union';
  if (S.low >= 4 && !S.health && s.workers.length >= 4 && ready('staffAsk')) return 'staffAsk';
  return null;
}
