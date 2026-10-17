'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type Action } from '@/lib/game/actions';
import { STEPS } from '@/lib/game/data';
import { Engine } from '@/lib/game/engine';
import { load, save, stats, type GameState } from '@/lib/game/state';
import { Hud } from './Hud';
import { Sheet } from './Sheet';

export default function Game() {
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const armedRef = useRef(false);
  const [, setTick] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [hint, setHint] = useState(true);
  const redraw = useCallback(() => setTick(t => t + 1), []);

  const dispatch = useCallback((a: Action) => {
    const s = stateRef.current;
    if (!s) return;
    if (a.type === 'step' && s.step === a.step) { setSheetOpen(o => !o); return; }
    if (a.type === 'reset' && !armedRef.current) { armedRef.current = true; redraw(); return; }
    armedRef.current = false;

    const fx = apply(s, a);
    if (fx.replace) stateRef.current = fx.replace;
    const engine = engineRef.current;
    if (engine) {
      if (fx.resize) engine.resize();
      if (fx.rebuild) engine.rebuild();
      engine.setInk();
      if (fx.frame) engine.frameView(fx.frame === 'keep');
    }
    if (a.type === 'step' || a.type === 'select') setSheetOpen(true);
    save(stateRef.current!);
    redraw();
  }, [redraw]);

  useEffect(() => {
    stateRef.current = load();
    const engine = new Engine(stageRef.current!, labelsRef.current!, {
      state: () => stateRef.current!,
      onChange: () => { save(stateRef.current!); redraw(); },
      onPickFloor: floor => dispatch({ type: 'select', floor }),
      onPickFoundation: found => dispatch({ type: 'found', found }),
      onFirstInteraction: () => setHint(false),
    }, () => save(stateRef.current!));
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
    <>
      <div id="stage" ref={stageRef} />
      <div id="labels" ref={labelsRef} />
      {s && (
        <>
          <Hud s={s} st={stats(s)} dispatch={dispatch} onResetView={() => engineRef.current?.frameView(false)} />
          {sheetOpen && <Sheet s={s} dispatch={dispatch} armed={armedRef.current} />}
          <nav className="nav glass" role="tablist" aria-label="Build steps">
            {STEPS.map(({ key, label }) => (
              <button key={key} role="tab" aria-selected={s.step === key} onClick={() => dispatch({ type: 'step', step: key })}>
                {label}
              </button>
            ))}
          </nav>
          <div className={`hint glass${hint ? '' : ' gone'}`}>Drag to rotate · Scroll to zoom · Right-drag to pan</div>
        </>
      )}
    </>
  );
}
