import * as THREE from 'three';
import { FD, FH, FW, PALETTE, SCENERY_THREADS, type Fill, type FloorType, type FoundKey, type LocKey, type Role } from './data';
import { baseY, floorW, isBroken, perRow, type Floor, type GameState } from './state';

/**
 * Meshes are flat-coloured with a code the stitch pass decodes:
 * red = role id / 8, green = palette index / 16, blue = 0 (blue is reserved for the ground).
 */
const ROLE_ID: Record<Role, number> = { surf: 0, light: 1, dark: 2, accent: 3, fill: 4 };
const mats = new Map<string, THREE.MeshBasicMaterial>();

function code(role: Role, idx = 0) {
  const key = `${role}:${idx}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(ROLE_ID[role] / 8, idx / 16, 0) });
    mats.set(key, m);
  }
  return m;
}

/** Material for a role, or for a thread colour from the palette. */
export function mat(r: Role | Fill): THREE.MeshBasicMaterial {
  if (r === 'surf' || r === 'light' || r === 'dark' || r === 'accent' || r === 'cloth') return code(r === 'cloth' ? 'surf' : r);
  const idx = PALETTE.indexOf(r.toUpperCase());
  return idx < 0 ? code('surf') : code('fill', idx);
}

type P = THREE.Object3D;
type M = Role | Fill;

function add(p: P, geo: THREE.BufferGeometry, r: M, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, mat(r));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}
const box = (p: P, w: number, h: number, d: number, r: M, x: number, y: number, z: number) =>
  add(p, new THREE.BoxGeometry(w, h, d), r, x, y, z);
const cyl = (p: P, rad: number, h: number, r: M, x: number, y: number, z: number, seg = 16) =>
  add(p, new THREE.CylinderGeometry(rad, rad, h, seg), r, x, y, z);
const cone = (p: P, rad: number, h: number, r: M, x: number, y: number, z: number, seg = 8) =>
  add(p, new THREE.ConeGeometry(rad, h, seg), r, x, y, z);

function prism(p: P, pts: [number, number][], depth: number, r: M, x: number, y: number, z: number) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([px, py]) => sh.lineTo(px, py));
  sh.closePath();
  return add(p, new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), r, x, y, z);
}

export function clear(g: P) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    c.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

export function makeFoundation(key: FoundKey, chosen = false) {
  const g = new THREE.Group();
  const W = FW + 1, D = FD + 1, top: M = chosen ? 'light' : 'surf';
  if (key === 'slab') {
    box(g, W, 0.45, D, top, 0, 0.225, 0);
  } else if (key === 'raised') {
    box(g, W, 0.3, D, 'surf', 0, 0.15, 0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      cyl(g, 0.09, 0.45, 'dark', -W / 2 + (i + 0.5) * W / 4, 0.52, -D / 2 + (j + 0.5) * D / 3, 6);
    }
    box(g, W, 0.15, D, top, 0, 0.82, 0);
  } else if (key === 'piles') {
    for (const [a, b] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) {
      cyl(g, 0.3, 1.4, 'surf', a * (W / 2 - 0.6), 0.7, b * (D / 2 - 0.6), 12);
    }
    box(g, W, 0.4, D, top, 0, 1.6, 0);
  } else {
    box(g, W + 2.2, 0.5, D + 2.2, 'surf', 0, 0.25, 0);
    box(g, W + 1.1, 0.5, D + 1.1, 'surf', 0, 0.75, 0);
    box(g, W, 0.3, D, top, 0, 1.15, 0);
  }
  return g;
}

/** Parts the engine animates. */
export interface Animated { leds: THREE.Mesh[]; fans: THREE.Group[]; alarms: THREE.Mesh[]; vent: THREE.Vector3 }

function interior(s: GameState, g: THREE.Group, type: FloorType, w: number, i: number, anim: Animated) {
  const zb = -FD / 2;
  if (type === 'hall') {
    const n = perRow(s, i), sp = (w - 1.4) / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.7 + sp * (k + 0.5);
      box(g, sp * 0.7, 1.3, 1.1, 'surf', x, 0.85, zb + 1);
      anim.leds.push(box(g, sp * 0.3, 0.16, 0.05, 'accent', x, 0.8 + (k % 3) * 0.25, zb + 1.58));
    }
  } else if (type === 'cool') {
    const n = Math.max(2, Math.floor(w / 3)), sp = (w - 1) / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.5 + sp * (k + 0.5);
      box(g, sp * 0.8, 1.3, 1.2, 'surf', x, 0.85, zb + 1.1);
      const fan = new THREE.Group();
      fan.position.set(x, 0.9, zb + 1.75);
      g.add(fan);
      box(fan, 0.8, 0.14, 0.04, 'dark', 0, 0, 0);
      box(fan, 0.14, 0.8, 0.04, 'dark', 0, 0, 0);
      anim.fans.push(fan);
    }
    cyl(g, 0.12, w - 0.4, 'light', 0, FH - 0.35, zb + 0.5, 10).rotation.z = Math.PI / 2;
  } else if (type === 'power') {
    const n = Math.floor((w - 1) / 1.6);
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 1 + k * 1.6;
      box(g, 1.1, 1.3, 0.9, 'surf', x, 0.85, zb + 0.9);
      box(g, 1.12, 0.22, 0.92, 'light', x, 1.15, zb + 0.9);
    }
  } else if (type === 'net') {
    box(g, w - 2, 0.1, 1, 'surf', 0, 0.8, -0.3);
    const n = Math.floor((w - 2) / 2);
    for (let k = 0; k < n; k++) {
      const x = -(n - 1) + k * 2;
      box(g, 1.3, 0.8, 0.1, 'light', x, 1.35, -0.7);
      anim.leds.push(box(g, 0.5, 0.12, 0.04, 'accent', x, 1.35, -0.63));
    }
  } else if (type === 'break') {
    const x0 = -w / 2 + 2.2;
    box(g, 2.8, 0.45, 1, 'accent', x0, 0.45, zb + 1);
    box(g, 2.8, 0.7, 0.3, 'accent', x0, 0.95, zb + 0.6);
    box(g, 1.4, 0.1, 0.8, 'surf', x0, 0.6, zb + 2.3);
    box(g, 0.7, 1.1, 0.6, 'dark', w / 2 - 1.2, 0.75, zb + 0.6);
    add(g, new THREE.IcosahedronGeometry(0.5, 0), '#2E8B57', w / 2 - 2.6, 1, zb + 0.8);
  } else {
    box(g, 1.2, 1.45, 0.06, 'surf', -w / 2 + 1.6, 0.925, zb + 0.23);
    box(g, 3.2, 0.9, 0.9, 'surf', 0.6, 0.65, -0.6);
    box(g, 3.24, 0.16, 0.94, 'light', 0.6, 1.08, -0.6);
  }
}

function facade(g: THREE.Group, w: number, i: number) {
  const z = FD / 2 + 0.02;
  if (i === 0) {
    box(g, 1.1, 1.4, 0.06, 'surf', -w / 2 + 2, 0.9, z);
    box(g, 0.12, 0.12, 0.1, 'dark', -w / 2 + 2.3, 0.9, z + 0.04);
    cyl(g, 0.38, 0.06, 'light', w / 2 - 2, 1.05, z, 20).rotation.x = Math.PI / 2;
    return;
  }
  const n = Math.max(1, Math.floor(w / 3));
  for (let k = 0; k < n; k++) box(g, 0.8, 0.6, 0.06, 'light', -(n - 1) * 1.5 + k * 3, 1, z);
}

export function makeFloor(s: GameState, i: number, f: Floor, anim: Animated) {
  const g = new THREE.Group(), w = floorW(s, i), m = f.fill;
  g.position.y = baseY(s, i);
  box(g, w, 0.2, FD, m, 0, 0.1, 0);
  box(g, w, FH, 0.2, m, 0, FH / 2, -FD / 2 + 0.1);
  box(g, 0.2, FH, FD, m, -w / 2 + 0.1, FH / 2, 0);
  box(g, 0.2, FH, FD, m, w / 2 - 0.1, FH / 2, 0);
  if (s.inside) {
    interior(s, g, f.type, w, i, anim);
  } else {
    box(g, w, FH, 0.2, m, 0, FH / 2, FD / 2 - 0.1);
    facade(g, w, i);
  }
  if (isBroken(s, i) && f.done) {
    // a warning light the engine blinks, on the wall facing the camera
    const z = s.inside ? -FD / 2 + 0.25 : FD / 2 + 0.06;
    anim.alarms.push(box(g, 1.4, 0.5, 0.12, 'accent', w / 2 - 1.4, FH - 0.45, z));
  }
  g.traverse(o => { o.userData.floor = i; });
  return g;
}

export function makeRoof(s: GameState, anim: Animated) {
  const n = s.floors.length;
  const g = new THREE.Group(), w = floorW(s, n - 1), top = baseY(s, n), fill = s.floors[n - 1].fill;
  box(g, w + 0.2, 0.25, FD + 0.2, fill, 0, top + 0.125, 0);
  const t = top + 0.25;
  anim.vent.set(0, t + 1.5, 0);
  const teeth = (x0: number, span: number) => {
    const k = Math.max(2, Math.round(span / 2.6)), tw = span / k;
    for (let j = 0; j < k; j++) prism(g, [[0, 0], [tw, 0], [0, 1.4]], FD, 'surf', x0 + j * tw, t, -FD / 2);
  };
  if (s.shape === 'shed') {
    teeth(-w / 2, w);
    const ht = top + 1.4, L = Math.min(ht * 0.62, 12);
    prism(g, [[0, 0], [L, 0], [0, ht]], FD, 'surf', w / 2, 0, -FD / 2);
    const cx = w / 2 + L * 0.22, cy = ht * 0.78;
    box(g, 0.9, 2.2, 0.9, 'surf', cx, cy + 0.6, 0);
    anim.vent.set(cx, cy + 2, 0);
  } else if (s.shape === 'saw') {
    teeth(-w / 2, w);
  } else if (s.shape === 'hangar') {
    const v = add(g, new THREE.CylinderGeometry(w / 2, w / 2, FD, 32, 1, false, Math.PI / 2, Math.PI), 'surf', 0, t, 0);
    v.rotation.x = Math.PI / 2;
    v.scale.set(1, 1, 0.55);
    anim.vent.set(0, t + w * 0.28 + 1, 0);
  } else {
    for (const z of [FD / 2, -FD / 2]) box(g, w + 0.2, 0.45, 0.15, 'surf', 0, t + 0.22, z);
    for (const side of [-1, 1]) box(g, 0.15, 0.45, FD, 'surf', side * (w / 2), t + 0.22, 0);
    box(g, 2.2, 0.9, 1.8, 'surf', -w / 4, t + 0.45, -0.6);
    const stack = cyl(g, 0.45, 1.6, 'surf', w / 4, t + 0.8, -0.6, 16);
    anim.vent.set(stack.position.x, t + 2, -0.6);
    if (s.shape === 'tower') cyl(g, 0.06, 3, 'dark', w / 2 - 0.8, t + 1.5, FD / 2 - 1, 6);
  }
  g.traverse(o => { o.userData.floor = n - 1; });
  return g;
}

/** A townsperson holding a sign. */
export function makePerson(shirt: string) {
  const g = new THREE.Group();
  const legs = [-0.12, 0.12].map(x => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.45, 0);
    g.add(pivot);
    box(pivot, 0.2, 0.45, 0.2, 'dark', 0, -0.22, 0);
    return pivot;
  });
  box(g, 0.6, 0.55, 0.36, shirt, 0, 0.72, 0);
  box(g, 0.46, 0.42, 0.42, 'surf', 0, 1.22, 0);
  box(g, 0.5, 0.14, 0.46, 'dark', 0, 1.47, 0);
  const sign = new THREE.Group();
  sign.position.set(0.38, 0.9, 0.1);
  g.add(sign);
  box(sign, 0.08, 1.5, 0.08, 'dark', 0, 0.75, 0);
  box(sign, 1, 0.65, 0.08, 'surf', 0, 1.55, 0.02);
  return { group: g, legs, sign };
}

export function makeWorker() {
  const g = new THREE.Group();
  const legs = [-0.12, 0.12].map(x => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.45, 0);
    g.add(pivot);
    box(pivot, 0.2, 0.45, 0.2, 'dark', 0, -0.22, 0);
    return pivot;
  });
  box(g, 0.6, 0.55, 0.36, 'accent', 0, 0.72, 0);
  box(g, 0.46, 0.42, 0.42, 'surf', 0, 1.22, 0);
  box(g, 0.5, 0.14, 0.46, 'dark', 0, 1.47, 0);
  return { group: g, legs };
}

// ---------- the lot: trees that get cleared, and a landmark per location ----------

/** Deterministic tree spots around the lot, nearest first, avoiding the building footprint. */
function treeSpots(loc: LocKey, count: number) {
  let seed = loc.length * 9301 + count * 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const spots: [number, number][] = [];
  let guard = 0;
  while (spots.length < count && guard++ < 4000) {
    const a = rnd() * Math.PI * 2, r = 8.5 + rnd() * 8.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    if (x > -8 && x < 19 && z > -6.5 && z < 6.5) continue;
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.2)) continue;
    spots.push([x, z]);
  }
  return spots.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
}

export function makeTree(loc: LocKey, k: number) {
  const g = new THREE.Group();
  const h = 2.4 + (k % 3) * 0.5;
  if (loc === 'dalles') {
    cyl(g, 0.18, 0.6, SCENERY_THREADS.bark, 0, 0.3, 0, 6);
    cone(g, 1, h, '#2E8B57', 0, 0.6 + h / 2, 0, 8);
  } else if (loc === 'reykjavik') {
    cyl(g, 0.12, h * 0.7, 'surf', 0, h * 0.35, 0, 6);
    add(g, new THREE.IcosahedronGeometry(0.7, 0), SCENERY_THREADS.moss, 0, h * 0.75, 0);
  } else if (loc === 'phoenix') {
    cyl(g, 0.32, h, '#2E8B57', 0, h / 2, 0, 10);
    cyl(g, 0.22, 1, '#2E8B57', -0.65, h * 0.6, 0, 10);
    box(g, 0.65, 0.26, 0.26, '#2E8B57', -0.33, h * 0.45, 0);
  } else {
    cyl(g, 0.2, 1, SCENERY_THREADS.bark, 0, 0.5, 0, 8);
    add(g, new THREE.IcosahedronGeometry(1.1, 1), '#2E8B57', 0, 1.6 + (k % 2) * 0.3, 0);
  }
  return g;
}

function stump() {
  const g = new THREE.Group();
  cyl(g, 0.3, 0.3, SCENERY_THREADS.bark, 0, 0.15, 0, 8);
  return g;
}

function landmark(loc: LocKey, g: THREE.Group) {
  if (loc === 'dalles') {
    box(g, 60, 0.04, 3.2, '#99BBFF', 0, 0.02, 13).castShadow = false;
  } else if (loc === 'reykjavik') {
    cone(g, 6, 8, SCENERY_THREADS.snow, -14, 4, -17, 5);
    cone(g, 4, 5.5, SCENERY_THREADS.snow, -5, 2.75, -20, 5);
    cone(g, 3, 4, SCENERY_THREADS.snow, 18, 2, -15, 5);
  } else if (loc === 'phoenix') {
    box(g, 9, 3.4, 5, SCENERY_THREADS.sand, -12, 1.7, -16);
    box(g, 6, 2.4, 4, SCENERY_THREADS.sand, 16, 1.2, -15);
  } else {
    box(g, 7, 2.6, 5, 'surf', -15, 1.3, -14);
    box(g, 1.6, 0.6, 1.2, 'surf', -16, 2.9, -14);
    box(g, 6, 2.2, 4.5, 'surf', 17, 1.1, -13);
  }
}

export interface TreeSpot { x: number; z: number; k: number }

/** Builds the lot: standing trees, stumps for the first `cleared` spots, and the landmark. */
export function makeScenery(s: GameState, g: THREE.Group, total: number, cleared: number): TreeSpot[] {
  clear(g);
  landmark(s.loc, g);
  const spots = treeSpots(s.loc, total).map(([x, z], k) => ({ x, z, k }));
  for (const sp of spots) {
    const t = sp.k < cleared ? stump() : makeTree(s.loc, sp.k);
    t.position.set(sp.x, 0, sp.z);
    g.add(t);
  }
  return spots;
}
