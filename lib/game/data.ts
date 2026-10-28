export const FW = 10;
export const FD = 7;
export const FH = 1.8;

export type LocKey = 'dalles' | 'reykjavik' | 'phoenix' | 'ashburn' | 'abilene' | 'newalbany' | 'dublin' | 'lulea';
export type FoundKey = 'slab' | 'raised' | 'piles' | 'bedrock' | 'caisson' | 'megaframe';
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
  /** price of cooling equipment here: hot places need big chillers, cold places use outside air */
  coolCost: number;
  /** who governs the site: the local board, the state (or national) lawmakers, the utility and the air regulator */
  gov: { local: string; state: string; utility: string; air: string; us: boolean };
  /** how much fits and how hard it is to get approved: buildings on the lot, floors allowed at each
   *  height permit, how long permits take compared to normal, and how much trust hearings need on top */
  space: { buildings: number; heights: number[]; permitSpeed: number; hearing: number };
  /** MW the local grid can spare for you before the town feels it */
  grid: number;
  /** months the utility's interconnection queue takes for a new grid connection */
  queue: number;
  trees: number;
  taxNote: string;
  /** cloth tint, ground patch edge and ground texture threads */
  cloth: string; hole: string; edge: string; deco: string;
}

export interface Foundation { name: string; note: string; max: number; cost: number; acres: number; cool: number; h: number }
export interface Shape { name: string; note: string; cost: number; cool: number; crew: number; rev: number; trees: number }
export interface Customer {
  name: string; note: string;
  /** dollars per kW of IT load per month, before the market and location */
  price: number;
  /** how much each network floor adds to what they pay */
  net: number;
  /** who signs deals of this kind */
  names: string[];
}

/** Money for land and the first build. Whatever is left is your starting cash. */
export const BUDGET = 100_000_000;
export const MONTH_SECONDS = 8;
/** Game speeds, like a sim game's pause and fast-forward buttons. */
export const SPEEDS = [0, 1, 2, 4];
export const HOURS_PER_MONTH = 730;
export const TECH_SALARY = 8_000;
export const HIRE_FEE = 15_000;
export const MAX_TECHS = 3;
/** an onsite solar farm, averaged over day and night */
export const SOLAR_MW = 3;
/** an outside repair crew, for a hall with no techs on it */
export const REPAIR_COST = 150_000;
/** MW each power floor can deliver and each cooling floor can remove, before bonuses */
export const POWER_MW = 10;
export const COOL_MW = 10;

export const LOCS: Record<LocKey, Location> = {
  dalles: {
    name: 'The Dalles, Oregon', short: 'Oregon', note: 'Cheap power. Lots of trees.',
    land: 150_000, power: 60, pue: 1.2, water: 1, waterPrice: 1.5,
    propertyTax: 0.003, incomeTax: 0.286, demand: 1, carbon: 0.1, coolCost: 0.85, grid: 30, queue: 18, trees: 26,
    taxNote: 'Almost no property tax.',
    gov: { local: 'Wasco County', state: 'Oregon Legislature', utility: 'Northern Wasco PUD', air: 'Oregon DEQ', us: true },
    space: { buildings: 3, heights: [12, 20, 40, 99], permitSpeed: 0.9, hearing: 0 },
    cloth: '#F2F5EE', hole: '#E2E7DA', edge: '#A8D5BA', deco: '#2E8B57',
  },
  reykjavik: {
    name: 'Reykjavík, Iceland', short: 'Iceland', note: 'Free cooling. Customers pay less.',
    land: 120_000, power: 45, pue: 1.12, water: 0.1, waterPrice: 1,
    propertyTax: 0.005, incomeTax: 0.2, demand: 0.85, carbon: 0.02, coolCost: 0.55, grid: 24, queue: 12, trees: 10,
    taxNote: 'Lowest profit tax.',
    gov: { local: 'Reykjavík City Council', state: 'Alþingi', utility: 'Landsvirkjun', air: 'Environment Agency', us: false },
    space: { buildings: 2, heights: [8, 15, 30, 99], permitSpeed: 1, hearing: 0 },
    cloth: '#F1F4F8', hole: '#DFE5EE', edge: '#C9B6F2', deco: '#99BBFF',
  },
  phoenix: {
    name: 'Phoenix, Arizona', short: 'Arizona', note: 'Hot and thirsty. Big market.',
    land: 600_000, power: 75, pue: 1.4, water: 2.5, waterPrice: 2.5,
    propertyTax: 0.01, incomeTax: 0.259, demand: 1.1, carbon: 0.4, coolCost: 1.4, grid: 20, queue: 24, trees: 14,
    taxNote: 'Normal taxes.',
    gov: { local: 'Phoenix City Council', state: 'Arizona Legislature', utility: 'APS', air: 'Maricopa County Air Quality', us: true },
    space: { buildings: 3, heights: [12, 20, 40, 99], permitSpeed: 1, hearing: 0 },
    cloth: '#FAF3E7', hole: '#EDE1CC', edge: '#E9D3A6', deco: '#E0A458',
  },
  ashburn: {
    name: 'Ashburn, Virginia', short: 'Virginia', note: 'Best customers. Pricey land.',
    land: 2_000_000, power: 85, pue: 1.3, water: 1.2, waterPrice: 2,
    propertyTax: 0.012, incomeTax: 0.27, demand: 1.25, carbon: 0.3, coolCost: 1, grid: 16, queue: 42, trees: 18,
    taxNote: 'High property tax.',
    gov: { local: 'Loudoun County Board', state: 'Virginia General Assembly', utility: 'Dominion Energy', air: 'Virginia DEQ', us: true },
    space: { buildings: 2, heights: [12, 20, 40, 99], permitSpeed: 1.2, hearing: 5 },
    cloth: '#F5F4F1', hole: '#E5E3DD', edge: '#B8BCC6', deco: '#7D8597',
  },
  abilene: {
    name: 'Abilene, Texas', short: 'Texas', note: 'Cheap land. Wind power, shaky grid.',
    land: 30_000, power: 55, pue: 1.35, water: 1.8, waterPrice: 2,
    propertyTax: 0.018, incomeTax: 0.21, demand: 1.05, carbon: 0.37, coolCost: 1.2, grid: 40, queue: 9, trees: 8,
    taxNote: 'No state income tax. High property tax.',
    gov: { local: 'Taylor County', state: 'Texas Legislature', utility: 'ERCOT', air: 'TCEQ', us: true },
    space: { buildings: 3, heights: [20, 40, 99], permitSpeed: 0.6, hearing: -10 },
    cloth: '#FAF1E4', hole: '#EDDFC6', edge: '#E9C38A', deco: '#C9733A',
  },
  newalbany: {
    name: 'New Albany, Ohio', short: 'Ohio', note: 'Central. Coal-heavy grid.',
    land: 250_000, power: 70, pue: 1.3, water: 1, waterPrice: 2,
    propertyTax: 0.015, incomeTax: 0.21, demand: 1.1, carbon: 0.5, coolCost: 0.95, grid: 22, queue: 24, trees: 20,
    taxNote: 'No corporate income tax.',
    gov: { local: 'Licking County', state: 'Ohio General Assembly', utility: 'AEP Ohio', air: 'Ohio EPA', us: true },
    space: { buildings: 3, heights: [12, 20, 40, 99], permitSpeed: 0.8, hearing: -5 },
    cloth: '#F3F5EC', hole: '#E2E7D6', edge: '#C8D99A', deco: '#6E8B3D',
  },
  dublin: {
    name: 'Dublin, Ireland', short: 'Ireland', note: 'Low profit tax. Almost no grid left.',
    land: 1_500_000, power: 150, pue: 1.25, water: 0.5, waterPrice: 3,
    propertyTax: 0.01, incomeTax: 0.125, demand: 1.3, carbon: 0.3, coolCost: 0.7, grid: 10, queue: 60, trees: 12,
    taxNote: '12.5% profit tax.',
    gov: { local: 'Fingal County Council', state: 'Oireachtas', utility: 'EirGrid', air: 'EPA Ireland', us: false },
    space: { buildings: 1, heights: [8, 12, 16], permitSpeed: 1.6, hearing: 10 },
    cloth: '#EEF5EE', hole: '#DCE8DC', edge: '#8FCB9B', deco: '#2E8B57',
  },
  lulea: {
    name: 'Luleå, Sweden', short: 'Sweden', note: 'Cold and cheap. Far from customers.',
    land: 50_000, power: 40, pue: 1.1, water: 0.1, waterPrice: 1.5,
    propertyTax: 0.005, incomeTax: 0.206, demand: 0.85, carbon: 0.02, coolCost: 0.5, grid: 35, queue: 12, trees: 30,
    taxNote: 'Low taxes. Cheap hydro.',
    gov: { local: 'Luleå Municipality', state: 'Riksdag', utility: 'Vattenfall', air: 'Swedish EPA', us: false },
    space: { buildings: 3, heights: [10, 20, 40, 99], permitSpeed: 0.9, hearing: -5 },
    cloth: '#F2F5F9', hole: '#E0E6EF', edge: '#B9D3EE', deco: '#5B7FA6',
  },
};
/** Places in the EU or EEA, which file an EU energy report. */
export const EU: LocKey[] = ['reykjavik', 'dublin', 'lulea'];

export const FOUNDS: Record<FoundKey, Foundation> = {
  slab: { name: 'Concrete slab', max: 8, cost: 1_000_000, acres: 6, cool: 1, h: 0.45, note: '8 floors max. 6 acres.' },
  raised: { name: 'Raised floor', max: 12, cost: 2_500_000, acres: 8, cool: 1.1, h: 0.9, note: '12 floors max. 8 acres. Cooling +10%.' },
  piles: { name: 'Steel piles', max: 18, cost: 5_000_000, acres: 12, cool: 1, h: 1.8, note: '18 floors max. 12 acres.' },
  bedrock: { name: 'Bedrock plinth', max: 30, cost: 10_000_000, acres: 18, cool: 1.2, h: 1.3, note: '30 floors max. 18 acres. Cooling +20%.' },
  // later upgrades only, not offered at setup
  caisson: { name: 'Deep caissons', max: 50, cost: 30_000_000, acres: 24, cool: 1.2, h: 1.6, note: '50 floors max. 24 acres.' },
  megaframe: { name: 'Mega-frame core', max: 99, cost: 80_000_000, acres: 30, cool: 1.25, h: 2, note: '99 floors max. 30 acres.' },
};
/** Foundations from smallest to biggest; the first four can be picked at setup. */
export const FOUND_ORDER: FoundKey[] = ['slab', 'raised', 'piles', 'bedrock', 'caisson', 'megaframe'];
export const SETUP_FOUNDS: FoundKey[] = FOUND_ORDER.slice(0, 4);

export const SHAPES: Record<ShapeKey, Shape> = {
  box: { name: 'Box', note: 'No bonus.', cost: 0, cool: 1, crew: 1, rev: 1, trees: 1 },
  saw: { name: 'Sawtooth', note: 'Techs +10%.', cost: 500_000, cool: 1, crew: 1.1, rev: 1, trees: 1 },
  shed: { name: 'Lean-to', note: 'Cooling +15%.', cost: 800_000, cool: 1.15, crew: 1, rev: 1, trees: 1 },
  tower: { name: 'Setback', note: 'Cuts fewer trees.', cost: 1_500_000, cool: 1, crew: 1, rev: 1, trees: 0.6 },
  hangar: { name: 'Hangar', note: 'Income +10%. Cuts more trees.', cost: 1_200_000, cool: 1, crew: 1, rev: 1.1, trees: 1.2 },
};

export const CUSTS: Record<CustKey, Customer> = {
  ai: { name: 'AI lab', note: 'Pays the most. Wants new chips and big deals.', price: 280, net: 1, names: ['OpenEye', 'Anthropoid', 'DeepMined', 'Mistrial AI', 'Perplexed', 'xAIdan'] },
  stream: { name: 'Streaming', note: 'Pays more for network floors.', price: 215, net: 2, names: ['Netflux', 'YouTubby', 'Twitchy', 'Spotifried'] },
  bank: { name: 'Bank', note: 'Pays well. Very strict about outages.', price: 250, net: 1, names: ['J.P. Morgain', 'Goldman Snacks', 'Wells Fargone', 'Stripey'] },
  games: { name: 'Game servers', note: 'Pays the least. Easygoing.', price: 190, net: 1.5, names: ['Roblocks', 'Epik Games', 'Valv', 'Ninetendo Online'] },
};
/** Cloud companies that sign the biggest deals once you're big enough. */
export const HYPERSCALERS = ['Amazin Web Services', 'Macrohard Azul', 'Gaggle Cloud', 'Orakle Cloud', 'Meta-ish'];

/** Chip generations. Each one packs more power into a hall; customers pay less for older chips. */
export const CHIPS: { name: string; mw: number }[] = [
  // rack power roughly follows real hardware: CPU servers about 8 kW a rack, the newest AI racks over 100 kW
  { name: 'CPU servers', mw: 2 },
  { name: 'A100-class GPUs', mw: 3 },
  { name: 'H100-class GPUs', mw: 4.5 },
  { name: 'B200-class GPUs', mw: 6.5 },
  { name: 'GB300-class racks', mw: 9 },
  { name: 'Next-gen AI racks', mw: 12 },
];
/** Chips from this generation on need liquid cooling. */
export const LIQUID_GEN = 3;
/** Months between chip launches, roughly. */
export const CHIP_EVERY = 30;

/** How big you are, by the IT power you've run. Each tier unlocks more. */
export const TIERS: { name: string; mw: number; unlock: string }[] = [
  { name: 'Edge room', mw: 0, unlock: 'Halls, power, cooling, network and break rooms' },
  { name: 'Colocation', mw: 6, unlock: 'Bigger deals, gas turbines, 25 MW grid requests' },
  { name: 'Hyperscale', mw: 18, unlock: 'Cloud giants, liquid cooling, 50 MW grid requests' },
  { name: 'AI factory', mw: 45, unlock: 'Mega deals, a small nuclear reactor, 100 MW grid requests' },
];
/** Grid you can ask the utility for at each tier. */
export const GRID_ASK = [10, 25, 50, 100];

/** Build prices for the shell, power and cooling, like a colocation provider pays; customers bring their own servers. */
export const TYPES: Record<FloorType, { name: string; short: string; cost: number; note: string }> = {
  hall: { name: 'Server hall', short: 'Server hall', cost: 6_000_000, note: 'Earns money.' },
  power: { name: 'Power', short: 'Power', cost: 10_000_000, note: '+10 MW power.' },
  cool: { name: 'Cooling', short: 'Cooling', cost: 6_000_000, note: '+10 MW cooling.' },
  net: { name: 'Network', short: 'Network', cost: 3_000_000, note: 'Halls earn more.' },
  break: { name: 'Break room', short: 'Break room', cost: 500_000, note: 'Techs work faster.' },
  lobby: { name: 'Lobby', short: 'Lobby', cost: 2_000_000, note: 'Where staff and visitors come in.' },
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
export const SCENERY_THREADS = { bark: '#8B5E3C', sand: '#E9D3A6', snow: '#FFFFFF', moss: '#71935C', barn: '#B5372B', corn: '#E8C547' };
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
  { key: 'loc', title: 'Pick a location', sub: 'Land, power, water and taxes cost different amounts in each place.' },
  { key: 'found', title: 'Pick a foundation', sub: 'Bigger foundations hold more floors but need more land.' },
  { key: 'shape', title: 'Pick a shape', sub: 'Each shape gives a small bonus.' },
  { key: 'height', title: 'Add floors', sub: 'Stack your first floors. Each one costs a little more than the last.' },
  { key: 'cust', title: 'Pick your first customer', sub: 'They sign a 3-year deal for what your halls can run. More customers come once you open.' },
  { key: 'color', title: 'Pick colors', sub: 'Tap a floor, then pick a thread color.' },
  { key: 'name', title: 'Apply for a permit', sub: 'Name your datacenter and sign as the owner.' },
];

export const NAMES = ['Dana', 'Ravi', 'Mo', 'Kiko', 'Jules', 'Tam', 'Ola', 'Bex', 'Nico', 'Sol', 'Wren', 'Ari', 'Pip', 'Juno', 'Ezra', 'Lu', 'Femi', 'Yuki', 'Ines', 'Bo', 'Cass', 'Dev', 'Rin', 'Theo'];
