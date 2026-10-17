import * as THREE from 'three';

/**
 * Full-screen pass that turns a low-resolution render into cross stitches on aida cloth.
 * Each low-res pixel becomes one X stitch: near-white surfaces stay bare cloth, greys map to
 * shades of the ink thread, saturated colors are posterized, and depth jumps get an ink outline.
 */
export function createStitchMaterial(near: number, far: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uLow: { value: new THREE.Vector2(1, 1) },
      uCell: { value: 7 },
      uCloth: { value: new THREE.Color('#F4F4F1') },
      uHole: { value: new THREE.Color('#D9DCD6') },
      uInk: { value: new THREE.Color('#4A66B5') },
      uNear: { value: near },
      uFar: { value: far },
    },
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uLow;
      uniform float uCell;
      uniform vec3 uCloth;
      uniform vec3 uHole;
      uniform vec3 uInk;
      uniform float uNear;
      uniform float uFar;

      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      bool edgeAt(vec2 uv, vec2 o, float dc){
        vec4 n = texture2D(tColor, uv + o);
        float nd = lin(texture2D(tDepth, uv + o).r);
        return n.a < 0.98 || nd - dc > 0.55 + 0.02 * dc;
      }

      void main(){
        vec2 px = gl_FragCoord.xy;
        vec2 cell = floor(px / uCell);
        vec2 f = fract(px / uCell);
        vec2 uv = (cell + 0.5) / uLow;
        vec2 tx = 1.0 / uLow;
        vec4 c = texture2D(tColor, uv);
        float dc = lin(texture2D(tDepth, uv).r);

        float corner = length(0.5 - abs(f - 0.5));
        vec3 col = mix(uHole, uCloth, smoothstep(0.07, 0.15, corner));
        col *= 0.985 + 0.015 * sin(px.x * 1.7) * sin(px.y * 1.7);

        bool has = false;
        vec3 th = uInk;
        if (c.a > 0.98) {
          bool e = edgeAt(uv, vec2(tx.x, 0.0), dc) || edgeAt(uv, vec2(-tx.x, 0.0), dc)
                || edgeAt(uv, vec2(0.0, tx.y), dc) || edgeAt(uv, vec2(0.0, -tx.y), dc);
          if (e) { has = true; }
          else {
            float mx = max(c.r, max(c.g, c.b));
            float mn = min(c.r, min(c.g, c.b));
            float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            if (mx - mn < 0.1) {
              if (l > 0.78) { has = false; }
              else if (l > 0.6) { has = true; th = mix(uCloth, uInk, 0.38); }
              else if (l > 0.38) { has = true; th = mix(uCloth, uInk, 0.7); }
              else { has = true; }
            } else {
              float k = l > 0.75 ? 0.9 : l > 0.5 ? 0.66 : l > 0.3 ? 0.46 : 0.3;
              th = clamp(c.rgb / max(l, 0.02) * k, 0.0, 1.0);
              has = true;
            }
          }
        } else if (c.a > 0.03) {
          has = true;
          th = mix(uCloth, uInk, 0.82);
        }

        if (has) {
          float w = 0.17;
          float aa = 1.4 / uCell;
          float d1 = abs(f.x - f.y) * 0.7071;
          float d2 = abs(f.x + f.y - 1.0) * 0.7071;
          float inset = step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
          float m1 = (1.0 - smoothstep(w - aa, w, d1)) * inset;
          float m2 = (1.0 - smoothstep(w - aa, w, d2)) * inset;
          float v = 0.93 + 0.1 * hash(cell);
          col = mix(col, th * 0.8 * v, m1);
          col = mix(col, th * v * (0.94 + 0.1 * sin((f.x - f.y) * 18.0)), m2);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
