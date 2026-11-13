'use client';

import { useEffect } from 'react';
import type { Action } from '@/lib/game/actions';
import type { GameState } from '@/lib/game/state';
import { GENS, dateOf } from '@/lib/nv/history';
import { sfx } from '@/lib/game/sound';

/** A chip launch, keynote style: a dark stage, the name in green, one line on what it does. */
export function NvReveal({ s, dispatch, font }: { s: GameState; dispatch: (a: Action) => void; font: string }) {
  const r = s.nv?.reveal;
  useEffect(() => {
    if (!r) return;
    sfx('tier');
    const id = window.setTimeout(() => dispatch({ type: 'nvRevealSeen' }), 3800);
    return () => window.clearTimeout(id);
  }, [r, dispatch]);
  if (!r) return null;
  const g = GENS[r.gen];
  return (
    <button className="reveal" onClick={() => dispatch({ type: 'nvRevealSeen' })} aria-label={`${g.name} launched`}>
      <span className="reveal-tag">{dateOf(s.month)} · Keynote</span>
      <b className={font}>{g.name}</b>
      <span className="reveal-what">{g.what}</span>
    </button>
  );
}
