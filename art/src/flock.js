/*
 * The flock. A few thousand starlings are simulated on the GPU (positions and
 * velocities in float textures, updated by two shader passes every frame) and
 * drawn as small flapping birds in ink. Each [data-flock] section says what the
 * flock does there: "free" wheels around the section's anchor on a curl-noise
 * flow; any other value names a shape the birds gather into at the anchor,
 * turning slowly in 3D. Between shapes the birds stream across in an arc.
 * Reduced motion: every shape fully formed and still. No WebGL2: html.no-flock,
 * and the drawn stills stay.
 */
import * as THREE from './vendor/three.module.min.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

function canRun() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return !!(gl && gl.getExtension('EXT_color_buffer_float'));
  } catch {
    return false;
  }
}

/* ---------- Shapes: point clouds in unit space, y up ---------- */

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261007);
const R = (a, b) => a + (b - a) * rnd();
const J = (s) => (rnd() * 2 - 1) * s;

const seg = (a, b, j = 0.012) => () => {
  const t = rnd();
  return [a[0] + (b[0] - a[0]) * t + J(j), a[1] + (b[1] - a[1]) * t + J(j), a[2] + (b[2] - a[2]) * t + J(j)];
};
const segLen = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/* A point on a box's surface, faces weighted by area. levels > 0 snaps the side faces to sheet edges. */
function boxSurface(c, s, levels = 0) {
  const [sx, sy, sz] = s;
  const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
  const total = areas.reduce((a, b) => a + b, 0);
  return () => {
    let r = rnd() * total;
    let f = 0;
    while ((r -= areas[f]) > 0) f += 1;
    let x = R(-0.5, 0.5) * sx, y = R(-0.5, 0.5) * sy, z = R(-0.5, 0.5) * sz;
    if (f === 0) x = -sx / 2; else if (f === 1) x = sx / 2;
    else if (f === 2) y = -sy / 2; else if (f === 3) y = sy / 2;
    else if (f === 4) z = -sz / 2; else z = sz / 2;
    if (levels && f !== 2 && f !== 3) y = Math.round((y / sy + 0.5) * levels) / levels * sy - sy / 2;
    return [c[0] + x, c[1] + y, c[2] + z];
  };
}

function sample(parts, n) {
  const total = parts.reduce((a, p) => a + p[0], 0);
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    let r = rnd() * total;
    let k = 0;
    while ((r -= parts[k][0]) > 0 && k < parts.length - 1) k += 1;
    const p = parts[k][1]();
    out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = 1;
  }
  return out;
}

/* Edges of many segments, weighted by length. */
function edges(list, weight, j) {
  const total = list.reduce((a, [p, q]) => a + segLen(p, q), 0);
  return list.map(([p, q]) => [weight * segLen(p, q) / total, seg(p, q, j)]);
}

const SHAPES = {
  /* Coffee: a roasting drum, open to us, beans tumbling in its lower half, on a stand. */
  drum: {
    yaw: -0.62, tilt: 0.16, size: 1,
    parts: () => {
      const Rd = 0.78, L = 1.2;
      return [
        [0.4, () => { const a = R(0, Math.PI * 2); return [Rd * Math.cos(a), Rd * Math.sin(a), R(-L / 2, L / 2)]; }],
        [0.2, () => { const a = R(0, Math.PI * 2), r = Rd + 0.06 + J(0.03); return [r * Math.cos(a), r * Math.sin(a), L / 2 + J(0.04)]; }],
        [0.1, () => { const a = R(0, Math.PI * 2), r = Rd * Math.sqrt(rnd()); return [r * Math.cos(a), r * Math.sin(a), -L / 2]; }],
        [0.17, () => { const a = R(0, Math.PI * 2), r = Math.sqrt(rnd()); return [0.5 * r * Math.cos(a), -0.5 + 0.17 * r * Math.sin(a) + J(0.05), R(-0.45, 0.5)]; }],
        [0.09, boxSurface([0, -1.02, 0], [1.4, 0.07, 0.8])],
        [0.04, seg([0, 0, -L / 2], [0, 0, -L / 2 - 0.45], 0.02)],
      ];
    },
  },
  /* Accounting: the payment stack, the tax pot beside it, sheets crossing between, one ruled line under both. */
  ledger: {
    yaw: 0.5, tilt: 0.3, size: 1,
    parts: () => {
      const sheets = [];
      for (let k = 0; k < 5; k++) {
        const t = (k + 0.5) / 5;
        const cx = -0.45 + t * 1.05, cy = -0.02 + Math.sin(t * Math.PI) * 0.55 - t * 0.3, rot = (t - 0.5) * 0.8;
        sheets.push([0.04, () => {
          const x = R(-0.38, 0.38), z = R(-0.28, 0.28);
          return [cx + x * Math.cos(rot), cy + x * Math.sin(rot) + J(0.01), z];
        }]);
      }
      return [
        [0.46, boxSurface([-0.58, -0.36, 0], [0.82, 0.92, 0.6], 22)],
        [0.26, boxSurface([0.62, -0.6, 0.05], [0.82, 0.44, 0.6], 11)],
        ...sheets,
        [0.08, seg([-1.25, -0.84, 0.42], [1.25, -0.84, 0.42], 0.01)],
      ];
    },
  },
  /* Architecture: a timber frame on its plinth, rafters to the ridge, the topping-out fir on top. */
  frame: {
    yaw: 0.72, tilt: 0.2, size: 1,
    parts: () => {
      const x0 = -0.8, x1 = 0.8, z0 = -0.5, z1 = 0.5, y0 = -0.72, y1 = 0.12, yr = 0.78;
      const list = [];
      const xs = [x0, -0.27, 0.27, x1];
      for (const x of xs) for (const z of [z0, z1]) list.push([[x, y0, z], [x, y1, z]]);
      for (const y of [y0, y1]) {
        list.push([[x0, y, z0], [x1, y, z0]], [[x0, y, z1], [x1, y, z1]], [[x0, y, z0], [x0, y, z1]], [[x1, y, z0], [x1, y, z1]]);
      }
      for (let k = 0; k <= 4; k++) {
        const x = x0 + (x1 - x0) * (k / 4);
        list.push([[x, y1 - 0.05, z0 - 0.12], [x, yr, 0]], [[x, y1 - 0.05, z1 + 0.12], [x, yr, 0]]);
      }
      list.push([[x0 - 0.12, yr, 0], [x1 + 0.12, yr, 0]]);
      for (const x of [-0.53, 0, 0.53]) list.push([[x, y0, z0], [x, y0, z1]]);
      return [
        ...edges(list, 0.84, 0.014),
        [0.1, boxSurface([0, -0.79, 0], [1.9, 0.1, 1.3])],
        [0.06, () => { const h = rnd(), a = R(0, Math.PI * 2), r = (1 - h) * 0.13; return [0.55 + r * Math.cos(a), yr + 0.02 + h * 0.38, r * Math.sin(a)]; }],
      ];
    },
  },
  /* Festival: a wave pitching over, seen from the side: the back, the lip throwing forward, the hollow face, spray. */
  wave: {
    yaw: -1.42, tilt: 0.06, size: 1.15,
    parts: () => {
      const back = [[-1.3, -0.56], [-0.75, -0.44], [-0.32, -0.14], [0.0, 0.24], [0.22, 0.52], [0.44, 0.67], [0.68, 0.61], [0.86, 0.42], [0.94, 0.17], [0.87, -0.04]];
      const face = [[1.3, -0.62], [0.9, -0.56], [0.58, -0.4], [0.37, -0.14], [0.29, 0.14], [0.33, 0.38], [0.46, 0.53]];
      const line = (poly) => {
        const lens = [];
        let total = 0;
        for (let i = 1; i < poly.length; i++) { const l = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); lens.push(l); total += l; }
        return (t0) => {
          let d = (t0 ?? rnd()) * total, i = 0;
          while (d > lens[i] && i < lens.length - 1) { d -= lens[i]; i += 1; }
          const t = d / lens[i], a = poly[i], b = poly[i + 1];
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        };
      };
      const env = (x) => 0.78 + 0.22 * Math.cos((x / 0.9) * Math.PI * 0.5);
      const sweep = (fn) => () => {
        const x = R(-0.9, 0.9), e = env(x), [z, y] = fn();
        return [x, -0.62 + (y + 0.62) * e + J(0.015), z * (0.75 + 0.25 * e) + J(0.015)];
      };
      const b = line(back), f = line(face);
      return [
        [0.44, sweep(b)],
        [0.3, sweep(f)],
        [0.12, () => { const x = R(-0.9, 0.9), e = env(x); return [x, -0.62 + (R(-0.1, 0.25) + 0.62) * e, (0.95 + R(-0.06, 0.2)) * (0.75 + 0.25 * e)]; }],
        [0.07, () => [R(-0.9, 0.9), -0.63 + J(0.015), R(1.25, 1.7)]],
        [0.07, () => [R(-0.9, 0.9), -0.6 + J(0.015), R(-1.8, -1.3)]],
      ];
    },
  },
  /* Children's museum: a seedling climbing out of a lab beaker, a leaf per zone, a bud on top. */
  sprout: {
    yaw: 0.35, tilt: 0.14, size: 0.92,
    parts: () => {
      const rb = 0.52, yb0 = -1.0, yb1 = 0.18;
      const stem = (t) => {
        const p = [[0, -0.62, 0], [0.12, -0.1, 0.02], [-0.12, 0.45, -0.02], [0.02, 1.0, 0]];
        const u = 1 - t;
        return [0, 1, 2].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
      };
      const leaf = (t, side, len) => () => {
        const base = stem(t), s = rnd(), w = Math.sin(s * Math.PI) * 0.11 * len * (rnd() * 2 - 1);
        const dir = [side * Math.cos(0.5), Math.sin(0.5), 0.15 * side];
        const x = base[0] + dir[0] * s * len, y = base[1] + dir[1] * s * len - s * s * 0.12 * len, z = base[2] + dir[2] * s * len + w;
        return [x, y + w * 0.3, z];
      };
      return [
        [0.24, () => { const a = R(0, Math.PI * 2); return [rb * Math.cos(a), R(yb0, yb1), rb * Math.sin(a)]; }],
        [0.07, () => { const a = R(0, Math.PI * 2); return [(rb + 0.02) * Math.cos(a), yb1 + J(0.015), (rb + 0.02) * Math.sin(a)]; }],
        [0.05, () => { const a = R(0, Math.PI * 2), r = rb * Math.sqrt(rnd()); return [r * Math.cos(a), yb0, r * Math.sin(a)]; }],
        [0.05, () => { const a = R(0, Math.PI * 2), r = rb * Math.sqrt(rnd()); return [r * Math.cos(a), -0.15 + J(0.01), r * Math.sin(a)]; }],
        [0.14, () => { const p = stem(rnd()); return [p[0] + J(0.025), p[1], p[2] + J(0.025)]; }],
        [0.09, leaf(0.32, 1, 0.55)], [0.09, leaf(0.5, -1, 0.6)], [0.08, leaf(0.68, 1, 0.5)], [0.07, leaf(0.84, -1, 0.42)],
        [0.06, () => { const a = R(0, Math.PI * 2), b = R(0, Math.PI), r = 0.1 * Math.cbrt(rnd()); return [0.02 + r * Math.sin(b) * Math.cos(a), 1.06 + r * Math.cos(b) * 1.3, r * Math.sin(b) * Math.sin(a)]; }],
      ];
    },
  },
  /* Freight: a container ship, bays stacked one to three high, the bridge aft, a wake behind. */
  ship: {
    yaw: -0.42, tilt: 0.16, size: 1,
    parts: () => {
      const hull = () => {
        const x = R(-1.3, 1.32), side = rnd() < 0.5 ? -1 : 1, y = R(-0.56, -0.24);
        const half = x > 0.85 ? 0.22 * (1 - (x - 0.85) / 0.5) + 0.02 : 0.22;
        return [x, y, side * half * (0.82 + 0.18 * (y + 0.56) / 0.32)];
      };
      const deck = () => {
        const x = R(-1.3, 1.32), half = x > 0.85 ? 0.22 * (1 - (x - 0.85) / 0.5) + 0.02 : 0.22;
        return [x, -0.24, R(-half, half)];
      };
      const boxes = [];
      for (let b = 0; b < 10; b++) {
        const tiers = [2, 3, 3, 2, 3, 1, 3, 2, 3, 2][b];
        for (let row = 0; row < 2; row++) {
          for (let t = 0; t < tiers; t++) boxes.push([0.5 / 50, boxSurface([-0.9 + b * 0.185, -0.17 + t * 0.13, (row - 0.5) * 0.2], [0.17, 0.12, 0.19])]);
        }
      }
      return [
        [0.24, hull], [0.06, deck], ...boxes,
        [0.08, boxSurface([-1.14, 0.0, 0], [0.2, 0.46, 0.4])],
        [0.02, boxSurface([-1.2, 0.28, 0], [0.08, 0.14, 0.08])],
        [0.07, () => { const t = rnd(); return [-1.35 - t * 1.0, -0.56 + J(0.01), J(0.06 + t * 0.32)]; }],
      ];
    },
  },
  /* The logo: a serif capital M, thick and thin strokes, extruded into a slab of birds. */
  mark: {
    yaw: 0, tilt: 0.06, size: 1, sway: [0.62, 8], stray: 0.004,
    parts: () => {
      const stroke = (a, b, w) => () => {
        const t = rnd(), nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny), o = R(-w / 2, w / 2);
        return [a[0] + (b[0] - a[0]) * t + (nx / l) * o, a[1] + (b[1] - a[1]) * t + (ny / l) * o, R(-0.16, 0.16)];
      };
      const strokes = [
        [[-0.92, -1], [-0.92, 1], 0.2], [[-0.92, 1], [0, -0.62], 0.075],
        [[0, -0.62], [0.92, 1], 0.2], [[0.92, 1], [0.92, -1], 0.075],
        [[-1.14, -1], [-0.7, -1], 0.06], [[0.72, -1], [1.14, -1], 0.06],
      ];
      return strokes.map(([a, b, w]) => [Math.hypot(b[0] - a[0], b[1] - a[1]) * w, stroke(a, b, w)]);
    },
  },
  /* The still stand-in for a free flock: a stretched, folded cloud with uneven density. */
  cloud: {
    yaw: 0, tilt: 0, size: 1,
    parts: () => [[1, () => {
      for (;;) {
        const x = R(-1, 1), y = R(-1, 1), z = R(-1, 1);
        if (x * x + y * y + z * z > 1) continue;
        const d = 0.55 + 0.45 * Math.sin(x * 4.1 + 1.3) * Math.cos(y * 3.3 - 0.4) * Math.sin(z * 2.7 + x);
        if (rnd() > d) continue;
        return [x * 1.5, y * 0.55 + 0.32 * Math.sin(x * 2.2 + 0.6), z * 0.6];
      }
    }]],
  },
};

/* ---------- GLSL ---------- */

const NOISE = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
vec3 noise3(vec3 x) {
  return vec3(snoise(x), snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2)), snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4)));
}
vec3 curl(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0), dy = vec3(0.0, e, 0.0), dz = vec3(0.0, 0.0, e);
  vec3 x0 = noise3(p - dx), x1 = noise3(p + dx);
  vec3 y0 = noise3(p - dy), y1 = noise3(p + dy);
  vec3 z0 = noise3(p - dz), z1 = noise3(p + dz);
  vec3 c = vec3(y1.z - y0.z - z1.y + z0.y, z1.x - z0.x - x1.z + x0.z, x1.y - x0.y - y1.x + y0.x);
  return c / max(length(c), 1e-4);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

const SIM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tSrc, vUv); }
`;

const VEL_FRAG = /* glsl */ `
uniform sampler2D tPos, tVel, tA, tB;
uniform mat4 uMA, uMB;
uniform float uMix, uGather, uTime, uDt, uStray;
uniform vec3 uCenter, uRad;
uniform vec3 uFalcon;
uniform float uFear;
varying vec2 vUv;
${NOISE}
void main() {
  vec4 P = texture2D(tPos, vUv);
  vec3 p = P.xyz;
  vec3 v = texture2D(tVel, vUv).xyz;
  float r1 = hash(vUv * 1.37 + 0.11), r2 = hash(vUv * 2.91 + 0.2);
  float g = uGather * step(uStray, r2);
  vec3 desired = vec3(0.0);
  if (g < 0.999) {
    // Each bird keeps a loose place in the flock. The places drift on noise and turn
    // with a twist, so the flock stays full while it folds, stretches and wheels.
    vec3 h = vec3(hash(vUv * 3.7) * 2.0 - 1.0, hash(vUv * 5.3 + 0.4) * 2.0 - 1.0, hash(vUv * 7.1 + 0.9) * 2.0 - 1.0);
    h = normalize(h + 1e-4) * pow(hash(vUv * 9.7 + 0.3), 0.5);
    h += noise3(h * 0.8 + vec3(0.0, uTime * 0.11, uTime * 0.08)) * 0.5;
    float a = uTime * 0.16 + h.y * 0.9;
    h.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * h.xz;
    h.y *= 0.8;
    vec3 home = uCenter + h * uRad;
    vec3 q = (p - uCenter) / uRad;
    vec3 flow = curl(q * 0.55 + vec3(uTime * 0.05, uTime * 0.03, -uTime * 0.04));
    float pulse = 0.85 + 0.25 * sin(uTime * 0.9 + q.x * 2.4 + r1 * 0.6);
    desired = (flow * min(uRad.x, 6.0) * 0.32 + (home - p) * 1.3) * pulse * (1.0 - g);
  }
  if (g > 0.001) {
    vec3 ta = (uMA * vec4(texture2D(tA, vUv).xyz, 1.0)).xyz;
    vec3 tb = (uMB * vec4(texture2D(tB, vUv).xyz, 1.0)).xyz;
    float m = smoothstep(0.0, 1.0, clamp((uMix - r1 * 0.45) / 0.55, 0.0, 1.0));
    vec3 t = mix(ta, tb, m);
    t.y += sin(m * 3.14159) * 1.4 * (1.0 - step(0.999, uMix));
    t += curl(vec3(vUv * 9.0, uTime * 0.22)) * 0.03;
    vec3 seek = (t - p) * 3.8;
    float s = length(seek);
    if (s > 18.0) seek *= 18.0 / s;
    desired += seek * g;
  }
  // The pointer is a falcon: birds near it break away, then the flock closes again.
  vec2 away = p.xy - uFalcon.xy;
  float near = 1.0 - smoothstep(0.0, uFalcon.z, length(away));
  desired += vec3(normalize(away + 1e-4) * near * near * uFear * 14.0, 0.0);
  v = mix(v, desired, 1.0 - exp(-uDt * mix(2.2, 6.2, g)));
  gl_FragColor = vec4(v, 1.0);
}
`;

const POS_FRAG = /* glsl */ `
uniform sampler2D tPos, tVel, tB;
uniform mat4 uMB;
uniform float uDt, uSnap;
varying vec2 vUv;
void main() {
  vec4 P = texture2D(tPos, vUv);
  vec3 p = P.xyz + texture2D(tVel, vUv).xyz * uDt;
  if (uSnap > 0.5) p = (uMB * vec4(texture2D(tB, vUv).xyz, 1.0)).xyz;
  gl_FragColor = vec4(p, P.w);
}
`;

const BIRD_VERT = /* glsl */ `
uniform sampler2D tPos, tVel;
uniform float uTime, uSize;
attribute vec2 ref;
attribute float wing;
varying float vFog;
void main() {
  vec4 P = texture2D(tPos, ref);
  vec3 vel = texture2D(tVel, ref).xyz;
  float sp = length(vel);
  vec3 f = sp > 0.05 ? vel / sp : normalize(vec3(cos(P.w * 6.2831), 0.15, sin(P.w * 6.2831)));
  vec3 toCam = normalize(cameraPosition - P.xyz);
  vec3 up = normalize(vec3(0.0, 0.5, 0.0) + toCam * 0.6);
  vec3 r = cross(up, f);
  float rl = length(r);
  r = rl > 1e-3 ? r / rl : vec3(1.0, 0.0, 0.0);
  vec3 u = cross(f, r);
  vec3 l = position * uSize * (0.78 + 0.44 * fract(P.w * 7.31));
  float beat = 7.0 + min(sp, 10.0) * 1.2;
  l.y += wing * sin(uTime * beat + P.w * 6.2831) * uSize * 0.8;
  vec3 w = P.xyz + r * l.x + u * l.y + f * l.z;
  vec4 mv = modelViewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  vFog = smoothstep(30.0, 44.0, -mv.z);
}
`;

const BIRD_FRAG = /* glsl */ `
uniform vec3 uInk;
uniform float uAlpha;
varying float vFog;
void main() {
  float a = uAlpha * mix(0.92, 0.3, vFog);
  gl_FragColor = vec4(uInk * a, a);
}
`;

/* ---------- Run ---------- */

function start() {
  Object.assign(SHAPES, window.flockShapes || {}); // a page can add its own shapes (a logo, a word) before loading this module
  const small = Math.min(innerWidth, innerHeight) < 720 || !finePointer;
  const SIZE = small ? 40 : 64;
  const N = SIZE * SIZE;
  const counter = document.querySelector('[data-birds]');
  if (counter) counter.textContent = N.toLocaleString('en-US');

  const canvas = document.createElement('canvas');
  canvas.className = 'flock';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const FOV = 30, DIST = 34;
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, DIST);
  const scene = new THREE.Scene();

  /* Simulation targets: positions and velocities, ping-ponged. */
  const rtOpts = { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false };
  let pos = [new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts), new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts)];
  let vel = [new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts), new THREE.WebGLRenderTarget(SIZE, SIZE, rtOpts)];
  const simScene = new THREE.Scene();
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  simScene.add(quad);
  const pass = (material, out) => { quad.material = material; renderer.setRenderTarget(out); renderer.render(simScene, simCam); renderer.setRenderTarget(null); };

  const dataTex = (data) => { const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; };
  const copy = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: SIM_VERT, fragmentShader: COPY_FRAG });

  /* Shape point clouds, one texture each, built on demand. */
  const shapeTex = {};
  const textureFor = (name) => (shapeTex[name] ||= dataTex(sample(SHAPES[name].parts(), N)));

  /* Where things are on screen, in world units on the z = 0 plane. */
  const view = { h: 1, w: 1, px: 1 };
  function measure() {
    view.h = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    view.w = view.h * (innerWidth / innerHeight);
    view.px = view.h / innerHeight;
  }
  measure();
  // Screen pixels to the z = 0 plane, held within reach of the screen so the flock never flies off to a far anchor.
  const toWorld = (x, y) => new THREE.Vector3(
    (x / innerWidth - 0.5) * view.w,
    THREE.MathUtils.clamp((0.5 - y / innerHeight) * view.h, -view.h * 0.9, view.h * 0.9),
    0,
  );

  /* Initial flock: a loose cloud round the hero anchor. */
  const sections = [...document.querySelectorAll('[data-flock]')].map((el) => ({
    el, mode: el.dataset.flock, anchor: el.querySelector(el.dataset.flockAnchor || ':scope') || el,
  }));
  const firstRect = sections[0].anchor.getBoundingClientRect();
  const c0 = toWorld(firstRect.left + firstRect.width / 2, firstRect.top + firstRect.height / 2);
  const init = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), r = Math.cbrt(Math.random());
    init[i * 4] = c0.x + Math.sin(b) * Math.cos(a) * r * 5;
    init[i * 4 + 1] = c0.y + Math.cos(b) * r * 2.2;
    init[i * 4 + 2] = Math.sin(b) * Math.sin(a) * r * 2;
    init[i * 4 + 3] = Math.random();
  }
  copy.uniforms.tSrc.value = dataTex(init);
  pass(copy, pos[0]); pass(copy, pos[1]);
  copy.uniforms.tSrc.value = dataTex(new Float32Array(N * 4));
  pass(copy, vel[0]); pass(copy, vel[1]);

  const identity = new THREE.Matrix4();
  const velMat = new THREE.ShaderMaterial({
    uniforms: {
      tPos: { value: null }, tVel: { value: null }, tA: { value: textureFor('cloud') }, tB: { value: textureFor('cloud') },
      uMA: { value: identity.clone() }, uMB: { value: identity.clone() }, uMix: { value: 1 }, uGather: { value: 0 },
      uTime: { value: 0 }, uDt: { value: 0.016 }, uCenter: { value: c0.clone() }, uRad: { value: new THREE.Vector3(6, 2.5, 2.5) },
      uFalcon: { value: new THREE.Vector3(0, 999, 1.6) }, uFear: { value: 0 }, uStray: { value: 0.06 },
    },
    vertexShader: SIM_VERT, fragmentShader: VEL_FRAG,
  });
  const posMat = new THREE.ShaderMaterial({
    uniforms: { tPos: { value: null }, tVel: { value: null }, tB: velMat.uniforms.tB, uMB: velMat.uniforms.uMB, uDt: velMat.uniforms.uDt, uSnap: { value: 0 } },
    vertexShader: SIM_VERT, fragmentShader: POS_FRAG,
  });

  /* Birds: nine vertices each (a body and two wings whose tips beat). */
  const TPL = [
    [0, 0, 0.55, 0], [-0.07, 0, -0.45, 0], [0.07, 0, -0.45, 0],
    [0, 0, 0.18, 0], [0, 0, -0.2, 0], [-0.95, 0, -0.08, 1],
    [0, 0, 0.18, 0], [0.95, 0, -0.08, 1], [0, 0, -0.2, 0],
  ];
  const position = new Float32Array(N * 9 * 3), refs = new Float32Array(N * 9 * 2), wings = new Float32Array(N * 9);
  for (let i = 0; i < N; i++) {
    const u = ((i % SIZE) + 0.5) / SIZE, v = (Math.floor(i / SIZE) + 0.5) / SIZE;
    for (let k = 0; k < 9; k++) {
      const o = i * 9 + k;
      position.set(TPL[k].slice(0, 3), o * 3);
      refs[o * 2] = u; refs[o * 2 + 1] = v;
      wings[o] = TPL[k][3];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
  geometry.setAttribute('wing', new THREE.BufferAttribute(wings, 1));
  const css = getComputedStyle(root);
  const hex = css.getPropertyValue('--flock-ink').trim().replace('#', '');
  const cssInk = /^[0-9a-f]{6}$/i.test(hex) ? new THREE.Color(...[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)) : null;
  const cssSize = parseFloat(css.getPropertyValue('--flock-size')) || 0;
  const birdMat = new THREE.ShaderMaterial({
    uniforms: {
      tPos: { value: null }, tVel: { value: null }, uTime: { value: 0 }, uSize: { value: cssSize || (small ? 0.085 : 0.105) },
      uInk: { value: cssInk || new THREE.Color(0.085, 0.078, 0.105) }, uAlpha: { value: 1 },
    },
    vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const birds = new THREE.Mesh(geometry, birdMat);
  birds.frustumCulled = false;
  scene.add(birds);

  /* ---------- What the page asks for ---------- */
  const state = { active: null, shapeB: 'cloud', mixing: 1, center: c0.clone(), rad: new THREE.Vector3(6, 2.5, 2.5), gather: 0, place: { x: 0, y: 0, s: 3 } };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4(), tilt = new THREE.Matrix4(), scl = new THREE.Matrix4();

  function shapeMatrix(name, place, time, out) {
    const sh = SHAPES[name];
    const [amp, period] = sh.sway || [0.26, 29.92];
    const sway = reduce ? 0 : Math.sin((time * 2 * Math.PI) / period) * amp;
    rot.makeRotationY(sh.yaw + sway);
    tilt.makeRotationX(sh.tilt);
    scl.makeScale(place.s * sh.size, place.s * sh.size, place.s * sh.size);
    out.makeTranslation(place.x, place.y, 0).multiply(tilt).multiply(rot).multiply(scl);
    return out;
  }

  function choose(dt) {
    const vh = innerHeight;
    let best = null, bestScore = -1;
    // The nearest anchor to the middle of the screen wins; one the middle is inside scores 1.
    for (const s of sections) {
      const r = s.anchor.getBoundingClientRect();
      const mid = vh / 2;
      const dist = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
      s.rect = r;
      s.score = 1 / (1 + (dist / (vh * 0.3)) ** 2);
      if (s.score > bestScore) { best = s; bestScore = s.score; }
    }
    if (state.active && best !== state.active && bestScore < state.active.score + 0.05) best = state.active;
    const a = best;
    state.active = a;
    const r = a.rect;
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.5);
    if (a.mode === 'free') {
      const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      state.center.lerp(c, k);
      const rx = Math.min(Math.max(r.width * view.px * 0.36, 2.4), 8.5);
      const ry = Math.min(Math.max(r.height * view.px * 0.36, 1.3), 4);
      state.rad.lerp(new THREE.Vector3(rx, ry, Math.min(rx * 0.55, 3)), k);
      state.gather += ((reduce ? 1 : 0) - state.gather) * (reduce ? 1 : 1 - Math.exp(-dt * 2.5));
      setShape('cloud');
      const c2 = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      state.place = { x: c2.x, y: c2.y, s: Math.min(rx, ry * 2.6) * 0.9 };
    } else {
      const c = toWorld(r.left + r.width / 2, r.top + r.height * 0.34);
      const s = Math.min(r.height * 0.245, r.width * 0.33) * view.px;
      state.place = { x: c.x, y: c.y, s };
      state.center.lerp(c, k);
      const want = reduce ? 1 : THREE.MathUtils.smoothstep(a.score, 0.35, 0.85);
      state.gather += (want - state.gather) * (reduce ? 1 : 1 - Math.exp(-dt * 3));
      setShape(a.mode);
    }
  }

  function setShape(name) {
    if (name === state.shapeB) return;
    velMat.uniforms.tA.value = velMat.uniforms.tB.value;
    velMat.uniforms.uMA.value.copy(velMat.uniforms.uMB.value);
    velMat.uniforms.tB.value = textureFor(name);
    state.shapeB = name;
    state.mixing = 0;
  }

  /* ---------- Frame ---------- */
  let time = 0, last = performance.now(), started = false;

  function step(dt) {
    choose(dt);
    time += dt;
    state.mixing = Math.min(1, state.mixing + dt / 1.3);
    const u = velMat.uniforms;
    u.uTime.value = time; u.uDt.value = dt; u.uMix.value = reduce ? 1 : state.mixing; u.uGather.value = state.gather;
    u.uCenter.value.copy(state.center); u.uRad.value.copy(state.rad);
    u.uStray.value = SHAPES[state.shapeB].stray ?? 0.06; // the share of birds that never settle into the shape
    shapeMatrix(state.shapeB, state.place, time, u.uMB.value);
    if (reduce) {
      posMat.uniforms.uSnap.value = 1;
      posMat.uniforms.tPos.value = pos[0].texture; posMat.uniforms.tVel.value = vel[0].texture;
      pass(posMat, pos[1]);
      pos.reverse();
    } else {
      u.tPos.value = pos[0].texture; u.tVel.value = vel[0].texture;
      pass(velMat, vel[1]);
      vel.reverse();
      posMat.uniforms.tPos.value = pos[0].texture; posMat.uniforms.tVel.value = vel[0].texture;
      pass(posMat, pos[1]);
      pos.reverse();
    }
    u.uFear.value += ((pointer.moved ? 1 : 0) - u.uFear.value) * Math.min(1, dt * 4);
    pointer.moved = Math.max(0, (pointer.moved || 0) - dt * 0.8);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2);
    camera.position.set(pointer.x * 1.6, -pointer.y * 1.0, DIST);
    camera.lookAt(pointer.x * 0.6, -pointer.y * 0.4, 0);
    birdMat.uniforms.tPos.value = pos[0].texture;
    birdMat.uniforms.tVel.value = vel[0].texture;
    birdMat.uniforms.uTime.value = reduce ? 0 : time;
    birdMat.uniforms.uAlpha.value = reduce ? 1 : Math.min(1, time / 1.4);
    for (const s of sections) s.el.classList.toggle('gathered', s === state.active && s.mode !== 'free' && state.gather > 0.75 && (reduce || state.mixing > 0.8));
    renderer.render(scene, camera);
    if (!started) { started = true; root.classList.add('flock-on'); }
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    measure();
  }
  resize();
  addEventListener('resize', () => { resize(); if (reduce) step(0); });

  if (finePointer && !reduce) {
    addEventListener('pointermove', (e) => {
      pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5;
      const w = toWorld(e.clientX, e.clientY);
      velMat.uniforms.uFalcon.value.set(w.x, w.y, 1.7);
      pointer.moved = 1;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.moved = 0; });
  }

  if (reduce) {
    step(0);
    addEventListener('scroll', () => step(0), { passive: true });
  } else {
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

if (canRun()) {
  try { start(); } catch (err) {
    console.error(err);
    root.classList.add('no-flock');
    document.querySelector('canvas.flock')?.remove();
  }
} else {
  root.classList.add('no-flock');
}
