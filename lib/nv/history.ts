/*
 * NVIDIA's real path from 1993 to 2025, as the baseline the game measures you against: revenue, what the market paid
 * for it, how the business split across markets, the chips and when they shipped, and how big the company was.
 * Numbers are rounded public figures (fiscal years mapped to the calendar year they mostly cover).
 */

/** Month 0 is April 1993, when the company was founded. */
export const START_YEAR = 1993;
export const START_MONTH = 3; // April, zero-based
export const ym = (year: number, month: number) => (year - START_YEAR) * 12 + (month - 1 - START_MONTH);
/** The game ends after December 2025. */
export const END_MONTH = ym(2025, 12) + 1;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function calendar(m: number) {
  const k = Math.floor(m) + START_MONTH;
  return { year: START_YEAR + Math.floor(k / 12), month: k % 12 };
}
export const dateOf = (m: number) => { const c = calendar(m); return `${MON[c.month]} ${c.year}`; };
export const yearOf = (m: number) => calendar(m).year + calendar(m).month / 12;

/** Straight-line between points; flat past the ends. */
function lerp(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}
/** Between points that grow fast, interpolate in log space so growth looks steady. */
function logLerp(points: [number, number][], x: number) {
  return Math.exp(lerp(points.map(([a, b]) => [a, Math.log(Math.max(1, b))]), x));
}

/** Calendar-year revenue in dollars, placed at mid-year. */
const REVENUE: [number, number][] = [
  [1993.0, 1], [1994.5, 400e3], [1995.5, 1.1e6], [1996.5, 3.9e6], [1997.5, 29e6], [1998.5, 158e6], [1999.5, 374e6],
  [2000.5, 735e6], [2001.5, 1.37e9], [2002.5, 1.91e9], [2003.5, 1.82e9], [2004.5, 2.01e9], [2005.5, 2.38e9],
  [2006.5, 3.07e9], [2007.5, 4.1e9], [2008.5, 3.42e9], [2009.5, 3.33e9], [2010.5, 3.54e9], [2011.5, 3.99e9],
  [2012.5, 4.28e9], [2013.5, 4.13e9], [2014.5, 4.68e9], [2015.5, 5.01e9], [2016.5, 6.91e9], [2017.5, 9.71e9],
  [2018.5, 11.72e9], [2019.5, 10.92e9], [2020.5, 16.68e9], [2021.5, 26.91e9], [2022.5, 26.97e9], [2023.5, 60.92e9],
  [2024.5, 130.5e9], [2025.5, 200e9], [2025.99, 230e9],
];
/** The real company's monthly revenue. */
export const baselineRevenue = (m: number) => { const r = logLerp(REVENUE, yearOf(m)) / 12; return r < 1000 ? 0 : r; };

/** Market value at points in time, from the IPO on. */
const MARKET_CAP: [number, number][] = [
  [1999.05, 0.6e9], [1999.95, 2.5e9], [2000.95, 4e9], [2001.9, 9e9], [2002.8, 1.5e9], [2003.95, 3.8e9], [2004.95, 4.1e9],
  [2005.95, 6.5e9], [2006.95, 13e9], [2007.5, 22e9], [2007.95, 19e9], [2008.9, 4.4e9], [2009.95, 10e9], [2010.95, 9e9],
  [2011.95, 8.5e9], [2012.95, 7.5e9], [2013.95, 9.4e9], [2014.95, 11e9], [2015.95, 18e9], [2016.95, 57e9],
  [2017.95, 117e9], [2018.75, 175e9], [2018.98, 81e9], [2019.95, 144e9], [2020.95, 323e9], [2021.88, 800e9],
  [2022.78, 280e9], [2023.4, 1e12], [2023.95, 1.22e12], [2024.46, 3.3e12], [2024.95, 3.3e12], [2025.07, 2.9e12],
  [2025.52, 4e12], [2025.83, 5e12], [2025.99, 4.5e12],
];
/** The real company's market value; zero before the IPO. */
export const realMarketCap = (m: number) => (m < ym(1999, 1) ? 0 : logLerp(MARKET_CAP, yearOf(m)));
/** Price-to-sales the market paid at the time: your value is your yearly revenue at the same multiple. */
export const priceToSales = (m: number) => realMarketCap(m) / Math.max(1, baselineRevenue(m) * 12);

/** Gross margin by year: what's left of each dollar after making the chips. */
const MARGIN: [number, number][] = [
  [1995, 0.15], [1997.5, 0.25], [1999, 0.35], [2001, 0.38], [2003, 0.29], [2005, 0.38], [2007, 0.45], [2008.5, 0.35],
  [2010, 0.45], [2014, 0.55], [2016, 0.58], [2019, 0.62], [2021, 0.65], [2022.5, 0.57], [2023.5, 0.7], [2024.5, 0.75], [2025.9, 0.72],
];
export const grossMargin = (m: number) => lerp(MARGIN, yearOf(m));

/** Markets you sell into. */
export type Seg = 'gaming' | 'pro' | 'console' | 'mobile' | 'crypto' | 'dc';
export const SEGS: Record<Seg, { name: string }> = {
  gaming: { name: 'PC gaming' },
  pro: { name: 'Workstations' },
  console: { name: 'Consoles' },
  mobile: { name: 'Mobile and cars' },
  crypto: { name: 'Crypto mining' },
  dc: { name: 'Data center' },
};
/** How the real company's revenue split across markets, by year. */
const MIX: [number, Partial<Record<Seg, number>>][] = [
  [1994, { console: 0.7, gaming: 0.3 }],
  [1996.5, { console: 0.4, gaming: 0.6 }],
  [1997.5, { gaming: 0.92, pro: 0.08 }],
  [2000.5, { gaming: 0.88, pro: 0.12 }],
  [2001.5, { gaming: 0.62, console: 0.23, pro: 0.15 }],
  [2005, { gaming: 0.7, console: 0.12, pro: 0.18 }],
  [2007, { gaming: 0.68, console: 0.05, pro: 0.18, mobile: 0.05, dc: 0.04 }],
  [2011, { gaming: 0.6, pro: 0.17, mobile: 0.13, dc: 0.1 }],
  [2015, { gaming: 0.58, pro: 0.15, mobile: 0.13, dc: 0.14 }],
  [2017.5, { gaming: 0.52, dc: 0.24, pro: 0.08, mobile: 0.07, crypto: 0.09 }],
  [2019, { gaming: 0.52, dc: 0.3, pro: 0.11, mobile: 0.07 }],
  [2021.5, { gaming: 0.45, dc: 0.39, pro: 0.08, mobile: 0.03, crypto: 0.05 }],
  [2022.5, { gaming: 0.32, dc: 0.56, pro: 0.06, mobile: 0.06 }],
  [2024, { dc: 0.83, gaming: 0.11, pro: 0.03, mobile: 0.03 }],
  [2025.5, { dc: 0.89, gaming: 0.08, pro: 0.015, mobile: 0.015 }],
];
export function mixAt(m: number): Record<Seg, number> {
  const y = yearOf(m);
  const keys = Object.keys(SEGS) as Seg[];
  const out = {} as Record<Seg, number>;
  for (const k of keys) out[k] = Math.max(0, lerp(MIX.map(([yy, mix]) => [yy, mix[k] ?? 0]), y));
  const sum = keys.reduce((t, k) => t + out[k], 0) || 1;
  for (const k of keys) out[k] /= sum;
  return out;
}

/** Chip generations and when the real company shipped them. */
export interface Gen { name: string; at: number; what: string }
export const GENS: Gen[] = [
  { name: 'NV1', at: ym(1995, 5), what: 'Curved surfaces, sound and a game port on one card' },
  { name: 'RIVA 128', at: ym(1997, 8), what: 'Fast 3D on triangles, like DirectX wants' },
  { name: 'RIVA TNT', at: ym(1998, 6), what: 'Two pixels at a time' },
  { name: 'GeForce 256', at: ym(1999, 10), what: '"The first GPU": lighting on the chip' },
  { name: 'GeForce 3', at: ym(2001, 3), what: 'Programmable shaders' },
  { name: 'GeForce FX', at: ym(2003, 1), what: 'Late, loud and behind the rival' },
  { name: 'GeForce 6800', at: ym(2004, 4), what: 'Back on top' },
  { name: 'GeForce 8800', at: ym(2006, 11), what: 'Unified shaders, and CUDA' },
  { name: 'GT200', at: ym(2008, 6), what: 'Double precision for science' },
  { name: 'Fermi', at: ym(2010, 3), what: 'Built for computing' },
  { name: 'Kepler', at: ym(2012, 3), what: 'Fast and efficient' },
  { name: 'Maxwell', at: ym(2014, 2), what: 'Twice the work per watt' },
  { name: 'Pascal', at: ym(2016, 5), what: 'Deep learning takes off' },
  { name: 'Volta', at: ym(2017, 6), what: 'Tensor cores' },
  { name: 'Turing', at: ym(2018, 9), what: 'Ray tracing' },
  { name: 'Ampere', at: ym(2020, 5), what: 'A100' },
  { name: 'Hopper', at: ym(2022, 9), what: 'H100, the chip behind the AI boom' },
  { name: 'Blackwell', at: ym(2024, 11), what: 'Two dies, one GPU' },
  { name: 'Rubin', at: ym(2026, 6), what: 'Next' },
];
/** The newest generation the real company had shipped by a month. */
export const histGen = (m: number) => Math.max(0, GENS.filter(g => g.at <= m).length - 1);

/** Engineering teams the real company had: one team is one person on the lab floors, standing in for many engineers. */
const TEAMS: [number, number][] = [[1993.3, 1], [1995, 2], [1996.5, 2], [1997.5, 3], [1999, 5], [2004, 7], [2010, 9], [2016, 11], [2022, 14], [2025.9, 18]];
export const histTeams = (m: number) => Math.round(lerp(TEAMS, yearOf(m)));
/** People in the whole company, for scale. */
const HEADCOUNT: [number, number][] = [[1993.3, 3], [1995, 40], [1996.3, 100], [1996.8, 40], [1999, 300], [2000, 600], [2005, 2100], [2010, 5700], [2015, 9200], [2020, 13700], [2023, 26000], [2025.9, 36000]];
export const headcount = (m: number) => Math.round(lerp(HEADCOUNT, yearOf(m)));
/** What the real company spent each month running itself (R&D and everything else): one team's share of it. */
const OPEX: [number, number][] = [[1993.3, 12e3], [1995, 350e3], [1996.3, 650e3], [1996.8, 320e3], [1997.5, 800e3], [1999, 5e6], [2001, 25e6], [2005, 60e6], [2008, 110e6], [2012, 140e6], [2016, 200e6], [2020, 380e6], [2023, 950e6], [2025.9, 1.6e9]];
export const histOpex = (m: number) => lerp(OPEX, yearOf(m));
export const teamCost = (m: number) => histOpex(m) / Math.max(1, histTeams(m));
