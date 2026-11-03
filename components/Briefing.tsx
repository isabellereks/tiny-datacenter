'use client';

import type { Action } from '@/lib/game/actions';
import { briefing } from '@/lib/game/strategy';
import { money, type GameState } from '@/lib/game/state';

/** Once a year: the size, the cash, and what's gone wrong. The game waits while it's open. */
export function Briefing({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const year = Math.floor(s.month / 12);
  // only what matters: the size, then anything that's gone wrong
  const all = briefing(s);
  const rows = [all[0], ...all.slice(1).filter(r => r.bad)];
  return (
    <div className="share-back" role="dialog" aria-labelledby="brief-title">
      <div className="share brief">
        <span className="stepno">Year {year}</span>
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
