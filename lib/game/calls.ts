import { LOCS } from './data';
import { freeMW } from './deals';
import { hopedJobs, impact } from './events';
import { allocate, dealPrice, ledger, liveDeals, locals, money, note, overseas, siteName, tallest, today, type GameState, type Ledger } from './state';

/*
 * Townspeople phone you. What they yell about comes from what you're actually doing to them:
 * cut trees, noise, power bills, water, jobs, the skyline. Answer and they feel heard; let it ring and they don't.
 */

export interface Call {
  id: number; who: string; line: string; mood: 'mad' | 'glad' | 'biz'; t0: number; answered: boolean;
  /** business calls ask something: what kind, what you can say, and the numbers behind it */
  biz?: string; choices?: string[]; data?: { deal?: number; mw?: number; cash?: number };
}

type Topic = 'trees' | 'water' | 'noise' | 'bills' | 'jobs' | 'overseas' | 'angry' | 'strike' | 'heat' | 'fan' | 'school' | 'blackout';

/** People in town, and what each of them tends to call about. */
const CALLERS: { who: string; cares: Topic[] }[] = [
  { who: 'Linda on Maple Street', cares: ['noise', 'trees', 'angry'] },
  { who: 'Gary, retired', cares: ['bills', 'angry', 'heat'] },
  { who: 'Deb from the PTA', cares: ['school', 'jobs', 'trees'] },
  { who: 'Marcus next door', cares: ['noise', 'blackout', 'angry'] },
  { who: 'Pastor Jim', cares: ['jobs', 'bills', 'fan'] },
  { who: 'Rosa at the diner', cares: ['jobs', 'fan', 'blackout'] },
  { who: 'A very tired dad', cares: ['noise', 'bills', 'blackout'] },
  { who: 'Coach Dave', cares: ['trees', 'school', 'jobs'] },
  { who: 'Mrs. Albright', cares: ['trees', 'angry', 'heat'] },
  { who: 'Tom, farmer', cares: ['water', 'trees', 'bills'] },
  { who: 'Priya, nurse', cares: ['noise', 'blackout', 'strike'] },
  { who: 'The HOA president', cares: ['noise', 'angry', 'trees'] },
  { who: 'Walt at the hardware store', cares: ['jobs', 'overseas', 'fan'] },
  { who: 'Jen, new in town', cares: ['water', 'noise', 'fan'] },
  { who: 'A union rep', cares: ['strike', 'overseas', 'jobs'] },
  { who: 'Ellie, age 9', cares: ['trees', 'fan', 'school'] },
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Who they threaten to call, by place. */
const rep = (s: GameState) => (LOCS[s.loc].gov.us ? 'SENATOR' : s.loc === 'dublin' ? 'TD' : 'MP');

/** The loudest word in your datacenter's name, for name-calling. */
function nickname(s: GameState) {
  const words = siteName(s).split(/\s+/).filter(w => w.length > 2 && !/^(the|datacenter|data|center|compute|inc|llc)$/i.test(w));
  return `BIG ${(words[0] ?? 'DATA').toUpperCase()}`;
}

/** What people say about each thing. Several lines each, so the phone doesn't sound like a recording. */
function lines(s: GameState, topic: Topic): string[] {
  const l = ledger(s), i = impact(s, l);
  const site = siteName(s).toUpperCase(), nick = nickname(s);
  switch (topic) {
    case 'trees': return [
      `YOU CUT DOWN THE TREE MY KIDS CLIMBED. ${i.cleared} TREES. I COUNTED.`,
      'THE OWLS ARE GONE. I USED TO HEAR THEM EVERY NIGHT. NOW I HEAR YOUR FANS.',
      `WHERE THE WOODS WERE THERE'S A PARKING LOT. THANKS, ${nick}.`,
      'MY DOG WON\'T WALK THAT WAY ANYMORE. SHE MISSES THE TREES. SO DO I.',
    ];
    case 'water': return [
      'MY TAP IS SPUTTERING AND YOU\'RE POURING WATER ON COMPUTERS?',
      `MY WELL IS DOWN TWO FEET THIS YEAR. ${l.waterML.toFixed(1)} MILLION LITRES A MONTH, ${nick}. A MONTH.`,
      'THE CREEK BEHIND MY HOUSE USED TO HAVE FISH IN IT.',
      'I\'M ON WATER RESTRICTIONS. I CAN\'T WATER MY GARDEN. BUT YOUR SERVERS CAN DRINK?',
    ];
    case 'noise': return [
      'IT\'S 3 AM AND YOUR FANS ARE HUMMING THROUGH MY WALLS. I CAN FEEL IT IN MY TEETH.',
      'MY BABY FINALLY SLEPT AND THEN YOUR GENERATORS STARTED THEIR TEST. AT 6 AM.',
      `THE HUM NEVER STOPS. NOT ON SUNDAYS. NOT ON CHRISTMAS. NEVER, ${nick}.`,
      'I BOUGHT EARPLUGS. THEN BETTER EARPLUGS. NOW I\'M CALLING YOU.',
      s.up.turbines ? 'YOUR GAS TURBINES SOUND LIKE A JET THAT NEVER TAKES OFF.' : 'I MOVED HERE FOR THE QUIET. HOW\'S THAT WORKING OUT FOR ME?',
    ];
    case 'bills': return [
      `MY POWER BILL WENT UP AGAIN. I KNOW IT'S YOU, ${nick}.`,
      'I\'M ON A FIXED INCOME. I CAN\'T PAY FOR YOUR COMPUTERS TOO.',
      `THE UTILITY SAYS IT'S "NEW DEMAND." I LOOKED OUT MY WINDOW. IT'S ${site}.`,
      'I TURNED THE HEAT DOWN TO 60 SO YOU COULD TRAIN YOUR ROBOTS. HAPPY?',
    ];
    case 'blackout': return [
      'THE POWER WENT OUT DURING DINNER. AGAIN. MY FREEZER IS THAWING AS WE SPEAK.',
      'MY MOM IS ON OXYGEN. WHEN THE POWER GOES OUT, THAT\'S NOT AN INCONVENIENCE.',
      `THE WHOLE STREET WENT DARK BUT ${site} WAS LIT UP LIKE A CHRISTMAS TREE.`,
    ];
    case 'jobs': return [
      'YOU SAID JOBS. MY SON APPLIED. NOTHING. NOT EVEN AN EMAIL.',
      `${locals(s)} LOCAL JOBS. THE MALL USED TO HIRE MORE THAN THAT AT CHRISTMAS.`,
      'THE COUNTY GAVE YOU A TAX BREAK FOR JOBS. WHERE ARE THEY?',
      'I DROVE PAST YOUR PARKING LOT. FOUR CARS. FOUR.',
    ];
    case 'overseas': return [
      'YOU HIRED FROM OVERSEAS? MY NEPHEW IS A TECH. HE LIVES IN MY BASEMENT.',
      'THERE ARE PEOPLE RIGHT HERE WHO CAN FIX A SERVER. TRAIN THEM.',
      'THE COMMUNITY COLLEGE HAS A WHOLE IT PROGRAM. DID YOU EVEN CALL THEM?',
    ];
    case 'angry': return [
      `I HATE ${site}. I'M TELLING MY ${rep(s)} ON YOU, ${nick}.`,
      `WE'RE ORGANIZING. BRING EARPLUGS, ${nick}. WE'RE BRINGING MEGAPHONES.`,
      'THERE\'S A MEETING AT THE LIBRARY ON TUESDAY. IT\'S ABOUT YOU. YOU\'RE NOT INVITED.',
      `MY WHOLE BOOK CLUB HATES ${site}. WE DON'T AGREE ON ANYTHING. WE AGREE ON THIS.`,
    ];
    case 'strike': return [
      'MY HUSBAND WORKS FOR YOU AND HE\'S ON THE PICKET LINE IN THE COLD. PAY HIM.',
      'I BROUGHT COFFEE TO YOUR STRIKERS THIS MORNING. THE WHOLE TOWN IS.',
    ];
    case 'heat': return [
      'MY HOUSE IS WARM AND MY HEATING BILL IS HALF. I DON\'T EVEN MIND THE HUM.',
      'I WAS READY TO HATE YOU. THEN MY RADIATORS STARTED WORKING FOR FREE.',
    ];
    case 'fan': return [
      `I USED TO HATE ${site}. MY DAUGHTER WORKS THERE NOW. SHE LOVES IT. OKAY. BYE.`,
      'YOUR TECHS EAT AT MY DINER EVERY DAY. BEST YEAR I\'VE HAD. JUST WANTED TO SAY.',
      'MY SON GOT HIRED. HE WEARS THE LANYARD TO DINNER. HE\'S SO PROUD.',
    ];
    case 'school': return [
      'THANK YOU FOR THE SCHOOL MONEY. THE KIDS GOT NEW COMPUTERS. IRONIC, RIGHT?',
      'THE ROBOTICS CLUB WENT TO STATE. YOUR LOGO WAS ON THEIR SHIRTS.',
    ];
  }
}

/** What's actually going on that someone could call about. */
function topics(s: GameState): Topic[] {
  const l = ledger(s), i = impact(s, l);
  const out: Topic[] = [];
  if (i.cleared >= 6) out.push('trees');
  if (i.waterML >= 3 && !s.up.closedLoop && !s.up.liquid) out.push('water');
  if ((tallest(s) >= 6 || s.up.turbines) && !s.up.soundWalls) out.push('noise');
  if (l.strain >= 0.6) out.push('bills');
  if (s.gridLevel >= 3) out.push('blackout');
  if (locals(s) < hopedJobs(s) * 0.5 && hopedJobs(s) > 0) out.push('jobs');
  if (overseas(s) > locals(s) && overseas(s) >= 2) out.push('overseas');
  if (s.trust < 45) out.push('angry');
  if (s.staff.strike) out.push('strike');
  if (s.up.heat) out.push('heat');
  if (s.trust >= 70 && locals(s) >= 2) out.push('fan');
  if (s.goodwill > 4) out.push('school');
  return out;
}
const GLAD: Topic[] = ['heat', 'fan', 'school'];

// ---------- business calls: someone wants something, and you answer on the spot ----------

interface Biz {
  when: (s: GameState, l: Ledger) => boolean;
  make: (s: GameState, l: Ledger) => Pick<Call, 'who' | 'line' | 'choices' | 'data'>;
  /** what each answer does; the first choice is yes */
  answer: (s: GameState, choice: number, data: NonNullable<Call['data']>) => void;
}

const happy = (s: GameState) => liveDeals(s).filter(d => d.strikes === 0);

const BIZ: Record<string, Biz> = {
  // a customer wants more power, a little above what they pay now
  more: {
    when: (s, l) => freeMW(s, l) >= 1 && happy(s).length > 0,
    make: (s, l) => {
      const d = pick(happy(s));
      const mw = Math.min(freeMW(s, l), Math.max(1, Math.round(d.mw * 0.3)));
      return {
        who: d.who, data: { deal: d.id, mw },
        line: `${d.who.toUpperCase()} HERE. WE NEED ${mw} MORE MW, STARTING NEXT MONTH. SAME TERMS. CAN YOU DO IT?`,
        choices: [`Yes, +${mw} MW  ${money(mw * 1000 * dealPrice(s, d))}/mo`, 'Not now'],
      };
    },
    answer: (s, c, x) => {
      const d = s.deals.find(y => y.id === x.deal);
      if (c === 0 && d && x.mw) { d.mw += x.mw; note(s, `${d.who} took ${x.mw} more MW`); }
    },
  },
  // a customer you're shorting wants to know why
  short: {
    when: (s, l) => allocate(s, l.itMW).some(a => a.got < a.d.mw * 0.95 && a.d.strikes > 0),
    make: (s, l) => {
      const a = pick(allocate(s, l.itMW).filter(y => y.got < y.d.mw * 0.95 && y.d.strikes > 0));
      const credit = Math.round((a.d.mw - a.got) * 1000 * dealPrice(s, a.d));
      return {
        who: a.d.who, data: { deal: a.d.id, cash: credit },
        line: `WE PAY FOR ${a.d.mw} MW. WE GOT ${a.got.toFixed(1)}. STRIKE ${a.d.strikes} OF 3. WHAT ARE YOU DOING ABOUT IT?`,
        choices: [`Credit them ${money(credit)}, strike −1`, 'Working on it'],
      };
    },
    answer: (s, c, x) => {
      const d = s.deals.find(y => y.id === x.deal);
      if (c === 0 && d && x.cash !== undefined && s.cash >= x.cash) { s.cash -= x.cash; d.strikes = Math.max(0, d.strikes - 1); note(s, `Credited ${d.who} ${money(x.cash)}`); }
    },
  },
  // the utility asks you to cut load at the peak; customers who need no outages notice
  utility: {
    when: (_, l) => l.strain >= 0.7,
    make: (s, l) => {
      const pay = Math.round(l.itMW * 0.2 * 1000 * 25);
      const risky = liveDeals(s).filter(d => d.needs.includes('uptime')).length;
      return {
        who: `${LOCS[s.loc].gov.utility} grid desk`, data: { cash: pay },
        line: `PEAK TONIGHT. CUT YOUR LOAD 20% FROM 5 TO 9 AND WE PAY ${money(pay)}.`,
        choices: [`Cut load  +${money(pay)}, trust +2${risky ? `, ${risky} no-outage ${risky === 1 ? 'customer' : 'customers'} strike +1` : ''}`, 'Keep running'],
      };
    },
    answer: (s, c, x) => {
      if (c !== 0) return;
      s.cash += x.cash ?? 0;
      s.trust = Math.min(100, s.trust + 2);
      for (const d of liveDeals(s)) if (d.needs.includes('uptime')) d.strikes++;
      note(s, `Cut load for the grid: +${money(x.cash ?? 0)}`);
    },
  },
  // a reporter wants a quote; it lands if you really did hire locals
  press: {
    when: s => !!s.bill || s.trust < 55,
    make: s => ({
      who: 'Channel 4 newsroom', data: {},
      line: `WE'RE RUNNING A STORY ON ${siteName(s).toUpperCase()} TONIGHT. ANY COMMENT?`,
      choices: [`Talk about jobs  ${locals(s)} of ${hopedJobs(s)} local`, 'No comment  trust −1'],
    }),
    answer: (s, c) => {
      if (c === 1) { s.trust = Math.max(0, s.trust - 1); return; }
      const ok = locals(s) >= hopedJobs(s) * 0.5;
      s.trust = Math.max(0, Math.min(100, s.trust + (ok ? 3 : -2)));
      s.news = { id: (s.news?.id ?? 0) + 1, tag: 'Local news', headline: ok ? `${siteName(s)} says it hires local, and it does` : `${siteName(s)} says jobs. Town counts ${locals(s)}`, ticker: [`${locals(s)} local techs`, `${hopedJobs(s)} hoped for`] };
    },
  },
  // the mayor's office passes the hat
  mayor: {
    when: s => s.trust >= 35,
    make: s => {
      const cost = today(s, 250_000);
      return {
        who: "The mayor's office", data: { cash: cost },
        line: `THE SUMMER FAIR NEEDS A SPONSOR. ${money(cost)}. YOUR NAME ON THE BANNER.`,
        choices: [`Sponsor  −${money(cost)}, trust +4`, 'Pass'],
      };
    },
    answer: (s, c, x) => {
      if (c !== 0 || s.cash < (x.cash ?? 0)) return;
      s.cash -= x.cash ?? 0;
      s.trust = Math.min(100, s.trust + 4);
      s.goodwill += 2;
      note(s, 'Sponsored the summer fair. Trust +4');
    },
  },
};

/** You picked an answer on a business call. */
export function answerCall(s: GameState, choice: number) {
  const c = s.call;
  if (!c?.biz || !BIZ[c.biz]) return;
  BIZ[c.biz].answer(s, choice, c.data ?? {});
}

/** Maybe someone calls this month: a business call when one fits, else someone from town. Angrier towns call more. */
export function callMonth(s: GameState) {
  if (s.call || s.phase !== 'play') return;
  const l = ledger(s);
  const biz = Object.keys(BIZ).filter(k => (s.cooldown[`call-${k}`] ?? 0) <= s.month && BIZ[k].when(s, l));
  if (biz.length && Math.random() < 0.14) {
    const k = pick(biz);
    s.cooldown[`call-${k}`] = s.month + 10;
    s.call = { id: Date.now(), ...BIZ[k].make(s, l), mood: 'biz', t0: Date.now(), answered: false, biz: k };
    return;
  }
  const list = topics(s);
  if (!list.length) return;
  const p = 0.05 + (s.trust < 50 ? 0.1 : 0) + (s.trust < 30 ? 0.08 : 0);
  if (Math.random() >= p) return;
  const heard = s.heard ?? [];
  // favour topics, lines and people nobody has heard from lately
  const unsaid = list.filter(t => lines(s, t).some(x => !heard.includes(x)));
  const pool = unsaid.length ? unsaid : list;
  const fresh = pool.filter(t => !heard.slice(0, 6).includes(`topic:${t}`));
  const topic = pick(fresh.length ? fresh : pool);
  const said = lines(s, topic).filter(x => !heard.includes(x));
  const line = pick(said.length ? said : lines(s, topic));
  // the last few callers wait a while before calling again
  const recent = heard.filter(x => x.startsWith('who:')).slice(0, 8);
  const people = CALLERS.filter(c => c.cares.includes(topic) && !recent.includes(`who:${c.who}`));
  const anyone = CALLERS.filter(c => !recent.includes(`who:${c.who}`));
  const who = pick(people.length ? people : anyone.length ? anyone : CALLERS).who;
  s.heard = [`topic:${topic}`, `who:${who}`, line, ...heard].slice(0, 60);
  s.call = { id: Date.now(), who, line, mood: GLAD.includes(topic) ? 'glad' : 'mad', t0: Date.now(), answered: false };
}

/** What someone says when you stop them on the street: calmer than a phone call. */
const REMARKS: Record<Topic, string[]> = {
  trees: ['I miss the woods out back.', 'Where did all the trees go?'],
  water: ['My water pressure is awful lately.', 'The creek is so low this year.'],
  noise: ['Do you hear that hum? It never stops.', 'I sleep with a fan on now, just to drown it out.'],
  bills: ['Have you seen your power bill this month?', 'Everything costs more since that place opened.'],
  blackout: ['Lost power again last night.', 'I bought a generator. Can you believe it?'],
  jobs: ['They promised jobs. I haven\'t seen any.', 'My kid applied there. Nothing.'],
  overseas: ['Why not hire from here?', 'Nobody I know works there.'],
  angry: ['I signed the petition.', 'Going to the meeting Tuesday? You should.'],
  strike: ['Did you see the picket line?', 'I hope they get what they\'re asking for.'],
  heat: ['My heating bill is half what it was!', 'Warm house, cheap bill. Not bad.'],
  fan: ['My neighbor works there. Loves it.', 'Honestly? Good for the town.'],
  school: ['The school got new computers!', 'Did you hear about the robotics club?'],
};
const SMALL_TALK = ['Nice day for a walk.', 'Have you tried the diner on Main?', 'Is that datacenter getting bigger?', 'Morning!'];
export function remark(s: GameState) {
  const t = topics(s);
  return t.length && Math.random() < 0.85 ? pick(REMARKS[pick(t)]) : pick(SMALL_TALK);
}

/** How long a call rings before it goes to voicemail. */
export const RING_MS = 9000;
