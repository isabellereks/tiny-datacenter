import {
  CUSTS, FOUNDS, LOCS, NAMES, SETUP, STARTER, TYPES,
  type BuildableType, type CustKey, type Fill, type FoundKey, type LocKey, type SetupStep, type ShapeKey, type StitchSize,
} from './data';
import { resolveComplaint } from './events';
import { floorCost, fresh, hireCost, note, type GameState } from './state';

export type Action =
  | { type: 'step'; step: SetupStep }
  | { type: 'height'; n: number }
  | { type: 'fillAll'; fill: Fill }
  | { type: 'open' }
  | { type: 'next'; floor: BuildableType }
  | { type: 'nextFill'; fill: Fill }
  | { type: 'build' }
  | { type: 'fill'; fill: Fill }
  | { type: 'hire' }
  | { type: 'loc'; loc: LocKey }
  | { type: 'cust'; cust: CustKey }
  | { type: 'found'; found: FoundKey }
  | { type: 'shape'; shape: ShapeKey }
  | { type: 'inside'; on: boolean }
  | { type: 'spin'; on: boolean }
  | { type: 'smoke'; on: boolean }
  | { type: 'select'; floor: number }
  | { type: 'stitch'; size: StitchSize }
  | { type: 'outline'; hex: string }
  | { type: 'name'; text: string }
  | { type: 'resolve'; choice: number }
  | { type: 'reset' };

/** What the scene must do after an action. */
export interface Effects { rebuild?: boolean; refit?: boolean; layout?: boolean; home?: boolean; replace?: GameState }

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Finishes any running construction at once, so quick taps never pile up. */
function settle(s: GameState) {
  if (s.build) { s.floors[s.build.idx].done = true; s.build = null; }
}

function startBuild(s: GameState, dur: number) {
  s.build = { idx: s.floors.length - 1, t0: Date.now(), dur };
}

export function apply(s: GameState, a: Action): Effects {
  switch (a.type) {
    case 'step': {
      settle(s);
      const was = s.step;
      s.step = a.step;
      s.spin = a.step !== 'color';
      return { rebuild: true, refit: was === 'found' || a.step === 'found' || a.step === 'name' || was === 'name' };
    }
    case 'height': {
      const n = Math.max(2, Math.min(a.n, STARTER.length, FOUNDS[s.found].max));
      settle(s);
      if (n > s.floors.length) {
        const fill = s.floors[s.floors.length - 1].fill;
        s.floors.push({ type: STARTER[s.floors.length], fill, done: false });
        startBuild(s, 650);
      } else if (n < s.floors.length) {
        s.floors.pop();
      }
      s.sel = Math.min(s.sel, s.floors.length - 1);
      return { rebuild: true, refit: true };
    }
    case 'fillAll':
      s.floors.forEach(f => { f.fill = a.fill; });
      return { rebuild: true };
    case 'open': {
      settle(s);
      s.phase = 'play';
      s.cash = 500;
      s.inside = true;
      s.spin = false;
      s.nextFill = s.floors[s.floors.length - 1].fill;
      s.sel = Math.max(0, s.floors.findIndex(f => f.type === 'hall'));
      note(s, `${s.look.name.trim() || 'Your datacenter'} is open · serving ${CUSTS[s.cust].name.toLowerCase()}`);
      return { rebuild: true, layout: true, home: true };
    }
    case 'next':
      s.next = a.floor;
      return {};
    case 'nextFill':
      s.nextFill = a.fill;
      return {};
    case 'build': {
      const cost = floorCost(s);
      if (s.cash < cost || s.build || s.floors.length >= FOUNDS[s.found].max) return {};
      s.cash -= cost;
      s.floors.push({ type: s.next, fill: s.nextFill, done: false });
      startBuild(s, 1800);
      s.sel = s.floors.length - 1;
      s.stageDay = s.day;
      note(s, `Stitching floor ${s.sel} · ${TYPES[s.next].name}`);
      return { rebuild: true, refit: true };
    }
    case 'fill':
      s.floors[s.sel].fill = a.fill;
      return { rebuild: true };
    case 'hire': {
      const cost = hireCost(s);
      if (s.cash < cost || s.floors[s.sel]?.type !== 'hall') return {};
      s.cash -= cost;
      const used = new Set(s.workers.map(w => w.name));
      const left = NAMES.filter(n => !used.has(n));
      const name = pick(left.length ? left : NAMES);
      s.workers.push({ id: s.nid++, name, floor: s.sel, x: (Math.random() - 0.5) * 4, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.8 + Math.random() * 0.7, pause: 0 });
      s.inside = true;
      note(s, `${name} joined floor ${s.sel}`);
      return { rebuild: true };
    }
    case 'loc':
      s.loc = a.loc;
      if (s.phase === 'play') note(s, `Moved to ${LOCS[a.loc].name}`);
      return { rebuild: true, refit: true };
    case 'cust':
      s.cust = a.cust;
      if (s.phase === 'play') note(s, `Now serving ${CUSTS[a.cust].name.toLowerCase()}`);
      return {};
    case 'found': {
      const F = FOUNDS[a.found];
      if (s.phase === 'setup') {
        s.found = a.found;
        while (s.floors.length > F.max) s.floors.pop();
        return { rebuild: true };
      }
      if (a.found === s.found || s.cash < F.cost || s.floors.length > F.max || s.build) return {};
      s.cash -= F.cost;
      s.found = a.found;
      note(s, `Poured a ${F.name.toLowerCase()} · up to ${F.max} floors`);
      return { rebuild: true, refit: true };
    }
    case 'shape':
      s.shape = a.shape;
      return { rebuild: true, refit: true };
    case 'inside':
      s.inside = a.on;
      return { rebuild: true, home: true };
    case 'spin':
      s.spin = a.on;
      return {};
    case 'smoke':
      s.smoke = a.on;
      return { refit: true };
    case 'select':
      s.sel = a.floor;
      return {};
    case 'stitch':
      s.look.stitch = a.size;
      return { layout: true };
    case 'outline':
      s.look.outline = a.hex;
      return {};
    case 'name':
      s.look.name = a.text;
      return { layout: true };
    case 'resolve':
      resolveComplaint(s, a.choice);
      return { rebuild: true };
    case 'reset':
      return { replace: fresh(), rebuild: true, refit: true, layout: true };
  }
}

export const setupIndex = (step: SetupStep) => SETUP.findIndex(x => x.key === step);
