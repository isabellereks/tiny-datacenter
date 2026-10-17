import * as THREE from 'three';
import { FD, FH, FW, type FloorType, type FoundKey, type Role } from './data';
import { baseY, floorW, perRow, type Floor, type GameState } from './state';

/**
 * Meshes are flat-coloured by role only; the stitch pass reads this colour to pick a thread.
 * surf = white, light = grey, dark = black, accent = red.
 */
const ROLE_COLOR: Record<Role, number> = { surf: 0xffffff, light: 0x808080, dark: 0x000000, accent: 0xff0000 };
const mats = new Map<Role, THREE.MeshBasicMaterial>();
export function mat(role: Role) {
  let m = mats.get(role);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: ROLE_COLOR[role] }); mats.set(role, m); }
  return m;
}

type P = THREE.Object3D;

function add(p: P, geo: THREE.BufferGeometry, role: Role, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, mat(role));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}
const box = (p: P, w: number, h: number, d: number, r: Role, x: number, y: number, z: number) =>
  add(p, new THREE.BoxGeometry(w, h, d), r, x, y, z);
const cyl = (p: P, rad: number, h: number, r: Role, x: number, y: number, z: number, seg = 16) =>
  add(p, new THREE.CylinderGeometry(rad, rad, h, seg), r, x, y, z);

function prism(p: P, pts: [number, number][], depth: number, r: Role, x: number, y: number, z: number) {
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
  const W = FW + 1, D = FD + 1, top: Role = chosen ? 'light' : 'surf';
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
export interface Animated { leds: THREE.Mesh[]; fans: THREE.Group[]; vent: THREE.Vector3 }

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
    add(g, new THREE.IcosahedronGeometry(0.5, 0), 'light', w / 2 - 2.6, 1, zb + 0.8);
  } else {
    box(g, 1.2, 1.45, 0.06, 'surf', -w / 2 + 1.6, 0.925, zb + 0.23);
    box(g, 3.2, 0.9, 0.9, 'surf', 0.6, 0.65, -0.6);
    box(g, 3.24, 0.16, 0.94, 'light', 0.6, 1.08, -0.6);
  }
}

function facade(g: THREE.Group, w: number, i: number) {
  const z = FD / 2 + 0.02;
  const window = (x: number, y: number) => box(g, 0.8, 0.6, 0.06, 'light', x, y, z);
  if (i === 0) {
    box(g, 1.1, 1.4, 0.06, 'surf', -w / 2 + 2, 0.9, z);
    box(g, 0.12, 0.12, 0.1, 'dark', -w / 2 + 2.3, 0.9, z + 0.04);
    const port = cyl(g, 0.38, 0.06, 'light', w / 2 - 2, 1.05, z, 20);
    port.rotation.x = Math.PI / 2;
    return;
  }
  const n = Math.max(1, Math.floor(w / 3));
  for (let k = 0; k < n; k++) window(-(n - 1) * 1.5 + k * 3, 1);
}

export function makeFloor(s: GameState, i: number, f: Floor, anim: Animated) {
  const g = new THREE.Group(), w = floorW(s, i), m = f.fill;
  g.position.y = baseY(s, i);
  box(g, w, 0.2, FD, m, 0, 0.1, 0);
  box(g, w, FH, 0.2, m, 0, FH / 2, -FD / 2 + 0.1);
  box(g, 0.2, FH, FD, m, -w / 2 + 0.1, FH / 2, 0);
  box(g, 0.2, FH, FD, m, w / 2 - 0.1, FH / 2, 0);
  if (s.inside) {
    box(g, w, 0.2, 0.3, m, 0, FH - 0.1, FD / 2 - 0.15);
    interior(s, g, f.type, w, i, anim);
  } else {
    box(g, w, FH, 0.2, m, 0, FH / 2, FD / 2 - 0.1);
    facade(g, w, i);
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

export function makeWorker() {
  const g = new THREE.Group();
  const legs = [-0.1, 0.1].map(x => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, 0);
    g.add(pivot);
    box(pivot, 0.16, 0.4, 0.16, 'dark', 0, -0.2, 0);
    return pivot;
  });
  box(g, 0.5, 0.5, 0.3, 'accent', 0, 0.65, 0);
  box(g, 0.38, 0.36, 0.36, 'surf', 0, 1.1, 0);
  box(g, 0.4, 0.12, 0.4, 'dark', 0, 1.32, 0);
  return { group: g, legs };
}

export function makeScenery(s: GameState, g: THREE.Group) {
  clear(g);
  if (s.loc === 'dalles') {
    [[-10, -5, 2.6], [-12, 1, 3.2], [-9, 5, 2.2]].forEach(([x, z, h]) => {
      cyl(g, 0.18, 0.6, 'dark', x, 0.3, z, 6);
      add(g, new THREE.ConeGeometry(1, h, 8), 'surf', x, 0.6 + h / 2, z);
    });
  } else if (s.loc === 'reykjavik') {
    add(g, new THREE.ConeGeometry(5, 7, 5), 'surf', -12, 3.5, -10);
    add(g, new THREE.ConeGeometry(3.5, 5, 5), 'surf', -16, 2.5, -3);
  } else if (s.loc === 'phoenix') {
    const cactus = (x: number, z: number) => {
      cyl(g, 0.35, 3, 'surf', x, 1.5, z, 10);
      cyl(g, 0.25, 1.1, 'surf', x - 0.75, 2, z, 10);
      box(g, 0.75, 0.3, 0.3, 'surf', x - 0.38, 1.5, z);
    };
    cactus(-10, 2); cactus(-12, -4);
  } else {
    box(g, 6, 2.6, 5, 'surf', -12, 1.3, -6);
    box(g, 1.4, 0.6, 1, 'surf', -13, 2.9, -6);
  }
}
