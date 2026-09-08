/**
 * RIFT Core - Transforms Module
 * Pure, deterministic geometric transformations.
 */

export function createBlankImageData(w, h, fill = [0, 0, 0, 255]) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = fill[0];
    d[i + 1] = fill[1];
    d[i + 2] = fill[2];
    d[i + 3] = fill[3];
  }
  return img;
}

export function copyImageData(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  const dst = ctx.createImageData(src.width, src.height);
  dst.data.set(src.data);
  return dst;
}

export function applyCrop(src, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return copyImageData(src);
  const rx = Math.max(0, Math.min(src.width - 1, Math.round(rect.x)));
  const ry = Math.max(0, Math.min(src.height - 1, Math.round(rect.y)));
  const rw = Math.max(1, Math.min(src.width - rx, Math.round(rect.width)));
  const rh = Math.max(1, Math.min(src.height - ry, Math.round(rect.height)));

  const c = document.createElement('canvas');
  c.width = rw;
  c.height = rh;
  const ctx = c.getContext('2d');

  const sc = document.createElement('canvas');
  sc.width = src.width;
  sc.height = src.height;
  sc.getContext('2d').putImageData(src, 0, 0);

  ctx.drawImage(sc, rx, ry, rw, rh, 0, 0, rw, rh);
  return ctx.getImageData(0, 0, rw, rh);
}

export function applyFlip(src, axis = 'h') {
  const w = src.width, h = src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const sc = document.createElement('canvas');
  sc.width = w;
  sc.height = h;
  sc.getContext('2d').putImageData(src, 0, 0);

  ctx.save();
  if (axis === 'h') {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, h);
    ctx.scale(1, -1);
  }
  ctx.drawImage(sc, 0, 0);
  ctx.restore();
  return ctx.getImageData(0, 0, w, h);
}

export function applyRotate(src, deg, fillMode = 'black') {
  deg = ((deg % 360) + 360) % 360;
  if (deg === 0) return copyImageData(src);

  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const nw = Math.round(src.width * cos + src.height * sin);
  const nh = Math.round(src.width * sin + src.height * cos);

  const c = document.createElement('canvas');
  c.width = nw;
  c.height = nh;
  const ctx = c.getContext('2d');

  if (fillMode === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nw, nh);
  } else if (fillMode === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, nw, nh);
  }

  const sc = document.createElement('canvas');
  sc.width = src.width;
  sc.height = src.height;
  sc.getContext('2d').putImageData(src, 0, 0);

  ctx.save();
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(sc, -src.width / 2, -src.height / 2);
  ctx.restore();

  if (fillMode === 'wrap') {
    // Edge clamp / wrap simulation for corner fills
    const res = ctx.getImageData(0, 0, nw, nh);
    const d = res.data;
    const midX = Math.floor(nw / 2), midY = Math.floor(nh / 2);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const idx = (y * nw + x) * 4;
        if (d[idx + 3] === 0) {
          const sampleX = Math.min(src.width - 1, Math.max(0, Math.floor((x / nw) * src.width)));
          const sampleY = Math.min(src.height - 1, Math.max(0, Math.floor((y / nh) * src.height)));
          const sIdx = (sampleY * src.width + sampleX) * 4;
          d[idx] = src.data[sIdx];
          d[idx + 1] = src.data[sIdx + 1];
          d[idx + 2] = src.data[sIdx + 2];
          d[idx + 3] = 255;
        }
      }
    }
    return res;
  }

  return ctx.getImageData(0, 0, nw, nh);
}

export function applyResize(src, targetW, targetH) {
  const tw = Math.max(1, Math.round(targetW));
  const th = Math.max(1, Math.round(targetH));
  if (tw === src.width && th === src.height) return copyImageData(src);

  const sc = document.createElement('canvas');
  sc.width = src.width;
  sc.height = src.height;
  sc.getContext('2d').putImageData(src, 0, 0);

  const c = document.createElement('canvas');
  c.width = tw;
  c.height = th;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sc, 0, 0, tw, th);
  return ctx.getImageData(0, 0, tw, th);
}
