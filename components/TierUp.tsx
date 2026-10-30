'use client';

import type { Action } from '@/lib/game/actions';
import { TIERS } from '@/lib/game/data';
import { UPGRADES } from '@/lib/game/events';
import { gridAsk } from '@/lib/game/deals';
import { siteName, type GameState } from '@/lib/game/state';

/** A new size tier: what you've become and what it unlocks. The game waits while it's open. */
export function TierUp({ s, dispatch, font }: { s: GameState; dispatch: (a: Action) => void; font: string }) {
  const k = s.tierUp ?? s.tier;
  const T = TIERS[k];
  const unlocked = UPGRADES.filter(u => u.tier === k);
  return (
    <div className="share-back" role="dialog" aria-labelledby="tier-title">
      <div className="share tier card-pop">
        <div className="tier-steps" aria-hidden="true">
          {TIERS.map((t, i) => <i key={t.name} className={i <= k ? 'on' : ''} />)}
        </div>
        <span className="stepno">{siteName(s)} is now a</span>
        <h2 id="tier-title" className={font}>{T.name}</h2>
        <ul className="tier-list">
          <li>Customers ask for bigger deals</li>
          <li>Ask the utility for up to {gridAsk(s)} MW</li>
          {unlocked.map(u => <li key={u.key}>{u.name}: {u.note}</li>)}
        </ul>
        <div className="share-foot">
          <button className="go" onClick={() => dispatch({ type: 'tierSeen' })}>Continue</button>
        </div>
      </div>
    </div>
  );
}
