import * as THREE from 'three';

/** Stitch classes written by the classify mode and counted for the thread key. */
export const CLASS = { none: 0, dark: 1, light: 2, accent: 3, white: 4 } as const;

/**
 * Turns two low-res renders (view normals + depth, and flat role colours) into cross stitches.
 * Each grid cell is one stitch. Lines win: silhouettes, creases, depth steps and role changes
 * become dark outline stitches. Remaining "surf" faces are shaded by facing: lit faces stay
 * unstitched, side faces get the light thread, faces turned away get the dark thread.
 */
export function createStitchMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tNormal: { value: null },
      tDepth: { value: null },
      tRole: { value: null },
      tText: { value: null },
      uGrid: { value: new THREE.Vector2(1, 1) },
      uTextRows: { value: 0 },
      uCell: { value: 6 },
      uMode: { value: 0 },
      uThreads: { value: 3 },
      uStitchWhite: { value: 0 },
      uNear: { value: 1 },
      uFar: { value: 300 },
      uLightDir: { value: new THREE.Vector3(-0.8, 0.45, 0.4).normalize() },
      uCloth: { value: new THREE.Color('#F8F7F3') },
      uHole: { value: new THREE.Color('#EDEBE4') },
      uDark: { value: new THREE.Color('#0045D1') },
      uLight: { value: new THREE.Color('#99BBFF') },
      uAccent: { value: new THREE.Color('#FF7A45') },
      uWhite: { value: new THREE.Color('#FFFFFF') },
    },
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tNormal;
      uniform sampler2D tDepth;
      uniform sampler2D tRole;
      uniform sampler2D tText;
      uniform vec2 uGrid;
      uniform float uTextRows;
      uniform float uCell;
      uniform int uMode;
      uniform float uThreads;
      uniform float uStitchWhite;
      uniform float uNear;
      uniform float uFar;
      uniform vec3 uLightDir;
      uniform vec3 uCloth;
      uniform vec3 uHole;
      uniform vec3 uDark;
      uniform vec3 uLight;
      uniform vec3 uAccent;
      uniform vec3 uWhite;

      bool isObj(vec2 uv){ return texture2D(tNormal, uv).a > 0.5; }
      vec3 nrm(vec2 uv){ return normalize(texture2D(tNormal, uv).rgb * 2.0 - 1.0); }
      float dep(vec2 uv){ return uNear + texture2D(tDepth, uv).r * (uFar - uNear); }
      vec3 role(vec2 uv){ return texture2D(tRole, uv).rgb; }

      int classify(vec2 cell){
        if (cell.y < uTextRows) {
          vec2 tuv = (cell + 0.5) / vec2(uGrid.x, uTextRows);
          return texture2D(tText, tuv).a > 0.5 ? 1 : 0;
        }
        vec2 g = vec2(uGrid.x, uGrid.y - uTextRows);
        vec2 uv = (cell - vec2(0.0, uTextRows) + 0.5) / g;
        vec2 tx = 1.0 / g;
        vec4 rr = texture2D(tRole, uv);
        if (!isObj(uv)) return (rr.a > 0.03 && rr.a < 0.98) ? 1 : 0;

        vec3 n = nrm(uv);
        float d = dep(uv);
        vec2 r = vec2(tx.x, 0.0), u = vec2(0.0, tx.y);
        if (!isObj(uv + r) || !isObj(uv - r) || !isObj(uv + u) || !isObj(uv - u)) return 1;
        if (dep(uv + r) - d > 0.5 || dep(uv - r) - d > 0.5 || dep(uv + u) - d > 0.5 || dep(uv - u) - d > 0.5) return 1;
        if (dot(n, nrm(uv + r)) < 0.8 || dot(n, nrm(uv + u)) < 0.8) return 1;
        if (distance(rr.rgb, role(uv + r)) > 0.3 || distance(rr.rgb, role(uv + u)) > 0.3) return 1;

        if (rr.r < 0.2 && rr.g < 0.2) return 1;
        if (rr.r > 0.8 && rr.g < 0.2) return uThreads > 2.5 ? 3 : 1;
        if (rr.r < 0.8) return 2;
        float s = dot(n, uLightDir);
        if (s > 0.15) return uStitchWhite > 0.5 ? 4 : 0;
        if (s > -0.6) return 2;
        return 1;
      }

      void main(){
        vec2 px = gl_FragCoord.xy;
        vec2 cell = floor(px / uCell);
        int k = classify(cell);
        if (uMode == 1) { gl_FragColor = vec4(float(k) / 8.0, 0.0, 0.0, 1.0); return; }

        vec2 f = fract(px / uCell);
        float corner = length(0.5 - abs(f - 0.5));
        vec3 col = mix(uHole, uCloth, smoothstep(0.03, 0.09, corner));
        if (k > 0) {
          vec3 th = k == 1 ? uDark : k == 2 ? uLight : k == 3 ? uAccent : uWhite;
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
