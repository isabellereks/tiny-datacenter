import { MAX_TECHS } from '../game/data';
import { techsOn, note, money, type GameState } from '../game/state';
import { beatDue, happenings } from './beats';
import { GENS, END_MONTH, calendar, dateOf, histGen, histTeams, ym } from './history';
import { computeBooks, marketCap, realMarketCap, settleInventory, startProject, tapeoutCost, tapeoutOdds, type NvState } from './sim';

/*
 * End of every month for the chip company: chips sold and stock left over, design work done, tape-outs, launches,
 * the story's next beat, what the market thinks you're worth, and whether you've run out of money or time.
 */

const n_ = (s: GameState) => s.nv!;
const news = (s: GameState, tag: string, headline: string, ticker: string[]) => { s.news = { id: (s.news?.id ?? 0) + 1, tag, headline, ticker }; note(s, headline); };

/** Engineering teams at work: one per person on a lab floor. */
export const teamsOf = (s: GameState) => s.floors.reduce((t, f, i) => t + (f.done && f.type === 'hall' ? techsOn(s, i) : 0), 0);
export const breaksOf = (s: GameState) => s.floors.filter(f => f.done && f.type === 'break').length;

export function launch(s: GameState, n: NvState, g: number, quality: number) {
  const m = Math.floor(s.month);
  n.gen = g; n.launched = m; n.quality = quality;
  // last generation's chips sell at a discount now
  n.inventory *= 0.7;
  n.reveal = { gen: g, id: Date.now() };
  const late = m - GENS[g].at;
  news(s, 'Tech news', `NVIDIA launches ${GENS[g].name}`, [GENS[g].what, n.mode === 'story' ? dateOf(m) : late > 1 ? `${late} months later than it really shipped` : late < -1 ? `${-late} months earlier than it really shipped` : 'Right on time']);
}

function design(s: GameState, n: NvState) {
  const p = n.project;
  if (!p) return;
  p.progress += teamsOf(s) * (1 + 0.08 * breaksOf(s)) * (s.staff.strike ? 0.3 : 1);
  if (p.progress < p.need) return;
  // first silicon: it works, or it's a respin
  if (Math.random() < tapeoutOdds(n, p.bet) || p.respins >= 2) {
    n.project = null;
    launch(s, n, p.gen, p.bet === 'bold' ? 1.15 : 1);
  } else {
    p.respins++;
    p.need = Math.round(p.need * 1.25);
    const cost = tapeoutCost(Math.floor(s.month));
    s.cash -= cost;
    news(s, 'Tech news', `${GENS[p.gen].name} needs a respin`, ['First silicon has a bug', `${money(cost)} for new masks, months more work`]);
  }
}

/** Story mode follows the real company: chips ship on their real dates and the teams grow as they did. */
function followHistory(s: GameState, n: NvState) {
  const m = Math.floor(s.month), g = histGen(m);
  if (m >= GENS[0].at && g > n.gen) launch(s, n, g, 1);
  const want = histTeams(m);
  // the campus grows like the real one: a second building in 2008, a third in 2018
  const y = calendar(m).year;
  const campus = y >= 2018 ? 3 : y >= 2008 ? 2 : 1;
  while (s.campus < campus) {
    s.floors.push({ type: 'lobby', fill: 'cloth', done: true, cost: 0, b: s.campus });
    s.campus++; s.permits.campus = s.campus - 1;
  }
  // enough lab floors for the teams, built on the spot in the newest building
  while (s.floors.filter(f => f.type === 'hall').length * MAX_TECHS < want) {
    s.floors.push({ type: 'hall', fill: s.floors[1]?.fill ?? 'cloth', done: true, cost: 0, b: s.campus - 1 });
  }
  const labs = s.floors.map((f, i) => ({ f, i })).filter(o => o.f.type === 'hall');
  while (s.workers.length < want) {
    const to = labs.find(o => techsOn(s, o.i) < MAX_TECHS);
    if (!to) break;
    s.workers.push({ id: s.nid++, name: `Team ${s.workers.length + 1}`, floor: to.i, x: (Math.random() - 0.5) * 4, dir: 1, speed: 0.8 + Math.random() * 0.6, pause: 0 });
  }
  while (s.workers.length > want) s.workers.pop();
}

export function nvMonth(s: GameState) {
  const n = n_(s), m = Math.floor(s.month);
  settleInventory(n);
  // wafers paid for ahead come off what the chips cost
  if (n.prepaid) { const use = Math.min(n.prepaid, n.books.cogs * 0.5); n.prepaid -= use; s.cash += use; }
  n.revs = [n.books.revenue, ...n.revs].slice(0, 24);

  if (n.mode === 'story') followHistory(s, n);
  else {
    design(s, n);
    // in your-choices mode a project starts itself the first time, so the first months aren't wasted
    if (n.gen < 0 && !n.project) startProject(n, m, 'safe');
  }
  // the brand drifts back toward neutral
  s.trust += (70 - s.trust) * 0.02;
  happenings(s);

  // market value, and milestones for it
  const cap = marketCap(n, m, s.cash);
  n.peakCap = Math.max(n.peakCap, cap);
  for (const [v, label] of [[1e9, '$1B'], [1e10, '$10B'], [1e11, '$100B'], [1e12, '$1 trillion'], [3e12, '$3 trillion'], [5e12, '$5 trillion']] as const) {
    if (cap >= v && !s.fired.includes(`cap-${v}`)) {
      s.fired.push(`cap-${v}`);
      s.party = { id: (s.party?.id ?? 0) + 1, text: `Worth ${label}` };
    }
  }
  s.tally.best = Math.max(s.tally.best, Math.round(cap / 1e9));

  n.books = computeBooks(n, m + 1, teamsOf(s), s.trust, n.mode === 'story');

  // out of money three months running: it's over; past December 2025, the story ends
  if (s.cash < 0) {
    s.debt++;
    if (s.debt === 1) note(s, 'In the red: month 1 of 3');
  } else s.debt = 0;
  if (s.debt >= 3) { s.phase = 'over'; s.over = { reason: 'broke', t0: Date.now(), done: false }; return; }
  if (m + 1 >= END_MONTH) { s.phase = 'over'; s.over = { reason: 'done', t0: Date.now(), done: false }; return; }

  if (!s.complaint && s.month >= s.calm) s.complaint = beatDue(s);
  if (Math.floor(s.month) % 12 === ym(1994, 1) % 12 && m > 6) s.briefing = true;
  void realMarketCap;
}
