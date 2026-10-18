'use client';

import { LOCS } from '@/lib/game/data';
import { impact } from '@/lib/game/events';
import { dateLabel, locals, ownerName, siteName, type GameState } from '@/lib/game/state';

export interface Story { tag: string; headline: string; ticker: string[] }

/** What the news says when you lose, or when a complaint makes the paper. */
export function storyFor(s: GameState, kind: 'town' | 'broke' | 'protest' | 'carbon' | 'blackout' | 'jobs'): Story {
  const owner = ownerName(s), site = siteName(s), imp = impact(s);
  const where = LOCS[s.loc].name;
  switch (kind) {
    case 'town':
      return {
        tag: 'Breaking news',
        headline: `Town shuts down ${site}`,
        ticker: [
          `Residents storm ${site} in ${where}`,
          `CEO ${owner} loses everything`,
          `${imp.cleared} trees were cut to build it`,
          `${s.tally.ignored} ${s.tally.ignored === 1 ? 'complaint' : 'complaints'} ignored`,
        ],
      };
    case 'broke':
      return {
        tag: 'Breaking news',
        headline: `${site} goes bankrupt`,
        ticker: [`CEO ${owner} misses a third month of payments`, `The bank takes over the site in ${where}`, `Servers go dark`],
      };
    case 'protest':
      return {
        tag: 'Local news',
        headline: `Protest outside ${site}`,
        ticker: [`Crowd calls on CEO ${owner} to step down`, `Trust in the datacenter is falling`, where],
      };
    case 'blackout':
      return {
        tag: 'Breaking news',
        headline: `Blackouts across ${where.split(',')[0]}`,
        ticker: [`${site} is using more power than the grid can give`, `Families lose power at home`, `CEO ${owner} blamed`],
      };
    case 'jobs':
      return {
        tag: 'Local news',
        headline: `${site} hires almost no one`,
        ticker: [`Town says CEO ${owner} promised jobs`, `${locals(s)} locals work there`, where],
      };
    case 'carbon':
      return {
        tag: 'Local news',
        headline: `${site} named a top polluter`,
        ticker: [`${Math.round(imp.carbonT).toLocaleString()} tonnes of CO₂ last month`, `CEO ${owner} declines to comment`, where],
      };
  }
}

/** A TV news lower third with a scrolling ticker. `full` adds letterbox bars for the ending. */
export function News({ s, story, full, font }: { s: GameState; story: Story; full: boolean; font: string }) {
  const line = story.ticker.join('   •   ');
  return (
    <div className={`news${full ? ' full' : ''} ${font}`} role="status" aria-live="assertive">
      {full && <><i className="bar-top" /><i className="bar-bottom" /></>}
      <div className="live"><span className="dot" />Live  {LOCS[s.loc].short}  {dateLabel(s.month)}</div>
      <div className="lower">
        <div className="tag">{story.tag}</div>
        <div className="headline">{story.headline}</div>
        <div className="ticker" aria-label={story.ticker.join('. ')}>
          <span>{line}   •   {line}   •   </span>
        </div>
      </div>
    </div>
  );
}
