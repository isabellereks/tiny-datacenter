'use client';

import { useEffect, useRef } from 'react';
import type { Action } from '@/lib/game/actions';
import { REPAIR_COST, TYPES } from '@/lib/game/data';
import { GOALS } from '@/lib/game/events';
import { floorLabel, money, today, type GameState } from '@/lib/game/state';
import { sfx } from '@/lib/game/sound';

/** The current goal, or an outage that needs a tap. Doubles as the tutorial. */
export function GoalCard({ s, onHeight, dispatch, font }: { s: GameState; onHeight: (h: number) => void; dispatch: (a: Action) => void; font: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const down = s.broken.find(b => !s.workers.some(w => w.floor === b.floor));
  const g = GOALS[s.goal];
  const visible = !!(down || g);
  useEffect(() => {
    const el = ref.current;
    if (!el) { onHeight(0); return; }
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => { ro.disconnect(); onHeight(0); };
  }, [onHeight, visible]);

  if (!visible) return <AlarmSound floor={null} />;

  // an outage with nobody there to fix it sets off the control-room alarm
  if (down) {
    const f = s.floors[down.floor];
    const cost = today(s, REPAIR_COST);
    const others = s.broken.length - 1;
    return (
      <>
        <i className="alarm-edge" aria-hidden="true" />
        <AlarmSound floor={down.floor} />
        <div className={`alarm ${font}`} ref={ref} role="alert">
          <div className="alarm-tag"><span className="dot" />Alarm</div>
          <div className="alarm-head">{floorLabel(s, down.floor)} down</div>
          <div className="alarm-log">
            <span>{down.why ?? `${f ? TYPES[f.type].name : 'Floor'} offline`}. No tech on site.</span>
            {others > 0 && <span>{others} more {others === 1 ? 'floor' : 'floors'} down</span>}
          </div>
          <div className="alarm-foot">
            <button className="call-btn answer" disabled={s.cash < cost} onClick={() => dispatch({ type: 'repair', floor: down.floor })}>
              Send repair crew  {money(cost)}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="goal" ref={ref} aria-live="polite">
      {g && (
        <>
          <span className="goal-no">Goal {s.goal + 1}/{GOALS.length}</span>
          <b>{g.text}</b>
          {g.hint && <p>{g.hint}</p>}
          <span className="reward">Reward: {money(g.reward)}</span>
        </>
      )}
    </div>
  );
}

/** Beeps once when a floor goes down with nobody there. */
function AlarmSound({ floor }: { floor: number | null }) {
  useEffect(() => { if (floor !== null) sfx('alarm'); }, [floor]);
  return null;
}
