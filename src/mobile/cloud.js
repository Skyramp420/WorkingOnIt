/* Online režim mobilnej verzie: dáta idú priamo z vlastnej databázy používateľa,
   PC nemusí byť zapnuté. Stránka sama žiadne dáta nedrží, prihlásenie je len v tomto telefóne. */
window.Cloud = (function () {
  'use strict';
  const L = window.WOI, M = window.SyncModel;
  const t = (s, v) => (window.I18N ? window.I18N.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)));
  const STORE = 'woi-cloud';
  let sb = null, conf = null, state = null, cursor = null, timer = null, uid = null;
  let onData = function () { }, onStatus = function () { };
  const synced = {}, dirty = new Set(), tombs = new Set(), imgCache = new Map();

  function read() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function write() {
    try { localStorage.setItem(STORE, JSON.stringify({ url: conf.url, key: conf.key, email: conf.email || '', session: sb ? sb.session : null })); } catch (e) { }
  }
  function parseCode(code) {
    const m = String(code || '').match(/WOI1\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { const o = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))); return o.u && o.k ? { url: o.u, key: o.k } : null; } catch (e) { return null; }
  }
  function emptyState() {
    return { projects: [], sessions: [], ideas: [], snippets: [], clients: {}, settings: Object.assign({}, L.DEFAULT_SETTINGS), achievements: {}, focusProjectId: null };
  }

  /* kód z adresy (#c=WOI1.…) alebo uložené prihlásenie */
  function saved() {
    const c = read();
    const fromHash = parseCode(decodeURIComponent((location.hash.match(/c=([^&]+)/) || [])[1] || ''));
    return { conf: fromHash || (c && c.url ? { url: c.url, key: c.key } : null), email: c && c.email, session: c && c.session && (!fromHash || fromHash.url === c.url) ? c.session : null };
  }

  function client(cf, session) {
    conf = cf;
    sb = SB.create({ url: cf.url, key: cf.key, session, onSession: s => { if (s) write(); } });
    uid = session && session.user ? session.user.id : null;
  }

  async function login(code, email, password) {
    const cf = parseCode(code);
    if (!cf) throw new Error(t('Kód nesedí. Nájdeš ho v appke na PC: Nastavenia → Online databáza.'));
    client(cf, null);
    await sb.signIn(String(email || '').trim(), String(password || ''));
    conf.email = String(email || '').trim(); uid = sb.user.id;
    write();
    if (location.hash) history.replaceState(null, '', location.pathname);
    return start();
  }
  function logout() {
    try { localStorage.removeItem(STORE); } catch (e) { }
    if (sb) sb.signOut().catch(function () { });
    clearInterval(timer); sb = null; state = null;
  }

  /* ---------- dáta ---------- */
  async function pull() {
    let since = cursor ? new Date(Date.parse(cursor) - 5000).toISOString() : null;
    let n = 0;
    for (let page = 0; page < 100; page++) {
      const rows = await sb.pull(since, 500);
      for (const r of rows) {
        if (!cursor || r.server_at > cursor) cursor = r.server_at;
        const k = r.kind + '|' + r.id;
        if (dirty.has(k)) continue; // vlastná neodoslaná zmena má prednosť
        M.applyItem(state, r);
        synced[k] = r.deleted ? 'deleted' : M.fingerprint(r.data);
        n++;
      }
      if (rows.length < 500) break;
      since = rows[rows.length - 1].server_at;
    }
    return n;
  }
  async function push() {
    if (!dirty.size && !tombs.size) return;
    const items = new Map(M.collect(state).map(i => [i.kind + '|' + i.id, i]));
    const rows = [];
    for (const k of dirty) {
      const it = items.get(k); if (!it) continue;
      rows.push({ kind: it.kind, id: it.id, data: it.data, updated_at: it.t || new Date().toISOString(), device: 'mobil' });
    }
    for (const k of tombs) { const i = k.indexOf('|'); rows.push({ kind: k.slice(0, i), id: k.slice(i + 1), data: {}, deleted: true, updated_at: new Date().toISOString(), device: 'mobil' }); }
    await sb.push(rows);
    for (const r of rows) synced[r.kind + '|' + r.id] = r.deleted ? 'deleted' : M.fingerprint(r.data);
    dirty.clear(); tombs.clear();
  }
  async function tick() {
    try { await push(); const n = await pull(); onStatus({ ok: true }); if (n) onData(payload()); }
    catch (e) { onStatus({ ok: false, error: e.message, code: e.code }); if (e.code === 'signedout') { logout(); location.reload(); } }
  }
  async function start() {
    state = emptyState(); cursor = null;
    await sb.ensure();
    uid = sb.user.id;
    await pull();
    onStatus({ ok: true });
    onData(payload());
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) tick(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    return true;
  }

  /* rovnaký tvar dát ako posiela PC, aby mobil vyzeral rovnako */
  function payload() {
    const s = state;
    const run = s.sessions.find(x => !x.end && x.manual);
    const recent = s.sessions.filter(x => x.auto && x.end && Date.now() - Date.parse(x.end) < 150000).sort((a, b) => String(b.end).localeCompare(String(a.end)))[0];
    const live = run ? { mode: 'manual', projectId: run.projectId, since: run.start, app: 'Časovač' }
      : recent ? { mode: 'auto', projectId: recent.projectId, since: recent.start, app: recent.app } : { mode: 'off' };
    const ideas = (s.ideas || []).slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 30)
      .map(i => ({ id: i.id, title: i.title, text: String(i.text || '').slice(0, 400), cover: i.cover, projectId: i.projectId, frames: (i.frames || []).length, updatedAt: i.updatedAt }));
    return { projects: s.projects, sessions: s.sessions.filter(x => Date.now() - Date.parse(x.start) < 62 * 86400000), settings: Object.assign({}, s.settings, { ollamaEnabled: false }), ideas, focusProjectId: s.focusProjectId, live, serverTime: Date.now(), cloud: true };
  }

  /* ---------- akcie (rovnaké mená ako na PC) ---------- */
  const nowIso = () => new Date().toISOString();
  const mark = (kind, id) => dirty.add(kind + '|' + id);
  function touch(p) { p.updatedAt = nowIso(); mark('project', p.id); }
  function setFocus(id) { state.focusProjectId = id || null; state.focusAt = nowIso(); mark('meta', 'focus'); }
  function stopRunning() {
    for (const s of state.sessions.slice()) {
      if (s.end || !s.manual) continue;
      s.end = nowIso();
      if (L.sessionMs(s) < 30000) { state.sessions = state.sessions.filter(x => x !== s); dirty.delete('session|' + s.id); if (synced['session|' + s.id]) tombs.add('session|' + s.id); }
      else mark('session', s.id);
    }
  }
  const escH = x => String(x || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function act(type, p) {
    p = p || {};
    const proj = p.id && state.projects.find(x => x.id === p.id);
    let result = true;
    switch (type) {
      case 'setStatus':
        if (proj && L.setStatus(proj, p.status)) { mark('project', proj.id); if (p.status === 'working') setFocus(proj.id); }
        break;
      case 'addPayment': {
        if (!proj) break;
        const a = Number(p.amount) || L.owedOf(proj);
        if (a > 0) { proj.payments = (proj.payments || []).concat([{ at: nowIso(), amount: a, note: p.note || '' }]); touch(proj); }
        break;
      }
      case 'startTimer': {
        stopRunning();
        const s = { id: L.uid(), projectId: p.id || null, app: 'Časovač', start: nowIso(), end: null, manual: true };
        state.sessions.push(s); mark('session', s.id);
        if (p.id) setFocus(p.id);
        break;
      }
      case 'stopTimer': stopRunning(); break;
      case 'appendNote': {
        if (!proj || !String(p.text || '').trim()) break;
        const stamp = new Date().toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
        proj.notes = (proj.notes ? proj.notes + '\n\n' : '') + '[' + stamp + '] ' + p.text;
        if (proj.notesHtml) proj.notesHtml += '<p><b>' + escH(stamp) + '</b> ' + escH(p.text) + '</p>';
        touch(proj);
        break;
      }
      case 'toggleCheck': {
        const c = proj && (proj.checklist || []).find(x => x.id === p.itemId);
        if (c) { c.done = !c.done; touch(proj); }
        break;
      }
      case 'setFocus': setFocus(p.id); break;
      case 'createFromText': {
        const parsed = L.parseMessage(p.text || '');
        const st = state.settings;
        const f = Object.assign({ title: t('Nová zákazka') }, parsed.fields);
        const known = f.client ? L.clientDefaults(state, f.client) : null;
        if (known) { f.client = known.name; f.contact = f.contact || known.contact; }
        f.contact = f.contact || st.defaultContact || 'Discord DM';
        f.type = f.type || (known && known.type) || st.defaultType || 'Edit';
        f.status = f.status || st.defaultStatus || 'todo';
        f.source = 'mobil';
        const np = L.newProject(f);
        state.projects.unshift(np); mark('project', np.id);
        result = np.id;
        break;
      }
      case 'captureIdea': {
        const id = L.uid();
        const lines = String(p.text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        let title = '', body = lines;
        if (lines.length) { if (lines[0].length <= 60) { title = lines[0]; body = lines.slice(1); } else title = lines[0].slice(0, 58).replace(/\s+\S*$/, '') + '…'; }
        let html = body.map(x => '<p>' + escH(x) + '</p>').join(''), cover = '';
        if (p.image && p.image.data) {
          const bin = atob(p.image.data), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const key = uid + '/' + id + '-foto.jpg';
          await sb.upload(key, bytes, 'image/jpeg');
          cover = 'sb://' + key;
          html += '<p><img src="' + cover + '"></p>';
        }
        const it = L.newIdea({ id, title: title || t('Nápad'), html, text: body.join('\n'), cover, tags: [t('z mobilu')] });
        state.ideas = state.ideas || []; state.ideas.unshift(it); mark('idea', id);
        result = id;
        break;
      }
      default:
        throw new Error(t('Toto ide len s appkou na PC.'));
    }
    onData(payload());
    try { await push(); onStatus({ ok: true }); }
    catch (e) { onStatus({ ok: false, error: e.message }); throw new Error(t('Zmena je zatiaľ len v telefóne: {msg}', { msg: e.message })); }
    return result;
  }

  /* obrázky zo súkromného úložiska (sb://cesta) */
  function img(key) {
    if (!imgCache.has(key)) imgCache.set(key, sb.download(key).then(b => URL.createObjectURL(new Blob([b]))).catch(() => ''));
    return imgCache.get(key);
  }
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-sb]').forEach(el => {
      const k = el.getAttribute('data-sb'); el.removeAttribute('data-sb');
      img(k).then(u => { if (u) el.src = u; else el.remove(); });
    });
  }

  return {
    saved, login, logout, start, act, hydrate, img, client,
    set onData(f) { onData = f; }, set onStatus(f) { onStatus = f; },
    get email() { return conf && conf.email; }
  };
})();
