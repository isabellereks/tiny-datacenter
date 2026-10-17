import * as THREE from 'three';
import { FD, FH, FW, type FloorType, type FoundKey } from './data';
import { baseY, floorW, perRow, type Floor, type GameState, type Worker } from './state';

const mats = new Map<string, THREE.MeshLambertMaterial>();
const glows = new Map<string, THREE.MeshBasicMaterial>();

export function mat(hex: string) {
  let m = mats.get(hex);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: hex }); mats.set(hex, m); }
  return m;
}

export function glow(hex: string) {
  let m = glows.get(hex);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: hex }); glows.set(hex, m); }
  return m;
}

type Mat = string | THREE.Material;

function add(p: THREE.Object3D, geo: THREE.BufferGeometry, m: Mat, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  p.add(mesh);
  return mesh;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, m: Mat, x: number, y: number, z: number) =>
  add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cyl = (p: THREE.Object3D, r: number, h: number, m: Mat, x: number, y: number, z: number, seg = 12) =>
  add(p, new THREE.CylinderGeometry(r, r, h, seg), m, x, y, z);
const unlit = (mesh: THREE.Mesh) => { mesh.castShadow = false; return mesh; };

function prism(p: THREE.Object3D, pts: [number, number][], depth: number, m: Mat, x: number, y: number, z: number) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([px, py]) => sh.lineTo(px, py));
  sh.closePath();
  return add(p, new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), m, x, y, z);
}

export function clear(g: THREE.Object3D) {
  while (g.children.length) {
    const c = g.children[0];
    g.remove(c);
    c.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

export function makeFoundation(key: FoundKey, tint?: string) {
  const g = new THREE.Group();
  const W = FW + 1, D = FD + 1, top = tint ?? '#FFFFFF';
  if (key === 'slab') {
    box(g, W, 0.45, D, top, 0, 0.225, 0);
  } else if (key === 'raised') {
    box(g, W, 0.3, D, '#FFFFFF', 0, 0.15, 0);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const x = -W / 2 + (i + 0.5) * W / 5, z = -D / 2 + (j + 0.5) * D / 4;
      cyl(g, 0.07, 0.45, '#B0B0B0', x, 0.52, z, 6);
      box(g, W / 5 - 0.06, 0.12, D / 4 - 0.06, top, x, 0.84, z);
    }
  } else if (key === 'piles') {
    for (const [a, b] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) {
      cyl(g, 0.28, 1.4, '#BDBDBD', a * (W / 2 - 0.6), 0.7, b * (D / 2 - 0.6), 10);
    }
    box(g, W, 0.4, D, top, 0, 1.6, 0);
  } else {
    box(g, W + 2.2, 0.5, D + 2.2, '#FFFFFF', 0, 0.25, 0);
    box(g, W + 1.1, 0.5, D + 1.1, '#FFFFFF', 0, 0.75, 0);
    box(g, W, 0.3, D, top, 0, 1.15, 0);
  }
  return g;
}

/** Animated parts collected while building, so the engine can blink and spin them. */
export interface Animated { leds: THREE.Mesh[]; fans: THREE.Group[] }

function interior(s: GameState, g: THREE.Group, type: FloorType, w: number, i: number, anim: Animated) {
  const zb = -FD / 2;
  if (type === 'hall') {
    const n = perRow(s, i), sp = (w - 1.4) / n;
    for (const z of [zb + 1, -0.6]) {
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 0.7 + sp * (k + 0.5);
        box(g, sp * 0.72, 1.25, 1, '#9A9A9A', x, 0.2 + 0.625, z);
        for (const y of [0.45, 0.75, 1.05]) anim.leds.push(unlit(box(g, 0.14, 0.09, 0.04, glow('#47A72F'), x - sp * 0.18, 0.2 + y, z + 0.52)));
      }
    }
    box(g, w - 0.5, 0.06, 0.35, '#8A8A8A', 0, FH - 0.25, zb + 1);
  } else if (type === 'cool') {
    const n = Math.max(2, Math.floor(w / 2.6)), sp = (w - 1) / n;
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.5 + sp * (k + 0.5);
      box(g, sp * 0.78, 1.3, 1.3, '#DADADA', x, 0.85, zb + 1.1);
      cyl(g, 0.42, 0.08, '#9A9A9A', x, 0.95, zb + 1.8, 16).rotation.x = Math.PI / 2;
      const fan = new THREE.Group();
      fan.position.set(x, 0.95, zb + 1.86);
      g.add(fan);
      box(fan, 0.7, 0.1, 0.03, '#4A4A4A', 0, 0, 0);
      box(fan, 0.1, 0.7, 0.03, '#4A4A4A', 0, 0, 0);
      anim.fans.push(fan);
    }
    for (const y of [FH - 0.35, FH - 0.6]) cyl(g, 0.1, w - 0.4, '#8FA7DA', 0, y, zb + 0.5, 8).rotation.z = Math.PI / 2;
  } else if (type === 'power') {
    const n = Math.floor((w - 1) / 1.3);
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 0.9 + k * 1.3;
      box(g, 0.9, 1.3, 0.8, '#BDBDBD', x, 0.85, zb + 0.8);
      box(g, 0.92, 0.12, 0.82, '#F2B43C', x, 1.15, zb + 0.8);
      anim.leds.push(unlit(box(g, 0.1, 0.1, 0.04, glow('#47A72F'), x + 0.25, 0.55, zb + 1.22)));
    }
    box(g, 2.6, 1, 1.4, '#D0D0D0', w / 2 - 1.8, 0.7, 0.6);
  } else if (type === 'net') {
    box(g, w - 2, 0.08, 1, '#D6D6D6', 0, 0.8, -0.4);
    for (const side of [-1, 1]) box(g, 0.08, 0.6, 0.9, '#B0B0B0', side * (w / 2 - 1.2), 0.5, -0.4);
    const n = Math.floor((w - 2) / 1.6);
    for (let k = 0; k < n; k++) {
      const x = -(n - 1) * 0.8 + k * 1.6;
      box(g, 1.1, 0.7, 0.08, '#5A5A5A', x, 1.3, -0.75);
      unlit(box(g, 1, 0.6, 0.02, glow(k % 2 ? '#5FB39C' : '#8FA7DA'), x, 1.3, -0.7));
    }
    box(g, w * 0.55, 0.9, 0.06, '#5A5A5A', 0, 1.25, zb + 0.25);
    unlit(box(g, w * 0.55 - 0.14, 0.78, 0.02, glow('#2E7D66'), 0, 1.25, zb + 0.29));
  } else if (type === 'break') {
    const c = '#F7896F', x0 = -w / 2 + 2.2;
    box(g, 2.6, 0.4, 0.9, c, x0, 0.45, zb + 1);
    box(g, 2.6, 0.6, 0.25, c, x0, 0.95, zb + 0.65);
    box(g, 0.25, 0.55, 0.9, c, x0 - 1.3, 0.6, zb + 1);
    box(g, 0.25, 0.55, 0.9, c, x0 + 1.3, 0.6, zb + 1);
    box(g, 1.3, 0.08, 0.7, '#B08860', x0, 0.6, zb + 2.2);
    box(g, 0.6, 1, 0.5, '#3A3A3A', w / 2 - 1, 0.7, zb + 0.6);
    unlit(box(g, 0.1, 0.1, 0.04, glow('#D04848'), w / 2 - 1, 0.9, zb + 0.87));
    cyl(g, 0.25, 0.4, '#B08860', w / 2 - 2.4, 0.4, zb + 0.8, 10);
    add(g, new THREE.IcosahedronGeometry(0.45, 0), '#5FA05A', w / 2 - 2.4, 1, zb + 0.8);
    box(g, 1.2, 0.8, 0.04, '#F2B43C', x0, 1.5, zb + 0.25);
  } else {
    box(g, 1.2, 1.45, 0.06, '#E2E2E2', -w / 2 + 1.6, 0.925, zb + 0.23);
    box(g, 0.1, 0.1, 0.1, '#4A4A4A', -w / 2 + 2, 0.95, zb + 0.3);
    box(g, 3.2, 0.9, 0.8, '#EDEDED', 0.6, 0.65, -0.6);
    box(g, 3.24, 0.14, 0.84, '#4A66B5', 0.6, 1.05, -0.6);
    box(g, 2.4, 0.4, 0.05, '#F2B43C', 0.6, 1.5, zb + 0.24);
    cyl(g, 0.25, 0.4, '#B08860', w / 2 - 1, 0.4, zb + 0.9, 10);
    add(g, new THREE.IcosahedronGeometry(0.45, 0), '#5FA05A', w / 2 - 1, 1, zb + 0.9);
  }
}

export function makeFloor(s: GameState, i: number, f: Floor, anim: Animated) {
  const g = new THREE.Group(), w = floorW(s, i), m = f.color;
  g.position.y = baseY(s, i);
  box(g, w, 0.2, FD, m, 0, 0.1, 0);
  box(g, w, FH, 0.2, m, 0, FH / 2, -FD / 2 + 0.1);
  box(g, 0.2, FH, FD, m, -w / 2 + 0.1, FH / 2, 0);
  box(g, 0.2, FH, FD, m, w / 2 - 0.1, FH / 2, 0);
  if (s.inside) {
    box(g, w, 0.2, 0.3, m, 0, FH - 0.1, FD / 2 - 0.15);
  } else {
    box(g, w, FH, 0.2, m, 0, FH / 2, FD / 2 - 0.1);
    const n = Math.floor(w / 2.2);
    for (let k = 0; k < n; k++) {
      const x = -(n - 1) * 1.1 + k * 2.2;
      if (i === 0 && k === 0) box(g, 0.9, 1.3, 0.08, '#9A9A9A', x, 0.85, FD / 2 + 0.02);
      else box(g, 0.9, 0.55, 0.08, '#9A9A9A', x, 1, FD / 2 + 0.02);
    }
  }
  interior(s, g, f.type, w, i, anim);
  g.traverse(o => { o.userData.floor = i; });
  return g;
}

export function makeRoof(s: GameState) {
  const n = s.floors.length;
  const g = new THREE.Group(), w = floorW(s, n - 1), top = baseY(s, n), wall = s.floors[n - 1].color;
  box(g, w + 0.2, 0.25, FD + 0.2, wall, 0, top + 0.125, 0);
  const t = top + 0.25;
  const teeth = (x0: number, span: number) => {
    const k = Math.max(2, Math.round(span / 2.4)), tw = span / k;
    for (let j = 0; j < k; j++) {
      prism(g, [[0, 0], [tw, 0], [tw, 1.25]], FD, '#FFFFFF', x0 + j * tw, t, -FD / 2);
      unlit(box(g, 0.06, 0.9, FD - 0.6, '#8FA7DA', x0 + (j + 1) * tw - 0.05, t + 0.55, 0));
    }
  };
  if (s.shape === 'shed') {
    teeth(-w / 2, w);
    const ht = top + 1.2, L = Math.min(ht * 0.55, 11);
    prism(g, [[0, 0], [L, 0], [0, ht]], FD, '#FFFFFF', w / 2, 0, -FD / 2);
    cyl(g, 0.45, 1.6, '#FFFFFF', w / 2 + L * 0.28, ht * 0.72 + 0.5, 0, 10);
    box(g, 0.5, 0.7, 0.08, '#9A9A9A', w / 2 + L * 0.6, ht * 0.38, FD / 2 + 0.04);
  } else if (s.shape === 'saw') {
    teeth(-w / 2, w);
  } else if (s.shape === 'hangar') {
    const v = add(g, new THREE.CylinderGeometry(w / 2, w / 2, FD, 28, 1, false, Math.PI / 2, Math.PI), '#FFFFFF', 0, t, 0);
    v.rotation.x = Math.PI / 2;
    v.scale.set(1, 1, 0.5);
  } else {
    for (const z of [FD / 2, -FD / 2]) box(g, w + 0.2, 0.45, 0.15, '#FFFFFF', 0, t + 0.22, z);
    for (const side of [-1, 1]) box(g, 0.15, 0.45, FD, '#FFFFFF', side * (w / 2), t + 0.22, 0);
    const hvac = (x: number) => {
      box(g, 2, 0.8, 1.6, '#E8E8E8', x, t + 0.4, -0.8);
      unlit(cyl(g, 0.5, 0.08, '#9A9A9A', x, t + 0.84, -0.8, 14));
    };
    if (w > 7) { hvac(-w / 2 + 2); hvac(w / 2 - 2.5); } else hvac(0);
    const mast = s.shape === 'tower' ? 4 : 2.6;
    cyl(g, 0.05, mast, '#9A9A9A', w / 2 - 0.8, t + mast / 2, FD / 2 - 1, 6);
  }
  g.traverse(o => { o.userData.floor = n - 1; });
  return g;
}

export function makeWorker(w: Worker) {
  const g = new THREE.Group();
  const legs = [-0.09, 0.09].map(x => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, 0);
    g.add(pivot);
    box(pivot, 0.13, 0.36, 0.14, '#2F3440', 0, -0.18, 0);
    return pivot;
  });
  box(g, 0.4, 0.42, 0.24, w.shirt, 0, 0.6, 0);
  box(g, 0.3, 0.3, 0.3, w.skin, 0, 0.97, 0);
  box(g, 0.32, 0.1, 0.32, w.hair, 0, 1.15, 0);
  box(g, 0.32, 0.26, 0.08, w.hair, 0, 1.03, -0.14);
  return { group: g, legs };
}

export function makeScenery(s: GameState, g: THREE.Group) {
  clear(g);
  const W = '#FFFFFF';
  if (s.loc === 'dalles') {
    [[-18, -6], [-21, 3], [-15, 9], [20, -9], [23, 2], [-8, -15], [10, -16]].forEach(([x, z], k) => {
      const h = 2.6 + (k % 3) * 0.6;
      cyl(g, 0.18, 0.7, '#B08860', x, 0.35, z, 6);
      add(g, new THREE.ConeGeometry(1 + (k % 2) * 0.25, h, 7), W, x, 0.7 + h / 2, z);
    });
    unlit(box(g, 120, 0.05, 3, '#9FB6E6', 0, 0.03, 16));
  } else if (s.loc === 'reykjavik') {
    for (const [x, z, r, h] of [[-26, -28, 10, 13], [2, -36, 13, 16], [30, -26, 9, 11]]) {
      add(g, new THREE.ConeGeometry(r, h, 5), W, x, h / 2, z);
    }
  } else if (s.loc === 'phoenix') {
    const cactus = (x: number, z: number) => {
      cyl(g, 0.35, 3.2, W, x, 1.6, z, 8);
      cyl(g, 0.25, 1.2, W, x - 0.7, 2.1, z, 8); box(g, 0.7, 0.3, 0.3, W, x - 0.35, 1.6, z);
      cyl(g, 0.25, 1, W, x + 0.7, 1.7, z, 8); box(g, 0.7, 0.3, 0.3, W, x + 0.35, 1.3, z);
    };
    cactus(-17, 4); cactus(19, -4); cactus(-12, -12);
    box(g, 14, 4, 6, W, -6, 2, -28);
    box(g, 9, 3, 5, W, 14, 1.5, -30);
  } else {
    for (const [x, z, w, h, d] of [[-24, -10, 9, 3.2, 6], [24, -8, 8, 4, 7], [0, -26, 12, 3, 7], [-22, 10, 6, 2.4, 5]]) {
      box(g, w, h, d, W, x, h / 2, z);
      box(g, 1.6, 0.7, 1.2, '#E8E8E8', x - w / 4, h + 0.35, z);
      box(g, 1.6, 0.7, 1.2, '#E8E8E8', x + w / 4, h + 0.35, z);
    }
  }
}
