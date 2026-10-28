'use client';

import { useEffect, useState } from 'react';
import type { Action } from '@/lib/game/actions';
import { COMPLAINTS, choiceCost, type Impact } from '@/lib/game/events';
import { ALL_DECISIONS, decisionCost } from '@/lib/game/gov';
import { dateLabel, money, siteName, type GameState } from '@/lib/game/state';
import { sfx } from '@/lib/game/sound';

/** Who sent it sets the letterhead color: the town, government, your own staff, or lawyers. */
function sender(from: string) {
  if (/union|techs/i.test(from)) return 'staff';
  if (/lawyer|class action|court|firm/i.test(from)) return 'law';
  if (/hyperscaler|bank|rush|cloud|services|azul|meta-ish/i.test(from)) return 'biz';
  if (/neighbor|resident|homeowner|protest|newspaper/i.test(from)) return 'town';
  return 'gov';
}

interface Option { label: string; detail: string; cost: number }

/**
 * Complaints and decisions arrive as a letter on paper. You answer by stamping it, and the stamp lands
 * before the letter slides away.
 */
export function Letter({ s, imp, dispatch, font }: { s: GameState; imp: Impact; dispatch: (a: Action) => void; font: string }) {
  const [stamped, setStamped] = useState<number | null>(null);
  const complaint = COMPLAINTS.find(c => c.id === s.complaint);
  const decision = complaint ? null : ALL_DECISIONS().find(d => d.id === s.complaint);

  useEffect(() => {
    if (stamped === null) return;
    sfx('stamp');
    const id = window.setTimeout(() => dispatch({ type: 'resolve', choice: stamped }), 750);
    return () => window.clearTimeout(id);
  }, [stamped, dispatch]);

  if (!complaint && !decision) return null;
  const from = complaint ? complaint.from : decision!.from(s);
  const title = complaint ? complaint.title(s, imp) : decision!.title(s);
  const body = complaint ? complaint.body(s, imp) : decision!.body(s);
  const options: Option[] = complaint
    ? complaint.choices.map(c => {
      const cost = choiceCost(s, c);
      return { label: c.label, cost, detail: cost ? money(cost) : 'Free' };
    })
    : decision!.choices.map(c => {
      const cost = decisionCost(s, c);
      // the price up front; what it does to trust you find out from the town
      const note = c.note.replace(/(^|[,.]\s*|\s+and\s+)trust [+−-]\d+/gi, '').replace(/^[,.\s]+|[,\s]+$/g, '');
      const price = cost > 0 ? money(cost) : cost < 0 ? `Pays ${money(-cost)}` : '';
      return { label: c.label, cost, detail: [price, note].filter(Boolean).join('. ') || 'Free' };
    });

  return (
    <div className={`letter-back${stamped !== null ? ' done' : ''}`}>
      <article className={`letter ${sender(from)}`} role="alertdialog" aria-labelledby="letter-title">
        <header className={`letterhead ${font}`}>
          <span>{from}</span>
          <span>{dateLabel(s.month)}</span>
        </header>
        <div className="letter-body">
          <span className="letter-to">To the owner of {siteName(s)}</span>
          <h2 id="letter-title" className={font}>{title}</h2>
          <p>{body}</p>
        </div>
        <footer className="letter-choices">
          {options.map((o, k) => (
            <button key={o.label} className={`stamp-btn${k === 0 ? ' first' : ''}`} disabled={stamped !== null || (o.cost > 0 && s.cash < o.cost)}
              onClick={() => setStamped(k)}>
              <b className={font}>{o.label}</b>
              <small>{o.detail}</small>
            </button>
          ))}
        </footer>
        {stamped !== null && <div className={`letter-stamp ${font}`} aria-hidden="true">{options[stamped].label}</div>}
      </article>
    </div>
  );
}
