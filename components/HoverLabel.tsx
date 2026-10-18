'use client';

import { FOUNDS, TYPES, type FoundKey } from '@/lib/game/data';
import { floorLabel, isBroken, landCost, money, techsOn, utilization, type GameState } from '@/lib/game/state';

/** A small label at the bottom saying what the pointer is over. */
export function HoverLabel({ s, what }: { s: GameState; what: { found?: FoundKey; floor?: number } }) {
  let text = '';
  if (what.found) {
    const F = FOUNDS[what.found];
    text = `${F.name}: ${F.max} floors, ${F.acres} acres, ${money(F.cost + landCost(s.loc, what.found))}`;
  } else if (what.floor != null && s.floors[what.floor]) {
    const i = what.floor, f = s.floors[i];
    const bits = [`${floorLabel(s, i)}: ${TYPES[f.type].name}`];
    if (!f.done) bits.push('building');
    else if (isBroken(s, i)) bits.push('down, tap to fix');
    else if (f.type === 'hall') bits.push(techsOn(s, i) ? `${techsOn(s, i)} techs, ${Math.round(utilization(s, i) * 100)}% in use` : 'off, needs a tech');
    text = bits.join(', ');
  }
  if (!text) return null;
  // during setup the card fills the bottom, so the label sits up top
  return <div className={`hover-label${s.phase === 'setup' ? ' top' : ''}`} role="status">{text}</div>;
}
