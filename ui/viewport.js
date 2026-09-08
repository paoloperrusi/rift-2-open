/**
 * RIFT UI - Viewport & Canvas Management
 * High-performance render canvas with pan/zoom (1% - 4000%), split compare, and crop overlay.
 */

export class RiftViewport {
  constructor(containerEl, engine, store) {
    this.container = containerEl;
    this.engine = engine;
    this.store = store;

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };

    this.viewMode = 'result'; // 'result' | 'orig' | 'split'
    this.splitFraction = 0.5; // 0.0 to 1.0 for split divider
    this.isDraggingSplit = false;

    // Crop box state
    this.isCropActive = false;
    this.cropRect = null; // { x, y, width, height } in image pixels
    this.isDraggingCrop = false;
    this.cropStart = { x: 0, y: 0 };
    this.cropRatio = 0; // 0 = free, or aspect ratio number
    this.cropInverted = false;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'rift-viewport-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.initEvents();
    this.engine.subscribe((ev) => {
      if (ev === 'render:complete') this.draw();
    });
  }

  initEvents() {
    window.addEventListener('resize', () => this.draw());

    // Wheel zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevZoom = this.zoom;
      const delta = e.deltaY < 0 ? 1.15 : 0.85;
      let newZoom = prevZoom * delta;
      newZoom = Math.max(0.01, Math.min(40.0, newZoom));

      // Zoom towards mouse pointer
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / prevZoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / prevZoom);
      this.zoom = newZoom;

      this.draw();
      this.notifyZoomChanged();
    }, { passive: false });

    // Pan & Crop interaction
    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.shiftKey || (e.button === 0 && e.spaceKey)) {
        // Pan
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.container.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        if (this.viewMode === 'split') {
          // Check if clicking near split divider
          const rect = this.container.getBoundingClientRect();
          const splitScreenX = this.panX + (this.engine.resultBuffer ? this.engine.resultBuffer.width * this.zoom * this.splitFraction : 0);
          const mouseX = e.clientX - rect.left;
          if (Math.abs(mouseX - splitScreenX) < 14) {
            this.isDraggingSplit = true;
            return;
          }
        }

        if (this.isCropActive) {
          const imgPos = this.screenToImage(e.clientX, e.clientY);
          this.isDraggingCrop = true;
          this.cropStart = { ...imgPos };
          this.cropRect = { x: imgPos.x, y: imgPos.y, width: 0, height: 0 };
          this.draw();
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startPan.x;
        this.panY = e.clientY - this.startPan.y;
        this.draw();
      } else if (this.isDraggingSplit) {
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const imgW = (this.engine.resultBuffer ? this.engine.resultBuffer.width : 800) * this.zoom;
        const frac = (mouseX - this.panX) / imgW;
        this.splitFraction = Math.max(0.01, Math.min(0.99, frac));
        this.draw();
      } else if (this.isDraggingCrop && this.isCropActive) {
        const current = this.screenToImage(e.clientX, e.clientY);
        let w = current.x - this.cropStart.x;
        let h = current.y - this.cropStart.y;

        if (this.cropRatio > 0) {
          let r = this.cropRatio;
          if (this.cropInverted && r !== 1) r = 1 / r;
          h = Math.sign(h || 1) * (Math.abs(w) / r);
        }

        const rx = w < 0 ? this.cropStart.x + w : this.cropStart.x;
        const ry = h < 0 ? this.cropStart.y + h : this.cropStart.y;

        this.cropRect = {
          x: Math.max(0, rx),
          y: Math.max(0, ry),
          width: Math.abs(w),
          height: Math.abs(h)
        };
        this.draw();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.style.cursor = this.isCropActive ? 'crosshair' : 'default';
      }
      this.isDraggingSplit = false;
      if (this.isDraggingCrop) {
        this.isDraggingCrop = false;
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isCropActive) {
        this.cancelCrop();
      } else if (e.key === 'Enter' && this.isCropActive && this.cropRect && this.cropRect.width > 2) {
        this.commitCrop();
      }
    });
  }

  screenToImage(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    return {
      x: Math.round((mouseX - this.panX) / this.zoom),
      y: Math.round((mouseY - this.panY) / this.zoom)
    };
  }

  zoomFit() {
    const img = this.engine.resultBuffer || this.engine.geometryBuffer || this.engine.originalBuffer;
    if (!img) return;

    const cw = this.container.clientWidth || 800;
    const ch = this.container.clientHeight || 600;
    const scale = Math.min((cw - 40) / img.width, (ch - 40) / img.height);
    this.zoom = Math.max(0.01, scale);
    this.panX = Math.round((cw - img.width * this.zoom) / 2);
    this.panY = Math.round((ch - img.height * this.zoom) / 2);

    this.draw();
    this.notifyZoomChanged();
  }

  zoom100() {
    const img = this.engine.resultBuffer || this.engine.originalBuffer;
    if (!img) return;
    const cw = this.container.clientWidth || 800;
    const ch = this.container.clientHeight || 600;
    this.zoom = 1.0;
    this.panX = Math.round((cw - img.width) / 2);
    this.panY = Math.round((ch - img.height) / 2);

    this.draw();
    this.notifyZoomChanged();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.draw();
  }

  // --- Crop Interface ---

  startCrop(ratio = 0) {
    this.isCropActive = true;
    this.cropRatio = ratio;
    this.cropRect = null;
    this.container.style.cursor = 'crosshair';
    this.draw();
  }

  cancelCrop() {
    this.isCropActive = false;
    this.cropRect = null;
    this.container.style.cursor = 'default';
    this.draw();
  }

  async commitCrop() {
    if (!this.cropRect || this.cropRect.width < 2 || this.cropRect.height < 2) {
      this.cancelCrop();
      return;
    }
    this.store.recordAction('Crop Image');
    await this.engine.setCrop(this.cropRect);
    this.cancelCrop();
    this.zoomFit();
  }

  toggleCropOrientation() {
    this.cropInverted = !this.cropInverted;
    if (this.cropRect && this.cropRect.width > 0 && this.cropRatio > 0) {
      let r = this.cropRatio;
      if (this.cropInverted && r !== 1) r = 1 / r;
      this.cropRect.height = Math.round(this.cropRect.width / r);
      this.draw();
    }
  }

  notifyZoomChanged() {
    const badge = document.getElementById('rift-zoom-badge');
    if (badge) {
      badge.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  draw() {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, cw, ch);

    const resImg = this.engine.resultBuffer;
    const origImg = this.engine.originalBuffer;
    if (!resImg) return;

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Render based on comparison view mode
    if (this.viewMode === 'orig' && origImg) {
      this.drawBuffer(origImg, ctx);
    } else if (this.viewMode === 'split' && origImg) {
      // Draw original on left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, resImg.width * this.splitFraction, resImg.height);
      ctx.clip();
      this.drawBuffer(origImg, ctx);
      ctx.restore();

      // Draw result on right
      ctx.save();
      ctx.beginPath();
      ctx.rect(resImg.width * this.splitFraction, 0, resImg.width * (1 - this.splitFraction), resImg.height);
      ctx.clip();
      this.drawBuffer(resImg, ctx);
      ctx.restore();

      // Draw split divider
      ctx.restore(); // back to screen space for sharp 1px divider
      ctx.save();
      const dividerScreenX = this.panX + resImg.width * this.zoom * this.splitFraction;
      ctx.strokeStyle = '#a29bfe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dividerScreenX, this.panY);
      ctx.lineTo(dividerScreenX, this.panY + resImg.height * this.zoom);
      ctx.stroke();

      // Handle circle
      ctx.fillStyle = '#6c5ce7';
      ctx.beginPath();
      ctx.arc(dividerScreenX, this.panY + (resImg.height * this.zoom) / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↔', dividerScreenX, this.panY + (resImg.height * this.zoom) / 2);
      ctx.restore();
      return;
    } else {
      this.drawBuffer(resImg, ctx);
    }

    // Draw active crop rectangle
    if (this.isCropActive && this.cropRect && this.cropRect.width > 0) {
      const cr = this.cropRect;
      ctx.strokeStyle = '#6c5ce7';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.strokeRect(cr.x, cr.y, cr.width, cr.height);

      ctx.fillStyle = 'rgba(108, 92, 231, 0.15)';
      ctx.fillRect(cr.x, cr.y, cr.width, cr.height);
    }

    ctx.restore();
  }

  drawBuffer(imgData, ctx) {
    if (!this._tempCanvas) {
      this._tempCanvas = document.createElement('canvas');
      this._tempCtx = this._tempCanvas.getContext('2d');
    }
    if (this._tempCanvas.width !== imgData.width || this._tempCanvas.height !== imgData.height) {
      this._tempCanvas.width = imgData.width;
      this._tempCanvas.height = imgData.height;
    }
    this._tempCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = this.zoom < 2.0;
    ctx.drawImage(this._tempCanvas, 0, 0);
  }
}
