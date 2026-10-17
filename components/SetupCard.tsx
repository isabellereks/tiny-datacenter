'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setupIndex, type Action } from '@/lib/game/actions';
import {
  BUDGET, CUSTS, FOUNDS, LOCS, SETUP, SHAPES, STARTER, TYPES,
  type CustKey, type FoundKey, type LocKey, type ShapeKey,
} from '@/lib/game/data';
import { impact } from '@/lib/game/events';
import { floorPrice, landCost, ledger, money, setupCost, type GameState } from '@/lib/game/state';
import { Threads } from './Threads';

const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];
const rate = (v: number, low: number, high: number) => (v <= low ? 'Low' : v >= high ? 'High' : 'Medium');

function Option({ title, price, sub, on, onClick }: { title: string; price: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button className="opt" aria-pressed={on} onClick={onClick}>
      <span className="opt-top"><b>{title}</b><span className="price">{price}</span></span>
      <small>{sub}</small>
    </button>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fact"><span>{label}</span><b>{children}</b></div>;
}

export function SetupCard({ s, dispatch, onHeight, stampFont }: { s: GameState; dispatch: (a: Action) => void; onHeight: (h: number) => void; stampFont: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const i = setupIndex(s.step);
  const step = SETUP[i];
  const last = i === SETUP.length - 1;
  const go = (d: number) => dispatch({ type: 'step', step: SETUP[i + d].key });
  const cost = setupCost(s);
  const over = cost.left < 0;
  // forecast with every floor finished and no crew yet
  const l = ledger({ ...s, floors: s.floors.map(f => ({ ...f, done: true })), phase: 'play', books: null });
  const imp = impact(s, l);
  const L = LOCS[s.loc];
  const maxStart = Math.min(STARTER.length, FOUNDS[s.found].max);
  const hasHall = s.floors.some(f => f.type === 'hall');

  return (
    <div className="setup" ref={ref}>
      <div className="setup-top">
        <span className="stepno">Step {i + 1} of {SETUP.length}</span>
        <div className="budget">
          <span>{over ? <b className="neg">{money(-cost.left)} over budget</b> : <>Budget <b>{money(cost.left)}</b> / {money(BUDGET)}</>}</span>
          <div className="bbar"><i style={{ transform: `scaleX(${Math.min(1, cost.total / BUDGET)})` }} className={over ? 'neg' : undefined} /></div>
        </div>
      </div>
      <div className="setup-head">
        <h1>{step.title}</h1>
        <p>{step.sub}</p>
      </div>

      <div className="setup-body" key={s.step}>
        {s.step === 'loc' && (
          <>
            <div className="opts four">
              {keys<LocKey>(LOCS).map(k => (
                <Option key={k} title={LOCS[k].short} price={`${money(LOCS[k].land)}/acre`} sub={LOCS[k].note} on={s.loc === k} onClick={() => dispatch({ type: 'loc', loc: k })} />
              ))}
            </div>
            <div className="facts-grid">
              <Fact label="Power cost">{rate(L.power, 65, 80)}</Fact>
              <Fact label="Cooling cost">{rate(L.coolCost, 0.7, 1.2)}</Fact>
              <Fact label="Water use">{rate(L.water, 0.5, 2)}</Fact>
              <Fact label="Taxes">{rate(L.propertyTax, 0.004, 0.011)}</Fact>
              <Fact label="Pollution">{rate(L.carbon, 0.1, 0.35)}</Fact>
            </div>
          </>
        )}
        {s.step === 'found' && (
          <div className="opts four">
            {keys<FoundKey>(FOUNDS).map(k => (
              <Option key={k} title={FOUNDS[k].name} price={money(FOUNDS[k].cost + landCost(s.loc, k))} sub={FOUNDS[k].note}
                on={s.found === k} onClick={() => dispatch({ type: 'found', found: k })} />
            ))}
          </div>
        )}
        {s.step === 'shape' && (
          <div className="opts five">
            {keys<ShapeKey>(SHAPES).map(k => (
              <Option key={k} title={SHAPES[k].name} price={SHAPES[k].cost ? money(SHAPES[k].cost) : 'Free'} sub={SHAPES[k].note} on={s.shape === k} onClick={() => dispatch({ type: 'shape', shape: k })} />
            ))}
          </div>
        )}
        {s.step === 'height' && (
          <div className="stepper">
            <button aria-label="Remove a floor" disabled={s.floors.length <= 2} onClick={() => dispatch({ type: 'height', n: s.floors.length - 1 })}>−</button>
            <ol className="floorlist" reversed>
              {s.floors.map((f, k) => (
                <li key={k}><span>{TYPES[f.type].name}</span><span>{money(floorPrice(s.loc, f.type, k))}</span></li>
              )).reverse()}
            </ol>
            <button aria-label="Add a floor" disabled={s.floors.length >= maxStart} onClick={() => dispatch({ type: 'height', n: s.floors.length + 1 })}>+</button>
          </div>
        )}
        {s.step === 'cust' && (
          <div className="opts four">
            {keys<CustKey>(CUSTS).map(k => (
              <Option key={k} title={CUSTS[k].name} price={`$${CUSTS[k].price}/kW`} sub={CUSTS[k].note} on={s.cust === k} onClick={() => dispatch({ type: 'cust', cust: k })} />
            ))}
          </div>
        )}
        {s.step === 'color' && (
          <div className="paint">
            <div className="layers" role="group" aria-label="Floors">
              {s.floors.map((f, k) => (
                <button key={k} aria-pressed={s.sel === k} onClick={() => dispatch({ type: 'select', floor: k })}>
                  <i style={{ background: f.fill === 'cloth' ? undefined : f.fill }} className={f.fill === 'cloth' ? 'cloth' : ''} />
                  {TYPES[f.type].name}
                </button>
              ))}
            </div>
            <Threads label="Floor color" value={s.floors[s.sel]?.fill ?? 'cloth'} onPick={fill => dispatch({ type: 'fill', fill })} />
            <button className="link" onClick={() => dispatch({ type: 'fillAll', fill: s.floors[s.sel]?.fill ?? 'cloth' })}>Use on every floor</button>
          </div>
        )}
        {s.step === 'name' && (
          <div className="permit">
            <div className="permit-head">
              <b>Building permit</b>
              <span>{L.name}</span>
            </div>
            <label className="permit-field">
              <span>Datacenter name</span>
              <input value={s.look.name} maxLength={24} placeholder="Hillside Compute"
                onChange={e => dispatch({ type: 'name', text: e.target.value })} autoFocus />
            </label>
            <label className="permit-field">
              <span>Your name</span>
              <input value={s.look.owner} maxLength={24} placeholder="Alex Rivera"
                onChange={e => dispatch({ type: 'owner', text: e.target.value })} />
            </label>
            <div className="permit-rows">
              <span>Floors</span><b>{s.floors.length}</b>
              <span>Land</span><b>{FOUNDS[s.found].acres} acres</b>
              <span>Power use</span><b>{l.hallMW.toFixed(1)} MW</b>
              <span>Trees to cut</span><b>{imp.cleared}</b>
              <span>Water a month</span><b>{imp.waterML.toFixed(1)} million litres</b>
            </div>
            {approved && <div className={`stamp ${stampFont}`} aria-live="assertive">Approved</div>}
          </div>
        )}
      </div>

      {s.step !== 'name' && <div className="forecast" aria-label="Forecast">
        <Fact label="Profit/mo">{hasHall && l.eff > 0 ? <span className={l.net < 0 ? 'neg' : undefined}>{money(l.net)}</span> : <span className="neg">$0</span>}</Fact>
        <Fact label="Power">{l.hallMW.toFixed(1)} / {l.powerMW.toFixed(1)} MW</Fact>
        <Fact label="Cooling">{l.hallMW.toFixed(1)} / {l.coolMW.toFixed(1)} MW</Fact>
        <Fact label="Trees cut">{imp.cleared}/{imp.trees}</Fact>
      </div>}
      {(l.eff < 0.999 || !hasHall) && (
        <p className="warn-line">{!hasHall ? 'Add a server hall to earn money.' : `Need more ${l.pe < 1 ? 'power' : 'cooling'}. Halls at ${Math.round(l.eff * 100)}%.`}</p>
      )}

      <div className="setup-foot">
        {i > 0 ? <button className="back" onClick={() => go(-1)}>Back</button> : <span />}
        {over && <span className="foot-note">Over budget. Pick cheaper options.</span>}
        {last
          ? <button className="go" disabled={over || approved || !s.look.name.trim() || !s.look.owner.trim()}
              onClick={() => { setApproved(true); window.setTimeout(() => dispatch({ type: 'open' }), 1200); }}>Submit permit</button>
          : <button className="go" onClick={() => go(1)}>Next</button>}
      </div>
    </div>
  );
}
