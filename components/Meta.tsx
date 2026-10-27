'use client';

import type { LocKey } from '@/lib/game/data';
import { ledger, type GameState } from '@/lib/game/state';

/** Where each site really is. */
const COORDS: Record<LocKey, string> = {
  dalles: '45.5946° N · 121.1787° W', reykjavik: '64.1466° N · 21.9426° W', phoenix: '33.4484° N · 112.0740° W',
  ashburn: '39.0438° N · 77.4874° W', abilene: '32.4487° N · 99.7331° W', newalbany: '40.0812° N · 82.8088° W',
  dublin: '53.3498° N · 6.2603° W', lulea: '65.5848° N · 22.1547° E',
};

/** A quiet line of facts in the corner, like a station readout. */
export function Meta({ s }: { s: GameState }) {
  const l = ledger(s);
  const live = s.speed > 0 && !s.briefing && !s.call;
  return (
    <div className="meta" aria-hidden="true">
      <span className={`meta-dot${live ? ' on' : ''}`} />
      <span>{COORDS[s.loc]}</span>
      <span>{l.itMW.toFixed(1)} MW</span>
      <span>{live ? 'Live' : 'Paused'}</span>
    </div>
  );
}
