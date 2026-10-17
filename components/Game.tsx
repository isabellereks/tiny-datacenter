'use client';

import { Silkscreen } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type Action } from '@/lib/game/actions';
import { Engine, type StitchCounts } from '@/lib/game/engine';
import { load, save, stats, type GameState } from '@/lib/game/state';
import { Panel } from './Panel';

const pixel = Silkscreen({ weight: '400', subsets: ['latin'] });

export default function Game() {
  const hostRef = useRef<HTMLDivElement>(null);
  const hoopRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const armedRef = useRef(false);
  const [, setTick] = useState(0);
  const [counts, setCounts] = useState<StitchCounts | null>(null);
  const [touched, setTouched] = useState(false);
  const redraw = useCallback(() => setTick(t => t + 1), []);

  const dispatch = useCallback((a: Action) => {
    const s = stateRef.current;
    if (!s) return;
    if (a.type === 'reset' && !armedRef.current) { armedRef.current = true; redraw(); return; }
    armedRef.current = false;

    const fx = apply(s, a);
    if (fx.replace) stateRef.current = fx.replace;
    const engine = engineRef.current;
    if (engine) {
      if (fx.rebuild) engine.rebuild();
      if (fx.pattern) engine.layout();
      if (fx.refit) engine.fit(true);
    }
    save(stateRef.current!);
    redraw();
  }, [redraw]);

  useEffect(() => {
    stateRef.current = load();
    const engine = new Engine(hostRef.current!, hoopRef.current!, labelsRef.current!, {
      state: () => stateRef.current!,
      onChange: () => { save(stateRef.current!); redraw(); },
      onCounts: setCounts,
      onPickFloor: floor => dispatch({ type: 'select', floor }),
      onPickFoundation: found => dispatch({ type: 'found', found }),
      onFirstInteraction: () => setTouched(true),
      onSave: () => save(stateRef.current!),
    }, pixel.style.fontFamily);
    engineRef.current = engine;
    redraw();
    const id = window.setInterval(redraw, 250);
    return () => {
      window.clearInterval(id);
      save(stateRef.current!);
      engine.dispose();
      engineRef.current = null;
    };
  }, [dispatch, redraw]);

  const s = stateRef.current;
  return (
    <main className="app">
      <div className="fabric" ref={hostRef}>
        <div className="hoop" ref={hoopRef}>
          <div className="labels" ref={labelsRef} />
        </div>
        {s && (
          <div className="toolbar" role="toolbar" aria-label="View">
            <button aria-pressed={s.spin} onClick={() => dispatch({ type: 'spin', on: !s.spin })}>Spin</button>
            <button aria-pressed={s.smoke} onClick={() => dispatch({ type: 'smoke', on: !s.smoke })}>Smoke</button>
            <button aria-pressed={s.inside} onClick={() => dispatch({ type: 'inside', inside: !s.inside })}>Inside</button>
            {s.picking
              ? <button onClick={() => dispatch({ type: 'pick', on: false })}>Done</button>
              : <button onClick={() => engineRef.current?.resetView()}>Reset view</button>}
            <span className={touched && !s.picking ? 'gone' : ''}>
              {s.picking ? 'Click a foundation to pour it' : 'Drag to turn the factory · up and down to tilt'}
            </span>
          </div>
        )}
      </div>
      {s && <Panel s={s} st={stats(s)} counts={counts} dispatch={dispatch} armed={armedRef.current} />}
    </main>
  );
}
