'use client';

import { useEffect, useRef } from 'react';
import { TYPES } from '@/lib/game/data';
import type { GameState } from '@/lib/game/state';

/** Long waits as countdowns over the roof: builds, the grid queue, the reactor, a broker. */
export function Timers({ s, roof }: { s: GameState; roof: () => { x: number; y: number } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  // follow the roof as the camera moves
  useEffect(() => {
    let id = 0;
    const tick = () => {
      const el = ref.current, at = roof();
      if (el) {
        el.style.visibility = at ? 'visible' : 'hidden';
        if (at) el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 34)}px) translate(-50%, -100%)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [roof]);

  const mo = (to: number) => `${Math.max(1, Math.ceil(to - s.month))} mo`;
  const items: { key: string; text: string }[] = [];
  for (const j of s.jobs ?? []) {
    const f = s.floors[j.idx];
    if (f) items.push({ key: `j${j.idx}`, text: `${j.what === 'refit' ? 'Refit' : TYPES[f.type].name} ${j.from > s.month ? 'queued, ' : ''}${mo(j.to)}` });
  }
  if (s.gridQueue) items.push({ key: 'grid', text: `Grid +${s.gridQueue.mw} MW ${mo(s.gridQueue.done)}` });
  if (s.smrAt && s.smrAt > s.month) items.push({ key: 'smr', text: `Reactor ${mo(s.smrAt)}` });
  if (s.pitch) items.push({ key: 'pitch', text: `Broker ${mo(s.pitch.due)}` });
  if (!items.length) return null;
  return (
    <div className="timers" ref={ref} aria-label="Countdowns">
      {items.map(i => <span key={i.key}>{i.text}</span>)}
    </div>
  );
}
