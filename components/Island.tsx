'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, FOUNDS, HIRE_FEE, LOCS, MAX_TECHS, OUTLINES, STITCH, TECH_SALARY, TYPES,
  type StitchSize,
} from '@/lib/game/data';
import {
  COMPLAINTS, REPLANT_COST, UPGRADES, foundationUpgradeCost, nextFoundation, score, type Impact,
} from '@/lib/game/events';
import {
  buildCost, dateLabel, floorPrice, isBroken, money, techsOn, utilization, type GameState, type Ledger,
} from '@/lib/game/state';
import { Threads } from './Threads';

export type Tab = 'build' | 'floor' | 'crew' | 'money' | 'town' | 'look';
const TABS: { key: Tab; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'floor', label: 'Floor' },
  { key: 'crew', label: 'Crew' },
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

function Meter({ label, value, max, text, bad }: { label: string; value: number; max: number; text: string; bad?: boolean }) {
  return (
    <div className="imeter">
      <span>{label}</span>
      <div className={`bar${bad ? ' bad' : ''}`}><i style={{ transform: `scaleX(${Math.min(1, value / Math.max(max, 0.001))})` }} /></div>
      <span className="num">{text}</span>
    </div>
  );
}

function Chip({ on, onClick, children, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button className="chip" aria-pressed={!!on} onClick={onClick} disabled={disabled}>{children}</button>;
}

const perMonth = (n: number) => `${n >= 0 ? '+' : ''}${money(n)}/mo`;

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
        <p>{complaint.body}</p>
        <div className="choices">
          {complaint.choices.map((c, k) => (
            <button key={c.label} className={k === 0 ? 'pill white' : 'pill'} disabled={!!c.cost && s.cash < c.cost}
              onClick={() => dispatch({ type: 'resolve', choice: k })}>
              {c.label} <span className="cost">{c.cost ? money(c.cost) : `Trust −${complaint.sting}`}</span>
            </button>
          ))}
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

function Row({ label, value, strong, neg }: { label: string; value: string; strong?: boolean; neg?: boolean }) {
  return (
    <div className={`row${strong ? ' strong' : ''}`}>
      <span>{label}</span>
      <span className={neg ? 'neg' : undefined}>{value}</span>
    </div>
  );
}

function Expanded({ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView }: {
  s: GameState; l: Ledger; imp: Impact; tab: Tab; armed: boolean;
  dispatch: (a: Action) => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void;
}) {
  const n = s.floors.length, max = FOUNDS[s.found].max, cost = buildCost(s);
  const f = s.floors[s.sel];
  const up = nextFoundation(s);
  const upCost = up ? foundationUpgradeCost(s, up) : 0;
  const L = LOCS[s.loc];
  const sc = score(s);
  const books = s.books ?? l;

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
        {tab === 'build' && (
          <>
            <div className="chips">
              {BUILDABLE.map(t => (
                <Chip key={t} on={s.next === t} onClick={() => dispatch({ type: 'next', floor: t })}>
                  <b>{TYPES[t].name}</b><small>{TYPES[t].note}</small><small className="chip-price">{money(floorPrice(s.loc, t, n))}</small>
                </Chip>
              ))}
            </div>
            <Meter label="Power" value={l.hallMW} max={l.powerMW} text={`${l.hallMW.toFixed(1)}/${l.powerMW.toFixed(1)} MW`} bad={l.hallMW > l.powerMW} />
            <Meter label="Cooling" value={l.hallMW} max={l.coolMW} text={`${l.hallMW.toFixed(1)}/${l.coolMW.toFixed(1)} MW`} bad={l.hallMW > l.coolMW} />
            {l.eff < 0.999 && <p className="warn">Need more {l.pe < 1 ? 'power' : 'cooling'}. Halls at {Math.round(l.eff * 100)}%.</p>}
            <Threads label="New floor color" value={s.nextFill} onPick={fill => dispatch({ type: 'nextFill', fill })} />
            {n < max ? (
              <button className="pill white wide" disabled={!!s.build || s.cash < cost} onClick={() => dispatch({ type: 'build' })}>
                {s.build ? 'Building…' : `Build for ${money(cost)}`}
              </button>
            ) : (
              <div className="note">
                <span>Max floors reached.</span>
                {up && (
                  <button className="pill white" disabled={s.cash < upCost || !!s.build} onClick={() => dispatch({ type: 'found', found: up })}>
                    Upgrade foundation for {money(upCost)}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'floor' && f && (
          <>
            <div className="floorhead">
              <b>Floor {s.sel}: {TYPES[f.type].name}</b>
              <span>Tap a floor to switch.</span>
            </div>
            {isBroken(s, s.sel) && (
              <div className="note bad">
                <span>This floor is down.</span>
                <button className="pill white" onClick={() => dispatch({ type: 'repair', floor: s.sel })}>Fix it</button>
              </div>
            )}
            <Threads label="Floor color" value={f.fill} onPick={fill => dispatch({ type: 'fill', fill })} />
            {f.type === 'hall' ? (
              <>
                <div className="crewrow">
                  <div className="dudes">
                    {Array.from({ length: MAX_TECHS }, (_, k) => <i key={k} className={k < techsOn(s, s.sel) ? 'on' : ''} />)}
                    <span>{techsOn(s, s.sel)}/{MAX_TECHS} techs</span>
                  </div>
                  <button className="pill white" disabled={techsOn(s, s.sel) >= MAX_TECHS || !f.done || s.cash < HIRE_FEE} onClick={() => dispatch({ type: 'hire' })}>
                    Hire {money(HIRE_FEE)}
                  </button>
                </div>
                <Meter label="Busy" value={utilization(s, s.sel)} max={1} text={`${Math.round(utilization(s, s.sel) * 100)}%`} />
                <p className="muted">Techs cost {money(TECH_SALARY)}/mo and fix outages.</p>
              </>
            ) : <p className="muted">{TYPES[f.type].note}</p>}
          </>
        )}

        {tab === 'crew' && (
          s.workers.length ? (
            <>
              <ul className="list">
                {[...s.workers].sort((a, b) => b.floor - a.floor).map(w => (
                  <li key={w.id}>
                    <button onClick={() => { dispatch({ type: 'select', floor: w.floor }); onTab('floor'); }}>
                      <i className="dude" /><b>{w.name}</b><span>Floor {w.floor}</span>
                    </button>
                    <button className="let-go" onClick={() => dispatch({ type: 'fire', id: w.id })} aria-label={`Let ${w.name} go`}>Let go</button>
                  </li>
                ))}
              </ul>
              <p className="muted">Payroll: {money(s.workers.length * TECH_SALARY)}/mo</p>
            </>
          ) : <p className="muted">No techs yet. Tap a server hall to hire one.</p>
        )}

        {tab === 'money' && (
          <>
            <span className="label">{s.books ? 'Last month' : 'This month'}</span>
            <div className="books">
              <Row label="Income" value={money(books.revenue)} />
              <Row label="Power" value={money(-books.power)} neg />
              <Row label="Water" value={money(-books.water)} neg />
              <Row label="Staff" value={money(-books.staff)} neg />
              <Row label="Property tax" value={money(-books.propertyTax)} neg />
              <Row label="Profit tax" value={money(-books.incomeTax)} neg />
              <Row label="Profit" value={money(books.net)} strong neg={books.net < 0} />
            </div>
            <div className="facts">
              <span>Power ${L.power}/MWh</span>
              <span>Using {l.itMW.toFixed(1)} MW</span>
              <span>{L.taxNote}</span>
            </div>
            <p className="muted small">Prices are rough real-world estimates.</p>
          </>
        )}

        {tab === 'town' && (
          <>
            <Meter label="Trust" value={s.trust} max={100} text={`${Math.round(s.trust)}/100`} bad={s.trust < 40} />
            <p className="muted">At 0 trust, the town shuts you down and you lose everything.</p>
            <Meter label="Trees" value={imp.cleared} max={imp.trees} text={`${imp.cleared}/${imp.trees} cut`} bad={imp.cleared >= 8} />
            <Meter label="Water" value={imp.waterML} max={8} text={`${imp.waterML.toFixed(1)} ML/mo`} bad={imp.waterML >= 4} />
            <Meter label="CO₂" value={imp.carbonT} max={2000} text={`${Math.round(imp.carbonT).toLocaleString()} t/mo`} bad={imp.carbonT >= 1000} />
            <span className="label">Upgrades</span>
            <div className="ups">
              {UPGRADES.map(u => (
                <button key={u.key} className="up" disabled={s.up[u.key] || s.cash < u.cost} onClick={() => dispatch({ type: 'upgrade', key: u.key })}>
                  <b>{u.name}</b><small>{u.note}</small><span>{s.up[u.key] ? 'Done' : money(u.cost)}</span>
                </button>
              ))}
              <button className="up" disabled={imp.cleared === 0 || s.cash < REPLANT_COST} onClick={() => dispatch({ type: 'replant' })}>
                <b>Plant trees</b><small>Replants 6 trees.</small><span>{money(REPLANT_COST)}</span>
              </button>
            </div>
            <span className="label">Score</span>
            <div className="books">
              <Row label="Profit" value={String(sc.parts.profit)} />
              <Row label="Months" value={String(sc.parts.months)} />
              <Row label="Goals" value={String(sc.parts.goals)} />
              <Row label="Outages fixed" value={String(sc.parts.fixed)} />
              <Row label="Ignored" value={String(sc.parts.ignored)} neg={sc.parts.ignored < 0} />
              <Row label="Total" value={sc.total.toLocaleString()} strong />
            </div>
            <ul className="log">{s.log.slice(0, 4).map((x, k) => <li key={k}>{x}</li>)}</ul>
          </>
        )}

        {tab === 'look' && (
          <>
            <div className="toggles">
              <Chip on={s.inside} onClick={() => dispatch({ type: 'inside', on: !s.inside })}><b>{s.inside ? 'Inside' : 'Outside'}</b></Chip>
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
            <span className="label">Name</span>
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
