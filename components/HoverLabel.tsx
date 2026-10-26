'use client';

import { useEffect, useState } from 'react';
import { FOUNDS, TYPES, type FoundKey } from '@/lib/game/data';
import { floorLabel, hallIncome, isBroken, landCost, ledger, money, techsOn, utilization, type GameState } from '@/lib/game/state';

/** What the pointer is over: a title and a line of plain facts. */
function describe(s: GameState, what: { found?: FoundKey; floor?: number }): [string, string] | null {
  if (what.found) {
    const F = FOUNDS[what.found];
    return [F.name, `${F.max} floors · ${F.acres} acres · ${money(F.cost + landCost(s.loc, what.found))}`];
  }
  if (what.floor == null || !s.floors[what.floor]) return null;
  const i = what.floor, f = s.floors[i];
  const title = `${floorLabel(s, i)} · ${TYPES[f.type].name}`;
  if (!f.done) return [title, 'Under construction'];
  if (isBroken(s, i)) return [title, techsOn(s, i) ? 'Down · techs repairing' : 'Down · tap to send a crew'];
  if (f.type !== 'hall') return [title, `Built for ${money(f.cost)}`];
  const n = techsOn(s, i);
  if (!n) return [title, 'Off · needs a tech'];
  return [title, `${n} ${n === 1 ? 'tech' : 'techs'} · ${Math.round(utilization(s, i) * 100)}% in use · ${money(hallIncome(s, ledger(s), i))}/mo`];
}

/** A callout with a thin leader line from the pointer, like a label on a map. */
export function HoverLabel({ s, what }: { s: GameState; what: { found?: FoundKey; floor?: number } }) {
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => setP({ x: e.clientX, y: e.clientY });
    addEventListener('pointermove', move);
    return () => removeEventListener('pointermove', move);
  }, []);
  const d = describe(s, what);
  if (!d || !p) return null;
  // the label sits up and to the right, or to the left near the edge
  const left = p.x > innerWidth - 300;
  return (
    <div className="callout" role="status" style={{ left: p.x, top: p.y }}>
      <svg className="callout-line" width="60" height="50" viewBox="-30 -50 60 50" style={{ transform: `translate(-30px, -50px)${left ? ' scaleX(-1)' : ''}` }} aria-hidden="true">
        <path d="M0 0 L14 -36 L30 -36" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="-2.5" y="-2.5" width="5" height="5" fill="currentColor" />
      </svg>
      <div className={`callout-text${left ? ' left' : ''}`} style={left ? { right: 34, top: -54 } : { left: 34, top: -54 }}>
        <b>{d[0]}</b>
        <span>{d[1]}</span>
      </div>
    </div>
  );
}
