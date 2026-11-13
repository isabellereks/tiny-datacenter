'use client';

import { GENS, baselineRevenue, calendar, histGen, realMarketCap } from '@/lib/nv/history';
import { marketCap } from '@/lib/nv/sim';

import type { Action } from '@/lib/game/actions';
import { briefing } from '@/lib/game/strategy';
import { money, type GameState } from '@/lib/game/state';

/** Once a year: the size, the cash, and what's gone wrong. The game waits while it's open. */
export function Briefing({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const year = Math.floor(s.month / 12);
  // only what matters: the size, then anything that's gone wrong
  const all = s.nv ? nvBriefing(s) : briefing(s);
  const rows = s.nv ? all : [all[0], ...all.slice(1).filter(r => r.bad)];
  return (
    <div className="share-back" role="dialog" aria-labelledby="brief-title">
      <div className="share brief">
        <span className="stepno">{s.nv ? calendar(s.month).year : `Year ${year}`}</span>
        <h2 id="brief-title">{s.look.name.trim() || 'Your datacenter'}</h2>
        <div className="brief-rows">
          {rows.map(r => (
            <div key={r.label} className={r.bad ? 'bad' : undefined}><span>{r.label}</span><b>{r.value}</b></div>
          ))}
        </div>
        <div className="brief-rows">
          <div><span>Cash</span><b>{money(s.cash)}</b></div>
          {s.report && <div className={s.report.change < 0 ? 'bad' : undefined}><span>{s.report.label}</span><b>{money(s.report.change)}</b></div>}
        </div>
        <div className="share-foot">
          <button className="go" onClick={() => dispatch({ type: 'briefing' })}>Back to work</button>
        </div>
      </div>
    </div>
  );
}

/** The chip company's year: sales, value and chips, against the real company. */
function nvBriefing(s: GameState) {
  const n = s.nv!, m = Math.floor(s.month);
  const sales = n.books.revenue * 12, real = baselineRevenue(m) * 12;
  const cap = marketCap(n, m, s.cash), realCap = realMarketCap(m);
  const rows = [
    { label: 'Sales a year', value: `${money(sales)} · real ${money(real)}`, bad: sales < real * 0.8 },
    { label: 'Chip', value: `${n.gen >= 0 ? GENS[n.gen].name : 'None'} · real ${GENS[histGen(m)].name}`, bad: n.gen < histGen(m) },
  ];
  if (n.ipo || realCap) rows.push({ label: 'Value', value: `${n.ipo ? money(cap) : 'Private'} · real ${realCap ? money(realCap) : 'private'}`, bad: n.ipo && cap < realCap * 0.8 });
  return rows;
}
