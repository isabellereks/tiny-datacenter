import type { Action } from '@/lib/game/actions';
import { FOUNDS } from '@/lib/game/data';
import { money, type GameState, type Stats } from '@/lib/game/state';

function Meter({ label, demand, supply }: { label: string; demand: number; supply: number }) {
  const ratio = supply ? demand / supply : demand ? 2 : 0;
  return (
    <div className="meter">
      <span>{label}</span>
      <div className={`cap${ratio > 1 ? ' over' : ''}`}><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
      <span>{demand.toFixed(1)} / {supply.toFixed(1)} MW</span>
    </div>
  );
}

export function Hud({ s, st, dispatch, onResetView }: { s: GameState; st: Stats; dispatch: (a: Action) => void; onResetView: () => void }) {
  return (
    <section className="hud glass" aria-label="Status">
      <div className="hudtop">
        <span className="name">Tiny Datacenter</span>
        <span className="name">{s.floors.length} of {FOUNDS[s.found].max} floors</span>
      </div>
      <div className="cashrow">
        <span className="cash">{money(s.cash)}</span>
        <span className="rate">+{money(st.rev)}/s</span>
      </div>
      <Meter label="Power" demand={st.demand} supply={st.pSup} />
      <Meter label="Cooling" demand={st.demand} supply={st.cSup} />
      {st.eff < 0.999 && (
        <p className="warn">Halls slowed to {Math.round(st.eff * 100)}%. Add a {st.pe < 1 ? 'power' : 'cooling'} floor.</p>
      )}
      <div className="hudtools">
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={s.inside} onClick={() => dispatch({ type: 'inside', inside: true })}>Inside</button>
          <button aria-pressed={!s.inside} onClick={() => dispatch({ type: 'inside', inside: false })}>Outside</button>
        </div>
        <button className="iconbtn" onClick={onResetView} aria-label="Reset view" title="Reset view">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
