'use client';

import { Nunito, Pixelify_Sans, Silkscreen } from 'next/font/google';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apply, type Action } from '@/lib/game/actions';
import { Engine } from '@/lib/game/engine';
import { impact } from '@/lib/game/events';
import { ledger, load, save, type GameState } from '@/lib/game/state';
import { EndCard } from './EndCard';
import { GoalCard } from './GoalCard';
import { Island, type Tab } from './Island';
import { News, storyFor, type Story } from './News';
import { SetupCard } from './SetupCard';
import { Share } from './Share';
import { HoverLabel } from './HoverLabel';
import { Call } from './Call';
import { Briefing } from './Briefing';
import { Letter } from './Letter';
import { TierUp } from './TierUp';
import { Meta } from './Meta';
import { Ticks } from './Ticks';
import type { FoundKey } from '@/lib/game/data';
import { armSound, setHum, setMuted, sfx } from '@/lib/game/sound';

const pixel = Silkscreen({ weight: '400', subsets: ['latin'] });
/** UI text: a pixel face that stays readable at small sizes. */
const ui = Pixelify_Sans({ subsets: ['latin'], variable: '--pixel' });
/** Small text: a rounded sans that stays readable where the pixel face blurs. */
const body = Nunito({ subsets: ['latin'], variable: '--body', weight: ['400', '600', '700'] });
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
  const [sharing, setSharing] = useState(false);
  const [hovered, setHovered] = useState<{ found?: FoundKey; floor?: number } | null>(null);
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

    if (a.type === 'build' || a.type === 'refresh' || a.type === 'addBuilding') sfx('build');
    if (a.type === 'sign') sfx('sign');
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
    armSound();
    // a soft tick on every button
    const tap = (e: MouseEvent) => { if ((e.target as HTMLElement)?.closest?.('button')) sfx('click'); };
    document.addEventListener('click', tap, true);
    lastLog.current = stateRef.current.log[0];
    const engine = new Engine(hostRef.current!, {
      state: () => stateRef.current!,
      onChange: () => { announce(); save(stateRef.current!); redraw(); },
      onPickFloor: floor => {
        const s = stateRef.current;
        if (!s || s.phase === 'over') return;
        dispatch({ type: 'select', floor });
        if (s.phase === 'play') { setOpen(true); setTab('floor'); }
      },
      onPickFoundation: found => dispatch({ type: 'found', found }),
      onFirstInteraction: () => {
        const s = stateRef.current;
        if (s?.phase === 'play' && s.spin) { s.spin = false; redraw(); }
      },
      onSave: () => save(stateRef.current!),
      onHover: setHovered,
    }, pixel.style.fontFamily);
    engineRef.current = engine;
    redraw();
    const id = window.setInterval(redraw, 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || stateRef.current?.phase !== 'play') return;
      // space pauses, 1 to 3 pick a speed, like other sim games
      if (e.key === ' ') { e.preventDefault(); dispatch({ type: 'speed', speed: stateRef.current.speed ? 0 : 1 }); }
      if (e.key === '1' || e.key === '2' || e.key === '3') dispatch({ type: 'speed', speed: Number(e.key) });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', tap, true);
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
    if (complaintNow === 'protest' || complaintNow === 'carbon' || complaintNow === 'jobs') {
      setFlash(storyFor(st, complaintNow));
      sfx('news');
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 7000);
    }
  }, [complaintNow]);

  // blackouts in town make the news the moment they start
  const grid = s?.gridLevel ?? 0;
  const lastGrid = useRef(0);
  useEffect(() => {
    const st = stateRef.current;
    if (st && grid === 3 && lastGrid.current < 3) {
      setFlash(storyFor(st, 'blackout'));
      sfx('news');
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 7000);
    }
    lastGrid.current = grid;
  }, [grid]);

  // laws, hearings and elections make the news
  // -1 until the save has loaded
  const newsId = s ? s.news?.id ?? 0 : -1;
  const lastNews = useRef<number | null>(null);
  useEffect(() => {
    const st = stateRef.current;
    if (!st || newsId < 0) return;
    // a saved headline doesn't replay when you come back
    if (lastNews.current === null) { lastNews.current = newsId; return; }
    if (st.news && newsId !== lastNews.current && st.phase === 'play') {
      setFlash({ tag: st.news.tag, headline: st.news.headline, ticker: st.news.ticker });
      sfx('news');
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 7000);
    }
    lastNews.current = newsId;
  }, [newsId]);

  // the hum follows the load; sound follows the setting
  const muted = !!s?.muted;
  useEffect(() => { setMuted(muted); }, [muted]);
  const running = s && s.phase === 'play' && s.speed > 0 && !s.briefing ? ledger(s) : null;
  const humLevel = running ? Math.round((running.itMW / Math.max(4, running.hallMW)) * 10) / 10 : 0;
  useEffect(() => { setHum(humLevel); }, [humLevel]);
  const tierNow = s?.tierUp ?? null;
  useEffect(() => { if (tierNow !== null) sfx('tier'); }, [tierNow]);

  const startOver = useCallback(() => { armedRef.current = true; dispatch({ type: 'reset' }); }, [dispatch]);

  if (!s) return <main className={`app ${ui.variable} ${body.variable}`}><div className="stage" ref={hostRef} /></main>;
  const l = ledger(s);
  const imp = impact(s, l);
  return (
    <main className={`app ${ui.variable} ${body.variable}`}>
      <div className="stage" ref={hostRef} />
      {phase === 'play' && <Ticks month={Math.floor(s.month)} net={(s.books ?? l).net} roof={() => engineRef.current?.roofOnScreen(0) ?? null} />}
      {phase === 'play' && !open && <Meta s={s} />}
      {phase === 'setup' && <SetupCard s={s} dispatch={dispatch} onHeight={setCardH} stampFont={pixel.className} />}
      {phase === 'over' && !ended && s.over && <News s={s} story={storyFor(s, s.over.reason)} full font={pixel.className} />}
      {phase === 'play' && flash && <News s={s} story={flash} full={false} font={pixel.className} />}
      {phase === 'play' && !ended && (
        <Island
          s={s} l={l} imp={imp} open={open} tab={tab} activity={activity} armed={armedRef.current}
          dispatch={dispatch} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} onTab={setTab}
          onResetView={() => engineRef.current?.resetView()} onShare={() => setSharing(true)}
        />
      )}
      {phase === 'play' && !open && !flash && !s.complaint && <GoalCard s={s} onHeight={setGoalH} dispatch={dispatch} font={pixel.className} />}
      {phase === 'play' && s.tierUp !== null && !s.briefing && <TierUp s={s} dispatch={dispatch} font={pixel.className} />}
      {phase === 'play' && s.complaint && !s.call && !s.briefing && s.tierUp === null && <Letter key={s.complaint} s={s} imp={imp} dispatch={dispatch} font={pixel.className} />}
      {ended && <EndCard s={s} onAgain={startOver} onHeight={setCardH} onShare={() => setSharing(true)} />}
      {hovered && <HoverLabel s={s} what={hovered} />}
      {phase === 'play' && s.briefing && <Briefing s={s} dispatch={dispatch} />}
      {phase === 'play' && s.call && <Call key={s.call.id} call={s.call} dispatch={dispatch} font={pixel.className} />}
      {sharing && (
        <Share s={s} capture={() => engineRef.current?.capture() ?? null} font={pixel.style.fontFamily} ui={ui.style.fontFamily}
          onClose={() => setSharing(false)} />
      )}
    </main>
  );
}
