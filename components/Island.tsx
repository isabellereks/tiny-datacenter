'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, CUSTS, FOUNDS, LOCS, OUTLINES, STITCH, TYPES,
  type CustKey, type FoundKey, type LocKey, type StitchSize,
} from '@/lib/game/data';
import { COMPLAINTS, nextFoundation, type Impact } from '@/lib/game/events';
import { floorCost, hireCost, money, techsOn, typeNote, type GameState, type Stats } from '@/lib/game/state';
import { Threads } from './Threads';

export type Tab = 'build' | 'floor' | 'crew' | 'impact' | 'site' | 'look';
const TABS: { key: Tab; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'floor', label: 'Floor' },
  { key: 'crew', label: 'Crew' },
  { key: 'impact', label: 'Impact' },
  { key: 'site', label: 'Site' },
  { key: 'look', label: 'Look' },
];
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

function DayRing({ day }: { day: number }) {
  const f = day % 1, r = 7, c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="#FFD66B" strokeWidth="2" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 9 9)" strokeLinecap="round" />
    </svg>
  );
}

function Meter({ label, value, max, text, bad }: { label: string; value: number; max: number; text: string; bad?: boolean }) {
  return (
    <div className="imeter">
      <span>{label}</span>
      <div className={`bar${bad ? ' bad' : ''}`}><i style={{ width: `${Math.min(100, (value / Math.max(max, 0.001)) * 100)}%` }} /></div>
      <span className="num">{text}</span>
    </div>
  );
}

function Chip({ on, onClick, children, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button className="chip" aria-pressed={!!on} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Island({ s, st, imp, open, tab, activity, armed, dispatch, onOpen, onClose, onTab, onResetView }: {
  s: GameState; st: Stats; imp: Impact; open: boolean; tab: Tab; activity: string | null; armed: boolean;
  dispatch: (a: Action) => void; onOpen: () => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void;
}) {
  const complaint = COMPLAINTS.find(c => c.id === s.complaint);
  const mode = complaint ? 'alert' : open ? 'expanded' : activity ? 'activity' : 'compact';
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

  const repBad = s.rep < 50;
  const statusDots = (
    <span className="dots" aria-label={`Power ${st.pe < 1 ? 'short' : 'ok'}, cooling ${st.ce < 1 ? 'short' : 'ok'}, reputation ${Math.round(s.rep)}`}>
      <i className={st.pe < 1 ? 'bad' : 'ok'} title="Power" />
      <i className={st.ce < 1 ? 'bad' : 'ok'} title="Cooling" />
      <i className={repBad ? 'bad' : s.rep < 70 ? 'meh' : 'ok'} title="Reputation" />
    </span>
  );

  let body: ReactNode;
  if (mode === 'compact') {
    body = (
      <button className="compact" onClick={onOpen} aria-label="Open controls">
        <DayRing day={s.day} />
        <span className="day">Day {Math.floor(s.day) + 1}</span>
        <span className="cash">{money(s.cash)}</span>
        <span className="rate">+{money(st.rev)}/s</span>
        {statusDots}
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
        <span className="from">Day {Math.floor(s.day) + 1} · {complaint.from}</span>
        <h2 id="alert-title">{complaint.title(s, imp)}</h2>
        <p>{complaint.body}</p>
        <div className="choices">
          {complaint.choices.map((c, k) => (
            <button key={c.label} className={k === 0 ? 'pill white' : 'pill'} disabled={!!c.cost && s.cash < c.cost}
              onClick={() => dispatch({ type: 'resolve', choice: k })}>
              {c.label}{c.cost ? ` · ${money(c.cost)}` : ''}
            </button>
          ))}
        </div>
      </div>
    );
  } else {
    body = <Expanded {...{ s, st, imp, tab, armed, dispatch, onClose, onTab, onResetView }} />;
  }

  return (
    <div className={`island ${mode}`} style={{ width: size.w, height: size.h }}>
      <div className="island-in" ref={inner} key={mode}>{body}</div>
    </div>
  );
}

function Expanded({ s, st, imp, tab, armed, dispatch, onClose, onTab, onResetView }: {
  s: GameState; st: Stats; imp: Impact; tab: Tab; armed: boolean;
  dispatch: (a: Action) => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void;
}) {
  const n = s.floors.length, max = FOUNDS[s.found].max, cost = floorCost(s), hire = hireCost(s);
  const f = s.floors[s.sel];
  const up = nextFoundation(s);

  return (
    <div className="expanded">
      <div className="ex-head">
        <div>
          <span className="day">Day {Math.floor(s.day) + 1}{s.look.name.trim() ? ` · ${s.look.name.trim()}` : ''}</span>
          <div className="money"><b>{money(s.cash)}</b><span>+{money(st.rev)}/s</span></div>
        </div>
        <button className="close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
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
                  <b>{TYPES[t].short}</b><small>{typeNote(s, t)}</small>
                </Chip>
              ))}
            </div>
            <Threads label="New floor colour" value={s.nextFill} onPick={fill => dispatch({ type: 'nextFill', fill })} />
            {n < max ? (
              <button className="pill white wide" disabled={!!s.build || s.cash < cost} onClick={() => dispatch({ type: 'build' })}>
                {s.build ? 'Stitching…' : `Stitch floor ${n} · ${money(cost)}`}
              </button>
            ) : (
              <div className="note">
                <span>Your {FOUNDS[s.found].name.toLowerCase()} can’t hold more than {max} floors.</span>
                {up && (
                  <button className="pill white" disabled={s.cash < FOUNDS[up].cost} onClick={() => dispatch({ type: 'found', found: up })}>
                    Pour {FOUNDS[up].name.toLowerCase()} · {money(FOUNDS[up].cost)}
                  </button>
                )}
              </div>
            )}
            {st.eff < 0.999 && <p className="warn">Halls are running at {Math.round(st.eff * 100)}%. Build a {st.pe < 1 ? 'power' : 'cooling'} floor.</p>}
          </>
        )}

        {tab === 'floor' && f && (
          <>
            <div className="floorhead">
              <b>Floor {s.sel} · {TYPES[f.type].name}</b>
              <span>Tap a floor on the cloth to switch</span>
            </div>
            <Threads label="Floor colour" value={f.fill} onPick={fill => dispatch({ type: 'fill', fill })} />
            {f.type === 'hall' ? (
              <div className="crewrow">
                <div className="dudes">
                  {Array.from({ length: 3 }, (_, k) => <i key={k} className={k < techsOn(s, s.sel) ? 'on' : ''} />)}
                  <span>{techsOn(s, s.sel)}/3 techs</span>
                </div>
                <button className="pill white" disabled={techsOn(s, s.sel) >= 3 || !f.done || s.cash < hire} onClick={() => dispatch({ type: 'hire' })}>
                  Hire · {money(hire)}
                </button>
              </div>
            ) : <p className="muted">{f.type === 'lobby' ? 'Tours bring in $2/s.' : 'Techs only work the server halls.'}</p>}
          </>
        )}

        {tab === 'crew' && (
          s.workers.length ? (
            <ul className="list">
              {[...s.workers].sort((a, b) => b.floor - a.floor).map(w => (
                <li key={w.id}>
                  <button onClick={() => { dispatch({ type: 'select', floor: w.floor }); onTab('floor'); }}>
                    <i className="dude" /><b>{w.name}</b><span>Floor {w.floor}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No crew yet. Pick a server hall on the Floor tab and hire someone.</p>
        )}

        {tab === 'impact' && (
          <>
            <Meter label="Trees" value={imp.cleared} max={imp.trees} text={`${imp.cleared}/${imp.trees} cut`} bad={imp.cleared >= imp.trees * 0.5} />
            <Meter label="Water" value={imp.water} max={4} text={`${imp.water.toFixed(1)} ML/day`} bad={imp.water >= 1.5} />
            <Meter label="Carbon" value={imp.carbon} max={5} text={`${imp.carbon.toFixed(1)} t/day`} bad={imp.carbon >= 2.5} />
            <Meter label="Goodwill" value={s.rep} max={100} text={`${Math.round(s.rep)}%`} bad={s.rep < 50} />
            <p className="muted">
              Goodwill scales your revenue. {[s.up.soundWalls && 'Sound walls', s.up.closedLoop && 'Closed-loop cooling', s.up.renewables && 'Wind contract'].filter(Boolean).join(', ') || 'No upgrades yet'}.
            </p>
            <ul className="log">{s.log.slice(0, 4).map((l, k) => <li key={k}>{l}</li>)}</ul>
          </>
        )}

        {tab === 'site' && (
          <>
            <span className="label">Location</span>
            <div className="chips">
              {keys<LocKey>(LOCS).map(k => <Chip key={k} on={s.loc === k} onClick={() => dispatch({ type: 'loc', loc: k })}><b>{LOCS[k].short}</b></Chip>)}
            </div>
            <span className="label">Serving</span>
            <div className="chips">
              {keys<CustKey>(CUSTS).map(k => <Chip key={k} on={s.cust === k} onClick={() => dispatch({ type: 'cust', cust: k })}><b>{CUSTS[k].name}</b></Chip>)}
            </div>
            <span className="label">Foundation</span>
            <div className="chips">
              {keys<FoundKey>(FOUNDS).map(k => {
                const F = FOUNDS[k], cur = s.found === k;
                return (
                  <Chip key={k} on={cur} disabled={!cur && (n > F.max || s.cash < F.cost || !!s.build)} onClick={() => dispatch({ type: 'found', found: k })}>
                    <b>{F.name}</b><small>{cur ? 'Poured' : `${F.max} floors · ${F.cost ? money(F.cost) : 'free'}`}</small>
                  </Chip>
                );
              })}
            </div>
          </>
        )}

        {tab === 'look' && (
          <>
            <div className="toggles">
              <Chip on={s.inside} onClick={() => dispatch({ type: 'inside', on: !s.inside })}><b>Inside</b></Chip>
              <Chip on={s.spin} onClick={() => dispatch({ type: 'spin', on: !s.spin })}><b>Spin</b></Chip>
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
            <input className="field" value={s.look.name} maxLength={24} placeholder="Stitched under your datacenter" onChange={e => dispatch({ type: 'name', text: e.target.value })} />
            <button className={`pill wide${armed ? ' danger' : ''}`} onClick={() => dispatch({ type: 'reset' })}>
              {armed ? 'Tap again to unpick everything' : 'Start a new datacenter'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
