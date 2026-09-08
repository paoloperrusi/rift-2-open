/**
 * RIFT Core - Procedural Generators Suite
 * Wild, extreme mathematical and algorithmic pattern generators.
 */

import { createBlankImageData } from './transforms.js';

export const GENERATORS = {
  bytebeat_fracture: {
    id: 'bytebeat_fracture',
    name: 'Bytebeat Fracture',
    category: 'algorithmic',
    description: 'Low-level 8-bit mathematical bitwise bytebeat synthesis mapped to 2D RGBA planes.',
    params: [
      { key: 'formula', label: 'Formula', type: 'enum', default: 0, options: [
        { label: 'Alien Harmony: t*(t>>8|t>>9)&46', value: 0 },
        { label: 'Bit Shifter: (t>>7|t|t>>6)*10', value: 1 },
        { label: 'Fracture Wave: (t*5&t>>7)|(t*3&t>>10)', value: 2 },
        { label: 'Cyber Pulse: ((t>>4)*(t>>8))&((t>>12)*(t>>6))', value: 3 }
      ]},
      { key: 'scale', label: 'Spatial Scale', type: 'float', default: 1.0, min: 0.1, max: 5.0, step: 0.1 },
      { key: 'speed', label: 'Phase Shift', type: 'float', default: 42.0, min: 0.0, max: 500.0, step: 1.0 },
      { key: 'colorMode', label: 'Palette', type: 'enum', default: 'neon', options: [
        { label: 'Neon Cyber', value: 'neon' },
        { label: 'Phosphor Green', value: 'phosphor' },
        { label: 'Thermal Heat', value: 'thermal' },
        { label: 'Monochrome Glitch', value: 'mono' }
      ]}
    ],
    generate(w, h, p) {
      const img = createBlankImageData(w, h);
      const d = img.data;
      const formula = parseInt(p.formula, 10) || 0;
      const scale = p.scale || 1.0;
      const tShift = Math.floor(p.speed || 42);
      const pal = p.colorMode || 'neon';

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = Math.floor((x * scale + y * scale * w + tShift)) & 0xFFFFFF;
          let val = 0;
          if (formula === 0) val = ((t * (t >> 8 | t >> 9) & 46 & (t >> 8)) ^ (t & (t >> 13 | t >> 6))) & 0xFF;
          else if (formula === 1) val = ((t >> 7 | t | t >> 6) * 10 + ((t & 4096) ? (t >> 4) : 0)) & 0xFF;
          else if (formula === 2) val = ((t * 5 & t >> 7) | (t * 3 & t >> 10)) & 0xFF;
          else val = (((t >> 4) * (t >> 8)) & ((t >> 12) * (t >> 6))) & 0xFF;

          const idx = (y * w + x) * 4;
          if (pal === 'neon') {
            d[idx] = (val * 3) & 0xFF;
            d[idx + 1] = (val * 7) & 0xFF;
            d[idx + 2] = (val * 11 + 128) & 0xFF;
          } else if (pal === 'phosphor') {
            d[idx] = (val >> 2);
            d[idx + 1] = val;
            d[idx + 2] = (val >> 1);
          } else if (pal === 'thermal') {
            d[idx] = Math.min(255, val * 2);
            d[idx + 1] = Math.max(0, 255 - Math.abs(val - 128) * 2);
            d[idx + 2] = Math.max(0, 255 - val * 2);
          } else {
            d[idx] = val;
            d[idx + 1] = val;
            d[idx + 2] = val;
          }
          d[idx + 3] = 255;
        }
      }
      return img;
    }
  },

  quantum_glitch: {
    id: 'quantum_glitch',
    name: 'Quantum Glitch Lattice',
    category: 'glitch',
    description: 'Cellular entropy field with non-linear bit-shifting XOR noise and phase collapses.',
    params: [
      { key: 'entropy', label: 'Entropy Level', type: 'float', default: 0.65, min: 0.05, max: 1.0, step: 0.05 },
      { key: 'blockSize', label: 'Block Lattice', type: 'int', default: 16, min: 2, max: 64, step: 2 },
      { key: 'chromaSplit', label: 'Chroma Dispersion', type: 'float', default: 0.8, min: 0.0, max: 2.0, step: 0.1 },
      { key: 'seed', label: 'Entropy Seed', type: 'int', default: 1337, min: 1, max: 99999, step: 1 }
    ],
    generate(w, h, p) {
      const img = createBlankImageData(w, h);
      const d = img.data;
      const entropy = p.entropy ?? 0.65;
      const bSize = Math.max(2, p.blockSize || 16);
      const chroma = p.chromaSplit ?? 0.8;
      const seed = p.seed || 1337;

      function hash(n) {
        let x = Math.sin(n) * 43758.5453123;
        return x - Math.floor(x);
      }

      for (let by = 0; by < h; by += bSize) {
        for (let bx = 0; bx < w; bx += bSize) {
          const bIdx = Math.floor(by / bSize) * Math.ceil(w / bSize) + Math.floor(bx / bSize);
          const blockRand = hash(bIdx + seed);

          if (blockRand < entropy) {
            const rOffset = Math.floor(hash(bIdx * 3 + seed) * 12 * chroma);
            const gOffset = Math.floor(hash(bIdx * 5 + seed) * 8);
            const bOffset = Math.floor(hash(bIdx * 7 + seed) * 16 * chroma);

            for (let y = by; y < Math.min(h, by + bSize); y++) {
              for (let x = bx; x < Math.min(w, bx + bSize); x++) {
                const idx = (y * w + x) * 4;
                const pattern = ((x ^ y) * 13 + bIdx * 17) & 0xFF;
                d[idx] = (pattern + rOffset * 15) & 0xFF;
                d[idx + 1] = (pattern ^ (gOffset * 22)) & 0xFF;
                d[idx + 2] = (pattern + bOffset * 19 + 50) & 0xFF;
                d[idx + 3] = 255;
              }
            }
          } else {
            const baseShade = Math.floor(blockRand * 30);
            for (let y = by; y < Math.min(h, by + bSize); y++) {
              for (let x = bx; x < Math.min(w, bx + bSize); x++) {
                const idx = (y * w + x) * 4;
                d[idx] = baseShade;
                d[idx + 1] = baseShade;
                d[idx + 2] = baseShade + 6;
                d[idx + 3] = 255;
              }
            }
          }
        }
      }
      return img;
    }
  },

  spectral_plasma: {
    id: 'spectral_plasma',
    name: 'Spectral Plasma Drift',
    category: 'synthesis',
    description: 'Multi-frequency trigonometric interference equations with radiant chromatic drift.',
    params: [
      { key: 'freq', label: 'Frequency', type: 'float', default: 3.5, min: 0.5, max: 15.0, step: 0.1 },
      { key: 'complexity', label: 'Harmonics', type: 'int', default: 4, min: 1, max: 8, step: 1 },
      { key: 'speed', label: 'Drift Phase', type: 'float', default: 1.8, min: 0.0, max: 10.0, step: 0.1 }
    ],
    generate(w, h, p) {
      const img = createBlankImageData(w, h);
      const d = img.data;
      const freq = (p.freq || 3.5) / 100;
      const harmonics = p.complexity || 4;
      const phase = p.speed || 1.8;

      for (let y = 0; y < h; y++) {
        const ny = y * freq;
        for (let x = 0; x < w; x++) {
          const nx = x * freq;
          let v1 = Math.sin(nx + phase);
          let v2 = Math.sin(ny + phase * 0.7);
          let v3 = Math.sin((nx + ny) + phase * 1.3);
          let v4 = Math.sin(Math.sqrt(nx * nx + ny * ny + 1.0) + phase * 1.5);

          for (let k = 2; k <= harmonics; k++) {
            v1 += (1 / k) * Math.sin(nx * k + phase);
            v2 += (1 / k) * Math.sin(ny * k - phase);
          }

          const val = (v1 + v2 + v3 + v4) / (2 + harmonics * 0.5);
          const norm = (val + 1) * 0.5;

          const idx = (y * w + x) * 4;
          d[idx] = Math.floor(Math.sin(norm * Math.PI * 2) * 127 + 128);
          d[idx + 1] = Math.floor(Math.sin(norm * Math.PI * 2 + 2.094) * 127 + 128);
          d[idx + 2] = Math.floor(Math.sin(norm * Math.PI * 2 + 4.188) * 127 + 128);
          d[idx + 3] = 255;
        }
      }
      return img;
    }
  },

  reaction_diffusion: {
    id: 'reaction_diffusion',
    name: 'Turing Morphogenesis',
    category: 'simulation',
    description: 'Reaction-diffusion Turing pattern simulation generating organic cellular and coral labyrinths.',
    params: [
      { key: 'patternType', label: 'Preset Structure', type: 'enum', default: 'coral', options: [
        { label: 'Coral Labyrinth', value: 'coral' },
        { label: 'Leopard Spots', value: 'spots' },
        { label: 'Pulsating Cells', value: 'cells' }
      ]},
      { key: 'scale', label: 'Resolution Density', type: 'int', default: 3, min: 1, max: 6, step: 1 },
      { key: 'steps', label: 'Simulation Iterations', type: 'int', default: 60, min: 20, max: 150, step: 10 }
    ],
    generate(w, h, p) {
      const simScale = p.scale || 3;
      const sw = Math.max(16, Math.floor(w / simScale));
      const sh = Math.max(16, Math.floor(h / simScale));
      const size = sw * sh;

      let u = new Float32Array(size).fill(1.0);
      let v = new Float32Array(size).fill(0.0);
      let uNext = new Float32Array(size);
      let vNext = new Float32Array(size);

      // Seed center disturb
      for (let y = Math.floor(sh * 0.4); y < Math.floor(sh * 0.6); y++) {
        for (let x = Math.floor(sw * 0.4); x < Math.floor(sw * 0.6); x++) {
          if (Math.random() < 0.4) {
            const idx = y * sw + x;
            u[idx] = 0.5 + Math.random() * 0.1;
            v[idx] = 0.25 + Math.random() * 0.1;
          }
        }
      }

      let F = 0.0545, K = 0.062; // Coral
      if (p.patternType === 'spots') { F = 0.035; K = 0.065; }
      else if (p.patternType === 'cells') { F = 0.025; K = 0.055; }

      const Du = 0.2097, Dv = 0.105;
      const steps = p.steps || 60;

      for (let s = 0; s < steps; s++) {
        for (let y = 1; y < sh - 1; y++) {
          const row = y * sw;
          for (let x = 1; x < sw - 1; x++) {
            const i = row + x;
            const lapU = u[i - 1] + u[i + 1] + u[i - sw] + u[i + sw] - 4 * u[i];
            const lapV = v[i - 1] + v[i + 1] + v[i - sw] + v[i + sw] - 4 * v[i];
            const uvv = u[i] * v[i] * v[i];
            uNext[i] = u[i] + (Du * lapU - uvv + F * (1.0 - u[i]));
            vNext[i] = v[i] + (Dv * lapV + uvv - (F + K) * v[i]);
          }
        }
        u.set(uNext);
        v.set(vNext);
      }

      // Render to target ImageData
      const img = createBlankImageData(w, h);
      const d = img.data;

      for (let y = 0; y < h; y++) {
        const sy = Math.min(sh - 1, Math.floor(y / simScale));
        for (let x = 0; x < w; x++) {
          const sx = Math.min(sw - 1, Math.floor(x / simScale));
          const val = Math.max(0, Math.min(1, v[sy * sw + sx] * 3.5));
          const idx = (y * w + x) * 4;
          d[idx] = Math.floor(val * 108);
          d[idx + 1] = Math.floor(val * 92);
          d[idx + 2] = Math.floor(val * 231);
          d[idx + 3] = 255;
        }
      }
      return img;
    }
  },

  crt_matrix: {
    id: 'crt_matrix',
    name: 'CRT Cathode Ray Matrix',
    category: 'analog',
    description: 'Sub-pixel RGB phosphor triad raster matrix with magnetic curvature and beam bloom.',
    params: [
      { key: 'dotPitch', label: 'Phosphor Dot Pitch', type: 'int', default: 4, min: 2, max: 12, step: 1 },
      { key: 'scanIntensity', label: 'Scanline Depth', type: 'float', default: 0.7, min: 0.1, max: 1.0, step: 0.05 },
      { key: 'bloom', label: 'Beam Glow', type: 'float', default: 1.2, min: 0.5, max: 2.5, step: 0.1 }
    ],
    generate(w, h, p) {
      const img = createBlankImageData(w, h);
      const d = img.data;
      const pitch = p.dotPitch || 4;
      const scanDepth = p.scanIntensity ?? 0.7;
      const bloom = p.bloom || 1.2;

      for (let y = 0; y < h; y++) {
        const scan = (y % pitch === 0) ? (1 - scanDepth) : 1.0;
        for (let x = 0; x < w; x++) {
          const sub = (x % 3);
          const idx = (y * w + x) * 4;
          const base = 210 * scan * bloom;
          d[idx] = sub === 0 ? Math.min(255, base) : Math.floor(base * 0.15);
          d[idx + 1] = sub === 1 ? Math.min(255, base) : Math.floor(base * 0.15);
          d[idx + 2] = sub === 2 ? Math.min(255, base) : Math.floor(base * 0.15);
          d[idx + 3] = 255;
        }
      }
      return img;
    }
  },

  voronoi_crystals: {
    id: 'voronoi_crystals',
    name: 'Voronoi Crystal Fracture',
    category: 'geometric',
    description: 'Cellular crystal lattice decomposition using configurable distance metrics.',
    params: [
      { key: 'cells', label: 'Cell Count', type: 'int', default: 35, min: 5, max: 150, step: 5 },
      { key: 'metric', label: 'Distance Metric', type: 'enum', default: 'euclidean', options: [
        { label: 'Euclidean (Smooth)', value: 'euclidean' },
        { label: 'Manhattan (Diamond)', value: 'manhattan' },
        { label: 'Chebyshev (Square)', value: 'chebyshev' }
      ]},
      { key: 'edgeGlow', label: 'Border Highlighting', type: 'float', default: 1.0, min: 0.0, max: 3.0, step: 0.2 }
    ],
    generate(w, h, p) {
      const img = createBlankImageData(w, h);
      const d = img.data;
      const count = p.cells || 35;
      const metric = p.metric || 'euclidean';
      const edge = p.edgeGlow ?? 1.0;

      // Deterministic points
      const pts = [];
      for (let i = 0; i < count; i++) {
        const px = Math.sin(i * 12.9898 + 4.14) * 0.5 + 0.5;
        const py = Math.cos(i * 78.233 + 7.51) * 0.5 + 0.5;
        pts.push({
          x: px * w,
          y: py * h,
          r: Math.floor(Math.sin(i * 3.1) * 100 + 150),
          g: Math.floor(Math.sin(i * 7.7) * 80 + 100),
          b: Math.floor(Math.cos(i * 5.2) * 110 + 140)
        });
      }

      function dist(x1, y1, x2, y2) {
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        if (metric === 'manhattan') return dx + dy;
        if (metric === 'chebyshev') return Math.max(dx, dy);
        return Math.sqrt(dx * dx + dy * dy);
      }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let d1 = Infinity, d2 = Infinity;
          let closest = pts[0];

          for (let i = 0; i < pts.length; i++) {
            const di = dist(x, y, pts[i].x, pts[i].y);
            if (di < d1) {
              d2 = d1;
              d1 = di;
              closest = pts[i];
            } else if (di < d2) {
              d2 = di;
            }
          }

          const borderDist = d2 - d1;
          const borderFactor = Math.min(1.0, borderDist / 8.0 * edge);

          const idx = (y * w + x) * 4;
          d[idx] = Math.floor(closest.r * borderFactor);
          d[idx + 1] = Math.floor(closest.g * borderFactor);
          d[idx + 2] = Math.floor(closest.b * borderFactor);
          d[idx + 3] = 255;
        }
      }
      return img;
    }
  }
};
