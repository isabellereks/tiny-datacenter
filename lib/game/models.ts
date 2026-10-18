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
/** Small parts repeat a lot, so identical geometry is shared and never disposed. */
const geos = new Map<string, THREE.BufferGeometry>();
function shared(key: string, make: () => THREE.BufferGeometry) {
  let g = geos.get(key);
  if (!g) { g = make(); g.userData.shared = true; geos.set(key, g); }
  return g;
}
const box = (p: P, w: number, h: number, d: number, r: M, x: number, y: number, z: number) =>
  add(p, shared(`b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d)), r, x, y, z);
const cyl = (p: P, rad: number, h: number, r: M, x: number, y: number, z: number, seg = 16) =>
  add(p, shared(`c${rad.toFixed(3)},${h.toFixed(3)},${seg}`, () => new THREE.CylinderGeometry(rad, rad, h, seg)), r, x, y, z);
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
    c.traverse(o => { if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose(); });
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

/** Parts the engine animates. Fans spin face-on, rotors spin flat (rooftop fans). */
export interface Animated { leds: THREE.Mesh[]; fans: THREE.Group[]; rotors: THREE.Group[]; alarms: THREE.Mesh[]; vent: THREE.Vector3 }

// thread colours for equipment, so each kind of floor reads at a glance
const INK = '#1F2A44', SLATE = '#7D8597', SKY = '#99BBFF', CHERRY = '#D7263D', MARIGOLD = '#F2B43C';
const FERN = '#2E8B57', MINT = '#A8D5BA', GRAPE = '#6A4BB5', LILAC = '#C9B6F2', BLUSH = '#F4A6B8';

/** A fan: a ring with a cross that the engine spins. */
function fan(p: P, x: number, y: number, z: number, rad: number, list: THREE.Group[], flat = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (flat) g.rotation.x = -Math.PI / 2;
  p.add(g);
  box(g, rad * 1.8, Math.max(0.2, rad * 0.32), 0.04, 'dark', 0, 0, 0);
  box(g, Math.max(0.2, rad * 0.32), rad * 1.8, 0.04, 'dark', 0, 0, 0);
  list.push(g);
  return g;
}

function plant(p: P, x: number, y: number, z: number, k = 1) {
  box(p, 0.42 * k, 0.4 * k, 0.42 * k, 'surf', x, y + 0.2 * k, z);
  add(p, new THREE.IcosahedronGeometry(0.42 * k, 0), FERN, x, y + 0.72 * k, z);
}

function interior(s: GameState, g: THREE.Group, type: FloorType, w: number, i: number, anim: Animated) {
  const zb = -FD / 2, top = FH - 0.2;
  if (type === 'hall') {
    // rows of racks with status lights, fed by an overhead cable tray
    const n = perRow(s, i), sp = (w - 1.4) / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.7 + sp * (k + 0.5), rw = sp * 0.72;
      box(g, rw, 1.3, 1.1, INK, x, 0.85, zb + 1);
      box(g, rw * 0.7, 0.08, 0.04, SLATE, x, 1.3, zb + 1.57);
      box(g, rw * 0.7, 0.08, 0.04, SLATE, x, 0.55, zb + 1.57);
      anim.leds.push(box(g, rw * 0.28, 0.2, 0.05, 'accent', x - rw * 0.18, 0.75 + (k % 3) * 0.17, zb + 1.58));
      anim.leds.push(box(g, rw * 0.28, 0.2, 0.05, MINT, x + rw * 0.18, 1.05 - (k % 2) * 0.2, zb + 1.58));
    }
    box(g, w - 1, 0.12, 0.6, SLATE, 0, top - 0.05, zb + 1);
    for (let k = 0; k < n; k++) box(g, 0.08, top - 1.55, 0.08, 'dark', -w / 2 + 0.7 + sp * (k + 0.5), (top + 1.5) / 2, zb + 1);
  } else if (type === 'cool') {
    // chillers with spinning fans, cold water pipe in blue and the warm return in red
    const n = Math.max(2, Math.floor(w / 3)), sp = (w - 1) / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.5 + sp * (k + 0.5);
      box(g, sp * 0.8, 1.25, 1.2, MINT, x, 0.82, zb + 1.1);
      box(g, sp * 0.8, 0.12, 1.22, 'light', x, 1.4, zb + 1.1);
      cyl(g, 0.42, 0.06, 'surf', x, 0.85, zb + 1.72, 16).rotation.x = Math.PI / 2;
      fan(g, x, 0.85, zb + 1.76, 0.4, anim.fans);
      cyl(g, 0.07, top - 1.46, CHERRY, x - sp * 0.25, (top + 1.46) / 2, zb + 0.75, 8);
    }
    cyl(g, 0.12, w - 0.4, SKY, 0, top - 0.12, zb + 0.45, 10).rotation.z = Math.PI / 2;
    cyl(g, 0.12, w - 0.4, CHERRY, 0, top - 0.12, zb + 0.75, 10).rotation.z = Math.PI / 2;
  } else if (type === 'power') {
    // transformers with cooling fins, battery cabinets and a busbar along the ceiling
    const n = Math.max(2, Math.floor((w - 1) / 1.6));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 1 + k * 1.6;
      if (k % 2 === 0) {
        box(g, 1.1, 1.1, 0.9, MARIGOLD, x, 0.75, zb + 0.9);
        for (const fx of [-0.35, 0, 0.35]) box(g, 0.1, 0.8, 0.08, 'dark', x + fx, 0.72, zb + 1.38);
        box(g, 0.3, 0.3, 0.3, 'surf', x, 1.45, zb + 0.9);
      } else {
        box(g, 1.2, 1.3, 0.7, SLATE, x, 0.85, zb + 0.8);
        box(g, 0.08, 1.1, 0.04, 'dark', x, 0.85, zb + 1.17);
        anim.leds.push(box(g, 0.2, 0.16, 0.05, MINT, x - 0.3, 1.25, zb + 1.18));
        box(g, 0.22, 0.22, 0.04, MARIGOLD, x + 0.3, 1.2, zb + 1.18);
      }
    }
    box(g, w - 1, 0.16, 0.24, 'dark', 0, top - 0.1, zb + 0.6);
  } else if (type === 'net') {
    // open racks of patch panels, fibre in yellow trays, and an operator desk
    const n = Math.max(1, Math.floor((w - 4) / 1.6));
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 1.2 + k * 1.6;
      box(g, 1.1, 1.35, 0.8, INK, x, 0.87, zb + 0.8);
      for (let j = 0; j < 3; j++) box(g, 0.9, 0.16, 0.04, GRAPE, x, 0.6 + j * 0.32, zb + 1.22);
      anim.leds.push(box(g, 0.24, 0.12, 0.05, 'accent', x + 0.2, 0.92, zb + 1.25));
      box(g, 0.1, top - 1.55, 0.1, MARIGOLD, x, (top + 1.55) / 2, zb + 0.8);
    }
    box(g, w - 1, 0.1, 0.4, MARIGOLD, 0, top - 0.08, zb + 0.8);
    const dx = w / 2 - 1.6;
    box(g, 2, 0.12, 0.9, 'surf', dx, 0.8, zb + 1.2);
    for (const lx of [-0.85, 0.85]) box(g, 0.1, 0.6, 0.8, 'surf', dx + lx, 0.5, zb + 1.2);
    box(g, 0.8, 0.5, 0.06, INK, dx - 0.2, 1.15, zb + 1);
    box(g, 0.6, 0.36, 0.04, LILAC, dx - 0.2, 1.17, zb + 1.04);
    cyl(g, 0.3, 0.2, MARIGOLD, dx + 0.6, 0.96, zb + 1.2, 12);
  } else if (type === 'break') {
    // couch, coffee table, kitchen counter, fridge, a plant and a clock
    const x0 = -w / 2 + 2.2;
    box(g, 2.8, 0.45, 1, 'accent', x0, 0.45, zb + 1);
    box(g, 2.8, 0.7, 0.3, 'accent', x0, 0.95, zb + 0.6);
    for (const sx of [-1.5, 1.5]) box(g, 0.3, 0.65, 1, 'accent', x0 + sx, 0.55, zb + 1);
    box(g, 1.4, 0.1, 0.8, 'surf', x0, 0.6, zb + 2.3);
    box(g, 0.3, 0.2, 0.3, BLUSH, x0 + 0.3, 0.75, zb + 2.3);
    const kx = w / 2 - 2.4;
    box(g, 2, 0.8, 0.7, 'surf', kx, 0.6, zb + 0.55);
    box(g, 2.04, 0.1, 0.74, SLATE, kx, 1.03, zb + 0.55);
    box(g, 0.35, 0.4, 0.3, INK, kx + 0.5, 1.28, zb + 0.5);
    box(g, 0.25, 0.25, 0.25, CHERRY, kx - 0.4, 1.2, zb + 0.5);
    box(g, 0.8, 1.35, 0.7, 'surf', w / 2 - 0.85, 0.87, zb + 0.55);
    box(g, 0.06, 0.4, 0.04, 'dark', w / 2 - 1.1, 1.05, zb + 0.92);
    cyl(g, 0.26, 0.05, 'surf', x0, 1.45, zb + 0.24, 16).rotation.x = Math.PI / 2;
    box(g, 0.05, 0.18, 0.04, 'dark', x0, 1.5, zb + 0.28);
    plant(g, -w / 2 + 0.5, 0.2, zb + 0.6);
  } else {
    // front desk, logo on the wall, elevator, bench and plants
    box(g, 1.2, 1.45, 0.06, SLATE, -w / 2 + 1.6, 0.925, zb + 0.23);
    box(g, 0.04, 1.45, 0.07, 'dark', -w / 2 + 1.6, 0.925, zb + 0.24);
    box(g, 0.2, 0.2, 0.05, 'accent', -w / 2 + 2.4, 1.15, zb + 0.24);
    box(g, 3.2, 0.9, 0.9, 'surf', 0.6, 0.65, -0.6);
    box(g, 3.24, 0.16, 0.94, MARIGOLD, 0.6, 1.08, -0.6);
    box(g, 0.6, 0.35, 0.06, INK, 0.2, 1.33, -0.8);
    box(g, 2.4, 0.5, 0.06, 'light', 0.6, 1.35, zb + 0.23);
    box(g, 0.5, 0.3, 0.07, 'accent', -0.3, 1.35, zb + 0.24);
    box(g, 1.6, 0.35, 0.6, 'surf', w / 2 - 1.8, 0.4, 0.4);
    plant(g, w / 2 - 0.6, 0.2, zb + 0.7);
    plant(g, -w / 2 + 2.8, 0.2, zb + 0.7, 0.8);
  }
}

/**
 * The face toward the camera: windows, vents and grilles that say what each floor is.
 * A stitch is about 0.2 units, so parts are flush patches at least two stitches across.
 */
function facade(g: THREE.Group, type: FloorType, w: number, i: number, anim: Animated) {
  const z = FD / 2 + 0.02;
  if (i === 0) {
    // glass doors under an awning, steps, a round sign and a lobby window
    const dx = -w / 2 + 2;
    box(g, 1.5, 1.35, 0.04, 'light', dx, 0.88, z);
    box(g, 0.2, 1.35, 0.05, 'dark', dx, 0.88, z + 0.005);
    box(g, 2.1, 0.3, 0.8, 'accent', dx, 1.68, z + 0.38);
    box(g, 2.4, 0.2, 0.9, 'surf', dx, 0.1, z + 0.45);
    cyl(g, 0.42, 0.06, 'accent', w / 2 - 2, 1.05, z, 20).rotation.x = Math.PI / 2;
    box(g, 2.4, 0.8, 0.04, 'light', 0.9, 1, z);
    return;
  }
  const n = Math.max(1, Math.floor(w / 3));
  for (let k = 0; k < n; k++) {
    const x = -(n - 1) * 1.5 + k * 3;
    if (type === 'cool') {
      cyl(g, 0.6, 0.04, 'light', x, 0.95, z, 20).rotation.x = Math.PI / 2;
      fan(g, x, 0.95, z + 0.03, 0.55, anim.fans);
    } else if (type === 'power') {
      box(g, 1.4, 1, 0.04, 'light', x, 0.95, z);
      for (const y of [0.75, 1.15]) box(g, 1.4, 0.2, 0.05, 'dark', x, y, z + 0.005);
    } else if (type === 'net') {
      for (const d of [-0.45, 0.45]) box(g, 0.4, 1.1, 0.04, 'light', x + d, 1, z);
    } else if (type === 'break') {
      box(g, 2, 0.9, 0.04, 'light', x, 1.05, z);
      box(g, 0.6, 0.9, 0.05, '#F4A6B8', x - 0.7, 1.05, z + 0.005);
    } else {
      box(g, 1, 0.7, 0.04, 'light', x, 1, z);
    }
  }
}

/** The side toward the camera, seen at a steep angle: only big metal patches read there. */
function side(g: THREE.Group, type: FloorType, w: number, i: number, shape: GameState['shape']) {
  const x = w / 2 + 0.02;
  if (i === 0) {
    if (shape === 'shed') return;
    // loading dock: a roll-up door and a ramp
    box(g, 0.04, 1.4, 2, SLATE, x, 0.9, -0.6);
    box(g, 1, 0.3, 2.4, 'surf', x + 0.5, 0.15, -0.6);
  } else if (type === 'hall' || type === 'power' || type === 'cool') {
    box(g, 0.04, 0.8, 2.4, SLATE, x, 1, -0.4);
  }
}

export function makeFloor(s: GameState, i: number, f: Floor, anim: Animated) {
  const g = new THREE.Group(), w = floorW(s, i), m = f.fill;
  g.position.y = baseY(s, i);
  box(g, w, 0.2, FD, m, 0, 0.1, 0);
  box(g, w, FH, 0.2, m, 0, FH / 2, -FD / 2 + 0.1);
  box(g, 0.2, FH, FD, m, -w / 2 + 0.1, FH / 2, 0);
  box(g, 0.2, FH, FD, m, w / 2 - 0.1, FH / 2, 0);
  if (s.inside) {
    // shaded wallpaper on bare cloth, so the white equipment stands out
    if (m === 'cloth') box(g, w - 0.4, FH - 0.2, 0.04, 'light', 0, FH / 2 + 0.1, -FD / 2 + 0.22);
    interior(s, g, f.type, w, i, anim);
  } else {
    box(g, w, FH, 0.2, m, 0, FH / 2, FD / 2 - 0.1);
    facade(g, f.type, w, i, anim);
    side(g, f.type, w, i, s.shape);
  }
  if (isBroken(s, i) && f.done) {
    // a warning light the engine blinks, on the wall facing the camera
    const z = s.inside ? -FD / 2 + 0.25 : FD / 2 + 0.06;
    anim.alarms.push(box(g, 1.4, 0.5, 0.12, 'accent', w / 2 - 1.4, FH - 0.45, z));
  }
  g.traverse(o => { o.userData.floor = i; });
  return g;
}

/** Rooftop kit for flat roofs: AC units with fans, a vent stack, a hatch and an antenna. */
function rooftop(g: THREE.Group, s: GameState, w: number, t: number, anim: Animated) {
  for (const z of [FD / 2, -FD / 2]) box(g, w + 0.2, 0.45, 0.15, 'surf', 0, t + 0.22, z);
  for (const sd of [-1, 1]) box(g, 0.15, 0.45, FD, 'surf', sd * (w / 2), t + 0.22, 0);
  const units = w > 7 ? [-w / 4 - 0.6, -w / 4 + 1.2] : [-w / 4];
  for (const x of units) {
    box(g, 1.5, 0.7, 1.5, 'surf', x, t + 0.35, -0.9);
    cyl(g, 0.5, 0.06, 'light', x, t + 0.72, -0.9, 16);
    fan(g, x, t + 0.76, -0.9, 0.45, anim.rotors, true);
  }
  box(g, 0.9, 0.3, 0.9, 'light', -w / 4 + 0.3, t + 0.15, 1.6);
  const stack = cyl(g, 0.45, 1.6, 'surf', w / 4, t + 0.8, -0.6, 16);
  cyl(g, 0.52, 0.14, 'dark', w / 4, t + 1.55, -0.6, 16);
  anim.vent.set(stack.position.x, t + 2, -0.6);
  cyl(g, 0.06, 2.4, 'dark', w / 2 - 0.8, t + 1.2, FD / 2 - 1, 6);
  box(g, 0.5, 0.08, 0.08, 'dark', w / 2 - 0.8, t + 2, FD / 2 - 1);
  box(g, 0.14, 0.14, 0.14, 'accent', w / 2 - 0.8, t + 2.45, FD / 2 - 1);
  // a dish pointed at the sky
  const dish = add(g, new THREE.SphereGeometry(0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), 'surf', w / 4 + 1.6, t + 0.55, 1.2);
  dish.rotation.x = Math.PI - 0.6;
  cyl(g, 0.06, 0.5, 'dark', w / 4 + 1.6, t + 0.25, 1.2, 6);
  if (s.shape === 'tower') cyl(g, 0.06, 3, 'dark', -w / 2 + 0.8, t + 1.5, -FD / 2 + 1, 6);
}

export function makeRoof(s: GameState, anim: Animated) {
  const n = s.floors.length;
  const g = new THREE.Group(), w = floorW(s, n - 1), top = baseY(s, n), fill = s.floors[n - 1].fill;
  box(g, w + 0.2, 0.25, FD + 0.2, fill, 0, top + 0.125, 0);
  const t = top + 0.25;
  anim.vent.set(0, t + 1.5, 0);
  const teeth = (x0: number, span: number) => {
    const k = Math.max(2, Math.round(span / 2.6)), tw = span / k;
    for (let j = 0; j < k; j++) {
      prism(g, [[0, 0], [tw, 0], [0, 1.4]], FD, 'surf', x0 + j * tw, t, -FD / 2);
      // the glass on each tooth's steep side
      box(g, 0.06, 0.9, FD - 1, 'light', x0 + j * tw + 0.04, t + 0.6, 0);
    }
  };
  if (s.shape === 'shed') {
    teeth(-w / 2, w);
    const ht = top + 1.4, L = Math.min(ht * 0.62, 12);
    prism(g, [[0, 0], [L, 0], [0, ht]], FD, 'surf', w / 2, 0, -FD / 2);
    const cx = w / 2 + L * 0.22, cy = ht * 0.78;
    box(g, 0.9, 2.2, 0.9, 'surf', cx, cy + 0.6, 0);
    cyl(g, 0.5, 0.06, 'light', w / 2 + L * 0.55, ht * 0.45 + 0.03, 1.6, 16);
    fan(g, w / 2 + L * 0.55, ht * 0.45 + 0.08, 1.6, 0.45, anim.rotors, true);
    anim.vent.set(cx, cy + 2, 0);
  } else if (s.shape === 'saw') {
    teeth(-w / 2, w);
  } else if (s.shape === 'hangar') {
    const v = add(g, new THREE.CylinderGeometry(w / 2, w / 2, FD, 32, 1, false, Math.PI / 2, Math.PI), 'surf', 0, t, 0);
    v.rotation.x = Math.PI / 2;
    v.scale.set(1, 1, 0.55);
    // ribs over the vault and a row of skylights along the top
    for (const z of [-FD / 2 + 0.05, -FD / 6, FD / 6, FD / 2 - 0.05]) {
      const rib = add(g, shared(`rib${w}`, () => new THREE.TorusGeometry(w / 2, 0.07, 4, 24, Math.PI)), 'dark', 0, t, z);
      rib.scale.set(1, 0.55, 1);
    }
    for (const x of [-1.2, 1.2]) box(g, 1.2, 0.12, FD * 0.7, 'light', x, t + w * 0.27, 0);
    anim.vent.set(0, t + w * 0.28 + 1, 0);
  } else {
    rooftop(g, s, w, t, anim);
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

// ---------- the lot: trees that get cleared, the site around the building, and a landmark per location ----------

type Rect = [number, number, number, number];
/** Parking, substation and each place's landmark; trees stay out of these. */
const PARKING: Rect = [-10.5, -2.2, 5.6, 9.8];
const SUBSTATION: Rect = [7.6, 13, -9.6, -4.4];
const EXTRA: Record<LocKey, Rect[]> = {
  dalles: [[-30, 30, 11, 15.5]],
  reykjavik: [[-17, 6, -10.5, -8]],
  phoenix: [[-12.5, -2, -13, -8.5]],
  ashburn: [[-30, 30, 11, 15.5]],
};
const inRect = (x: number, z: number, [x0, x1, z0, z1]: Rect, pad = 1) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;

/** Deterministic tree spots around the lot, nearest first, avoiding the building and the site. */
function treeSpots(loc: LocKey, count: number) {
  let seed = loc.length * 9301 + count * 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const keep = [PARKING, SUBSTATION, ...EXTRA[loc]];
  const spots: [number, number][] = [];
  let guard = 0;
  while (spots.length < count && guard++ < 6000) {
    const a = rnd() * Math.PI * 2, r = 8.5 + rnd() * 8.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    if (x > -8 && x < 19 && z > -6.5 && z < 6.5) continue;
    if (keep.some(k => inRect(x, z, k))) continue;
    if (spots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.2)) continue;
    spots.push([x, z]);
  }
  return spots.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
}

const GREEN = '#2E8B57';

export function makeTree(loc: LocKey, k: number) {
  const g = new THREE.Group();
  const h = 2.4 + (k % 3) * 0.5;
  if (loc === 'dalles') {
    // a Douglas fir in two tiers
    cyl(g, 0.18, 0.6, SCENERY_THREADS.bark, 0, 0.3, 0, 6);
    cone(g, 1.05, h * 0.62, GREEN, 0, 0.6 + h * 0.31, 0, 8);
    cone(g, 0.75, h * 0.55, GREEN, 0, 0.6 + h * 0.68, 0, 8);
  } else if (loc === 'reykjavik') {
    cyl(g, 0.12, h * 0.7, 'surf', 0, h * 0.35, 0, 6);
    add(g, shared('ico0.7', () => new THREE.IcosahedronGeometry(0.7, 0)), SCENERY_THREADS.moss, 0, h * 0.75, 0);
    if (k % 2) add(g, shared('ico0.45', () => new THREE.IcosahedronGeometry(0.45, 0)), SCENERY_THREADS.moss, 0.35, h * 0.5, 0.1);
  } else if (loc === 'phoenix') {
    // saguaro: one or two arms
    cyl(g, 0.32, h, GREEN, 0, h / 2, 0, 10);
    cyl(g, 0.22, 1, GREEN, -0.65, h * 0.6, 0, 10);
    box(g, 0.65, 0.26, 0.26, GREEN, -0.33, h * 0.45, 0);
    if (k % 2 === 0) {
      cyl(g, 0.2, 0.8, GREEN, 0.6, h * 0.5, 0, 10);
      box(g, 0.6, 0.24, 0.24, GREEN, 0.3, h * 0.37, 0);
    }
  } else {
    cyl(g, 0.2, 1, SCENERY_THREADS.bark, 0, 0.5, 0, 8);
    add(g, shared('ico1.1', () => new THREE.IcosahedronGeometry(1.1, 1)), GREEN, 0, 1.6 + (k % 2) * 0.3, 0);
    if (k % 3 === 0) add(g, shared('ico0.7b', () => new THREE.IcosahedronGeometry(0.7, 1)), GREEN, 0.7, 1.3, 0.3);
  }
  return g;
}

function stump() {
  const g = new THREE.Group();
  cyl(g, 0.3, 0.3, SCENERY_THREADS.bark, 0, 0.15, 0, 8);
  return g;
}

/** A thin rod from a to b: power lines, pipes. */
function rod(p: P, a: THREE.Vector3, b: THREE.Vector3, rad: number, r: M) {
  const d = b.clone().sub(a);
  const m = add(p, new THREE.CylinderGeometry(rad, rad, d.length(), 5), r, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = false;
  return m;
}

const rock = (p: P, x: number, z: number, k: number, r: M = '#7D8597') =>
  add(p, shared(`rock${k}`, () => new THREE.DodecahedronGeometry(k, 0)), r, x, k * 0.5, z);

function lamp(p: P, x: number, z: number) {
  cyl(p, 0.07, 2.2, 'dark', x, 1.1, z, 6);
  box(p, 0.6, 0.1, 0.12, 'dark', x + 0.25, 2.2, z);
  box(p, 0.3, 0.14, 0.26, '#F2B43C', x + 0.45, 2.12, z);
}

function car(p: P, x: number, z: number, color: string) {
  box(p, 1, 0.45, 1.9, color, x, 0.35, z);
  box(p, 0.86, 0.36, 1, 'light', x, 0.75, z - 0.1);
  for (const [dx, dz] of [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.6], [0.5, 0.6]]) box(p, 0.08, 0.26, 0.38, 'dark', x + dx, 0.13, z + dz);
}

/** Parking out front, and a substation feeding the building. */
function site(s: GameState, g: THREE.Group) {
  const [px0, px1, pz0, pz1] = PARKING;
  const pw = px1 - px0, pd = pz1 - pz0, pcx = (px0 + px1) / 2, pcz = (pz0 + pz1) / 2;
  box(g, pw, 0.05, pd, '#7D8597', pcx, 0.025, pcz).castShadow = false;
  const bays = 4;
  for (let k = 0; k <= bays; k++) box(g, 0.14, 0.06, pd * 0.45, 'surf', px0 + 0.4 + k * ((pw - 0.8) / bays), 0.035, pz1 - pd * 0.25).castShadow = false;
  const cars = ['#D7263D', '#99BBFF', '#F2B43C'];
  const filled = 1 + Math.min(2, s.workers.length);
  for (let k = 0; k < filled; k++) car(g, px0 + 0.4 + (k + 0.5) * ((pw - 0.8) / bays) + (k === 2 ? (pw - 0.8) / bays : 0), pz1 - pd * 0.27, cars[k]);
  // a path from the parking to the door
  box(g, 1.2, 0.05, 2.2, 'surf', -FW / 2 + 2, 0.025, FD / 2 + 1.6).castShadow = false;
  lamp(g, px0 - 0.3, pz0 + 0.4);
  lamp(g, px1 + 0.3, pz0 + 0.4);

  if (!s.floors.some(f => f.type === 'power')) return;
  const [sx0, sx1, sz0, sz1] = SUBSTATION;
  const scx = (sx0 + sx1) / 2, scz = (sz0 + sz1) / 2;
  box(g, sx1 - sx0, 0.12, sz1 - sz0, 'surf', scx, 0.06, scz).castShadow = false;
  for (const dx of [-1.3, 0.3]) {
    box(g, 1.2, 1.2, 1.2, '#7D8597', scx + dx, 0.72, scz + 0.6);
    cyl(g, 0.16, 0.6, 'surf', scx + dx, 1.6, scz + 0.6, 8);
  }
  // a lattice pylon, with lines to the building's power floor
  const tx = sx1 - 1, tz = sz0 + 1, th = 5.5;
  for (const [a, b] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    rod(g, new THREE.Vector3(tx + a, 0, tz + b), new THREE.Vector3(tx + a * 0.3, th, tz + b * 0.3), 0.1, 'dark');
  }
  box(g, 0.9, 0.2, 0.2, 'dark', tx, 2.6, tz);
  box(g, 2.2, 0.22, 0.22, 'dark', tx, th, tz);
  const pi = s.floors.findIndex(f => f.type === 'power');
  const wy = baseY(s, pi) + FH * 0.75, wx = floorW(s, pi) / 2;
  for (const dz of [-0.9, 0.9]) {
    rod(g, new THREE.Vector3(tx + dz, th, tz), new THREE.Vector3(wx, wy, -FD / 2 + 1.2 + dz * 0.5), 0.07, 'dark');
  }
}

function landmark(loc: LocKey, g: THREE.Group) {
  if (loc === 'dalles') {
    // the Columbia river, with rocks on the bank
    box(g, 60, 0.04, 3.2, '#99BBFF', 0, 0.02, 13).castShadow = false;
    for (const [x, z, k] of [[-6, 11.2, 0.5], [3, 11.1, 0.35], [8, 14.9, 0.45]]) rock(g, x, z, k);
  } else if (loc === 'reykjavik') {
    cone(g, 6, 8, SCENERY_THREADS.snow, -14, 4, -17, 5);
    cone(g, 4, 5.5, SCENERY_THREADS.snow, -5, 2.75, -20, 5);
    cone(g, 3, 4, SCENERY_THREADS.snow, 18, 2, -15, 5);
    // a geothermal pipeline on short stilts, and lava rocks
    const pipe = cyl(g, 0.3, 22, 'surf', -5.5, 0.75, -9.2, 10);
    pipe.rotation.z = Math.PI / 2;
    for (let x = -16; x <= 5; x += 3) box(g, 0.15, 0.6, 0.5, 'dark', x, 0.3, -9.2);
    for (const [x, z, k] of [[9, 9, 0.5], [-12, 6, 0.4], [14, -2, 0.55], [-3, 12, 0.35]]) rock(g, x, z, k, '#1F2A44');
  } else if (loc === 'phoenix') {
    box(g, 9, 3.4, 5, SCENERY_THREADS.sand, -12, 1.7, -16);
    box(g, 6, 2.4, 4, SCENERY_THREADS.sand, 16, 1.2, -15);
    // a small solar farm
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = -11 + c * 3.2, z = -12 + r * 1.4;
      const panel = box(g, 2.8, 0.08, 1, '#1F2A44', x, 0.7, z);
      panel.rotation.x = -0.45;
      box(g, 0.1, 0.6, 0.1, 'dark', x, 0.3, z);
    }
    for (const [x, z, k] of [[10, 9, 0.45], [-14, 5, 0.35], [12, -3, 0.5]]) rock(g, x, z, k, SCENERY_THREADS.sand);
  } else {
    // other datacenters down the road
    box(g, 7, 2.6, 5, 'surf', -15, 1.3, -14);
    box(g, 1.6, 0.6, 1.2, 'surf', -16, 2.9, -14);
    box(g, 6, 2.2, 4.5, 'surf', 17, 1.1, -13);
    for (const x of [15, 17, 19]) box(g, 1, 0.5, 1, 'light', x, 2.45, -13);
    box(g, 60, 0.04, 3, '#7D8597', 0, 0.02, 13).castShadow = false;
    for (let x = -18; x <= 18; x += 3) box(g, 1.4, 0.05, 0.18, 'surf', x, 0.04, 13).castShadow = false;
    for (const x of [-12, 0, 12]) {
      cyl(g, 0.1, 3.4, SCENERY_THREADS.bark, x, 1.7, 11.2, 6);
      box(g, 1.2, 0.1, 0.1, SCENERY_THREADS.bark, x, 3.2, 11.2);
    }
  }
}

export interface TreeSpot { x: number; z: number; k: number }

/** Builds the lot: standing trees, stumps for the first `cleared` spots, the site and the landmark. */
export function makeScenery(s: GameState, g: THREE.Group, total: number, cleared: number): TreeSpot[] {
  clear(g);
  landmark(s.loc, g);
  if (s.phase !== 'setup' || s.step !== 'found') site(s, g);
  const spots = treeSpots(s.loc, total).map(([x, z], k) => ({ x, z, k }));
  for (const sp of spots) {
    const t = sp.k < cleared ? stump() : makeTree(s.loc, sp.k);
    t.position.set(sp.x, 0, sp.z);
    g.add(t);
  }
  return spots;
}
