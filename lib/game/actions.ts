import {
  FOUNDS, NAMES, REPAIR_COST, SETUP, STARTER, TYPES,
  type BuildableType, type CustKey, type Fill, type FoundKey, type LocKey, type SetupStep, type ShapeKey, type StitchSize,
} from './data';
import { foundationUpgradeCost, GIFTS, giftWait, impact, resolveComplaint, UPGRADES, type GiftKey } from './events';
import { applyPermit, buildBlock, startLaws, zoningAllows } from './gov';
import { payOff, takeLoan } from './strategy';
import { anchorDeal, canRefresh, decline, endDeal, fastTrack, flexConnect, makeOffer, pitch, refreshCost, reworkDeal, requestGrid, sign, SMR_MONTHS } from './deals';
import { settle as settleStrike, TEAM_EVENT_WAIT, teamEventCost } from './staff';
import { answerCall } from './calls';
import { poachRival } from './rival';
import { fixClaim, LAWYER_COST, settleEarly } from './legal';
import { buyToy, ceoOf } from './ceo';
import { hallForTech, buildCost, buildingCost, buildMonths, crewFreeAt, noCrew, queueFull, fitGen, REPEAT_WAIT, solarCount, turbineCount, unitCost, hasLaw, floorLabel, ownerName, floorPrice, fresh, heightOf, hireFee, ledger, money, maxBuildings, needsBuyout, isBroken, note, setupCost, today, type GameState, type PermitKey, type Upgrades } from './state';

export type Action =
  | { type: 'step'; step: SetupStep }
  | { type: 'height'; n: number }
  | { type: 'fillAll'; fill: Fill }
  | { type: 'open' }
  | { type: 'next'; floor: BuildableType }
  | { type: 'nextFill'; fill: Fill }
  | { type: 'build' }
  | { type: 'fill'; fill: Fill }
  | { type: 'hire'; overseas?: boolean }
  | { type: 'fire'; id: number }
  | { type: 'repair'; floor: number }
  | { type: 'loc'; loc: LocKey }
  | { type: 'cust'; cust: CustKey }
  | { type: 'found'; found: FoundKey }
  | { type: 'shape'; shape: ShapeKey }
  | { type: 'upgrade'; key: keyof Upgrades }
  | { type: 'gift'; key: GiftKey }
  | { type: 'sign'; id: number }
  | { type: 'decline'; id: number }
  | { type: 'refresh'; floor: number }
  | { type: 'grid'; mw: number }
  | { type: 'tierSeen' }
  | { type: 'mute'; on: boolean }
  | { type: 'hints'; on: boolean }
  | { type: 'report' }
  | { type: 'endDeal'; id: number }
  | { type: 'seenTab' }
  | { type: 'poachRival' }
  | { type: 'claim'; id: string; how: 'settle' | 'fix' }
  | { type: 'lawyers'; on: boolean }
  | { type: 'toy'; key: string }
  | { type: 'ceoLook'; suit?: string; hair?: string }
  | { type: 'pitch'; mw: number; months: number; ask: number }
  | { type: 'rework'; id: number; what: 'grow' | 'renew' | 'cut' }
  | { type: 'addUnit'; key: 'turbines' | 'solar' }
  | { type: 'gridFast'; how: 'pay' | 'flex' }
  | { type: 'crews'; n: number }
  | { type: 'permit'; key: PermitKey }
  | { type: 'pay'; level: number }
  | { type: 'benefit'; key: 'health' | 'retire' | 'overtime'; on: boolean }
  | { type: 'teamEvent' }
  | { type: 'settle' }
  | { type: 'addBuilding' }
  | { type: 'speed'; speed: number }
  | { type: 'loan'; amount: number }
  | { type: 'payoff'; id: number }
  | { type: 'briefing' }
  | { type: 'call'; act: 'answer' | 'decline' | 'missed' | 'hangup' | 'choose'; choice?: number }
  | { type: 'bld'; b: number }
  | { type: 'inside'; on: boolean }
  | { type: 'spin'; on: boolean }
  | { type: 'smoke'; on: boolean }
  | { type: 'select'; floor: number }
  | { type: 'stitch'; size: StitchSize }
  | { type: 'outline'; hex: string }
  | { type: 'name'; text: string }
  | { type: 'owner'; text: string }
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
        const i = s.floors.length;
        s.floors.push({ type: STARTER[i], fill: s.floors[i - 1].fill, done: false, cost: floorPrice(s.loc, STARTER[i], i) });
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
      const c = setupCost(s);
      if (c.left < 0) return {};
      settle(s);
      s.phase = 'play';
      s.startFound = s.found;
      startLaws(s);
      s.cash = c.left;
      s.floors.forEach((f, i) => { f.cost = floorPrice(s.loc, f.type, i); });
      s.inside = true;
      s.spin = false;
      s.nextFill = s.floors[s.floors.length - 1].fill;
      s.sel = Math.max(0, s.floors.findIndex(f => f.type === 'hall'));
      s.floors.forEach(f => { if (f.type === 'hall') f.gen = fitGen(s); });
      // your first customer signs for about what your halls can run once they're staffed
      {
        const crew = s.floors.flatMap((f, k) => (f.type === 'hall' ? [0, 1, 2].map(j => ({ id: -k * 3 - j, name: '', floor: k, x: 0, dir: 1 as const, speed: 0, pause: 0 })) : []));
        const mw = ledger({ ...s, workers: crew }).itMW;
        s.deals = [anchorDeal(s, s.cust, mw * 0.7)];
        s.offers = [makeOffer(s)];
      }
      note(s, `${s.look.name.trim() || 'Your datacenter'} is open`);
      return { rebuild: true, layout: true, home: true };
    }
    case 'next':
      s.next = a.floor;
      return {};
    case 'nextFill':
      s.nextFill = a.fill;
      return {};
    case 'build': {
      const cost = buildCost(s);
      if (s.cash < cost || queueFull(s) || heightOf(s, s.bld) >= FOUNDS[s.found].max || buildBlock(s)) return {};
      s.cash -= cost;
      const i = s.floors.length;
      s.floors.push({ type: s.next, fill: s.nextFill, done: false, cost, b: s.bld, gen: s.next === 'hall' ? fitGen(s) : undefined });
      const from = crewFreeAt(s), to = from + buildMonths(s, s.next);
      s.jobs = [...(s.jobs ?? []), { idx: i, from, to, what: 'build' }];
      s.sel = i;
      s.stageMonth = s.month;
      note(s, `${from > s.month ? 'Queued' : 'Building'} a ${TYPES[s.next].name.toLowerCase()}: ${Math.ceil(to - s.month)} months`);
      return { rebuild: true, refit: true };
    }
    case 'fill':
      s.floors[s.sel].fill = a.fill;
      return { rebuild: true };
    case 'hire': {
      const fee = hireFee(s, !!a.overseas);
      const to = hallForTech(s, s.sel);
      if (s.cash < fee || to === null) return {};
      s.cash -= fee;
      const used = new Set(s.workers.map(w => w.name));
      const left = NAMES.filter(n => !used.has(n));
      const name = pick(left.length ? left : NAMES);
      s.workers.push({ id: s.nid++, name, floor: to, x: (Math.random() - 0.5) * 4, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.8 + Math.random() * 0.7, pause: 0, overseas: !!a.overseas, visaAt: a.overseas ? s.month + 12 : undefined });
      s.inside = true;
      note(s, a.overseas ? `Hired ${name} from overseas` : `Hired ${name} from town`);
      return { rebuild: true };
    }
    case 'fire': {
      const w = s.workers.find(x => x.id === a.id);
      if (!w) return {};
      s.workers = s.workers.filter(x => x.id !== a.id);
      // everyone left wonders if they're next; a wave of layoffs makes the news
      const before = s.staff.cuts;
      s.staff.cuts++;
      const hit = 4 + 3 * Math.min(4, s.staff.cuts);
      s.staff.morale = Math.max(0, s.staff.morale - hit);
      s.staff.cheer -= hit / 2;
      note(s, `Let ${w.name} go. Morale −${hit}`);
      if (before < 3 && s.staff.cuts >= 3) {
        s.trust = Math.max(0, s.trust - 4);
        s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Local news', headline: `Layoffs at ${s.look.name.trim() || 'the datacenter'}`, ticker: [`${ownerName(s)} cuts jobs`, 'Remaining techs fear they are next'] };
      }
      return { rebuild: true };
    }
    case 'repair': {
      const fee = today(s, REPAIR_COST);
      if (!isBroken(s, a.floor) || s.cash < fee) return {};
      s.cash -= fee;
      s.broken = s.broken.filter(b => b.floor !== a.floor);
      s.tally.fixed++;
      note(s, `Repair crew fixed ${floorLabel(s, a.floor).toLowerCase()}`);
      return { rebuild: true };
    }
    case 'loc':
      if (s.phase !== 'setup') return {};
      s.loc = a.loc;
      return { rebuild: true, refit: true };
    case 'cust':
      if (s.phase !== 'setup') return {};
      s.cust = a.cust;
      return {};
    case 'found': {
      const F = FOUNDS[a.found];
      if (s.phase === 'setup') {
        s.found = a.found;
        while (s.floors.length > F.max) s.floors.pop();
        return { rebuild: true };
      }
      const cost = foundationUpgradeCost(s, a.found);
      if (s.phase !== 'play' || F.max <= FOUNDS[s.found].max || s.cash < cost || (s.jobs ?? []).length || !zoningAllows(s, a.found)) return {};
      s.cash -= cost;
      s.found = a.found;
      s.stageMonth = s.month;
      note(s, `New foundation. Up to ${F.max} floors.`);
      return { rebuild: true, refit: true };
    }
    case 'shape':
      if (s.phase !== 'setup') return {};
      s.shape = a.shape;
      return { rebuild: true, refit: true };
    case 'upgrade': {
      const u = UPGRADES.find(x => x.key === a.key);
      if (!u || s.phase !== 'play' || s.up[a.key] || s.tier < u.tier || s.cash < today(s, u.cost)) return {};
      if (a.key === 'smr') {
        if (s.smrAt !== null) return {};
        s.cash -= today(s, u.cost);
        s.smrAt = s.month + SMR_MONTHS;
        note(s, `Reactor under construction. Online in ${SMR_MONTHS / 12} years`);
        return { rebuild: true };
      }
      s.cash -= today(s, u.cost);
      s.up[a.key] = true;
      note(s, `Built ${u.name.toLowerCase()}`);
      return { rebuild: true };
    }
    case 'addUnit': {
      // turbines and solar farms: as many as you like, a few months apart, each a little dearer
      const u = UPGRADES.find(x => x.key === a.key);
      const n = a.key === 'turbines' ? turbineCount(s) : solarCount(s);
      const cost = unitCost(s, a.key, n);
      if (!u || s.phase !== 'play' || s.tier < u.tier || s.cash < cost || (s.cooldown[`unit-${a.key}`] ?? 0) > s.month) return {};
      s.cash -= cost;
      s.units = { turbines: turbineCount(s), solar: solarCount(s) };
      s.units[a.key] = n + 1;
      s.up[a.key] = true;
      s.cooldown[`unit-${a.key}`] = s.month + REPEAT_WAIT;
      note(s, `${u.name}: now ${n + 1}`);
      return { rebuild: true };
    }
    case 'gift': {
      const g = GIFTS.find(x => x.key === a.key);
      if (!g || s.phase !== 'play' || s.cash < today(s, g.cost) || giftWait(s, g.key) > 0) return {};
      if (g.key === 'trees' && impact(s).cleared === 0) return {};
      s.cash -= today(s, g.cost);
      if (g.key === 'trees') s.replanted += 6;
      if (g.key === 'park') s.replanted += 10;
      if (g.key === 'scholarship') s.trained = (s.trained ?? 0) + 3;
      if (g.key === 'bills') s.billRelief = s.month + 12;
      if (g.wait) s.cooldown[`gift-${g.key}`] = s.month + g.wait;
      if (g.key === 'meeting') {
        // a meeting is a gamble: a friendly room listens, an angry one heckles
        const d = s.trust >= 50 || Math.random() < 0.5 ? 3 : -3;
        s.trust = Math.max(0, Math.min(100, s.trust + d));
        note(s, d > 0 ? 'Town meeting went well. Trust +3' : 'Heckled at the town meeting. Trust −3');
        return {};
      }
      s.trust = Math.min(100, s.trust + g.trust);
      s.goodwill += g.trust / 2;
      note(s, `${g.name}. Trust +${g.trust}`);
      return { rebuild: g.key === 'trees' || g.key === 'park' };
    }
    case 'sign':
      if (s.phase !== 'play') return {};
      sign(s, a.id);
      return {};
    case 'decline':
      decline(s, a.id);
      return {};
    case 'refresh': {
      const cost = refreshCost(s);
      if (s.phase !== 'play' || !canRefresh(s, a.floor) || s.cash < cost) return {};
      s.cash -= cost;
      const f = s.floors[a.floor];
      f.gen = fitGen(s);
      f.done = false;
      s.jobs = [...(s.jobs ?? []), { idx: a.floor, from: s.month, to: s.month + 2, what: 'refit' }];
      note(s, `Refitting ${floorLabel(s, a.floor).toLowerCase()} with new chips`);
      return { rebuild: true };
    }
    case 'grid':
      if (s.phase !== 'play') return {};
      requestGrid(s, a.mw);
      return {};
    case 'claim':
      if (s.phase !== 'play') return {};
      if (a.how === 'settle') settleEarly(s, a.id); else fixClaim(s, a.id);
      return {};
    case 'toy':
      if (s.phase !== 'play') return {};
      return buyToy(s, a.key) ? { rebuild: true } : {};
    case 'ceoLook': {
      const c = ceoOf(s);
      s.ceo = { ...c, suit: a.suit ?? c.suit, hair: a.hair ?? c.hair };
      return { rebuild: true };
    }
    case 'lawyers':
      s.lawyers = a.on;
      note(s, a.on ? `Law firm on retainer: ${money(today(s, LAWYER_COST))}/mo` : 'Let the law firm go');
      return {};
    case 'poachRival':
      if (s.phase !== 'play') return {};
      poachRival(s, ledger(s));
      return {};
    case 'seenTab':
      s.newTab = null;
      return {};
    case 'tierSeen':
      s.tierUp = null;
      return {};
    case 'mute':
      s.muted = a.on;
      return {};
    case 'hints':
      s.hints = a.on;
      return {};
    case 'permit':
      if (s.phase !== 'play') return {};
      applyPermit(s, a.key);
      return {};
    case 'pay':
      if (s.phase !== 'play' || s.staff.union && a.level < s.staff.pay) return {};
      s.staff.pay = Math.max(0, Math.min(2, a.level));
      note(s, `Pay set to ${['standard', '+10%', '+20%'][s.staff.pay]}`);
      return {};
    case 'benefit':
      if (s.phase !== 'play') return {};
      // a union contract locks in health insurance
      if (a.key === 'health' && !a.on && s.staff.union) return {};
      s.staff[a.key] = a.on;
      note(s, `${{ health: 'Health insurance', retire: 'Retirement plan', overtime: 'Overtime' }[a.key]} ${a.on ? 'on' : 'off'}`);
      return {};
    case 'settle': {
      if (s.phase !== 'play' || !s.staff.strike) return {};
      settleStrike(s);
      return {};
    }
    case 'teamEvent': {
      const cost = teamEventCost(s);
      if (s.phase !== 'play' || s.cash < cost || (s.cooldown.team ?? 0) > s.month || !s.workers.length) return {};
      s.cash -= cost;
      s.staff.cheer += 10;
      s.cooldown.team = s.month + TEAM_EVENT_WAIT;
      note(s, 'Team event. Morale +10');
      return {};
    }
    case 'addBuilding': {
      const cost = buildingCost(s);
      if (s.phase !== 'play' || noCrew(s) || hasLaw(s, 'moratorium') || s.campus >= maxBuildings(s) || s.campus > s.permits.campus || s.cash < cost) return {};
      // past the land you started with, the neighbors sell, and the town notices
      if (needsBuyout(s)) { s.trust = Math.max(0, s.trust - 3); note(s, 'Bought out the neighbors. Trust −3'); }
      s.cash -= cost;
      // every building opens with a ground floor; here it's a server hall
      s.floors.push({ type: 'hall', fill: s.nextFill, done: false, cost: floorPrice(s.loc, 'hall', 0), b: s.campus, gen: fitGen(s) });
      s.bld = s.campus;
      s.campus++;
      s.jobs = [...(s.jobs ?? []), { idx: s.floors.length - 1, from: s.month, to: s.month + 6, what: 'build' }];
      s.sel = s.floors.length - 1;
      s.stageMonth = s.month;
      note(s, `Building ${s.campus} started`);
      return { rebuild: true, refit: true };
    }
    case 'loan':
      if (s.phase !== 'play') return {};
      takeLoan(s, a.amount);
      return {};
    case 'payoff':
      payOff(s, a.id);
      return {};
    case 'briefing':
      s.briefing = false;
      s.report = null;
      return {};
    case 'report':
      s.report = null;
      return {};
    case 'crews':
      if (s.phase !== 'play') return {};
      s.crews = Math.max(Math.max(2, (s.jobs ?? []).length), Math.min(6, a.n));
      note(s, `${s.crews} construction crews on contract`);
      return {};
    case 'gridFast':
      if (s.phase !== 'play') return {};
      if (a.how === 'pay') fastTrack(s); else flexConnect(s);
      return {};
    case 'endDeal':
      if (s.phase !== 'play') return {};
      endDeal(s, a.id);
      return {};
    case 'pitch':
      if (s.phase !== 'play') return {};
      pitch(s, ledger(s), a.mw, a.months, a.ask);
      return {};
    case 'rework':
      if (s.phase !== 'play') return {};
      reworkDeal(s, ledger(s), a.id, a.what);
      return {};
    case 'call': {
      const c = s.call;
      if (!c) return {};
      // picking up and listening helps a little; ignoring people stings
      if (a.act === 'answer') { c.answered = true; if (c.mood === 'mad') s.trust = Math.min(100, s.trust + 1); return {}; }
      if (a.act === 'choose') answerCall(s, a.choice ?? 1);
      if (a.act === 'decline' && c.mood === 'mad') { s.trust = Math.max(0, s.trust - 1); note(s, `Declined a call from ${c.who}. Trust −1`); }
      if (a.act === 'missed' && c.mood === 'mad') { s.trust = Math.max(0, s.trust - 2); note(s, `Missed a call from ${c.who}. Trust −2`); }
      s.call = null;
      // a breather before the next letter or call
      s.calm = Math.max(s.calm, Math.floor(s.month) + 1);
      return {};
    }
    case 'speed':
      s.speed = Math.max(0, Math.min(4, a.speed));
      return {};
    case 'bld':
      if (a.b < 0 || a.b >= s.campus) return {};
      s.bld = a.b;
      return {};
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
      // a tall building scrolls to the floor you picked
      return { refit: s.phase === 'play' };
    case 'stitch':
      s.look.stitch = a.size;
      return { layout: true };
    case 'outline':
      s.look.outline = a.hex;
      return {};
    case 'name':
      s.look.name = a.text;
      return { layout: true, refit: true };
    case 'owner':
      s.look.owner = a.text;
      return {};
    case 'resolve':
      resolveComplaint(s, a.choice);
      return { rebuild: true, home: s.phase === 'over' };
    case 'reset':
      return { replace: fresh(), rebuild: true, refit: true, layout: true };
  }
}

export const setupIndex = (step: SetupStep) => SETUP.findIndex(x => x.key === step);
