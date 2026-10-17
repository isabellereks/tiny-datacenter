'use client';

import { useEffect, useRef } from 'react';
import { setupIndex, type Action } from '@/lib/game/actions';
import { CUSTS, FOUNDS, LOCS, SETUP, SHAPES, STARTER, TYPES, type CustKey, type FoundKey, type LocKey, type ShapeKey } from '@/lib/game/data';
import { impact } from '@/lib/game/events';
import type { GameState } from '@/lib/game/state';
import { Threads } from './Threads';

const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

function Option({ title, sub, on, onClick }: { title: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button className="opt" aria-pressed={on} onClick={onClick}>
      <b>{title}</b>
      {sub && <small>{sub}</small>}
    </button>
  );
}

export function SetupCard({ s, dispatch, onHeight }: { s: GameState; dispatch: (a: Action) => void; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
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
  const imp = impact(s);
  const maxStart = Math.min(STARTER.length, FOUNDS[s.found].max);

  return (
    <div className="setup" ref={ref}>
      <div className="progress" aria-label={`Step ${i + 1} of ${SETUP.length}`}>
        {SETUP.map((x, k) => <i key={x.key} className={k <= i ? 'on' : ''} />)}
      </div>
      <div className="setup-head">
        <h1>{step.title}</h1>
        <p>{step.sub}</p>
      </div>

      <div className="setup-body" key={s.step}>
        {s.step === 'found' && (
          <div className="opts four">
            {keys<FoundKey>(FOUNDS).map(k => (
              <Option key={k} title={FOUNDS[k].name} sub={FOUNDS[k].note} on={s.found === k} onClick={() => dispatch({ type: 'found', found: k })} />
            ))}
          </div>
        )}
        {s.step === 'shape' && (
          <div className="opts five">
            {keys<ShapeKey>(SHAPES).map(k => (
              <Option key={k} title={SHAPES[k].name} sub={SHAPES[k].note} on={s.shape === k} onClick={() => dispatch({ type: 'shape', shape: k })} />
            ))}
          </div>
        )}
        {s.step === 'loc' && (
          <div className="opts four">
            {keys<LocKey>(LOCS).map(k => (
              <Option key={k} title={LOCS[k].short} sub={LOCS[k].note} on={s.loc === k} onClick={() => dispatch({ type: 'loc', loc: k })} />
            ))}
          </div>
        )}
        {s.step === 'height' && (
          <div className="stepper">
            <button aria-label="One floor fewer" disabled={s.floors.length <= 2} onClick={() => dispatch({ type: 'height', n: s.floors.length - 1 })}>−</button>
            <div className="count">
              <b>{s.floors.length}</b>
              <span>floors · {s.floors.map(f => TYPES[f.type].short).join(', ')}</span>
            </div>
            <button aria-label="One floor more" disabled={s.floors.length >= maxStart} onClick={() => dispatch({ type: 'height', n: s.floors.length + 1 })}>+</button>
            <p className="impact-note">{imp.cleared} of {imp.trees} trees cleared for the build</p>
          </div>
        )}
        {s.step === 'color' && (
          <div className="paint">
            <div className="layers" role="group" aria-label="Layers">
              {s.floors.map((f, k) => (
                <button key={k} aria-pressed={s.sel === k} onClick={() => dispatch({ type: 'select', floor: k })}>
                  <i style={{ background: f.fill === 'cloth' ? undefined : f.fill }} className={f.fill === 'cloth' ? 'cloth' : ''} />
                  {k === 0 ? 'Ground' : `Floor ${k}`}
                </button>
              ))}
            </div>
            <Threads label="Layer colour" value={s.floors[s.sel]?.fill ?? 'cloth'} onPick={fill => dispatch({ type: 'fill', fill })} />
            <button className="link" onClick={() => dispatch({ type: 'fillAll', fill: s.floors[s.sel]?.fill ?? 'cloth' })}>Use this colour on every layer</button>
          </div>
        )}
        {s.step === 'cust' && (
          <div className="opts four">
            {keys<CustKey>(CUSTS).map(k => (
              <Option key={k} title={CUSTS[k].name} sub={CUSTS[k].note} on={s.cust === k} onClick={() => dispatch({ type: 'cust', cust: k })} />
            ))}
          </div>
        )}
        {s.step === 'name' && (
          <input className="name" value={s.look.name} maxLength={24} placeholder="e.g. Hillside Compute"
            aria-label="Datacenter name" onChange={e => dispatch({ type: 'name', text: e.target.value })} autoFocus />
        )}
      </div>

      <div className="setup-foot">
        {i > 0 ? <button className="back" onClick={() => go(-1)}>Back</button> : <span />}
        {last
          ? <button className="go" onClick={() => dispatch({ type: 'open' })}>Open for business</button>
          : <button className="go" onClick={() => go(1)}>Next</button>}
      </div>
    </div>
  );
}
