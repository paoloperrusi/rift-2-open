# RIFT Core Engine & Architecture Specification

> **Document Version:** 2.0.0  
> **Status:** Active / Source of Truth  
> **In-App Name:** RIFT  
> **Repository:** `paoloperrusi/rift-2-open`

---

## 1. Vision & Core Philosophy

RIFT was previously built as an exploratory prototype where rendering algorithms, DOM state, zoom math, icon SVGs, toolbar listeners, and modal management were tightly coupled into a single 4,200+ line monolithic file. That system proved the math and the aesthetic, but accumulated structural bloat.

**RIFT 2 Open** fundamentally decouples the system into two distinct layers:
1. **The Motor (`rift-core`)**: A pure, headless, deterministic, composable image synthesis and digital signal processing engine. It takes an input or generator state, routes it through an ordered chain of operations (Masks -> Transforms -> Effect Stacks), and outputs an execution buffer.
2. **The Interface (`rift-ui`)**: A focused, high-density, dark-themed control surface inspired by the best aspects of the legacy right-hand drawer, designed specifically around the natural creation workflow:  
   $$\text{Generate / Source} \longrightarrow \text{Effects \& Transformations}$$

### Core Tenets
- **Zero Bloat**: No redundant DOM wrappers, no conflicting state trackers, no monolithic spaghetti. The UI is a reactive projection of the engine's serializable pipeline recipe.
- **Complete Programmatic Controllability**: Every variable, range, threshold, toggle, and algorithm parameter is declared with strict schema metadata and is controllable via code, script, or UI.
- **Blast with Wild Effects & Generators**: Rather than generic filters, RIFT is loaded with radical, extreme procedural generators (spectral fields, reaction-diffusion, bytebeats, cellular automata, quantum glitch) and destructive DSP/glitch shaders (channel drift, pixel sorting, CRT cathode bloom, data-moshing, phase distortion).
- **Zero Hardcoded Presets — 100% User Ownership**: No immutable bundled presets cluttering the system. Users construct, randomize, save, tag, export, and import their own recipes.

---

## 2. The Motor: Pipeline Architecture

The motor executes operations as an immutable, deterministic directed pipeline:

```
[ STAGE 0: SOURCE / GENERATOR ]
  • External Bitmap (Upload, Drag-and-Drop, Clipboard)
  • Procedural Generator (Mathematical / Synthetic)
        │
        ▼ (Raw RGBA ImageData)
[ STAGE 1: MASKS ]
  • Global Alpha & Luminance Threshold Masks
  • Edge / Frequency Masks
  • Procedural Noise & Shape Isolators
        │
        ▼ (RGBA + Mask Buffer)
[ STAGE 2: GEOMETRY & TRANSFORM ]
  • Non-destructive Crop & Aspect Orientation
  • Rotation (90° Increments & Custom Angle)
  • Mirroring (Horizontal / Vertical Axis)
  • Resampling & Canvas Rescaling
        │
        ▼ (Transformed Geometry)
[ STAGE 3: EFFECT CHAIN (STACK) ]
  • Ordered array of Effect Passes [Pass 0 ... Pass N]
  • Per-pass Parameters, Blend Modes & Wet/Dry Mix
  • Per-pass Masking & Isolations
        │
        ▼ (Processed Pixels)
[ STAGE 4: COMPOSITE & OUTPUT ]
  • Viewport Pan/Zoom Canvas Renderer
  • Split-Screen Live Comparison Buffer
  • Full-Resolution Export Pipeline (PNG / WebP)
```

### Deterministic Pipeline Recipe Schema
The engine state is completely serializable to a JSON recipe:

```json
{
  "version": "2.0",
  "source": {
    "type": "generator",
    "id": "spectral_drift",
    "params": { "freq": 4.2, "octaves": 3 },
    "dimensions": { "width": 1200, "height": 800 }
  },
  "geometry": {
    "crop": null,
    "rotation": 0,
    "flipH": false,
    "flipV": false,
    "fillMode": "black"
  },
  "effects": [
    {
      "id": "scanline_tear",
      "enabled": true,
      "opacity": 0.85,
      "blendMode": "normal",
      "maskMode": "none",
      "params": { "freq": 14, "jitter": 0.3 }
    }
  ]
}
```

---

## 3. Parameter Schema & Controllability Contract

Every generator and effect registered in RIFT Core must adhere to the **Controllability Contract**:

```typescript
interface ParamDefinition {
  key: string;
  label: string;
  type: "float" | "int" | "bool" | "enum" | "color";
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: any }>;
  unit?: string;
  description?: string;
}
```

### Engine API Methods
- `engine.loadSource(image | generatorId, params?)`
- `engine.setGeometry(geometryConfig)`
- `engine.addEffect(effectId, params?, atIndex?)`
- `engine.removeEffect(index)`
- `engine.reorderEffect(fromIndex, toIndex)`
- `engine.setEffectParam(effectIndex, paramKey, value)`
- `engine.execute(): Promise<ImageData>`
- `engine.exportRecipe(): RiftRecipe`
- `engine.loadRecipe(recipe: RiftRecipe): Promise<void>`

---

## 4. Blast of Wild Generators & Effects

RIFT's identity is defined by unrestrained, high-impact algorithmic manipulation.

### A. Procedural Generators
1. **Bytebeat Fracture**: Low-level 8-bit mathematical formula audio/visual bitwise bytebeat synthesis mapped to spatial RGBA planes.
2. **Quantum Glitch Field**: High-entropy cellular entropy lattice with bit-shifting color noise and stochastic phase jumps.
3. **Spectral Plasma Drift**: Multi-frequency interference equations rendering glowing chromatic wavefields.
4. **Reaction-Diffusion Turing Mesh**: Morphogenesis simulation of activator-inhibitor chemicals forming organic leopard spots, fingerprints, and labyrinthine coral patterns.
5. **CRT Cathode Ray Matrix**: Phosphor triad simulation with sub-pixel scan raster, moire fringing, and magnetic distortion.
6. **Voronoi Crystal Fracture**: Multi-metric distance cell decomposition with customizable Minkowski distance exponents and crystalline borders.
7. **Simplex Topography**: Fractal Brownian Motion (fBM) elevation contours with isoline thresholds.

### B. Effects & Transformations Stack
1. **Pixel Sort & Data Mosh**: Directional luminance/hue sorting with dynamic thresholding and streak clamping.
2. **Scanline Tear & Tracking Jitter**: Analog VHS sync failure with horizontal line displacement and tape wrinkle noise.
3. **Chromatic Aberration & Spectral Warp**: Independent radial and linear RGB channel splitting with lens dispersion.
4. **Phosphor Bleed & Cathode Bloom**: Emissive color bleed along horizontal scan lines simulating analog CRT bloom.
5. **Bit Crusher & Channel Quantizer**: Bit-depth reduction (1-bit to 8-bit per channel) with threshold dither.
6. **Optical Glass Dispersion**: Refractive normal warping simulating cracked glass, water droplets, and caustic lens facets.
7. **Edge Convolution Matrix**: Laplace, Sobel, Prewitt, and custom convolution kernel filtering.

---

## 5. UI Architecture: The Control Surface

Inspired by the clean ergonomics of the legacy sidebar while eliminating monolithic overhead:

1. **Header Bar**:
   - Application logo (`RIFT`), canvas dimension badges, active zoom badge, undo/redo buttons, recipe export/import, and final render/download.
2. **Left / Center Viewport**:
   - High-performance canvas with infinite panning and smooth mouse-wheel zooming (1% up to 4000%).
   - Integrated Split-View comparison mode (`orig`, `result`, `split` slider).
   - On-canvas crop box with live aspect-ratio locking and orientation toggle.
3. **Right Control Deck**:
   - **Tab 1: Source / Generators**: Image dropzone, procedural generator selector, and generator parameter bank.
   - **Tab 2: Geometry & Transform**: Quick transform (90° rotations, mirror flip H/V), custom angle rotator with border fill, and precision resizer.
   - **Tab 3: Effects Stack**: The pedalboard chain. Add, reorder, toggle, adjust, and mask individual effect modules.
   - **Tab 4: Presets**: User-saved recipes bank with instant live preview thumbnails, JSON download, and direct sharing.

---

## 6. Implementation Milestones

- [x] **Milestone 0**: Convert legacy repositories (`rift` -> `rift_legacy`, `fractal_garden` -> `fractal_garden_legacy`), deploy legacy GitHub Pages, and initialize `rift-2-open`.
- [ ] **Milestone 1**: Implement pure, zero-dependency `rift-core` engine (Pipeline runner, geometry transforms, parameter contract).
- [ ] **Milestone 2**: Build the extensive generator library (Bytebeats, Turing, Voronoi, Spectral, CRT) and effect suite (Pixel sort, Scanline tear, RGB split, Bitcrusher).
- [ ] **Milestone 3**: Build the sleek, modular UI (`rift-ui`) with the reactive recipe store, live viewport, and user preset manager.
- [ ] **Milestone 4**: Deploy to GitHub Pages (`https://paoloperrusi.github.io/rift-2-open/`) and link in portfolio.
