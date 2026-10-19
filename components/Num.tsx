'use client';

import NumberFlow from '@number-flow/react';
import { useEffect, useRef, useState } from 'react';

const COMPACT = { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 } as const;

/** Cash ticks every frame; rolling that often never settles and the digits smear. Show at most one new value a second. */
function useSettled(value: number, ms = 1000) {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const id = setInterval(() => setShown(latest.current), ms);
    return () => clearInterval(id);
  }, [ms]);
  return shown;
}

/** Money that rolls to its new value, like a sim game's counter. Matches money(): $1.2M, $340K. */
export function Cash({ value: live, perMonth, signed, className }: { value: number; perMonth?: boolean; signed?: boolean; className?: string }) {
  const value = useSettled(live);
  return (
    <NumberFlow
      className={className}
      value={Math.round(value)}
      format={{ ...COMPACT, signDisplay: signed ? 'exceptZero' : 'auto', maximumFractionDigits: Math.abs(value) >= 1e6 && Math.abs(value) < 1e8 ? 1 : 0 }}
      suffix={perMonth ? '/mo' : undefined}
    />
  );
}

/** A plain whole number that rolls. */
export function Count({ value, suffix, className }: { value: number; suffix?: string; className?: string }) {
  return <NumberFlow className={className} value={Math.round(value)} suffix={suffix} />;
}
