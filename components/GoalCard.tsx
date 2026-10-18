'use client';

import { useEffect, useRef } from 'react';
import { GOALS } from '@/lib/game/events';
import { floorLabel, money, type GameState } from '@/lib/game/state';

/** The current goal, or an outage that needs a tap. Doubles as the tutorial. */
export function GoalCard({ s, onHeight }: { s: GameState; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const down = s.broken.find(b => !s.workers.some(w => w.floor === b.floor));
  const g = GOALS[s.goal];
  const visible = !!(down || g);
  useEffect(() => {
    const el = ref.current;
    if (!el) { onHeight(0); return; }
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, visible]);

  if (!visible) return null;

  return (
    <div className={`goal${down ? ' bad' : ''}`} ref={ref} aria-live="polite">
      {down ? (
        <>
          <span className="goal-no">Outage</span>
          <b>{floorLabel(s, down.floor)} is down</b>
          <p>Tap it to call a repair crew, or hire a tech there.</p>
        </>
      ) : g && (
        <>
          <span className="goal-no">Goal {s.goal + 1}/{GOALS.length}</span>
          <b>{g.text}</b>
          <p>{g.hint}</p>
          <span className="reward">Reward: {money(g.reward)}</span>
        </>
      )}
    </div>
  );
}
