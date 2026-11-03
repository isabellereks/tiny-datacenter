'use client';

import type { Action } from '@/lib/game/actions';
import { billEta, billForces, billStageName, borrowLimit, debt, LOAN_SIZES, loanRate } from '@/lib/game/strategy';
import { ECON, MARKET_MULT, money, type GameState, type Ledger } from '@/lib/game/state';
import { Meter, Row, Why } from './Island';

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
const pct1 = (n: number) => `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n) * 100)}%`;

/** The moratorium bill: the clock you race. */
export function BillPanel({ s, l }: { s: GameState; l: Ledger }) {
  const law = s.laws.find(x => x.id === 'moratorium' && x.until > s.month);
  if (law) return <p className="warn">Moratorium: no new halls here for {Math.ceil(law.until - s.month)} mo. Power and cooling upgrades are still allowed.</p>;
  if (!s.bill) return null;
  const f = billForces(s, l);
  const eta = billEta(s, l);
  return (
    <>
      <span className="label">Moratorium bill</span>
      <Meter label={billStageName(s)} value={s.bill.progress} max={100} text={`${Math.round(s.bill.progress)}%`} bad={s.bill.progress >= 40} marks={[40, 80]} />
      {s.hints && <Why label={eta ? `Passes in about ${eta} mo` : 'Stalled'}>
        <div className="books">
          <Row label="Base pressure" value="+0.2" />
          {f.parts.map(p => <Row key={p.label} label={p.label} value={pct(p.value)} neg={p.value > 0} />)}
          <Row label="Per month" value={pct(f.total)} strong neg={f.total > 0} />
        </div>
      </Why>}
    </>
  );
}

/** The economy, the AI market and loans. */
export function FinancePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const limit = borrowLimit(s), rate = loanRate(s);
  const m = s.market.phase, E = ECON[s.econ.phase];
  return (
    <>
      <span className="label">Market</span>
      <div className="books">
        <div className="row"><span>{E.name}</span><b className={s.econ.phase === 'steady' ? undefined : 'neg'}>Costs {pct1(E.cost)}/yr{E.power !== 1 ? `, power ${pct1(E.power - 1)}` : ''}</b></div>
        <div className="row"><span>{m === 'boom' ? 'AI boom' : m === 'glut' ? 'AI crash' : 'AI market'}</span><b className={m === 'glut' ? 'neg' : undefined}>Deals {Math.round(MARKET_MULT[m] * 100)}%</b></div>
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
      <div className="ups">
        {LOAN_SIZES.map(a => (
          <button key={a} className="up" disabled={a > limit} onClick={() => dispatch({ type: 'loan', amount: a })}>
            <b>Borrow {money(a)}</b>
            <span>{(rate * 100).toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </>
  );
}
