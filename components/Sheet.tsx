import type { CSSProperties, ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, CUSTS, FOUNDS, INKS, LOCS, SHAPES, STITCH, TYPES, WALLS,
  type CustKey, type FoundKey, type InkKey, type LocKey, type ShapeKey, type StitchKey,
} from '@/lib/game/data';
import { floorCost, hireCost, money, typeNote, type GameState, type Worker } from '@/lib/game/state';

type Dispatch = (a: Action) => void;
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Chevron = () => (
  <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
    <path d="M1.5 1.5l5 5-5 5" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Item({ title, sub, on, onClick, lead, right, disabled }: {
  title: string; sub?: string; on: boolean; onClick: () => void; lead?: ReactNode; right?: string; disabled?: boolean;
}) {
  return (
    <button className="item" aria-pressed={on} onClick={onClick} disabled={disabled}>
      {lead}
      <span className="t"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right && <span className="r">{right}</span>}
      <span className="ck">{on && <Check />}</span>
    </button>
  );
}

export const Figure = ({ w }: { w: Worker }) => (
  <span className="fig" style={{ '--h': w.hair, '--s': w.skin, '--t': w.shirt } as CSSProperties} />
);

function Head({ title, lede }: { title: string; lede: string }) {
  return <div><h2>{title}</h2><p className="lede">{lede}</p></div>;
}

function Site({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  return (
    <>
      <Head title="Site" lede="Where you build sets your power and cooling. Who you serve sets what each rack earns." />
      <div className="group">
        <h3>Location</h3>
        <div className="list">
          {keys<LocKey>(LOCS).map(k => (
            <Item key={k} title={LOCS[k].name} sub={LOCS[k].note} on={s.loc === k} onClick={() => dispatch({ type: 'loc', loc: k })} />
          ))}
        </div>
      </div>
      <div className="group">
        <h3>Who you serve</h3>
        <div className="list">
          {keys<CustKey>(CUSTS).map(k => (
            <Item key={k} title={CUSTS[k].name} sub={CUSTS[k].note} on={s.cust === k} onClick={() => dispatch({ type: 'cust', cust: k })} />
          ))}
        </div>
      </div>
    </>
  );
}

function Foundation({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  return (
    <>
      <Head title="Foundation" lede="Tap a foundation in the scene to pour it. It decides how tall your datacenter can get." />
      <div className="group">
        <div className="list">
          {keys<FoundKey>(FOUNDS).map(k => {
            const v = FOUNDS[k], cur = s.found === k, tooTall = s.floors.length > v.max;
            return (
              <Item
                key={k} title={v.name} on={cur}
                sub={v.note + (tooTall ? ' · too short for your building' : '')}
                right={cur ? 'Poured' : v.cost ? money(v.cost) : 'Free'}
                disabled={!cur && (tooTall || !!s.build || s.cash < v.cost)}
                onClick={() => dispatch({ type: 'found', found: k })}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

function Shape({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  return (
    <>
      <Head title="Shape" lede="The silhouette and the threads it is stitched in." />
      <div className="group">
        <h3>Building</h3>
        <div className="list">
          {keys<ShapeKey>(SHAPES).map(k => (
            <Item key={k} title={SHAPES[k].name} sub={SHAPES[k].note} on={s.shape === k} onClick={() => dispatch({ type: 'shape', shape: k })} />
          ))}
        </div>
      </div>
      <div className="group">
        <h3>Outline thread</h3>
        <div className="dots">
          {keys<InkKey>(INKS).map(k => (
            <button key={k} className="dot" style={{ background: INKS[k].hex }} aria-label={INKS[k].name} title={INKS[k].name}
              aria-pressed={s.ink === k} onClick={() => dispatch({ type: 'ink', ink: k })} />
          ))}
        </div>
      </div>
      <div className="group">
        <h3>Stitch size</h3>
        <div className="seg" role="group">
          {keys<StitchKey>(STITCH).map(k => (
            <button key={k} aria-pressed={s.stitch === k} onClick={() => dispatch({ type: 'stitch', stitch: k })}>{STITCH[k].label}</button>
          ))}
        </div>
      </div>
    </>
  );
}

function Floors({ s, dispatch }: { s: GameState; dispatch: Dispatch }) {
  const max = FOUNDS[s.found].max, n = s.floors.length, cost = floorCost(s);
  const why = s.build ? 'Stitching the new floor…'
    : n >= max ? `${FOUNDS[s.found].name} holds ${max} floors. Pour a stronger foundation to go higher.` : '';
  const f = s.floors[s.sel];
  const techs = s.workers.filter(w => w.floor === s.sel);
  const hire = hireCost(s);
  return (
    <>
      <Head title="Floors" lede={`${n} of ${max} floors. Each new floor is stitched on top.`} />
      <div className="group">
        <h3>Next floor</h3>
        <div className="list">
          {BUILDABLE.map(t => (
            <Item key={t} title={TYPES[t].name} sub={typeNote(s, t)} on={s.next === t}
              lead={<span className="sq" style={{ background: TYPES[t].swatch }} />}
              onClick={() => dispatch({ type: 'next', floor: t })} />
          ))}
        </div>
      </div>
      <div className="group">
        <button className="primary" disabled={!!s.build || n >= max || s.cash < cost} onClick={() => dispatch({ type: 'build' })}>
          Build floor {n} · {money(cost)}
        </button>
        {why && <p className="foot">{why}</p>}
      </div>
      {f && (
        <div className="group">
          <h3>Floor {s.sel} · {TYPES[f.type].name}</h3>
          <div className="dots">
            {WALLS.map(c => (
              <button key={c.hex} className="dot" style={{ background: c.hex }} aria-label={`${c.name} walls`} title={c.name}
                aria-pressed={f.color === c.hex} onClick={() => dispatch({ type: 'color', hex: c.hex })} />
            ))}
          </div>
          {f.type === 'hall' ? (
            <>
              <div className="crewrow">
                {techs.length
                  ? techs.map(w => <span key={w.id} className="who"><Figure w={w} />{w.name}</span>)
                  : <span className="who muted">No techs yet</span>}
                <span className="spacer" />
                <button className="tinted" disabled={techs.length >= 3 || !f.done || s.cash < hire} onClick={() => dispatch({ type: 'hire' })}>
                  Hire · {money(hire)}
                </button>
              </div>
              <p className="foot">{techs.length}/3 techs. Racks run at a crawl without them.</p>
            </>
          ) : (
            <p className="foot">
              {f.type === 'lobby' ? 'Tours bring in $2/s.' : 'Techs work on server halls only.'} Tap any floor in the scene to select it.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Crew({ s, dispatch, armed }: { s: GameState; dispatch: Dispatch; armed: boolean }) {
  const crew = [...s.workers].sort((a, b) => b.floor - a.floor);
  return (
    <>
      <Head title="Crew" lede="Each server hall runs best with three techs. Power and cooling have to cover every hall, or they all slow down together." />
      <div className="group">
        <h3>{s.workers.length} on staff</h3>
        {crew.length ? (
          <div className="list">
            {crew.map(w => (
              <button key={w.id} className="item" onClick={() => dispatch({ type: 'select', floor: w.floor })}>
                <Figure w={w} />
                <span className="t"><b>{w.name}</b><small>Floor {w.floor} · {TYPES[s.floors[w.floor].type].name}</small></span>
                <Chevron />
              </button>
            ))}
          </div>
        ) : <p className="foot">Nobody yet. Select a server hall on Floors to hire.</p>}
      </div>
      <div className="group">
        <h3>Recent</h3>
        <ul className="log">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      <button className={`danger${armed ? ' armed' : ''}`} onClick={() => dispatch({ type: 'reset' })}>
        {armed ? 'Tap again to start over' : 'Start a new datacenter'}
      </button>
    </>
  );
}

export function Sheet({ s, dispatch, armed }: { s: GameState; dispatch: Dispatch; armed: boolean }) {
  return (
    <aside className="sheet glass" aria-label="Builder">
      {s.step === 'site' && <Site s={s} dispatch={dispatch} />}
      {s.step === 'found' && <Foundation s={s} dispatch={dispatch} />}
      {s.step === 'shape' && <Shape s={s} dispatch={dispatch} />}
      {s.step === 'floors' && <Floors s={s} dispatch={dispatch} />}
      {s.step === 'crew' && <Crew s={s} dispatch={dispatch} armed={armed} />}
    </aside>
  );
}
