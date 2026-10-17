export const FW = 10;
export const FD = 7;
export const FH = 1.8;

export type LocKey = 'dalles' | 'reykjavik' | 'phoenix' | 'ashburn';
export type FoundKey = 'slab' | 'raised' | 'piles' | 'bedrock';
export type ShapeKey = 'shed' | 'saw' | 'box' | 'tower' | 'hangar';
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

export interface Location {
  name: string; short: string; note: string;
  power: number; cool: number; rev: number;
  /** trees on the lot, megalitres of water per cooling floor per day, tons of CO2 per MW per day */
  trees: number; water: number; carbon: number;
  /** cloth tint, ground patch edge and ground texture threads */
  cloth: string; hole: string; edge: string; deco: string;
}
export interface Foundation { name: string; note: string; max: number; cost: number; cool: number; h: number }
export interface Customer { name: string; note: string; rate: number; power: number; net: number; base: number; per: number }

export const LOCS: Record<LocKey, Location> = {
  dalles: {
    name: 'The Dalles, Oregon', short: 'Oregon', note: 'Pine forest, river hydro · power ×1.4',
    power: 1.4, cool: 1, rev: 1, trees: 26, water: 1, carbon: 0.1,
    cloth: '#F2F5EE', hole: '#E2E7DA', edge: '#A8D5BA', deco: '#2E8B57',
  },
  reykjavik: {
    name: 'Reykjavík, Iceland', short: 'Iceland', note: 'Snow and geothermal · cooling ×1.6',
    power: 1.1, cool: 1.6, rev: 0.9, trees: 10, water: 0.3, carbon: 0.05,
    cloth: '#F1F4F8', hole: '#DFE5EE', edge: '#C9B6F2', deco: '#99BBFF',
  },
  phoenix: {
    name: 'Phoenix, Arizona', short: 'Arizona', note: 'Desert sun, thirsty · cooling ×0.7',
    power: 1.2, cool: 0.7, rev: 1, trees: 14, water: 1.6, carbon: 0.4,
    cloth: '#FAF3E7', hole: '#EDE1CC', edge: '#E9D3A6', deco: '#E0A458',
  },
  ashburn: {
    name: 'Ashburn, Virginia', short: 'Virginia', note: 'Data Center Alley · revenue ×1.3',
    power: 1, cool: 1, rev: 1.3, trees: 18, water: 1, carbon: 0.7,
    cloth: '#F5F4F1', hole: '#E5E3DD', edge: '#B8BCC6', deco: '#7D8597',
  },
};

export const FOUNDS: Record<FoundKey, Foundation> = {
  slab: { name: 'Concrete slab', max: 8, cost: 0, cool: 1, h: 0.45, note: 'Up to 8 floors' },
  raised: { name: 'Raised floor', max: 12, cost: 1500, cool: 1.1, h: 0.9, note: 'Up to 12 floors · cooler' },
  piles: { name: 'Steel piles', max: 18, cost: 6000, cool: 1, h: 1.8, note: 'Up to 18 floors' },
  bedrock: { name: 'Bedrock plinth', max: 30, cost: 25000, cool: 1.2, h: 1.3, note: 'Up to 30 floors · coolest' },
};

export const SHAPES: Record<ShapeKey, { name: string; note: string }> = {
  shed: { name: 'Lean-to', note: 'Sawtooth with a sloped wing' },
  saw: { name: 'Sawtooth', note: 'Factory roof' },
  box: { name: 'Box', note: 'Flat roof' },
  tower: { name: 'Setback', note: 'Narrows as it rises' },
  hangar: { name: 'Hangar', note: 'Barrel roof' },
};

export const CUSTS: Record<CustKey, Customer> = {
  ai: { name: 'AI lab', note: 'Pays the most, needs 2 MW a hall', rate: 2, power: 2, net: 1, base: 0.25, per: 0.25 },
  stream: { name: 'Streaming', note: 'Loves a good network', rate: 1.2, power: 1, net: 2, base: 0.25, per: 0.25 },
  bank: { name: 'Bank', note: 'Steady, wants full crews', rate: 1.5, power: 1.2, net: 1, base: 0.1, per: 0.3 },
  games: { name: 'Game servers', note: 'Cheap to power', rate: 0.9, power: 0.8, net: 1.5, base: 0.25, per: 0.25 },
};

export const TYPES: Record<FloorType, { name: string; short: string }> = {
  hall: { name: 'Server hall', short: 'Servers' },
  cool: { name: 'Cooling', short: 'Cooling' },
  power: { name: 'Power', short: 'Power' },
  net: { name: 'Network', short: 'Network' },
  break: { name: 'Break room', short: 'Break room' },
  lobby: { name: 'Lobby', short: 'Lobby' },
};
export const BUILDABLE: BuildableType[] = ['hall', 'cool', 'power', 'net', 'break'];

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

export const STITCH: Record<StitchSize, { px: number; label: string }> = {
  S: { px: 4, label: 'Fine' },
  M: { px: 5, label: 'Medium' },
  L: { px: 7, label: 'Chunky' },
};

export type SetupStep = 'found' | 'shape' | 'loc' | 'height' | 'color' | 'cust' | 'name';
export const SETUP: { key: SetupStep; title: string; sub: string }[] = [
  { key: 'found', title: 'Pour a foundation', sub: 'It sets how tall your datacenter can ever get. Tap one on the cloth or below.' },
  { key: 'shape', title: 'Pick a shape', sub: 'The silhouette you’ll stitch every floor into.' },
  { key: 'loc', title: 'Where are you building?', sub: 'Climate and the grid change your power and cooling.' },
  { key: 'height', title: 'How tall to start?', sub: 'Each layer is stitched on top of the last. You can keep building later.' },
  { key: 'color', title: 'Colour the layers', sub: 'Tap a layer on the cloth or in the list, then pick a thread.' },
  { key: 'cust', title: 'Who are you serving?', sub: 'Your customer sets what each rack earns and how much power it eats.' },
  { key: 'name', title: 'Name your datacenter', sub: 'It gets stitched underneath. Leave it blank if you like.' },
];

export const NAMES = ['Dana', 'Ravi', 'Mo', 'Kiko', 'Jules', 'Tam', 'Ola', 'Bex', 'Nico', 'Sol', 'Wren', 'Ari', 'Pip', 'Juno', 'Ezra', 'Lu', 'Femi', 'Yuki', 'Ines', 'Bo', 'Cass', 'Dev', 'Rin', 'Theo'];
