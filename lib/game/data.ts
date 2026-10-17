export const FW = 10;
export const FD = 7;
export const FH = 1.8;

export type LocKey = 'dalles' | 'reykjavik' | 'phoenix' | 'ashburn';
export type FoundKey = 'slab' | 'raised' | 'piles' | 'bedrock';
export type ShapeKey = 'box' | 'saw' | 'shed' | 'tower' | 'hangar';
export type CustKey = 'ai' | 'stream' | 'bank' | 'games';
export type FloorType = 'lobby' | 'hall' | 'cool' | 'power' | 'net' | 'break';
export type BuildableType = Exclude<FloorType, 'lobby'>;
export type StitchSize = 'S' | 'M' | 'L';

/** A layer's wall colour: bare cloth, or a thread hex. */
export type Fill = 'cloth' | string;

/**
 * Meshes are drawn in roles; the stitch pass turns each role into thread.
 * surf: shaded by facing (blank, shade thread, outline thread). fill: a layer's own thread colour.
 */
export type Role = 'surf' | 'light' | 'dark' | 'accent' | 'fill';

/*
 * Economy figures are rough estimates from public sources (industrial power rates, land sales,
 * tax rates, typical PUE and water use). Time runs one month per MONTH_SECONDS.
 */

export interface Location {
  name: string; short: string; note: string;
  /** dollars per acre */
  land: number;
  /** industrial electricity, dollars per MWh */
  power: number;
  /** power usage effectiveness: total facility power / IT power */
  pue: number;
  /** litres of water evaporated per kWh of IT load, and dollars per 1,000 litres */
  water: number; waterPrice: number;
  /** yearly property tax on what you've built, and tax on profit (federal plus state) */
  propertyTax: number; incomeTax: number;
  /** what customers pay here compared to elsewhere */
  demand: number;
  /** tonnes of CO2 per MWh from the local grid */
  carbon: number;
  trees: number;
  taxNote: string;
  /** cloth tint, ground patch edge and ground texture threads */
  cloth: string; hole: string; edge: string; deco: string;
}

export interface Foundation { name: string; note: string; max: number; cost: number; acres: number; cool: number; h: number }
export interface Shape { name: string; note: string; cost: number; cool: number; crew: number; rev: number; trees: number }
export interface Customer {
  name: string; note: string;
  /** dollars per kW of IT load per month, MW per server hall */
  price: number; mw: number;
  /** share of a hall in use with no crew, and per tech (3 max) */
  base: number; per: number;
  /** how much each network floor adds */
  net: number;
}

/** Money for land and the first build. Whatever is left is your starting cash. */
export const BUDGET = 40_000_000;
export const MONTH_SECONDS = 6;
export const HOURS_PER_MONTH = 730;
export const TECH_SALARY = 8_000;
export const HIRE_FEE = 15_000;
export const MAX_TECHS = 3;
/** MW each power floor can deliver and each cooling floor can remove, before bonuses */
export const POWER_MW = 6;
export const COOL_MW = 6;

export const LOCS: Record<LocKey, Location> = {
  dalles: {
    name: 'The Dalles, Oregon', short: 'Oregon', note: 'Cheap power. Lots of trees.',
    land: 150_000, power: 60, pue: 1.2, water: 1, waterPrice: 1.5,
    propertyTax: 0.003, incomeTax: 0.286, demand: 1, carbon: 0.1, trees: 26,
    taxNote: 'Almost no property tax.',
    cloth: '#F2F5EE', hole: '#E2E7DA', edge: '#A8D5BA', deco: '#2E8B57',
  },
  reykjavik: {
    name: 'Reykjavík, Iceland', short: 'Iceland', note: 'Free cooling. Customers pay less.',
    land: 120_000, power: 45, pue: 1.12, water: 0.1, waterPrice: 1,
    propertyTax: 0.005, incomeTax: 0.2, demand: 0.85, carbon: 0.02, trees: 10,
    taxNote: 'Lowest profit tax.',
    cloth: '#F1F4F8', hole: '#DFE5EE', edge: '#C9B6F2', deco: '#99BBFF',
  },
  phoenix: {
    name: 'Phoenix, Arizona', short: 'Arizona', note: 'Hot. Uses lots of water.',
    land: 600_000, power: 75, pue: 1.4, water: 2.5, waterPrice: 2.5,
    propertyTax: 0.01, incomeTax: 0.259, demand: 1, carbon: 0.4, trees: 14,
    taxNote: 'Normal taxes.',
    cloth: '#FAF3E7', hole: '#EDE1CC', edge: '#E9D3A6', deco: '#E0A458',
  },
  ashburn: {
    name: 'Ashburn, Virginia', short: 'Virginia', note: 'Best customers. Pricey land.',
    land: 2_000_000, power: 85, pue: 1.3, water: 1.2, waterPrice: 2,
    propertyTax: 0.012, incomeTax: 0.27, demand: 1.25, carbon: 0.3, trees: 18,
    taxNote: 'High property tax.',
    cloth: '#F5F4F1', hole: '#E5E3DD', edge: '#B8BCC6', deco: '#7D8597',
  },
};

export const FOUNDS: Record<FoundKey, Foundation> = {
  slab: { name: 'Concrete slab', max: 8, cost: 1_000_000, acres: 6, cool: 1, h: 0.45, note: '8 floors max. 6 acres.' },
  raised: { name: 'Raised floor', max: 12, cost: 2_500_000, acres: 8, cool: 1.1, h: 0.9, note: '12 floors max. 8 acres. Cooling +10%.' },
  piles: { name: 'Steel piles', max: 18, cost: 5_000_000, acres: 12, cool: 1, h: 1.8, note: '18 floors max. 12 acres.' },
  bedrock: { name: 'Bedrock plinth', max: 30, cost: 10_000_000, acres: 18, cool: 1.2, h: 1.3, note: '30 floors max. 18 acres. Cooling +20%.' },
};

export const SHAPES: Record<ShapeKey, Shape> = {
  box: { name: 'Box', note: 'No bonus.', cost: 0, cool: 1, crew: 1, rev: 1, trees: 1 },
  saw: { name: 'Sawtooth', note: 'Techs +10%.', cost: 500_000, cool: 1, crew: 1.1, rev: 1, trees: 1 },
  shed: { name: 'Lean-to', note: 'Cooling +15%.', cost: 800_000, cool: 1.15, crew: 1, rev: 1, trees: 1 },
  tower: { name: 'Setback', note: 'Cuts fewer trees.', cost: 1_500_000, cool: 1, crew: 1, rev: 1, trees: 0.6 },
  hangar: { name: 'Hangar', note: 'Income +10%. Cuts more trees.', cost: 1_200_000, cool: 1, crew: 1, rev: 1.1, trees: 1.2 },
};

export const CUSTS: Record<CustKey, Customer> = {
  ai: { name: 'AI lab', note: 'Pays the most. Uses the most power.', price: 250, mw: 4, base: 0.4, per: 0.2, net: 1 },
  stream: { name: 'Streaming', note: 'Gets more from network floors.', price: 190, mw: 2, base: 0.4, per: 0.2, net: 2 },
  bank: { name: 'Bank', note: 'Pays well. Needs full crews.', price: 220, mw: 2.4, base: 0.25, per: 0.25, net: 1 },
  games: { name: 'Game servers', note: 'Pays the least. Easy to run.', price: 170, mw: 2, base: 0.5, per: 0.17, net: 1.5 },
};

export const TYPES: Record<FloorType, { name: string; short: string; cost: number; note: string }> = {
  hall: { name: 'Server hall', short: 'Server hall', cost: 6_000_000, note: 'Earns money.' },
  power: { name: 'Power', short: 'Power', cost: 4_000_000, note: '+6 MW power.' },
  cool: { name: 'Cooling', short: 'Cooling', cost: 3_000_000, note: '+6 MW cooling.' },
  net: { name: 'Network', short: 'Network', cost: 2_000_000, note: 'Halls earn more.' },
  break: { name: 'Break room', short: 'Break room', cost: 500_000, note: 'Techs work faster.' },
  lobby: { name: 'Lobby', short: 'Lobby', cost: 1_000_000, note: 'Front desk.' },
};
export const BUILDABLE: BuildableType[] = ['hall', 'power', 'cool', 'net', 'break'];

/** Floor types handed out while you set the starting height. */
export const STARTER: FloorType[] = ['lobby', 'hall', 'power', 'cool', 'hall', 'net'];

export const THREADS: { name: string; hex: string }[] = [
  { name: 'Cobalt', hex: '#0045D1' },
  { name: 'Sky', hex: '#99BBFF' },
  { name: 'Tangerine', hex: '#FF7A45' },
  { name: 'Marigold', hex: '#F2B43C' },
  { name: 'Cherry', hex: '#D7263D' },
  { name: 'Blush', hex: '#F4A6B8' },
  { name: 'Fern', hex: '#2E8B57' },
  { name: 'Mint', hex: '#A8D5BA' },
  { name: 'Grape', hex: '#6A4BB5' },
  { name: 'Lilac', hex: '#C9B6F2' },
  { name: 'Slate', hex: '#7D8597' },
  { name: 'Ink', hex: '#1F2A44' },
];
/** Extra threads used only by scenery. The stitch shader's palette is THREADS followed by these. */
export const SCENERY_THREADS = { bark: '#8B5E3C', sand: '#E9D3A6', snow: '#FFFFFF', moss: '#71935C' };
export const PALETTE: string[] = [...THREADS.map(t => t.hex), ...Object.values(SCENERY_THREADS)];
export const OUTLINES = ['#0045D1', '#1F2A44', '#D7263D', '#2E8B57', '#6A4BB5'];
/** Shirt colours for the townspeople. */
export const CROWD = ['#D7263D', '#F2B43C', '#6A4BB5', '#2E8B57', '#FF7A45', '#F4A6B8', '#99BBFF', '#7D8597'];

export const STITCH: Record<StitchSize, { px: number; label: string }> = {
  S: { px: 4, label: 'Fine' },
  M: { px: 5, label: 'Medium' },
  L: { px: 7, label: 'Large' },
};

export type SetupStep = 'loc' | 'found' | 'shape' | 'height' | 'cust' | 'color' | 'name';
export const SETUP: { key: SetupStep; title: string; sub: string }[] = [
  { key: 'loc', title: 'Pick a location', sub: 'Land, power and taxes cost different amounts in each place.' },
  { key: 'found', title: 'Pick a foundation', sub: 'Bigger foundations hold more floors but need more land.' },
  { key: 'shape', title: 'Pick a shape', sub: 'Each shape has a small bonus.' },
  { key: 'height', title: 'Add floors', sub: 'You need a server hall, power and cooling to earn money.' },
  { key: 'cust', title: 'Pick a customer', sub: 'They decide how much each hall earns.' },
  { key: 'color', title: 'Pick colors', sub: 'Tap a floor, then a color.' },
  { key: 'name', title: 'Name it', sub: 'The name is stitched under the building.' },
];

export const NAMES = ['Dana', 'Ravi', 'Mo', 'Kiko', 'Jules', 'Tam', 'Ola', 'Bex', 'Nico', 'Sol', 'Wren', 'Ari', 'Pip', 'Juno', 'Ezra', 'Lu', 'Femi', 'Yuki', 'Ines', 'Bo', 'Cass', 'Dev', 'Rin', 'Theo'];
