/* Malý klient pre Supabase (prihlásenie, tabuľka woi_items, úložisko obrázkov).
   Bez závislostí, ide v Node 18+ aj v prehliadači (mobilná verzia). */
(function (root) {
  'use strict';

  /* preklady: v appke i18n.js, v mobile window.I18N; bez nich ostane slovenčina */
  let NODE_I18N = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') { try { NODE_I18N = require('./i18n.js'); } catch (e) { } }
  const t = (s, v) => { const i = root.I18N || NODE_I18N; return i ? i.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)); };

  class SbError extends Error {
    constructor(message, code, status) { super(message); this.code = code || ''; this.status = status || 0; }
  }

  /* zrozumiteľné chyby pre používateľa */
  function friendly(status, body, fallback) {
    const msg = (body && (body.msg || body.message || body.error_description || body.error)) || fallback || '';
    const code = body && (body.code || body.error_code || body.error) || '';
    if (status === 0) return new SbError(t('Databáza nie je dostupná. Skontroluj internet.'), 'offline', 0);
    if (/invalid login|invalid_grant|invalid_credentials/i.test(msg + code)) return new SbError(t('Nesprávny e-mail alebo heslo.'), 'credentials', status);
    if (/email not confirmed/i.test(msg)) return new SbError(t('E-mail ešte nie je potvrdený.'), 'unconfirmed', status);
    if (/už má majiteľa|already has an owner|woi_owner_only|Database error saving new user/i.test(msg)) return new SbError(t('Táto databáza už má majiteľa. Prihlás sa jeho e-mailom.'), 'owner', status);
    if (/already registered|user_already_exists/i.test(msg + code)) return new SbError(t('Účet s týmto e-mailom už existuje. Prihlás sa.'), 'exists', status);
    if (/password/i.test(msg) && /(at least|short|weak)/i.test(msg)) return new SbError(t('Heslo je príliš slabé, daj aspoň 8 znakov.'), 'weak', status);
    if (status === 404 || /42P01|does not exist|relation .* does not exist|PGRST205|schema cache/i.test(msg + code)) return new SbError(t('V databáze chýba tabuľka WorkingOnIt. Spusti pripravený SQL kód.'), 'schema', status);
    if (status === 401 && /jwt|expired/i.test(msg)) return new SbError(t('Prihlásenie vypršalo.'), 'expired', status);
    if (status === 401 || status === 403) return new SbError(t('Kľúč alebo prihlásenie nesedí: {msg}', { msg }), 'auth', status);
    if (status === 503 || status === 540 || /paused|inactive/i.test(msg)) return new SbError(t('Databáza je uspatá. Otvor supabase.com a klikni na Restore project.'), 'paused', status);
    if (status === 429) return new SbError(t('Príliš veľa požiadaviek, skúsim to o chvíľu.'), 'rate', status);
    return new SbError(msg || t('Chyba databázy {status}', { status }), code || 'http', status);
  }

  function normUrl(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (u && !/^https?:\/\//.test(u)) u = 'https://' + u;
    return u.replace(/\/(rest|auth|storage)\/v1.*$/, '');
  }

  function create(opts) {
    const url = normUrl(opts.url);
    const key = String(opts.key || '').trim();
    const fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    let session = opts.session || null;          // { access_token, refresh_token, expires_at, user }
    const onSession = opts.onSession || function () { };

    async function call(path, o) {
      o = o || {};
      const headers = Object.assign({ apikey: key }, o.headers || {});
      // nové kľúče (sb_publishable_…) nie sú JWT: bez prihlásenia posielame len apikey
      const bearer = o.token || (session && session.access_token);
      if (o.auth !== false && bearer) headers.Authorization = 'Bearer ' + bearer;
      if (o.json !== undefined) { headers['Content-Type'] = 'application/json'; }
      let res;
      try {
        res = await fetchFn(url + path, { method: o.method || 'GET', headers, body: o.json !== undefined ? JSON.stringify(o.json) : o.body, signal: o.signal });
      } catch (e) { throw friendly(0, null, e.message); }
      if (o.raw) {
        if (!res.ok) { let b = null; try { b = await res.json(); } catch (x) { } throw friendly(res.status, b, res.statusText); }
        return res;
      }
      const text = await res.text();
      let body = null; try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text }; }
      if (!res.ok) throw friendly(res.status, body, res.statusText);
      return body;
    }

    function setSession(s) {
      if (s && s.access_token) {
        session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)), user: s.user ? { id: s.user.id, email: s.user.email } : (session && session.user) };
      } else session = null;
      onSession(session);
      return session;
    }

    async function signUp(email, password) {
      const r = await call('/auth/v1/signup', { method: 'POST', json: { email, password }, auth: false });
      if (r && r.access_token) setSession(r);
      return r;
    }
    async function signIn(email, password) {
      return setSession(await call('/auth/v1/token?grant_type=password', { method: 'POST', json: { email, password }, auth: false }));
    }
    async function refresh() {
      if (!session || !session.refresh_token) throw new SbError(t('Nie si prihlásený.'), 'signedout');
      try { return setSession(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: session.refresh_token }, auth: false })); }
      catch (e) { if (e.status === 400 || e.status === 401) { setSession(null); e.code = 'signedout'; e.message = t('Prihlásenie vypršalo, prihlás sa znova.'); } throw e; }
    }
    async function ensure() {
      if (!session) throw new SbError(t('Nie si prihlásený.'), 'signedout');
      if (session.expires_at - Math.floor(Date.now() / 1000) < 90) await refresh();
      return session;
    }
    async function authed(path, o) {
      await ensure();
      try { return await call(path, o); }
      catch (e) { if (e.code === 'expired' || (e.status === 401 && session && session.refresh_token)) { await refresh(); return call(path, o); } throw e; }
    }
    async function signOut() {
      if (session) { try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) { } }
      setSession(null);
    }

    /* položky: zmeny od kurzora (server_at), po stránkach */
    async function pull(since, limit) {
      limit = limit || 500;
      let q = '/rest/v1/woi_items?select=kind,id,data,deleted,updated_at,server_at,device&order=server_at.asc&limit=' + limit;
      if (since) q += '&server_at=gt.' + encodeURIComponent(since);
      return authed(q);
    }
    async function push(items) {
      if (!items.length) return;
      const uid = session && session.user && session.user.id;
      const rows = items.map(i => ({ owner: uid, kind: i.kind, id: i.id, data: i.data || {}, deleted: !!i.deleted, updated_at: i.updated_at || new Date().toISOString(), device: i.device || null }));
      for (let i = 0; i < rows.length; i += 200) {
        await authed('/rest/v1/woi_items?on_conflict=owner,kind,id', { method: 'POST', json: rows.slice(i, i + 200), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      }
    }
    /* overenie, či je tabuľka pripravená (bez prihlásenia vráti prázdny zoznam) */
    async function probe() {
      await call('/rest/v1/woi_items?select=id&limit=1');
      return true;
    }

    /* úložisko: súkromný bucket „woi“, cesta začína id používateľa */
    const objPath = p => p.split('/').map(encodeURIComponent).join('/');
    async function upload(path, bytes, type) {
      await authed('/storage/v1/object/woi/' + objPath(path), { method: 'POST', body: bytes, headers: { 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' } });
      return path;
    }
    async function download(path) {
      const res = await authed('/storage/v1/object/authenticated/woi/' + objPath(path), { raw: true });
      return new Uint8Array(await res.arrayBuffer());
    }

    return {
      url, key,
      get session() { return session; },
      get user() { return session && session.user; },
      setSession, signUp, signIn, signOut, refresh, ensure, pull, push, probe, upload, download, call
    };
  }

  const api = { create, normUrl, SbError, friendly };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SB = api;
})(typeof window !== 'undefined' ? window : globalThis);
