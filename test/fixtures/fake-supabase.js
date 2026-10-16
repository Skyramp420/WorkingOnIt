/* Falošný Supabase na testy synchronizácie: prihlásenie (GoTrue), tabuľka woi_items (PostgREST) a úložisko.
   Správa sa ako projekt po spustení nášho SQL: jeden majiteľ, RLS podľa vlastníka. */
const http = require('http');
const crypto = require('crypto');

function start(opts) {
  opts = opts || {};
  const KEY = opts.key || 'sb_publishable_test_0123456789abcdef';
  const db = { users: [], tokens: new Map(), refresh: new Map(), items: new Map(), files: new Map(), schema: opts.schema !== false, seq: 0 };
  let last = Date.now();
  const stamp = () => { let t = Date.now(); if (t <= last) t = last + 1; last = t; return new Date(t).toISOString().replace('Z', '') + String(++db.seq % 1000).padStart(3, '0') + 'Z'; };

  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const userOf = req => { const a = String(req.headers.authorization || '').replace(/^Bearer /, ''); return db.tokens.get(a) || null; };
  const issue = u => {
    const access = 'at-' + crypto.randomBytes(8).toString('hex'), refresh = 'rt-' + crypto.randomBytes(8).toString('hex');
    db.tokens.set(access, u); db.refresh.set(refresh, u);
    return { access_token: access, refresh_token: refresh, expires_in: opts.expiresIn || 3600, token_type: 'bearer', user: { id: u.id, email: u.email } };
  };
  const body = req => new Promise(r => { const ch = []; req.on('data', c => ch.push(c)); req.on('end', () => r(Buffer.concat(ch))); });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__ctl') { const raw0 = await body(req); Object.assign(db, JSON.parse(raw0.toString() || '{}')); return json(res, 200, { schema: db.schema, users: db.users.length, items: db.items.size, files: db.files.size }); }
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' }); return res.end(); }
    if (req.headers.apikey !== KEY) return json(res, 401, { message: 'Invalid API key' });
    if (opts.paused) return json(res, 540, { message: 'Project is paused' });
    const raw = await body(req);
    const b = () => { try { return JSON.parse(raw.toString() || '{}'); } catch (e) { return {}; } };

    // ---- prihlásenie
    if (u.pathname === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = b();
      if (String(password || '').length < 6) return json(res, 422, { code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      if (db.users.some(x => x.email === email)) return json(res, 422, { code: 'user_already_exists', msg: 'User already registered' });
      if (db.users.length >= 1) return json(res, 500, { code: 'unexpected_failure', msg: 'Database error saving new user: Táto databáza už má majiteľa.' });
      const user = { id: crypto.randomUUID(), email, password };
      db.users.push(user);
      return json(res, 200, { id: user.id, email, confirmation_sent_at: new Date().toISOString() });
    }
    if (u.pathname === '/auth/v1/token' && req.method === 'POST') {
      const p = b();
      if (u.searchParams.get('grant_type') === 'password') {
        const user = db.users.find(x => x.email === p.email && x.password === p.password);
        if (!user) return json(res, 400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return json(res, 200, issue(user));
      }
      if (u.searchParams.get('grant_type') === 'refresh_token') {
        const user = db.refresh.get(p.refresh_token);
        if (!user) return json(res, 400, { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        db.refresh.delete(p.refresh_token);
        return json(res, 200, issue(user));
      }
    }
    if (u.pathname === '/auth/v1/logout') { db.tokens.delete(String(req.headers.authorization || '').replace(/^Bearer /, '')); return json(res, 204); }

    // ---- tabuľka
    if (u.pathname === '/rest/v1/woi_items') {
      if (!db.schema) return json(res, 404, { code: 'PGRST205', message: "Could not find the table 'public.woi_items' in the schema cache" });
      const user = userOf(req);
      if (req.method === 'GET') {
        if (!user) return json(res, 200, []);
        const since = (u.searchParams.get('server_at') || '').replace(/^gt\./, '');
        const limit = Number(u.searchParams.get('limit')) || 1000;
        const rows = Array.from(db.items.values()).filter(r => r.owner === user.id && (!since || r.server_at > since)).sort((a, c) => a.server_at < c.server_at ? -1 : 1).slice(0, limit);
        return json(res, 200, rows.map(r => ({ kind: r.kind, id: r.id, data: JSON.parse(JSON.stringify(r.data)), deleted: r.deleted, updated_at: r.updated_at, server_at: r.server_at, device: r.device })));
      }
      if (req.method === 'POST') {
        if (!user) return json(res, 401, { message: 'JWT expired' });
        for (const r of b()) {
          if (r.owner && r.owner !== user.id) return json(res, 403, { code: '42501', message: 'new row violates row-level security policy' });
          // jsonb mení poradie kľúčov: zoradíme ich, nech to test odhalí
          const sorted = JSON.parse(JSON.stringify(r.data, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reverse().reduce((o, x) => (o[x] = v[x], o), {}) : v));
          db.items.set(user.id + '|' + r.kind + '|' + r.id, { owner: user.id, kind: r.kind, id: r.id, data: sorted, deleted: !!r.deleted, updated_at: r.updated_at, device: r.device, server_at: stamp() });
        }
        return json(res, 201);
      }
    }

    // ---- úložisko
    const up = u.pathname.match(/^\/storage\/v1\/object\/woi\/(.+)$/);
    if (up && req.method === 'POST') {
      const user = userOf(req); if (!user) return json(res, 401, { message: 'Unauthorized' });
      const p = decodeURIComponent(up[1]);
      if (!p.startsWith(user.id + '/')) return json(res, 403, { message: 'new row violates row-level security policy' });
      db.files.set(p, raw); return json(res, 200, { Key: 'woi/' + p });
    }
    const dl = u.pathname.match(/^\/storage\/v1\/object\/authenticated\/woi\/(.+)$/);
    if (dl && req.method === 'GET') {
      const user = userOf(req); if (!user) return json(res, 401, { message: 'Unauthorized' });
      const p = decodeURIComponent(dl[1]);
      if (!p.startsWith(user.id + '/') || !db.files.has(p)) return json(res, 404, { message: 'Object not found' });
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); return res.end(db.files.get(p));
    }
    json(res, 404, { message: 'not found ' + u.pathname });
  });
  return new Promise(resolve => server.listen(opts.port || 0, '127.0.0.1', () => {
    const port = server.address().port;
    resolve({ url: 'http://127.0.0.1:' + port, key: KEY, db, set: o => Object.assign(opts, o), stop: () => new Promise(r => server.close(r)) });
  }));
}

module.exports = { start };
// samostatne: node test/fixtures/fake-supabase.js 54321
if (require.main === module) start({ schema: false, port: Number(process.argv[2]) || 54321 }).then(s => console.log('fake supabase', s.url, s.key));
