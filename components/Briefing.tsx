'use client';

import type { Action } from '@/lib/game/actions';
import { briefing } from '@/lib/game/strategy';
import { money, type GameState } from '@/lib/game/state';

/** Once a year: where things stand and what's coming. The game waits while it's open. */
export function Briefing({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const year = Math.floor(s.month / 12);
  const rows = briefing(s);
  return (
    <div className="share-back" role="dialog" aria-labelledby="brief-title">
      <div className="share brief">
        <span className="stepno">Year {year} briefing</span>
        <h2 id="brief-title">{s.codename ?? (s.look.name.trim() || 'Your datacenter')}</h2>
        <div className="brief-rows">
          {rows.map(r => (
            <div key={r.label} className={r.bad ? 'bad' : undefined}><span>{r.label}</span><b>{r.value}</b></div>
          ))}
        </div>
        <p className="muted small">Last year you made {money(s.books ? s.books.net * 12 : 0)} at this month&apos;s pace. Cash on hand {money(s.cash)}.</p>
        <div className="share-foot">
          <button className="go" onClick={() => dispatch({ type: 'briefing' })}>Back to work</button>
        </div>
      </div>
    </div>
  );
}
