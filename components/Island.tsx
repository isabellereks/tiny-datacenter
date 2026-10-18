'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, COMMUNITY_FUND, COOL_MW, CUSTS, FOUNDS, HIRE_FEE, LOCS, MAX_TECHS, OUTLINES, POWER_MW, REPAIR_COST,
  SHAPES, STITCH, SUBSTATION_MW, TECH_SALARY, TYPES,
  type BuildableType, type StitchSize,
} from '@/lib/game/data';
import {
  COMPLAINTS, GIFTS, UPGRADES, choiceCost, foundationUpgradeCost, giftWait, hopedJobs, nextFoundation, score,
  substationCost, townMood, type Impact,
} from '@/lib/game/events';
import {
  GRID_LABEL, buildCost, buildDelta, dateLabel, floorPrice, gridLevel, hallIncome, hireDelta, isBroken, ledger, money,
  techsOn, utilization, type Floor, type GameState, type Ledger,
} from '@/lib/game/state';
import { Threads } from './Threads';

export type Tab = 'build' | 'floor' | 'crew' | 'money' | 'town' | 'look';
const TABS: { key: Tab; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'floor', label: 'Floors' },
  { key: 'crew', label: 'Staff' },
  { key: 'money', label: 'Money' },
  { key: 'town', label: 'Town' },
  { key: 'look', label: 'View' },
];
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

function MonthRing({ month }: { month: number }) {
  const f = month % 1, r = 7, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="#FFD66B" strokeWidth="2" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 9 9)" />
    </svg>
  );
}

const HEART = 'M1 0h2v1h1V0h2v1h1v3H6v1H5v1H2V5H1V4H0V1h1z';
/** Trust as five pixel hearts. */
export function Hearts({ trust }: { trust: number }) {
  const full = trust / 20;
  const id = useId();
  return (
    <span className="hearts" role="img" aria-label={`Trust ${Math.round(trust)} out of 100`}>
      {Array.from({ length: 5 }, (_, k) => {
        const fill = Math.max(0, Math.min(1, full - k));
        return (
          <svg key={k} width="14" height="12" viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden="true">
            <clipPath id={`${id}-${k}`}><rect width={7 * fill} height="6" /></clipPath>
            <path d={HEART} fill="rgba(255,255,255,.2)" />
            {fill > 0 && <path d={HEART} fill="#FF5A6E" clipPath={`url(#${id}-${k})`} />}
          </svg>
        );
      })}
    </span>
  );
}

/** A bar with optional tick marks where something changes, like when people start to complain. */
function Meter({ label, value, max, text, bad, marks = [] }: {
  label: string; value: number; max: number; text: string; bad?: boolean; marks?: number[];
}) {
  return (
    <div className="imeter">
      <span>{label}</span>
      <div className={`bar${bad ? ' bad' : ''}`}>
        <i style={{ transform: `scaleX(${Math.min(1, value / Math.max(max, 0.001))})` }} />
        {marks.map(m => <b key={m} className="mark" style={{ left: `${Math.min(100, (m / max) * 100)}%` }} />)}
      </div>
      <span className="num">{text}</span>
    </div>
  );
}

function Chip({ on, onClick, children, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button className="chip" aria-pressed={!!on} onClick={onClick} disabled={disabled}>{children}</button>;
}

const perMonth = (n: number) => `${n >= 0 ? '+' : ''}${money(n)}/mo`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
function Delta({ n }: { n: number }) {
  return <span className={`delta${n > 500 ? ' pos' : n < -500 ? ' neg' : ''}`}>{Math.abs(n) < 500 ? '$0/mo' : perMonth(n)}</span>;
}

export function Island({ s, l, imp, open, tab, activity, armed, dispatch, onOpen, onClose, onTab, onResetView }: {
  s: GameState; l: Ledger; imp: Impact; open: boolean; tab: Tab; activity: string | null; armed: boolean;
  dispatch: (a: Action) => void; onOpen: () => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void;
}) {
  const complaint = COMPLAINTS.find(c => c.id === s.complaint);
  const over = s.phase === 'over';
  const mode = over ? 'activity' : complaint ? 'alert' : open ? 'expanded' : activity ? 'activity' : 'compact';
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 260, h: 44 });

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // the bar warns about the most urgent problem
  const downAlone = s.broken.some(b => techsOn(s, b.floor) === 0);
  const warn = downAlone ? 'Floor down' : s.debt > 0 ? 'In debt' : l.strain >= 0.85 ? GRID_LABEL[gridLevel(l.strain)] : l.eff < 0.999 ? `Halls at ${Math.round(l.eff * 100)}%` : null;

  let body: ReactNode;
  if (over) {
    body = (
      <div className="compact activity static">
        <span className="pulse bad" aria-hidden="true" />
        <span className="msg">{s.over?.reason === 'town' ? 'The town is tearing it down' : 'Bankrupt'}</span>
      </div>
    );
  } else if (mode === 'compact') {
    body = (
      <button className="compact" onClick={onOpen} aria-label="Open controls">
        <MonthRing month={s.month} />
        <span className="day">{dateLabel(s.month)}</span>
        <span className="cash">{money(s.cash)}</span>
        <span className={l.net >= 0 ? 'rate' : 'rate neg'}>{perMonth(l.net)}</span>
        <Hearts trust={s.trust} />
        {warn && <span className="flag">{warn}</span>}
      </button>
    );
  } else if (mode === 'activity') {
    body = (
      <button className="compact activity" onClick={onOpen}>
        <span className="pulse" aria-hidden="true" />
        <span className="msg">{activity}</span>
      </button>
    );
  } else if (mode === 'alert' && complaint) {
    body = (
      <div className="alert" role="alertdialog" aria-labelledby="alert-title">
        <span className="from">{complaint.from}</span>
        <h2 id="alert-title">{complaint.title(s, imp)}</h2>
        <p>{complaint.body(s)}</p>
        <div className="choices">
          {complaint.choices.map((c, k) => {
            const cost = choiceCost(s, c);
            return (
              <button key={c.label} className={k === 0 ? 'pill white' : 'pill'} disabled={s.cash < cost}
                onClick={() => dispatch({ type: 'resolve', choice: k })}>
                {c.label}
                <span className="cost">{cost ? `${money(cost)}, trust +${c.trust ?? 0}` : `Trust −${complaint.sting}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else {
    body = <Expanded {...{ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView }} />;
  }

  return (
    <div className={`island ${mode}`} style={{ width: size.w, height: size.h }}>
      <div className="island-in" ref={inner} key={mode}>{body}</div>
    </div>
  );
}

function Row({ label, value, strong, neg, sub }: { label: string; value: string; strong?: boolean; neg?: boolean; sub?: string }) {
  return (
    <div className={`row${strong ? ' strong' : ''}`}>
      <span>{label}{sub && <small>{sub}</small>}</span>
      <span className={neg ? 'neg' : undefined}>{value}</span>
    </div>
  );
}

/** What a floor of this type does, in plain numbers for this site. */
function floorEffect(s: GameState, type: Floor['type']) {
  const L = LOCS[s.loc], K = CUSTS[s.cust];
  const cool = COOL_MW * FOUNDS[s.found].cool * SHAPES[s.shape].cool * (1.2 / L.pue);
  switch (type) {
    case 'hall': return `Room for ${K.mw} MW of servers. Needs ${K.mw} MW of power and cooling.`;
    case 'power': return `Gives ${POWER_MW} MW of power.`;
    case 'cool': return `Cools ${cool.toFixed(1)} MW here.`;
    case 'net': return `Halls earn ${Math.round(8 * K.net)}% more.`;
    case 'break': return 'Techs work 10% faster.';
    case 'lobby': return TYPES.lobby.note;
  }
}

function Expanded({ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView }: {
  s: GameState; l: Ledger; imp: Impact; tab: Tab; armed: boolean;
  dispatch: (a: Action) => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void;
}) {
  const sc = score(s);
  return (
    <div className="expanded">
      <div className="ex-head">
        <div>
          <span className="day">{dateLabel(s.month)}{s.look.name.trim() ? `, ${s.look.name.trim()}` : ''}</span>
          <div className="money"><b>{money(s.cash)}</b><span className={l.net >= 0 ? undefined : 'neg'}>{perMonth(l.net)}</span></div>
        </div>
        <div className="ex-side">
          <span className="score">Score {sc.total.toLocaleString()}</span>
          <button className="close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="ex-body" key={tab}>
        {tab === 'build' && <BuildTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'floor' && <FloorTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'crew' && <StaffTab s={s} dispatch={dispatch} onTab={onTab} />}
        {tab === 'money' && <MoneyTab s={s} l={l} />}
        {tab === 'town' && <TownTab s={s} l={l} imp={imp} dispatch={dispatch} />}
        {tab === 'look' && (
          <>
            <div className="seg" role="group" aria-label="Camera">
              <button aria-pressed={!s.inside} onClick={() => dispatch({ type: 'inside', on: false })}>Outside</button>
              <button aria-pressed={s.inside} onClick={() => dispatch({ type: 'inside', on: true })}>Inside</button>
            </div>
            <div className="toggles">
              <Chip on={s.spin} onClick={() => dispatch({ type: 'spin', on: !s.spin })}><b>Rotate</b></Chip>
              <Chip on={s.smoke} onClick={() => dispatch({ type: 'smoke', on: !s.smoke })}><b>Steam</b></Chip>
              <Chip onClick={onResetView}><b>Reset view</b></Chip>
            </div>
            <span className="label">Stitch size</span>
            <div className="chips">
              {keys<StitchSize>(STITCH).map(k => <Chip key={k} on={s.look.stitch === k} onClick={() => dispatch({ type: 'stitch', size: k })}><b>{STITCH[k].label}</b></Chip>)}
            </div>
            <span className="label">Outline thread</span>
            <Threads label="Outline thread" cloth={false} colors={OUTLINES} value={s.look.outline} onPick={hex => dispatch({ type: 'outline', hex })} />
            <span className="label">Datacenter name</span>
            <input className="field" value={s.look.name} maxLength={24} placeholder="Name" onChange={e => dispatch({ type: 'name', text: e.target.value })} />
            <button className={`pill wide${armed ? ' danger' : ''}`} onClick={() => dispatch({ type: 'reset' })}>
              {armed ? 'Tap again to confirm' : 'Start over'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SupplyMeters({ l }: { l: Ledger }) {
  return (
    <>
      <Meter label="Power" value={l.hallMW} max={l.powerMW} text={`${l.hallMW.toFixed(1)} of ${l.powerMW.toFixed(1)} MW`} bad={l.hallMW > l.powerMW} />
      <Meter label="Cooling" value={l.hallMW} max={l.coolMW} text={`${l.hallMW.toFixed(1)} of ${l.coolMW.toFixed(1)} MW`} bad={l.hallMW > l.coolMW} />
      <Meter label="Grid" value={l.gridMW} max={l.gridCap} text={`${l.gridMW.toFixed(1)} of ${l.gridCap} MW`} bad={l.strain >= 0.85} marks={[l.gridCap * 0.6, l.gridCap * 0.85]} />
    </>
  );
}

function BuildTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const n = s.floors.length, max = FOUNDS[s.found].max, cost = buildCost(s);
  const up = nextFoundation(s);
  const upCost = up ? foundationUpgradeCost(s, up) : 0;
  const deltas = Object.fromEntries(BUILDABLE.map(t => [t, buildDelta(s, t)])) as Record<BuildableType, number>;
  const after = ledger({ ...s, floors: [...s.floors, { type: s.next, fill: s.nextFill, done: true, cost }] });
  const short = cost - s.cash;

  return (
    <>
      <SupplyMeters l={l} />
      <div className="chips">
        {BUILDABLE.map(t => (
          <Chip key={t} on={s.next === t} onClick={() => dispatch({ type: 'next', floor: t })}>
            <b>{TYPES[t].name}</b>
            <small className="chip-price">{money(floorPrice(s.loc, t, n))}</small>
            <Delta n={deltas[t]} />
          </Chip>
        ))}
      </div>
      <p className="muted">
        {floorEffect(s, s.next)}{' '}
        {after.eff < l.eff - 0.001 && `Halls drop to ${Math.round(after.eff * 100)}%. `}
        {after.eff > l.eff + 0.001 && `Halls go up to ${Math.round(after.eff * 100)}%. `}
        {gridLevel(after.strain) > gridLevel(l.strain) && `The town grid goes to ${GRID_LABEL[gridLevel(after.strain)].toLowerCase()}.`}
      </p>
      {n < max ? (
        <button className="pill white wide" disabled={!!s.build || short > 0} onClick={() => dispatch({ type: 'build' })}>
          {s.build ? 'Building…' : short > 0 ? `Need ${money(short)} more` : `Build ${TYPES[s.next].name.toLowerCase()} for ${money(cost)}`}
        </button>
      ) : (
        <div className="note">
          <span>All {max} floors are used.</span>
          {up && (
            <button className="pill white" disabled={s.cash < upCost || !!s.build} onClick={() => dispatch({ type: 'found', found: up })}>
              {FOUNDS[up].name}, up to {FOUNDS[up].max} floors, {money(upCost)}
            </button>
          )}
        </div>
      )}
      <p className="muted small">Floor {n + 1} of {max}. Prices go up 5% per floor.</p>
    </>
  );
}

function FloorTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const i = Math.min(s.sel, s.floors.length - 1);
  const f = s.floors[i];
  const status = (k: number, x: Floor) =>
    !x.done ? 'Building' : isBroken(s, k) ? 'Down' : x.type === 'hall' ? `${Math.round(utilization(s, k) * 100)}%` : '';
  return (
    <div className="fgrid">
      <ol className="flist" aria-label="Floors">
        {s.floors.map((x, k) => ({ x, k })).reverse().map(({ x, k }) => (
          <li key={k}>
            <button aria-pressed={k === i} onClick={() => dispatch({ type: 'select', floor: k })} className={isBroken(s, k) ? 'down' : undefined}>
              <span className="fno">{k + 1}</span>
              <span className="fname">{TYPES[x.type].name}</span>
              {x.type === 'hall' && <span className="ftechs">{'●'.repeat(techsOn(s, k))}{'○'.repeat(MAX_TECHS - techsOn(s, k))}</span>}
              <span className="fstat">{status(k, x)}</span>
            </button>
          </li>
        ))}
      </ol>
      {f && <FloorDetail s={s} l={l} i={i} f={f} dispatch={dispatch} />}
    </div>
  );
}

function FloorDetail({ s, l, i, f, dispatch }: { s: GameState; l: Ledger; i: number; f: Floor; dispatch: (a: Action) => void }) {
  const broken = isBroken(s, i);
  const techs = techsOn(s, i);
  const fixing = s.broken.find(b => b.floor === i);
  return (
    <div className="fdetail">
      <div className="floorhead">
        <b>Floor {i + 1}: {TYPES[f.type].name}</b>
        <span>{floorEffect(s, f.type)}</span>
      </div>
      {broken && (
        <div className="note bad">
          <span>{techs ? `Down. Your techs are fixing it (${Math.round(((fixing?.t ?? 0) / 4) * 100)}%).` : 'Down. It earns nothing until fixed.'}</span>
          {!techs && (
            <button className="pill white" disabled={s.cash < REPAIR_COST} onClick={() => dispatch({ type: 'repair', floor: i })}>
              Call a repair crew, {money(REPAIR_COST)}
            </button>
          )}
        </div>
      )}
      {f.type === 'hall' && f.done && (
        <>
          <div className="books">
            <Row label="Income" value={`${money(hallIncome(s, l, i))}/mo`} />
            <Row label="In use" value={`${Math.round(utilization(s, i) * 100)}%`} />
          </div>
          <div className="crewrow">
            <div className="dudes">
              {Array.from({ length: MAX_TECHS }, (_, k) => <i key={k} className={k < techs ? 'on' : ''} />)}
              <span>{techs} of {MAX_TECHS} techs</span>
            </div>
            {techs < MAX_TECHS ? (
              <button className="pill white" disabled={s.cash < HIRE_FEE} onClick={() => dispatch({ type: 'hire' })}>
                Hire {money(HIRE_FEE)} <span className="cost">{perMonth(hireDelta(s, i))}</span>
              </button>
            ) : <span className="muted">Full crew</span>}
          </div>
          <p className="muted small">Each tech costs {money(TECH_SALARY)}/mo and fixes this floor for free when it goes down.</p>
        </>
      )}
      <Threads label="Floor color" value={f.fill} onPick={fill => dispatch({ type: 'fill', fill })} />
      <p className="muted small">Built for {money(f.cost)}.</p>
    </div>
  );
}

function StaffTab({ s, dispatch, onTab }: { s: GameState; dispatch: (a: Action) => void; onTab: (t: Tab) => void }) {
  const hoped = hopedJobs(s);
  return (
    <>
      <Meter label="Jobs" value={s.workers.length} max={Math.max(hoped, s.workers.length, 1)} text={`${s.workers.length} of ${hoped} hoped`} bad={s.workers.length < hoped * 0.5} />
      <p className="muted">The town expects about 2 jobs per server hall.</p>
      {s.workers.length ? (
        <ul className="list">
          {[...s.workers].sort((a, b) => b.floor - a.floor).map(w => (
            <li key={w.id}>
              <button onClick={() => { dispatch({ type: 'select', floor: w.floor }); onTab('floor'); }}>
                <i className="dude" /><b>{w.name}</b><span>Floor {w.floor + 1}, {Math.round(utilization(s, w.floor) * 100)}% in use</span>
              </button>
              <button className="let-go" onClick={() => dispatch({ type: 'fire', id: w.id })} aria-label={`Let ${w.name} go`}>Let go</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted">No techs yet. Open Floors, pick a server hall and tap Hire.</p>}
      <p className="muted small">Payroll {money(s.workers.length * TECH_SALARY)}/mo. Hiring costs {money(HIRE_FEE)}.</p>
    </>
  );
}

function MoneyTab({ s, l }: { s: GameState; l: Ledger }) {
  const L = LOCS[s.loc];
  const books = s.books ?? l;
  const sc = score(s);
  return (
    <>
      {s.debt > 0 && <p className="warn">In debt for {s.debt} {s.debt === 1 ? 'month' : 'months'}. At 3 you go bankrupt.</p>}
      <span className="label">{s.books ? 'Last month' : 'Each month'}</span>
      <div className="books">
        <Row label="Income" value={money(books.revenue)} />
        <Row label="Power" value={money(-books.power)} neg sub={` $${L.power}/MWh${l.strain > 0.6 ? ', grid surcharge' : ''}`} />
        <Row label="Water" value={money(-books.water)} neg />
        <Row label="Staff" value={money(-books.staff)} neg />
        {books.fund > 0 && <Row label="Community fund" value={money(-books.fund)} neg />}
        <Row label="Property tax" value={money(-books.propertyTax)} neg />
        <Row label="Profit tax" value={money(-books.incomeTax)} neg sub={` ${Math.round(L.incomeTax * 100)}%`} />
        <Row label="Profit" value={money(books.net)} strong neg={books.net < 0} />
      </div>
      <div className="facts">
        <span>Servers use {l.itMW.toFixed(1)} MW</span>
        <span>PUE {l.pue.toFixed(2)}</span>
        <span>{L.taxNote}</span>
      </div>
      <span className="label">Score</span>
      <div className="books">
        <Row label="Profit" value={String(sc.parts.profit)} sub=" 1 per $100k" />
        <Row label="Months open" value={String(sc.parts.months)} />
        <Row label="Goals" value={String(sc.parts.goals)} />
        <Row label="Outages fixed" value={String(sc.parts.fixed)} />
        <Row label="Complaints ignored" value={String(sc.parts.ignored)} neg={sc.parts.ignored < 0} />
        <Row label="Total" value={sc.total.toLocaleString()} strong />
      </div>
      <p className="muted small">Prices are rough real-world estimates.</p>
    </>
  );
}

function TownTab({ s, l, imp, dispatch }: { s: GameState; l: Ledger; imp: Impact; dispatch: (a: Action) => void }) {
  const mood = townMood(s, l, imp);
  const dir = mood.target > s.trust + 1 ? 'rising' : mood.target < s.trust - 1 ? 'falling' : 'steady';
  const sub = substationCost(s);
  const lvl = gridLevel(l.strain);
  return (
    <>
      <Meter label="Trust" value={s.trust} max={100} text={`${Math.round(s.trust)}, ${dir}`} bad={s.trust < 40} marks={[mood.target]} />
      <p className="muted">Trust moves toward {Math.round(mood.target)}. Protests start under 40. At 0 the town shuts you down.</p>
      <span className="label">What the town thinks</span>
      <div className="books">
        <Row label="Starting point" value={String(mood.base)} />
        {[...mood.parts].sort((a, b) => a.value - b.value).map(p => (
          <Row key={p.label} label={p.label} sub={` ${p.note}`} value={signed(p.value)} neg={p.value < 0} />
        ))}
      </div>

      <span className="label">Town grid: {GRID_LABEL[lvl]}</span>
      <Meter label="Grid" value={l.gridMW} max={l.gridCap} text={`${Math.round(l.strain * 100)}%`} bad={lvl >= 2} marks={[l.gridCap * 0.6, l.gridCap * 0.85]} />
      <p className="muted small">Over 60% power costs more. Over 85% the town gets brownouts. Over 100% you get cut back.</p>

      <span className="label">Help the town</span>
      <div className="ups">
        {GIFTS.map(g => {
          const wait = giftWait(s, g.key);
          const none = g.key === 'trees' && imp.cleared === 0;
          return (
            <button key={g.key} className="up" disabled={wait > 0 || none || s.cash < g.cost} onClick={() => dispatch({ type: 'gift', key: g.key })}>
              <b>{g.name}</b><small>{g.note}</small>
              <span>{wait ? `Again in ${wait} mo` : none ? 'No trees to replant' : `${money(g.cost)}, trust +${g.trust}`}</span>
            </button>
          );
        })}
        <button className="up" disabled={s.cash < sub} onClick={() => dispatch({ type: 'substation' })}>
          <b>Pay for a substation</b><small>Grid +{SUBSTATION_MW} MW. You have {s.substations}.</small><span>{money(sub)}</span>
        </button>
        <button className="up" aria-pressed={s.up.fund} onClick={() => dispatch({ type: 'fund', on: !s.up.fund })}>
          <b>Community fund</b><small>Pay the town {money(COMMUNITY_FUND)} a month.</small>
          <span>{s.up.fund ? 'On. Tap to stop.' : 'Off. Tap to start.'}</span>
        </button>
      </div>

      <span className="label">Projects</span>
      <div className="ups">
        {UPGRADES.map(u => (
          <button key={u.key} className="up" disabled={s.up[u.key] || s.cash < u.cost} onClick={() => dispatch({ type: 'upgrade', key: u.key })}>
            <b>{u.name}</b><small>{u.note}</small><span>{s.up[u.key] ? 'Done' : money(u.cost)}</span>
          </button>
        ))}
      </div>
      <span className="label">Recent</span>
      <ul className="log">{s.log.slice(0, 5).map((x, k) => <li key={k}>{x}</li>)}</ul>
    </>
  );
}
