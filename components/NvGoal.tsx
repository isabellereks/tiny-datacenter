'use client';

import { useEffect, useRef } from 'react';
import { money, type GameState } from '@/lib/game/state';
import { GENS, baselineRevenue, dateOf, realMarketCap } from '@/lib/nv/history';
import { marketCap } from '@/lib/nv/sim';

/** Where you stand against the real company, and the next chip. */
export function NvGoal({ s, onHeight }: { s: GameState; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => { ro.disconnect(); onHeight(0); };
  }, [onHeight]);
  const n = s.nv!, m = Math.floor(s.month);
  const next = GENS[n.gen + 1];
  const mine = n.ipo ? marketCap(n, m, s.cash) : 0, real = realMarketCap(m);
  const p = n.project;
  return (
    <div className="goal" ref={ref} aria-live="polite">
      <span className="goal-target">
        {n.ipo || real ? <>You {n.ipo ? money(mine) : 'private'} · real {real ? money(real) : 'private'}</> : <>Sales {money(n.books.revenue)}/mo · real {money(baselineRevenue(m))}</>}
        <b>{dateOf(m)}</b>
      </span>
      {next && (
        <>
          <span className="goal-no">Next chip</span>
          <b>{next.name}</b>
          <p>{p ? `${Math.round((p.progress / p.need) * 100)}% designed` : n.mode === 'story' ? next.what : 'Not started'} · real launch {dateOf(next.at)}</p>
        </>
      )}
    </div>
  );
}
