'use client';

import type { Action } from '@/lib/game/actions';
import { MAX_TECHS } from '@/lib/game/data';
import { money, techsOn, today, type GameState } from '@/lib/game/state';
import { GENS, SEGS, baselineRevenue, dateOf, histGen, histTeams, mixAt, realMarketCap, teamCost, type Seg } from '@/lib/nv/history';
import { breaksOf, teamsOf } from '@/lib/nv/month';
import { PRICES, SUPPLY, chipFactor, designNeed, marketCap, raiseCut, raiseSize, tapeoutOdds } from '@/lib/nv/sim';
import { hireCostNv, labCostNv, breakCostNv } from '@/lib/nv/costs';

/*
 * The chip company's panel. Every tab is numbers and one-line rows, like the rest of the game.
 */

export type NvTab = 'chips' | 'supply' | 'markets' | 'team' | 'hq' | 'stock' | 'ceo';
export const NV_TABS: { key: NvTab; label: string }[] = [
  { key: 'chips', label: 'Chips' },
  { key: 'supply', label: 'Supply' },
  { key: 'markets', label: 'Markets' },
  { key: 'team', label: 'Team' },
  { key: 'hq', label: 'HQ' },
  { key: 'stock', label: 'Stock' },
  { key: 'ceo', label: 'CEO' },
];

function Row({ label, sub, value, neg, pos }: { label: string; sub?: string; value: string; neg?: boolean; pos?: boolean }) {
  return <div className="row"><span>{label}{sub && <small> {sub}</small>}</span><b className={neg ? 'neg' : pos ? 'pos' : undefined}>{value}</b></div>;
}

/** The most urgent thing, for the top bar. */
export function nvWarn(s: GameState): string | null {
  const n = s.nv!, m = Math.floor(s.month);
  if (s.debt > 0) return 'In debt';
  const gap = histGen(m) - n.gen;
  if (n.gen >= 0 && gap > 0) return `${gap} gen behind`;
  if (n.mode === 'choices' && !n.project && n.gen < GENS.length - 1) return 'No chip in design';
  if (n.project?.respins) return 'Respin';
  return null;
}

export function NvBody({ s, tab, dispatch }: { s: GameState; tab: NvTab; dispatch: (a: Action) => void }) {
  if (tab === 'chips') return <ChipsTab s={s} dispatch={dispatch} />;
  if (tab === 'supply') return <SupplyTab s={s} dispatch={dispatch} />;
  if (tab === 'markets') return <MarketsTab s={s} />;
  if (tab === 'team') return <TeamTab s={s} dispatch={dispatch} />;
  if (tab === 'hq') return <HqTab s={s} dispatch={dispatch} />;
  if (tab === 'stock') return <StockTab s={s} dispatch={dispatch} />;
  return null;
}

function ChipsTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const n = s.nv!, m = Math.floor(s.month), story = n.mode === 'story';
  const cur = n.gen >= 0 ? GENS[n.gen] : null, next = GENS[n.gen + 1];
  const p = n.project, teams = teamsOf(s);
  const rate = teams * (1 + 0.08 * breaksOf(s));
  const eta = p && rate > 0 ? Math.ceil((p.need - p.progress) / rate) : null;
  return (
    <>
      <span className="label">Selling</span>
      <div className="books">
        <Row label={cur ? cur.name : 'Nothing yet'} sub={cur ? `since ${dateOf(n.launched)}` : undefined} value={cur ? `${Math.round(chipFactor(n, m) * 100)}%` : '–'} neg={!!cur && chipFactor(n, m) < 0.8} />
        <Row label="Rivals' best" sub="the real schedule" value={GENS[histGen(m)].name} />
      </div>
      {next && (
        <>
          <span className="label">Next: {next.name}</span>
          {p ? (
            <div className="deal tight">
              <div className="deal-row static"><b>{GENS[p.gen].name}</b><span>{Math.round((p.progress / p.need) * 100)}%</span><span className="num">{eta === null ? 'No teams' : `${eta} mo left`}</span></div>
              <div className="deal-sub">
                <span>{p.bet === 'bold' ? 'Bold design' : 'Safe design'}</span>
                <span>Real launch {dateOf(next.at)}</span>
                {p.respins > 0 && <span className="bad">Respin {p.respins}</span>}
                {s.hints && <span>Tape-out {Math.round(tapeoutOdds(n, p.bet) * 100)}%</span>}
              </div>
            </div>
          ) : story ? <p className="muted small">Ships {dateOf(next.at)}</p> : (
            <div className="ups">
              <button className="up" onClick={() => dispatch({ type: 'nvProject', bet: 'safe' })}>
                <b>Safe design</b><small>{designNeed(n.gen + 1, 'safe')} team-months, tape-out {Math.round(tapeoutOdds(n, 'safe') * 100)}%</small><span>Start</span>
              </button>
              <button className="up" onClick={() => dispatch({ type: 'nvProject', bet: 'bold' })}>
                <b>Bold design</b><small>{designNeed(n.gen + 1, 'bold')} team-months, tape-out {Math.round(tapeoutOdds(n, 'bold') * 100)}%, chip +15%</small><span>Start</span>
              </button>
            </div>
          )}
        </>
      )}
      {!story && (
        <>
          <span className="label">Price</span>
          <div className="seg three" role="group" aria-label="Price">
            {PRICES.map((x, k) => <button key={x.label} aria-pressed={n.price === k} onClick={() => dispatch({ type: 'nvPrice', level: k })}>{x.label}</button>)}
          </div>
        </>
      )}
    </>
  );
}

function SupplyTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const n = s.nv!, b = n.books, story = n.mode === 'story';
  return (
    <>
      <div className="mw3">
        <div><span>Demand</span><b>{money(b.demand)}</b></div>
        <div><span>Sold</span><b>{money(b.revenue)}</b></div>
        <div className={n.inventory > b.revenue ? 'bad' : undefined}><span>Unsold</span><b>{money(n.inventory)}</b></div>
      </div>
      {!story && (
        <>
          <span className="label">Wafers from TSMC</span>
          <div className="seg three" role="group" aria-label="Wafers">
            {SUPPLY.map((x, k) => <button key={x.label} aria-pressed={n.supply === k} onClick={() => dispatch({ type: 'nvSupply', level: k })}>{x.label} {Math.round(x.k * 100)}%</button>)}
          </div>
        </>
      )}
      <div className="books">
        <Row label="Chips made" sub="at cost" value={`${money(b.cogs)}/mo`} />
        <Row label="Gross margin" value={`${Math.round(b.margin * 100)}%`} />
        {!!n.prepaid && <Row label="Prepaid wafers" value={money(n.prepaid)} />}
      </div>
    </>
  );
}

function MarketsTab({ s }: { s: GameState }) {
  const n = s.nv!, m = Math.floor(s.month), mix = mixAt(m), base = baselineRevenue(m);
  return (
    <>
      <span className="label">Sales by market, per month</span>
      <div className="books">
        {(Object.keys(SEGS) as Seg[]).filter(k => mix[k] > 0.005 || n.books.bySeg[k] > 0).map(k => {
          const real = base * mix[k], mine = n.books.bySeg[k];
          return <Row key={k} label={SEGS[k].name} sub={`real ${money(real)}`} value={money(mine)} neg={mine < real * 0.8} pos={mine > real * 1.1} />;
        })}
        <Row label="Total" sub={`real ${money(base)}`} value={money(n.books.revenue)} />
      </div>
      <span className="label">Brand</span>
      <div className="books"><Row label="Gamers and press" value={`${Math.round(s.trust)}`} neg={s.trust < 50} /></div>
    </>
  );
}

function TeamTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const m = Math.floor(s.month), teams = teamsOf(s);
  const room = s.floors.some((f, i) => f.done && f.type === 'hall' && techsOn(s, i) < MAX_TECHS);
  return (
    <>
      <div className="mw3">
        <div><span>Teams</span><b>{teams}</b></div>
        <div><span>Real company</span><b>{histTeams(m)}</b></div>
        <div><span>Each</span><b>{money(teamCost(m))}</b></div>
      </div>
      {room ? (
        <div className="ups">
          <button className="up" disabled={s.cash < hireCostNv(s)} onClick={() => dispatch({ type: 'hire' })}>
            <b>Hire a team</b><small>{money(teamCost(m))}/mo</small><span>{money(hireCostNv(s))}</span>
          </button>
        </div>
      ) : <p className="muted small">Labs full</p>}
      {s.workers.length > 0 && (
        <div className="books">
          {s.workers.map(w => (
            <div className="row" key={w.id}><span>{w.name}</span><button className="link-btn" onClick={() => dispatch({ type: 'fire', id: w.id })}>Let go</button></div>
          ))}
        </div>
      )}
    </>
  );
}

function HqTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const labs = s.floors.filter(f => f.type === 'hall').length, breaks = breaksOf(s);
  return (
    <>
      <div className="mw3">
        <div><span>Labs</span><b>{labs}</b></div>
        <div><span>Seats</span><b>{labs * MAX_TECHS}</b></div>
        <div><span>Break rooms</span><b>{breaks}</b></div>
      </div>
      <div className="ups">
        <button className="up" disabled={s.cash < labCostNv(s)} onClick={() => { dispatch({ type: 'next', floor: 'hall' }); dispatch({ type: 'build' }); }}>
          <b>Lab floor</b><small>+{MAX_TECHS} teams</small><span>{money(labCostNv(s))}</span>
        </button>
        <button className="up" disabled={s.cash < breakCostNv(s)} onClick={() => { dispatch({ type: 'next', floor: 'break' }); dispatch({ type: 'build' }); }}>
          <b>Break room</b><small>Design +8%</small><span>{money(breakCostNv(s))}</span>
        </button>
      </div>
    </>
  );
}

function StockTab({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const n = s.nv!, m = Math.floor(s.month), b = n.books;
  const cap = marketCap(n, m, s.cash), real = realMarketCap(m);
  const raise = raiseSize(n, m, s.cash), wait = Math.max(0, Math.ceil((s.cooldown['nv-raise'] ?? 0) - s.month));
  return (
    <>
      <div className="mw3">
        <div><span>Your value</span><b>{n.ipo ? money(cap) : 'Private'}</b></div>
        <div><span>Real NVIDIA</span><b>{real ? money(real) : 'Private'}</b></div>
        <div><span>Your stake</span><b>{Math.round((n.stake ?? 0.6) * 100)}%</b></div>
      </div>
      <span className="label">Each month</span>
      <div className="books">
        <Row label="Sales" value={money(b.revenue)} />
        <Row label="Chips made" value={`−${money(b.cogs)}`} neg />
        <Row label="Teams and offices" value={`−${money(b.opex)}`} neg />
        <Row label="Tax" value={`−${money(b.tax)}`} neg={b.tax > 0} />
        <Row label="Profit" value={money(b.net)} neg={b.net < 0} />
      </div>
      <span className="label">Raise money</span>
      <div className="ups">
        <button className="up" disabled={wait > 0} onClick={() => dispatch({ type: 'nvRaise' })}>
          <b>{n.ipo ? 'Sell new shares' : 'Venture round'}</b><small>Stake −{Math.round((1 - raiseCut(n)) * 100)}% of yours</small><span>{wait ? `${wait} mo` : `+${money(raise)}`}</span>
        </button>
      </div>
      {n.peakCap > 0 && <div className="books"><Row label="Peak value" value={money(n.peakCap)} /></div>}
    </>
  );
}

/** The CEO line in the top bar: value once public. */
export function nvValue(s: GameState) {
  const n = s.nv!;
  return n.ipo ? money(marketCap(n, Math.floor(s.month), s.cash)) : 'Private';
}
export { today };
