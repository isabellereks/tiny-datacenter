import { LOCS } from './data';
import { hopedJobs, impact } from './events';
import { ledger, locals, overseas, siteName, tallest, type GameState } from './state';

/*
 * Townspeople phone you. What they yell about comes from what you're actually doing to them:
 * cut trees, noise, power bills, water, jobs, the skyline. Answer and they feel heard; let it ring and they don't.
 */

export interface Call { id: number; who: string; line: string; mood: 'mad' | 'glad'; t0: number; answered: boolean }

const CALLERS = [
  'Linda on Maple Street', 'Gary, retired', 'Deb from the PTA', 'Marcus next door', 'Pastor Jim', 'Rosa at the diner',
  'A very tired dad', 'Coach Dave', 'Mrs. Albright', 'Tom, farmer', 'Priya, nurse', 'The HOA president',
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Who they threaten to call, by place. */
const rep = (s: GameState) => (LOCS[s.loc].gov.us ? 'SENATOR' : s.loc === 'dublin' ? 'TD' : 'MP');

/** The loudest word in your datacenter's name, for name-calling. */
function nickname(s: GameState) {
  const words = siteName(s).split(/\s+/).filter(w => w.length > 2 && !/^(the|datacenter|data|center|compute|inc|llc)$/i.test(w));
  return `BIG ${(words[0] ?? 'DATA').toUpperCase()}`;
}

/** Everything someone might be upset (or happy) about right now: the same four things the town tab shows. */
function gripes(s: GameState): { line: string; mood: 'mad' | 'glad' }[] {
  const l = ledger(s), i = impact(s, l);
  const site = siteName(s).toUpperCase();
  const out: { line: string; mood: 'mad' | 'glad' }[] = [];
  const mad = (line: string) => out.push({ line, mood: 'mad' });
  if (i.cleared >= 6) mad(`YOU CUT DOWN THE TREE MY KIDS CLIMBED. ${i.cleared} TREES. I COUNTED.`);
  if (i.waterML >= 3 && !s.up.closedLoop && !s.up.liquid) mad('MY TAP IS SPUTTERING AND YOU\'RE POURING WATER ON COMPUTERS?');
  if ((tallest(s) >= 6 || s.up.turbines) && !s.up.soundWalls) mad(`IT'S 3 AM AND YOUR FANS ARE HUMMING THROUGH MY WALLS. I CAN FEEL IT IN MY TEETH.`);
  if (l.strain >= 0.6) mad(`MY POWER BILL WENT UP AGAIN. I KNOW IT'S YOU, ${nickname(s)}.`);
  if (locals(s) < hopedJobs(s) * 0.5 && hopedJobs(s) > 0) mad('YOU SAID JOBS. MY SON APPLIED. NOTHING. NOT EVEN AN EMAIL.');
  if (overseas(s) > locals(s) && overseas(s) >= 2) mad('YOU HIRED FROM OVERSEAS? MY NEPHEW IS A TECH. HE LIVES IN MY BASEMENT.');
  if (s.trust < 45) mad(`I HATE ${site}. I'M TELLING MY ${rep(s)} ON YOU, ${nickname(s)}.`);
  if (s.staff.strike) mad('MY HUSBAND WORKS FOR YOU AND HE\'S ON THE PICKET LINE IN THE COLD. PAY HIM.');
  // the occasional nice call
  if (s.up.heat) out.push({ line: 'MY HOUSE IS WARM AND MY HEATING BILL IS HALF. I DON\'T EVEN MIND THE HUM.', mood: 'glad' });
  if (s.trust >= 75) out.push({ line: `I USED TO HATE ${site}. MY DAUGHTER WORKS THERE NOW. SHE LOVES IT. OKAY. BYE.`, mood: 'glad' });
  if (s.goodwill > 4) out.push({ line: 'THANK YOU FOR THE SCHOOL MONEY. THE KIDS GOT NEW COMPUTERS. IRONIC, RIGHT?', mood: 'glad' });
  return out;
}

/** Maybe someone calls this month. Angrier towns call more. */
export function callMonth(s: GameState) {
  if (s.call || s.phase !== 'play') return;
  const list = gripes(s);
  if (!list.length) return;
  const p = 0.1 + (s.trust < 50 ? 0.2 : 0) + (s.trust < 30 ? 0.15 : 0);
  if (Math.random() >= p) return;
  const g = pick(list);
  s.call = { id: Date.now(), who: pick(CALLERS), line: g.line, mood: g.mood, t0: Date.now(), answered: false };
}

/** How long a call rings before it goes to voicemail. */
export const RING_MS = 9000;
