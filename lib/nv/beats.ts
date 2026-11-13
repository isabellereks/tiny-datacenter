import type { Decision, GovChoice } from '../game/gov';
import { money, note, type GameState } from '../game/state';
import { GENS, ym } from './history';
import { has, type NvState } from './sim';

/*
 * The moments that made the company, on the real dates. Each is a letter with a choice; the first choice is what
 * actually happened. In story mode that's the only choice.
 */

interface Beat {
  id: string; at: number; from: string; title: string; body: string;
  /** only comes up if this holds */
  when?: (s: GameState, n: NvState) => boolean;
  choices: { label: string; note: string; cost?: (s: GameState) => number; apply: (s: GameState, n: NvState) => void }[];
}

const nv = (s: GameState) => s.nv!;
const flag = (n: NvState, f: string) => { if (!n.flags.includes(f)) n.flags.push(f); };
const brand = (s: GameState, d: number) => { s.trust = Math.max(0, Math.min(100, s.trust + d)); };
const news = (s: GameState, tag: string, headline: string, ticker: string[]) => { s.news = { id: (s.news?.id ?? 0) + 1, tag, headline, ticker }; note(s, headline); };

export const BEATS: Beat[] = [
  {
    id: 'vc', at: ym(1993, 5), from: 'Sequoia Capital', title: 'Sequoia and Sutter Hill will put in $20M',
    body: 'Three engineers, a plan sketched at a Denny\'s, and $40K between them. The VCs want a big share of the company.',
    choices: [
      { label: 'Take the $20M', note: 'They own a big share', apply: (s, n) => { s.cash += 20e6; n.stake = 0.6; } },
      { label: 'Stay on $40K', note: 'Keep it all', apply: (_, n) => { n.stake = 1; } },
    ],
  },
  {
    id: 'sega', at: ym(1994, 12), from: 'Sega', title: 'Sega wants your chips in its next console',
    body: 'Sega will pay development fees for a console chip built on your curved-surface design.',
    choices: [
      { label: 'Sign with Sega', note: 'Development fees', apply: (_, n) => flag(n, 'sega') },
      { label: 'Stay PC only', note: 'No fees', apply: () => {} },
    ],
  },
  {
    id: 'quad', at: ym(1995, 2), from: 'Your engineers', title: 'Microsoft is going with triangles',
    body: 'DirectX will draw 3D with triangles. NV1 draws curved surfaces. Games written for DirectX won\'t run well on it.',
    when: (_, n) => n.gen < 0,
    choices: [
      { label: 'Ship NV1 as designed', note: 'NV1 sells poorly', apply: (_, n) => flag(n, 'quad') },
      { label: 'Redesign for triangles', note: 'Chip work +30%, NV1 sells better', apply: (_, n) => { flag(n, 'triangles'); if (n.project) n.project.need = Math.round(n.project.need * 1.3); } },
    ],
  },
  {
    id: 'sega2', at: ym(1996, 3), from: 'Your engineers', title: 'The Sega chip can\'t win',
    body: 'The industry moved to triangles. The console chip you owe Sega will be behind before it ships.',
    when: (_, n) => has(n, 'sega'),
    choices: [
      { label: 'Ask Sega to let you go, and pay anyway', note: 'Sega invests $5M', apply: s => { s.cash += 5e6; } },
      { label: 'Keep building it', note: 'Console fees run out later', apply: (_, n) => flag(n, 'segaStay') },
    ],
  },
  {
    id: 'layoffs', at: ym(1996, 6), from: 'Your CFO', title: 'Cash for months, not years',
    body: 'Sales are tiny and the payroll isn\'t. Laying off more than half the company buys time to finish the next chip.',
    choices: [
      { label: 'Lay off more than half', note: 'Teams cut in half', apply: s => { s.workers = s.workers.slice(0, Math.max(1, Math.ceil(s.workers.length / 2))); brand(s, -2); } },
      { label: 'Keep everyone', note: 'Payroll stays', apply: () => {} },
    ],
  },
  {
    id: 'emulator', at: ym(1997, 1), from: 'Your engineers', title: 'Buy a hardware emulator?',
    body: 'A $1M emulator lets you test RIVA 128 before tape-out. It\'s about half the cash you have.',
    choices: [
      { label: 'Buy it', note: 'Tape-outs work more often', cost: () => 1e6, apply: (_, n) => flag(n, 'emulator') },
      { label: 'Skip it', note: 'Keep the cash', apply: () => {} },
    ],
  },
  {
    id: 'ipo', at: ym(1999, 1), from: 'Morgan Stanley', title: 'Go public at $12 a share?',
    body: 'The IPO would raise about $42M and put a price on the company every day from now on.',
    choices: [
      { label: 'Go public', note: '+$42M, market value', apply: (s, n) => { n.ipo = true; s.cash += 42e6; } },
      { label: 'Stay private', note: 'Ask again in a year', apply: (s, n) => { s.cooldown['nv-ipo'] = Math.floor(s.month) + 12; flag(n, 'ipoLater'); } },
    ],
  },
  {
    id: 'xbox', at: ym(2000, 3), from: 'Microsoft', title: 'Microsoft wants your chip in the Xbox',
    body: 'A console of its own, with a $200M advance. Consoles sell in huge numbers at thin margins.',
    choices: [
      { label: 'Take the Xbox deal', note: '+$200M advance, console sales', apply: (s, n) => { s.cash += 200e6; flag(n, 'xbox'); } },
      { label: 'Pass', note: 'Stay on PCs', apply: () => {} },
    ],
  },
  {
    id: '3dfx', at: ym(2000, 12), from: '3dfx', title: 'Your old rival is going under',
    body: '3dfx, once the king of 3D, will sell its patents and engineers for about $70M.',
    choices: [
      { label: 'Buy 3dfx\'s assets', note: 'Their engineers and patents', cost: () => 70e6, apply: (s, n) => { flag(n, '3dfx'); brand(s, 3); } },
      { label: 'Pass', note: 'Gaming sales −5% for years', apply: () => {} },
    ],
  },
  {
    id: 'fx', at: ym(2003, 3), from: 'The press', title: 'GeForce FX is losing to ATI',
    body: 'The Radeon 9700 is faster, and reviewers say your drivers cut corners on benchmarks.',
    choices: [
      { label: 'Defend the drivers', note: 'Brand −6', apply: s => brand(s, -6) },
      { label: 'Admit it, cut prices', note: 'Brand +2, cash −$30M', cost: () => 30e6, apply: s => brand(s, 2) },
    ],
  },
  {
    id: 'cuda', at: ym(2006, 11), from: 'Your engineers', title: 'Put CUDA on every GPU?',
    body: 'CUDA lets scientists program the GPU. Putting it on every gaming chip costs margin for years, and Wall Street hates it.',
    choices: [
      { label: 'CUDA on every GPU', note: 'Costs margin for years', apply: (_, n) => flag(n, 'cudaAll') },
      { label: 'Only on pro cards', note: 'Margin +2 pts until 2012', apply: () => {} },
    ],
  },
  {
    id: 'bumpgate', at: ym(2008, 7), from: 'Laptop makers', title: 'Your laptop chips are failing',
    body: 'A packaging flaw makes some mobile GPUs die in the heat. Dell, HP and Apple want it fixed.',
    choices: [
      { label: 'Take a $200M charge', note: 'Pay for repairs', cost: () => 200e6, apply: () => {} },
      { label: 'Say it\'s rare', note: 'Brand −8, lawsuits later', apply: (s, n) => { brand(s, -8); flag(n, 'bumpDenied'); } },
    ],
  },
  {
    id: 'bumpSuit', at: ym(2010, 6), from: 'A class action firm', title: 'The laptop owners are suing',
    body: 'Owners of the failed laptops want damages.', when: (_, n) => has(n, 'bumpDenied'),
    choices: [{ label: 'Settle for $400M', note: 'Pay', cost: () => 400e6, apply: () => {} }],
  },
  {
    id: 'deepLearning', at: ym(2012, 10), from: 'University of Toronto', title: 'AlexNet trained on two GTX 580s',
    body: 'A neural network trained on your gaming cards just crushed the ImageNet contest. Researchers are buying GPUs by the box.',
    choices: [
      { label: 'Go all in on deep learning', note: 'Software, libraries, data center', apply: (_, n) => flag(n, 'deepLearning') },
      { label: 'Stay a gaming company', note: 'AI is a fad', apply: () => {} },
    ],
  },
  {
    id: 'dgx', at: ym(2016, 8), from: 'OpenAI', title: 'Who gets the first DGX-1?',
    body: 'Your first AI supercomputer in a box, $129K. A small nonprofit AI lab in San Francisco wants one.',
    choices: [
      { label: 'Hand-deliver it to the nonprofit', note: 'Friends in AI', apply: (_, n) => flag(n, 'dgx') },
      { label: 'Sell it to a big customer', note: '+$129K', apply: s => { s.cash += 129e3; } },
    ],
  },
  {
    id: 'crypto', at: ym(2017, 9), from: 'Your sales team', title: 'Miners are buying every gaming card',
    body: 'Crypto miners pay anything. Gamers can\'t find cards. Booms like this end.',
    choices: [
      { label: 'Sell to miners', note: 'Gluts when it crashes', apply: (_, n) => flag(n, 'cryptoChase') },
      { label: 'Hold cards for gamers', note: 'Brand +4, crypto sales −50%', apply: (s, n) => { flag(n, 'cryptoCap'); brand(s, 4); } },
    ],
  },
  {
    id: 'mellanox', at: ym(2019, 3), from: 'Mellanox', title: 'Buy Mellanox for $6.9B?',
    body: 'Mellanox makes the networking that ties thousands of GPUs into one machine.',
    choices: [
      { label: 'Buy Mellanox', note: 'Networking for AI clusters', cost: () => 6.9e9, apply: (_, n) => flag(n, 'mellanox') },
      { label: 'Pass', note: 'Data center sales −7%', apply: () => {} },
    ],
  },
  {
    id: 'arm', at: ym(2020, 9), from: 'SoftBank', title: 'Buy Arm for $40B in stock?',
    body: 'Arm designs the cores in nearly every phone. Regulators in three countries will have a say.',
    choices: [
      { label: 'Bid for Arm', note: '$1.25B down, regulators decide', cost: () => 1.25e9, apply: (s, n) => { n.armAt = ym(2022, 2); } },
      { label: 'Pass', note: 'No deal', apply: () => {} },
    ],
  },
  {
    id: 'sec', at: ym(2022, 5), from: 'The SEC', title: 'You didn\'t tell investors about crypto',
    body: 'The SEC says you hid how much gaming revenue came from miners.', when: (_, n) => has(n, 'cryptoChase'),
    choices: [{ label: 'Settle for $5.5M', note: 'Pay', cost: () => 5.5e6, apply: () => {} }],
  },
  {
    id: 'export', at: ym(2022, 9), from: 'US Commerce Department', title: 'No more A100s or H100s to China',
    body: 'A new rule bars your best AI chips from China, about a fifth of data center sales.',
    choices: [
      { label: 'Make a slower chip for China', note: 'Keep most China sales', apply: (_, n) => flag(n, 'chinaChip') },
      { label: 'Leave China', note: 'Data center sales −15%', apply: () => {} },
    ],
  },
  {
    id: 'allIn', at: ym(2022, 12), from: 'TSMC', title: 'ChatGPT has 1 million users in 5 days',
    body: 'Every AI lab will want H100s. TSMC will lock in wafers for you if you commit billions now.',
    choices: [
      { label: 'Prepay $10B for wafers', note: 'Enough chips for the boom', cost: () => 10e9, apply: (_, n) => { flag(n, 'allIn'); n.prepaid = 10e9; } },
      { label: 'Wait and see', note: 'Short of chips in 2023-24', apply: () => {} },
    ],
  },
  {
    id: 'h20', at: ym(2025, 4), from: 'US Commerce Department', title: 'The China chip needs a license now',
    body: 'Even the slower chip made for China now needs a license that isn\'t coming.', when: (_, n) => has(n, 'chinaChip'),
    choices: [{ label: 'Write off $5.5B of chips', note: 'Pay', cost: () => 5.5e9, apply: () => {} }],
  },
];

/** The letter for a beat: every choice in your-choices mode, only what happened in story mode. */
function toDecision(b: Beat, story: boolean): Decision {
  const choices: GovChoice[] = (story ? b.choices.slice(0, 1) : b.choices).map(c => ({
    label: c.label, note: story ? 'What happened' : c.note, cost: c.cost, apply: s => c.apply(s, nv(s)),
  }));
  return { id: story ? `nv-${b.id}:story` : `nv-${b.id}`, from: () => b.from, title: () => b.title, body: () => b.body, choices };
}
export const NV_DECISIONS = (): Decision[] => BEATS.flatMap(b => [toDecision(b, false), toDecision(b, true)]);

/** The beat due this month, if any, as a decision id. */
export function beatDue(s: GameState): string | null {
  const n = nv(s), m = Math.floor(s.month);
  const b = BEATS.find(x => !s.fired.includes(`nv-${x.id}`) && x.at <= m && (x.when?.(s, n) ?? true));
  if (!b) return null;
  s.fired.push(`nv-${b.id}`);
  return n.mode === 'story' ? `nv-${b.id}:story` : `nv-${b.id}`;
}

/** Things that just happen: the Arm verdict, crypto busts, DeepSeek. */
export function happenings(s: GameState) {
  const n = nv(s), m = Math.floor(s.month);
  const once = (id: string) => { if (s.fired.includes(id)) return false; s.fired.push(id); return true; };
  if (n.armAt !== undefined && m >= n.armAt) {
    n.armAt = undefined;
    if (Math.random() < 0.85) news(s, 'Business news', 'Arm deal collapses under regulators', ['US, UK and EU objections', `${money(1.25e9)} down payment lost`]);
    else { n.flags.push('armOwned'); news(s, 'Business news', 'NVIDIA closes the Arm deal', ['Regulators wave it through', 'Phones and servers run your cores']); }
  }
  // crypto busts leave cards nobody wants
  for (const [id, at] of [['bust18', ym(2018, 10)], ['bust22', ym(2022, 6)]] as const) {
    if (m >= at && once(id)) {
      const hit = has(n, 'cryptoChase') ? 0.5 : 0.25;
      n.inventory *= 1 - hit;
      news(s, 'Business news', 'Crypto crash leaves a glut of graphics cards', [`Inventory written down ${Math.round(hit * 100)}%`, 'Stock falls by half']);
    }
  }
  if (m >= ym(2025, 1) && once('deepseek')) news(s, 'Breaking news', 'DeepSeek shock: chip stocks plunge', ['A cheap Chinese AI model rattles investors', 'Biggest one-day loss in market history']);
  if (m >= ym(2022, 12) && once('chatgpt')) news(s, 'Tech news', 'ChatGPT reaches 100 million people', ['Fastest-growing app ever', 'It runs on your GPUs']);
  if (m >= ym(1993, 4) && once('founded')) news(s, 'Local news', 'Three engineers start a graphics chip company', ['Planned at a Denny\'s in East San Jose', `Next stop: ${GENS[0].name}`]);
}
