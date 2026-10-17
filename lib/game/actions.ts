import { CUSTS, FOUNDS, LOCS, NAMES, TYPES, type BuildableType, type CustKey, type FoundKey, type LocKey, type Role, type ShapeKey, type ThreadKey } from './data';
import { floorCost, fresh, hireCost, note, type GameState } from './state';

export type Action =
  | { type: 'pick'; on: boolean }
  | { type: 'next'; floor: BuildableType }
  | { type: 'build' }
  | { type: 'fill'; role: Role }
  | { type: 'hire' }
  | { type: 'loc'; loc: LocKey }
  | { type: 'cust'; cust: CustKey }
  | { type: 'found'; found: FoundKey }
  | { type: 'shape'; shape: ShapeKey }
  | { type: 'inside'; inside: boolean }
  | { type: 'spin'; on: boolean }
  | { type: 'smoke'; on: boolean }
  | { type: 'select'; floor: number }
  | { type: 'across'; n: number }
  | { type: 'threadCount'; n: 2 | 3 }
  | { type: 'leaveWhite'; on: boolean }
  | { type: 'lettering'; text: string }
  | { type: 'thread'; key: ThreadKey; hex: string }
  | { type: 'reset' };

/** What the scene must do after an action. */
export interface Effects { rebuild?: boolean; refit?: boolean; pattern?: boolean; replace?: GameState }

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function apply(s: GameState, a: Action): Effects {
  switch (a.type) {
    case 'pick':
      s.picking = a.on;
      return { rebuild: true, refit: true };
    case 'next':
      s.next = a.floor;
      return {};
    case 'build': {
      const cost = floorCost(s);
      if (s.cash < cost || s.build || s.floors.length >= FOUNDS[s.found].max) return {};
      s.cash -= cost;
      s.floors.push({ type: s.next, fill: s.floors[s.floors.length - 1].fill, done: false });
      s.build = { idx: s.floors.length - 1, t0: Date.now(), dur: 1800 };
      s.sel = s.build.idx;
      note(s, `Started floor ${s.build.idx}: ${TYPES[s.next].name.toLowerCase()}.`);
      return { rebuild: true, refit: true };
    }
    case 'fill':
      s.floors[s.sel].fill = a.role;
      return { rebuild: true };
    case 'hire': {
      const cost = hireCost(s);
      if (s.cash < cost) return {};
      s.cash -= cost;
      const used = new Set(s.workers.map(w => w.name));
      const left = NAMES.filter(n => !used.has(n));
      const name = pick(left.length ? left : NAMES);
      s.workers.push({ id: s.nid++, name, floor: s.sel, x: (Math.random() - 0.5) * 4, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.8 + Math.random() * 0.7, pause: 0 });
      if (!s.inside) s.inside = true;
      note(s, `Hired ${name} for floor ${s.sel}.`);
      return { rebuild: true };
    }
    case 'loc':
      s.loc = a.loc;
      note(s, `Moved to ${LOCS[a.loc].name}.`);
      return { rebuild: true, refit: true };
    case 'cust':
      s.cust = a.cust;
      note(s, `Now serving: ${CUSTS[a.cust].name}.`);
      return {};
    case 'found': {
      const F = FOUNDS[a.found];
      if (a.found === s.found || s.cash < F.cost || s.floors.length > F.max || s.build) return {};
      s.cash -= F.cost;
      s.found = a.found;
      s.picking = false;
      note(s, `Poured a ${F.name.toLowerCase()}.`);
      return { rebuild: true, refit: true };
    }
    case 'shape':
      s.shape = a.shape;
      return { rebuild: true, refit: true };
    case 'inside':
      s.inside = a.inside;
      return { rebuild: true };
    case 'spin':
      s.spin = a.on;
      return {};
    case 'smoke':
      s.smoke = a.on;
      return { refit: true };
    case 'select':
      s.sel = a.floor;
      return {};
    case 'across':
      s.pattern.across = a.n;
      return { pattern: true };
    case 'threadCount':
      s.pattern.threadCount = a.n;
      return {};
    case 'leaveWhite':
      s.pattern.leaveWhite = a.on;
      return {};
    case 'lettering':
      s.pattern.lettering = a.text;
      return { pattern: true };
    case 'thread':
      s.pattern.threads[a.key] = a.hex;
      return {};
    case 'reset':
      return { replace: fresh(), rebuild: true, refit: true, pattern: true };
  }
}
