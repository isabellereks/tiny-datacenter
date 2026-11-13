import { fresh, type GameState } from '../game/state';
import { computeBooks, freshNv, startProject, type Mode } from './sim';

/** April 1993: three founders, $40K, one small office with one lab. */
export function nvStart(mode: Mode): GameState {
  const s = fresh();
  s.phase = 'play';
  s.cash = 40_000;
  s.month = 0; s.calm = 0; s.inspectAt = 1e9; s.electionAt = 1e9; s.nationalAt = 1e9;
  s.look = { ...s.look, name: 'NVIDIA', owner: 'Jensen Huang', outline: '#2E8B57', accent: '#76B900' };
  s.floors = [
    { type: 'lobby', fill: 'cloth', done: true, cost: 0, b: 0 },
    { type: 'hall', fill: 'cloth', done: true, cost: 0, b: 0 },
  ];
  s.workers = [{ id: s.nid++, name: 'Jensen, Chris and Curtis', floor: 1, x: 0, dir: 1, speed: 1, pause: 0 }];
  s.unlocked = [];
  // room to grow: a tall foundation, and no height permits to chase
  s.found = 'piles'; s.startFound = 'piles'; s.permits.height = 3; s.permits.zoning = 3;
  s.target = 'off';
  s.goal = 999;
  s.trust = 70;
  s.nv = freshNv(mode);
  s.nv.stake = 1;
  if (mode === 'choices') startProject(s.nv, 0, 'safe');
  s.nv.books = computeBooks(s.nv, 0, 1, s.trust, mode === 'story');
  return s;
}
