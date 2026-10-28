import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CROWD, FD, FH, SETUP_FOUNDS, FW, LOCS, MONTH_SECONDS, SPEEDS, STITCH, type FoundKey, type LocKey } from './data';
import { checkGoal, endOfMonth, impact } from './events';
import { bake, clear, makeCrane, makeFloor, makeFoundation, makePerson, makeRoof, makeScenery, makeTree, makeWorker, mat, townLook, type Animated, type TreeSpot } from './models';
import { baseY, bOf, busy, buildingX, heightOf, isBroken, jobOn, ledger, level, levelY, simulate, tallest, type GameState } from './state';
import { createStitchMaterial, createWeaveMaterial } from './stitchPass';

// Role codes and thread colours are exact values, not sRGB to convert. Must run before any Color is made.
THREE.ColorManagement.enabled = false;

const OPTION_X: Partial<Record<FoundKey, number>> = { slab: -21, raised: -7, piles: 7, bedrock: 21 };
const OUTSIDE_DIR = new THREE.Vector3(0.85, 0.55, 1).normalize();
// looking straight into the open floors, like Tiny Tower. Level enough that the floors
// themselves don't show, since a floor seen edge-on is nothing but outline.
const INSIDE_DIR = new THREE.Vector3(0.16, 0.03, 1).normalize();
const GROUND_R = 19;
/** Furthest the camera pulls back: a floor stays about 10 stitches tall so its insides still read.
 *  Taller buildings scroll instead, like Tiny Tower. */
const MAX_UPC = FH / 10;

export interface EngineHooks {
  state: () => GameState;
  onChange: () => void;
  onPickFloor: (floor: number) => void;
  onPickFoundation: (key: FoundKey) => void;
  onFirstInteraction: () => void;
  onSave: () => void;
  /** a townsperson you tapped, and where on screen */
  onPickPerson?: (x: number, y: number) => void;
  /** what the pointer is over, for a label at the bottom of the screen */
  onHover: (what: { found?: FoundKey; floor?: number } | null) => void;
}

interface Puff { mesh: THREE.Mesh; y0: number; age: number; x: number; z: number; dust?: { dx: number; dz: number } }
interface Falling { obj: THREE.Group; t: number; axis: THREE.Vector3 }
interface Marcher { group: THREE.Group; legs: THREE.Group[]; sign: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; phase: number }
interface Walker { group: THREE.Group; legs: THREE.Group[]; a: number; speed: number; rx: number; rz: number }
interface Protester { group: THREE.Group; sign: THREE.Group; phase: number }

/** Snow and rain by place and month. */
const SNOW: Partial<Record<LocKey, number[]>> = {
  lulea: [10, 11, 0, 1, 2, 3], reykjavik: [10, 11, 0, 1, 2], dalles: [11, 0, 1], ashburn: [0, 1], newalbany: [11, 0, 1], dublin: [0],
};
const RAIN: Partial<Record<LocKey, number[]>> = {
  dublin: [1, 2, 3, 4, 8, 9, 10, 11], dalles: [2, 3, 9, 10], reykjavik: [4, 5, 8, 9], ashburn: [3, 4, 5, 8], newalbany: [3, 4, 5, 9], lulea: [5, 8],
};
export function weatherOf(loc: LocKey, month: number): 'snow' | 'rain' | null {
  const m = Math.floor(month) % 12;
  if (SNOW[loc]?.includes(m)) return 'snow';
  if (RAIN[loc]?.includes(m)) return 'rain';
  return null;
}
/** A slow day: one day and night every three months of game time. 0 at noon, 1 deep at night. */
export function nightOf(month: number) {
  const n = 0.5 - 0.5 * Math.cos((month / 3) * Math.PI * 2);
  const k = Math.max(0, Math.min(1, (n - 0.55) / 0.3));
  return k * k * (3 - 2 * k);
}

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
    else if (loc === 'abilene' && r < 0.03) mark(x, y);
    else if (loc === 'newalbany' && y % 6 === 0 && r < 0.6) mark(x, y);
    else if (loc === 'dublin' && r < 0.05) { mark(x, y); if (r < 0.02) mark(x + 1, y); }
    else if (loc === 'lulea' && r < 0.015) mark(x, y);
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
  private weave = createWeaveMaterial();
  private postScene = new THREE.Scene();
  private weaveScene = new THREE.Scene();
  /** one pixel per stitch: the colour of each stitch, worked out once, then woven at full size */
  private rtCell: THREE.WebGLRenderTarget | null = null;
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtNormal: THREE.WebGLRenderTarget | null = null;
  private rtRole: THREE.WebGLRenderTarget | null = null;
  private textTex: THREE.CanvasTexture | null = null;
  private grid = { n: 200, m: 150, cell: 5, vn: 200, vm: 150, textBottom: 0, textRows: 0 };
  private insets = { top: 80, bottom: 40, right: 0 };
  private anim: Animated = { leds: [], fans: [], rotors: [], alarms: [], vent: new THREE.Vector3() };
  private floorGroups: THREE.Group[] = [];
  private crowd = new THREE.Group();
  private marchers: Marcher[] = [];
  /** the town going about its day: people out walking, and protesters at the gate when trust is low */
  private townGroup = new THREE.Group();
  private walkers: Walker[] = [];
  private protesters: Protester[] = [];
  private townKey = '';
  private weather = new THREE.Group();
  private drops: { p: THREE.Vector3; v: number; drift: number }[] = [];
  private dropMesh: THREE.InstancedMesh | null = null;
  private dropM = new THREE.Matrix4();
  private weatherKind: 'snow' | 'rain' | null = null;
  private riotCash = 0;
  private goalClock = 0;
  private thread = '';
  private workers = new Map<number, { group: THREE.Group; legs: THREE.Group[] }>();
  private buildFloor: THREE.Group | null = null;
  private cranes: THREE.Group[] = [];
  /** floors under construction for months, by index */
  private jobFloors = new Map<number, THREE.Group>();
  private roofs: THREE.Group[] = [];
  private spots: TreeSpot[] = [];
  private lastCleared = -1;
  private lastLoc: LocKey | null = null;
  private falling: Falling[] = [];
  private puffList: Puff[] = [];
  private puffGeo = new THREE.SphereGeometry(1, 24, 16);
  private puffClock = 0;
  private lastBuild = -1;
  private ledClock = 0;
  private saveClock = 0;
  private hover: FoundKey | null = null;
  private hoverKey = '';
  private upc = 0.2; // world units per stitch
  private fitTween: { t0: number; fromU: number; toU: number; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
  private raycaster = new THREE.Raycaster();
  private down: [number, number] | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private textHidden = false;
  private moved = false;
  /** a tall tower that doesn't fit scrolls; this is the floor the wheel has scrolled to, until you pick another */
  private scrolled = false;
  private look: number | null = null;
  private lookSel = -1;

  constructor(private host: HTMLElement, private hooks: EngineHooks, private font: string) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // shadows barely change frame to frame; draw them a few times a second instead of every frame
    this.renderer.shadowMap.autoUpdate = false;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Your stitched datacenter. Drag to turn it, right-drag or two-finger drag to move.');
    host.appendChild(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, enablePan: true, screenSpacePanning: true, enableZoom: true,
      minZoom: 0.6, maxZoom: 2.5, minPolarAngle: 0.45, maxPolarAngle: 1.56, autoRotateSpeed: 0.8,
    });
    this.controls.addEventListener('start', () => {
      this.hooks.onFirstInteraction();
      // once you move the camera yourself the name could land on the building, so put it away
      this.moved = true;
      this.post.uniforms.uTextRows.value = 0;
    });

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun, this.sun.target, new THREE.AmbientLight(0xffffff, 0.1 * Math.PI));

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 72), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.005;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.building, this.scenery, this.options, this.puffs, this.crowd, this.townGroup, this.weather);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.weaveScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.weave));
    this.post.uniforms.uNear.value = this.camera.near;
    this.post.uniforms.uFar.value = this.camera.far;

    // capture so it runs before the camera's zoom
    canvas.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
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
    this.rtNormal?.dispose(); this.rtRole?.dispose(); this.rtCell?.dispose(); this.textTex?.dispose();
    this.groundTex.forEach(t => t.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Space the UI covers at the top and bottom of the window, in CSS pixels. */
  setInsets(top: number, bottom: number, right = 0) {
    if (Math.abs(top - this.insets.top) < 2 && Math.abs(bottom - this.insets.bottom) < 2 && Math.abs(right - this.insets.right) < 2) return;
    this.insets = { top, bottom, right };
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

    // centre the name in the strip the controls panel leaves free
    const letters = this.drawLettering(Math.max(30, vn - (this.insets.right * dpr) / cell));
    this.textTex?.dispose();
    this.textTex = null;
    if (letters) {
      this.textTex = new THREE.CanvasTexture(letters.canvas);
      this.textTex.minFilter = this.textTex.magFilter = THREE.NearestFilter;
      this.textTex.generateMipmaps = false;
    }
    this.grid.textBottom = Math.ceil((this.insets.bottom * dpr) / cell) + 2;
    this.grid.textRows = letters?.rows ?? 0;

    this.rtNormal?.dispose(); this.rtRole?.dispose(); this.rtCell?.dispose();
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtCell = new THREE.WebGLRenderTarget(n, m, opts);
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
    u.uTextRows.value = this.textHidden || this.moved ? 0 : this.grid.textRows;
    u.uCell.value = cell;
    const w2 = this.weave.uniforms;
    w2.tCell.value = this.rtCell.texture;
    (w2.uGrid.value as THREE.Vector2).set(n, m);
    w2.uCell.value = cell;
    this.applyFrustum();
  };

  private applyFrustum() {
    const hh = (this.upc * this.grid.m) / 2, hw = (this.upc * this.grid.n) / 2;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  rebuild() {
    const t0 = performance.now();
    this.rebuildScene();
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __rebuild?: number[] }).__rebuild = [...((window as unknown as { __rebuild?: number[] }).__rebuild ?? []), performance.now() - t0].slice(-20);
  }

  private rebuildScene() {
    const s = this.s;
    clear(this.building);
    this.anim = { leds: [], fans: [], rotors: [], alarms: [], vent: new THREE.Vector3() };
    this.workers.clear();
    this.buildFloor = null;
    this.jobFloors.clear();
    this.floorGroups = [];
    for (let b = 0; b < s.campus; b++) {
      const fg = makeFoundation(s.found);
      fg.position.x = buildingX(b);
      this.building.add(fg);
      bake(fg);
    }
    // once the town has torn it down, only the foundation is left
    const razed = s.over?.reason === 'town' && s.over.done;
    if (!razed) {
      s.floors.forEach((f, i) => {
        const g = makeFloor(s, i, f, this.anim);
        this.building.add(g);
        this.floorGroups.push(g);
        if (s.build?.idx === i) this.buildFloor = g;
        if (jobOn(s, i)) this.jobFloors.set(i, g);
      });
      // building 0 last, so the steam comes off the main roof
      this.roofs = [];
      for (let b = s.campus - 1; b >= 0; b--) {
        if (!heightOf(s, b)) continue;
        const r = makeRoof(s, this.anim, b);
        r.userData.b = b;
        this.building.add(r);
        this.roofs.push(r);
      }
    } else this.roofs = [];
    // a crane beside every building with a crew on it
    this.cranes = [];
    for (let b = 0; b < s.campus; b++) {
      if (s.phase !== 'play' || !busy(s, b)) continue;
      const c = makeCrane(levelY(s, heightOf(s, b)));
      c.position.set(buildingX(b) + FW / 2 + 1.6, 0, -FD / 2 - 1.2);
      this.building.add(c);
      this.cranes.push(c);
    }
    // merge what never moves; blinking lights, fans and alarms stay separate
    // rack lights blink in two groups per floor instead of one by one: two merged meshes, not dozens
    const lights = new Set(this.anim.leds);
    this.anim.leds = [];
    for (const g of this.floorGroups) {
      const own = g.children.filter(c => lights.has(c));
      if (!own.length) continue;
      const sets = [new THREE.Group(), new THREE.Group()];
      own.forEach((m, k) => { g.remove(m); sets[k % 2].add(m); });
      for (const set of sets) { set.userData.floor = own[0].userData.floor; g.add(set); bake(set); this.anim.leds.push(set); }
    }
    const live = new Set<THREE.Object3D>([...this.anim.leds, ...this.anim.alarms, ...this.anim.fans, ...this.anim.rotors]);
    for (const g of this.floorGroups) bake(g, live);
    for (const r of this.roofs) bake(r, live);
    this.makeCrowd();
    this.makeTown();
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
    bake(this.scenery);
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
    for (const key of SETUP_FOUNDS) {
      const g = makeFoundation(key, key === s.found);
      g.position.x = OPTION_X[key] ?? 0;
      g.traverse(o => { o.userData.found = key; });
      this.options.add(g);
      bake(g);
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
    (this.weave.uniforms.uCloth.value as THREE.Color).set(L.cloth);
    (this.weave.uniforms.uHole.value as THREE.Color).set(L.hole);
    (u.uGroundEdge.value as THREE.Color).set(L.edge);
    (u.uGroundDeco.value as THREE.Color).set(L.deco);
    document.body.style.backgroundColor = L.cloth;
    // the UI's fabric patches take their tint from the location's cloth
    document.documentElement.style.setProperty('--cloth', L.cloth);
    document.documentElement.style.setProperty('--hole', L.hole);

    const h = levelY(s, tallest(s));
    this.sun.target.position.set(0, 0, 0);
    this.sun.position.set(14, 40 + h * 0.6, -6);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -30, right: 30, top: 30 + h, bottom: -30, near: 1, far: 200 });
    sc.updateProjectionMatrix();
  }

  /** How many protesters the town sends to the gate. */
  private protestSize() {
    const s = this.s;
    return s.phase === 'play' && s.trust < 40 ? Math.max(2, Math.min(9, Math.ceil((40 - s.trust) / 4))) : 0;
  }

  /** People walking around the lot, and a picket at the gate. */
  private makeTown() {
    const s = this.s;
    clear(this.townGroup);
    this.walkers = [];
    this.protesters = [];
    const look = townLook(s);
    this.townKey = `${look.homes}|${look.lit}|${look.forSale}|${this.protestSize()}`;
    if (s.phase !== 'play') return;
    const n = Math.min(5, 2 + Math.floor(look.homes / 3));
    for (let k = 0; k < n; k++) {
      const m = makePerson(CROWD[(k * 3) % CROWD.length], false);
      m.group.scale.setScalar(1.5);
      this.townGroup.add(m.group);
      this.walkers.push({ ...m, a: k * 2.1, speed: (0.05 + (k % 3) * 0.015) * (k % 2 ? 1 : -1), rx: (s.campus > 1 ? 18.2 : 15) + (k % 2) * 0.6, rz: 11.5 + (k % 3) * 0.6 });
    }
    const p = this.protestSize();
    for (let k = 0; k < p; k++) {
      const m = makePerson(CROWD[k % CROWD.length]);
      m.group.scale.setScalar(1.5);
      m.group.position.set(-9 + (k % 5) * 1.3, 0, 7.6 + Math.floor(k / 5) * 1.4);
      m.group.rotation.y = Math.PI;
      this.townGroup.add(m.group);
      this.protesters.push({ group: m.group, sign: m.sign, phase: k * 0.8 });
    }
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
    // a panel on the right leaves a narrower strip to frame the datacenter in
    const wide = Math.max(30, vn - (this.insets.right * dpr) / this.grid.cell);
    const want = Math.max(((max.x - min.x) * 1.08) / wide, ((max.y - min.y) * 1.08) / band);
    const toU = picking ? want : Math.min(want, MAX_UPC);
    // too tall to fit: scroll to the selected floor, but never past the ground or the roof
    let cx = (min.x + max.x) / 2, cy = (min.y + max.y) / 2;
    const scrolled = toU < want - 1e-6;
    this.scrolled = scrolled;
    if (s.sel !== this.lookSel) { this.look = null; this.lookSel = s.sel; }
    if (scrolled) {
      const sel = Math.max(0, Math.min(s.sel, s.floors.length - 1));
      const top = heightOf(s, bOf(s, sel)) - 1;
      const lv = this.look === null ? level(s, sel) : Math.max(0, Math.min(top, this.look));
      this.look = this.look === null ? null : lv;
      const focus = new THREE.Vector3(buildingX(bOf(s, sel)), levelY(s, lv) + FH / 2, 0).applyMatrix4(view);
      const halfH = (band * toU) / 2 / 1.04, halfW = (wide * toU) / 2 / 1.04;
      // keep the view inside the scene; if the scene is narrower than the view, just center it
      const keep = (lo: number, hi: number, v: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
      cy = keep(min.y + halfH, max.y - halfH, focus.y);
      cx = keep(min.x + halfW, max.x - halfW, focus.x);
    }
    this.moved = false;
    // the name sits under the ground; a scrolled view would put it on the building
    this.textHidden = scrolled;
    this.post.uniforms.uTextRows.value = this.textHidden ? 0 : this.grid.textRows;
    const dx = wide / 2 - n / 2, dy = (b0 + b1) / 2 - m / 2;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const center = this.controls.target.clone()
      .addScaledVector(right, cx - dx * toU)
      .addScaledVector(up, cy - dy * toU);
    if (!animate) {
      this.upc = toU;
      this.camera.position.add(center.clone().sub(this.controls.target));
      this.controls.target.copy(center);
      this.applyFrustum();
      return;
    }
    this.fitTween = { t0: performance.now(), fromU: this.upc, toU, fromT: this.controls.target.clone(), toT: center };
  }

  /** Where each walker is on screen, for tests. */
  peopleOnScreen() {
    const r = this.renderer.domElement.getBoundingClientRect();
    return this.walkers.map(w => {
      const p = w.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)).project(this.camera);
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    });
  }

  /** Where the top of a building is on screen, in CSS pixels, for things that float off the roof. */
  roofOnScreen(b = 0): { x: number; y: number } | null {
    const s = this.s;
    if (!heightOf(s, b)) return null;
    const p = new THREE.Vector3(buildingX(b), levelY(s, heightOf(s, b)), 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
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

  /** On a tower too tall to fit, the wheel scrolls up and down it, Tiny Tower style. Pinch or ctrl still zooms. */
  private onWheel = (e: WheelEvent) => {
    if (!this.scrolled || e.ctrlKey || this.picking) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const s = this.s, sel = Math.max(0, Math.min(s.sel, s.floors.length - 1));
    const from = this.look ?? level(s, sel);
    this.look = Math.max(0, Math.min(heightOf(s, bOf(s, sel)) - 1, from - e.deltaY / 40));
    this.fit(true);
  };

  private onDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
    // people walking around the lot can be stopped for a word
    if (!this.picking && this.walkers.length) {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      if (this.raycaster.intersectObjects(this.walkers.map(w => w.group), true).length) { this.hooks.onPickPerson?.(e.clientX, e.clientY); return; }
    }
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
    const what = this.picking ? (d?.found ? { found: d.found } : null) : d?.floor != null ? { floor: d.floor } : null;
    const key = what ? `${what.found ?? ''}${what.floor ?? ''}` : '';
    if (key !== this.hoverKey) { this.hoverKey = key; this.hooks.onHover(what); }
  };

  /** frame timing, for development only */
  private perf = { n: 0, ms: 0, worst: 0 };

  private loop = (now: number) => {
    if (this.disposed) return;
    const t0 = performance.now();
    this.frame(now);
    const ms = performance.now() - t0;
    if (process.env.NODE_ENV !== 'production') {
      const p = this.perf;
      p.n++; p.ms += ms; p.worst = Math.max(p.worst, ms);
      const info = this.renderer.info.render;
      (window as unknown as { __perf?: unknown }).__perf = { frames: p.n, avg: p.ms / p.n, worst: p.worst, calls: info.calls, tris: info.triangles, meshes: this.countMeshes() };
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private meshCount = 0;
  private meshAt = 0;
  private countMeshes() {
    if (performance.now() - this.meshAt > 2000) {
      this.meshAt = performance.now();
      let n = 0;
      this.scene.traverse(o => { if (o instanceof THREE.Mesh) n++; });
      this.meshCount = n;
    }
    return this.meshCount;
  }

  /** One frame: simulate, animate and draw. */
  private frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const s = this.s;
    const wasOver = s.phase === 'over';
    const { built, newMonth, fixed } = simulate(s, dt, MONTH_SECONDS, s.briefing || s.report || s.call || s.complaint || s.tierUp !== null ? 0 : SPEEDS[s.speed] ?? 1);
    if (newMonth) endOfMonth(s);
    let changed = built || newMonth || fixed;
    // the town changes month to month: more homes, lights out in a blackout, a picket at the gate
    if (newMonth) {
      const look = townLook(s);
      if (`${look.homes}|${look.lit}|${look.forSale}|${this.protestSize()}` !== this.townKey) this.rebuild();
    }
    this.goalClock += dt;
    if (s.phase === 'play' && this.goalClock > 0.5) { this.goalClock = 0; if (checkGoal(s, ledger(s))) changed = true; }
    if (s.phase === 'over' && !wasOver) {
      this.rebuild();
      this.resetView();
    } else if (built) {
      // outages and repairs only blink an alarm, so they don't need the scene rebuilt
      this.rebuild();
      this.fit(true);
      this.dust(this.lastBuild);
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
    this.weave.uniforms.uNight.value = s.phase === 'play' ? nightOf(s.month) * 0.8 : 0;
    this.render();

    this.saveClock += dt;
    if (this.saveClock > 5) { this.saveClock = 0; this.hooks.onSave(); }
  }

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
    for (const r of this.roofs) r.visible = gone < 1;
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

  /** Dust kicks up around a floor that just finished. */
  private dust(i: number) {
    const s = this.s;
    if (i < 0 || !s.floors[i] || this.picking) return;
    const y = baseY(s, i), x0 = buildingX(bOf(s, i));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const mesh = new THREE.Mesh(this.puffGeo, mat('surf'));
      this.puffs.add(mesh);
      this.puffList.push({ mesh, y0: y, age: 0, x: x0 + Math.cos(a) * FW / 2, z: Math.sin(a) * FD / 2, dust: { dx: Math.cos(a), dz: Math.sin(a) } });
    }
  }

  /** Snowflakes and raindrops are tiny boxes that the stitch pass turns into single stitches. */
  private animateWeather(dt: number) {
    const s = this.s;
    const kind = s.phase === 'play' && !this.picking ? weatherOf(s.loc, s.month) : null;
    if (kind !== this.weatherKind) {
      this.weatherKind = kind;
      clear(this.weather);
      this.drops = [];
      this.dropMesh = null;
      if (kind) {
        // one instanced mesh for every flake or drop: a single draw call
        const geo = kind === 'snow' ? new THREE.BoxGeometry(0.22, 0.22, 0.22) : new THREE.BoxGeometry(0.06, 0.7, 0.06);
        const n = kind === 'snow' ? 140 : 110;
        this.dropMesh = new THREE.InstancedMesh(geo, mat('light'), n);
        this.dropMesh.frustumCulled = false;
        this.weather.add(this.dropMesh);
        for (let k = 0; k < n; k++) {
          this.drops.push({ p: new THREE.Vector3((Math.random() - 0.5) * 38, Math.random() * 30, (Math.random() - 0.5) * 34), v: kind === 'snow' ? 1.2 + Math.random() * 0.8 : 14 + Math.random() * 4, drift: (Math.random() - 0.5) * 0.6 });
        }
      }
    }
    if (!this.dropMesh) return;
    this.drops.forEach((d, k) => {
      const p = d.p;
      p.y -= d.v * dt;
      p.x += d.drift * dt;
      if (p.y < 0) { p.y = 28 + Math.random() * 4; p.x = (Math.random() - 0.5) * 38; p.z = (Math.random() - 0.5) * 34; }
      this.dropM.makeTranslation(p.x, p.y, p.z);
      this.dropMesh!.setMatrixAt(k, this.dropM);
    });
    this.dropMesh.instanceMatrix.needsUpdate = true;
  }

  /** A copy of the current frame, for the share card. */
  capture(): HTMLCanvasElement {
    this.render();
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  }

  private shadowAt = 0;
  private render() {
    const r = this.renderer;
    const now = performance.now();
    if (now - this.shadowAt > 250 || this.fitTween || this.s.build) { r.shadowMap.needsUpdate = true; this.shadowAt = now; }
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
    r.setRenderTarget(this.rtCell);
    r.render(this.postScene, this.postCam);
    r.setRenderTarget(null);
    r.render(this.weaveScene, this.postCam);
  }

  private animate(dt: number, now: number) {
    const s = this.s, t = now / 1000;
    for (const w of s.workers) {
      const m = this.workers.get(w.id);
      if (!m) continue;
      m.group.visible = !!s.floors[w.floor]?.done && s.inside;
      m.group.position.set(buildingX(bOf(s, w.floor)) + w.x, baseY(s, w.floor) + 0.2, FD / 2 - 1.5);
      m.group.rotation.y = w.pause > 0 ? 0 : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const swing = w.pause > 0 ? 0 : Math.sin(t * 9 + w.id) * 0.6;
      m.legs[0].rotation.x = swing;
      m.legs[1].rotation.x = -swing;
    }
    for (const w of this.walkers) {
      w.group.visible = !this.picking && s.phase === 'play';
      w.a += w.speed * dt;
      const x = Math.cos(w.a) * w.rx, z = Math.sin(w.a) * w.rz;
      w.group.position.set(x, 0, z);
      // face along the path
      w.group.rotation.y = Math.atan2(-Math.sin(w.a) * w.rx * Math.sign(w.speed), Math.cos(w.a) * w.rz * Math.sign(w.speed));
      const swing = Math.sin(t * 7 + w.a * 10) * 0.5;
      w.legs[0].rotation.x = swing;
      w.legs[1].rotation.x = -swing;
    }
    for (const p of this.protesters) {
      p.group.position.y = Math.abs(Math.sin(t * 5 + p.phase)) * 0.25;
      p.sign.rotation.z = Math.sin(t * 4 + p.phase) * 0.25;
    }
    this.animateWeather(dt);
    for (const [k, c] of this.cranes.entries()) (c.userData.jib as THREE.Group).rotation.y = Math.sin(t * 0.25 + k) * 1.1 - 0.6;
    for (const f of this.anim.fans) f.rotation.z -= dt * 6;
    for (const f of this.anim.rotors) f.rotation.z -= dt * 4;
    const blink = Math.floor(t * 3) % 2 === 0;
    for (const a of this.anim.alarms) a.visible = blink && isBroken(s, a.userData.alarmFloor);
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
    if (s.smoke && cools && !this.picking && s.phase !== 'over' && this.puffClock <= 0 && this.puffList.filter(p => !p.dust).length < 2) {
      const mesh = new THREE.Mesh(this.puffGeo, mat('surf'));
      this.puffs.add(mesh);
      this.puffList.push({ mesh, y0: this.anim.vent.y, age: 0, x: this.anim.vent.x, z: this.anim.vent.z });
      this.puffClock = 3.2;
    }
    this.puffList = this.puffList.filter(p => {
      p.age += dt;
      if (p.dust) {
        // a quick puff of dust that spreads out and settles
        p.mesh.position.set(p.x + p.dust.dx * p.age * 2, p.y0 + p.age * 0.8, p.z + p.dust.dz * p.age * 2);
        p.mesh.scale.setScalar(Math.max(0.01, 0.55 - p.age * 0.5));
        if (p.age > 1) { this.puffs.remove(p.mesh); return false; }
        return true;
      }
      const r = Math.min(0.5 + p.age * 0.35, 1.7);
      p.mesh.position.set(p.x - p.age * 0.25, p.y0 + 0.6 + p.age * 0.75, p.z);
      p.mesh.scale.setScalar(r);
      if (p.age > 8 || !s.smoke || this.picking || s.phase === 'over') { this.puffs.remove(p.mesh); return false; }
      return true;
    });

    // months-long jobs: the floor rises as the work goes on, and the roof waits on top
    for (const j of s.jobs ?? []) {
      const g = this.jobFloors.get(j.idx);
      const k = Math.max(0, Math.min(1, (s.month - j.from) / Math.max(0.01, j.to - j.from)));
      this.lastBuild = j.idx;
      if (j.what === 'refit') continue;
      if (g) g.scale.y = Math.max(0.04, k);
      const top = s.floors.findLastIndex((f, i) => bOf(s, i) === bOf(s, j.idx));
      const r = this.roofs.find(x => x.userData.b === bOf(s, j.idx));
      if (r && top === j.idx) r.position.y = -(1 - k) * FH;
    }
    if (s.build) {
      // the floor drops in and settles with a little bounce
      const k = Math.min(1, (Date.now() - s.build.t0) / s.build.dur), c = 1.70158, e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
      this.lastBuild = s.build.idx;
      if (this.buildFloor) this.buildFloor.scale.y = Math.max(0.02, e);
      const idx = s.build.idx;
      const r = this.roofs.find(x => x.userData.b === bOf(s, idx));
      if (r) r.position.y = -(1 - e) * FH;
    }
    for (const g of this.options.children) {
      const want = this.hover === g.userData.found ? 0.6 : 0;
      g.position.y += (want - g.position.y) * Math.min(1, dt * 10);
    }
  }
}
