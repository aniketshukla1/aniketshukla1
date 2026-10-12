// Helpers for the profile art: turn a picture (a logo's pixels, or a word drawn on a canvas) into
// a shape the flock gathers into, place the page's anchor so flock.js draws it where we want,
// and fly a falcon (a scripted pointer) through it on a fixed loop so recordings repeat exactly.

/** Draw on a canvas and keep every other pixel that passes `keep(r, g, b, a)`. */
export function sampleCanvas(draw, w, h, keep) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (keep(d[i], d[i + 1], d[i + 2], d[i + 3])) pts.push(x, y);
    }
  }
  return pts;
}

/** Sample an image file's pixels (same origin) the same way. */
export async function sampleImage(src, size, keep) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return sampleCanvas((g) => g.drawImage(img, 0, 0, size, size), size, size, keep);
}

/** A flock.js shape from sampled pixels: centred on their bounds, the longer side spanning -1..1. */
export function shapeFrom(pts, { depth = 0.06, yaw = 0, tilt = 0.04, sway = [0.3, 8], stray = 0.01 } = {}) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.max(x1 - x0, y1 - y0) / 2;
  const n = pts.length / 2;
  return {
    yaw, tilt, size: 1, sway, stray,
    parts: () => [[1, () => {
      const k = Math.floor(Math.random() * n) * 2;
      return [
        (pts[k] - cx + Math.random() * 2 - 1) / half,
        -(pts[k + 1] - cy + Math.random() * 2 - 1) / half,
        (Math.random() * 2 - 1) * depth,
      ];
    }]],
  };
}

/**
 * flock.js draws a shape at (anchor centre x, anchor top + 0.34 x height) with half-size
 * min(0.245 x height, 0.33 x width). Size the anchor so the shape lands on (cx, cy) with half-size s.
 */
export function placeAnchor(el, cx, cy, s) {
  const h = s / 0.245, w = s / 0.33;
  Object.assign(el.style, { position: 'absolute', left: `${cx - w / 2}px`, top: `${cy - 0.34 * h}px`, width: `${w}px`, height: `${h}px` });
}

/**
 * Every `loop` ms a falcon crosses from `from` to `to` (fractions of the viewport) in `pass` ms; otherwise
 * it waits at `park`, centred below the frame so the camera does not lean to one side.
 */
export function falcon({ loop, at, pass, from, to, park = [0.5, 1.2] }) {
  const tick = (now) => {
    const phase = now % loop;
    const t = phase >= at && phase <= at + pass ? (phase - at) / pass : -1;
    const [fx, fy] = from, [tx, ty] = to;
    const x = t < 0 ? park[0] : fx + (tx - fx) * t;
    const y = t < 0 ? park[1] : fy + (ty - fy) * t;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x * innerWidth, clientY: y * innerHeight }));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** A night sky's stars, drawn once into an element's background. */
export function stars(el, count, seed = 7) {
  const c = document.createElement('canvas');
  c.width = innerWidth;
  c.height = innerHeight;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const r = rnd() < 0.08 ? 1.6 : rnd() < 0.4 ? 1.1 : 0.7;
    g.fillStyle = `rgba(255, 244, 228, ${0.25 + rnd() * 0.6})`;
    g.beginPath();
    g.arc(rnd() * c.width, rnd() * c.height * 0.9, r, 0, Math.PI * 2);
    g.fill();
  }
  el.style.backgroundImage = `url(${c.toDataURL()})`;
}
