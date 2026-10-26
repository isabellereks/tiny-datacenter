'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/game/state';

interface Tick { id: number; x: number; y: number; text: string; bad: boolean }

/** Each month's profit floats up off the roof and fades, so you can see the money come in. */
export function Ticks({ month, net, roof }: { month: number; net: number; roof: () => { x: number; y: number } | null }) {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const last = useRef(month);
  const id = useRef(0);
  useEffect(() => {
    if (month === last.current) return;
    last.current = month;
    const at = roof();
    if (!at || Math.abs(net) < 1) return;
    const t: Tick = { id: ++id.current, x: at.x + (Math.random() - 0.5) * 40, y: at.y - 12, text: `${net >= 0 ? '+' : ''}${money(net)}`, bad: net < 0 };
    setTicks(v => [...v.slice(-3), t]);
    const timer = window.setTimeout(() => setTicks(v => v.filter(x => x.id !== t.id)), 2400);
    return () => window.clearTimeout(timer);
    // only a new month starts a tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  return (
    <>
      {ticks.map(t => <span key={t.id} className={`tick${t.bad ? ' bad' : ''}`} style={{ left: t.x, top: t.y }} aria-hidden="true">{t.text}</span>)}
    </>
  );
}
