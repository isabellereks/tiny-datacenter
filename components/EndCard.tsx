'use client';

import { useEffect, useRef } from 'react';
import { impact } from '@/lib/game/events';
import { money, type GameState } from '@/lib/game/state';

export function EndCard({ s, onAgain, onHeight, onShare }: { s: GameState; onAgain: () => void; onHeight: (h: number) => void; onShare: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const town = s.over?.reason === 'town';
  const months = Math.floor(s.month);
  return (
    <div className="setup end" ref={ref} role="dialog" aria-labelledby="end-title">
      <div className="setup-head">
        <h1 id="end-title">{town ? 'Shut down by the town' : 'Bankrupt'}</h1>
        <p>
          {town
            ? 'Trust hit 0. The town tore down your datacenter and you lost all your money.'
            : 'You were in debt for 3 months in a row.'}
        </p>
      </div>
      <div className="facts-grid">
        <div className="fact"><span>Best rating</span><b>{s.tally.best}/100</b></div>
        <div className="fact"><span>Months</span><b>{months}</b></div>
        <div className="fact"><span>Profit</span><b>{money(s.tally.profit)}</b></div>
        <div className="fact"><span>Trees cut</span><b>{impact(s).cleared}</b></div>
        <div className="fact"><span>Ignored</span><b>{s.tally.ignored}</b></div>
        <div className="fact"><span>Goals</span><b>{s.tally.goals}</b></div>
      </div>
      <div className="setup-foot">
        <button className="back" onClick={onShare}>Share on X</button>
        <button className="go" onClick={onAgain}>Play again</button>
      </div>
    </div>
  );
}
