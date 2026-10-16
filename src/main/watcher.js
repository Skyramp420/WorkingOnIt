/* Sledovanie renderov: keď sa v priečinku projektu (alebo v export priečinku) objaví nové video,
   počká, kým sa dopíše, a priradí ho k projektu. */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const L = require('../shared/logic');

const RENDER_DIR = /(render|export|final|output|delivery|odovzd|hotov|^0[5-9]_)/i;
const IGNORE = /(cache|proxy|proxies|optimized|preview files|\.tmp|~\$|\$recycle|audio previews|conformed|media cache)/i;

class RenderWatcher extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.watchers = [];
    this.pending = new Map();
    this.seen = new Set();
  }

  roots() {
    const st = this.store.get().settings;
    const list = [];
    if (st.rootFolder) list.push({ dir: st.rootFolder, strict: true });
    for (const d of String(st.extraWatchFolders || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) list.push({ dir: d, strict: false });
    // prepojené priečinky projektov mimo hlavného priečinka
    const inside = d => st.rootFolder && path.resolve(d).toLowerCase().startsWith(path.resolve(st.rootFolder).toLowerCase() + path.sep);
    for (const p of this.store.get().projects) {
      if (p.folder && L.isActive(p, st) && !inside(p.folder) && !list.some(r => path.resolve(r.dir).toLowerCase() === path.resolve(p.folder).toLowerCase())) list.push({ dir: p.folder, strict: true });
    }
    return list.filter(r => { try { return fs.statSync(r.dir).isDirectory(); } catch (e) { return false; } });
  }

  /* reštart len ak sa zmenil zoznam sledovaných priečinkov */
  refresh() {
    const key = this.roots().map(r => r.dir).join('|');
    if (key !== this._key) this.start();
  }

  start() {
    this.stop();
    const exts = String(this.store.get().settings.renderExtensions || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
    this.exts = new Set(exts.map(e => '.' + e.replace(/^\./, '')));
    const roots = this.roots();
    this._key = roots.map(r => r.dir).join('|');
    for (const r of roots) {
      try {
        const w = fs.watch(r.dir, { recursive: true }, (evt, rel) => {
          if (!rel) return;
          const full = path.join(r.dir, rel.toString());
          this.consider(full, r);
        });
        w.on('error', () => { });
        this.watchers.push(w);
      } catch (e) { console.error('Nedá sa sledovať', r.dir, e.message); }
    }
    this.emit('roots', roots.map(r => r.dir));
  }

  stop() {
    for (const w of this.watchers) { try { w.close(); } catch (e) { } }
    this.watchers = [];
    for (const t of this.pending.values()) clearTimeout(t.timer);
    this.pending.clear();
  }

  consider(full, root) {
    const ext = path.extname(full).toLowerCase();
    if (!this.exts.has(ext)) return;
    if (IGNORE.test(full)) return;
    if (root.strict) {
      // v hlavnom priečinku projektov rátame len súbory v render/export/final priečinkoch,
      // aby sa za render nepovažoval footage, ktorý si len nakopíruješ
      const rel = path.relative(root.dir, path.dirname(full));
      const parts = rel.split(path.sep);
      if (!parts.some(p => RENDER_DIR.test(p))) return;
    }
    if (this.pending.has(full)) return;
    const entry = { last: -1, stableCount: 0, timer: null };
    this.pending.set(full, entry);
    const check = () => {
      let st;
      try { st = fs.statSync(full); } catch (e) { this.pending.delete(full); return; }
      if (st.size > 0 && st.size === entry.last) entry.stableCount++;
      else entry.stableCount = 0;
      entry.last = st.size;
      let locked = false;
      if (entry.stableCount >= 2) {
        try { const fd = fs.openSync(full, 'r+'); fs.closeSync(fd); } catch (e) { locked = e.code === 'EBUSY' || e.code === 'EPERM'; }
      }
      if (entry.stableCount >= 2 && !locked) {
        this.pending.delete(full);
        this.finish(full, st);
      } else {
        entry.timer = setTimeout(check, 2500);
      }
    };
    entry.timer = setTimeout(check, 2500);
  }

  finish(full, st) {
    const key = full + '|' + st.size;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const state = this.store.get();
    const norm = s => path.resolve(s).toLowerCase();
    let project = state.projects.find(p => p.folder && norm(full).startsWith(norm(p.folder) + path.sep));
    let how = 'folder';
    if (!project) { project = L.matchProjectByTitle(state, path.basename(full)); how = 'name'; }
    if (!project && state.focusProjectId) { project = state.projects.find(p => p.id === state.focusProjectId); how = 'focus'; }
    const render = { file: full, name: path.basename(full), size: st.size, at: new Date().toISOString() };
    if (project) {
      if (this.store.addRender(project.id, render)) this.emit('render', { project, render, how });
    } else {
      state.looseRenders = (state.looseRenders || []).filter(r => r.file !== full);
      state.looseRenders.unshift(render);
      state.looseRenders = state.looseRenders.slice(0, 30);
      this.store.changed('render');
      this.emit('render', { project: null, render, how: 'none' });
    }
  }
}

module.exports = { RenderWatcher };
