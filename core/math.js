/**
 * RIFT Core - Mathematical Primitives & Color Science
 * Comprehensive mathematical toolset: trigonometric transforms, fractals, complex analysis,
 * procedural noise, bilinear interpolation, convolution kernels, and perceptual color models.
 */

export function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function clamp(v, lo = 0, hi = 255) {
  return Math.max(lo, Math.min(hi, v));
}

export function hsl2rgb(h, s, l) {
  h = (h % 360 + 360) % 360;
  h /= 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx === r) h = ((g - b) / d + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function px(d, w, h, x, y) {
  x = Math.max(0, Math.min(w - 1, Math.round(x)));
  y = Math.max(0, Math.min(h - 1, Math.round(y)));
  const i = (y * w + x) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

export function bl(d, w, h, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const [r0, g0, b0] = px(d, w, h, x0, y0);
  const [r1, g1, b1] = px(d, w, h, x0 + 1, y0);
  const [r2, g2, b2] = px(d, w, h, x0, y0 + 1);
  const [r3, g3, b3] = px(d, w, h, x0 + 1, y0 + 1);
  return [
    r0 + (r1 - r0) * fx + (r2 - r0) * fy + (r0 - r1 - r2 + r3) * fx * fy,
    g0 + (g1 - g0) * fx + (g2 - g0) * fy + (g0 - g1 - g2 + g3) * fx * fy,
    b0 + (b1 - b0) * fx + (b2 - b0) * fy + (b0 - b1 - b2 + b3) * fx * fy
  ];
}

export function sp(d, w, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= w || y < 0) return;
  const i = (y * w + x) * 4;
  d[i] = clamp(r);
  d[i + 1] = clamp(g);
  d[i + 2] = clamp(b);
  d[i + 3] = a;
}

export function mkId(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c.getContext('2d').createImageData(c.width, c.height);
}

export function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function hash(x, y, s = 0) {
  let n = x * 374761393 + y * 668265263 + s * 2246822519;
  n = (n ^ (n >>> 15)) * 2246822519;
  n = (n ^ (n >>> 13)) * 3266489917;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x, y, oct = 4, per = 0.5, sc = 1, s = 0) {
  let v = 0, a = 1, f = sc, mx = 0;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, s) * a;
    mx += a;
    a *= per;
    f *= 2;
  }
  return v / mx;
}

// Complex number arithmetic
export function c_mul(r1, i1, r2, i2) {
  return [r1 * r2 - i1 * i2, r1 * i2 + i1 * r2];
}

export function c_div(r1, i1, r2, i2) {
  const d = r2 * r2 + i2 * i2 || 1e-9;
  return [(r1 * r2 + i1 * i2) / d, (i1 * r2 - r1 * i2) / d];
}

export function c_exp(r, i) {
  const er = Math.exp(r);
  return [er * Math.cos(i), er * Math.sin(i)];
}

export function mobius(zr, zi, a, b, c, d) {
  const num = [a * zr + b, a * zi];
  const den = [c * zr + d, c * zi];
  return c_div(num[0], num[1], den[0], den[1]);
}

// Polar coordinate mapping
export function toPolar(x, y, cx, cy) {
  const dx = x - cx, dy = y - cy;
  return {
    r: Math.sqrt(dx * dx + dy * dy),
    theta: Math.atan2(dy, dx)
  };
}

export function fromPolar(r, theta, cx, cy) {
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta)
  };
}

// Palettes
export const PALETTES = [
  // 0: Heat
  (t) => {
    const v = t * 4;
    if (v < 1) return [Math.floor(v * 255), 0, 0];
    if (v < 2) return [255, Math.floor((v - 1) * 255), 0];
    if (v < 3) return [255, 255, Math.floor((v - 2) * 255)];
    return [255, 255, 255];
  },
  // 1: Cyber Blue/Cyan
  (t) => [Math.floor(t * 40), Math.floor(80 + t * 120), Math.floor(160 + t * 95)],
  // 2: Full Spectrum Rainbow
  (t) => hsl2rgb(t * 360, 1, 0.5),
  // 3: Monochrome
  (t) => {
    const v = Math.floor(t * 255);
    return [v, v, v];
  },
  // 4: Fire/Amber
  (t) => {
    const r = clamp(Math.floor(t * 3 * 255));
    const g = clamp(Math.max(0, Math.floor((t - 0.33) * 3 * 255)));
    const b = clamp(Math.max(0, Math.floor((t - 0.67) * 3 * 255)));
    return [r, g, b];
  },
  // 5: Synthwave Violet/Purple
  (t) => hsl2rgb((t * 240 + 220) % 360, 0.8, 0.55),
  // 6: Acid Green/Yellow
  (t) => {
    const h = t < 0.5 ? t * 60 : 60 + (t - 0.5) * 120 + 60;
    return hsl2rgb(h % 360, 1, 0.5);
  },
  // 7: Electric Neon Pink/Cyan (One Lab inspired)
  (t) => [
    Math.floor(Math.sin(t * Math.PI * 2) * 127 + 128),
    Math.floor(Math.sin(t * Math.PI * 2 + 2.094) * 127 + 128),
    Math.floor(Math.sin(t * Math.PI * 2 + 4.188) * 127 + 128)
  ]
];
