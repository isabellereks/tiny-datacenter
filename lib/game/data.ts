export const FW = 10;
export const FD = 7;
export const FH = 1.8;

export type LocKey = 'dalles' | 'reykjavik' | 'phoenix' | 'ashburn';
export type FoundKey = 'slab' | 'raised' | 'piles' | 'bedrock';
export type ShapeKey = 'shed' | 'saw' | 'box' | 'tower' | 'hangar';
export type CustKey = 'ai' | 'stream' | 'bank' | 'games';
export type FloorType = 'lobby' | 'hall' | 'cool' | 'power' | 'net' | 'break';
export type BuildableType = Exclude<FloorType, 'lobby'>;
export type InkKey = 'delft' | 'navy' | 'red' | 'green' | 'black';
export type StitchKey = 'S' | 'M' | 'L';
export type Step = 'site' | 'found' | 'shape' | 'floors' | 'crew';

export interface Location { name: string; note: string; power: number; cool: number; rev: number }
export interface Foundation { name: string; note: string; max: number; cost: number; cool: number; h: number }
export interface Customer { name: string; note: string; rate: number; power: number; net: number; base: number; per: number }

export const LOCS: Record<LocKey, Location> = {
  dalles: { name: 'The Dalles, Oregon', note: 'River hydro · power ×1.4', power: 1.4, cool: 1, rev: 1 },
  reykjavik: { name: 'Reykjavík, Iceland', note: 'Arctic air · cooling ×1.6', power: 1.1, cool: 1.6, rev: 0.9 },
  phoenix: { name: 'Phoenix, Arizona', note: 'Solar · power ×1.2, cooling ×0.7', power: 1.2, cool: 0.7, rev: 1 },
  ashburn: { name: 'Ashburn, Virginia', note: 'Data Center Alley · revenue ×1.3', power: 1, cool: 1, rev: 1.3 },
};

export const FOUNDS: Record<FoundKey, Foundation> = {
  slab: { name: 'Concrete slab', max: 8, cost: 0, cool: 1, h: 0.45, note: 'Up to 8 floors' },
  raised: { name: 'Raised floor', max: 12, cost: 1500, cool: 1.1, h: 0.9, note: '12 floors · cooling +10%' },
  piles: { name: 'Steel piles', max: 18, cost: 6000, cool: 1, h: 1.8, note: '18 floors' },
  bedrock: { name: 'Bedrock plinth', max: 30, cost: 25000, cool: 1.2, h: 1.3, note: '30 floors · cooling +20%' },
};

export const SHAPES: Record<ShapeKey, { name: string; note: string }> = {
  shed: { name: 'Lean-to', note: 'Sawtooth top with a sloped wing' },
  saw: { name: 'Sawtooth', note: 'North-light factory roof' },
  box: { name: 'Box', note: 'Flat roof with rooftop units' },
  tower: { name: 'Setback tower', note: 'Narrows every 3 floors' },
  hangar: { name: 'Hangar', note: 'Barrel-vault roof' },
};

export const CUSTS: Record<CustKey, Customer> = {
  ai: { name: 'AI lab', note: '$2/rack/s · 2 MW per hall', rate: 2, power: 2, net: 1, base: 0.25, per: 0.25 },
  stream: { name: 'Streaming service', note: '$1.2/rack/s · network ×2', rate: 1.2, power: 1, net: 2, base: 0.25, per: 0.25 },
  bank: { name: 'Bank', note: '$1.5/rack/s · needs full crews', rate: 1.5, power: 1.2, net: 1, base: 0.1, per: 0.3 },
  games: { name: 'Game servers', note: '$0.9/rack/s · 0.8 MW per hall', rate: 0.9, power: 0.8, net: 1.5, base: 0.25, per: 0.25 },
};

export const TYPES: Record<FloorType, { name: string; swatch: string }> = {
  hall: { name: 'Server hall', swatch: '#4A66B5' },
  cool: { name: 'Cooling', swatch: '#8FA7DA' },
  power: { name: 'Power', swatch: '#F2B43C' },
  net: { name: 'Network', swatch: '#2E7D66' },
  break: { name: 'Break room', swatch: '#F7896F' },
  lobby: { name: 'Lobby', swatch: '#C9C9CE' },
};
export const BUILDABLE: BuildableType[] = ['hall', 'cool', 'power', 'net', 'break'];

export const INKS: Record<InkKey, { name: string; hex: string }> = {
  delft: { name: 'Delft blue', hex: '#4A66B5' },
  navy: { name: 'Navy', hex: '#22346B' },
  red: { name: 'Turkey red', hex: '#B5363A' },
  green: { name: 'Sea green', hex: '#2E7D66' },
  black: { name: 'Black', hex: '#2A2A2E' },
};

export const WALLS: { name: string; hex: string }[] = [
  { name: 'Cloth', hex: '#FFFFFF' },
  { name: 'Delft', hex: '#8FA7DA' },
  { name: 'Sea', hex: '#5FB39C' },
  { name: 'Topaz', hex: '#F2B43C' },
  { name: 'Apricot', hex: '#F7896F' },
  { name: 'Violet', hex: '#C59FCB' },
  { name: 'Red', hex: '#D04848' },
];

export const STITCH: Record<StitchKey, { px: number; label: string }> = {
  S: { px: 5, label: 'Fine' },
  M: { px: 7, label: 'Medium' },
  L: { px: 10, label: 'Chunky' },
};

export const STEPS: { key: Step; label: string }[] = [
  { key: 'site', label: 'Site' },
  { key: 'found', label: 'Foundation' },
  { key: 'shape', label: 'Shape' },
  { key: 'floors', label: 'Floors' },
  { key: 'crew', label: 'Crew' },
];

export const NAMES = ['Dana', 'Ravi', 'Mo', 'Kiko', 'Jules', 'Tam', 'Ola', 'Bex', 'Nico', 'Sol', 'Wren', 'Ari', 'Pip', 'Juno', 'Ezra', 'Lu', 'Femi', 'Yuki', 'Ines', 'Bo', 'Cass', 'Dev', 'Rin', 'Theo'];
export const HAIR = ['#2A2A2E', '#5B3A1E', '#C48A3A', '#B5363A', '#E8E8E8'];
export const SKIN = ['#F6D2B8', '#D9A27E', '#A86E4E', '#6B4229'];
export const SHIRT = ['#D04848', '#F2B43C', '#2E7D66', '#C59FCB', '#F7896F', '#4A66B5', '#5FB39C'];
