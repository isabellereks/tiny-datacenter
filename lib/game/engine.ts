import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CROWD, FD, FH, FOUNDS, FW, LOCS, MONTH_SECONDS, STITCH, type FoundKey, type LocKey } from './data';
import { checkGoal, endOfMonth, impact } from './events';
import { clear, makeFloor, makeFoundation, makePerson, makeRoof, makeScenery, makeTree, makeWorker, mat, type Animated, type TreeSpot } from './models';
import { baseY, ledger, simulate, type GameState } from './state';
import { createStitchMaterial } from './stitchPass';

// Role codes and thread colours are exact values, not sRGB to convert. Must run before any Color is made.
THREE.ColorManagement.enabled = false;

const OPTION_X: Record<FoundKey, number> = { slab: -21, raised: -7, piles: 7, bedrock: 21 };
const OUTSIDE_DIR = new THREE.Vector3(0.85, 0.55, 1).normalize();
// looking almost straight into the open floors, like Tiny Tower
const INSIDE_DIR = new THREE.Vector3(0.16, 0.08, 1).normalize();
const GROUND_R = 19;

export interface EngineHooks {
  state: () => GameState;
  onChange: () => void;
  onPickFloor: (floor: number) => void;
  onPickFoundation: (key: FoundKey) => void;
  onFirstInteraction: () => void;
  onSave: () => void;
}

interface Puff { mesh: THREE.Mesh; y0: number; age: number; x: number; z: number }
interface Falling { obj: THREE.Group; t: number; axis: THREE.Vector3 }
interface Marcher { group: THREE.Group; legs: THREE.Group[]; sign: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; phase: number }

/** The town storming the datacenter: walk in, then the floors come down one by one from the top. */
const RIOT = { walk: 3, collapse: 4.5, hold: 1.2 };

/** A tileable texture for the ground patch: blue everywhere, cyan where a stitch of texture goes. */
function groundTexture(loc: LocKey) {
  const N = 128, data = new Uint8Array(N * N * 4);
  let seed = 7 + loc.length * 131;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mark = (x: number, y: number) => { const i = ((y % N) * N + (x % N)) * 4; data[i + 1] = 255; };
  for (let i = 0; i < N * N; i++) { data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = rnd();
    if (loc === 'dalles' && r < 0.03) { mark(x, y); mark(x, y + 1); }
    else if (loc === 'reykjavik' && r < 0.02) mark(x, y);
    else if (loc === 'phoenix' && r < 0.035) mark(x, y);
    else if (loc === 'ashburn' && y % 9 === 0 && (x + y) % 4 < 2) mark(x, y);
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
  private controls: OrbitControls;
  private sun = new THREE.DirectionalLight(0xffffff, Math.PI);
  private ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshLambertMaterial>;
  private groundTex = new Map<LocKey, THREE.DataTexture>();
  private building = new THREE.Group();
  private scenery = new THREE.Group();
  private options = new THREE.Group();
  private puffs = new THREE.Group();
  private normalMat = new THREE.MeshNormalMaterial();
  private post = createStitchMaterial();
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtNormal: THREE.WebGLRenderTarget | null = null;
  private rtRole: THREE.WebGLRenderTarget | null = null;
  private textTex: THREE.CanvasTexture | null = null;
  private grid = { n: 200, m: 150, cell: 5, vn: 200, vm: 150, textBottom: 0, textRows: 0 };
  private insets = { top: 80, bottom: 40 };
  private anim: Animated = { leds: [], fans: [], alarms: [], vent: new THREE.Vector3() };
  private floorGroups: THREE.Group[] = [];
  private crowd = new THREE.Group();
  private marchers: Marcher[] = [];
  private riotCash = 0;
  private goalClock = 0;
  private thread = '';
  private workers = new Map<number, { group: THREE.Group; legs: THREE.Group[] }>();
  private buildFloor: THREE.Group | null = null;
  private roof: THREE.Group | null = null;
  private spots: TreeSpot[] = [];
  private lastCleared = -1;
  private lastLoc: LocKey | null = null;
  private falling: Falling[] = [];
  private puffList: Puff[] = [];
  private puffGeo = new THREE.SphereGeometry(1, 24, 16);
  private puffClock = 0;
  private ledClock = 0;
  private saveClock = 0;
  private hover: FoundKey | null = null;
  private upc = 0.2; // world units per stitch
  private fitTween: { t0: number; fromU: number; toU: number; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
  private raycaster = new THREE.Raycaster();
  private down: [number, number] | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(private host: HTMLElement, private hooks: EngineHooks, private font: string) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Your stitched datacenter. Drag to turn it.');
    host.appendChild(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: true,
      minZoom: 0.6, maxZoom: 2.5, minPolarAngle: 0.45, maxPolarAngle: 1.52, autoRotateSpeed: 0.8,
    });
    this.controls.addEventListener('start', () => { this.hooks.onFirstInteraction(); });

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun, this.sun.target, new THREE.AmbientLight(0xffffff, 0.1 * Math.PI));

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 72), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.005;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.building, this.scenery, this.options, this.puffs, this.crowd);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.post.uniforms.uNear.value = this.camera.near;
    this.post.uniforms.uFar.value = this.camera.far;

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('resize', this.layout);

    this.rebuild();
    this.layout();
    this.camera.position.copy(this.controls.target).add(this.homeDir.clone().multiplyScalar(150));
    this.camera.lookAt(this.controls.target);
    this.fit(false);
    document.fonts?.load(`8px ${font}`).then(() => !this.disposed && this.layout());

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private get s() { return this.hooks.state(); }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.layout);
    this.controls.dispose();
    this.rtNormal?.dispose(); this.rtRole?.dispose(); this.textTex?.dispose();
    this.groundTex.forEach(t => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Space the UI covers at the top and bottom of the window, in CSS pixels. */
  setInsets(top: number, bottom: number) {
    if (Math.abs(top - this.insets.top) < 2 && Math.abs(bottom - this.insets.bottom) < 2) return;
    this.insets = { top, bottom };
    this.layout();
    this.fit(true);
  }

  /** The datacenter's name, laid out on the stitch grid in a pixel font. */
  private drawLettering(width: number) {
    const text = this.s.look.name.trim();
    if (!text) return null;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    let k = 2;
    const fits = () => { ctx.font = `${8 * k}px ${this.font}`; return ctx.measureText(text).width <= width * 0.7; };
    while (k > 1 && !fits()) k--;
    const rows = 10 * k;
    c.width = this.grid.n; c.height = rows;
    ctx.font = `${8 * k}px ${this.font}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(text, Math.round((width - ctx.measureText(text).width) / 2), k);
    return { canvas: c, rows };
  }

  /** Sizes the stitch grid to the window. The canvas hangs from the bottom-left so whole stitches line up. */
  layout = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = Math.max(2, Math.round(STITCH[this.s.look.stitch].px * dpr));
    const w = window.innerWidth, h = window.innerHeight;
    const vn = (w * dpr) / cell, vm = (h * dpr) / cell;
    const n = Math.ceil(vn), m = Math.ceil(vm);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(n * cell, m * cell, false);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${(n * cell) / dpr}px`;
    canvas.style.height = `${(m * cell) / dpr}px`;
    this.grid = { ...this.grid, n, m, cell, vn, vm };

    const letters = this.drawLettering(vn);
    this.textTex?.dispose();
    this.textTex = null;
    if (letters) {
      this.textTex = new THREE.CanvasTexture(letters.canvas);
      this.textTex.minFilter = this.textTex.magFilter = THREE.NearestFilter;
      this.textTex.generateMipmaps = false;
    }
    this.grid.textBottom = Math.ceil((this.insets.bottom * dpr) / cell) + 2;
    this.grid.textRows = letters?.rows ?? 0;

    this.rtNormal?.dispose(); this.rtRole?.dispose();
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtNormal = new THREE.WebGLRenderTarget(n, m, opts);
    this.rtNormal.depthTexture = new THREE.DepthTexture(n, m);
    this.rtRole = new THREE.WebGLRenderTarget(n, m, opts);

    const u = this.post.uniforms;
    u.tNormal.value = this.rtNormal.texture;
    u.tDepth.value = this.rtNormal.depthTexture;
    u.tRole.value = this.rtRole.texture;
    u.tText.value = this.textTex;
    (u.uGrid.value as THREE.Vector2).set(n, m);
    u.uTextBottom.value = this.grid.textBottom;
    u.uTextRows.value = this.grid.textRows;
    u.uCell.value = cell;
    this.applyFrustum();
  };

  private applyFrustum() {
    const hh = (this.upc * this.grid.m) / 2, hw = (this.upc * this.grid.n) / 2;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  rebuild() {
    const s = this.s;
    clear(this.building);
    this.anim = { leds: [], fans: [], alarms: [], vent: new THREE.Vector3() };
    this.workers.clear();
    this.buildFloor = null;
    this.floorGroups = [];
    this.building.add(makeFoundation(s.found));
    // once the town has torn it down, only the foundation is left
    const razed = s.over?.reason === 'town' && s.over.done;
    if (!razed) {
      s.floors.forEach((f, i) => {
        const g = makeFloor(s, i, f, this.anim);
        this.building.add(g);
        this.floorGroups.push(g);
        if (s.build?.idx === i) this.buildFloor = g;
      });
      this.roof = makeRoof(s, this.anim);
      this.building.add(this.roof);
    } else this.roof = null;
    this.makeCrowd();
    for (const w of s.workers) {
      const m = makeWorker();
      m.group.scale.setScalar(1.15);
      this.workers.set(w.id, m);
      this.building.add(m.group);
    }

    const imp = impact(s);
    this.falling.forEach(f => this.scenery.remove(f.obj));
    this.falling = [];
    this.spots = makeScenery(s, this.scenery, imp.trees, imp.cleared);
    if (this.lastLoc === s.loc && this.lastCleared >= 0 && imp.cleared > this.lastCleared) {
      for (const sp of this.spots.slice(this.lastCleared, imp.cleared)) {
        const obj = makeTree(s.loc, sp.k);
        obj.position.set(sp.x, 0, sp.z);
        this.scenery.add(obj);
        const away = new THREE.Vector3(sp.x, 0, sp.z).normalize();
        this.falling.push({ obj, t: 0, axis: new THREE.Vector3(away.z, 0, -away.x) });
      }
    }
    this.lastCleared = imp.cleared;
    this.lastLoc = s.loc;

    clear(this.options);
    for (const key of Object.keys(FOUNDS) as FoundKey[]) {
      const g = makeFoundation(key, key === s.found);
      g.position.x = OPTION_X[key];
      g.traverse(o => { o.userData.found = key; });
      this.options.add(g);
    }

    const picking = this.picking;
    this.building.visible = !picking;
    this.scenery.visible = !picking;
    this.ground.visible = !picking;
    this.options.visible = picking;

    const L = LOCS[s.loc];
    let tex = this.groundTex.get(s.loc);
    if (!tex) { tex = groundTexture(s.loc); this.groundTex.set(s.loc, tex); }
    this.ground.material.map = tex;
    this.ground.material.needsUpdate = true;
    const u = this.post.uniforms;
    (u.uCloth.value as THREE.Color).set(L.cloth);
    (u.uHole.value as THREE.Color).set(L.hole);
    (u.uGroundEdge.value as THREE.Color).set(L.edge);
    (u.uGroundDeco.value as THREE.Color).set(L.deco);
    document.body.style.backgroundColor = L.cloth;
    // the UI's fabric patches take their tint from the location's cloth
    document.documentElement.style.setProperty('--cloth', L.cloth);
    document.documentElement.style.setProperty('--hole', L.hole);

    const h = baseY(s, s.floors.length);
    this.sun.target.position.set(0, 0, 0);
    this.sun.position.set(14, 40 + h * 0.6, -6);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -30, right: 30, top: 30 + h, bottom: -30, near: 1, far: 200 });
    sc.updateProjectionMatrix();
  }

  /** Townspeople for the town ending. They gather around the lot. */
  private makeCrowd() {
    const s = this.s;
    clear(this.crowd);
    this.marchers = [];
    if (s.over?.reason !== 'town') return;
    const n = 22;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (k % 3) * 0.07;
      const m = makePerson(CROWD[k % CROWD.length]);
      m.group.scale.setScalar(1.9);
      const near = 1 + (k % 2) * 0.35;
      const to = new THREE.Vector3(Math.cos(a) * (FW / 2 + 2.2) * near, 0, Math.sin(a) * (FD / 2 + 2.2) * near);
      const from = new THREE.Vector3(Math.cos(a) * 17, 0, Math.sin(a) * 15);
      m.group.position.copy(s.over.done ? to : from);
      this.crowd.add(m.group);
      this.marchers.push({ ...m, from, to, phase: k * 0.7 });
    }
    this.riotCash = s.cash;
  }

  private get homeDir() { return this.s.phase === 'play' && this.s.inside ? INSIDE_DIR : OUTSIDE_DIR; }

  private get picking() { return this.s.phase === 'setup' && this.s.step === 'found'; }

  /** Frames the building (or the foundation choices) inside the space the UI leaves free. */
  fit(animate = true) {
    const s = this.s;
    const picking = this.picking;
    const box = new THREE.Box3().setFromObject(picking ? this.options : this.building);
    if (!picking) {
      if (s.smoke && s.phase !== 'over' && s.floors.some(f => f.type === 'cool')) box.expandByPoint(this.anim.vent.clone().add(new THREE.Vector3(1, 6, 0)));
      // Outside, show the whole lot. Inside, frame the tower so the floors and crew read, Tiny Tower style.
      const lot = s.phase === 'over' ? 0.6 : s.phase === 'play' && s.inside ? 0.35 : 0.65;
      for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) box.expandByPoint(new THREE.Vector3(x * GROUND_R * lot, 0, z * GROUND_R * lot));
    }

    this.camera.updateMatrixWorld();
    const view = this.camera.matrixWorldInverse;
    const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(view);
      min.min(new THREE.Vector2(p.x, p.y));
      max.max(new THREE.Vector2(p.x, p.y));
    }
    const { n, m, vn, vm, textBottom, textRows } = this.grid;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const b0 = textBottom + textRows + (textRows ? 2 : 0);
    const b1 = vm - (this.insets.top * dpr) / this.grid.cell;
    const band = Math.max(20, b1 - b0);
    const toU = Math.max(((max.x - min.x) * 1.08) / vn, ((max.y - min.y) * 1.08) / band);
    const dx = vn / 2 - n / 2, dy = (b0 + b1) / 2 - m / 2;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const center = this.controls.target.clone()
      .addScaledVector(right, (min.x + max.x) / 2 - dx * toU)
      .addScaledVector(up, (min.y + max.y) / 2 - dy * toU);
    if (!animate) {
      this.upc = toU;
      this.camera.position.add(center.clone().sub(this.controls.target));
      this.controls.target.copy(center);
      this.applyFrustum();
      return;
    }
    this.fitTween = { t0: performance.now(), fromU: this.upc, toU, fromT: this.controls.target.clone(), toT: center };
  }

  resetView() {
    this.camera.zoom = 1;
    this.camera.position.copy(this.controls.target).add(this.homeDir.clone().multiplyScalar(150));
    this.camera.lookAt(this.controls.target);
    this.camera.updateProjectionMatrix();
    this.fit(true);
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.picking ? this.options : this.building, true);
    return hits.length ? (hits[0].object.userData as { floor?: number; found?: FoundKey }) : null;
  }

  private onDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
    const d = this.pick(e);
    if (!d) return;
    if (this.picking && d.found) this.hooks.onPickFoundation(d.found);
    else if (d.floor != null) this.hooks.onPickFloor(d.floor);
  };

  private onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const d = this.pick(e);
    this.hover = this.picking && d?.found ? d.found : null;
    this.renderer.domElement.style.cursor = d && (d.found || d.floor != null) ? 'pointer' : 'grab';
  };

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const s = this.s;
    const wasOver = s.phase === 'over';
    const { built, newMonth, fixed } = simulate(s, dt, MONTH_SECONDS);
    if (newMonth) endOfMonth(s);
    let changed = built || newMonth || fixed;
    this.goalClock += dt;
    if (s.phase === 'play' && this.goalClock > 0.5) { this.goalClock = 0; if (checkGoal(s, ledger(s))) changed = true; }
    if (s.phase === 'over' && !wasOver) {
      this.rebuild();
      this.resetView();
    } else if (built || (newMonth && s.broken.length) || fixed) {
      this.rebuild();
      if (built) this.fit(true);
    }
    if (this.riot(now)) changed = true;
    if (changed) this.hooks.onChange();
    this.animate(dt, now);

    if (this.fitTween) {
      const k = Math.min(1, (now - this.fitTween.t0) / 800), e = 1 - Math.pow(1 - k, 3);
      this.upc = this.fitTween.fromU + (this.fitTween.toU - this.fitTween.fromU) * e;
      const prev = this.controls.target.clone();
      this.controls.target.lerpVectors(this.fitTween.fromT, this.fitTween.toT, e);
      this.camera.position.add(this.controls.target.clone().sub(prev));
      this.applyFrustum();
      if (k >= 1) this.fitTween = null;
    }
    this.controls.autoRotate = s.spin;
    this.controls.update();
    const u = this.post.uniforms;
    (u.uOutline.value as THREE.Color).set(s.look.outline);
    if (s.look.outline !== this.thread) { this.thread = s.look.outline; document.documentElement.style.setProperty('--thread', s.look.outline); }
    (u.uShade.value as THREE.Color).set(s.look.shade);
    (u.uAccent.value as THREE.Color).set(s.look.accent);
    // gaps smaller than a couple of stitches aren't worth a line
    u.uDepthEdge.value = Math.max(0.35, (this.upc / this.camera.zoom) * 2);
    this.render();

    this.saveClock += dt;
    if (this.saveClock > 5) { this.saveClock = 0; this.hooks.onSave(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Runs the town ending. Returns true when it finishes. */
  private riot(now: number) {
    const s = this.s;
    if (s.over?.reason !== 'town' || !this.marchers.length) return false;
    const t = now / 1000;
    const el = s.over.done ? Infinity : (Date.now() - s.over.t0) / 1000;
    const walk = Math.min(1, el / RIOT.walk);
    for (const m of this.marchers) {
      const p = m.group.position;
      if (walk < 1) {
        p.lerpVectors(m.from, m.to, walk);
        m.group.rotation.y = Math.atan2(m.to.x - m.from.x, m.to.z - m.from.z);
        const swing = Math.sin(t * 9 + m.phase) * 0.6;
        m.legs[0].rotation.x = swing;
        m.legs[1].rotation.x = -swing;
      } else {
        p.x = m.to.x; p.z = m.to.z;
        p.y = Math.abs(Math.sin(t * 6 + m.phase)) * 0.35;
        m.group.rotation.y = Math.atan2(-m.to.x, -m.to.z);
        m.legs[0].rotation.x = m.legs[1].rotation.x = 0;
      }
      m.sign.rotation.z = Math.sin(t * 5 + m.phase) * 0.25;
    }
    if (s.over.done) return false;

    // the floors come down from the top while the cash drains away
    const k = Math.max(0, Math.min(1, (el - RIOT.walk) / RIOT.collapse));
    const n = this.floorGroups.length;
    const gone = k * (n + 1);
    if (this.roof) this.roof.visible = gone < 1;
    this.floorGroups.forEach((g, i) => {
      const from = n - i; // the top floor goes first, right after the roof
      const f = Math.max(0, Math.min(1, gone - from));
      g.scale.y = Math.max(0.001, 1 - f);
      g.visible = f < 1;
    });
    this.building.position.x = k > 0 && k < 1 ? Math.sin(t * 45) * 0.12 : 0;
    s.cash = this.riotCash * (1 - k);
    if (el >= RIOT.walk + RIOT.collapse + RIOT.hold) {
      s.cash = 0;
      s.over.done = true;
      this.building.position.x = 0;
      this.rebuild();
      return true;
    }
    return false;
  }

  private render() {
    const r = this.renderer;
    r.setClearColor(0x000000, 0);
    const groundOn = this.ground.visible;
    this.ground.visible = false;
    this.scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal);
    r.clear();
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.ground.visible = groundOn;
    r.setRenderTarget(this.rtRole);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }

  private animate(dt: number, now: number) {
    const s = this.s, t = now / 1000;
    for (const w of s.workers) {
      const m = this.workers.get(w.id);
      if (!m) continue;
      m.group.visible = !!s.floors[w.floor]?.done && s.inside;
      m.group.position.set(w.x, baseY(s, w.floor) + 0.2, FD / 2 - 1.5);
      m.group.rotation.y = w.pause > 0 ? 0 : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const swing = w.pause > 0 ? 0 : Math.sin(t * 9 + w.id) * 0.6;
      m.legs[0].rotation.x = swing;
      m.legs[1].rotation.x = -swing;
    }
    for (const f of this.anim.fans) f.rotation.z -= dt * 6;
    const blink = Math.floor(t * 3) % 2 === 0;
    for (const a of this.anim.alarms) a.visible = blink;
    this.ledClock -= dt;
    if (this.ledClock <= 0) {
      this.ledClock = 0.35;
      for (const l of this.anim.leds) l.visible = Math.random() > 0.35;
    }

    this.falling = this.falling.filter(f => {
      f.t += dt;
      const k = Math.min(1, f.t / 0.8);
      f.obj.setRotationFromAxisAngle(f.axis, k * k * (Math.PI / 2));
      if (f.t > 1.1) { this.scenery.remove(f.obj); return false; }
      return true;
    });

    const cools = s.floors.some(f => f.done && f.type === 'cool');
    this.puffClock -= dt;
    if (s.smoke && cools && !this.picking && s.phase !== 'over' && this.puffClock <= 0 && this.puffList.length < 2) {
      const mesh = new THREE.Mesh(this.puffGeo, mat('surf'));
      this.puffs.add(mesh);
      this.puffList.push({ mesh, y0: this.anim.vent.y, age: 0, x: this.anim.vent.x, z: this.anim.vent.z });
      this.puffClock = 3.2;
    }
    this.puffList = this.puffList.filter(p => {
      p.age += dt;
      const r = Math.min(0.5 + p.age * 0.35, 1.7);
      p.mesh.position.set(p.x - p.age * 0.25, p.y0 + 0.6 + p.age * 0.75, p.z);
      p.mesh.scale.setScalar(r);
      if (p.age > 8 || !s.smoke || this.picking || s.phase === 'over') { this.puffs.remove(p.mesh); return false; }
      return true;
    });

    if (s.build) {
      const k = Math.min(1, (Date.now() - s.build.t0) / s.build.dur), e = 1 - Math.pow(1 - k, 3);
      if (this.buildFloor) this.buildFloor.scale.y = Math.max(0.02, e);
      if (this.roof) this.roof.position.y = -(1 - e) * FH;
    }
    for (const g of this.options.children) {
      const want = this.hover === g.userData.found ? 0.6 : 0;
      g.position.y += (want - g.position.y) * Math.min(1, dt * 10);
    }
  }
}
