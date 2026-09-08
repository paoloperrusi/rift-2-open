# RIFT 🌀⚡

> **High-Performance Procedural Image Synthesis & Glitch Engine**

RIFT is a client-side digital signal processing engine for generative imagery, non-destructive optical/geometric manipulation, and creative digital glitch synthesis.

- **Live Web App:** [https://paoloperrusi.github.io/rift-2-open/](https://paoloperrusi.github.io/rift-2-open/)
- **Legacy Build:** [https://paoloperrusi.github.io/rift_legacy/](https://paoloperrusi.github.io/rift_legacy/)
- **Engineering Specification:** See [`ENGINEERING.md`](./ENGINEERING.md)

---

## ⚙️ Architecture: The Motor

RIFT operates as a headless, deterministic signal processing pipeline:
$$\text{Source / Generator} \longrightarrow \text{Masks} \longrightarrow \text{Geometric Transforms} \longrightarrow \text{Effect Stack} \longrightarrow \text{Composite}$$

- **Controllable Schema:** Every algorithm exposes typed parameter definitions with min, max, step, and unit.
- **Zero Monolithic Bloat:** Decoupled engine core from lightweight control surfaces.
- **User-Owned Recipes:** No rigid built-in presets; create, randomize, save, and share your own recipes as portable JSON.

---

## 🛠️ Local Development

Open `index.html` directly in any modern browser or run a static local server:
```bash
npx serve .
```
