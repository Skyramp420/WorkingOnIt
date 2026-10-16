/* Lokálne API len pre tento počítač (127.0.0.1). Používa ho MCP server pre Claude,
   aby videl živé dáta a mohol zapisovať cez rovnaké akcie ako appka. */
const http = require('http');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);

const PORT = 47480;
const ALLOWED = new Set(['appendNote', 'setStatus', 'createProject', 'createFromText', 'saveSnippet', 'setChecklist', 'addPayment', 'updateProject', 'setFocus', 'saveIdea']);
const PATCH_KEYS = new Set(['title', 'client', 'type', 'deadline', 'reward', 'priority', 'contact']);

class LocalApi {
  constructor({ store, runAction, getLive }) {
    this.store = store;
    this.runAction = runAction;
    this.getLive = getLive;
    this.server = null;
  }
  token() { return this.store.get().settings.localToken; }

  start() {
    if (this.server) return;
    this.server = http.createServer((req, res) => this.handle(req, res).catch(e => this.json(res, 500, { error: e.message })));
    this.server.on('error', e => console.error('LocalApi', e.message));
    this.server.listen(PORT, '127.0.0.1');
  }
  stop() { if (this.server) { this.server.close(); this.server = null; } }

  json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  }

  async handle(req, res) {
    if (req.headers['x-token'] !== this.token()) return this.json(res, 401, { error: t('Zlý token') });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/ping') return this.json(res, 200, { ok: true });
    if (url.pathname === '/state') return this.json(res, 200, { state: this.store.get(), live: this.getLive() });
    if (url.pathname === '/action' && req.method === 'POST') {
      let body = '';
      for await (const c of req) { body += c; if (body.length > 2e6) break; }
      const { type, payload } = JSON.parse(body || '{}');
      if (!ALLOWED.has(type)) return this.json(res, 400, { error: t('Akcia {type} nie je povolená', { type }) });
      if (type === 'saveIdea') {
        // Claude smie meniť len text, štítky, prepojenie a storyboard (nie súbory ani obrázky mimo appky)
        const i = (payload || {}).idea || {};
        const keep = {};
        for (const k of ['id', 'title', 'html', 'text', 'tags', 'projectId', 'aspect', 'frames', 'pinned', 'color']) if (k in i) keep[k] = i[k];
        if (Array.isArray(keep.frames)) keep.frames = keep.frames.map(f => ({ id: f.id, caption: f.caption, shot: f.shot, move: f.move, duration: f.duration, audio: f.audio, image: f.image && /^file:/.test(f.image) ? f.image : '' }));
        payload.idea = keep;
      }
      if (type === 'updateProject') {
        const patch = {};
        for (const [k, v] of Object.entries((payload || {}).patch || {})) if (PATCH_KEYS.has(k)) patch[k] = v;
        payload.patch = patch;
      }
      const result = await this.runAction(type, payload || {}, 'claude');
      return this.json(res, 200, { ok: true, result: result === undefined ? null : result });
    }
    this.json(res, 404, { error: t('Nenájdené') });
  }
}

module.exports = { LocalApi, PORT };
