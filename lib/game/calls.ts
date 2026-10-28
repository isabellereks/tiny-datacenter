import { LOCS } from './data';
import { hopedJobs, impact } from './events';
import { ledger, locals, overseas, siteName, tallest, type GameState } from './state';

/*
 * Townspeople phone you. What they yell about comes from what you're actually doing to them:
 * cut trees, noise, power bills, water, jobs, the skyline. Answer and they feel heard; let it ring and they don't.
 */

export interface Call { id: number; who: string; line: string; mood: 'mad' | 'glad'; t0: number; answered: boolean }

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

/** Maybe someone calls this month. Angrier towns call more. Nobody says the same thing twice in a row. */
export function callMonth(s: GameState) {
  if (s.call || s.phase !== 'play') return;
  const list = topics(s);
  if (!list.length) return;
  const p = 0.1 + (s.trust < 50 ? 0.2 : 0) + (s.trust < 30 ? 0.15 : 0);
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
