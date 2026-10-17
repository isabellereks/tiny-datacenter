import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FD, FH, FOUNDS, INKS, STITCH, type FoundKey } from './data';
import { clear, glow, mat, makeFloor, makeFoundation, makeRoof, makeScenery, makeWorker, type Animated } from './models';
import { baseY, money, simulate, stats, type GameState } from './state';
import { createStitchMaterial } from './stitchPass';

const OPTION_X: Record<FoundKey, number> = { slab: -21, raised: -7, piles: 7, bedrock: 21 };
const DEFAULT_DIR = new THREE.Vector3(-0.55, 0.42, 1).normalize();

export interface EngineHooks {
  /** Latest game state; the engine mutates it while simulating. */
  state: () => GameState;
  /** A floor finished building, or something else the UI should redraw for. */
  onChange: () => void;
  onPickFloor: (floor: number) => void;
  onPickFoundation: (key: FoundKey) => void;
  onFirstInteraction: () => void;
}

interface Puff { mesh: THREE.Mesh; x: number; y: number; z: number; r: number }

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 1, 260);
  private controls: OrbitControls;
  private sun = new THREE.DirectionalLight(0xffffff, 0.7 * Math.PI);
  private building = new THREE.Group();
  private scenery = new THREE.Group();
  private options = new THREE.Group();
  private puffs = new THREE.Group();
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private post: THREE.ShaderMaterial;
  private rt: THREE.WebGLRenderTarget | null = null;
  private anim: Animated = { leds: [], fans: [] };
  private workers = new Map<number, { group: THREE.Group; legs: THREE.Group[] }>();
  private buildFloor: THREE.Group | null = null;
  private roof: THREE.Group | null = null;
  private puffList: Puff[] = [];
  private puffGeo = new THREE.SphereGeometry(1, 18, 12);
  private puffClock = 0;
  private ledClock = 0;
  private hover: FoundKey | null = null;
  private tween: { t0: number; ft: THREE.Vector3; tt: THREE.Vector3; fp: THREE.Vector3; tp: THREE.Vector3 } | null = null;
  private raycaster = new THREE.Raycaster();
  private down: [number, number] | null = null;
  private raf = 0;
  private last = 0;
  private saveClock = 0;
  private disposed = false;

  constructor(private container: HTMLElement, private labels: HTMLElement, private hooks: EngineHooks, private onSave: () => void) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D cross-stitch datacenter. Drag to rotate.');
    container.appendChild(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.45;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 120;
    this.controls.addEventListener('start', () => { this.tween = null; this.hooks.onFirstInteraction(); });

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5 * Math.PI));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.6 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground, this.building, this.scenery, this.options, this.puffs);

    this.post = createStitchMaterial(this.camera.near, this.camera.far);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('resize', this.resize);

    this.resize();
    this.rebuild();
    this.placeCamera();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private get s() { return this.hooks.state(); }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.rt?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.innerHTML = '';
  }

  resize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    const cell = STITCH[this.s.stitch].px * dpr;
    const lowW = Math.max(1, Math.ceil((w * dpr) / cell)), lowH = Math.max(1, Math.ceil((h * dpr) / cell));
    this.rt?.dispose();
    this.rt = new THREE.WebGLRenderTarget(lowW, lowH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rt.depthTexture = new THREE.DepthTexture(lowW, lowH);
    const u = this.post.uniforms;
    u.tColor.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    (u.uLow.value as THREE.Vector2).set(lowW, lowH);
    u.uCell.value = cell;
    this.camera.aspect = lowW / lowH;
    this.camera.updateProjectionMatrix();
  };

  rebuild() {
    const s = this.s;
    clear(this.building);
    this.anim = { leds: [], fans: [] };
    this.workers.clear();
    this.buildFloor = null;
    this.building.add(makeFoundation(s.found));
    s.floors.forEach((f, i) => {
      const g = makeFloor(s, i, f, this.anim);
      this.building.add(g);
      if (s.build?.idx === i) this.buildFloor = g;
    });
    this.roof = makeRoof(s);
    this.building.add(this.roof);
    for (const w of s.workers) {
      const m = makeWorker(w);
      this.workers.set(w.id, m);
      this.building.add(m.group);
    }
    makeScenery(s, this.scenery);

    clear(this.options);
    for (const key of Object.keys(FOUNDS) as FoundKey[]) {
      const g = makeFoundation(key, key === s.found ? '#8FA7DA' : undefined);
      g.position.x = OPTION_X[key];
      g.traverse(o => { o.userData.found = key; });
      this.options.add(g);
    }

    const picking = s.step === 'found';
    this.building.visible = !picking;
    this.options.visible = picking;
    const h = baseY(s, s.floors.length);
    this.sun.target.position.set(0, h / 3, 0);
    this.sun.position.set(-20, 30 + h * 0.6, 18);
    this.sun.shadow.camera.top = Math.max(45, h + 10);
    this.sun.shadow.camera.updateProjectionMatrix();
    (this.post.uniforms.uInk.value as THREE.Color).set(INKS[s.ink].hex);
    if (!picking) this.labels.innerHTML = '';
  }

  setInk() { (this.post.uniforms.uInk.value as THREE.Color).set(INKS[this.s.ink].hex); }

  private viewFor(keepDir: boolean) {
    const s = this.s;
    if (s.step === 'found') return { tgt: new THREE.Vector3(0, 1, 0), pos: new THREE.Vector3(0, 17, 46) };
    const top = baseY(s, s.floors.length) + 1.5;
    const tgt = new THREE.Vector3(1.5, top * 0.45, 0);
    const dir = keepDir ? this.camera.position.clone().sub(this.controls.target).normalize() : DEFAULT_DIR.clone();
    return { tgt, pos: tgt.clone().add(dir.multiplyScalar(24 + top * 1.05)) };
  }

  private placeCamera() {
    const { tgt, pos } = this.viewFor(false);
    this.controls.target.copy(tgt);
    this.camera.position.copy(pos);
  }

  frameView(keepDir: boolean) {
    const { tgt, pos } = this.viewFor(keepDir);
    this.tween = { t0: performance.now(), ft: this.controls.target.clone(), tt: tgt, fp: this.camera.position.clone(), tp: pos };
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.s.step === 'found' ? this.options : this.building, true);
    return hits.length ? hits[0].object.userData as { floor?: number; found?: FoundKey } : null;
  }

  private onDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
    const d = this.pick(e);
    if (!d) return;
    if (this.s.step === 'found' && d.found) this.hooks.onPickFoundation(d.found);
    else if (d.floor != null) this.hooks.onPickFloor(d.floor);
  };

  private onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const d = this.pick(e);
    this.hover = this.s.step === 'found' && d?.found ? d.found : null;
    this.renderer.domElement.style.cursor = d && (d.found || d.floor != null) ? 'pointer' : 'grab';
  };

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const s = this.s;
    const st = stats(s);
    if (simulate(s, dt, st)) { this.rebuild(); this.hooks.onChange(); }
    this.animate(dt, now, st.eff);

    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / 900), e = 1 - Math.pow(1 - k, 3);
      this.controls.target.lerpVectors(this.tween.ft, this.tween.tt, e);
      this.camera.position.lerpVectors(this.tween.fp, this.tween.tp, e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();

    this.renderer.setRenderTarget(this.rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
    this.placeLabels();

    this.saveClock += dt;
    if (this.saveClock > 5) { this.saveClock = 0; this.onSave(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private animate(dt: number, now: number, eff: number) {
    const s = this.s, t = now / 1000;
    for (const w of s.workers) {
      const m = this.workers.get(w.id);
      if (!m) continue;
      m.group.visible = !!s.floors[w.floor]?.done && s.inside;
      m.group.position.set(w.x, baseY(s, w.floor) + 0.2, FD / 2 - 1.4);
      m.group.rotation.y = w.pause > 0 ? 0 : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const swing = w.pause > 0 ? 0 : Math.sin(t * 9 + w.id) * 0.6;
      m.legs[0].rotation.x = swing;
      m.legs[1].rotation.x = -swing;
    }
    for (const f of this.anim.fans) f.rotation.z -= dt * 8;
    this.ledClock -= dt;
    if (this.ledClock <= 0) {
      this.ledClock = 0.18;
      const m = glow(eff < 0.6 ? '#D04848' : '#47A72F');
      for (const l of this.anim.leds) { l.visible = Math.random() > 0.4; l.material = m; }
    }

    const cools = s.floors.filter(f => f.done && f.type === 'cool').length;
    const top = baseY(s, s.floors.length) + 0.4;
    this.puffClock -= dt;
    if (cools && s.step !== 'found' && this.puffClock <= 0 && this.puffList.length < 2 + cools) {
      const mesh = new THREE.Mesh(this.puffGeo, mat('#FFFFFF'));
      this.puffs.add(mesh);
      this.puffList.push({ mesh, x: -2 + Math.random() * 4, y: top + 1.2, z: (Math.random() - 0.5) * 2, r: 0.7 });
      this.puffClock = 3 / Math.min(cools, 3);
    }
    this.puffList = this.puffList.filter(p => {
      p.y += 0.9 * dt; p.x += 0.35 * dt; p.r = Math.min(p.r + 0.22 * dt, 2);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.setScalar(p.r);
      if (p.y > top + 13 || s.step === 'found') { this.puffs.remove(p.mesh); return false; }
      return true;
    });

    if (s.build) {
      const k = Math.min(1, (Date.now() - s.build.t0) / s.build.dur), e = 1 - Math.pow(1 - k, 3);
      if (this.buildFloor) this.buildFloor.scale.y = Math.max(0.02, e);
      if (this.roof) this.roof.position.y = -(1 - e) * FH;
    }
    for (const g of this.options.children) {
      const want = this.hover === g.userData.found ? 0.5 : 0;
      g.position.y += (want - g.position.y) * Math.min(1, dt * 10);
    }
  }

  private placeLabels() {
    const s = this.s;
    if (s.step !== 'found') return;
    if (!this.labels.childElementCount) {
      this.labels.innerHTML = (Object.keys(FOUNDS) as FoundKey[])
        .map(k => `<div class="flabel glass" data-k="${k}"><b>${FOUNDS[k].name}</b><span></span></div>`).join('');
    }
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.labels.querySelectorAll<HTMLElement>('.flabel').forEach(el => {
      const k = el.dataset.k as FoundKey, v = FOUNDS[k];
      const p = new THREE.Vector3(OPTION_X[k], 3.2, 0).project(this.camera);
      el.style.left = `${((p.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - p.y) / 2) * h}px`;
      el.classList.toggle('on', k === s.found);
      const span = el.querySelector('span');
      if (span) span.textContent = k === s.found ? `Poured · ${v.max} floors` : `${v.max} floors · ${v.cost ? money(v.cost) : 'Free'}`;
    });
  }
}
