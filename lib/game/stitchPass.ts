import * as THREE from 'three';
import { PALETTE } from './data';

/**
 * Turns two low-res renders into cross stitches, one stitch per grid cell.
 *  - tNormal: view-space normals (alpha marks objects) with depth in tDepth.
 *  - tRole:   objects carry a role code (red = role / 8, green = palette index / 16);
 *             the ground patch is lit blue, darker where shadowed, with green marking texture.
 * Lines win: silhouettes, creases, depth steps and role changes become outline stitches.
 */
export function createStitchMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tNormal: { value: null },
      tDepth: { value: null },
      tRole: { value: null },
      tText: { value: null },
      uGrid: { value: new THREE.Vector2(1, 1) },
      uTextBottom: { value: 0 },
      uTextRows: { value: 0 },
      uCell: { value: 6 },
      uNear: { value: 1 },
      uFar: { value: 400 },
      uDepthEdge: { value: 0.5 },
      uLightDir: { value: new THREE.Vector3(-0.55, 0.6, 0.58).normalize() },
      uCloth: { value: new THREE.Color('#F5F4F1') },
      uHole: { value: new THREE.Color('#E5E3DD') },
      uOutline: { value: new THREE.Color('#0045D1') },
      uShade: { value: new THREE.Color('#99BBFF') },
      uAccent: { value: new THREE.Color('#FF7A45') },
      uGroundEdge: { value: new THREE.Color('#A8D5BA') },
      uGroundDeco: { value: new THREE.Color('#2E8B57') },
      uPalette: { value: PALETTE.map(h => new THREE.Color(h)) },
    },
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tNormal;
      uniform sampler2D tDepth;
      uniform sampler2D tRole;
      uniform sampler2D tText;
      uniform vec2 uGrid;
      uniform float uTextBottom;
      uniform float uTextRows;
      uniform float uCell;
      uniform float uNear;
      uniform float uFar;
      uniform float uDepthEdge;
      uniform vec3 uLightDir;
      uniform vec3 uCloth;
      uniform vec3 uHole;
      uniform vec3 uOutline;
      uniform vec3 uShade;
      uniform vec3 uAccent;
      uniform vec3 uGroundEdge;
      uniform vec3 uGroundDeco;
      uniform vec3 uPalette[${PALETTE.length}];

      bool isObj(vec2 uv){ return texture2D(tNormal, uv).a > 0.5; }
      vec3 nrm(vec2 uv){ return normalize(texture2D(tNormal, uv).rgb * 2.0 - 1.0); }
      float dep(vec2 uv){ return uNear + texture2D(tDepth, uv).r * (uFar - uNear); }
      bool isGround(vec2 uv){ vec4 r = texture2D(tRole, uv); return !isObj(uv) && r.b > 0.02; }

      vec3 paletteAt(int idx){
        vec3 c = uPalette[0];
        for (int i = 0; i < ${PALETTE.length}; i++) if (i == idx) c = uPalette[i];
        return c;
      }

      // rgb = thread colour, a = 1 when this cell is stitched
      vec4 threadAt(vec2 cell){
        if (uTextRows > 0.0 && cell.y >= uTextBottom && cell.y < uTextBottom + uTextRows) {
          vec2 tuv = (cell - vec2(0.0, uTextBottom) + 0.5) / vec2(uGrid.x, uTextRows);
          if (texture2D(tText, tuv).a > 0.5) return vec4(uOutline, 1.0);
        }
        vec2 uv = (cell + 0.5) / uGrid;
        vec2 r = vec2(1.0 / uGrid.x, 0.0), u = vec2(0.0, 1.0 / uGrid.y);
        vec4 rr = texture2D(tRole, uv);

        if (!isObj(uv)) {
          if (rr.b <= 0.02) return vec4(0.0);
          if (rr.b < 0.45) return vec4(mix(uShade, uOutline, 0.45), 1.0);
          if (!isGround(uv + r) || !isGround(uv - r) || !isGround(uv + u) || !isGround(uv - u)) return vec4(uGroundEdge, 1.0);
          if (rr.g > rr.b * 0.5) return vec4(uGroundDeco, 1.0);
          return vec4(0.0);
        }

        vec3 n = nrm(uv);
        float d = dep(uv);
        if (!isObj(uv + r) || !isObj(uv - r) || !isObj(uv + u) || !isObj(uv - u)) return vec4(uOutline, 1.0);
        // A step in depth is a line; a flat wall seen edge-on is not. Its depth slopes but doesn't bend,
        // so require both a farther neighbour and curvature, and only outline the nearer side.
        float dr = dep(uv + r), dl = dep(uv - r), du = dep(uv + u), dd = dep(uv - u);
        float lapX = abs(dr + dl - 2.0 * d), lapY = abs(du + dd - 2.0 * d);
        if ((lapX > uDepthEdge && max(dr, dl) - d > uDepthEdge) || (lapY > uDepthEdge && max(du, dd) - d > uDepthEdge)) return vec4(uOutline, 1.0);
        if (dot(n, nrm(uv + r)) < 0.8 || dot(n, nrm(uv + u)) < 0.8) return vec4(uOutline, 1.0);
        // A colour change only gets a line where something stands proud of its neighbour.
        // Flush parts like status lights, signs and windows read as plain patches of thread.
        bool proudX = abs(dr + dl - 2.0 * d) > 0.15 || abs(dr - d) > 0.6;
        bool proudY = abs(du + dd - 2.0 * d) > 0.15 || abs(du - d) > 0.6;
        if ((proudX && distance(rr.rg, texture2D(tRole, uv + r).rg) > 0.03) || (proudY && distance(rr.rg, texture2D(tRole, uv + u).rg) > 0.03)) return vec4(uOutline, 1.0);

        int role = int(floor(rr.r * 8.0 + 0.5));
        float s = dot(n, uLightDir);
        if (role == 1) return vec4(uShade, 1.0);
        if (role == 2) return vec4(uOutline, 1.0);
        if (role == 3) return vec4(uAccent, 1.0);
        if (role == 4) {
          vec3 c = paletteAt(int(floor(rr.g * 16.0 + 0.5)));
          if (s > 0.15) return vec4(c, 1.0);
          return vec4(mix(c, uOutline, s > -0.75 ? 0.25 : 0.5), 1.0);
        }
        if (s > 0.15) return vec4(0.0);
        if (s > -0.75) return vec4(uShade, 1.0);
        return vec4(uOutline, 1.0);
      }

      void main(){
        vec2 px = gl_FragCoord.xy;
        vec2 cell = floor(px / uCell);
        vec2 f = fract(px / uCell);
        float corner = length(0.5 - abs(f - 0.5));
        vec3 col = mix(uHole, uCloth, smoothstep(0.03, 0.09, corner));
        vec4 t = threadAt(cell);
        if (t.a > 0.5) {
          vec3 th = t.rgb;
          float w = 0.29;
          float aa = 1.2 / uCell;
          float d1 = abs(f.x - f.y) * 0.7071;
          float d2 = abs(f.x + f.y - 1.0) * 0.7071;
          float inset = step(0.02, f.x) * step(f.x, 0.98) * step(0.02, f.y) * step(f.y, 0.98);
          float m1 = (1.0 - smoothstep(w - aa, w, d1)) * inset;
          float m2 = (1.0 - smoothstep(w - aa, w, d2)) * inset;
          float along = (f.x + (1.0 - f.y)) * 0.5;
          col = mix(col, th * 0.86, m1);
          col = mix(col, th * (0.9 + 0.18 * sin(along * 3.1416)), m2);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
