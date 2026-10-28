'use client';

import type { Action } from '@/lib/game/actions';
import { money, type GameState, type QuarterReport } from '@/lib/game/state';

/** A quarter's books on one page: income, costs, what you spent on growing, and the bottom line. */
export function Statement({ r }: { r: QuarterReport }) {
  const up = r.prev === null ? null : r.change - r.prev;
  return (
    <div className="statement">
      <div className="st-col">
        <span className="label">Income</span>
        {r.income.map(x => <div key={x.label} className="st-row"><span>{x.label}</span><b>{money(x.value)}</b></div>)}
        <span className="label">Costs</span>
        {r.costs.map(x => <div key={x.label} className="st-row"><span>{x.label}</span><b className="neg">−{money(x.value)}</b></div>)}
        <div className="st-row sum"><span>Running profit</span><b className={r.operating < 0 ? 'neg' : 'pos'}>{money(r.operating)}</b></div>
      </div>
      <div className="st-col">
        <span className="label">Other money</span>
        <div className="st-row"><span>Building and one-offs</span><b className={r.spent > 0 ? 'neg' : undefined}>{r.spent > 0 ? `−${money(r.spent)}` : '$0'}</b></div>
        {r.rewards > 0 && <div className="st-row"><span>Goal rewards</span><b>{money(r.rewards)}</b></div>}
        {r.borrowed > 0 && <div className="st-row"><span>Borrowed</span><b>{money(r.borrowed)}</b></div>}
        <div className={`st-total ${r.change < 0 ? 'loss' : 'gain'}`}>
          <span>{r.change < 0 ? 'Loss' : 'Profit'} this quarter</span>
          <b>{money(r.change)}</b>
          {up !== null && <small>{up >= 0 ? '▲' : '▼'} {money(Math.abs(up))} vs last quarter</small>}
        </div>
      </div>
    </div>
  );
}

/** Every three months the game stops for the quarter's numbers. */
export function Report({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  if (!s.report) return null;
  return (
    <div className="share-back" role="dialog" aria-labelledby="q-title">
      <div className="share brief card-pop">
        <span className="stepno">Quarterly report</span>
        <h2 id="q-title">{s.report.label}</h2>
        <Statement r={s.report} />
        <div className="share-foot">
          <button className="go" onClick={() => dispatch({ type: 'report' })}>Back to work</button>
        </div>
      </div>
    </div>
  );
}
