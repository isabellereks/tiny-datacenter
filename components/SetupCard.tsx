'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { setupIndex, type Action } from '@/lib/game/actions';
import {
  BUDGET, CUSTS, FOUNDS, SETUP_FOUNDS, LOCS, SETUP, SHAPES, STARTER, TYPES,
  type CustKey, type LocKey, type ShapeKey,
} from '@/lib/game/data';
import { impact } from '@/lib/game/events';
import { floorPrice, landCost, ledger, money, setupCost, type GameState } from '@/lib/game/state';
import { Cash } from './Num';
import { Threads } from './Threads';

const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];
/** Low, medium or high, as a word and as 1 to 3 pips. */
const rate = (v: number, low: number, high: number) => (v <= low ? 1 : v >= high ? 3 : 2);
const WORD = ['', 'Low', 'Medium', 'High'];

/** One line of a place's spec sheet: a label, a value, and pips that are green when lower is better. */
function Spec({ label, level, value }: { label: string; level?: number; value?: ReactNode }) {
  return (
    <div className="spec-row">
      <span>{label}</span>
      {level ? (
        <b className={`pips l${level}`} aria-label={WORD[level]}>
          {[1, 2, 3].map(k => <i key={k} className={k <= level ? 'on' : ''} />)}
          <em>{WORD[level]}</em>
        </b>
      ) : <b>{value}</b>}
    </div>
  );
}

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
  // what a place is like shows once you've tapped it
  const [looked, setLooked] = useState(false);
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
  // forecast with every floor finished and one tech per hall, since halls can't run without one
  const crew = s.floors.flatMap((f, k) => (f.type === 'hall' ? [{ id: -k, name: '', floor: k, x: 0, dir: 1 as const, speed: 0, pause: 0 }] : []));
  const l = ledger({ ...s, floors: s.floors.map(f => ({ ...f, done: true })), workers: crew, phase: 'play', books: null });
  const imp = impact(s, l);
  const L = LOCS[s.loc];
  const maxStart = Math.min(STARTER.length, FOUNDS[s.found].max);
  const hasHall = s.floors.some(f => f.type === 'hall');

  return (
    <div className="setup" ref={ref}>
      <div className="setup-top">
        <span className="stepno">Step {i + 1} of {SETUP.length}</span>
        <div className="budget">
          <span>{over ? <b className="neg">{money(-cost.left)} over budget</b> : <>Budget <b><Cash value={cost.left} /></b> / {money(BUDGET)}</>}</span>
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
                <Option key={k} title={LOCS[k].short} price={`${money(LOCS[k].land)}/acre`} sub="" on={looked && s.loc === k} onClick={() => { setLooked(true); dispatch({ type: 'loc', loc: k }); }} />
              ))}
            </div>
            {looked && <div className="spec">
              <div className="spec-head"><b>{L.name}</b><span>{L.note}</span></div>
              <div className="spec-cols">
                <div>
                  <Spec label="Power cost" level={rate(L.power, 65, 80)} />
                  <Spec label="Cooling cost" level={rate(L.coolCost, 0.7, 1.2)} />
                  <Spec label="Water use" level={rate(L.water, 0.5, 2)} />
                  <Spec label="Taxes" level={rate(L.propertyTax, 0.004, 0.011)} />
                  <Spec label="Pollution" level={rate(L.carbon, 0.1, 0.35)} />
                </div>
                <div>
                  <Spec label="Town grid" value={`${L.grid} MW`} />
                  <Spec label="Wait for more grid" value={`${L.queue} months`} />
                  <Spec label="Room for" value={`${L.space.buildings} ${L.space.buildings === 1 ? 'building' : 'buildings'}`} />
                  <Spec label="Height to start" value={`${L.space.heights[0]} floors`} />
                  <Spec label="Permits" value={L.space.permitSpeed <= 0.7 ? 'Fast' : L.space.permitSpeed >= 1.3 ? 'Slow' : 'Normal'} />
                </div>
              </div>
            </div>}
          </>
        )}
        {s.step === 'found' && (
          <div className="opts four">
            {SETUP_FOUNDS.map(k => (
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
            <div className="permit-fields">
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
            </div>
            <div className="permit-rows">
              <div><span>Floors</span><b>{s.floors.length}</b></div>
              <div><span>Land</span><b>{FOUNDS[s.found].acres} acres</b></div>
              <div><span>Power</span><b>{l.hallMW.toFixed(1)} MW</b></div>
              <div><span>Trees cut</span><b>{imp.cleared}</b></div>
              <div><span>Water/mo</span><b>{imp.waterML.toFixed(1)} ML</b></div>
            </div>
            {approved && <div className={`stamp ${stampFont}`} aria-live="assertive">Approved</div>}
          </div>
        )}
      </div>

      {s.step !== 'name' && s.step !== 'loc' && <div className="forecast" aria-label="Forecast">
        <Fact label="Build cost">{money(cost.floors + cost.found + cost.shape)}</Fact>
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
