/**
 * RIFT UI - Control Deck
 * Sleek, high-density control deck: Generate/Source -> Geometry -> Effects Stack -> Presets.
 */

import { GENERATORS } from '../core/generators.js';
import { EFFECTS } from '../core/effects.js';

export class RiftControlDeck {
  constructor(deckContainerEl, engine, store, viewport) {
    this.container = deckContainerEl;
    this.engine = engine;
    this.store = store;
    this.viewport = viewport;

    this.activeTab = 'source'; // 'source' | 'geometry' | 'effects' | 'presets'
    this.render();

    this.engine.subscribe((ev) => {
      if (ev === 'render:complete') {
        this.updateHeaderStats();
        if (this.activeTab === 'effects') this.renderEffectsList();
      }
    });
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="deck-tabs">
        <button class="deck-tab ${this.activeTab === 'source' ? 'active' : ''}" data-tab="source">Source</button>
        <button class="deck-tab ${this.activeTab === 'geometry' ? 'active' : ''}" data-tab="geometry">Geometry</button>
        <button class="deck-tab ${this.activeTab === 'effects' ? 'active' : ''}" data-tab="effects">Effects <span class="badge-count">${this.engine.effects.filter(e => e.enabled).length}</span></button>
        <button class="deck-tab ${this.activeTab === 'presets' ? 'active' : ''}" data-tab="presets">Presets</button>
      </div>
      <div class="deck-body" id="deck-body"></div>
    `;

    this.container.querySelectorAll('.deck-tab').forEach(b => {
      b.onclick = () => this.setTab(b.dataset.tab);
    });

    const body = document.getElementById('deck-body');
    if (this.activeTab === 'source') this.renderSourceTab(body);
    else if (this.activeTab === 'geometry') this.renderGeometryTab(body);
    else if (this.activeTab === 'effects') this.renderEffectsTab(body);
    else if (this.activeTab === 'presets') this.renderPresetsTab(body);
  }

  // -------------------------------------------------------------
  // TAB 1: SOURCE / GENERATORS
  // -------------------------------------------------------------
  renderSourceTab(body) {
    const isGen = this.engine.source.type === 'generator';
    const currentGen = GENERATORS[this.engine.source.id] || Object.values(GENERATORS)[0];

    body.innerHTML = `
      <div class="deck-section">
        <div class="section-title">Image Source</div>
        <div class="source-mode-selector">
          <button class="btn sm ${isGen ? 'acc' : ''}" id="btn-src-gen">Procedural Generator</button>
          <button class="btn sm ${!isGen ? 'acc' : ''}" id="btn-src-upload">Bitmap Upload</button>
        </div>

        ${isGen ? `
          <div class="param-row" style="margin-top: 10px;">
            <label class="param-label">Generator</label>
            <select class="deck-select" id="gen-picker">
              ${Object.values(GENERATORS).map(g => `
                <option value="${g.id}" ${g.id === currentGen.id ? 'selected' : ''}>${g.name}</option>
              `).join('')}
            </select>
          </div>
          <p class="deck-hint">${currentGen.description}</p>
          <div class="gen-params-stack" id="gen-params-stack"></div>
        ` : `
          <div class="upload-dropzone" id="upload-dropzone" style="margin-top: 10px;">
            <div class="dropzone-icon">⇪</div>
            <div class="dropzone-text">Click or drop an image file here</div>
            <input type="file" id="file-input" accept="image/*" style="display:none;" />
          </div>
        `}
      </div>

      <div class="deck-section">
        <div class="section-title">Base Resolution</div>
        <div class="dims-grid">
          <div class="dim-input-box">
            <span class="dim-label">W</span>
            <input class="deck-input num" type="number" id="base-w" value="${this.engine.source.width}" min="64" max="16384" />
          </div>
          <div class="dim-input-box">
            <span class="dim-label">H</span>
            <input class="deck-input num" type="number" id="base-h" value="${this.engine.source.height}" min="64" max="16384" />
          </div>
          <button class="btn sm" id="btn-apply-dims">Resize</button>
        </div>
      </div>
    `;

    // Events
    const btnGen = document.getElementById('btn-src-gen');
    const btnUp = document.getElementById('btn-src-upload');
    if (btnGen) btnGen.onclick = () => {
      this.store.recordAction('Switch to Generator');
      this.engine.setGenerator('spectral_plasma');
      this.render();
    };
    if (btnUp) btnUp.onclick = () => {
      document.getElementById('file-input')?.click();
    };

    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); };
      dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
      };
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) this.handleFile(e.target.files[0]);
      };
    }

    const genPicker = document.getElementById('gen-picker');
    if (genPicker) {
      genPicker.onchange = (e) => {
        this.store.recordAction(`Change Generator to ${e.target.value}`);
        this.engine.setGenerator(e.target.value);
        this.render();
      };
    }

    // Render generator parameters
    if (isGen) {
      const pStack = document.getElementById('gen-params-stack');
      this.renderParamControls(currentGen.params, this.engine.source.params, pStack, (k, val) => {
        this.engine.setGeneratorParam(k, val);
      });
    }

    // Base dimensions resize
    const btnDims = document.getElementById('btn-apply-dims');
    if (btnDims) {
      btnDims.onclick = () => {
        const w = parseInt(document.getElementById('base-w').value, 10);
        const h = parseInt(document.getElementById('base-h').value, 10);
        if (w > 0 && h > 0) {
          this.store.recordAction(`Set Base Dimensions ${w}x${h}`);
          this.engine.source.width = w;
          this.engine.source.height = h;
          this.engine.render();
          this.viewport.zoomFit();
        }
      };
    }
  }

  handleFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      this.store.recordAction(`Load Image: ${file.name}`);
      this.engine.setImage(img, img.naturalWidth, img.naturalHeight);
      this.render();
      this.viewport.zoomFit();
    };
    img.src = url;
  }

  // -------------------------------------------------------------
  // TAB 2: GEOMETRY & TRANSFORMS
  // -------------------------------------------------------------
  renderGeometryTab(body) {
    const geom = this.engine.geometry;

    body.innerHTML = `
      <div class="deck-section">
        <div class="section-title">Quick Transform</div>
        <div class="quick-transform-grid">
          <button class="btn sm" id="btn-rot-ccw" title="Rotate 90° CCW">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.5A5.5 5.5 0 1 1 8 13.5M2.5 3.5v4h4"/></svg>
            <span>-90°</span>
          </button>
          <button class="btn sm" id="btn-rot-cw" title="Rotate 90° CW">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 7.5A5.5 5.5 0 1 0 8 13.5M13.5 3.5v4h-4"/></svg>
            <span>+90°</span>
          </button>
          <button class="btn sm" id="btn-flip-h" title="Flip Horizontal (Mirror X)">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="1.5" x2="8" y2="14.5" stroke-dasharray="2 1.5" opacity="0.45"/>
              <path d="M6 3.5L1.5 8l4.5 4.5V3.5z"/>
              <path d="M10 3.5L14.5 8l-4.5 4.5V3.5z" fill="currentColor" fill-opacity="0.25"/>
            </svg>
            <span>flip H</span>
          </button>
          <button class="btn sm" id="btn-flip-v" title="Flip Vertical (Mirror Y)">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="1.5" y1="8" x2="14.5" y2="8" stroke-dasharray="2 1.5" opacity="0.45"/>
              <path d="M3.5 6L8 1.5l4.5 4.5H3.5z"/>
              <path d="M3.5 10L8 14.5l4.5-4.5H3.5z" fill="currentColor" fill-opacity="0.25"/>
            </svg>
            <span>flip V</span>
          </button>
        </div>

        <div class="section-title" style="margin-top: 14px;">Custom Angle</div>
        <div class="flex-row gap-5">
          <div class="dim-input-box" style="width: 80px;">
            <span class="dim-label">∠</span>
            <input class="deck-input num" type="number" id="custom-angle" value="${geom.rotation}" min="-360" max="360" />
            <span class="dim-label">°</span>
          </div>
          <select class="deck-select" id="custom-fill" style="flex:1;">
            <option value="black" ${geom.fillMode === 'black' ? 'selected' : ''}>Black Fill</option>
            <option value="white" ${geom.fillMode === 'white' ? 'selected' : ''}>White Fill</option>
            <option value="wrap" ${geom.fillMode === 'wrap' ? 'selected' : ''}>Wrap Edge</option>
          </select>
          <button class="btn sm acc" id="btn-apply-angle">Apply</button>
        </div>
      </div>

      <div class="deck-section">
        <div class="section-title">Crop Tool</div>
        <div class="flex-row gap-5">
          <select class="deck-select" id="crop-ratio-sel" style="flex:1;">
            <option value="0">Freeform</option>
            <option value="1">1:1 Square</option>
            <option value="1.7778">16:9 Landscape</option>
            <option value="1.3333">4:3 Classic</option>
            <option value="1.5">3:2 Standard</option>
            <option value="0.707">A4 Document</option>
          </select>
          <button class="btn sm icon-btn" id="btn-crop-swap" title="Swap Orientation (⇄)">⇄</button>
          <button class="btn sm ${this.viewport.isCropActive ? 'acc' : ''}" id="btn-toggle-crop">
            ${this.viewport.isCropActive ? 'Active' : 'Draw Crop'}
          </button>
        </div>
        ${this.viewport.isCropActive ? `
          <div class="flex-row gap-5" style="margin-top: 8px;">
            <button class="btn sm acc" id="btn-commit-crop" style="flex:1;">✓ Commit (Enter)</button>
            <button class="btn sm ghost" id="btn-cancel-crop">✕ Cancel (Esc)</button>
          </div>
        ` : ''}
      </div>

      <div class="deck-section">
        <div class="section-title">Resample Canvas</div>
        <div class="dims-grid">
          <div class="dim-input-box">
            <span class="dim-label">W</span>
            <input class="deck-input num" type="number" id="resize-w" value="${geom.targetWidth}" />
          </div>
          <div class="dim-input-box">
            <span class="dim-label">H</span>
            <input class="deck-input num" type="number" id="resize-h" value="${geom.targetHeight}" />
          </div>
          <button class="btn sm" id="btn-do-resize">Resample</button>
        </div>
        <label class="checkbox-label" style="margin-top: 8px;">
          <input type="checkbox" id="chk-lock-aspect" ${geom.lockAspectRatio ? 'checked' : ''} />
          <span>Lock Aspect Ratio</span>
        </label>
      </div>
    `;

    // Quick Transform listeners
    document.getElementById('btn-rot-ccw').onclick = () => {
      this.store.recordAction('Rotate -90°');
      this.engine.stepRotate(-90);
      this.viewport.zoomFit();
    };
    document.getElementById('btn-rot-cw').onclick = () => {
      this.store.recordAction('Rotate +90°');
      this.engine.stepRotate(90);
      this.viewport.zoomFit();
    };
    document.getElementById('btn-flip-h').onclick = () => {
      this.store.recordAction('Flip Horizontal');
      this.engine.toggleFlip('h');
    };
    document.getElementById('btn-flip-v').onclick = () => {
      this.store.recordAction('Flip Vertical');
      this.engine.toggleFlip('v');
    };

    // Custom angle
    document.getElementById('btn-apply-angle').onclick = () => {
      const angle = parseFloat(document.getElementById('custom-angle').value) || 0;
      this.engine.geometry.fillMode = document.getElementById('custom-fill').value;
      this.store.recordAction(`Rotate ${angle}°`);
      this.engine.setRotation(angle);
      this.viewport.zoomFit();
    };

    // Crop listeners
    const btnToggleCrop = document.getElementById('btn-toggle-crop');
    if (btnToggleCrop) {
      btnToggleCrop.onclick = () => {
        if (this.viewport.isCropActive) this.viewport.cancelCrop();
        else {
          const ratio = parseFloat(document.getElementById('crop-ratio-sel').value) || 0;
          this.viewport.startCrop(ratio);
        }
        this.render();
      };
    }
    const btnCommit = document.getElementById('btn-commit-crop');
    if (btnCommit) btnCommit.onclick = () => { this.viewport.commitCrop(); this.render(); };
    const btnCancel = document.getElementById('btn-cancel-crop');
    if (btnCancel) btnCancel.onclick = () => { this.viewport.cancelCrop(); this.render(); };
    const btnSwap = document.getElementById('btn-crop-swap');
    if (btnSwap) btnSwap.onclick = () => this.viewport.toggleCropOrientation();

    // Resample listeners
    const rW = document.getElementById('resize-w');
    const rH = document.getElementById('resize-h');
    const lockChk = document.getElementById('chk-lock-aspect');
    if (lockChk) lockChk.onchange = (e) => { this.engine.geometry.lockAspectRatio = e.target.checked; };
    if (rW && rH) {
      rW.oninput = () => {
        if (this.engine.geometry.lockAspectRatio && this.engine.geometryBuffer) {
          const aspect = this.engine.geometryBuffer.width / this.engine.geometryBuffer.height;
          rH.value = Math.round(parseInt(rW.value, 10) / aspect);
        }
      };
      document.getElementById('btn-do-resize').onclick = () => {
        const w = parseInt(rW.value, 10), h = parseInt(rH.value, 10);
        if (w > 0 && h > 0) {
          this.store.recordAction(`Resample to ${w}x${h}`);
          this.engine.setResize(w, h);
          this.viewport.zoomFit();
        }
      };
    }
  }

  // -------------------------------------------------------------
  // TAB 3: EFFECTS PEDALBOARD STACK
  // -------------------------------------------------------------
  renderEffectsTab(body) {
    body.innerHTML = `
      <div class="deck-section">
        <div class="flex-row justify-between align-center">
          <div class="section-title">Effects Stack</div>
          <button class="btn sm acc" id="btn-add-effect-modal">+ Add Effect</button>
        </div>
        <p class="deck-hint">Reorderable non-destructive signal processing chain.</p>
        <div class="effects-stack" id="effects-stack-container"></div>
      </div>
    `;

    document.getElementById('btn-add-effect-modal').onclick = () => this.openAddEffectPicker();
    this.renderEffectsList();
  }

  renderEffectsList() {
    const container = document.getElementById('effects-stack-container');
    if (!container) return;

    if (this.engine.effects.length === 0) {
      container.innerHTML = `
        <div class="empty-stack-card">
          <div style="font-size: 20px; opacity: 0.5;">⬡</div>
          <div>No effects in stack</div>
          <button class="btn sm" style="margin-top: 8px;" onclick="document.getElementById('btn-add-effect-modal').click()">Add First Effect</button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.engine.effects.forEach((effInstance, idx) => {
      const def = EFFECTS[effInstance.id];
      if (!def) return;

      const card = document.createElement('div');
      card.className = `effect-card ${effInstance.enabled ? '' : 'disabled'}`;
      card.innerHTML = `
        <div class="effect-card-header">
          <label class="checkbox-label">
            <input type="checkbox" class="chk-eff-toggle" ${effInstance.enabled ? 'checked' : ''} />
            <span class="effect-card-name">${def.name}</span>
          </label>
          <div class="flex-row gap-4 align-center">
            <button class="btn xs icon-btn btn-eff-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn xs icon-btn btn-eff-down" title="Move Down" ${idx === this.engine.effects.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn xs icon-btn ghost btn-eff-remove" title="Remove Effect">✕</button>
          </div>
        </div>

        <div class="effect-card-controls">
          <div class="param-row">
            <label class="param-label">Wet / Dry</label>
            <div class="flex-row align-center gap-5" style="flex:1;">
              <input type="range" class="deck-slider eff-opacity" min="0" max="1" step="0.05" value="${effInstance.opacity}" />
              <span class="param-val" style="width: 32px;">${Math.round(effInstance.opacity * 100)}%</span>
            </div>
          </div>

          <div class="param-row">
            <label class="param-label">Blend Mode</label>
            <select class="deck-select eff-blend">
              <option value="normal" ${effInstance.blendMode === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="screen" ${effInstance.blendMode === 'screen' ? 'selected' : ''}>Screen</option>
              <option value="multiply" ${effInstance.blendMode === 'multiply' ? 'selected' : ''}>Multiply</option>
              <option value="difference" ${effInstance.blendMode === 'difference' ? 'selected' : ''}>Difference</option>
              <option value="add" ${effInstance.blendMode === 'add' ? 'selected' : ''}>Add</option>
            </select>
          </div>

          <div class="effect-custom-params"></div>
        </div>
      `;

      // Handlers
      card.querySelector('.chk-eff-toggle').onchange = () => {
        this.store.recordAction(`Toggle ${def.name}`);
        this.engine.toggleEffect(idx);
        this.renderEffectsList();
      };
      card.querySelector('.btn-eff-up').onclick = () => {
        this.store.recordAction(`Reorder ${def.name} up`);
        this.engine.reorderEffect(idx, idx - 1);
        this.renderEffectsList();
      };
      card.querySelector('.btn-eff-down').onclick = () => {
        this.store.recordAction(`Reorder ${def.name} down`);
        this.engine.reorderEffect(idx, idx + 1);
        this.renderEffectsList();
      };
      card.querySelector('.btn-eff-remove').onclick = () => {
        this.store.recordAction(`Remove ${def.name}`);
        this.engine.removeEffect(idx);
        this.renderEffectsList();
      };
      const opSlider = card.querySelector('.eff-opacity');
      const opVal = card.querySelector('.param-val');
      opSlider.oninput = (e) => {
        const v = parseFloat(e.target.value);
        opVal.textContent = `${Math.round(v * 100)}%`;
        this.engine.setEffectOpacity(idx, v);
      };
      card.querySelector('.eff-blend').onchange = (e) => {
        effInstance.blendMode = e.target.value;
        this.engine.render();
      };

      const customPContainer = card.querySelector('.effect-custom-params');
      this.renderParamControls(def.params, effInstance.params, customPContainer, (k, val) => {
        this.engine.setEffectParam(idx, k, val);
      });

      container.appendChild(card);
    });
  }

  openAddEffectPicker() {
    const modal = document.createElement('div');
    modal.className = 'rift-modal-backdrop';
    modal.innerHTML = `
      <div class="rift-modal">
        <div class="modal-header">
          <h3>Add Effect to Chain</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="effect-picker-grid">
          ${Object.values(EFFECTS).map(eff => `
            <div class="effect-picker-card" data-eff="${eff.id}">
              <div class="picker-card-name">${eff.name}</div>
              <div class="picker-card-desc">${eff.description}</div>
              <span class="tag-cat">${eff.category}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.querySelectorAll('.effect-picker-card').forEach(c => {
      c.onclick = () => {
        const id = c.dataset.eff;
        this.store.recordAction(`Add Effect: ${EFFECTS[id].name}`);
        this.engine.addEffect(id);
        modal.remove();
        this.render();
      };
    });
  }

  // -------------------------------------------------------------
  // TAB 4: MY PRESETS (100% User-Owned)
  // -------------------------------------------------------------
  renderPresetsTab(body) {
    body.innerHTML = `
      <div class="deck-section">
        <div class="flex-row justify-between align-center">
          <div class="section-title">My Saved Presets</div>
          <button class="btn sm acc" id="btn-save-current-preset">+ Save Current</button>
        </div>
        <p class="deck-hint">No bloat, no locked presets. You own 100% of your recipe configurations.</p>
        <div class="flex-row gap-5" style="margin: 10px 0;">
          <button class="btn sm" id="btn-export-all-presets">Export All (.json)</button>
          <button class="btn sm" id="btn-import-presets">Import (.json)</button>
          <input type="file" id="preset-file-input" accept=".json" style="display:none;" />
        </div>
        <div class="presets-grid" id="presets-grid"></div>
      </div>
    `;

    document.getElementById('btn-save-current-preset').onclick = () => {
      const name = prompt('Preset Name:', `Recipe ${this.store.presets.length + 1}`);
      if (name) {
        this.store.savePreset(name);
        this.renderPresetsTab(body);
      }
    };

    document.getElementById('btn-export-all-presets').onclick = () => this.store.exportPresetsAsJson();
    const impBtn = document.getElementById('btn-import-presets');
    const impFile = document.getElementById('preset-file-input');
    impBtn.onclick = () => impFile.click();
    impFile.onchange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        await this.store.importPresetsFromJson(e.target.files[0]);
        this.renderPresetsTab(body);
      }
    };

    const grid = document.getElementById('presets-grid');
    if (this.store.presets.length === 0) {
      grid.innerHTML = `
        <div class="empty-stack-card" style="grid-column: span 2;">
          <div>No saved presets yet</div>
          <div class="deck-hint">Save your current recipe or import a JSON file.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.store.presets.map((p, idx) => `
      <div class="preset-card" data-idx="${idx}">
        <div class="preset-card-name">${p.name}</div>
        <div class="preset-card-meta">${p.effects?.length || 0} effects • ${p.source?.type || 'source'}</div>
        <div class="flex-row justify-between align-center" style="margin-top: 8px;">
          <button class="btn xs acc btn-load-preset">Load</button>
          <button class="btn xs ghost btn-delete-preset">✕</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-load-preset').forEach((b, i) => {
      b.onclick = () => {
        this.store.recordAction(`Load Preset: ${this.store.presets[i].name}`);
        this.engine.loadRecipe(this.store.presets[i]);
        this.viewport.zoomFit();
      };
    });
    grid.querySelectorAll('.btn-delete-preset').forEach((b, i) => {
      b.onclick = () => {
        if (confirm(`Delete preset "${this.store.presets[i].name}"?`)) {
          this.store.deletePreset(i);
          this.renderPresetsTab(body);
        }
      };
    });
  }

  // Helper to render typed parameter sliders and inputs
  renderParamControls(paramDefs, paramValues, containerEl, onChange) {
    containerEl.innerHTML = '';
    paramDefs.forEach(p => {
      const row = document.createElement('div');
      row.className = 'param-row';

      if (p.type === 'enum') {
        row.innerHTML = `
          <label class="param-label">${p.label}</label>
          <select class="deck-select" style="flex:1;">
            ${p.options.map(opt => `
              <option value="${opt.value}" ${paramValues[p.key] === opt.value ? 'selected' : ''}>${opt.label}</option>
            `).join('')}
          </select>
        `;
        row.querySelector('select').onchange = (e) => onChange(p.key, e.target.value);
      } else if (p.type === 'bool') {
        row.innerHTML = `
          <label class="checkbox-label">
            <input type="checkbox" ${paramValues[p.key] ? 'checked' : ''} />
            <span>${p.label}</span>
          </label>
        `;
        row.querySelector('input').onchange = (e) => onChange(p.key, e.target.checked);
      } else {
        // float or int
        const val = paramValues[p.key] ?? p.default;
        row.innerHTML = `
          <label class="param-label">${p.label}</label>
          <div class="flex-row align-center gap-5" style="flex:1;">
            <input type="range" class="deck-slider" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${val}" />
            <span class="param-val">${val}</span>
          </div>
        `;
        const slider = row.querySelector('.deck-slider');
        const disp = row.querySelector('.param-val');
        slider.oninput = (e) => {
          const num = p.type === 'int' ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
          disp.textContent = num;
          onChange(p.key, num);
        };
      }
      containerEl.appendChild(row);
    });
  }

  updateHeaderStats() {
    const badgeDims = document.getElementById('rift-dims-badge');
    if (badgeDims && this.engine.resultBuffer) {
      badgeDims.textContent = `${this.engine.resultBuffer.width} × ${this.engine.resultBuffer.height} px`;
    }
  }
}
