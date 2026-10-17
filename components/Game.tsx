'use client';

import { Pixelify_Sans, Silkscreen } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type Action } from '@/lib/game/actions';
import { Engine } from '@/lib/game/engine';
import { impact } from '@/lib/game/events';
import { isBroken, ledger, load, save, type GameState } from '@/lib/game/state';
import { EndCard } from './EndCard';
import { GoalCard } from './GoalCard';
import { Island, type Tab } from './Island';
import { News, storyFor, type Story } from './News';
import { SetupCard } from './SetupCard';

const pixel = Silkscreen({ weight: '400', subsets: ['latin'] });
/** UI text: a pixel face that stays readable at small sizes. */
const ui = Pixelify_Sans({ subsets: ['latin'], variable: '--pixel' });
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
  const [goalH, setGoalH] = useState(0);
  const [flash, setFlash] = useState<Story | null>(null);
  const lastComplaint = useRef<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const redraw = useCallback(() => setTick(t => t + 1), []);

  /** New log lines briefly pop the island, like a live activity. */
  const announce = useCallback(() => {
    const line = stateRef.current?.log[0];
    if (line && line !== lastLog.current) {
      lastLog.current = line;
      setActivity(line);
      window.clearTimeout(activityTimer.current);
      activityTimer.current = window.setTimeout(() => setActivity(null), 3200);
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
        const s = stateRef.current;
        if (!s || s.phase === 'over') return;
        if (s.phase === 'play' && isBroken(s, floor)) { dispatch({ type: 'repair', floor }); return; }
        dispatch({ type: 'select', floor });
        if (s.phase === 'play') { setOpen(true); setTab('floor'); }
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
  const phase = s?.phase;
  const ended = phase === 'over' && !!s?.over?.done;

  useEffect(() => {
    const bottom = phase === 'setup' || ended ? cardH + 24 : phase === 'play' && goalH ? goalH + 24 : 16;
    engineRef.current?.setInsets(phase === 'setup' ? 24 : ISLAND_SPACE, bottom);
  }, [phase, ended, cardH, goalH]);

  // complaints that make the news get a short broadcast
  const complaintNow = s?.complaint ?? null;
  useEffect(() => {
    const st = stateRef.current;
    if (!st || complaintNow === lastComplaint.current) return;
    lastComplaint.current = complaintNow;
    if (complaintNow === 'protest' || complaintNow === 'carbon') {
      setFlash(storyFor(st, complaintNow));
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 7000);
    }
  }, [complaintNow]);

  const startOver = useCallback(() => { armedRef.current = true; dispatch({ type: 'reset' }); }, [dispatch]);

  if (!s) return <main className={`app ${ui.variable}`}><div className="stage" ref={hostRef} /></main>;
  const l = ledger(s);
  const imp = impact(s, l);
  return (
    <main className={`app ${ui.variable}`}>
      <div className="stage" ref={hostRef} />
      {phase === 'setup' && <SetupCard s={s} dispatch={dispatch} onHeight={setCardH} stampFont={pixel.className} />}
      {phase === 'over' && !ended && s.over && <News s={s} story={storyFor(s, s.over.reason)} full font={pixel.className} />}
      {phase === 'play' && flash && <News s={s} story={flash} full={false} font={pixel.className} />}
      {phase === 'play' && !ended && (
        <Island
          s={s} l={l} imp={imp} open={open} tab={tab} activity={activity} armed={armedRef.current}
          dispatch={dispatch} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} onTab={setTab}
          onResetView={() => engineRef.current?.resetView()}
        />
      )}
      {phase === 'play' && !open && !flash && <GoalCard s={s} onHeight={setGoalH} />}
      {ended && <EndCard s={s} onAgain={startOver} onHeight={setCardH} />}
    </main>
  );
}
