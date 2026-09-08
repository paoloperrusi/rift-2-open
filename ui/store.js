/**
 * RIFT UI - State, History & Presets Store
 * Zero bloat, recipe-driven state management.
 */

const STORAGE_KEY = 'rift_user_presets_v2';

export class RiftStore {
  constructor(engine) {
    this.engine = engine;
    this.history = [];
    this.historyIndex = -1;
    this.isApplyingHistory = false;
    this.maxHistory = 30;

    this.presets = this.loadPresetsFromStorage();
    this.initHistory();
  }

  initHistory() {
    const initialRecipe = this.engine.exportRecipe('Initial State');
    this.history = [initialRecipe];
    this.historyIndex = 0;
  }

  recordAction(name = 'Action') {
    if (this.isApplyingHistory) return;
    const recipe = this.engine.exportRecipe(name);
    // Truncate redo tree
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(recipe);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  async undo() {
    if (!this.canUndo()) return;
    this.historyIndex--;
    this.isApplyingHistory = true;
    try {
      await this.engine.loadRecipe(this.history[this.historyIndex]);
    } finally {
      this.isApplyingHistory = false;
    }
  }

  async redo() {
    if (!this.canRedo()) return;
    this.historyIndex++;
    this.isApplyingHistory = true;
    try {
      await this.engine.loadRecipe(this.history[this.historyIndex]);
    } finally {
      this.isApplyingHistory = false;
    }
  }

  // --- Presets (100% User-Owned) ---

  loadPresetsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Could not read user presets from localStorage:', e);
      return [];
    }
  }

  savePresetsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets));
    } catch (e) {
      console.warn('Could not save user presets to localStorage:', e);
    }
  }

  savePreset(name, thumbnailDataUrl = null) {
    const recipe = this.engine.exportRecipe(name);
    recipe.thumbnail = thumbnailDataUrl;
    this.presets.push(recipe);
    this.savePresetsToStorage();
    return recipe;
  }

  deletePreset(index) {
    if (index >= 0 && index < this.presets.length) {
      this.presets.splice(index, 1);
      this.savePresetsToStorage();
    }
  }

  exportPresetsAsJson() {
    const data = JSON.stringify(this.presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rift-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importPresetsFromJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            this.presets = [...this.presets, ...imported];
            this.savePresetsToStorage();
            resolve(this.presets);
          } else {
            reject(new Error('Invalid preset file format'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
}
