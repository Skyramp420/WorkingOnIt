/* Mobilný prístup: malý web server v appke. Doma cez wifi, mimo domu cez Tailscale.
   Chránené tajným tokenom z QR kódu. */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);

const ALLOWED = new Set(['setStatus', 'addPayment', 'startTimer', 'stopTimer', 'createFromText', 'appendNote', 'toggleCheck', 'setFocus', 'captureIdea']);

/* súbory mobilnej verzie; rovnaké posiela aj verejná online verzia (scripts/build-mobile-web.js) */
const MOBILE_FILES = ['/shared/i18n.js', '/shared/lang-en.js', '/shared/logic.js', '/shared/parse.js', '/shared/sbclient.js', '/shared/syncmodel.js', '/renderer/mascot.js', '/renderer/rte.js', '/renderer/kit.js', '/mobile/cloud.js'];
// cesty v node_modules/@fontsource-variable
const MOBILE_FONTS = {
  '/fonts/bricolage-latin.woff2': 'bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2',
  '/fonts/bricolage-latin-ext.woff2': 'bricolage-grotesque/files/bricolage-grotesque-latin-ext-standard-normal.woff2',
  '/fonts/inter-latin.woff2': 'inter/files/inter-latin-wght-normal.woff2',
  '/fonts/inter-latin-ext.woff2': 'inter/files/inter-latin-ext-wght-normal.woff2',
};
const manifest = () => ({ name: 'WorkingOnIt', short_name: 'WorkingOnIt', start_url: './', scope: './', display: 'standalone', background_color: '#1c1713', theme_color: '#1c1713', icons: [{ src: 'icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] });

function addresses(port, token) {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifs)) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const [x, y] = a.address.split('.').map(Number);
      const tailscale = x === 100 && y >= 64 && y <= 127;
      const lan = x === 192 || x === 10 || (x === 172 && y >= 16 && y <= 31);
      if (!tailscale && !lan) continue;
      out.push({ name, ip: a.address, kind: tailscale ? 'tailscale' : 'lan', url: `http://${a.address}:${port}/?t=${token}` });
    }
  }
  // Tailscale prvý, potom domáca sieť; virtuálne adaptéry (vEthernet, VirtualBox) dozadu
  const rank = a => (a.kind === 'tailscale' ? 0 : /vethernet|virtual|vmware|wsl|hyper-v/i.test(a.name) ? 2 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

class RemoteServer {
  constructor({ store, runAction, rootDir, kitChat, userData }) {
    this.store = store;
    this.runAction = runAction;
    this.rootDir = rootDir;
    this.kitChat = kitChat;
    this.userData = userData;
    this.server = null;
    this.clients = new Set();
    this.error = null;
    store.on('changed', () => this.push());
  }

  token() { return this.store.get().settings.remoteToken; }

  authed(req, url) {
    const tok = this.token();
    if (url.searchParams.get('t') === tok) return true;
    if (req.headers['x-token'] === tok) return true;
    const cookie = req.headers.cookie || '';
    return cookie.split(/;\s*/).some(c => c === 'woi=' + tok);
  }

  start() {
    this.stop();
    const st = this.store.get().settings;
    if (!st.remoteEnabled) return;
    this.error = null;
    this.server = http.createServer((req, res) => this.handle(req, res).catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }));
    this.server.on('error', e => { this.error = e.code === 'EADDRINUSE' ? t('Port {port} je obsadený. Zmeň ho v Nastaveniach.', { port: st.remotePort }) : e.message; });
    this.server.listen(Number(st.remotePort) || 4747, '0.0.0.0');
  }

  stop() {
    for (const c of this.clients) { try { c.end(); } catch (e) { } }
    this.clients.clear();
    if (this.server) { try { this.server.close(); } catch (e) { } this.server = null; }
  }

  info() {
    const st = this.store.get().settings;
    return { enabled: !!st.remoteEnabled, running: !!this.server && !this.error, error: this.error, port: st.remotePort, addresses: addresses(st.remotePort, st.remoteToken) };
  }

  payload() {
    const s = this.store.get();
    return JSON.stringify({
      projects: s.projects,
      sessions: s.sessions.filter(x => Date.now() - Date.parse(x.start) < 62 * 86400000),
      settings: { userName: s.settings.userName, mascotName: s.settings.mascotName, kit: s.settings.kit, hourlyGoal: s.settings.hourlyGoal, archiveAfterDays: s.settings.archiveAfterDays, ollamaEnabled: s.settings.ollamaEnabled, brand: s.settings.brand },
      ideas: (s.ideas || []).slice(0, 30).map(i => ({ id: i.id, title: i.title, text: String(i.text || '').slice(0, 400), cover: i.cover, projectId: i.projectId, frames: (i.frames || []).length, updatedAt: i.updatedAt })),
      focusProjectId: s.focusProjectId,
      live: this.store.live.tracking || { mode: 'off' },
      serverTime: Date.now()
    });
  }

  push() {
    clearTimeout(this._pushT);
    this._pushT = setTimeout(() => {
      const data = 'data: ' + this.payload() + '\n\n';
      for (const c of this.clients) { try { c.write(data); } catch (e) { } }
    }, 250);
  }

  async handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const send = (code, type, body, extra) => { res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra || {})); res.end(body); };

    if (MOBILE_FILES.includes(url.pathname)) {
      return send(200, 'text/javascript; charset=utf-8', fs.readFileSync(path.join(this.rootDir, 'src', url.pathname)));
    }
    const font = MOBILE_FONTS[url.pathname];
    if (font) {
      try { return send(200, 'font/woff2', fs.readFileSync(path.join(this.rootDir, 'node_modules', '@fontsource-variable', ...font.split('/'))), { 'Cache-Control': 'max-age=604800' }); }
      catch (e) { return send(404, 'text/plain', ''); }
    }
    if (url.pathname === '/icon.png') return send(200, 'image/png', fs.readFileSync(path.join(this.rootDir, 'assets', 'icon.png')));
    if (url.pathname === '/manifest.json') return send(200, 'application/manifest+json', JSON.stringify(manifest()));

    if (!this.authed(req, url)) {
      return send(401, 'text/html; charset=utf-8', '<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#1c1713;color:#efe8dc;font:16px system-ui;padding:32px"><h2>WorkingOnIt</h2><p>' + t('Na tento odkaz treba prístupový kód. V appke na PC otvor Nastavenia, Mobil cez wifi, a naskenuj QR kód.') + '</p></body>');
    }

    const cookie = { 'Set-Cookie': 'woi=' + this.token() + '; Max-Age=31536000; Path=/; SameSite=Strict; HttpOnly' };

    if (url.pathname === '/' && req.method === 'GET') {
      if (url.searchParams.get('t')) return send(302, 'text/plain', '', Object.assign({ Location: '/' }, cookie));
      return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(this.rootDir, 'src', 'mobile', 'mobile.html')), cookie);
    }
    if (url.pathname === '/api/state') return send(200, 'application/json; charset=utf-8', this.payload());
    if (url.pathname === '/api/img') {
      // obrázky z poznámok: len z priečinkov zákaziek a z dát appky
      let file;
      try { file = require('url').fileURLToPath(url.searchParams.get('u') || ''); } catch (e) { return send(400, 'text/plain', ''); }
      const ok = /\.(png|jpe?g|gif|webp)$/i.test(file) && (file.startsWith(path.join(this.userData, 'obrazky') + path.sep) || this.store.get().projects.some(p => p.folder && file.startsWith(path.join(p.folder, '_poznamky') + path.sep)));
      if (!ok || !fs.existsSync(file)) return send(404, 'text/plain', '');
      const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
      return send(200, 'image/' + ext, fs.readFileSync(file), { 'Cache-Control': 'max-age=86400' });
    }
    if (url.pathname === '/api/kit' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 300000) break; }
      const { messages, projectId } = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      const ctrl = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
      try { await this.kitChat({ messages, projectId, signal: ctrl.signal, onDelta: d => res.write(d) }); }
      catch (e) { if (e.name !== 'AbortError') res.write('\n\n⚠ ' + e.message); }
      return res.end();
    }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('data: ' + this.payload() + '\n\n');
      this.clients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { } }, 25000);
      req.on('close', () => { clearInterval(ping); this.clients.delete(res); });
      return;
    }
    if (url.pathname === '/api/action' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 12e6) return send(413, 'application/json', JSON.stringify({ error: t('Príliš veľký súbor') })); }
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { return send(400, 'application/json', JSON.stringify({ error: t('Zlá požiadavka') })); }
      const { type, payload } = parsed;
      if (!ALLOWED.has(type)) return send(400, 'application/json', JSON.stringify({ error: t('Nepovolená akcia') }));
      try {
        const result = await this.runAction(type, payload || {}, 'mobile');
        return send(200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, result: result === undefined ? null : result }));
      } catch (e) { return send(500, 'application/json', JSON.stringify({ error: e.message })); }
    }
    send(404, 'text/plain; charset=utf-8', t('Nenájdené'));
  }
}

module.exports = { RemoteServer, MOBILE_FILES, MOBILE_FONTS, manifest };
