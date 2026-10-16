/* Model synchronizácie: stav appky ↔ položky v databáze (tabuľka woi_items).
   Zdieľa ho desktop aj mobilná verzia. Obrázky sú v databáze ako „sb://cesta“, na PC ako file:// súbor. */
(function (root) {
  'use strict';

  /* nastavenia, ktoré sú rovnaké na všetkých zariadeniach (zvyšok je pre každé PC zvlášť) */
  const SHARED_SETTINGS = ['userName', 'brand', 'mascotName', 'kit', 'kitPersona', 'kitPersonaCustom', 'kitPersonaExtra',
    'contactTypes', 'projectTypes', 'defaultContact', 'defaultType', 'defaultStatus', 'hourlyGoal', 'archiveAfterDays',
    'ignoredNames', 'theme', 'appearance', 'accent', 'language', 'currency', 'newProjectMode', 'autoStatus', 'folderPattern', 'folderTemplate'];

  const FILE_RE = /file:\/\/\/[^"'\s)<>\\]+?\.(?:png|jpe?g|webp|gif)/gi;
  const REF_RE = /sb:\/\/[^"'\s)<>\\]+/g;

  /* JSON so zoradenými kľúčmi: databáza (jsonb) poradie kľúčov mení */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /* rýchly 53-bitový hash */
  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const base = u => decodeURIComponent(String(u).split(/[\\/]/).pop());
  /* odtlačok obsahu; obrázky porovnávame podľa mena súboru, nie celej cesty */
  function fingerprint(data) {
    return cyrb53(canon(data).replace(FILE_RE, m => 'img:' + base(m)).replace(REF_RE, m => 'img:' + base(m)));
  }

  function pick(o, keys) { const r = {}; for (const k of keys) if (o && o[k] !== undefined) r[k] = o[k]; return r; }

  /* všetky položky zo stavu: { kind, id, data, t } (t = čas poslednej zmeny pre „kto vyhrá“) */
  function collect(state) {
    const out = [];
    for (const p of state.projects || []) out.push({ kind: 'project', id: p.id, data: p, t: p.updatedAt || p.createdAt || '' });
    for (const s of state.sessions || []) if (s.end || s.manual) out.push({ kind: 'session', id: s.id, data: s, t: s.end || s.start || '' });
    for (const i of state.ideas || []) out.push({ kind: 'idea', id: i.id, data: i, t: i.updatedAt || i.createdAt || '' });
    for (const n of state.snippets || []) out.push({ kind: 'snippet', id: n.id, data: n, t: n.updatedAt || n.createdAt || '' });
    for (const k of Object.keys(state.clients || {})) out.push({ kind: 'client', id: k, data: state.clients[k], t: state.clients[k].updatedAt || '' });
    out.push({ kind: 'meta', id: 'settings', data: pick(state.settings || {}, SHARED_SETTINGS), t: (state.settings || {}).sharedAt || '' });
    out.push({ kind: 'meta', id: 'achievements', data: state.achievements || {}, t: '' });
    out.push({ kind: 'meta', id: 'focus', data: { projectId: state.focusProjectId || null }, t: state.focusAt || '' });
    return out;
  }

  const LISTS = { project: 'projects', session: 'sessions', idea: 'ideas', snippet: 'snippets' };
  function replaceInPlace(target, data) {
    for (const k of Object.keys(target)) if (!(k in data)) delete target[k];
    Object.assign(target, data);
    return target;
  }

  /* zapíše položku z databázy do stavu (na mieste, aby ostali odkazy, napr. bežiaca session) */
  function applyItem(state, it) {
    const list = LISTS[it.kind];
    if (list) {
      state[list] = state[list] || [];
      const arr = state[list];
      const i = arr.findIndex(x => x.id === it.id);
      if (it.deleted) { if (i >= 0) arr.splice(i, 1); return; }
      const data = Object.assign({}, it.data, { id: it.id });
      if (i >= 0) replaceInPlace(arr[i], data);
      else if (it.kind === 'session') arr.push(data);
      else arr.unshift(data);
      return;
    }
    if (it.kind === 'client') {
      state.clients = state.clients || {};
      if (it.deleted) delete state.clients[it.id]; else state.clients[it.id] = Object.assign({}, it.data);
      return;
    }
    if (it.kind === 'meta' && it.id === 'settings' && !it.deleted) {
      state.settings = state.settings || {};
      Object.assign(state.settings, pick(it.data, SHARED_SETTINGS));
      if (it.updated_at) state.settings.sharedAt = it.updated_at;
      return;
    }
    if (it.kind === 'meta' && it.id === 'achievements' && !it.deleted) {
      // odznaky sa len pridávajú: zjednotíme, platí skorší dátum
      state.achievements = state.achievements || {};
      for (const [k, v] of Object.entries(it.data || {})) if (!state.achievements[k] || String(v) < String(state.achievements[k])) state.achievements[k] = v;
      return;
    }
    if (it.kind === 'meta' && it.id === 'focus' && !it.deleted) {
      state.focusProjectId = (it.data && it.data.projectId) || null;
      if (it.updated_at) state.focusAt = it.updated_at;
    }
  }

  /* obrázky: file:// → sb://kľúč (pred odoslaním) a naopak (po stiahnutí) */
  function mapFiles(data, fn) {
    const s = JSON.stringify(data);
    if (!/file:\/\/\//i.test(s)) return data;
    return JSON.parse(s.replace(FILE_RE, m => fn(m) || m));
  }
  function mapRefs(data, fn) {
    const s = JSON.stringify(data);
    if (s.indexOf('sb://') < 0) return data;
    return JSON.parse(s.replace(REF_RE, m => fn(m.slice(5)) || m));
  }
  function filesIn(data) { return Array.from(new Set((JSON.stringify(data).match(FILE_RE) || []))); }
  function refsIn(data) { return Array.from(new Set((JSON.stringify(data).match(REF_RE) || []).map(r => r.slice(5)))); }

  const api = { SHARED_SETTINGS, canon, fingerprint, collect, applyItem, mapFiles, mapRefs, filesIn, refsIn, pick, cyrb53 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SyncModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
