'use client';

import { useState, type ReactNode } from 'react';
import type { Action } from '@/lib/game/actions';
import {
  BUILDABLE, CUSTS, DMC, FILLS, FOUNDS, LOCS, SHAPES, TYPES, nearestDmc,
  type CustKey, type FoundKey, type LocKey, type ShapeKey, type ThreadKey,
} from '@/lib/game/data';
import type { StitchCounts } from '@/lib/game/engine';
import { floorCost, hireCost, money, typeNote, type GameState, type Stats } from '@/lib/game/state';

type Dispatch = (a: Action) => void;
const keys = <K extends string>(o: Record<K, unknown>) => Object.keys(o) as K[];

function Section({ title, open: initial = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="sec">
      <button className="sechead" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {title}
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && <div className="secbody">{children}</div>}
    </section>
  );
}

function Slider({ label, value, min, max, step = 1, display, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; display?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="row"><span>{label}</span><span className="num">{display ?? value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

function Choice({ title, sub, on, onClick, right, disabled }: {
  title: string; sub?: string; on: boolean; onClick: () => void; right?: string; disabled?: boolean;
}) {
  return (
    <button className="choice" aria-pressed={on} onClick={onClick} disabled={disabled}>
      <span className="radio" aria-hidden="true" />
      <span className="t"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right && <span className="r">{right}</span>}
    </button>
  );
}

function Select<K extends string>({ label, value, options, onChange }: {
  label: string; value: K; options: Record<K, { name: string; note: string }>; onChange: (k: K) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value as K)}>
        {keys<K>(options).map(k => <option key={k} value={k}>{options[k].name}</option>)}
      </select>
      <small>{options[value].note}</small>
    </label>
  );
}

const THREAD_LABEL: Record<ThreadKey, string> = { dark: 'Outlines and shadow', light: 'Shading', accent: 'Crew and lights' };

function ThreadKeyList({ s, counts, dispatch }: { s: GameState; counts: StitchCounts | null; dispatch: Dispatch }) {
  const [editing, setEditing] = useState<ThreadKey | null>(null);
  const shown: ThreadKey[] = s.pattern.threadCount === 3 ? ['dark', 'light', 'accent'] : ['dark', 'light'];
  return (
    <>
      {shown.map(k => {
        const hex = s.pattern.threads[k], dmc = nearestDmc(hex), n = counts?.[k] ?? 0;
        return (
          <div key={k} className="thread">
            <button className="swatch" style={{ background: hex }} aria-label={`Recolour ${THREAD_LABEL[k].toLowerCase()} thread`}
              aria-expanded={editing === k} onClick={() => setEditing(editing === k ? null : k)} />
            <span className="t"><b>{hex.toUpperCase()}</b><small>{dmc.exact ? '' : '≈ '}{dmc.name}</small><small>{THREAD_LABEL[k]}</small></span>
            <span className="r"><b>{n.toLocaleString()}</b><small>{Math.max(1, Math.ceil(n / 1600))} skein</small></span>
            {editing === k && (
              <div className="palette">
                {DMC.map(d => (
                  <button key={d.hex} className="pdot" style={{ background: d.hex }} title={d.name} aria-label={d.name}
                    aria-pressed={d.hex === hex} onClick={() => dispatch({ type: 'thread', key: k, hex: d.hex })} />
                ))}
                <label className="pdot custom" title="Custom colour">
                  <input type="color" value={hex} onChange={e => dispatch({ type: 'thread', key: k, hex: e.target.value.toUpperCase() })} aria-label="Custom colour" />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <p className="hint">Click a swatch to recolour that thread.</p>
    </>
  );
}

export function Panel({ s, st, counts, dispatch, armed }: { s: GameState; st: Stats; counts: StitchCounts | null; dispatch: Dispatch; armed: boolean }) {
  const max = FOUNDS[s.found].max, n = s.floors.length, cost = floorCost(s), hire = hireCost(s);
  const f = s.floors[s.sel];
  const techs = s.workers.filter(w => w.floor === s.sel);
  const across = counts?.across ?? s.pattern.across, down = counts?.down ?? Math.round(s.pattern.across * 1.22);

  return (
    <aside className="panel" aria-label="Pattern and build controls">
      <header className="ledger">
        <span className="lbl">tiny datacenter simulator</span>
        <div className="cashrow"><span className="cash">{money(s.cash)}</span><span className="rate">+{money(st.rev)}/s</span></div>
        <div className="meters">
          {([['Power', st.pSup], ['Cooling', st.cSup]] as const).map(([label, sup]) => {
            const r = sup ? st.demand / sup : st.demand ? 2 : 0;
            return (
              <div key={label} className="meter">
                <span>{label}</span>
                <div className={`track${r > 1 ? ' over' : ''}`}><i style={{ width: `${Math.min(100, r * 100)}%` }} /></div>
                <span className="num">{st.demand.toFixed(1)}/{sup.toFixed(1)} MW</span>
              </div>
            );
          })}
        </div>
        {st.eff < 0.999 && <p className="warn">Halls slowed to {Math.round(st.eff * 100)}%. Add a {st.pe < 1 ? 'power' : 'cooling'} floor.</p>}
      </header>

      <Section title="Build" open>
        <p className="cap">Floor {n} of {max}</p>
        <div className="choices">
          {BUILDABLE.map(t => (
            <Choice key={t} title={TYPES[t].name} sub={typeNote(s, t)} on={s.next === t} onClick={() => dispatch({ type: 'next', floor: t })} />
          ))}
        </div>
        <button className="primary" disabled={!!s.build || n >= max || s.cash < cost} onClick={() => dispatch({ type: 'build' })}>
          Stitch floor {n} · {money(cost)}
        </button>
        {s.build ? <p className="hint">Stitching the new floor…</p>
          : n >= max ? <p className="hint">{FOUNDS[s.found].name} holds {max} floors. Pour a stronger foundation to go higher.</p> : null}

        {f && (
          <div className="selected">
            <p className="cap">Selected: floor {s.sel} · {TYPES[f.type].name}</p>
            <div className="seg" role="group" aria-label="Wall fill">
              {FILLS.map(x => <button key={x.role} aria-pressed={f.fill === x.role} onClick={() => dispatch({ type: 'fill', role: x.role })}>{x.name}</button>)}
            </div>
            {f.type === 'hall' ? (
              <div className="hire">
                <span>{techs.length ? techs.map(w => w.name).join(', ') : 'No techs yet'} · {techs.length}/3</span>
                <button className="ghost" disabled={techs.length >= 3 || !f.done || s.cash < hire} onClick={() => dispatch({ type: 'hire' })}>Hire · {money(hire)}</button>
              </div>
            ) : (
              <p className="hint">{f.type === 'lobby' ? 'Tours bring in $2/s. ' : ''}Techs work on server halls. Click a floor on the fabric to select it.</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Site">
        <Select<LocKey> label="Location" value={s.loc} options={LOCS} onChange={loc => dispatch({ type: 'loc', loc })} />
        <Select<CustKey> label="Who you serve" value={s.cust} options={CUSTS} onChange={cust => dispatch({ type: 'cust', cust })} />
      </Section>

      <Section title="Foundation">
        <div className="choices">
          {keys<FoundKey>(FOUNDS).map(k => {
            const v = FOUNDS[k], cur = s.found === k;
            return (
              <Choice key={k} title={v.name} sub={v.note} on={cur} right={cur ? 'Poured' : v.cost ? money(v.cost) : 'Free'}
                disabled={!cur && (n > v.max || !!s.build || s.cash < v.cost)} onClick={() => dispatch({ type: 'found', found: k })} />
            );
          })}
        </div>
        <button className="ghost wide" onClick={() => dispatch({ type: 'pick', on: !s.picking })}>
          {s.picking ? 'Back to the building' : 'Choose on the fabric'}
        </button>
      </Section>

      <Section title="Shape">
        <div className="choices">
          {keys<ShapeKey>(SHAPES).map(k => (
            <Choice key={k} title={SHAPES[k].name} sub={SHAPES[k].note} on={s.shape === k} onClick={() => dispatch({ type: 'shape', shape: k })} />
          ))}
        </div>
      </Section>

      <Section title="Crew">
        {s.workers.length ? (
          <ul className="crew">
            {[...s.workers].sort((a, b) => b.floor - a.floor).map(w => (
              <li key={w.id}><button onClick={() => dispatch({ type: 'select', floor: w.floor })}><b>{w.name}</b><span>Floor {w.floor}</span></button></li>
            ))}
          </ul>
        ) : <p className="hint">Nobody yet. Select a server hall to hire.</p>}
        <ul className="log">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <button className={`ghost wide danger${armed ? ' armed' : ''}`} onClick={() => dispatch({ type: 'reset' })}>
          {armed ? 'Click again to unpick everything' : 'Start a new datacenter'}
        </button>
      </Section>

      <Section title="Pattern" open>
        <Slider label="Stitches across" value={s.pattern.across} min={60} max={170} onChange={v => dispatch({ type: 'across', n: v })} />
        <Slider label="Thread colours" value={s.pattern.threadCount} min={2} max={3} onChange={v => dispatch({ type: 'threadCount', n: v === 2 ? 2 : 3 })} />
        <label className="check">
          <input type="checkbox" checked={s.pattern.leaveWhite} onChange={e => dispatch({ type: 'leaveWhite', on: e.target.checked })} />
          Leave white areas unstitched
        </label>
      </Section>

      <Section title="Lettering">
        <label className="field">
          <span>Stitched text</span>
          <textarea rows={2} value={s.pattern.lettering} maxLength={60} onChange={e => dispatch({ type: 'lettering', text: e.target.value })} />
        </label>
      </Section>

      <Section title="Thread key" open>
        <ThreadKeyList s={s} counts={counts} dispatch={dispatch} />
        <div className="facts">
          <div><span>Grid</span><b>{across} × {down}</b></div>
          <div><span>Stitches</span><b>{(counts?.total ?? 0).toLocaleString()}</b></div>
          <div><span>Size on 14ct</span><b>{(across / 14).toFixed(1)}″ × {(down / 14).toFixed(1)}″</b></div>
          <div><span>In cm</span><b>{(across / 14 * 2.54).toFixed(1)} × {(down / 14 * 2.54).toFixed(1)}</b></div>
        </div>
      </Section>
    </aside>
  );
}
