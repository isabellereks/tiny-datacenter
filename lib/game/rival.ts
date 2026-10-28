import { HYPERSCALERS } from './data';
import type { Decision } from './gov';
import { marketPrice, money, note, promisedMW, siteName, today, type GameState, type Ledger } from './state';

/*
 * Things that make a month interesting: someone desperate wants your spare capacity right now,
 * and a rival opens across town, chases your techs and your customers, and can be outgrown.
 */

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function headline(s: GameState, tag: string, text: string, ticker: string[]) {
  s.news = { id: (s.news?.id ?? 0) + 1, tag, headline: text, ticker };
  note(s, text);
}

const RUSHERS = ['ChatterBox, a viral app', 'Pixtral, launching tomorrow', 'TikTalk, trending worldwide', 'Gemma Games, opening weekend', 'SoraBand, gone viral overnight'];

/** The rival is bigger than you, so they win more of the market. */
export const rivalAhead = (s: GameState, l: Ledger) => !!s.rival && s.rival.mw > l.itMW;

export const EVENT_DECISIONS: Decision[] = [
  {
    id: 'rush', from: () => 'A rush order',
    title: s => `${s.event?.who ?? 'Someone'} needs ${s.event?.mw ?? 0} MW now`,
    body: s => `They'll pay ${money(s.event?.price ?? 0)} per kW a month for ${s.event?.months ?? 3} months, starting today. Only spare capacity can take it.`,
    choices: [
      {
        label: 'Take it', note: 'Starts now',
        apply: s => {
          const e = s.event;
          if (!e) return;
          s.deals.push({ id: s.nid++, who: e.who.split(',')[0], kind: 'ai', mw: e.mw, price: e.price, months: e.months, lead: 0, needs: [], expires: s.month, start: s.month, until: s.month + e.months, strikes: 0 });
          s.event = null;
        },
      },
      { label: 'Pass', note: 'They go elsewhere', apply: s => { s.event = null; } },
    ],
  },
  {
    id: 'poach', from: s => s.rival?.name ?? 'A rival',
    title: s => `${s.rival?.name ?? 'A rival'} wants ${s.event?.who ?? 'one of your techs'}`,
    body: s => `They offered ${s.event?.who ?? 'your tech'} 30% more to come work across town.`,
    choices: [
      {
        label: 'Match it', note: 'A retention bonus', cost: s => today(s, 30_000),
        apply: s => { s.staff.cheer += 3; s.event = null; },
      },
      {
        label: 'Let them go', note: 'Morale −4',
        apply: s => {
          const w = s.workers.find(x => x.name === s.event?.who);
          if (w) { s.workers = s.workers.filter(x => x !== w); note(s, `${w.name} left for ${s.rival?.name}`); }
          s.staff.cheer -= 4;
          s.event = null;
        },
      },
    ],
  },
];

/** End of month for surprises. Returns a decision to ask about, if any. */
export function eventsMonth(s: GameState, l: Ledger): string | null {
  const m = Math.floor(s.month);
  const ready = (id: string) => (s.cooldown[id] ?? 0) <= s.month;

  // a rival breaks ground once you've made a name, and grows every month
  if (!s.rival && m >= 24 && !s.fired.includes('rival') && Math.random() < 0.06) {
    s.fired.push('rival');
    s.rival = { name: pick(HYPERSCALERS), mw: Math.max(10, Math.round(l.itMW * 0.9)), since: m };
    headline(s, 'Business news', `${s.rival.name} breaks ground across town`, [`A ${s.rival.mw} MW datacenter next door to ${siteName(s)}`, 'Same customers, same techs, same grid']);
  }
  if (s.rival) {
    s.rival.mw *= 1.012;
    // outgrow them by half and they give up on this town
    if (l.itMW > s.rival.mw * 1.5 && m - s.rival.since >= 12) {
      headline(s, 'Business news', `${s.rival.name} pulls out of town`, [`${siteName(s)} won the market`, `${Math.round(l.itMW)} MW against their ${Math.round(s.rival.mw)}`]);
      s.rival = null;
      s.fired.push('rivalBeaten');
      return null;
    }
  }

  if (s.complaint || s.month < s.calm) return null;
  // spare capacity draws rush orders
  const spare = l.itMW - promisedMW(s);
  if (spare >= 2 && ready('rush') && Math.random() < 0.12) {
    s.event = { who: pick(RUSHERS), mw: Math.max(1, Math.floor(Math.min(spare, 2 + Math.random() * 8))), price: Math.round(marketPrice(s, 'ai') * 1.8), months: 3 };
    s.cooldown.rush = s.month + 4;
    return 'rush';
  }
  // the rival goes after your techs when they're not happy
  if (s.rival && s.workers.length > 3 && s.staff.morale < 65 && ready('poach') && Math.random() < 0.08) {
    s.event = { who: pick(s.workers).name, mw: 0, price: 0, months: 0 };
    return 'poach';
  }
  return null;
}
