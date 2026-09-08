/**
 * RIFT Core - The Motor Engine
 * Headless, deterministic pipeline runner.
 */

import { GENERATORS } from './generators.js';
import { EFFECTS } from './effects.js';
import { applyCrop, applyFlip, applyRotate, applyResize, copyImageData, createBlankImageData } from './transforms.js';

export class RiftEngine {
  constructor() {
    this.source = {
      type: 'generator',      // 'generator' | 'image'
      id: 'spectral_plasma',
      params: { freq: 3.5, complexity: 4, speed: 1.8 },
      image: null,            // HTMLImageElement or ImageData when type === 'image'
      width: 800,
      height: 600
    };

    this.geometry = {
      crop: null,             // { x, y, width, height }
      rotation: 0,            // Degrees (-360 to 360)
      flipH: false,
      flipV: false,
      fillMode: 'black',
      targetWidth: 800,
      targetHeight: 600,
      lockAspectRatio: true
    };

    this.effects = [
      {
        id: 'scanline_tear',
        enabled: true,
        opacity: 0.8,
        blendMode: 'normal',
        params: { jitter: 16, frequency: 0.12, sliceHeight: 6 }
      },
      {
        id: 'chromatic_aberration',
        enabled: true,
        opacity: 1.0,
        blendMode: 'normal',
        params: { offsetX: 6, offsetY: 0, channel: 'rb' }
      }
    ];

    // Pipeline outputs
    this.originalBuffer = null; // Unaltered generated/source image
    this.geometryBuffer = null; // After geometry/transforms
    this.resultBuffer = null;   // Final output after effect stack

    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event, data) {
    for (const fn of this.listeners) {
      try { fn(event, data); } catch (e) { console.error('RiftEngine listener error:', e); }
    }
  }

  // --- Source Management ---

  setGenerator(id, params = {}) {
    if (!GENERATORS[id]) throw new Error(`Unknown generator: ${id}`);
    const gen = GENERATORS[id];
    const defaultParams = {};
    for (const p of gen.params) {
      const k = p.key || p.id;
      defaultParams[k] = p.default !== undefined ? p.default : p.def;
    }

    this.source = {
      type: 'generator',
      id,
      params: { ...defaultParams, ...params },
      image: null,
      width: this.source.width || 800,
      height: this.source.height || 600
    };
    return this.render();
  }

  setGeneratorParam(key, value) {
    if (this.source.type !== 'generator') return Promise.resolve();
    this.source.params[key] = value;
    return this.render();
  }

  setImage(imgElement, width, height) {
    this.source = {
      type: 'image',
      id: null,
      params: {},
      image: imgElement,
      width: width || imgElement.naturalWidth || 800,
      height: height || imgElement.naturalHeight || 600
    };
    this.geometry.targetWidth = this.source.width;
    this.geometry.targetHeight = this.source.height;
    return this.render();
  }

  // --- Geometry Management ---

  setCrop(rect) {
    this.geometry.crop = rect ? { ...rect } : null;
    return this.render();
  }

  setRotation(deg) {
    this.geometry.rotation = ((deg % 360) + 360) % 360;
    return this.render();
  }

  stepRotate(deltaDeg) {
    return this.setRotation(this.geometry.rotation + deltaDeg);
  }

  toggleFlip(axis = 'h') {
    if (axis === 'h') this.geometry.flipH = !this.geometry.flipH;
    else this.geometry.flipV = !this.geometry.flipV;
    return this.render();
  }

  setResize(width, height) {
    this.geometry.targetWidth = Math.max(1, Math.round(width));
    this.geometry.targetHeight = Math.max(1, Math.round(height));
    return this.render();
  }

  // --- Effect Stack Management ---

  addEffect(id, params = {}) {
    if (!EFFECTS[id]) throw new Error(`Unknown effect: ${id}`);
    const eff = EFFECTS[id];
    const defaultParams = {};
    for (const p of eff.params) {
      const k = p.key || p.id;
      defaultParams[k] = p.default !== undefined ? p.default : p.def;
    }

    this.effects.push({
      id,
      enabled: true,
      opacity: 1.0,
      blendMode: 'normal',
      params: { ...defaultParams, ...params }
    });
    return this.render();
  }

  removeEffect(index) {
    if (index >= 0 && index < this.effects.length) {
      this.effects.splice(index, 1);
      return this.render();
    }
    return Promise.resolve();
  }

  toggleEffect(index) {
    if (this.effects[index]) {
      this.effects[index].enabled = !this.effects[index].enabled;
      return this.render();
    }
    return Promise.resolve();
  }

  setEffectParam(index, key, value) {
    if (this.effects[index]) {
      this.effects[index].params[key] = value;
      return this.render();
    }
    return Promise.resolve();
  }

  setEffectOpacity(index, opacity) {
    if (this.effects[index]) {
      this.effects[index].opacity = Math.max(0, Math.min(1, opacity));
      return this.render();
    }
    return Promise.resolve();
  }

  reorderEffect(fromIdx, toIdx) {
    if (fromIdx >= 0 && fromIdx < this.effects.length && toIdx >= 0 && toIdx < this.effects.length) {
      const [item] = this.effects.splice(fromIdx, 1);
      this.effects.splice(toIdx, 0, item);
      return this.render();
    }
    return Promise.resolve();
  }

  // --- Blending Utilities ---

  blendBuffers(base, layer, opacity, mode = 'normal') {
    if (opacity <= 0) return base;
    const out = copyImageData(base);
    const bd = out.data;
    const ld = layer.data;
    const len = bd.length;

    for (let i = 0; i < len; i += 4) {
      const br = bd[i], bg = bd[i + 1], bb = bd[i + 2];
      const lr = ld[i], lg = ld[i + 1], lb = ld[i + 2];

      let r = lr, g = lg, b = lb;
      if (mode === 'screen') {
        r = 255 - (((255 - br) * (255 - lr)) >> 8);
        g = 255 - (((255 - bg) * (255 - lg)) >> 8);
        b = 255 - (((255 - bb) * (255 - lb)) >> 8);
      } else if (mode === 'multiply') {
        r = (br * lr) >> 8;
        g = (bg * lg) >> 8;
        b = (bb * lb) >> 8;
      } else if (mode === 'difference') {
        r = Math.abs(br - lr);
        g = Math.abs(bg - lg);
        b = Math.abs(bb - lb);
      } else if (mode === 'add') {
        r = Math.min(255, br + lr);
        g = Math.min(255, bg + lg);
        b = Math.min(255, bb + lb);
      }

      bd[i] = Math.round(br * (1 - opacity) + r * opacity);
      bd[i + 1] = Math.round(bg * (1 - opacity) + g * opacity);
      bd[i + 2] = Math.round(bb * (1 - opacity) + b * opacity);
    }
    return out;
  }

  // --- The Core Pipeline Runner ---

  async render() {
    this.notify('render:start');

    // 1. Stage 0: Source Generation / Extraction
    let base;
    if (this.source.type === 'generator') {
      const gen = GENERATORS[this.source.id] || Object.values(GENERATORS)[0];
      base = gen.generate(this.source.width, this.source.height, this.source.params);
    } else if (this.source.type === 'image' && this.source.image) {
      const c = document.createElement('canvas');
      c.width = this.source.width;
      c.height = this.source.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(this.source.image, 0, 0, c.width, c.height);
      base = ctx.getImageData(0, 0, c.width, c.height);
    } else {
      base = createBlankImageData(800, 600);
    }

    this.originalBuffer = base;

    // 2. Stage 1 & 2: Geometric Transformations
    let geom = copyImageData(base);

    if (this.geometry.crop) {
      geom = applyCrop(geom, this.geometry.crop);
    }
    if (this.geometry.rotation !== 0) {
      geom = applyRotate(geom, this.geometry.rotation, this.geometry.fillMode);
    }
    if (this.geometry.flipH) {
      geom = applyFlip(geom, 'h');
    }
    if (this.geometry.flipV) {
      geom = applyFlip(geom, 'v');
    }
    if (this.geometry.targetWidth !== geom.width || this.geometry.targetHeight !== geom.height) {
      geom = applyResize(geom, this.geometry.targetWidth, this.geometry.targetHeight);
    }

    this.geometryBuffer = geom;

    // 3. Stage 3: Effect Stack Pipeline
    let processed = copyImageData(geom);

    for (const effInstance of this.effects) {
      if (!effInstance.enabled) continue;
      const effDef = EFFECTS[effInstance.id];
      if (!effDef) continue;

      const layer = effDef.apply(processed, effInstance.params);
      processed = this.blendBuffers(processed, layer, effInstance.opacity, effInstance.blendMode);
    }

    this.resultBuffer = processed;
    this.notify('render:complete', {
      original: this.originalBuffer,
      geometry: this.geometryBuffer,
      result: this.resultBuffer
    });

    return this.resultBuffer;
  }

  // --- Recipe & Presets Serialization ---

  exportRecipe(name = 'Untitled Recipe') {
    return {
      version: '2.0',
      name,
      createdAt: new Date().toISOString(),
      source: {
        type: this.source.type,
        id: this.source.id,
        params: { ...this.source.params },
        width: this.source.width,
        height: this.source.height
      },
      geometry: {
        crop: this.geometry.crop ? { ...this.geometry.crop } : null,
        rotation: this.geometry.rotation,
        flipH: this.geometry.flipH,
        flipV: this.geometry.flipV,
        fillMode: this.geometry.fillMode,
        targetWidth: this.geometry.targetWidth,
        targetHeight: this.geometry.targetHeight,
        lockAspectRatio: this.geometry.lockAspectRatio
      },
      effects: this.effects.map(e => ({
        id: e.id,
        enabled: e.enabled,
        opacity: e.opacity,
        blendMode: e.blendMode,
        params: { ...e.params }
      }))
    };
  }

  async loadRecipe(recipe) {
    if (!recipe || recipe.version !== '2.0') throw new Error('Incompatible recipe version');

    if (recipe.source.type === 'generator') {
      this.source = {
        type: 'generator',
        id: recipe.source.id,
        params: { ...recipe.source.params },
        image: null,
        width: recipe.source.width || 800,
        height: recipe.source.height || 600
      };
    }

    this.geometry = {
      crop: recipe.geometry.crop ? { ...recipe.geometry.crop } : null,
      rotation: recipe.geometry.rotation || 0,
      flipH: !!recipe.geometry.flipH,
      flipV: !!recipe.geometry.flipV,
      fillMode: recipe.geometry.fillMode || 'black',
      targetWidth: recipe.geometry.targetWidth || 800,
      targetHeight: recipe.geometry.targetHeight || 600,
      lockAspectRatio: recipe.geometry.lockAspectRatio ?? true
    };

    this.effects = (recipe.effects || []).map(e => ({
      id: e.id,
      enabled: e.enabled ?? true,
      opacity: e.opacity ?? 1.0,
      blendMode: e.blendMode || 'normal',
      params: { ...e.params }
    }));

    return this.render();
  }
}
