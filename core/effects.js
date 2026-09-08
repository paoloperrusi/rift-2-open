/**
 * RIFT Core - Effects & DSP Stack
 * High-impact algorithmic glitch, signal processing, and destruction shaders.
 */

import { copyImageData } from './transforms.js';

export const EFFECTS = {
  pixel_sort: {
    id: 'pixel_sort',
    name: 'Pixel Sort & Data Mosh',
    category: 'glitch',
    description: 'Directional luminance interval sorting creating falling digital streaks and moshed slices.',
    params: [
      { key: 'direction', label: 'Sort Axis', type: 'enum', default: 'horizontal', options: [
        { label: 'Horizontal', value: 'horizontal' },
        { label: 'Vertical', value: 'vertical' }
      ]},
      { key: 'thresholdLow', label: 'Threshold Min', type: 'float', default: 0.25, min: 0.0, max: 1.0, step: 0.05 },
      { key: 'thresholdHigh', label: 'Threshold Max', type: 'float', default: 0.85, min: 0.0, max: 1.0, step: 0.05 },
      { key: 'reverse', label: 'Invert Sorting', type: 'bool', default: false }
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const w = src.width, h = src.height;
      const dir = p.direction || 'horizontal';
      const tLow = (p.thresholdLow ?? 0.25) * 255;
      const tHigh = (p.thresholdHigh ?? 0.85) * 255;
      const rev = !!p.reverse;

      function getLuma(idx) {
        return d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114;
      }

      if (dir === 'horizontal') {
        for (let y = 0; y < h; y++) {
          let rowStart = y * w;
          let x = 0;
          while (x < w) {
            let idx = (rowStart + x) * 4;
            let luma = getLuma(idx);
            if (luma >= tLow && luma <= tHigh) {
              let startX = x;
              while (x < w) {
                let checkIdx = (rowStart + x) * 4;
                let cLuma = getLuma(checkIdx);
                if (cLuma < tLow || cLuma > tHigh) break;
                x++;
              }
              let spanLen = x - startX;
              if (spanLen > 1) {
                let pixels = [];
                for (let sx = 0; sx < spanLen; sx++) {
                  let pIdx = (rowStart + startX + sx) * 4;
                  pixels.push({
                    r: d[pIdx], g: d[pIdx + 1], b: d[pIdx + 2], a: d[pIdx + 3],
                    luma: getLuma(pIdx)
                  });
                }
                pixels.sort((a, b) => rev ? b.luma - a.luma : a.luma - b.luma);
                for (let sx = 0; sx < spanLen; sx++) {
                  let pIdx = (rowStart + startX + sx) * 4;
                  d[pIdx] = pixels[sx].r;
                  d[pIdx + 1] = pixels[sx].g;
                  d[pIdx + 2] = pixels[sx].b;
                  d[pIdx + 3] = pixels[sx].a;
                }
              }
            } else {
              x++;
            }
          }
        }
      } else {
        for (let x = 0; x < w; x++) {
          let y = 0;
          while (y < h) {
            let idx = (y * w + x) * 4;
            let luma = getLuma(idx);
            if (luma >= tLow && luma <= tHigh) {
              let startY = y;
              while (y < h) {
                let checkIdx = (y * w + x) * 4;
                let cLuma = getLuma(checkIdx);
                if (cLuma < tLow || cLuma > tHigh) break;
                y++;
              }
              let spanLen = y - startY;
              if (spanLen > 1) {
                let pixels = [];
                for (let sy = 0; sy < spanLen; sy++) {
                  let pIdx = ((startY + sy) * w + x) * 4;
                  pixels.push({
                    r: d[pIdx], g: d[pIdx + 1], b: d[pIdx + 2], a: d[pIdx + 3],
                    luma: getLuma(pIdx)
                  });
                }
                pixels.sort((a, b) => rev ? b.luma - a.luma : a.luma - b.luma);
                for (let sy = 0; sy < spanLen; sy++) {
                  let pIdx = ((startY + sy) * w + x) * 4;
                  d[pIdx] = pixels[sy].r;
                  d[pIdx + 1] = pixels[sy].g;
                  d[pIdx + 2] = pixels[sy].b;
                  d[pIdx + 3] = pixels[sy].a;
                }
              }
            } else {
              y++;
            }
          }
        }
      }
      return out;
    }
  },

  scanline_tear: {
    id: 'scanline_tear',
    name: 'Scanline Tear & Tracking',
    category: 'analog',
    description: 'Analog VHS sync disruption, horizontal displacement jitter, and scanline slicing.',
    params: [
      { key: 'jitter', label: 'Tear Displacement', type: 'int', default: 24, min: 0, max: 120, step: 2 },
      { key: 'frequency', label: 'Tear Probability', type: 'float', default: 0.15, min: 0.01, max: 0.6, step: 0.01 },
      { key: 'sliceHeight', label: 'Band Height', type: 'int', default: 6, min: 1, max: 40, step: 1 }
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const sData = src.data;
      const w = src.width, h = src.height;
      const jitterMax = p.jitter ?? 24;
      const prob = p.frequency ?? 0.15;
      const bandH = Math.max(1, p.sliceHeight || 6);

      let currentShift = 0;
      for (let y = 0; y < h; y++) {
        if (y % bandH === 0) {
          currentShift = (Math.random() < prob) ? Math.floor((Math.random() - 0.5) * jitterMax * 2) : 0;
        }
        if (currentShift !== 0) {
          for (let x = 0; x < w; x++) {
            const srcX = Math.min(w - 1, Math.max(0, x + currentShift));
            const dstIdx = (y * w + x) * 4;
            const srcIdx = (y * w + srcX) * 4;
            d[dstIdx] = sData[srcIdx];
            d[dstIdx + 1] = sData[srcIdx + 1];
            d[dstIdx + 2] = sData[srcIdx + 2];
          }
        }
      }
      return out;
    }
  },

  chromatic_aberration: {
    id: 'chromatic_aberration',
    name: 'Chromatic Aberration',
    category: 'optical',
    description: 'RGB channel displacement simulating prism refraction, lens dispersion, and phase splitting.',
    params: [
      { key: 'offsetX', label: 'Horizontal Split', type: 'int', default: 8, min: -50, max: 50, step: 1 },
      { key: 'offsetY', label: 'Vertical Split', type: 'int', default: 0, min: -50, max: 50, step: 1 },
      { key: 'channel', label: 'Splitting Channels', type: 'enum', default: 'rb', options: [
        { label: 'Red / Blue Shift', value: 'rb' },
        { label: 'Red / Green Shift', value: 'rg' },
        { label: 'Cyan / Magenta Drift', value: 'cm' }
      ]}
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const sData = src.data;
      const w = src.width, h = src.height;
      const ox = p.offsetX ?? 8;
      const oy = p.offsetY ?? 0;
      const mode = p.channel || 'rb';

      for (let y = 0; y < h; y++) {
        const ry = Math.min(h - 1, Math.max(0, y + oy));
        const by = Math.min(h - 1, Math.max(0, y - oy));
        for (let x = 0; x < w; x++) {
          const rx = Math.min(w - 1, Math.max(0, x + ox));
          const bx = Math.min(w - 1, Math.max(0, x - ox));

          const dstIdx = (y * w + x) * 4;
          const rIdx = (ry * w + rx) * 4;
          const bIdx = (by * w + bx) * 4;

          if (mode === 'rb') {
            d[dstIdx] = sData[rIdx];         // Red shifted forward
            d[dstIdx + 2] = sData[bIdx + 2]; // Blue shifted backward
          } else if (mode === 'rg') {
            d[dstIdx] = sData[rIdx];
            d[dstIdx + 1] = sData[bIdx + 1];
          } else {
            d[dstIdx] = Math.floor((sData[rIdx] + sData[bIdx]) * 0.5);
            d[dstIdx + 2] = sData[rIdx + 2];
          }
        }
      }
      return out;
    }
  },

  phosphor_bloom: {
    id: 'phosphor_bloom',
    name: 'Phosphor Bleed & Bloom',
    category: 'analog',
    description: 'Analog cathode ray horizontal beam emission bleeding light across high-contrast contours.',
    params: [
      { key: 'bleedLength', label: 'Bleed Length', type: 'int', default: 16, min: 2, max: 60, step: 2 },
      { key: 'decay', label: 'Decay Falloff', type: 'float', default: 0.85, min: 0.5, max: 0.98, step: 0.02 },
      { key: 'tint', label: 'Phosphor Tint', type: 'enum', default: 'cyan', options: [
        { label: 'Cyan / Electric Blue', value: 'cyan' },
        { label: 'Classic Amber', value: 'amber' },
        { label: 'Terminal Green', value: 'green' }
      ]}
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const sData = src.data;
      const w = src.width, h = src.height;
      const bleed = p.bleedLength || 16;
      const decay = p.decay ?? 0.85;
      const tint = p.tint || 'cyan';

      let tr = 0.6, tg = 1.0, tb = 1.0;
      if (tint === 'amber') { tr = 1.0; tg = 0.7; tb = 0.2; }
      else if (tint === 'green') { tr = 0.3; tg = 1.0; tb = 0.3; }

      for (let y = 0; y < h; y++) {
        let accR = 0, accG = 0, accB = 0;
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          accR = accR * decay + sData[idx] * (1 - decay);
          accG = accG * decay + sData[idx + 1] * (1 - decay);
          accB = accB * decay + sData[idx + 2] * (1 - decay);

          d[idx] = Math.min(255, Math.floor(sData[idx] + accR * tr));
          d[idx + 1] = Math.min(255, Math.floor(sData[idx + 1] + accG * tg));
          d[idx + 2] = Math.min(255, Math.floor(sData[idx + 2] + accB * tb));
        }
      }
      return out;
    }
  },

  bit_crusher: {
    id: 'bit_crusher',
    name: 'Bit Crusher & Slicer',
    category: 'destruction',
    description: 'Severe depth quantization, bit-depth crushing, and posterized dither slicing.',
    params: [
      { key: 'bits', label: 'Color Depth (Bits)', type: 'int', default: 3, min: 1, max: 7, step: 1 },
      { key: 'dither', label: 'Bayer Dithering', type: 'bool', default: true }
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const w = src.width, h = src.height;
      const bits = Math.max(1, Math.min(7, p.bits || 3));
      const levels = 1 << bits;
      const step = 255 / (levels - 1);
      const useDither = !!p.dither;

      const bayer4x4 = [
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
      ];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const ditherVal = useDither ? (bayer4x4[y % 4][x % 4] / 16.0 - 0.5) * step : 0;

          d[idx] = Math.min(255, Math.max(0, Math.round((d[idx] + ditherVal) / step) * step));
          d[idx + 1] = Math.min(255, Math.max(0, Math.round((d[idx + 1] + ditherVal) / step) * step));
          d[idx + 2] = Math.min(255, Math.max(0, Math.round((d[idx + 2] + ditherVal) / step) * step));
        }
      }
      return out;
    }
  },

  optical_dispersion: {
    id: 'optical_dispersion',
    name: 'Optical Glass Dispersion',
    category: 'optical',
    description: 'Wave refractance and lens dispersion warping pixel coordinates like cracked glass.',
    params: [
      { key: 'strength', label: 'Refraction Strength', type: 'float', default: 22.0, min: 1.0, max: 80.0, step: 1.0 },
      { key: 'scale', label: 'Caustic Frequency', type: 'float', default: 0.04, min: 0.01, max: 0.15, step: 0.01 }
    ],
    apply(src, p) {
      const out = copyImageData(src);
      const d = out.data;
      const sData = src.data;
      const w = src.width, h = src.height;
      const str = p.strength || 22.0;
      const scale = p.scale || 0.04;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = Math.sin(y * scale) * Math.cos(x * scale * 0.7) * str;
          const dy = Math.cos(x * scale) * Math.sin(y * scale * 0.8) * str;

          const sx = Math.min(w - 1, Math.max(0, Math.round(x + dx)));
          const sy = Math.min(h - 1, Math.max(0, Math.round(y + dy)));

          const dstIdx = (y * w + x) * 4;
          const srcIdx = (sy * w + sx) * 4;
          d[dstIdx] = sData[srcIdx];
          d[dstIdx + 1] = sData[srcIdx + 1];
          d[dstIdx + 2] = sData[srcIdx + 2];
        }
      }
      return out;
    }
  }
};
