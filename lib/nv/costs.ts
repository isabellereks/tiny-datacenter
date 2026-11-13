import type { GameState } from '../game/state';
import { histOpex, teamCost } from './history';

/** Office floors and hiring cost what they did in their day: a few hundred thousand in 1993, far more later. */
const era = (s: GameState) => histOpex(Math.floor(s.month));
export const labCostNv = (s: GameState) => Math.round(Math.max(60_000, era(s) * 0.8));
export const breakCostNv = (s: GameState) => Math.round(Math.max(15_000, era(s) * 0.15));
/** Recruiting a team: about a month of what it costs to run. */
export const hireCostNv = (s: GameState) => Math.round(teamCost(Math.floor(s.month)));
