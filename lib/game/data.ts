export const FW = 10;
export const FD = 7;
export const FH = 1.8;

export type LocKey = 'dalles' | 'reykjavik' | 'phoenix' | 'ashburn';
export type FoundKey = 'slab' | 'raised' | 'piles' | 'bedrock';
export type ShapeKey = 'shed' | 'saw' | 'box' | 'tower' | 'hangar';
export type CustKey = 'ai' | 'stream' | 'bank' | 'games';
export type FloorType = 'lobby' | 'hall' | 'cool' | 'power' | 'net' | 'break';
export type BuildableType = Exclude<FloorType, 'lobby'>;

/**
 * Every mesh is drawn in one of these roles; the stitch pass decides the thread.
 * `surf` is shaded by which way it faces (blank, light or dark), the others are fixed threads.
 */
export type Role = 'surf' | 'light' | 'dark' | 'accent';
export type ThreadKey = 'dark' | 'light' | 'accent';

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

export const TYPES: Record<FloorType, { name: string }> = {
  hall: { name: 'Server hall' },
  cool: { name: 'Cooling' },
  power: { name: 'Power' },
  net: { name: 'Network' },
  break: { name: 'Break room' },
  lobby: { name: 'Lobby' },
};
export const BUILDABLE: BuildableType[] = ['hall', 'cool', 'power', 'net', 'break'];

export const FILLS: { role: Role; name: string }[] = [
  { role: 'surf', name: 'Unstitched' },
  { role: 'light', name: 'Light thread' },
  { role: 'dark', name: 'Dark thread' },
];

/** Approximate DMC stranded-cotton matches, used for the thread key and the recolour palette. */
export const DMC: { hex: string; name: string }[] = [
  { hex: '#0045D1', name: 'DMC 820 Very Dark Royal Blue' },
  { hex: '#99BBFF', name: 'DMC 156 Medium Light Blue Violet' },
  { hex: '#FF7A45', name: 'DMC 608 Bright Orange' },
  { hex: '#1F2A44', name: 'DMC 939 Very Dark Navy Blue' },
  { hex: '#C8102E', name: 'DMC 321 Red' },
  { hex: '#F4A6B8', name: 'DMC 3326 Light Rose' },
  { hex: '#1E7A4C', name: 'DMC 3818 Ultra Very Dark Emerald' },
  { hex: '#A8D5BA', name: 'DMC 955 Light Nile Green' },
  { hex: '#F2B43C', name: 'DMC 725 Topaz' },
  { hex: '#6A4BB5', name: 'DMC 552 Medium Violet' },
  { hex: '#2A2A2E', name: 'DMC 310 Black' },
  { hex: '#B0B7C3', name: 'DMC 318 Light Steel Gray' },
];

export function nearestDmc(hex: string) {
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best = DMC[0], bestD = Infinity;
  for (const d of DMC) {
    const [R, G, B] = rgb(d.hex);
    const dist = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return { ...best, exact: bestD === 0 };
}

export const NAMES = ['Dana', 'Ravi', 'Mo', 'Kiko', 'Jules', 'Tam', 'Ola', 'Bex', 'Nico', 'Sol', 'Wren', 'Ari', 'Pip', 'Juno', 'Ezra', 'Lu', 'Femi', 'Yuki', 'Ines', 'Bo', 'Cass', 'Dev', 'Rin', 'Theo'];
