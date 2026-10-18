'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, COMMUNITY_FUND, COOL_MW, CUSTS, FOUND_ORDER, FOUNDS, LOCS, MAX_TECHS, OUTLINES, POWER_MW, REPAIR_COST,
  SHAPES, STITCH, SUBSTATION_MW, TYPES,
  type BuildableType, type StitchSize,
} from '@/lib/game/data';
import {
  COMPLAINTS, GIFTS, UPGRADES, choiceCost, foundationUpgradeCost, giftWait, hopedJobs, nextFoundation, rating,
  substationCost, townMood, type Impact,
} from '@/lib/game/events';
import {
  GRID_LABEL, bOf, hasLaw, buildCost, buildDelta, buildingCost, floorLabel, heightOf, level, MAX_BUILDINGS, dateLabel, floorPrice, gridLevel, hallCount, hallIncome, hireDelta, hireFee, inflation, isBoosted, isBroken, locals, overseas, overseasWage, VISA_FEE, wageFor, ledger, money, today,
  techsOn, utilization, type Floor, type GameState, type Ledger,
} from '@/lib/game/state';
import {
  DECISIONS, LAWS, PERMITS, activeLaws, buildBlock, checklist, decisionCost, hearingBar, heightLimit, hallLimit,
  inspectionTitle, permitBlock, permitFee, permitWait, pollPro, powerLimit, zoningAllows,
} from '@/lib/game/gov';
import { breakRooms, breaksNeeded, boostCost, BOOST_MONTHS, moraleMood, teamEventCost } from '@/lib/game/staff';
import { Threads } from './Threads';

export type Tab = 'build' | 'floor' | 'crew' | 'money' | 'town' | 'gov' | 'look';
const TABS: { key: Tab; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'floor', label: 'Floors' },
  { key: 'crew', label: 'Staff' },
  { key: 'money', label: 'Money' },
  { key: 'town', label: 'Town' },
  { key: 'gov', label: 'Gov' },
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

/** Pause bars, or one to three play triangles, drawn in pixels since the font has no such glyphs. */
function SpeedIcon({ speed }: { speed: number }) {
  if (speed === 0) return <svg width="10" height="10" viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden="true"><path d="M0 0h2v5H0zM3 0h2v5H3z" fill="currentColor" /></svg>;
  return (
    <svg width={8 * speed + 2} height="10" viewBox={`0 0 ${4 * speed + 1} 5`} shapeRendering="crispEdges" aria-hidden="true">
      {Array.from({ length: speed }, (_, k) => <path key={k} d={`M${k * 4} 0h1v1h1v1h1v1h-1v1h-1v1h-1z`} fill="currentColor" />)}
    </svg>
  );
}
const SPEED_NAME = ['Paused', 'Normal speed', 'Fast', 'Fastest'];
/** Pause and fast-forward. Tapping cycles through the speeds. */
function SpeedButton({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  return (
    <button className={`speed${s.speed === 0 ? ' paused' : ''}`} onClick={() => dispatch({ type: 'speed', speed: (s.speed + 1) % 4 })}
      aria-label={`${SPEED_NAME[s.speed]}. Tap to change speed`} title={SPEED_NAME[s.speed]}>
      <SpeedIcon speed={[0, 1, 2, 3][s.speed]} />
    </button>
  );
}

const perMonth = (n: number) => `${n >= 0 ? '+' : ''}${money(n)}/mo`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
function Delta({ n }: { n: number }) {
  return <span className={`delta${n > 500 ? ' pos' : n < -500 ? ' neg' : ''}`}>{Math.abs(n) < 500 ? '$0/mo' : perMonth(n)}</span>;
}

export function Island({ s, l, imp, open, tab, activity, armed, dispatch, onOpen, onClose, onTab, onResetView, onShare }: {
  s: GameState; l: Ledger; imp: Impact; open: boolean; tab: Tab; activity: string | null; armed: boolean;
  dispatch: (a: Action) => void; onOpen: () => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void; onShare: () => void;
}) {
  const complaint = COMPLAINTS.find(c => c.id === s.complaint);
  const decision = DECISIONS.find(d => d.id === s.complaint);
  const over = s.phase === 'over';
  const mode = over ? 'activity' : complaint || decision ? 'alert' : open ? 'expanded' : activity ? 'activity' : 'compact';
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
  const idle = s.floors.some((f, k) => f.done && f.type === 'hall' && !techsOn(s, k));
  const warn = hasLaw(s, 'stopWork') ? 'Stop-work order' : s.staff.strike ? 'On strike' : downAlone ? 'Floor down' : idle ? 'Hall needs techs' : s.debt > 0 ? 'In debt' : l.strain >= 0.85 ? GRID_LABEL[gridLevel(l.strain)] : l.eff < 0.999 ? `Halls at ${Math.round(l.eff * 100)}%` : null;

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
      <div className="compact-row">
      <button className="compact" onClick={onOpen} aria-label="Open controls">
        <MonthRing month={s.month} />
        <span className="day">{dateLabel(s.month)}</span>
        <span className="cash">{money(s.cash)}</span>
        <span className={l.net >= 0 ? 'rate' : 'rate neg'}>{perMonth(l.net)}</span>
        <Hearts trust={s.trust} />
        {warn && <span className="flag">{warn}</span>}
      </button>
      <SpeedButton s={s} dispatch={dispatch} />
      </div>
    );
  } else if (mode === 'activity') {
    body = (
      <button className="compact activity" onClick={onOpen}>
        <span className="pulse" aria-hidden="true" />
        <span className="msg">{activity}</span>
      </button>
    );
  } else if (mode === 'alert' && decision) {
    body = (
      <div className="alert" role="alertdialog" aria-labelledby="alert-title">
        <span className="from">{decision.from(s)}</span>
        <h2 id="alert-title">{decision.title(s)}</h2>
        <p>{decision.body(s)}</p>
        <div className="choices">
          {decision.choices.map((c, k) => {
            const cost = decisionCost(s, c);
            return (
              <button key={c.label} className={k === 0 ? 'pill white' : 'pill'} disabled={cost > 0 && s.cash < cost}
                onClick={() => dispatch({ type: 'resolve', choice: k })}>
                {c.label}
                <span className="cost">{cost > 0 ? `${money(cost)}  ` : cost < 0 ? `+${money(-cost)}  ` : ''}{c.note}</span>
              </button>
            );
          })}
        </div>
      </div>
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
                <span className="cost">{cost ? `${money(cost)}  Trust +${c.trust ?? 0}` : `Trust −${complaint.sting}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else {
    body = <Expanded {...{ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView, onShare }} />;
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
    case 'hall': return `Uses ${K.mw} MW`;
    case 'power': return `+${POWER_MW} MW power`;
    case 'cool': return `+${cool.toFixed(1)} MW cooling`;
    case 'net': return `Halls +${Math.round(8 * K.net)}% income`;
    case 'break': return 'Techs +10% speed';
    case 'lobby': return 'Entrance';
  }
}

function Expanded({ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView, onShare }: {
  s: GameState; l: Ledger; imp: Impact; tab: Tab; armed: boolean;
  dispatch: (a: Action) => void; onClose: () => void; onTab: (t: Tab) => void; onResetView: () => void; onShare: () => void;
}) {
  const r = rating(s, l);
  return (
    <div className="expanded">
      <div className="ex-head">
        <div>
          <span className="day">{dateLabel(s.month)}{s.look.name.trim() ? `, ${s.look.name.trim()}` : ''}</span>
          <div className="money"><b>{money(s.cash)}</b><span className={l.net >= 0 ? undefined : 'neg'}>{perMonth(l.net)}</span></div>
        </div>
        <div className="ex-side">
          <SpeedButton s={s} dispatch={dispatch} />
          <span className="score">Rating {r.total}</span>
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
        {tab === 'crew' && <StaffTab s={s} l={l} dispatch={dispatch} onTab={onTab} />}
        {tab === 'money' && <MoneyTab s={s} l={l} />}
        {tab === 'town' && <TownTab s={s} l={l} imp={imp} dispatch={dispatch} />}
        {tab === 'gov' && <GovTab s={s} l={l} dispatch={dispatch} />}
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
            <button className="pill white wide" onClick={onShare}>Share on X</button>
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
  const n = heightOf(s, s.bld), max = FOUNDS[s.found].max, cost = buildCost(s);
  const up = nextFoundation(s);
  const upCost = up ? foundationUpgradeCost(s, up) : 0;
  const deltas = Object.fromEntries(BUILDABLE.map(t => [t, buildDelta(s, t)])) as Record<BuildableType, number>;
  const after = ledger({ ...s, floors: [...s.floors, { type: s.next, fill: s.nextFill, done: true, cost }] });
  const short = cost - s.cash;
  const block = buildBlock(s);

  return (
    <>
      {s.campus > 1 && (
        <div className="seg three" role="group" aria-label="Building">
          {Array.from({ length: s.campus }, (_, b) => (
            <button key={b} aria-pressed={s.bld === b} onClick={() => dispatch({ type: 'bld', b })}>Building {b + 1} ({heightOf(s, b)})</button>
          ))}
        </div>
      )}
      <div className="tabhead"><b>New floor{s.campus > 1 ? ` on building ${s.bld + 1}` : ''}</b><span>Floors {n}/{max}</span></div>
      <SupplyMeters l={l} />
      <div className="chips">
        {BUILDABLE.map(t => (
          <Chip key={t} on={s.next === t} onClick={() => dispatch({ type: 'next', floor: t })}>
            <b>{TYPES[t].name}</b>
            <small className="chip-price">{money(today(s, floorPrice(s.loc, t, n)))}</small>
            <Delta n={deltas[t]} />
          </Chip>
        ))}
      </div>
      <div className="stats">
        <span>{floorEffect(s, s.next)}</span>
        {after.eff < l.eff - 0.001 && <span className="bad">Halls {Math.round(l.eff * 100)}% → {Math.round(after.eff * 100)}%</span>}
        {after.eff > l.eff + 0.001 && <span className="good">Halls {Math.round(l.eff * 100)}% → {Math.round(after.eff * 100)}%</span>}
        {gridLevel(after.strain) > gridLevel(l.strain) && <span className="bad">Grid → {GRID_LABEL[gridLevel(after.strain)]}</span>}
      </div>
      {n < max ? (
        <button className="pill white wide" disabled={!!s.build || short > 0 || !!block} onClick={() => dispatch({ type: 'build' })}>
          {s.build ? 'Building…' : block ? `${block} (Gov tab)` : short > 0 ? `Need ${money(short)}` : `Build  ${money(cost)}`}
        </button>
      ) : (
        <div className="note">
          <span>Max height. {max}/{max} floors.</span>
          {up && !zoningAllows(s, up) && <span>{FOUNDS[up].name} needs zoning approval (Gov tab).</span>}
          {up && zoningAllows(s, up) && (
            <button className="pill white" disabled={s.cash < upCost || !!s.build} onClick={() => dispatch({ type: 'found', found: up })}>
              {FOUNDS[up].name} ({FOUNDS[up].max} floors)  {money(upCost)}
            </button>
          )}
        </div>
      )}
      <AddBuilding s={s} dispatch={dispatch} />
    </>
  );
}

function AddBuilding({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  if (s.campus >= MAX_BUILDINGS) return null;
  const cost = buildingCost(s);
  const allowed = s.campus <= s.permits.campus;
  return (
    <div className="note">
      <span>Real datacenters are campuses of several buildings. {s.campus}/{MAX_BUILDINGS} built.</span>
      <button className="pill" disabled={!allowed || !!s.build || s.cash < cost} onClick={() => dispatch({ type: 'addBuilding' })}>
        {allowed ? `New building  ${money(cost)}` : 'Needs site plan approval (Gov tab)'}
      </button>
    </div>
  );
}

function FloorTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const i = Math.min(s.sel, s.floors.length - 1);
  const f = s.floors[i];
  const status = (k: number, x: Floor) =>
    !x.done ? 'Building' : isBroken(s, k) ? 'Down' : x.type === 'hall' ? (techsOn(s, k) ? `${Math.round(utilization(s, k) * 100)}%` : 'Off') : '';
  return (
    <div className="fgrid">
      <ol className="flist" aria-label="Floors">
        {s.floors.map((x, k) => ({ x, k })).reverse().map(({ x, k }) => (
          <li key={k}>
            <button aria-pressed={k === i} onClick={() => dispatch({ type: 'select', floor: k })} className={isBroken(s, k) ? 'down' : undefined}>
              <span className="fno">{s.campus > 1 ? `${bOf(s, k) + 1}·${level(s, k) + 1}` : k + 1}</span>
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
        <b>{floorLabel(s, i)}: {TYPES[f.type].name}</b>
        <span>{floorEffect(s, f.type)}</span>
      </div>
      {broken && (
        <div className="note bad">
          <span>{techs ? `Down. Repairing ${Math.round(((fixing?.t ?? 0) / 4) * 100)}%` : 'Down. No income.'}</span>
          {!techs && (
            <button className="pill white" disabled={s.cash < today(s, REPAIR_COST)} onClick={() => dispatch({ type: 'repair', floor: i })}>
              Repair crew  {money(today(s, REPAIR_COST))}
            </button>
          )}
        </div>
      )}
      {f.type === 'hall' && f.done && !techs && !broken && <p className="warn">No techs. This hall is off until you hire one.</p>}
      {f.type === 'hall' && f.done && (
        <>
          <div className="books">
            <Row label="Income" value={`${money(hallIncome(s, l, i))}/mo`} />
            <Row label="In use" value={`${Math.round(utilization(s, i) * 100)}%`} />
          </div>
          <div className="crewrow">
            <div className="dudes">
              {Array.from({ length: MAX_TECHS }, (_, k) => <i key={k} className={k < techs ? 'on' : ''} />)}
              <span>Techs {techs}/{MAX_TECHS}</span>
            </div>
            {techs < MAX_TECHS ? (
              <span className="hires">
                <button className="pill white" disabled={s.cash < hireFee(s)} onClick={() => dispatch({ type: 'hire' })}>
                  Local {money(hireFee(s))} <span className="cost">{perMonth(hireDelta(s, i))}</span>
                </button>
                <button className="pill" disabled={s.cash < hireFee(s, true)} onClick={() => dispatch({ type: 'hire', overseas: true })}>
                  Overseas {money(hireFee(s, true))} <span className="cost">{perMonth(hireDelta(s, i, true))}</span>
                </button>
              </span>
            ) : <span className="muted">Full crew</span>}
          </div>
          <p className="muted small">Locals count as town jobs but raise local wages 3% each. Overseas techs earn 30% less but need a {money(today(s, VISA_FEE))} visa every year, and the town notices.</p>
          <BoostRow s={s} i={i} dispatch={dispatch} />
        </>
      )}
      <Threads label="Floor color" value={f.fill} onPick={fill => dispatch({ type: 'fill', fill })} />
      <p className="muted small">Cost {money(f.cost)}</p>
    </div>
  );
}

function StaffTab({ s, l, dispatch, onTab }: { s: GameState; l: Ledger; dispatch: (a: Action) => void; onTab: (t: Tab) => void }) {
  const hoped = hopedJobs(s);
  const S = s.staff;
  const mood = moraleMood(s);
  const n = s.workers.length;
  const teamWait = Math.max(0, Math.ceil((s.cooldown.team ?? 0) - s.month));
  const dir = mood.target > S.morale + 1 ? '▲' : mood.target < S.morale - 1 ? '▼' : '–';
  return (
    <>
      {S.strike && <p className="warn">On strike. Halls run at 30% until you settle.</p>}
      <Meter label="Morale" value={S.morale} max={100} text={`${Math.round(S.morale)} ${dir} ${Math.round(mood.target)}`} bad={S.morale < 35} marks={[mood.target]} />
      <div className="stats"><span>Union drive below 35</span><span className="bad">Strike below 20</span>{S.union && <span className="good">Union contract</span>}</div>
      <div className="books">
        <Row label="Base" value={String(mood.base)} />
        {[...mood.parts].sort((a, b) => a.value - b.value).map(p => (
          <Row key={p.label} label={p.label} sub={` ${p.note}`} value={signed(p.value)} neg={p.value < 0} />
        ))}
      </div>

      <span className="label">Pay</span>
      <div className="seg three" role="group" aria-label="Pay">
        {['Standard', '+10%', '+20%'].map((x, k) => (
          <button key={x} aria-pressed={S.pay === k} disabled={S.union && k < S.pay} onClick={() => dispatch({ type: 'pay', level: k })}>{x}</button>
        ))}
      </div>
      <div className="ups">
        <button className="up" aria-pressed={S.health} disabled={S.union && S.health} onClick={() => dispatch({ type: 'benefit', key: 'health', on: !S.health })}>
          <b>Health insurance</b><small>{money(today(s, 1_500))} per tech a month. Morale +10</small><span>{S.health ? (S.union ? 'In union contract' : 'On') : 'Off'}</span>
        </button>
        <button className="up" aria-pressed={S.retire} onClick={() => dispatch({ type: 'benefit', key: 'retire', on: !S.retire })}>
          <b>Retirement plan</b><small>{money(today(s, 600))} per tech a month. Morale +5</small><span>{S.retire ? 'On' : 'Off'}</span>
        </button>
      </div>

      <span className="label">Boosts</span>
      <div className="ups">
        <button className="up" aria-pressed={S.overtime} onClick={() => dispatch({ type: 'benefit', key: 'overtime', on: !S.overtime })}>
          <b>Overtime</b><small>Halls +10%. Wages +30%. Morale −12</small><span>{S.overtime ? 'On' : 'Off'}</span>
        </button>
        <button className="up" disabled={!n || teamWait > 0 || s.cash < teamEventCost(s)} onClick={() => dispatch({ type: 'teamEvent' })}>
          <b>Team event</b><small>Morale +10, fades over time</small><span>{teamWait ? `Ready in ${teamWait} mo` : money(teamEventCost(s))}</span>
        </button>
      </div>

      <span className="label">Techs {n}</span>
      <div className="books">
        <Row label="Payroll" value={`${money(l.staff)}/mo`} />
        <Row label="Local wage" value={`${money(today(s, wageFor(s)))}/mo`} sub=" rises 3% per local" />
        <Row label="Overseas wage" value={`${money(today(s, overseasWage(s)))}/mo`} sub={` plus ${money(today(s, VISA_FEE))} visa a year`} />
        <Row label="Next hire" value={hireFee(s) ? money(hireFee(s)) : '$0'} />
        <Row label="Local jobs" value={`${locals(s)}/${hoped}`} neg={locals(s) < hoped * 0.5} sub={` ${overseas(s)} overseas`} />
        <Row label="Break rooms" value={`${breakRooms(s)}/${breaksNeeded(s)}`} neg={breakRooms(s) < breaksNeeded(s)} sub=" 1 per 8 techs" />
      </div>
      {n ? (
        <ul className="list">
          {[...s.workers].sort((a, b) => b.floor - a.floor).map(w => (
            <li key={w.id}>
              <button onClick={() => { dispatch({ type: 'select', floor: w.floor }); onTab('floor'); }}>
                <i className="dude" /><b>{w.name}</b><span>{w.overseas ? 'Overseas, ' : ''}{floorLabel(s, w.floor)}</span>
              </button>
              <button className="let-go" onClick={() => dispatch({ type: 'fire', id: w.id })} aria-label={`Let ${w.name} go`}>Let go</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted">No techs. Hire them on a server hall.</p>}
    </>
  );
}

function MoneyTab({ s, l }: { s: GameState; l: Ledger }) {
  const L = LOCS[s.loc];
  const books = s.books ?? l;
  const r = rating(s, l);
  return (
    <>
      {s.debt > 0 && <p className="warn">In debt {s.debt}/3 months. At 3 you go bankrupt.</p>}
      <span className="label">{s.books ? 'Last month' : 'Each month'}</span>
      <div className="books">
        <Row label="Income" value={money(books.revenue)} />
        <Row label="Power" value={money(-books.power)} neg sub={` $${L.power}/MWh${l.strain > 0.6 ? ', grid surcharge' : ''}`} />
        <Row label="Water" value={money(-books.water)} neg />
        <Row label="Staff" value={money(-books.staff)} neg />
        <Row label="Upkeep" value={money(-books.upkeep)} neg />
        {books.fund > 0 && <Row label="Community fund" value={money(-books.fund)} neg />}
        <Row label="Property tax" value={money(-books.propertyTax)} neg />
        <Row label="Profit tax" value={money(-books.incomeTax)} neg sub={` ${Math.round(L.incomeTax * 100)}%`} />
        <Row label="Profit" value={money(books.net)} strong neg={books.net < 0} />
      </div>
      <div className="facts">
        <span>Servers use {l.itMW.toFixed(1)} MW</span>
        <span>PUE {l.pue.toFixed(2)}</span>
        <span>Costs ×{inflation(s).toFixed(2)} since opening</span>
        <span>{L.taxNote}</span>
      </div>
      <span className="label">Rating {r.total}/100</span>
      <div className="books">
        <Row label="Trust" value={`${r.parts.trust}/30`} />
        <Row label="Profit margin" value={`${r.parts.profit}/25`} />
        <Row label="Halls running" value={`${r.parts.running}/20`} />
        <Row label="Jobs" value={`${r.parts.jobs}/15`} />
        <Row label="Grid" value={`${r.parts.grid}/10`} />
      </div>
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
      <Meter label="Trust" value={s.trust} max={100} text={`${Math.round(s.trust)} ${dir === 'rising' ? '▲' : dir === 'falling' ? '▼' : '–'} ${Math.round(mood.target)}`} bad={s.trust < 40} marks={[mood.target]} />
      <div className="stats"><span>Protests below 40</span><span className="bad">Shutdown at 0</span></div>
      <span className="label">Town opinion</span>
      <div className="books">
        <Row label="Base" value={String(mood.base)} />
        {[...mood.parts].sort((a, b) => a.value - b.value).map(p => (
          <Row key={p.label} label={p.label} sub={` ${p.note}`} value={signed(p.value)} neg={p.value < 0} />
        ))}
      </div>

      <span className="label">Town grid: {GRID_LABEL[lvl]}</span>
      <Meter label="Grid" value={l.gridMW} max={l.gridCap} text={`${Math.round(l.strain * 100)}%`} bad={lvl >= 2} marks={[l.gridCap * 0.6, l.gridCap * 0.85]} />
      <div className="stats"><span>60% Higher prices</span><span>85% Brownouts</span><span className="bad">100% Blackouts</span></div>

      <span className="label">Community</span>
      <div className="ups">
        {GIFTS.map(g => {
          const wait = giftWait(s, g.key);
          const none = g.key === 'trees' && imp.cleared === 0;
          return (
            <button key={g.key} className="up" disabled={wait > 0 || none || s.cash < today(s, g.cost)} onClick={() => dispatch({ type: 'gift', key: g.key })}>
              <b>{g.name}</b><small>{g.note}</small>
              <span>{wait ? `Ready in ${wait} mo` : none ? 'No trees cut' : `${money(today(s, g.cost))}  Trust +${g.trust}`}</span>
            </button>
          );
        })}
        <button className="up" disabled={s.cash < sub} onClick={() => dispatch({ type: 'substation' })}>
          <b>Substation</b><small>Grid +{SUBSTATION_MW} MW. Owned: {s.substations}</small><span>{money(sub)}</span>
        </button>
        <button className="up" aria-pressed={s.up.fund} onClick={() => dispatch({ type: 'fund', on: !s.up.fund })}>
          <b>Community fund</b><small>{money(COMMUNITY_FUND)}/mo to the town. Trust +8</small>
          <span>{s.up.fund ? 'On' : 'Off'}</span>
        </button>
      </div>

      <span className="label">Projects</span>
      <div className="ups">
        {UPGRADES.map(u => (
          <button key={u.key} className="up" disabled={s.up[u.key] || s.cash < today(s, u.cost)} onClick={() => dispatch({ type: 'upgrade', key: u.key })}>
            <b>{u.name}</b><small>{u.note}</small><span>{s.up[u.key] ? 'Done' : money(today(s, u.cost))}</span>
          </button>
        ))}
      </div>
      <span className="label">Recent</span>
      <ul className="log">{s.log.slice(0, 5).map((x, k) => <li key={k}>{x}</li>)}</ul>
    </>
  );
}

function GovTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const L = LOCS[s.loc];
  const checks = checklist(s, l);
  const inspectIn = Math.max(0, Math.ceil(s.inspectAt - s.month));
  const voteIn = Math.max(0, Math.ceil(s.electionAt - s.month));
  const laws = activeLaws(s);
  const limits: Record<string, string> = {
    zoning: `Up to ${FOUNDS[FOUND_ORDER[s.permits.zoning]].max} floors of foundation`,
    height: heightLimit(s) > 100 ? 'No height limit' : `Up to ${heightLimit(s)} floors`,
    air: `${s.floors.filter(f => f.type === 'power').length}/${powerLimit(s)} power floors`,
    water: hallLimit(s) > 100 ? 'Not limited' : `${hallCount(s)}/${hallLimit(s)} server halls`,
  };
  return (
    <>
      <span className="label">Permits</span>
      <div className="ups">
        {keys(PERMITS).filter(k => PERMITS[k].here(s)).map(k => {
          const P = PERMITS[k];
          const block = permitBlock(s, k);
          const pending = s.applying.find(a => a.key === k);
          const fee = permitFee(s, k);
          return (
            <button key={k} className="up" disabled={!!block || s.cash < fee} onClick={() => dispatch({ type: 'permit', key: k })}>
              <b>{P.name}</b>
              <small>{limits[k]}</small>
              <small>{P.by(s)}: {P.what(s)}</small>
              <span>{pending ? `Decision in ${Math.max(1, Math.ceil(pending.done - s.month))} mo` : block ?? `Apply ${money(fee)}, ${permitWait(s, k)} mo`}</span>
            </button>
          );
        })}
      </div>
      <p className="muted small">Hearings need trust {hearingBar(s)}+. Air permits stop after 3 generator violations ({s.strikes}/3).</p>

      {hasLaw(s, 'stopWork') && <p className="warn">Stop-work order. No income, bills still due, and a penalty each failed reinspection. Fix every item below; the inspector checks monthly.</p>}
      <span className="label">{hasLaw(s, 'stopWork') ? 'Reinspection next month' : `${inspectionTitle(s)} in ${inspectIn} mo`}</span>
      <div className="books">
        {checks.map(c => <Row key={c.label} label={c.label} value={c.ok ? 'Pass' : 'Fail'} neg={!c.ok} />)}
      </div>

      <span className="label">{L.gov.local} election in {voteIn} mo</span>
      <Meter label="Pro-growth" value={pollPro(s)} max={1} text={`${Math.round(pollPro(s) * 100)}%`} bad={pollPro(s) < 0.5} marks={[0.5]} />
      <p className="muted small">
        Your town&apos;s trust sets the odds. A pro-growth board makes permits 25% faster and hearings need trust 40.
        A slow-growth board makes them 50% slower and hearings need 60.
      </p>
      {L.gov.us && (
        <>
          <span className="label">National election in {Math.max(0, Math.ceil(s.nationalAt - s.month))} mo</span>
          <p className="muted small">
            {s.admin === 'build' ? 'Now: build-fast administration. ' : s.admin === 'green' ? 'Now: clean-energy administration. ' : ''}
            A 50/50 race your town can&apos;t sway. Build-fast means faster permits. Clean-energy means a solar credit and tougher generator rules.
          </p>
        </>
      )}

      <span className="label">Laws and deals</span>
      {laws.length ? (
        <div className="books">
          {laws.map(x => LAWS[x.id] && (
            <Row key={x.id} label={LAWS[x.id].name} sub={` ${LAWS[x.id].by(s)}`}
              value={`${LAWS[x.id].effect}${x.until < 1e8 ? `, ${Math.max(1, Math.ceil(x.until - s.month))} mo` : ''}`} />
          ))}
        </div>
      ) : <p className="muted">None right now.</p>}
    </>
  );
}

function BoostRow({ s, i, dispatch }: { s: GameState; i: number; dispatch: (a: Action) => void }) {
  const on = isBoosted(s, i);
  const left = Math.ceil((s.boosts.find(b => b.floor === i)?.until ?? 0) - s.month);
  const wait = Math.max(0, Math.ceil((s.cooldown[`boost-${i}`] ?? 0) - s.month));
  return (
    <div className="crewrow">
      <span className="muted small">{on ? `Boosted, ${left} mo left` : `Boost: +25% output for ${BOOST_MONTHS} mo. More power, more outages.`}</span>
      <button className="pill" disabled={on || wait > 0 || s.cash < boostCost(s)} onClick={() => dispatch({ type: 'boost', floor: i })}>
        {on ? 'Boosted' : wait ? `Ready in ${wait} mo` : `Boost ${money(boostCost(s))}`}
      </button>
    </div>
  );
}
