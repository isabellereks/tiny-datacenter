'use client';

import { Silkscreen } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type Action } from '@/lib/game/actions';
import { LOCS } from '@/lib/game/data';
import { Engine } from '@/lib/game/engine';
import { impact } from '@/lib/game/events';
import { load, save, stats, type GameState } from '@/lib/game/state';
import { Island, type Tab } from './Island';
import { SetupCard } from './SetupCard';

const pixel = Silkscreen({ weight: '400', subsets: ['latin'] });
const ISLAND_SPACE = 76;

export default function Game() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const armedRef = useRef(false);
  const lastLog = useRef<string | undefined>(undefined);
  const activityTimer = useRef<number | undefined>(undefined);
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('build');
  const [activity, setActivity] = useState<string | null>(null);
  const [cardH, setCardH] = useState(260);
  const redraw = useCallback(() => setTick(t => t + 1), []);

  /** New log lines briefly pop the island, like a live activity. */
  const announce = useCallback(() => {
    const line = stateRef.current?.log[0];
    if (line && line !== lastLog.current) {
      lastLog.current = line;
      setActivity(line);
      window.clearTimeout(activityTimer.current);
      activityTimer.current = window.setTimeout(() => setActivity(null), 2800);
    }
  }, []);

  const dispatch = useCallback((a: Action) => {
    const s = stateRef.current;
    if (!s) return;
    if (a.type === 'reset' && !armedRef.current) { armedRef.current = true; redraw(); return; }
    armedRef.current = false;

    const fx = apply(s, a);
    if (fx.replace) {
      stateRef.current = fx.replace;
      lastLog.current = undefined;
      setOpen(false);
    }
    const engine = engineRef.current;
    if (engine) {
      if (fx.layout) engine.layout();
      if (fx.rebuild) engine.rebuild();
      if (fx.home) engine.resetView();
      else if (fx.refit) engine.fit(true);
    }
    if (a.type === 'open') setOpen(false);
    announce();
    save(stateRef.current!);
    redraw();
  }, [redraw, announce]);

  useEffect(() => {
    stateRef.current = load();
    lastLog.current = stateRef.current.log[0];
    const engine = new Engine(hostRef.current!, {
      state: () => stateRef.current!,
      onChange: () => { announce(); save(stateRef.current!); redraw(); },
      onPickFloor: floor => {
        dispatch({ type: 'select', floor });
        if (stateRef.current?.phase === 'play') { setOpen(true); setTab('floor'); }
      },
      onPickFoundation: found => dispatch({ type: 'found', found }),
      onFirstInteraction: () => {
        const s = stateRef.current;
        if (s?.phase === 'play' && s.spin) { s.spin = false; redraw(); }
      },
      onSave: () => save(stateRef.current!),
    }, pixel.style.fontFamily);
    engineRef.current = engine;
    redraw();
    const id = window.setInterval(redraw, 250);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
      save(stateRef.current!);
      engine.dispose();
      engineRef.current = null;
    };
  }, [dispatch, redraw, announce]);

  const s = stateRef.current;
  const setup = s?.phase === 'setup';

  useEffect(() => {
    engineRef.current?.setInsets(ISLAND_SPACE, setup ? cardH + 24 : 16);
  }, [setup, cardH, s]);

  const imp = s ? impact(s) : null;
  return (
    <main className="app">
      <div className="stage" ref={hostRef} />
      {s && imp && (setup ? (
        <>
          <div className="island compact planning" aria-live="polite">
            <div className="island-in">
              <span className="compact static">
                <span className="day">Planning</span>
                <span className="muted">{LOCS[s.loc].short}</span>
                <span className="trees">{imp.cleared ? `${imp.cleared} trees cleared` : 'No trees cut yet'}</span>
              </span>
            </div>
          </div>
          <SetupCard s={s} dispatch={dispatch} onHeight={setCardH} />
        </>
      ) : (
        <Island
          s={s} st={stats(s)} imp={imp} open={open} tab={tab} activity={activity} armed={armedRef.current}
          dispatch={dispatch} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} onTab={setTab}
          onResetView={() => engineRef.current?.resetView()}
        />
      ))}
    </main>
  );
}
