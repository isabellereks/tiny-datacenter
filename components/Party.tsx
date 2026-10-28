'use client';

import { useEffect, useMemo, useState } from 'react';
import { THREADS } from '@/lib/game/data';
import { sfx } from '@/lib/game/sound';

/** Stitched confetti and a banner for a milestone. Goes away on its own. */
export function Party({ id, text, font }: { id: number; text: string; font: string }) {
  const [on, setOn] = useState(true);
  const bits = useMemo(() => Array.from({ length: 70 }, (_, k) => ({
    x: Math.random() * 100, d: Math.random() * 0.8, t: 1.8 + Math.random() * 1.4, s: 8 + Math.random() * 8,
    c: THREADS[k % THREADS.length].hex, r: Math.random() * 360,
  // a fresh burst for each milestone
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [id]);
  useEffect(() => {
    setOn(true);
    sfx('tier');
    const t = window.setTimeout(() => setOn(false), 3600);
    return () => window.clearTimeout(t);
  }, [id]);
  if (!on) return null;
  return (
    <div className="party" aria-live="polite">
      {bits.map((b, k) => (
        <i key={k} style={{ left: `${b.x}%`, width: b.s, height: b.s, color: b.c, animationDelay: `${b.d}s`, animationDuration: `${b.t}s`, ['--r' as string]: `${b.r}deg` }} />
      ))}
      <div className={`party-banner ${font}`}>{text}</div>
    </div>
  );
}
