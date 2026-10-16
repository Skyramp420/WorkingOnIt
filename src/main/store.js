/* Ukladanie dát: jeden JSON súbor + denné zálohy. Jediný zdroj pravdy pre appku aj mobil. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const L = require('../shared/logic');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);

class Store extends EventEmitter {
  constructor(dir) {
    super();
    this.dir = dir;
    this.file = path.join(dir, 'data.json');
    this.backupDir = path.join(dir, 'zalohy');
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.state = this._load();
    this._timer = null;
    this.live = { tracking: null }; // nepersistovaný stav (čo práve beží)
  }

  _read(f) {
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j && typeof j === 'object' && Array.isArray(j.projects) ? j : null; } catch (e) { return null; }
  }

  _load() {
    let s = this._read(this.file);
    this.recovered = null;
    if (!s && fs.existsSync(this.file)) {
      // poškodený súbor: odložíme ho a skúsime poslednú dobrú verziu
      try { fs.copyFileSync(this.file, path.join(this.dir, 'data.poskodene-' + Date.now() + '.json')); } catch (e) { }
      const cands = [this.file + '.bak'].concat(this.backups().map(b => b.file));
      for (const f of cands) { s = this._read(f); if (s) { this.recovered = path.basename(f); break; } }
    } else if (!s) {
      s = this._read(this.file + '.bak');
      if (s) this.recovered = 'data.json.bak';
    }
    if (!s) s = L.emptyState();
    const saved = s.settings || {};
    s.settings = Object.assign({}, L.DEFAULT_SETTINGS, saved);
    // v1.2: nový vzhľad a model (len ak mal predvolené hodnoty)
    if (!s.settings.v12) {
      if (!s.settings.theme || s.settings.theme === 'atrament') s.settings.theme = 'nokturno';
      if (!s.settings.accent || s.settings.accent === '#4cc9f0') s.settings.accent = '#6ee7c8';
      s.settings.v12 = true;
    }
    // v1.4: appka pre každého – nové predvolené hodnoty a značka
    if (!s.settings.v14) {
      // značku odvodíme z názvu priečinka „<Značka> Projekty“, ak si ho tak pomenoval
      const m = path.basename(String(s.settings.rootFolder || '')).match(/^(.+?)\s+projekty$/i);
      if (!s.settings.brand && m && !/^workingonit$/i.test(m[1])) s.settings.brand = m[1].trim();
      if (!Array.isArray(s.settings.contactTypes) || !s.settings.contactTypes.length) s.settings.contactTypes = L.CONTACTS.slice();
      if (!Array.isArray(s.settings.projectTypes) || !s.settings.projectTypes.length) s.settings.projectTypes = L.TYPES.slice();
      // kto už appku používal, nemá vidieť sprievodcu
      if ((s.projects || []).length || (s.sessions || []).length) {
        s.seenOnboarding = true;
        // mobil bol predtým zapnutý predvolene, nech ho doterajším používateľom nevypneme
        if (saved.remoteEnabled === undefined) s.settings.remoteEnabled = true;
      }
      s.settings.v14 = true;
    }
    // v1.6: nový vzhľad Lampa (len ak mal predvolenú tému a farbu)
    if (!s.settings.v16) {
      if (s.settings.theme === 'nokturno') s.settings.theme = 'lampa';
      if (String(s.settings.accent).toLowerCase() === '#6ee7c8') s.settings.accent = '#f07f2c';
      s.settings.v16 = true;
    }
    // Čistá (Apple) nahrádza Lampu ako predvolený vzhľad; vlastnú tému ani farbu nemeníme
    if (!s.settings.cleanMigrated) {
      if (!s.settings.theme || s.settings.theme === 'lampa') {
        s.settings.theme = 'clean';
        if (!s.settings.accent || String(s.settings.accent).toLowerCase() === '#f07f2c') s.settings.accent = '#ff9f0a';
      }
      s.settings.cleanMigrated = true;
    }
    // angličtina: kto appku už používal, ostáva v slovenčine (nový používateľ dostane jazyk systému)
    if (!s.settings.langMigrated) {
      const used = saved.v14 || saved.v16 || s.seenOnboarding || (s.projects || []).length || (s.sessions || []).length;
      if (!saved.language && used) s.settings.language = 'sk';
      s.settings.langMigrated = true;
    }
    s.ideas = s.ideas || [];
    s.clients = s.clients || {};
    s.achievements = s.achievements || {};
    s.stats = s.stats || { boops: 0 };
    s.snippets = s.snippets || [];
    if (!s.settings.localToken) s.settings.localToken = crypto.randomBytes(18).toString('base64url');
    if (!s.settings.remoteToken) s.settings.remoteToken = crypto.randomBytes(9).toString('base64url');
    s.projects = (s.projects || []).map(p => L.newProject(p));
    s.sessions = s.sessions || [];
    s.notified = s.notified || {};
    // otvorené sessions z minulého behu uzavrieme (appka spadla / PC sa vypol)
    for (const x of s.sessions) if (!x.end) x.end = x.lastSeen || new Date(Date.parse(x.start) + 60000).toISOString();
    return s;
  }

  get() { return this.state; }

  /* denné zálohy, najnovšie prvé */
  backups() {
    try {
      return fs.readdirSync(this.backupDir).filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
        .map(f => { const file = path.join(this.backupDir, f); let size = 0; try { size = fs.statSync(file).size; } catch (e) { } return { name: f, date: f.slice(5, 15), file, size }; });
    } catch (e) { return []; }
  }

  /* obnova zo zálohy; aktuálny stav si predtým odložíme */
  restoreBackup(name) {
    const b = this.backups().find(x => x.name === name);
    if (!b) throw new Error(t('Záloha sa nenašla.'));
    const data = this._read(b.file);
    if (!data) throw new Error(t('Záloha je poškodená.'));
    fs.writeFileSync(path.join(this.dir, 'data.pred-obnovou-' + Date.now() + '.json'), JSON.stringify(this.state));
    const keep = { localToken: this.state.settings.localToken, remoteToken: this.state.settings.remoteToken };
    // stará záloha bez jazyka: necháme ten, ktorý máš teraz
    if (!(data.settings || {}).language) keep.language = this.state.settings.language;
    this.state = data;
    this.state.settings = Object.assign({}, L.DEFAULT_SETTINGS, data.settings || {}, keep);
    this.state.ideas = this.state.ideas || [];
    this.state.projects = (this.state.projects || []).map(p => L.newProject(p));
    this.state.sessions = this.state.sessions || [];
    this.state.notified = this.state.notified || {};
    this._autoSession = null;
    this.save(true);
    this.emit('changed', 'restore');
    return true;
  }

  /* zapíše na disk s malým oneskorením, aby sa nezapisovalo pri každom tiku */
  save(immediate) {
    clearTimeout(this._timer);
    const write = () => {
      try {
        const json = JSON.stringify(this.state, null, 1);
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, json);
        if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
        fs.renameSync(tmp, this.file);
        this._dailyBackup(json);
      } catch (e) { console.error('Ukladanie zlyhalo', e); }
    };
    if (immediate) write(); else this._timer = setTimeout(write, 800);
  }

  _dailyBackup(json) {
    const name = 'data-' + L.dayKey(Date.now()) + '.json';
    const target = path.join(this.backupDir, name);
    if (fs.existsSync(target)) return;
    fs.writeFileSync(target, json);
    const all = fs.readdirSync(this.backupDir).filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 21))) {
      try { fs.unlinkSync(path.join(this.backupDir, old)); } catch (e) { }
    }
  }

  changed(what) {
    this.save();
    this.emit('changed', what || 'state');
  }

  /* ---------- projekty ---------- */
  project(id) { return this.state.projects.find(p => p.id === id); }

  createProject(fields) {
    const st = this.state.settings;
    fields = Object.assign({}, fields || {});
    // predvolené hodnoty z nastavení a z minulých zákaziek toho istého klienta
    const known = fields.client ? L.clientDefaults(this.state, fields.client) : null;
    if (known && !fields.contactFromUser) fields.contact = known.contact || fields.contact;
    if (known && known.name) fields.client = known.name;
    delete fields.contactFromUser;
    if (!fields.contact) fields.contact = st.defaultContact || 'Discord DM';
    if (!fields.type) fields.type = st.defaultType || 'Edit';
    if (!fields.status) fields.status = st.defaultStatus || 'todo';
    const p = L.newProject(fields);
    this.state.projects.unshift(p);
    this.changed('project');
    return p;
  }

  updateProject(id, patch) {
    const p = this.project(id);
    if (!p) return null;
    const { status, ...rest } = patch || {};
    Object.assign(p, rest, { updatedAt: new Date().toISOString() });
    if (status) this.setStatus(id, status, true);
    this.changed('project');
    return p;
  }

  setStatus(id, status, silent) {
    const p = this.project(id);
    if (!p) return null;
    const prev = p.status;
    if (L.setStatus(p, status)) {
      if (status === 'working') { this.state.focusProjectId = p.id; this.state.focusAt = new Date().toISOString(); }
      if (status === 'done' && this.state.focusProjectId === p.id) { this.state.focusProjectId = null; this.state.focusAt = new Date().toISOString(); }
      this.emit('status', { project: p, from: prev, to: status });
      if (!silent) this.changed('project');
    }
    return p;
  }

  moveProject(id, status, beforeId) {
    const list = this.state.projects;
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = list.splice(i, 1);
    let j = beforeId ? list.findIndex(x => x.id === beforeId) : -1;
    if (j < 0) list.push(p); else list.splice(j, 0, p);
    this.setStatus(id, status, true);
    this.changed('project');
  }

  deleteProject(id) {
    this.state.projects = this.state.projects.filter(p => p.id !== id);
    for (const s of this.state.sessions) if (s.projectId === id) s.projectId = null;
    if (this.state.focusProjectId === id) this.state.focusProjectId = null;
    this.changed('project');
  }

  addPayment(id, amount, note) {
    const p = this.project(id);
    if (!p) return;
    const a = Number(amount) || L.owedOf(p);
    if (a <= 0) return;
    p.payments.push({ at: new Date().toISOString(), amount: a, note: note || '' });
    p.updatedAt = new Date().toISOString();
    this.changed('project');
    this.emit('paid', { project: p, amount: a });
  }

  removePayment(id, index) {
    const p = this.project(id);
    if (!p) return;
    p.payments.splice(index, 1);
    p.updatedAt = new Date().toISOString();
    this.changed('project');
  }

  addRender(id, render) {
    const p = this.project(id);
    if (!p) return false;
    if (p.renders.some(r => r.file === render.file)) return false;
    p.renders.unshift(render);
    p.updatedAt = new Date().toISOString();
    this.changed('render');
    return true;
  }

  setFocus(id) {
    this.state.focusProjectId = id || null;
    this.state.focusAt = new Date().toISOString();
    this.changed('focus');
  }

  archiveProject(id, value) {
    const p = this.project(id);
    if (!p) return;
    p.archived = value ? true : false;
    p.updatedAt = new Date().toISOString();
    if (value && this.state.focusProjectId === id) { this.state.focusProjectId = null; this.state.focusAt = p.updatedAt; } // archivovaná už nie je aktívna
    this.changed('project');
  }

  duplicateProject(id) {
    const p = this.project(id);
    if (!p) return null;
    const keep = ['client', 'contact', 'type', 'priority', 'reward', 'notes', 'notesHtml', 'checklist'];
    const fields = { title: p.title + t(' (kópia)'), status: 'todo' };
    for (const k of keep) fields[k] = JSON.parse(JSON.stringify(p[k] == null ? '' : p[k]));
    fields.checklist = (fields.checklist || []).map(c => Object.assign({}, c, { id: L.uid(), done: false }));
    const n = L.newProject(fields);
    const i = this.state.projects.indexOf(p);
    this.state.projects.splice(i + 1, 0, n);
    this.changed('project');
    return n;
  }

  updateClient(key, patch) {
    this.state.clients = this.state.clients || {};
    this.state.clients[key] = Object.assign({}, this.state.clients[key] || {}, patch, { updatedAt: new Date().toISOString() });
    this.changed('client');
  }

  unlockAchievements(ids) {
    this.state.achievements = this.state.achievements || {};
    const at = new Date().toISOString();
    let n = 0;
    for (const id of ids || []) if (!this.state.achievements[id]) { this.state.achievements[id] = at; n++; }
    if (n) this.changed('achievements');
    return n;
  }

  saveSnippet(sn) {
    this.state.snippets = this.state.snippets || [];
    const i = this.state.snippets.findIndex(x => x.id === sn.id);
    const item = Object.assign({ id: L.uid(), createdAt: new Date().toISOString() }, sn, { updatedAt: new Date().toISOString() });
    if (i >= 0) this.state.snippets[i] = item; else this.state.snippets.unshift(item);
    this.changed('snippets');
    return item.id;
  }
  deleteSnippet(id) {
    this.state.snippets = (this.state.snippets || []).filter(x => x.id !== id);
    this.changed('snippets');
  }

  boop() {
    this.state.stats = this.state.stats || {};
    this.state.stats.boops = (this.state.stats.boops || 0) + 1;
    this.changed('stats');
    return this.state.stats.boops;
  }

  importProjects(list) {
    let n = 0;
    for (const f of list) {
      if (this.state.projects.some(p => p.title === f.title && p.client === f.client)) continue;
      this.state.projects.push(L.newProject(f)); n++;
    }
    this.changed('project');
    return n;
  }

  /* ---------- čas ---------- */
  runningManual() { return this.state.sessions.find(s => !s.end && s.manual); }

  startManual(projectId) {
    this.stopManual();
    const s = { id: L.uid(), projectId: projectId || null, app: 'Časovač', start: new Date().toISOString(), end: null, manual: true };
    this.state.sessions.push(s);
    if (projectId) this.state.focusProjectId = projectId;
    this.changed('time');
    return s;
  }

  stopManual() {
    const s = this.runningManual();
    if (!s) return null;
    s.end = new Date().toISOString();
    if (L.sessionMs(s) < 30000) this.state.sessions = this.state.sessions.filter(x => x !== s);
    this.changed('time');
    return s;
  }

  /* jeden tik automatického merania: predĺži poslednú session alebo založí novú */
  trackTick({ projectId, app, title }, intervalMs, gapMs) {
    const nowIso = new Date().toISOString();
    const gap = gapMs || intervalMs * 3 + 2000;
    let s = this._autoSession;
    if (s && s.projectId === projectId && s.app === app && Date.now() - Date.parse(s.end) <= gap) {
      s.end = nowIso;
      if (title) s.title = title;
    } else {
      s = { id: L.uid(), projectId: projectId || null, app, title: title || '', start: new Date(Date.now() - intervalMs).toISOString(), end: nowIso, auto: true };
      this.state.sessions.push(s);
      this._autoSession = s;
    }
    this.save();
  }

  endAuto() { this._autoSession = null; }

  /* AFK: koniec session posunieme na moment poslednej aktivity */
  trimAuto(idleMs) {
    const s = this._autoSession;
    if (!s) return;
    const end = Math.max(Date.parse(s.start), Date.now() - idleMs);
    s.end = new Date(end).toISOString();
    if (L.sessionMs(s) < 30000) this.state.sessions = this.state.sessions.filter(x => x !== s);
    this.save();
  }

  assignSession(sessionId, projectId) {
    const s = this.state.sessions.find(x => x.id === sessionId);
    if (!s) return;
    s.projectId = projectId || null;
    this.changed('time');
  }

  /* čas nameraný v okne s týmto názvom projektu (bez zákazky alebo z „fromId“) priradí zákazke */
  claimSessions(name, projectId, fromId) {
    const n = L.normalize(name);
    if (!n) return 0;
    let c = 0;
    for (const x of this.state.sessions) {
      if ((!x.projectId || (fromId && x.projectId === fromId)) && x.auto && L.normalize(x.title || '').includes(n)) { x.projectId = projectId; c++; }
    }
    if (c) this.changed('time');
    return c;
  }

  /* spojí dve zákazky: čas, rendery, platby a prezývky prejdú do „intoId“ */
  mergeProjects(fromId, intoId) {
    const from = this.project(fromId), into = this.project(intoId);
    if (!from || !into || from === into) return false;
    for (const x of this.state.sessions) if (x.projectId === fromId) x.projectId = intoId;
    for (const r of from.renders || []) if (!into.renders.some(y => y.file === r.file)) into.renders.push(r);
    into.payments = (into.payments || []).concat(from.payments || []);
    const names = [from.title].concat(from.aliases || []).filter(n => L.normalize(n) && L.normalize(n) !== L.normalize(into.title));
    into.aliases = Array.from(new Set((into.aliases || []).concat(names)));
    if (!into.folder && from.folder) into.folder = from.folder;
    into.updatedAt = new Date().toISOString();
    this.state.projects = this.state.projects.filter(p => p.id !== fromId);
    if (this.state.focusProjectId === fromId) this.state.focusProjectId = intoId;
    this.changed('project');
    return true;
  }

  /* názov projektu z editora patrí tejto zákazke (a žiadnej inej) */
  aliasName(id, name) {
    const proj = this.project(id);
    const n = L.normalize(name);
    if (!proj || !n) return false;
    for (const p of this.state.projects) if (p !== proj && p.aliases) p.aliases = p.aliases.filter(a => L.normalize(a) !== n);
    if (L.normalize(proj.title) !== n) proj.aliases = Array.from(new Set((proj.aliases || []).concat([name])));
    proj.updatedAt = new Date().toISOString();
    this.changed('project');
    return true;
  }

  /* priradí všetky nepriradené sessions s rovnakým titulkom okna */
  assignSimilar(sessionId, projectId) {
    const s = this.state.sessions.find(x => x.id === sessionId);
    if (!s) return 0;
    let n = 0;
    for (const x of this.state.sessions) {
      if (!x.projectId && x.app === s.app && (x.title || '') === (s.title || '')) { x.projectId = projectId; n++; }
    }
    this.changed('time');
    return n;
  }

  deleteSession(sessionId) {
    this.state.sessions = this.state.sessions.filter(x => x.id !== sessionId);
    if (this._autoSession && this._autoSession.id === sessionId) this._autoSession = null;
    this.changed('time');
  }

  addManualSession(projectId, minutes, dateIso) {
    const end = dateIso ? new Date(dateIso) : new Date();
    const start = new Date(end - minutes * 60000);
    this.state.sessions.push({ id: L.uid(), projectId, app: 'Ručne', start: start.toISOString(), end: end.toISOString(), manual: true });
    this.changed('time');
  }

  /* ---------- nastavenia ---------- */
  updateSettings(patch) {
    Object.assign(this.state.settings, patch || {});
    // spoločné nastavenia (meno, typy zákaziek…) sa synchronizujú medzi zariadeniami
    const SHARED = require('../shared/syncmodel').SHARED_SETTINGS;
    if (Object.keys(patch || {}).some(k => SHARED.includes(k))) this.state.settings.sharedAt = new Date().toISOString();
    this.changed('settings');
    this.emit('settings', this.state.settings);
  }

  markOnboarded() { this.state.seenOnboarding = true; this.changed('settings'); }

  /* ---------- nápady ---------- */
  idea(id) { return (this.state.ideas || []).find(i => i.id === id); }
  saveIdea(patch) {
    this.state.ideas = this.state.ideas || [];
    const now = new Date().toISOString();
    let it = patch.id && this.idea(patch.id);
    if (it) Object.assign(it, patch, { updatedAt: now });
    else { it = L.newIdea(Object.assign({}, patch, { id: patch.id || L.uid() })); this.state.ideas.unshift(it); }
    if (Array.isArray(it.frames)) it.frames = it.frames.map(f => L.newFrame(f));
    if (!Array.isArray(it.tags)) it.tags = [];
    this.changed('ideas');
    return it.id;
  }
  deleteIdea(id) {
    this.state.ideas = (this.state.ideas || []).filter(i => i.id !== id);
    this.changed('ideas');
  }

  snapshot() {
    return { state: this.state, live: this.live };
  }
}

module.exports = Store;
