import { CUSTS, FOUNDS, HAIR, LOCS, NAMES, SHIRT, SKIN, TYPES, type BuildableType, type CustKey, type FoundKey, type InkKey, type LocKey, type ShapeKey, type Step, type StitchKey } from './data';
import { floorCost, fresh, hireCost, note, type GameState } from './state';

export type Action =
  | { type: 'step'; step: Step }
  | { type: 'next'; floor: BuildableType }
  | { type: 'build' }
  | { type: 'color'; hex: string }
  | { type: 'hire' }
  | { type: 'loc'; loc: LocKey }
  | { type: 'cust'; cust: CustKey }
  | { type: 'found'; found: FoundKey }
  | { type: 'shape'; shape: ShapeKey }
  | { type: 'ink'; ink: InkKey }
  | { type: 'stitch'; stitch: StitchKey }
  | { type: 'inside'; inside: boolean }
  | { type: 'select'; floor: number }
  | { type: 'reset' };

/** What the 3D scene must do after an action. */
export interface Effects { rebuild?: boolean; frame?: 'default' | 'keep'; resize?: boolean; replace?: GameState }

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function apply(s: GameState, a: Action): Effects {
  switch (a.type) {
    case 'step': {
      const was = s.step;
      s.step = a.step;
      return { rebuild: true, frame: was === 'found' || a.step === 'found' ? 'default' : undefined };
    }
    case 'next':
      s.next = a.floor;
      return {};
    case 'build': {
      const cost = floorCost(s);
      if (s.cash < cost || s.build || s.floors.length >= FOUNDS[s.found].max) return {};
      s.cash -= cost;
      s.floors.push({ type: s.next, color: s.floors[s.floors.length - 1].color, done: false });
      s.build = { idx: s.floors.length - 1, t0: Date.now(), dur: 1800 };
      s.sel = s.build.idx;
      note(s, `Started floor ${s.build.idx}: ${TYPES[s.next].name.toLowerCase()}.`);
      return { rebuild: true, frame: 'keep' };
    }
    case 'color':
      s.floors[s.sel].color = a.hex;
      return { rebuild: true };
    case 'hire': {
      const cost = hireCost(s);
      if (s.cash < cost) return {};
      s.cash -= cost;
      const used = new Set(s.workers.map(w => w.name));
      const left = NAMES.filter(n => !used.has(n));
      const name = pick(left.length ? left : NAMES);
      s.workers.push({
        id: s.nid++, name, floor: s.sel, x: (Math.random() - 0.5) * 4, dir: Math.random() < 0.5 ? -1 : 1,
        speed: 0.8 + Math.random() * 0.7, pause: 0, hair: pick(HAIR), skin: pick(SKIN), shirt: pick(SHIRT),
      });
      note(s, `Hired ${name} for floor ${s.sel}.`);
      return { rebuild: true };
    }
    case 'loc':
      s.loc = a.loc;
      note(s, `Moved to ${LOCS[a.loc].name}.`);
      return { rebuild: true };
    case 'cust':
      s.cust = a.cust;
      note(s, `Now serving: ${CUSTS[a.cust].name}.`);
      return {};
    case 'found': {
      const F = FOUNDS[a.found];
      if (a.found === s.found || s.cash < F.cost || s.floors.length > F.max || s.build) return {};
      s.cash -= F.cost;
      s.found = a.found;
      note(s, `Poured a ${F.name.toLowerCase()}.`);
      return { rebuild: true };
    }
    case 'shape':
      s.shape = a.shape;
      return { rebuild: true };
    case 'ink':
      s.ink = a.ink;
      return {};
    case 'stitch':
      s.stitch = a.stitch;
      return { resize: true };
    case 'inside':
      s.inside = a.inside;
      return { rebuild: true };
    case 'select':
      s.sel = a.floor;
      s.step = 'floors';
      return { rebuild: true };
    case 'reset':
      return { replace: fresh(), rebuild: true, frame: 'default' };
  }
}
