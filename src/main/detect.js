/* Rozpoznanie projektu v strihacom programe.
   Signály od najsilnejšieho: cesta k súboru projektu v priečinku zákazky, presný názov
   alebo prezývka zákazky, podobný názov, meno klienta, a nakoniec celý názov okna.
   DaVinci a CapCut nemajú cestu v názve okna, preto vieme pozrieť aj ich zoznam projektov,
   After Effects zase prezradí celú cestu vo svojich posledných projektoch. */
const fs = require('fs');
const path = require('path');
const L = require('../shared/logic');

const DAY = 86400000;
const PROJECT_EXT = 'prproj|aep|aepx|drp|veg|vf|blend|mlt|kdenlive|c4d|hfp|wfp|psd|ai|fcpxml|osp|tscproj';
const EXT_RE = new RegExp('\\.(' + PROJECT_EXT + ')$', 'i');

/* nepomenované projekty: čas meriame, ale zákazku z nich nezakladáme */
const UNTITLED = /^(untitled( project| projekt)?|bez n[aá]zvu|nepomenovan[ýy]( projekt)?|new project|nov[ýy] projekt|project|projekt|sequence|sekvencia|timeline|comp(osition)?)(\s*\d+)?$/i;
/* okná a obrazovky programov, ktoré nie sú projekt */
const NOISE = /^(project manager|spr[aá]vca projektov|home|domov|start|welcome|import|edit|export|cut|media|color|fusion|fairlight|deliver|render queue|preferences|predvo[lľ]by|settings|nastavenia|keyboard customization|loading.*|na[cč][ií]tava sa.*|open project|otvori[tť] projekt|save as|ulo[zž]i[tť] ako)$/i;
const APPISH = /\b(davinci|resolve|premiere|after effects|photoshop|illustrator|blender|capcut|adobe|vegas|fusion|shotcut|kdenlive|cinema 4d|filmora|hitfilm|media encoder)\b/i;

/* „Adobe After Effects 2026 - X“, „DaVinci Resolve Studio - X“, „X.veg - VEGAS Pro 22“… */
const RULES = [
  /^adobe (?:after effects|premiere pro|premiere|audition|media encoder|animate|photoshop|illustrator)(?: \(beta\))?(?: (?:cc )?\d{2,4}(?:\.\d+)*)?\s+[-–—]\s+(.+)$/i,
  /^davinci resolve(?: studio)?(?: \d+(?:\.\d+)*)?\s+[-–—]\s+(.+)$/i,
  /^(.+?\.(?:veg|vf))\s*\*?\s*[-–—]\s*(?:magix )?vegas.*$/i,
  /^blender.*?\[(.+?\.blend)\]/i,
  /^\*?\s*(.+?\.blend)\b/i,
  /^cinema 4d.*?[-–—]\s*\[?(.+?\.c4d)\]?.*$/i,
  /^(.+?)\s+[-–—]\s+(?:shotcut|kdenlive|hitfilm.*|filmora.*)$/i
];

/* očistí názov od prípon programov a verzií: „therapie (converted).aep *“ → „therapie“ */
function cleanName(s) {
  let n = String(s || '').trim().replace(/\s*\[(read[- ]only|len na [cč][ií]tanie)\]\s*$/i, '');
  n = n.replace(/[*•]+\s*$/, '').trim();
  n = n.replace(EXT_RE, '');
  for (let i = 0; i < 5; i++) {
    const before = n;
    n = n.replace(/\s*\((converted|konvertovan[ýy]|copy|k[oó]pia|\d+)\)\s*$/i, '')
      .replace(/[\s_-]+(auto-?save|backup|z[aá]loha)(\s*\d+)?$/i, '')
      .replace(/[\s_-]+(final|fin[aá]l|hotovo)$/i, '')
      .replace(/[\s_-]*v\d+(\.\d+)?$/i, '')
      .replace(/[\s_-]+copy(\s*\d+)?$/i, '')
      .trim();
    if (n === before) break;
  }
  return n.replace(/\s{2,}/g, ' ').trim();
}

/* „arena_trailer“ → „Arena trailer“ */
function prettyTitle(name) {
  let t = String(name || '').replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (t && t === t.toLowerCase()) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

const isAbs = p => /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\\\');
const SUBFOLDER = /^(\d{1,2}[_ .-]*)?(_?projekt|projekty|project|projects|ae|after ?effects|premiere|pr|resolve|davinci|blender|edit|editing|strih|_?poznamky)$/i;

/* priečinok projektu: ak je súbor v podpriečinku ako „04_Projekt“, ideme o úroveň vyššie */
function projectFolderOf(file) {
  if (!file || !isAbs(file)) return null;
  const sep = file.includes('\\') ? '\\' : '/';
  const parts = file.split(/[\\/]/); parts.pop();
  if (parts.length > 1 && SUBFOLDER.test(parts[parts.length - 1])) parts.pop();
  const dir = parts.join(sep);
  return dir && !/^[A-Za-z]:$/.test(dir) ? dir : null;
}

/* z názvu okna vytiahne projekt: { name, raw, file, folder, untitled } alebo null (dialóg, panel) */
function extractProjectInfo(proc, title) {
  title = String(title || '').trim();
  if (!title) return null;
  let rest = null;
  for (const re of RULES) { const m = title.match(re); if (m) { rest = m[1]; break; } }
  if (rest == null) {
    // bez známeho tvaru: hľadáme súbor projektu, inak časti okrem názvu programu
    const fm = title.match(new RegExp('((?:[A-Za-z]:[\\\\/]|\\\\\\\\)[^*<>|"]+?\\.(?:' + PROJECT_EXT + '))(?![a-z])', 'i'))
      || title.match(new RegExp('([^\\\\/\\[\\]<>|"]+?\\.(?:' + PROJECT_EXT + '))(?![a-z])', 'i'));
    if (fm) {
      // „VEGAS Pro 22.0 - Arena.veg“: odrežeme názov programu pred súborom
      const segs = fm[1].split(/\s[-–—]\s/);
      while (segs.length > 1 && (APPISH.test(segs[0]) || /^\d+(\.\d+)*$/.test(segs[0].trim()))) segs.shift();
      rest = segs.join(' - ');
    } else {
      const parts = title.split(/\s[-–—|]\s/).map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      const cand = parts.filter(x => !APPISH.test(x));
      if (!cand.length || cand.length === parts.length) return null;
      rest = cand.join(' - ');
    }
  }
  rest = rest.replace(/\s*\*\s*$/, '').trim();
  let file = null, raw = rest;
  if (EXT_RE.test(rest.replace(/[*\s]+$/, ''))) {
    if (isAbs(rest)) file = rest;
    raw = rest.split(/[\\/]/).pop();
  }
  const name = cleanName(raw);
  if (!name || name.length < 2 || NOISE.test(name)) return null;
  const untitled = UNTITLED.test(name);
  return { name, raw: raw.replace(EXT_RE, '').trim(), file, folder: projectFolderOf(file), untitled };
}

/* ---------------------------------------------------------------- spárovanie */
function keysOf(p) {
  const k = [p.title].concat(p.aliases || []);
  if (p.folder) k.push(p.folder.split(/[\\/]/).filter(Boolean).pop());
  return k.filter(Boolean);
}
const alive = (p, now) => p.status !== 'done' || (p.doneAt && Date.parse(p.doneAt) >= now - 21 * DAY);
const lc = s => String(s || '').replace(/[\\/]+$/, '').toLowerCase();
const inside = (file, dir) => { const f = lc(file).replace(/\//g, '\\'), d = lc(dir).replace(/\//g, '\\'); return !!d && f.startsWith(d + '\\'); };
/* všeobecné slová v menách klientov, podľa ktorých sa párovať nedá */
const GENERIC = new Set('studio studios media film films video videos production productions group team official gaming games channel records music entertainment design shop store company agency intro edit trailer project projekt klient client live stream youtube twitch tiktok shorts'.split(' '));
const tokens = s => L.normalize(s) ? String(s).split(/[^A-Za-z0-9À-ž]+/).map(L.normalize).filter(t => t.length >= 4 && !GENERIC.has(t)) : [];

function lastWorked(state, id) {
  let t = '';
  for (const s of state.sessions || []) if (s.projectId === id && s.end > t) t = s.end;
  return t;
}
/* z viacerých kandidátov vyberie tú, na ktorej si naposledy robil, prednostne rozrobenú */
function pickBest(state, list) {
  const rank = { working: 0, revisions: 1, review: 2, todo: 3, done: 4 };
  return list.slice().sort((a, b) => {
    if (a.id === state.focusProjectId) return -1;
    if (b.id === state.focusProjectId) return 1;
    return (rank[a.status] - rank[b.status]) || lastWorked(state, b.id).localeCompare(lastWorked(state, a.id)) || String(b.createdAt).localeCompare(String(a.createdAt));
  })[0];
}

/* nájde zákazku k projektu z editora. Vráti { project, how } alebo { client } (nová zákazka známeho klienta) alebo null */
function matchProject(state, info, title, now) {
  now = now || Date.now();
  const projects = (state.projects || []).filter(p => !p.archived || p.status !== 'done');
  if (info && info.file) {
    let best = null;
    for (const p of state.projects || []) if (p.folder && inside(info.file, p.folder) && (!best || p.folder.length > best.folder.length)) best = p;
    if (best) return { project: best, how: 'folder' };
  }
  if (info && info.name && !info.untitled) {
    const n = L.normalize(info.name);
    const exact = (state.projects || []).filter(p => keysOf(p).some(k => L.normalize(k) === n));
    if (exact.length) return { project: pickBest(state, exact), how: 'name' };
    if (n.length >= 4) {
      let best = null, bestLen = 0;
      for (const p of projects) {
        if (!alive(p, now)) continue;
        // iný priečinok = iná zákazka, aj keď sa názvy podobajú („Arena“ vs. „Arena 2“)
        if (info.folder && p.folder && lc(info.folder) !== lc(p.folder)) continue;
        // len názov a prezývky (dlhý názov priečinka by sa podobal na všetko)
        for (const k of [p.title].concat(p.aliases || [])) {
          const kn = L.normalize(k);
          if (kn.length < 4) continue;
          const hit = n.includes(kn) ? kn.length : (kn.includes(n) && n.length >= 5 && n.length * 2 >= kn.length) ? n.length : 0;
          if (hit > bestLen) { best = p; bestLen = hit; }
        }
      }
      if (best) return { project: best, how: 'similar' };
    }
    // meno klienta: „therapie“ patrí klientovi „StemYk / Therapie“
    const byClient = new Map();
    for (const p of state.projects || []) {
      const cn = L.normalize(p.client);
      if (!cn) continue;
      const ts = tokens(p.client).concat(cn.length >= 4 && !GENERIC.has(cn) ? [cn] : []);
      if (ts.some(t => t === n)) { (byClient.get(cn) || byClient.set(cn, { exact: [], client: p.client }).get(cn)).exact.push(p); }
      else if (ts.some(t => n.includes(t))) { if (!byClient.has(cn)) byClient.set(cn, { exact: [], client: p.client, partial: true }); }
    }
    for (const v of byClient.values()) {
      const live = v.exact.filter(p => alive(p, now));
      if (live.length) return { project: pickBest(state, live), how: 'client' };
    }
    const first = byClient.values().next().value;
    if (first) return { client: first.client };
    return null;
  }
  if (!info) {
    // starý spôsob: názov zákazky kdekoľvek v názve okna
    const t = L.normalize(title);
    if (!t) return null;
    let best = null, bestLen = 0;
    for (const p of projects) {
      if (!alive(p, now)) continue;
      for (const k of keysOf(p)) { const kn = L.normalize(k); if (kn.length >= 4 && t.includes(kn) && kn.length > bestLen) { best = p; bestLen = kn.length; } }
    }
    if (best) return { project: best, how: 'title' };
  }
  return null;
}

/* ---------------------------------------------------------------- priečinok zákazky */
/* „{rok}-{mesiac}_{klient}_{nazov}“ → regulárny výraz s menami skupín */
function patternRegex(pattern) {
  const names = [];
  const re = String(pattern || '').replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (m, k) => {
    k = { year: 'rok', month: 'mesiac', day: 'den', title: 'nazov', client: 'klient', type: 'typ' }[k] || k; // anglické názvy polí
    names.push(k);
    return { rok: '(\\d{4})', mesiac: '(\\d{2})', den: '(\\d{2})', nazov: '(.+)', klient: '(.+?)', typ: '(.+?)' }[k] || '(.+?)';
  });
  return { re: new RegExp('^' + re + '$', 'i'), names };
}
/* ak je projekt v hlavnom priečinku zákaziek, zistí priečinok, klienta a názov */
function inferFromPath(file, settings) {
  const root = settings && settings.rootFolder;
  if (!file || !root || !inside(file, root)) return null;
  const relParts = file.replace(/\//g, '\\').slice(root.replace(/[\\/]+$/, '').length + 1).split('\\');
  if (relParts.length < 2) return null;
  const top = relParts[0];
  const out = { folder: root.replace(/[\\/]+$/, '') + '\\' + top };
  const { re, names } = patternRegex(settings.folderPattern || '{rok}-{mesiac}_{klient}_{nazov}');
  const m = top.match(re);
  if (m) {
    names.forEach((k, i) => { out[k] = m[i + 1]; });
    if (out.klient && !/^(klient|client)$/i.test(out.klient)) out.client = out.klient;
    if (out.nazov && !/^(projekt|project)$/i.test(out.nazov)) out.title = out.nazov;
  }
  return out;
}

/* ---------------------------------------------------------------- posledné projekty programov */
const cache = {};
function cached(key, ms, fn) {
  const c = cache[key];
  if (c && Date.now() - c.at < ms) return c.v;
  let v = null; try { v = fn(); } catch (e) { v = null; }
  cache[key] = { at: Date.now(), v };
  return v;
}
function newestDir(dirs, probe, depth) {
  let best = null;
  const walk = (d, lvl) => {
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      if (!e.isDirectory()) continue;
      const full = path.join(d, e.name);
      let st = null;
      for (const f of probe) { try { const s = fs.statSync(path.join(full, f)); if (!st || s.mtimeMs > st.mtimeMs) st = s; } catch (x) { } }
      if (st) { if (!best || st.mtimeMs > best.mtime) best = { name: e.name, dir: full, mtime: st.mtimeMs }; }
      else if (lvl < depth) walk(full, lvl + 1);
    }
  };
  for (const d of dirs) walk(d, 0);
  return best;
}
/* DaVinci: naposledy uložený projekt v knižnici projektov */
function resolveRecent(appData) {
  return cached('resolve', 15000, () => {
    const base = path.join(appData, 'Blackmagic Design', 'DaVinci Resolve', 'Support');
    const roots = [];
    for (const lib of ['Resolve Project Library', 'Resolve Disk Database']) {
      const users = path.join(base, lib, 'Resolve Projects', 'Users');
      let us = []; try { us = fs.readdirSync(users); } catch (e) { }
      for (const u of us) roots.push(path.join(users, u, 'Projects'));
    }
    const best = newestDir(roots, ['Project.db'], 3);
    return best && Date.now() - best.mtime < 12 * 3600000 ? { name: best.name, at: best.mtime } : null;
  });
}
/* CapCut: posledný upravený koncept */
function capcutRecent(localAppData) {
  return cached('capcut', 15000, () => {
    const roots = [path.join(localAppData, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft')];
    const best = newestDir(roots, ['draft_content.json', 'draft_meta_info.json', 'draft_info.json'], 0);
    return best && Date.now() - best.mtime < 12 * 3600000 ? { name: best.name, at: best.mtime } : null;
  });
}
/* After Effects: celé cesty posledných projektov z predvolieb (názov okna ukazuje len meno súboru) */
function aeRecentPaths(appData) {
  // len hlavný súbor predvolieb (MRU je tam) a najviac raz za 5 minút, aby sme AE nechali na pokoji
  return cached('ae', 5 * 60000, () => {
    const base = path.join(appData, 'Adobe', 'After Effects');
    let vers = []; try { vers = fs.readdirSync(base).filter(v => /^\d+(\.\d+)*$/.test(v)); } catch (e) { return []; }
    vers.sort((a, b) => parseFloat(b) - parseFloat(a));
    for (const v of vers.slice(0, 2)) {
      let files = []; try { files = fs.readdirSync(path.join(base, v)).filter(f => /prefs\.txt$/i.test(f)); } catch (e) { continue; }
      const out = [];
      for (const f of files) {
        let txt = ''; try { txt = fs.readFileSync(path.join(base, v, f), 'utf8'); } catch (e) { continue; }
        if (!/most recently used|mru/i.test(txt)) continue;
        const re = /"((?:[A-Za-z]:|\\\\)[^"\r\n]*?\.aepx?)"/gi;
        let m; while ((m = re.exec(txt))) { const p = m[1].replace(/\\\\/g, '\\'); if (!out.includes(p)) out.push(p); }
      }
      if (out.length) return out;
    }
    return [];
  }) || [];
}
/* doplní chýbajúce údaje podľa programu: celú cestu v AE, projekt v DaVinci a CapCut */
function enrich(proc, title, info, env) {
  env = env || {};
  const p = String(proc || '').toLowerCase().replace(/\.exe$/, '');
  try {
    if (info && !info.file && p === 'afterfx' && env.appData) {
      const hit = aeRecentPaths(env.appData).find(x => cleanName(x.split(/[\\/]/).pop()) === info.name || x.split(/[\\/]/).pop().replace(EXT_RE, '') === info.raw);
      if (hit) return Object.assign({}, info, { file: hit, folder: projectFolderOf(hit) });
    }
    if (!info && p === 'resolve' && env.appData && /^davinci resolve(?: studio)?(?: \d+(?:\.\d+)*)?$/i.test(String(title).trim())) {
      const r = resolveRecent(env.appData);
      if (r) { const name = cleanName(r.name); return { name, raw: r.name, file: null, folder: null, untitled: UNTITLED.test(name), via: 'resolve-library' }; }
    }
    if (!info && p === 'capcut' && env.localAppData) {
      const r = capcutRecent(env.localAppData);
      if (r) { const name = cleanName(r.name); return { name, raw: r.name, file: null, folder: null, untitled: UNTITLED.test(name) || /^\d{4}\s?\d{2}\s?\d{2}/.test(name), via: 'capcut' }; }
    }
  } catch (e) { }
  return info;
}

module.exports = { extractProjectInfo, cleanName, prettyTitle, matchProject, inferFromPath, patternRegex, projectFolderOf, enrich, resolveRecent, capcutRecent, aeRecentPaths, UNTITLED };
