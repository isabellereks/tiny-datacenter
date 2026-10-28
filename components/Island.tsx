'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, CHIPS, COOL_MW, CUSTS, FOUND_ORDER, FOUNDS, LOCS, MAX_TECHS, OUTLINES, POWER_MW, REPAIR_COST,
  SHAPES, STITCH, TIERS, TYPES,
  type BuildableType, type StitchSize,
} from '@/lib/game/data';
import {
  GIFTS, UPGRADES, foundationUpgradeCost, giftWait, hopedJobs, nextFoundation, rating, townMood, type Impact,
} from '@/lib/game/events';
import {
  GRID_LABEL, bOf, hasLaw, buildCost, buildDelta, buildingCost, chipValue, dealPrice, fitGen, floorLabel, genOf, heightOf, level, maxBuildings, dateLabel, floorPrice,
  gridLevel, hallCount, hallIncome, hireDelta, hireFee, inflation, isBoosted, isBroken, locals, overseas, overseasWage, VISA_FEE, wageFor, ledger, money,
  allocate, buildMonths, busy, hallMWOf, jobOn, signedMW, solarCount, turbineCount, unitCost, today, techsOn, utilization, type Deal, type Floor, type GameState, type Ledger, type Offer,
} from '@/lib/game/state';
import {
  LAWS, PERMITS, activeLaws, buildBlock, checklist, heightLimit, hallLimit,
  inspectionTitle, permitBlock, permitNeeds, permitFee, permitWait, pollPro, powerLimit, zoningAllows,
} from '@/lib/game/gov';
import { breakRooms, breaksNeeded, boostCost, BOOST_MONTHS, moraleMood, teamEventCost } from '@/lib/game/staff';
import {
  canRefresh, exitFee, fastTrackCost, gridStage, gridAsk, gridBlock, gridDeposit, gridWait, NEED_LABEL, NEED_NOTE, refreshCost,
} from '@/lib/game/deals';
import { BillPanel, FinancePanel } from './Strategy';
import { Cash, Count } from './Num';
import { Threads } from './Threads';

export type Tab = 'build' | 'floor' | 'deals' | 'crew' | 'money' | 'town' | 'gov' | 'look';
const TABS: { key: Tab; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'floor', label: 'Floors' },
  { key: 'deals', label: 'Deals' },
  { key: 'crew', label: 'Staff' },
  { key: 'town', label: 'Town' },
  { key: 'gov', label: 'Gov' },
  { key: 'money', label: 'Money' },
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
export function Meter({ label, value, max, text, bad, marks = [] }: {
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

/** Detail that stays out of the way until asked for. */
export function Why({ label, children }: { label: string; children: ReactNode }) {
  return <details className="why"><summary>{label}</summary>{children}</details>;
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
  // complaints and decisions arrive as letters (Letter.tsx), so the island stays out of the way
  const over = s.phase === 'over';
  const mode = over ? 'activity' : open ? 'expanded' : activity ? 'activity' : 'compact';
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
  const short = l.promised > l.served + 0.1;
  const warn = hasLaw(s, 'moratorium') ? 'Moratorium' : hasLaw(s, 'stopWork') ? 'Stop-work order' : s.staff.strike ? 'On strike' : downAlone ? 'Floor down' : idle ? 'Hall idle'
    : short ? `Short ${(l.promised - l.served).toFixed(1)} MW` : signedMW(s) > potential(s, l) + 0.5 ? 'Over capacity' : s.debt > 0 ? 'In debt' : l.chipValue < 0.75 ? 'Old chips' : l.strain >= 0.85 ? GRID_LABEL[gridLevel(l.strain)] : l.eff < 0.999 ? `Halls at ${Math.round(l.eff * 100)}%` : s.offers.length ? `${s.offers.length} ${s.offers.length === 1 ? 'offer' : 'offers'}` : null;

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
        <Cash className="cash" value={s.cash} />
        <Cash className={l.net >= 0 ? 'rate' : 'rate neg'} value={l.net} perMonth signed />
        <Hearts trust={s.trust} />
        {warn && <span className="flag">{warn}</span>}
        {s.bill && <span className={`flag bill${s.bill.progress >= 80 ? ' hot' : ''}`}>Bill {Math.round(s.bill.progress)}%</span>}
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
  } else {
    body = <Expanded {...{ s, l, imp, tab, armed, dispatch, onClose, onTab, onResetView, onShare }} />;
  }

  return (
    <div className={`island ${mode}`} style={{ width: size.w, height: size.h }}>
      <div className="island-in" ref={inner} key={mode}>{body}</div>
    </div>
  );
}

export function Row({ label, value, strong, neg, sub }: { label: string; value: string; strong?: boolean; neg?: boolean; sub?: string }) {
  return (
    <div className={`row${strong ? ' strong' : ''}`}>
      <span>{label}{sub && <small>{sub}</small>}</span>
      <span className={neg ? 'neg' : undefined}>{value}</span>
    </div>
  );
}


/** What a floor of this type does, in plain numbers for this site. */
function floorEffect(s: GameState, type: Floor['type']) {
  const L = LOCS[s.loc];
  const cool = COOL_MW * FOUNDS[s.found].cool * SHAPES[s.shape].cool * (1.2 / L.pue) * (s.up.liquid ? 1.5 : 1);
  switch (type) {
    case 'hall': return `${CHIPS[fitGen(s)].name}, ${CHIPS[fitGen(s)].mw} MW`;
    case 'power': return `+${POWER_MW} MW power`;
    case 'cool': return `+${cool.toFixed(1)} MW cooling`;
    case 'net': return 'Customers pay more';
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
          <span className="day">{dateLabel(s.month)} · {TIERS[s.tier].name}</span>
          <div className="money"><b><Cash value={s.cash} /></b><Cash className={l.net >= 0 ? undefined : 'neg'} value={l.net} perMonth signed /></div>
        </div>
        <div className="ex-side">
          <SpeedButton s={s} dispatch={dispatch} />
          <span className="score">Rating <Count value={r.total} /></span>
          <button className="close" aria-pressed={tab === 'look'} onClick={() => onTab(tab === 'look' ? 'build' : 'look')} aria-label="Settings" title="Settings and start over">
            <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true"><path d="M3 0h1v1h1v1h1v1h1v1H6v1H5v1H4v1H3V6H2V5H1V4H0V3h1V2h1V1h1zM3 3v1h1V3z" fill="currentColor" /></svg>
          </button>
          <button className="close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 9l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)}>
            {t.label}{t.key === 'deals' && s.offers.length > 0 && <i className="badge">{s.offers.length}</i>}
          </button>
        ))}
      </div>

      <div className="ex-body" key={tab}>
        {tab === 'build' && <BuildTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'floor' && <FloorTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'deals' && <DealsTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'crew' && <StaffTab s={s} l={l} dispatch={dispatch} onTab={onTab} />}
        {tab === 'money' && <MoneyTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'town' && <TownTab s={s} l={l} imp={imp} dispatch={dispatch} />}
        {tab === 'gov' && <GovTab s={s} l={l} dispatch={dispatch} />}
        {tab === 'look' && (
          <>
            <button className={`pill wide${armed ? ' danger' : ''}`} onClick={() => dispatch({ type: 'reset' })}>
              {armed ? 'Tap again to start over' : 'Start over'}
            </button>
            <div className="seg" role="group" aria-label="Camera">
              <button aria-pressed={!s.inside} onClick={() => dispatch({ type: 'inside', on: false })}>Outside</button>
              <button aria-pressed={s.inside} onClick={() => dispatch({ type: 'inside', on: true })}>Inside</button>
            </div>
            <div className="toggles">
              <Chip on={s.spin} onClick={() => dispatch({ type: 'spin', on: !s.spin })}><b>Rotate</b></Chip>
              <Chip on={s.smoke} onClick={() => dispatch({ type: 'smoke', on: !s.smoke })}><b>Steam</b></Chip>
              <Chip on={!s.muted} onClick={() => dispatch({ type: 'mute', on: !s.muted })}><b>Sound</b></Chip>
              <Chip on={!!s.hints} onClick={() => dispatch({ type: 'hints', on: !s.hints })}><b>Hints</b></Chip>
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
    </>
  );
}

function BuildTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const n = heightOf(s, s.bld), max = FOUNDS[s.found].max, cost = buildCost(s);
  const up = nextFoundation(s);
  const upCost = up ? foundationUpgradeCost(s, up) : 0;
  const deltas = Object.fromEntries(BUILDABLE.map(t => [t, buildDelta(s, t)])) as Record<BuildableType, number>;
  const after = ledger({ ...s, floors: [...s.floors, { type: s.next, fill: s.nextFill, done: true, cost, gen: fitGen(s) }] });
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
            {s.hints && <Delta n={deltas[t]} />}
          </Chip>
        ))}
      </div>
      <div className="stats">
        <span>{floorEffect(s, s.next)}</span>
        {s.hints && after.eff < l.eff - 0.001 && <span className="bad">Halls {Math.round(l.eff * 100)}% → {Math.round(after.eff * 100)}%</span>}
        {s.hints && after.eff > l.eff + 0.001 && <span className="good">Halls {Math.round(l.eff * 100)}% → {Math.round(after.eff * 100)}%</span>}
        {s.hints && gridLevel(after.strain) > gridLevel(l.strain) && <span className="bad">Grid → {GRID_LABEL[gridLevel(after.strain)]}</span>}
      </div>
      {n < max ? (
        <button className="pill white wide" disabled={busy(s, s.bld) || short > 0 || !!block} onClick={() => dispatch({ type: 'build' })}>
          {busy(s, s.bld) ? `Crew busy: ${Math.max(1, Math.ceil(((s.jobs ?? []).find(j => bOf(s, j.idx) === s.bld)?.to ?? s.month) - s.month))} mo left` : block ? `${block} (Gov tab)` : short > 0 ? `Need ${money(short)}` : `Build  ${money(cost)}, ${buildMonths(s, s.next)} mo`}
        </button>
      ) : (
        <div className="note">
          <span>Max height for this foundation</span>
          {up && !zoningAllows(s, up) && <span>Taller needs a zoning permit (Gov tab)</span>}
        </div>
      )}
      {up && zoningAllows(s, up) && (
        <button className="pill" disabled={s.cash < upCost || !!(s.jobs ?? []).length} onClick={() => dispatch({ type: 'found', found: up })}>
          {FOUNDS[up].name}, up to {FOUNDS[up].max} floors  {money(upCost)}
        </button>
      )}
      <AddBuilding s={s} dispatch={dispatch} />
      <GridPanel s={s} l={l} dispatch={dispatch} />
      <span className="label">Projects</span>
      <div className="ups">
        {UPGRADES.map(u => {
          const locked = s.tier < u.tier;
          if (u.key === 'turbines' || u.key === 'solar') {
            const n = u.key === 'turbines' ? turbineCount(s) : solarCount(s);
            const cost = unitCost(s, u.key, n);
            const wait = Math.max(0, Math.ceil((s.cooldown[`unit-${u.key}`] ?? 0) - s.month));
            return (
              <button key={u.key} className="up" disabled={locked || wait > 0 || s.cash < cost} onClick={() => dispatch({ type: 'addUnit', key: u.key as 'turbines' | 'solar' })}>
                <b>{u.name}{n ? ` ×${n}` : ''}</b><small>{u.note}</small>
                <span>{locked ? `Unlocks at ${TIERS[u.tier].name.toLowerCase()}` : wait ? `Next in ${wait} mo` : money(cost)}</span>
              </button>
            );
          }
          const building = u.key === 'smr' && s.smrAt !== null;
          return (
            <button key={u.key} className="up" disabled={locked || s.up[u.key] || building || s.cash < today(s, u.cost)} onClick={() => dispatch({ type: 'upgrade', key: u.key })}>
              <b>{u.name}</b><small>{u.note}</small>
              <span>{s.up[u.key] ? 'Done' : building ? `Online in ${Math.ceil((s.smrAt ?? 0) - s.month)} mo` : locked ? `Unlocks at ${TIERS[u.tier].name.toLowerCase()}` : money(today(s, u.cost))}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The town grid, your place in the utility's queue, and power made on site. */
function GridPanel({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const ask = gridAsk(s), block = gridBlock(s), fee = gridDeposit(s, ask), stage = gridStage(s);
  return (
    <>
      <span className="label">Grid: {GRID_LABEL[gridLevel(l.strain)]}</span>
      <Meter label="Town grid" value={l.gridMW} max={l.gridCap} text={`${l.gridMW.toFixed(1)} of ${l.gridCap.toFixed(0)} MW`} bad={l.strain >= 0.85} marks={[l.gridCap * 0.6, l.gridCap * 0.85]} />
      {l.onsite > 0 && <div className="stats"><span>{l.onsite} MW made on site</span></div>}
      {s.gridQueue ? (
        <div className="queue">
          <div className="queue-top"><b>{s.gridQueue.mw} MW from {LOCS[s.loc].gov.utility}</b><span>{stage?.left} mo</span></div>
          <div className="queue-steps">{Array.from({ length: stage?.of ?? 5 }, (_, k) => <i key={k} className={k < (stage?.step ?? 0) ? 'on' : ''} />)}</div>
          <small>Step {stage?.step} of {stage?.of}: {stage?.name}{s.gridQueue.flex ? '. Flexible connection' : s.gridQueue.paid ? '. You paid for the substation' : ''}</small>
          {!s.gridQueue.paid && !s.gridQueue.flex && (
            <div className="queue-acts">
              <button className="pill" disabled={s.cash < fastTrackCost(s)} onClick={() => dispatch({ type: 'gridFast', how: 'pay' })}>Pay for the substation  {money(fastTrackCost(s))}</button>
              <button className="pill" onClick={() => dispatch({ type: 'gridFast', how: 'flex' })} title="The grid operator can cut you back at peak times, for good">Flexible connection</button>
            </div>
          )}
        </div>
      ) : (
        <button className="pill wide" disabled={!!block || s.cash < fee} onClick={() => dispatch({ type: 'grid', mw: ask })}>
          {block ?? `Ask ${LOCS[s.loc].gov.utility} for ${ask} MW  ${money(fee)}, about ${gridWait(s, ask)} mo`}
        </button>
      )}
    </>
  );
}

function AddBuilding({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  if (s.campus >= maxBuildings(s)) return null;
  const cost = buildingCost(s);
  const allowed = s.campus <= s.permits.campus;
  return (
    <button className="pill wide" disabled={!allowed || s.cash < cost} onClick={() => dispatch({ type: 'addBuilding' })}>
      {allowed ? `New building ${s.campus + 1} of ${maxBuildings(s)}  ${money(cost)}` : `Building ${s.campus + 1} needs site plan approval (Gov tab)`}
    </button>
  );
}

function FloorTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const i = Math.min(s.sel, s.floors.length - 1);
  const f = s.floors[i];
  const status = (k: number, x: Floor) =>
    !x.done ? `${Math.max(1, Math.ceil((jobOn(s, k)?.to ?? s.month) - s.month))} mo` : isBroken(s, k) ? 'Down' : x.type === 'hall' ? (techsOn(s, k) ? `${Math.round(utilization(s, k) * 100)}%` : 'Off') : '';
  return (
    <div className="fgrid">
      <ol className="flist" aria-label="Floors">
        {s.floors.map((x, k) => ({ x, k })).reverse().map(({ x, k }) => (
          <li key={k}>
            <button aria-pressed={k === i} onClick={() => dispatch({ type: 'select', floor: k })} className={isBroken(s, k) ? 'down' : undefined}>
              <span className="fno">{s.campus > 1 ? `${bOf(s, k) + 1}·${level(s, k) + 1}` : k + 1}</span>
              <span className="fname">{TYPES[x.type].name}</span>
              {x.type === 'hall' && <span className="ftechs">{'●'.repeat(Math.min(MAX_TECHS, techsOn(s, k)))}{'○'.repeat(Math.max(0, MAX_TECHS - techsOn(s, k)))}</span>}
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
  const hall = f.type === 'hall';
  return (
    <div className="fdetail">
      <div className="floorhead">
        <b>{floorLabel(s, i)}: {TYPES[f.type].name}</b>
        <span>{hall ? `${CHIPS[genOf(f)].name}, ${CHIPS[genOf(f)].mw} MW` : floorEffect(s, f.type)}</span>
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
      {hall && f.done && (
        <>
          <div className="books">
            <Row label="Income" value={`${money(hallIncome(s, l, i))}/mo`} />
            <Row label="Running" value={`${Math.round(utilization(s, i) * 100)}%`} />
            <Row label="Chips" value={genOf(f) < s.chip ? `${Math.round(chipValue(s, f) * 100)}% of new` : 'Newest'} neg={genOf(f) < s.chip} />
          </div>
          <div className="crewrow">
            <div className="dudes">
              {Array.from({ length: MAX_TECHS }, (_, k) => <i key={k} className={k < techs ? 'on' : ''} />)}
              <span>Techs {techs}/{MAX_TECHS}</span>
            </div>
            {techs < MAX_TECHS ? (
              <span className="hires">
                <button className="pill white" disabled={s.cash < hireFee(s)} onClick={() => dispatch({ type: 'hire' })} title="Counts as a town job">
                  Local {money(hireFee(s))} <span className="cost">{s.hints ? perMonth(hireDelta(s, i)) : `${money(today(s, wageFor(s)))}/mo`}</span>
                </button>
                <button className="pill" disabled={s.cash < hireFee(s, true)} onClick={() => dispatch({ type: 'hire', overseas: true })} title={`Half the wage, ${money(today(s, VISA_FEE))} visa a year`}>
                  Overseas {money(hireFee(s, true))} <span className="cost">{s.hints ? perMonth(hireDelta(s, i, true)) : `${money(today(s, overseasWage(s)))}/mo`}</span>
                </button>
              </span>
            ) : <span className="muted">Full crew</span>}
          </div>
          {genOf(f) < s.chip && (
            <button className="pill wide" disabled={!canRefresh(s, i) || s.cash < refreshCost(s)} onClick={() => dispatch({ type: 'refresh', floor: i })}>
              {canRefresh(s, i) ? `Refit with ${CHIPS[fitGen(s)].name}  ${money(refreshCost(s))}` : `${CHIPS[s.chip].name} need liquid cooling`}
            </button>
          )}
          <BoostRow s={s} i={i} dispatch={dispatch} />
        </>
      )}
      <Threads label="Floor color" value={f.fill} onPick={fill => dispatch({ type: 'fill', fill })} />
    </div>
  );
}

/** MW you could run with every hall staffed and enough power, cooling and grid. */
function potential(s: GameState, l: Ledger) {
  const supply = Math.min(l.powerMW, l.coolMW, (l.gridCap + l.onsite) / l.pue);
  return Math.min(l.hallMW, supply);
}

/** What caps the MW you can run. Just the numbers: the tightest one is marked. */
function Limits({ s, l, want }: { s: GameState; l: Ledger; want: number }) {
  const staffed = s.floors.reduce((t, f, i) => t + (f.done && f.type === 'hall' && !isBroken(s, i) ? hallMWOf(f) * utilization(s, i) : 0), 0);
  const rows = [
    { label: 'Server halls', mw: l.hallMW },
    { label: 'Power floors', mw: l.powerMW },
    { label: 'Cooling floors', mw: l.coolMW },
    { label: l.onsite ? 'Grid and on-site power' : 'Town grid', mw: (l.gridCap + l.onsite) / l.pue },
    { label: 'Techs on halls', mw: staffed },
  ];
  const tight = rows.reduce((a, b) => (b.mw < a.mw ? b : a));
  if (want <= tight.mw + 0.05) return null;
  const top = Math.max(want, ...rows.map(r => r.mw), 0.1);
  return (
    <div className="limits">
      <div className="limits-head"><b>{tight.mw.toFixed(1)} of {want.toFixed(1)} MW</b></div>
      {rows.map(r => (
        <div key={r.label} className={`limit${r === tight ? ' tight' : ''}`}>
          <span>{r.label}</span>
          <div className="bar"><i style={{ transform: `scaleX(${Math.min(1, r.mw / top)})` }} /><b className="mark" style={{ left: `${Math.min(100, (want / top) * 100)}%` }} /></div>
          <span className="num">{r.mw.toFixed(1)} MW</span>
        </div>
      ))}
    </div>
  );
}

function DealsTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const signed = signedMW(s), can = potential(s, l);
  const waiting = s.deals.filter(d => d.start > s.month);
  const live = s.deals.filter(d => d.start <= s.month);
  return (
    <>
      <Meter label="Running" value={l.itMW} max={Math.max(signed, can, 0.1)} text={`${l.itMW.toFixed(1)} MW`} />
      <Meter label="Signed" value={signed} max={Math.max(signed, can, 0.1)} text={`${signed.toFixed(1)} MW`} bad={signed > can + 0.05} />
      <Limits s={s} l={l} want={signed} />
      <div className="stats">
        <span>Could run {can.toFixed(1)} MW</span>
        {l.spot > 0 && <span className="good">Spare sells for {money(l.spot)}/mo</span>}
        {l.sla > 0 && <span className="bad">Credits {money(l.sla)}/mo</span>}
      </div>
      {s.offers.length > 0 && <span className="label">Offers</span>}
      {s.offers.map(o => <OfferCard key={o.id} s={s} o={o} can={can} dispatch={dispatch} />)}
      {live.length > 0 && <span className="label">Customers</span>}
      {live.map(d => <DealCard key={d.id} s={s} d={d} l={l} dispatch={dispatch} />)}
      {waiting.length > 0 && <span className="label">Moving in</span>}
      {waiting.map(d => <DealCard key={d.id} s={s} d={d} l={l} dispatch={dispatch} />)}
    </>
  );
}

function Needs({ needs }: { needs: Offer['needs'] }) {
  if (!needs.length) return null;
  return <span className="needs">{needs.map(n => <i key={n} title={NEED_NOTE[n]}>{NEED_LABEL[n]}</i>)}</span>;
}

function OfferCard({ s, o, can, dispatch }: { s: GameState; o: Offer; can: number; dispatch: (a: Action) => void }) {
  const tight = signedMW(s) + o.mw > can + 0.05;
  const left = Math.max(1, Math.ceil(o.expires - s.month));
  return (
    <div className="deal offer">
      <div className="deal-top">
        <b>{o.who}</b>
        <span>{CUSTS[o.kind].name}</span>
      </div>
      <div className="deal-nums">
        <span><b>{o.mw} MW</b> for {o.months / 12} yrs</span>
        <span><b>{money(o.mw * 1000 * o.price)}</b>/mo</span>
        <span>Moves in {o.lead} mo</span>
      </div>
      <Needs needs={o.needs} />
      {tight && <small className="bad">Over capacity</small>}
      <div className="deal-foot">
        <span className="muted small">Answer within {left} mo</span>
        <button className="pill" onClick={() => dispatch({ type: 'decline', id: o.id })}>Pass</button>
        <button className="pill white" onClick={() => dispatch({ type: 'sign', id: o.id })}>{tight ? 'Sign anyway' : 'Sign'}</button>
      </div>
    </div>
  );
}

function DealCard({ s, d, l, dispatch }: { s: GameState; d: Deal; l: Ledger; dispatch: (a: Action) => void }) {
  const [sure, setSure] = useState(false);
  const fee = exitFee(s, d);
  const waiting = d.start > s.month;
  // customers pay for the power you deliver, served in the order they signed
  const got = allocate(s, l.itMW).find(x => x.d.id === d.id)?.got ?? 0;
  const yrs = Math.max(0, (d.until - s.month) / 12);
  return (
    <div className={`deal${d.strikes ? ' hurt' : ''}`}>
      <div className="deal-top">
        <b>{d.who}</b>
        <span>{waiting ? `Moves in ${Math.ceil(d.start - s.month)} mo` : `${yrs < 1 ? `${Math.ceil(yrs * 12)} mo` : `${yrs.toFixed(1)} yrs`} left`}</span>
      </div>
      <div className="deal-nums">
        <span><b>{waiting ? d.mw : got.toFixed(1)}</b>{waiting ? ' MW' : ` of ${d.mw} MW`}</span>
        <span>{waiting ? `${money(d.mw * 1000 * dealPrice(s, d))}/mo` : <><b>{money(got * 1000 * dealPrice(s, d) * l.chipValue)}</b>/mo of {money(d.mw * 1000 * dealPrice(s, d))}</>}</span>
        {d.strikes > 0 && <span className="bad">Strikes {d.strikes}/3</span>}
      </div>
      <Needs needs={d.needs} />
      {!waiting && l.chipValue < 0.99 && d.needs.includes('fresh') && <small className="bad">Paying 20% less for old chips</small>}
      <div className="deal-foot">
        <span />
        <button className={`pill${sure ? ' danger' : ''}`} disabled={s.cash < fee}
          onClick={() => { if (sure) dispatch({ type: 'endDeal', id: d.id }); else { setSure(true); window.setTimeout(() => setSure(false), 3000); } }}>
          {sure ? `Tap again to pay ${money(fee)}` : `End deal  ${money(fee)}`}
        </button>
      </div>
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
      {S.strike && (
        <div className="note bad">
          <span>On strike{S.struck ? ` for ${S.struck} mo` : ''}. Halls at 30%.</span>
          <button className="pill white" onClick={() => dispatch({ type: 'settle' })} title="Pay +10%, union, health and retirement">Settle</button>
        </div>
      )}
      <Meter label="Morale" value={S.morale} max={100} text={s.hints ? `${Math.round(S.morale)} ${dir} ${Math.round(mood.target)}` : `${Math.round(S.morale)}`} bad={S.morale < 35} marks={s.hints ? [mood.target] : []} />
      {s.hints && <Why label="Why">
        <div className="books">
          <Row label="Base" value={String(mood.base)} />
          {[...mood.parts].sort((a, b) => a.value - b.value).map(p => (
            <Row key={p.label} label={p.label} sub={` ${p.note}`} value={signed(p.value)} neg={p.value < 0} />
          ))}
        </div>
      </Why>}

      <span className="label">Pay</span>
      <div className="seg three" role="group" aria-label="Pay">
        {['Standard', '+10%', '+20%'].map((x, k) => (
          <button key={x} aria-pressed={S.pay === k} disabled={S.union && k < S.pay} onClick={() => dispatch({ type: 'pay', level: k })}>{x}</button>
        ))}
      </div>
      <div className="ups">
        <button className="up" aria-pressed={S.health} disabled={S.union && S.health} onClick={() => dispatch({ type: 'benefit', key: 'health', on: !S.health })}>
          <b>Health insurance</b><small>{money(today(s, 1_500))}/tech</small><span>{S.health ? (S.union ? 'In union contract' : 'On') : 'Off'}</span>
        </button>
        <button className="up" aria-pressed={S.retire} onClick={() => dispatch({ type: 'benefit', key: 'retire', on: !S.retire })}>
          <b>Retirement</b><small>{money(today(s, 600))}/tech</small><span>{S.retire ? 'On' : 'Off'}</span>
        </button>
        <button className="up" aria-pressed={S.overtime} onClick={() => dispatch({ type: 'benefit', key: 'overtime', on: !S.overtime })}>
          <b>Overtime</b><small>Halls +10%, wages +30%</small><span>{S.overtime ? 'On' : 'Off'}</span>
        </button>
        <button className="up" disabled={!n || teamWait > 0 || s.cash < teamEventCost(s)} onClick={() => dispatch({ type: 'teamEvent' })}>
          <b>Team event</b><small>Morale +10</small><span>{teamWait ? `Ready in ${teamWait} mo` : money(teamEventCost(s))}</span>
        </button>
      </div>

      <span className="label">Techs {n}</span>
      <div className="books">
        <Row label="Payroll" value={`${money(l.staff)}/mo`} />
        <Row label="Local jobs" value={`${locals(s)}/${hoped}`} neg={locals(s) < hoped * 0.5} sub={` ${overseas(s)} overseas`} />
        <Row label="Break rooms" value={`${breakRooms(s)}/${breaksNeeded(s)}`} neg={breakRooms(s) < breaksNeeded(s)} />
      </div>
      <Why label="Wages">
        <div className="books">
          <Row label="Local" value={`${money(today(s, wageFor(s)))}/mo`} />
          <Row label="Overseas" value={`${money(today(s, overseasWage(s)))}/mo`} sub={` + ${money(today(s, VISA_FEE))} visa/yr`} />
          <Row label="Next hire" value={hireFee(s) ? money(hireFee(s)) : '$0'} />
        </div>
      </Why>
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
      ) : null}
    </>
  );
}

function MoneyTab({ s, l, dispatch }: { s: GameState; l: Ledger; dispatch: (a: Action) => void }) {
  const books = s.books ?? l;
  const r = rating(s, l);
  return (
    <>
      {s.debt > 0 && <p className="warn">In debt {s.debt}/3 months. At 3 you go bankrupt.</p>}
      <span className="label">{s.books ? 'Last month' : 'Each month'}</span>
      <div className="books">
        <Row label="Customers" value={money(books.dealIncome)} />
        {books.spot > 0 && <Row label="Spot market" value={money(books.spot)} sub=" spare capacity" />}
        {books.sla > 0 && <Row label="Credits to customers" value={money(-books.sla)} neg />}
        <Row label="Power" value={money(-books.power)} neg sub={l.strain > 0.6 ? ' grid surcharge' : undefined} />
        {books.fuel > 0 && <Row label="Fuel" value={money(-books.fuel)} neg />}
        <Row label="Water" value={money(-books.water)} neg />
        <Row label="Staff" value={money(-books.staff)} neg />
        <Row label="Upkeep" value={money(-books.upkeep)} neg />
        <Row label="Property tax" value={money(-books.propertyTax)} neg />
        <Row label="Profit tax" value={money(-books.incomeTax)} neg />
        {books.interest > 0 && <Row label="Loan interest" value={money(-books.interest)} neg />}
        {books.principal > 0 && <Row label="Loan principal" value={money(-books.principal)} neg />}
        <Row label="Profit" value={money(books.net)} strong neg={books.net < 0} />
      </div>
      <FinancePanel s={s} dispatch={dispatch} />
      {s.hints && <Why label={`Rating ${r.total}/100`}>
        <div className="books">
          <Row label="Trust" value={`${r.parts.trust}/30`} />
          <Row label="Profit margin" value={`${r.parts.profit}/25`} />
          <Row label="Promises kept" value={`${r.parts.running}/20`} />
          <Row label="Jobs" value={`${r.parts.jobs}/15`} />
          <Row label="Grid" value={`${r.parts.grid}/10`} />
          <Row label="Costs since opening" value={`×${inflation(s).toFixed(2)}`} />
        </div>
      </Why>}
    </>
  );
}


function TownTab({ s, l, imp, dispatch }: { s: GameState; l: Ledger; imp: Impact; dispatch: (a: Action) => void }) {
  const mood = townMood(s, l, imp);
  const dir = mood.target > s.trust + 1 ? '▲' : mood.target < s.trust - 1 ? '▼' : '–';
  return (
    <>
      <Meter label="Trust" value={s.trust} max={100} text={s.hints ? `${Math.round(s.trust)} ${dir} ${Math.round(mood.target)}` : `${Math.round(s.trust)}`} bad={s.trust < 40} marks={s.hints ? [mood.target] : []} />
      <div className="town">
        {mood.parts.filter(p => p.key !== 'deeds' && p.key !== 'grudge' || p.value !== 0).map(p => (
          <div key={p.key} className={`tfac ${p.value < -3 ? 'bad' : p.value > 0 ? 'good' : ''}`}>
            <span className="tfac-v">{s.hints ? signed(p.value) : p.value < -3 ? '▼' : p.value > 0 ? '▲' : '–'}</span>
            <div>
              <b>{p.label}</b>
              <small>{p.note}</small>
            </div>
          </div>
        ))}
      </div>
      <span className="label">Give back</span>
      <div className="ups">
        {GIFTS.map(g => {
          const wait = giftWait(s, g.key);
          const none = g.key === 'trees' && imp.cleared === 0;
          return (
            <button key={g.key} className="up" disabled={wait > 0 || none || s.cash < today(s, g.cost)} onClick={() => dispatch({ type: 'gift', key: g.key })}>
              <b>{g.name}</b><small>{g.note}</small>
              <span>{wait ? `${wait} mo` : none ? 'No trees cut' : money(today(s, g.cost))}</span>
            </button>
          );
        })}
      </div>
      <Why label="Recent">
        <ul className="log">{s.log.slice(0, 6).map((x, k) => <li key={k}>{x}</li>)}</ul>
      </Why>
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
    zoning: `${FOUNDS[FOUND_ORDER[s.permits.zoning]].name} (${FOUNDS[FOUND_ORDER[s.permits.zoning]].max} floors)`,
    height: heightLimit(s) > 100 ? 'No height limit' : `Up to ${heightLimit(s)} floors`,
    air: `${powerLimit(s)} power floors (${s.floors.filter(f => f.type === 'power').length} built)`,
    water: hallLimit(s) > 100 ? 'Not limited' : `${hallLimit(s)} server halls (${hallCount(s)} built)`,
    campus: `${s.permits.campus + 1} of ${maxBuildings(s)} buildings`,
  };
  return (
    <>
      <BillPanel s={s} l={l} />
      <span className="label">Permits</span>
      <div className="ups">
        {keys(PERMITS).filter(k => PERMITS[k].here(s)).map(k => {
          const P = PERMITS[k];
          const block = permitBlock(s, k);
          const pending = s.applying.find(a => a.key === k);
          const fee = permitFee(s, k);
          const log = s.permitLog[k];
          const needs = permitNeeds(s, k);
          return (
            <button key={k} className="up" disabled={!!block || s.cash < fee} onClick={() => dispatch({ type: 'permit', key: k })}>
              <b>{P.name}</b>
              <small>{limits[k]}</small>
              {log && log.ok === false && <small className="bad">{log.text}</small>}
              {!pending && !block && needs !== null && s.trust < needs && <small className="bad">Needs trust {needs}</small>}
              <span>{pending ? `${Math.max(1, Math.ceil(pending.done - s.month))} mo` : block ?? `${money(fee)}, ${permitWait(s, k)} mo`}</span>
            </button>
          );
        })}
      </div>

      {hasLaw(s, 'stopWork') && <p className="warn">Stop-work order</p>}
      <span className="label">{hasLaw(s, 'stopWork') ? 'Reinspection next month' : `${inspectionTitle(s)} in ${inspectIn} mo`}</span>
      <div className="books">
        {checks.map(c => <Row key={c.label} label={c.label} value={c.ok ? 'Pass' : 'Fail'} neg={!c.ok} />)}
      </div>

      <span className="label">{L.gov.local} election in {voteIn} mo</span>
      <Meter label="Pro-growth" value={pollPro(s)} max={1} text={`${Math.round(pollPro(s) * 100)}%`} bad={pollPro(s) < 0.5} marks={[0.5]} />
      {L.gov.us && <Row label={`National election in ${Math.max(0, Math.ceil(s.nationalAt - s.month))} mo`} value={s.admin === 'build' ? 'Build-fast' : s.admin === 'green' ? 'Clean-energy' : ''} />}

      {laws.length > 0 && <span className="label">Laws</span>}
      {laws.length > 0 && (
        <div className="books">
          {laws.map(x => LAWS[x.id] && (
            <Row key={x.id} label={LAWS[x.id].name} sub={` ${LAWS[x.id].by(s)}`}
              value={`${LAWS[x.id].effect}${x.until < 1e8 ? `, ${Math.max(1, Math.ceil(x.until - s.month))} mo` : ''}`} />
          ))}
        </div>
      )}
    </>
  );
}

function BoostRow({ s, i, dispatch }: { s: GameState; i: number; dispatch: (a: Action) => void }) {
  const on = isBoosted(s, i);
  const left = Math.ceil((s.boosts.find(b => b.floor === i)?.until ?? 0) - s.month);
  const wait = Math.max(0, Math.ceil((s.cooldown[`boost-${i}`] ?? 0) - s.month));
  return (
    <div className="crewrow">
      <span className="muted small">{on ? `Boosted, ${left} mo left` : `+25% for ${BOOST_MONTHS} mo`}</span>
      <button className="pill" disabled={on || wait > 0 || s.cash < boostCost(s)} onClick={() => dispatch({ type: 'boost', floor: i })}>
        {on ? 'Boosted' : wait ? `Ready in ${wait} mo` : `Boost ${money(boostCost(s))}`}
      </button>
    </div>
  );
}
