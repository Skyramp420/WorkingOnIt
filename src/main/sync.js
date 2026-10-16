/* Synchronizácia s vlastnou databázou používateľa (Supabase).
   Dáta žijú ďalej v data.json (appka ide aj offline); raz za chvíľu sa zmeny pošlú
   do databázy a stiahnu sa zmeny z iných zariadení. Kto zmenil neskôr, vyhrá. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { pathToFileURL, fileURLToPath } = require('url');
const SB = require('../shared/sbclient');
const M = require('../shared/syncmodel');
const log = require('./log');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);

const EVERY = 45000;      // pravidelná synchronizácia
const AFTER_CHANGE = 8000; // po zmene v appke
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

class Sync extends EventEmitter {
  constructor(store, dir, opts) {
    super();
    opts = opts || {};
    this.store = store;
    this.dir = dir;
    this.file = path.join(dir, 'sync.json');
    this.cacheDir = path.join(dir, 'obrazky', 'sync');
    this.encrypt = opts.encrypt || (s => s);
    this.decrypt = opts.decrypt || (s => s);
    this.fetch = opts.fetch;
    this.cfg = this._load();
    this.busy = false;
    this.lastError = null;
    this.lastSync = this.cfg.lastSync || null;
    this.sb = null;
    if (this.cfg.url && this.cfg.key) this._client();
  }

  /* ---------- nastavenia na disku ---------- */
  _load() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { return {}; }
  }
  _save() {
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.cfg));
      fs.renameSync(tmp, this.file);
    } catch (e) { log.warn('sync: nastavenia sa nedali uložiť', e.message); }
  }
  _client() {
    let session = null;
    if (this.cfg.session) { try { session = JSON.parse(this.decrypt(this.cfg.session)); } catch (e) { session = null; } }
    this.sb = SB.create({ url: this.cfg.url, key: this.cfg.key, session, fetch: this.fetch, onSession: s => { this.cfg.session = s ? this.encrypt(JSON.stringify(s)) : null; this._save(); } });
    if (!this.cfg.device) { this.cfg.device = crypto.randomBytes(6).toString('hex'); this._save(); }
  }

  status() {
    const user = this.sb && this.sb.user;
    return {
      configured: !!(this.cfg.url && this.cfg.key), signedIn: !!user, email: user ? user.email : (this.cfg.email || ''),
      url: this.cfg.url || '', lastSync: this.lastSync, busy: this.busy, error: this.lastError,
      items: Object.keys(this.cfg.synced || {}).length, files: Object.keys(this.cfg.files || {}).length
    };
  }
  _emit() { this.emit('status', this.status()); }

  /* kód na pripojenie ďalšieho zariadenia: adresa a verejný kľúč (heslo v ňom nie je) */
  connectionCode() {
    if (!this.cfg.url) return null;
    return 'WOI1.' + Buffer.from(JSON.stringify({ u: this.cfg.url, k: this.cfg.key })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  static parseCode(code) {
    const m = String(code || '').trim().match(/WOI1\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { const o = JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); return o.u && o.k ? { url: o.u, key: o.k } : null; } catch (e) { return null; }
  }

  /* ---------- nastavenie ---------- */
  /* overí adresu a kľúč; vráti { ok, schema } (schema = false, keď ešte chýba SQL) */
  async connect({ url, key, code }) {
    if (code) { const c = Sync.parseCode(code); if (!c) throw new Error(t('Kód na pripojenie nesedí. Skopíruj ho znova.')); url = c.url; key = c.key; }
    url = SB.normUrl(url); key = String(key || '').trim();
    if (!/^https?:\/\/.+/.test(url)) throw new Error(t('Adresa projektu má tvar https://xxxx.supabase.co'));
    if (key.length < 20) throw new Error(t('Kľúč je príliš krátky. Skopíruj „anon public“ alebo „publishable“ kľúč.'));
    const sb = SB.create({ url, key, fetch: this.fetch });
    let schema = true;
    try { await sb.probe(); } catch (e) { if (e.code === 'schema') schema = false; else throw e; }
    const same = this.cfg.url === url;
    this.cfg = Object.assign(same ? this.cfg : { device: this.cfg.device }, { url, key });
    if (!same) { this.cfg.session = null; this.cfg.synced = {}; this.cfg.cursor = null; this.cfg.files = {}; this.cfg.refs = {}; }
    this._save();
    this._client();
    this._emit();
    return { ok: true, schema };
  }
  async checkSchema() {
    if (!this.sb) throw new Error(t('Najprv zadaj adresu a kľúč.'));
    try { await this.sb.probe(); return true; } catch (e) { if (e.code === 'schema') return false; throw e; }
  }

  /* nový účet v databáze (prvé zariadenie) */
  async createAccount(email, password) {
    if (!this.sb) throw new Error(t('Najprv zadaj adresu a kľúč.'));
    if (String(password || '').length < 8) throw new Error(t('Heslo musí mať aspoň 8 znakov.'));
    let r = null;
    try { r = await this.sb.signUp(email, password); } catch (e) { if (e.code !== 'exists') throw e; }
    // staré prihlásenie (napr. z predošlej databázy na tej istej adrese) nepoužijeme
    if (!r || !r.access_token) await this.sb.signIn(email, password);
    this.cfg.email = email; this.cfg.cursor = null; this._save();
    return this.syncNow({ first: true });
  }
  async login(email, password) {
    if (!this.sb) throw new Error(t('Najprv zadaj adresu a kľúč.'));
    await this.sb.signIn(email, password);
    this.cfg.email = email; this.cfg.cursor = null; this._save();
    return this.syncNow({ first: true });
  }
  async logout() {
    if (this.sb) await this.sb.signOut();
    this.cfg.session = null; this.cfg.synced = {}; this.cfg.cursor = null; this.cfg.refs = {}; this.cfg.files = {};
    this._save(); this._emit();
  }
  async disconnect() {
    await this.logout();
    this.cfg = { device: this.cfg.device };
    this.sb = null; this._save(); this._emit();
  }

  /* ---------- beh ---------- */
  start() {
    clearInterval(this._iv);
    this._iv = setInterval(() => this.syncNow().catch(() => { }), EVERY);
    this.store.on('changed', what => { if (what !== 'sync') this.soon(); });
    setTimeout(() => this.syncNow().catch(() => { }), 4000);
  }
  stop() { clearInterval(this._iv); clearTimeout(this._soon); }
  soon() { clearTimeout(this._soon); this._soon = setTimeout(() => this.syncNow().catch(() => { }), AFTER_CHANGE); }

  async syncNow(opts) {
    if (!this.sb || !this.sb.user) return this.status();
    if (this.busy) { this._again = true; return this.status(); }
    this.busy = true; this._emit();
    try {
      const pulled = await this._pull();
      const pushed = await this._push();
      this.lastSync = new Date().toISOString();
      this.cfg.lastSync = this.lastSync;
      this.lastError = null;
      this._save();
      if (pulled || pushed) log.info('sync: stiahnuté ' + pulled + ', odoslané ' + pushed + (opts && opts.first ? ' (prvé spojenie)' : ''));
      return Object.assign(this.status(), { pulled, pushed });
    } catch (e) {
      this.lastError = e.message;
      if (e.code === 'signedout') { this.cfg.session = null; this._save(); }
      log.warn('sync:', e.message);
      if (opts && opts.first) throw e;
      return this.status();
    } finally {
      this.busy = false; this._emit();
      if (this._again) { this._again = false; this.soon(); }
    }
  }

  /* stiahne zmeny z iných zariadení */
  async _pull() {
    const state = this.store.get();
    this.cfg.synced = this.cfg.synced || {};
    let since = this.cfg.cursor || null;
    if (since) { const ts = Date.parse(since); if (!isNaN(ts)) since = new Date(ts - 5000).toISOString(); }
    const full = !since;
    let applied = 0, seen = 0;
    const local = new Map(M.collect(state).map(i => [i.kind + '|' + i.id, i]));
    for (let page = 0; page < 200; page++) {
      const rows = await this.sb.pull(since, 500);
      seen += rows.length;
      for (const row of rows) {
        if (!this.cfg.cursor || row.server_at > this.cfg.cursor) this.cfg.cursor = row.server_at;
        const key = row.kind + '|' + row.id;
        const remoteFp = row.deleted ? 'deleted' : M.fingerprint(row.data);
        const last = this.cfg.synced[key];
        if (remoteFp === last) continue;
        const mine = local.get(key);
        const mineFp = mine ? M.fingerprint(mine.data) : (last ? 'deleted' : undefined);
        if (mineFp === remoteFp) { this.cfg.synced[key] = remoteFp; continue; }
        // zmenené na oboch stranách od poslednej synchronizácie: vyhrá novšia zmena
        if (last !== undefined && mineFp !== last) {
          const mineT = mine ? String(mine.t || '') : String(this.cfg.lastSync || '');
          if (String(row.updated_at || '') < mineT) continue;
        }
        const data = row.deleted ? row.data : await this._localizeRefs(row.data);
        M.applyItem(state, { kind: row.kind, id: row.id, data, deleted: row.deleted, updated_at: row.updated_at });
        this.cfg.synced[key] = remoteFp;
        applied++;
      }
      if (rows.length < 500) break;
      since = rows[rows.length - 1].server_at;
    }
    // databáza je prázdna, hoci sme do nej už posielali (nový projekt na tej istej adrese): pošleme všetko znova
    if (full && !seen && Object.keys(this.cfg.synced).length) {
      log.info('sync: databáza je prázdna, posielam všetko znova');
      this.cfg.synced = {}; this.cfg.files = {}; this.cfg.refs = {};
    }
    if (applied) {
      // bežiaca session z iného PC sa nesmie zmiešať s tou, čo meria tento PC
      this.store.changed('sync');
    }
    this._save();
    return applied;
  }

  /* pošle zmeny z tohto zariadenia */
  async _push() {
    const state = this.store.get();
    this.cfg.synced = this.cfg.synced || {};
    const items = M.collect(state);
    const seen = new Set();
    const rows = [], marks = [];
    const now = new Date().toISOString();
    for (const it of items) {
      const key = it.kind + '|' + it.id;
      seen.add(key);
      const fp = M.fingerprint(it.data);
      if (this.cfg.synced[key] === fp) continue;
      const data = await this._remoteFiles(it.data);
      rows.push({ kind: it.kind, id: it.id, data, deleted: false, updated_at: it.t || now, device: this.cfg.device });
      marks.push([key, fp]);
    }
    for (const key of Object.keys(this.cfg.synced)) {
      if (seen.has(key) || this.cfg.synced[key] === 'deleted' || key.startsWith('meta|')) continue;
      const [kind, ...rest] = key.split('|');
      rows.push({ kind, id: rest.join('|'), data: {}, deleted: true, updated_at: now, device: this.cfg.device });
      marks.push([key, 'deleted']);
    }
    if (!rows.length) return 0;
    await this.sb.push(rows);
    for (const [k, fp] of marks) this.cfg.synced[k] = fp;
    this._save();
    return rows.length;
  }

  /* obrázky na PC nahrá do úložiska a v dátach ich nahradí odkazom sb:// */
  async _remoteFiles(data) {
    const files = M.filesIn(data);
    if (!files.length) return data;
    this.cfg.files = this.cfg.files || {}; this.cfg.refs = this.cfg.refs || {};
    const uid = this.sb.user.id;
    for (const f of files) {
      if (this.cfg.files[f]) continue;
      let p; try { p = fileURLToPath(f); } catch (e) { continue; }
      if (!fs.existsSync(p)) continue;
      const name = path.basename(p);
      let key = uid + '/' + name;
      if (this.cfg.refs[key] && this.cfg.refs[key] !== p) key = uid + '/' + M.cyrb53(p) + '-' + name;
      const ext = name.split('.').pop().toLowerCase();
      await this.sb.upload(key, fs.readFileSync(p), MIME[ext] || 'application/octet-stream');
      this.cfg.files[f] = key; this.cfg.refs[key] = p;
    }
    return M.mapFiles(data, f => this.cfg.files[f] ? 'sb://' + this.cfg.files[f] : null);
  }

  /* odkazy sb:// stiahne do priečinka s obrázkami a nahradí ich súbormi na tomto PC */
  async _localizeRefs(data) {
    const refs = M.refsIn(data);
    if (!refs.length) return data;
    this.cfg.files = this.cfg.files || {}; this.cfg.refs = this.cfg.refs || {};
    for (const key of refs) {
      if (this.cfg.refs[key] && fs.existsSync(this.cfg.refs[key])) continue;
      try {
        const bytes = await this.sb.download(key);
        fs.mkdirSync(this.cacheDir, { recursive: true });
        let file = path.join(this.cacheDir, path.basename(key));
        if (fs.existsSync(file)) file = path.join(this.cacheDir, M.cyrb53(key) + '-' + path.basename(key));
        fs.writeFileSync(file, Buffer.from(bytes));
        this.cfg.refs[key] = file;
        this.cfg.files[pathToFileURL(file).href] = key;
      } catch (e) { log.warn('sync: obrázok sa nestiahol', key, e.message); }
    }
    return M.mapRefs(data, key => this.cfg.refs[key] ? pathToFileURL(this.cfg.refs[key]).href : null);
  }
}

module.exports = { Sync };
