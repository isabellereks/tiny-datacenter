import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FD, FH, FOUNDS, type FoundKey } from './data';
import { clear, makeFloor, makeFoundation, makeRoof, makeScenery, makeWorker, type Animated } from './models';
import { baseY, money, simulate, stats, type GameState } from './state';
import { CLASS, createStitchMaterial } from './stitchPass';

const OPTION_X: Record<FoundKey, number> = { slab: -21, raised: -7, piles: 7, bedrock: 21 };
const DEFAULT_DIR = new THREE.Vector3(0.85, 0.5, 1).normalize();
const ASPECT = 1.22; // fabric rows per stitch across

// Role colours and thread colours are exact values, not sRGB to convert. Must run before any Color is made.
THREE.ColorManagement.enabled = false;

export interface StitchCounts { dark: number; light: number; accent: number; white: number; total: number; across: number; down: number }

export interface EngineHooks {
  state: () => GameState;
  onChange: () => void;
  onCounts: (c: StitchCounts) => void;
  onPickFloor: (floor: number) => void;
  onPickFoundation: (key: FoundKey) => void;
  onFirstInteraction: () => void;
  onSave: () => void;
}

interface Puff { mesh: THREE.Mesh; y0: number; age: number; x: number; z: number }

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
  private controls: OrbitControls;
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private ground: THREE.Mesh;
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
  private rtClass: THREE.WebGLRenderTarget | null = null;
  private textTex: THREE.CanvasTexture | null = null;
  private grid = { n: 115, m: 140, textRows: 0, cell: 6 };
  private anim: Animated = { leds: [], fans: [], vent: new THREE.Vector3() };
  private workers = new Map<number, { group: THREE.Group; legs: THREE.Group[] }>();
  private buildFloor: THREE.Group | null = null;
  private roof: THREE.Group | null = null;
  private puffList: Puff[] = [];
  private puffGeo = new THREE.SphereGeometry(1, 24, 16);
  private puffClock = 0;
  private ledClock = 0;
  private countClock = 0;
  private saveClock = 0;
  private hover: FoundKey | null = null;
  private halfH = 10;
  private fitTween: { t0: number; fromH: number; toH: number; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
  private raycaster = new THREE.Raycaster();
  private down: [number, number] | null = null;
  private resizeObs: ResizeObserver;
  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(private host: HTMLElement, private hoop: HTMLElement, private labels: HTMLElement, private hooks: EngineHooks, private font: string) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Cross-stitched datacenter. Drag to turn it, up and down to tilt.');
    hoop.prepend(canvas);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: true,
      minZoom: 0.7, maxZoom: 2.5, minPolarAngle: 0.35, maxPolarAngle: 1.35, autoRotateSpeed: 1.2,
    });
    this.controls.addEventListener('start', () => { this.hooks.onFirstInteraction(); });

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.7 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.building, this.scenery, this.options, this.puffs);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.post.uniforms.uNear.value = this.camera.near;
    this.post.uniforms.uFar.value = this.camera.far;

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(host);

    this.rebuild();
    this.layout();
    this.camera.position.copy(this.controls.target).add(DEFAULT_DIR.clone().multiplyScalar(150));
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
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.rtNormal?.dispose(); this.rtRole?.dispose(); this.rtClass?.dispose(); this.textTex?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.innerHTML = '';
  }

  /** Lettering, laid out on the stitch grid in a pixel font. Returns rows used. */
  private drawLettering(n: number, m: number) {
    const text = this.s.pattern.lettering.trim();
    if (!text) return { rows: 0, canvas: null as HTMLCanvasElement | null };
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const wrap = (k: number) => {
      ctx.font = `${8 * k}px ${this.font}`;
      const lines: string[] = [];
      for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > n * 0.88 && line) { lines.push(line); line = word; } else line = next;
        }
        lines.push(line);
      }
      return lines;
    };
    let k = 3, lines = wrap(k);
    while (k > 1 && (lines.length > 3 || lines.some(l => ctx.measureText(l).width > n * 0.88) || lines.length * 10 * k > m * 0.3)) {
      k--; lines = wrap(k);
    }
    const lineH = 10 * k, pad = 3 * k;
    const rows = Math.min(Math.floor(m * 0.35), lines.length * lineH + pad * 2);
    c.width = n; c.height = rows;
    ctx.font = `${8 * k}px ${this.font}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    lines.forEach((l, i) => ctx.fillText(l, Math.round((n - ctx.measureText(l).width) / 2), pad + i * lineH));
    return { rows, canvas: c };
  }

  /** Recomputes the stitch grid and canvas size from the host box and pattern settings. */
  layout = () => {
    const { across } = this.s.pattern;
    const n = across, m = Math.round(across * ASPECT);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = Math.max(100, this.host.clientWidth - 64), availH = Math.max(100, this.host.clientHeight - 120);
    const cell = Math.max(2, Math.floor(Math.min((availW * dpr) / n, (availH * dpr) / m)));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(n * cell, m * cell, false);
    const canvas = this.renderer.domElement;
    canvas.style.width = `${(n * cell) / dpr}px`;
    canvas.style.height = `${(m * cell) / dpr}px`;

    const { rows, canvas: textCanvas } = this.drawLettering(n, m);
    this.textTex?.dispose();
    this.textTex = null;
    if (textCanvas) {
      this.textTex = new THREE.CanvasTexture(textCanvas);
      this.textTex.minFilter = this.textTex.magFilter = THREE.NearestFilter;
      this.textTex.generateMipmaps = false;
    }
    const m3 = m - rows;
    this.rtNormal?.dispose(); this.rtRole?.dispose(); this.rtClass?.dispose();
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.rtNormal = new THREE.WebGLRenderTarget(n, m3, opts);
    this.rtNormal.depthTexture = new THREE.DepthTexture(n, m3);
    this.rtRole = new THREE.WebGLRenderTarget(n, m3, opts);
    this.rtClass = new THREE.WebGLRenderTarget(n, m, opts);
    this.grid = { n, m, textRows: rows, cell };

    const u = this.post.uniforms;
    u.tNormal.value = this.rtNormal.texture;
    u.tDepth.value = this.rtNormal.depthTexture;
    u.tRole.value = this.rtRole.texture;
    u.tText.value = this.textTex;
    (u.uGrid.value as THREE.Vector2).set(n, m);
    u.uTextRows.value = rows;
    this.applyFrustum();
    this.countClock = 0.9;
  };

  private applyFrustum() {
    const aspect = this.grid.n / (this.grid.m - this.grid.textRows);
    const h = this.halfH, w = h * aspect;
    Object.assign(this.camera, { left: -w, right: w, top: h, bottom: -h });
    this.camera.updateProjectionMatrix();
  }

  rebuild() {
    const s = this.s;
    clear(this.building);
    this.anim = { leds: [], fans: [], vent: new THREE.Vector3() };
    this.workers.clear();
    this.buildFloor = null;
    this.building.add(makeFoundation(s.found));
    s.floors.forEach((f, i) => {
      const g = makeFloor(s, i, f, this.anim);
      this.building.add(g);
      if (s.build?.idx === i) this.buildFloor = g;
    });
    this.roof = makeRoof(s, this.anim);
    this.building.add(this.roof);
    for (const w of s.workers) {
      const m = makeWorker();
      this.workers.set(w.id, m);
      this.building.add(m.group);
    }
    makeScenery(s, this.scenery);

    clear(this.options);
    for (const key of Object.keys(FOUNDS) as FoundKey[]) {
      const g = makeFoundation(key, key === s.found);
      g.position.x = OPTION_X[key];
      g.traverse(o => { o.userData.found = key; });
      this.options.add(g);
    }

    this.building.visible = this.scenery.visible = !s.picking;
    this.options.visible = s.picking;
    if (!s.picking) this.labels.innerHTML = '';

    const h = baseY(s, s.floors.length);
    this.sun.target.position.set(0, 0, 0);
    this.sun.position.set(14, 40 + h * 0.6, -6);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -40, right: 40, top: 40 + h, bottom: -40, near: 1, far: 200 });
    sc.updateProjectionMatrix();
  }

  /** Frames the building (or the foundation choices) to fill the hoop. */
  fit(animate = true) {
    const s = this.s;
    const box = new THREE.Box3().setFromObject(s.picking ? this.options : this.building);
    if (!s.picking && s.smoke && s.floors.some(f => f.type === 'cool')) box.expandByPoint(this.anim.vent.clone().add(new THREE.Vector3(1, 7, 0)));
    if (!s.picking) box.union(new THREE.Box3().setFromObject(this.scenery));

    // Measure the box as the camera currently sees it, so the piece fills the hoop snugly.
    this.camera.updateMatrixWorld();
    const view = this.camera.matrixWorldInverse;
    const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(view);
      min.min(new THREE.Vector2(p.x, p.y));
      max.max(new THREE.Vector2(p.x, p.y));
    }
    const aspect = this.grid.n / (this.grid.m - this.grid.textRows);
    const toH = Math.max((max.y - min.y) / 2, (max.x - min.x) / 2 / aspect) * 1.06;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const center = this.controls.target.clone()
      .addScaledVector(right, (min.x + max.x) / 2)
      .addScaledVector(up, (min.y + max.y) / 2);
    if (!animate) {
      this.halfH = toH;
      this.camera.position.add(center.clone().sub(this.controls.target));
      this.controls.target.copy(center);
      this.applyFrustum();
      return;
    }
    this.fitTween = { t0: performance.now(), fromH: this.halfH, toH, fromT: this.controls.target.clone(), toT: center };
  }

  resetView() {
    this.camera.zoom = 1;
    this.camera.position.copy(this.controls.target).add(DEFAULT_DIR.clone().multiplyScalar(150));
    this.camera.lookAt(this.controls.target);
    this.camera.updateProjectionMatrix();
    this.fit(true);
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    // the 3D image only covers the rows above the lettering
    const h3 = (this.grid.m - this.grid.textRows) / this.grid.m;
    const yTop = (e.clientY - r.top) / r.height;
    if (yTop > h3) return null;
    ndc.y = -(yTop / h3) * 2 + 1;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.s.picking ? this.options : this.building, true);
    return hits.length ? (hits[0].object.userData as { floor?: number; found?: FoundKey }) : null;
  }

  private onDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; };

  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
    const d = this.pick(e);
    if (!d) return;
    if (this.s.picking && d.found) this.hooks.onPickFoundation(d.found);
    else if (d.floor != null) this.hooks.onPickFloor(d.floor);
  };

  private onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const d = this.pick(e);
    this.hover = this.s.picking && d?.found ? d.found : null;
    this.renderer.domElement.style.cursor = d && (d.found || d.floor != null) ? 'pointer' : 'grab';
  };

  private setThreads() {
    const { pattern } = this.s, u = this.post.uniforms;
    (u.uDark.value as THREE.Color).set(pattern.threads.dark);
    (u.uLight.value as THREE.Color).set(pattern.threads.light);
    (u.uAccent.value as THREE.Color).set(pattern.threads.accent);
    u.uThreads.value = pattern.threadCount;
    u.uStitchWhite.value = pattern.leaveWhite ? 0 : 1;
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const s = this.s;
    if (simulate(s, dt, stats(s))) { this.rebuild(); this.fit(true); this.hooks.onChange(); }
    this.animate(dt, now);

    if (this.fitTween) {
      const k = Math.min(1, (now - this.fitTween.t0) / 700), e = 1 - Math.pow(1 - k, 3);
      this.halfH = this.fitTween.fromH + (this.fitTween.toH - this.fitTween.fromH) * e;
      const prev = this.controls.target.clone();
      this.controls.target.lerpVectors(this.fitTween.fromT, this.fitTween.toT, e);
      this.camera.position.add(this.controls.target.clone().sub(prev));
      this.applyFrustum();
      if (k >= 1) this.fitTween = null;
    }
    this.controls.autoRotate = s.spin;
    this.controls.update();
    this.setThreads();
    this.render();
    this.placeLabels();

    this.countClock += dt;
    if (this.countClock > 1) { this.countClock = 0; this.count(); }
    this.saveClock += dt;
    if (this.saveClock > 5) { this.saveClock = 0; this.hooks.onSave(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private render() {
    const r = this.renderer;
    r.setClearColor(0x000000, 0);
    this.ground.visible = false;
    this.scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal);
    r.clear();
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.ground.visible = true;
    r.setRenderTarget(this.rtRole);
    r.clear();
    r.render(this.scene, this.camera);
    this.post.uniforms.uMode.value = 0;
    this.post.uniforms.uCell.value = this.grid.cell;
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }

  /** Classifies every stitch once into a tiny target and tallies threads for the key. */
  private count() {
    if (!this.rtClass) return;
    const { n, m } = this.grid, r = this.renderer;
    this.post.uniforms.uMode.value = 1;
    this.post.uniforms.uCell.value = 1;
    r.setRenderTarget(this.rtClass);
    r.render(this.postScene, this.postCam);
    const buf = new Uint8Array(n * m * 4);
    r.readRenderTargetPixels(this.rtClass, 0, 0, n, m, buf);
    r.setRenderTarget(null);
    const tally = [0, 0, 0, 0, 0];
    for (let i = 0; i < buf.length; i += 4) tally[Math.round((buf[i] / 255) * 8)]++;
    this.hooks.onCounts({
      dark: tally[CLASS.dark], light: tally[CLASS.light], accent: tally[CLASS.accent], white: tally[CLASS.white],
      total: tally[1] + tally[2] + tally[3] + tally[4], across: n, down: m,
    });
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
    this.ledClock -= dt;
    if (this.ledClock <= 0) {
      this.ledClock = 0.35;
      for (const l of this.anim.leds) l.visible = Math.random() > 0.35;
    }

    const cools = s.floors.some(f => f.done && f.type === 'cool');
    this.puffClock -= dt;
    if (s.smoke && cools && !s.picking && this.puffClock <= 0 && this.puffList.length < 2) {
      const mesh = new THREE.Mesh(this.puffGeo);
      this.puffs.add(mesh);
      this.puffList.push({ mesh, y0: this.anim.vent.y, age: 0, x: this.anim.vent.x, z: this.anim.vent.z });
      this.puffClock = 3.2;
    }
    this.puffList = this.puffList.filter(p => {
      p.age += dt;
      const r = Math.min(0.5 + p.age * 0.35, 1.7);
      p.mesh.position.set(p.x - p.age * 0.25, p.y0 + 0.6 + p.age * 0.75, p.z);
      p.mesh.scale.setScalar(r);
      if (p.age > 8 || !s.smoke || s.picking) { this.puffs.remove(p.mesh); return false; }
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

  private placeLabels() {
    const s = this.s;
    if (!s.picking) return;
    if (!this.labels.childElementCount) {
      this.labels.innerHTML = (Object.keys(FOUNDS) as FoundKey[])
        .map(k => `<div class="flabel" data-k="${k}"><b>${FOUNDS[k].name}</b><span></span></div>`).join('');
    }
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight * (this.grid.m - this.grid.textRows) / this.grid.m;
    this.labels.querySelectorAll<HTMLElement>('.flabel').forEach(el => {
      const k = el.dataset.k as FoundKey, v = FOUNDS[k];
      const p = new THREE.Vector3(OPTION_X[k], 0, FD / 2 + 1).project(this.camera);
      el.style.left = `${((p.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - p.y) / 2) * h}px`;
      el.classList.toggle('on', k === s.found);
      const span = el.querySelector('span');
      if (span) span.textContent = k === s.found ? `Poured · ${v.max} floors` : `${v.max} floors · ${v.cost ? money(v.cost) : 'Free'}`;
    });
  }
}
