'use client';

import type { Action } from '@/lib/game/actions';
import { LOCS, type LocKey } from '@/lib/game/data';
import {
  billEta, billForces, billStageName, borrowLimit, debt, LOAN_SIZES, loanRate, siteCost, siteNet,
} from '@/lib/game/strategy';
import { LOBBY_COST, MARKET_MULT, money, today, type GameState, type Ledger } from '@/lib/game/state';
import { Meter, Row, Why } from './Island';

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/** The moratorium bill: the clock you race. */
export function BillPanel({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const law = s.laws.find(x => x.id === 'moratorium' && x.until > s.month);
  const f = billForces(s, l);
  const eta = billEta(s, l);
  return (
    <>
      {(law || s.bill) && <span className="label">Moratorium bill</span>}
      {law ? (
        <p className="warn">Moratorium: no growth here for {Math.ceil(law.until - s.month)} mo</p>
      ) : s.bill ? (
        <>
          <Meter label={billStageName(s)} value={s.bill.progress} max={100} text={`${Math.round(s.bill.progress)}%`} bad={s.bill.progress >= 40} marks={[40, 80]} />
          <Why label={eta ? `Passes in about ${eta} mo` : 'Stalled'}>
            <div className="books">
              <Row label="Base pressure" value="+0.3" />
              {f.parts.map(p => <Row key={p.label} label={p.label} value={pct(p.value)} neg={p.value > 0} />)}
              <Row label="Per month" value={pct(f.total)} strong neg={f.total > 0} />
            </div>
          </Why>
        </>
      ) : null}
      {(s.bill || s.notoriety >= 5) && <Meter label="Notoriety" value={s.notoriety} max={100} text={`${Math.round(s.notoriety)}`} bad={s.notoriety >= 50} />}
      {s.codename && <p className="muted small">Filed as {s.codename}</p>}
      {(s.bill || s.lobby) && <div className="ups">
        <button className="up" aria-pressed={s.lobby} onClick={() => dispatch({ type: 'lobby', on: !s.lobby })}>
          <b>Lobbyists</b><small>{money(today(s, LOBBY_COST))}/mo</small>
          <span>{s.lobby ? 'Hired' : 'None'}</span>
        </button>
      </div>}
    </>
  );
}

/** Market, loans and the big contract. */
export function FinancePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const limit = borrowLimit(s), rate = loanRate(s);
  const m = s.market.phase;
  return (
    <>
      <span className="label">Market</span>
      <div className="stats">
        <span className={m === 'glut' ? 'bad' : m === 'boom' ? 'good' : undefined}>
          {m === 'boom' ? 'AI boom' : m === 'glut' ? 'Glut' : 'Normal'}: prices {Math.round(MARKET_MULT[m] * 100)}%
        </span>
        {s.contract && <span>Contract: 80% at {Math.round(s.contract.mult * 100)}%, {Math.ceil((s.contract.until - s.month) / 12)} yrs, {s.contract.misses}/5 strikes</span>}
      </div>
      <span className="label">Loans{debt(s) > 0 ? `: ${money(debt(s))} owed` : ''}</span>
      {s.loans.length > 0 && (
        <div className="books">
          {s.loans.map(x => (
            <div className="row" key={x.id}>
              <span>{money(x.balance)} at {(x.rate * 100).toFixed(1)}%<small> {money(x.payment)}/mo</small></span>
              <button className="link-btn" disabled={s.cash < x.balance} onClick={() => dispatch({ type: 'payoff', id: x.id })}>Pay off</button>
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        {LOAN_SIZES.map(a => (
          <button key={a} className="chip" disabled={a > limit} onClick={() => dispatch({ type: 'loan', amount: a })}>
            <b>Borrow {money(a)}</b>
            <small>{(rate * 100).toFixed(1)}%, 10 yrs</small>
          </button>
        ))}
      </div>
    </>
  );
}

// rough spots on a little world map, in a 100 x 50 box: North America on the left, Europe on the right
const SPOTS: Record<LocKey, [number, number]> = {
  dalles: [9, 17], phoenix: [14, 29], abilene: [21, 31], newalbany: [30, 21], ashburn: [34, 23],
  reykjavik: [57, 9], dublin: [64, 17], lulea: [80, 8],
};

/** Your sites, and where else you could buy. */
export function MapTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const locs = Object.keys(LOCS) as LocKey[];
  return (
    <>
      <svg className="map" viewBox="0 0 100 44" role="img" aria-label="Map of your sites">
        {/* blocky continents */}
        {/* North America, Iceland, Ireland and Scandinavia, in chunky pixels */}
        <path d="M3 12h4v-4h8v-2h10v4h8v4h4v6h-2v6h-4v4h-6v4h-4v-4h-6v-2h-6v-4h-4v-6h-2z" className="land" />
        <path d="M54 6h7v5h-7z" className="land" />
        <path d="M61 14h3v-2h4v6h-2v2h-5z" className="land" />
        <path d="M74 2h6v-1h8v4h4v8h-4v6h-6v-6h-4v-6h-4z" className="land" />
        {locs.map(k => {
          const [x, y] = SPOTS[k];
          const home = k === s.loc, owned = s.sites.find(z => z.loc === k);
          return (
            <g key={k}>
              {home && s.bill && <circle cx={x} cy={y} r={2 + s.bill.progress / 25} className="heat" />}
              <rect x={x - 1.5} y={y - 1.5} width="3" height="3" className={home ? 'home' : owned ? (owned.copycat ? 'hurt' : 'owned') : 'free'} />
              <text x={x} y={k === 'newalbany' ? y - 3 : y + 5} textAnchor="middle">{LOCS[k].short}</text>
            </g>
          );
        })}
      </svg>
      <div className="ups">
        {locs.filter(k => k !== s.loc).map(k => {
          const owned = s.sites.find(z => z.loc === k);
          const cost = siteCost(s, k);
          return (
            <button key={k} className="up" disabled={!!owned || s.cash < cost} onClick={() => dispatch({ type: 'buySite', loc: k })}>
              <b>{LOCS[k].name}</b>
              <small>{owned ? `${money(siteNet(s, owned))}/mo${owned.copycat ? ', copycat law' : ''}` : `About ${money(siteNet(s, { loc: k, copycat: false }))}/mo`}</small>
              <span>{owned ? 'Yours' : money(cost)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
