'use client';

import { useEffect, useRef, useState } from 'react';
import type { Action } from '@/lib/game/actions';
import type { GameState } from '@/lib/game/state';
import type { Mode } from '@/lib/nv/sim';

const MODES: { key: Mode; title: string; sub: string }[] = [
  { key: 'choices', title: 'Your choices', sub: 'The real timeline. You design the chips, order the wafers and make the calls. Beat the real NVIDIA, or go broke in 1996.' },
  { key: 'story', title: 'Story', sub: 'Watch it happen the way it did, from the Denny\'s booth to $5 trillion. Every big call is shown as it was made.' },
];

/** April 1993: pick how to play, then start. */
export function NvSetup({ dispatch, onHeight }: { s: GameState; dispatch: (a: Action) => void; onHeight: (h: number) => void }) {
  const [mode, setMode] = useState<Mode>('choices');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => { ro.disconnect(); onHeight(0); };
  }, [onHeight]);
  return (
    <div className="setup" ref={ref}>
      <div className="setup-head">
        <span className="stepno">April 1993, a Denny&apos;s in East San Jose</span>
        <h1>NVIDIA</h1>
        <p>Jensen Huang, Chris Malachowsky and Curtis Priem have $40K and an idea for 3D graphics chips.</p>
      </div>
      <div className="setup-body">
        <div className="opts">
          {MODES.map(m => (
            <button key={m.key} className="opt" aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
              <span className="opt-top"><b>{m.title}</b></span>
              <small>{m.sub}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="setup-foot">
        <span />
        <button className="go" onClick={() => dispatch({ type: 'nvStart', mode })}>Start</button>
      </div>
    </div>
  );
}
