#!/usr/bin/env node
/* WorkingOnIt MCP server pre Claude (desktop appka).
   Spúšťa ho Claude cez stdio. Dáta číta zo spustenej appky (127.0.0.1:47480),
   a keď appka nebeží, aspoň zo súboru data.json (len na čítanie).
   Vie: zákazky, poznámky, snímky z videí a renderov, skripty v After Effects. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFile } = require('child_process');
const L = require('../shared/logic');
const P = require('../shared/parse');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);
const EN = () => I18N.lang === 'en';
const q = s => EN() ? '“' + s + '”' : '„' + s + '“';

const VERSION = '1.6.0';
const DATA_DIR = process.env.WOI_DATA || path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'WorkingOnIt');
const API_PORT = 47480;
const log = (...a) => process.stderr.write('[workingonit-mcp] ' + a.join(' ') + '\n');

/* ---------- dáta ---------- */
function readFileState() {
  for (const f of ['data.json', 'data.json.bak']) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } catch (e) { }
  }
  return null;
}
function apiCall(method, pathname, body) {
  const st = readFileState();
  const token = st && st.settings && st.settings.localToken;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: API_PORT, path: pathname, method, headers: { 'Content-Type': 'application/json', 'x-token': token || '' }, timeout: 4000 }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { const j = JSON.parse(b); res.statusCode >= 400 ? reject(new Error(j.error || t('Chyba {status}', { status: res.statusCode }))) : resolve(j); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function getState() {
  try { const r = await apiCall('GET', '/state'); return { state: r.state, live: r.live, online: true }; }
  catch (e) {
    const st = readFileState();
    if (!st) throw new Error(t('Nenašiel som dáta WorkingOnIt v {dir}. Je appka nainštalovaná a aspoň raz spustená?', { dir: DATA_DIR }));
    return { state: st, live: null, online: false };
  }
}
async function action(type, payload) {
  try { return (await apiCall('POST', '/action', { type, payload })).result; }
  catch (e) {
    if (/ECONNREFUSED|timeout|socket/i.test(e.message)) throw new Error(t('WorkingOnIt nebeží. Spusti appku a skús to znova (zapisovať viem len do spustenej appky).'));
    throw e;
  }
}

function findProject(state, ref) {
  if (!ref) throw new Error(t('Chýba zákazka (id alebo názov).'));
  const byId = state.projects.find(p => p.id === ref);
  if (byId) return byId;
  const n = L.normalize(ref);
  const hits = state.projects.filter(p => L.normalize(p.title).includes(n) || n.includes(L.normalize(p.title)));
  const active = hits.filter(p => L.isActive(p, state.settings));
  if (hits.length === 1) return hits[0];
  if (active.length === 1) return active[0];
  if (!hits.length) throw new Error(t('Zákazku {ref} som nenašiel. Aktívne: {list}', { ref: q(ref), list: state.projects.filter(p => L.isActive(p, state.settings)).map(p => p.title).join(', ') }));
  throw new Error(t('Viac zákaziek sedí na {ref}: {list}. Upresni id.', { ref: q(ref), list: hits.map(p => p.title + ' (id ' + p.id + ')').join(', ') }));
}
const statusLabel = id => (L.STATUSES.find(s => s.id === id) || {}).label || id;
function projectLine(state, p) {
  const ms = L.projectMs(state, p.id);
  const d = L.deadlineInfo(p);
  return `- ${p.title} [id ${p.id}] · ${statusLabel(p.status)} · ${t('klient {name}', { name: p.client || '?' })} · ${t(p.type)}` +
    (p.deadline && p.status !== 'done' ? ` · deadline ${p.deadline} (${d.label})` : '') +
    (p.reward ? ' · ' + t('{reward} (zaplatené {paid})', { reward: L.formatMoney(p.reward), paid: L.formatMoney(L.paidOf(p)) }) : '') +
    (ms > 60000 ? ` · ${L.formatDuration(ms)}` : '') +
    (L.isArchived(p, state.settings) ? t(' · archív') : '');
}

/* ---------- ffmpeg ---------- */
function ffmpegPath() {
  try {
    let p = require('ffmpeg-static');
    if (p) { p = p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep); if (fs.existsSync(p)) return p; }
  } catch (e) { }
  return 'ffmpeg';
}
function run(bin, args, opts) {
  return new Promise((resolve, reject) => {
    const ch = spawn(bin, args, Object.assign({ windowsHide: true }, opts || {}));
    const out = [], err = [];
    ch.stdout.on('data', d => out.push(d));
    ch.stderr.on('data', d => err.push(d));
    ch.on('error', reject);
    ch.on('close', code => resolve({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString() }));
  });
}
async function probe(file) {
  const r = await run(ffmpegPath(), ['-hide_banner', '-i', file]);
  const s = r.stderr;
  const dur = s.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const vid = s.match(/Stream[^\n]*Video:\s*([^,\s]+)[^\n]*?,\s*(\d{2,5})x(\d{2,5})/);
  const fps = s.match(/,\s*([\d.]+)\s*fps/);
  const aud = s.match(/Stream[^\n]*Audio:\s*([^,\s]+)/);
  return {
    duration: dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : null,
    codec: vid ? vid[1] : null, width: vid ? +vid[2] : null, height: vid ? +vid[3] : null,
    fps: fps ? parseFloat(fps[1]) : null, audio: aud ? aud[1] : null,
    size: (() => { try { return fs.statSync(file).size; } catch (e) { return null; } })()
  };
}
async function frameAt(file, at, width) {
  const r = await run(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, at)), '-i', file, '-frames:v', '1',
    '-vf', `scale='min(${width},iw)':-2`, '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '5', 'pipe:1']);
  if (!r.stdout.length) throw new Error(t('Snímku v čase {sec} s sa nepodarilo vytiahnuť.', { sec: at.toFixed(2) }) + ' ' + r.stderr.slice(0, 200));
  return r.stdout;
}
const tc = sec => { const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

/* ---------- After Effects ---------- */
function findAfterEffects(state) {
  const custom = state && state.settings && state.settings.aePath;
  if (custom && fs.existsSync(custom)) return custom;
  const roots = [process.env.ProgramFiles || 'C:\\Program Files', 'C:\\Program Files'];
  const found = [];
  for (const r of roots) {
    const adobe = path.join(r, 'Adobe');
    try {
      for (const d of fs.readdirSync(adobe)) {
        if (!/after effects/i.test(d)) continue;
        const exe = path.join(adobe, d, 'Support Files', 'AfterFX.exe');
        if (fs.existsSync(exe)) found.push(exe);
      }
    } catch (e) { }
  }
  return found.sort().reverse()[0] || null;
}
function aeRunning() {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve(false);
    execFile('tasklist', ['/FI', 'IMAGENAME eq AfterFX.exe', '/NH'], { windowsHide: true }, (e, out) => resolve(!e && /AfterFX\.exe/i.test(out || '')));
  });
}
const AE_SERIALIZER = `function __ser(v, d) { d = d || 0; if (d > 6) return '"…"'; if (v === null || v === undefined) return 'null'; var t = typeof v;
 if (t === 'number') return isFinite(v) ? String(v) : 'null'; if (t === 'boolean') return String(v);
 if (t === 'string') return '"' + v.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"').replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r').replace(/\\t/g, '\\\\t') + '"';
 if (v instanceof Array) { var a = []; for (var i = 0; i < v.length && i < 500; i++) a.push(__ser(v[i], d + 1)); return '[' + a.join(',') + ']'; }
 if (t === 'object') { var o = []; for (var k in v) { try { o.push(__ser(String(k)) + ':' + __ser(v[k], d + 1)); } catch (e) { } } return '{' + o.join(',') + '}'; }
 return __ser(String(v)); }`;
async function aeRun(code, undoName) {
  if (process.platform !== 'win32') throw new Error(t('After Effects most funguje len vo Windows.'));
  const { state } = await getState().catch(() => ({ state: null }));
  const exe = findAfterEffects(state);
  if (!exe) throw new Error(t('Nenašiel som After Effects (AfterFX.exe). Cestu môžeš nastaviť vo WorkingOnIt → Nastavenia → Claude.'));
  if (!(await aeRunning())) throw new Error(t('After Effects nebeží. Otvor ho aj s projektom a skús to znova.'));
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dir = path.join(os.tmpdir(), 'workingonit-ae');
  fs.mkdirSync(dir, { recursive: true });
  const jsx = path.join(dir, 'run-' + id + '.jsx'), out = path.join(dir, 'out-' + id + '.json');
  const head = `(function () {
${AE_SERIALIZER}
var __out = new File(${JSON.stringify(out.replace(/\\/g, '/'))});
var __r, __ok = true;
app.beginUndoGroup(${JSON.stringify(undoName || 'Claude')});
try { __r = (function () {
`;
  const offset = head.split('\n').length - 1;
  const script = head + `${code}
})(); } catch (e) { __ok = false; __r = String(e) + (e.line ? ${JSON.stringify(t(' (riadok {n} v kóde)'))}.replace('{n}', e.line - ${offset}) : ''); }
app.endUndoGroup();
__out.encoding = 'UTF-8'; __out.open('w'); __out.write('{"ok":' + __ok + ',"result":' + __ser(__r) + '}'); __out.close();
})();`;
  fs.writeFileSync(jsx, '\uFEFF' + script, 'utf8');
  spawn(exe, ['-r', jsx], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    await new Promise(r => setTimeout(r, 400));
    if (fs.existsSync(out)) {
      await new Promise(r => setTimeout(r, 150));
      const txt = fs.readFileSync(out, 'utf8').replace(/^\uFEFF/, '');
      try { fs.unlinkSync(out); fs.unlinkSync(jsx); } catch (e) { }
      return JSON.parse(txt);
    }
  }
  throw new Error(t('After Effects neodpovedal do 60 s. Skontroluj: 1) v AE Edit → Preferences → Scripting & Expressions je zapnuté „Allow Scripts to Write Files and Access Network“, 2) v AE nie je otvorené žiadne dialógové okno.'));
}
const AE_INFO = () => `var p = app.project; var res = { project: p.file ? p.file.fsName : ${JSON.stringify(t('(neuložený)'))}, items: p.numItems, version: app.version };
var c = p.activeItem;
if (c && c instanceof CompItem) {
  res.activeComp = { name: c.name, width: c.width, height: c.height, fps: c.frameRate, duration: c.duration, time: c.time, layers: [] };
  for (var i = 1; i <= c.numLayers && i <= 200; i++) { var l = c.layer(i);
    res.activeComp.layers.push({ index: i, name: l.name, type: l.matchName, inPoint: l.inPoint, outPoint: l.outPoint, enabled: l.enabled, selected: l.selected }); }
} else { res.comps = []; for (var j = 1; j <= p.numItems && res.comps.length < 60; j++) if (p.item(j) instanceof CompItem) res.comps.push(p.item(j).name); }
return res;`;

/* ---------- nástroje ---------- */
const TOOLS = [
  {
    name: 'get_overview',
    description: "Overview of the user's video-editing work from the WorkingOnIt app: active jobs with status, deadlines and money, what's overdue, who owes money, tracked time today/this week, and what is being timed right now. Start here when the user asks what to work on or how things stand. Data is in the app's language (Slovak or English).",
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const { state, live, online } = await getState();
      const now = Date.now();
      const active = state.projects.filter(p => p.status !== 'done' && !L.isArchived(p, state.settings)).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
      const m = L.moneyStats(state, now);
      const owed = state.projects.filter(p => p.status === 'done' && L.owedOf(p) > 0);
      const liveP = live && live.projectId && state.projects.find(p => p.id === live.projectId);
      const M = v => L.formatMoney(v), today = new Date().toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
      const lines = active.map(p => projectLine(state, p)).join('\n');
      const owedTxt = owed.map(p => `${p.client || p.title} ${M(L.owedOf(p))}`).join(', ');
      const dayT = L.formatDuration(L.msBetween(state, L.startOfDay(now), now + 1)), weekT = L.formatDuration(L.msBetween(state, L.startOfWeek(now), now + 1));
      const tracking = live && (live.mode === 'auto' || live.mode === 'manual');
      const appName = live && live.app ? t(live.app) : '';
      if (EN()) return text(`WorkingOnIt (${online ? 'app is running' : 'app isn’t running, data from file'}) · today ${today}
Active jobs (${active.length}):
${lines || '- none'}
Owed for finished jobs: ${owed.length ? owedTxt : 'nobody'}
Money this month: ${M(m.thisMonth)} · in jobs in progress ${M(m.pipeline)}${m.hourly ? ' · real rate ' + M(Math.round(m.hourly * 10) / 10) + '/h' : ''} · goal ${M(state.settings.hourlyGoal)}/h
Time: today ${dayT}, this week ${weekT}
${tracking ? 'Tracking now: ' + (liveP ? liveP.title : 'no job') + ' in ' + appName : 'Nothing is being tracked right now.'}`);
      return text(`WorkingOnIt (${online ? 'appka beží' : 'appka nebeží, dáta zo súboru'}) · dnes ${today}
Aktívne zákazky (${active.length}):
${lines || '- žiadne'}
Dlhujú za hotové: ${owed.length ? owedTxt : 'nikto'}
Peniaze tento mesiac: ${M(m.thisMonth)} · v rozrobených ${M(m.pipeline)}${m.hourly ? ' · reálne ' + M(Math.round(m.hourly * 10) / 10) + '/h' : ''} · cieľ ${M(state.settings.hourlyGoal)}/h
Čas: dnes ${dayT}, týždeň ${weekT}
${tracking ? 'Práve sa meria: ' + (liveP ? liveP.title : 'bez projektu') + ' v ' + appName : 'Práve sa nič nemeria.'}`);
    }
  },
  {
    name: 'list_projects',
    description: 'List jobs (zákazky) in WorkingOnIt. filter: "active" (default), "all", "archived", or a status id: todo, working, review, revisions, done. Optional text query matches title/client.',
    inputSchema: { type: 'object', properties: { filter: { type: 'string' }, query: { type: 'string' } } },
    run: async ({ filter, query }) => {
      const { state } = await getState();
      const f = filter || 'active';
      let list = state.projects.filter(p => f === 'all' ? true : f === 'archived' ? L.isArchived(p, state.settings) : f === 'active' ? p.status !== 'done' && !L.isArchived(p, state.settings) : p.status === f);
      if (query) { const q = L.normalize(query); list = list.filter(p => L.normalize(p.title + ' ' + p.client + ' ' + p.type).includes(q)); }
      return text(list.length ? list.map(p => projectLine(state, p)).join('\n') : t('Nič nesedí na filter.'));
    }
  },
  {
    name: 'get_project',
    description: 'Full detail of one job: brief/notes (as the user wrote them, may contain the client message in Czech/Slovak/English), checklist, renders with file paths, tracked time by app, payments, project folder, revision rounds, and notes about the client. Use the project id or (part of) its title.',
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'job id or name' } }, required: ['project'] },
    run: async ({ project }) => {
      const { state } = await getState();
      const p = findProject(state, project);
      const byApp = {};
      for (const s of state.sessions) if (s.projectId === p.id) byApp[s.app] = (byApp[s.app] || 0) + L.sessionMs(s);
      const cl = (state.clients || {})[L.clientKey(p.client)] || {};
      const tip = L.priceTip(state, p.type, p.id);
      const M = v => L.formatMoney(v);
      const prio = p.priority ? (L.PRIORITIES.find(x => x.id === p.priority) || {}).label || p.priority : '-';
      const timeT = L.formatDuration(L.projectMs(state, p.id)) + (Object.keys(byApp).length ? ' (' + Object.entries(byApp).map(([a, ms]) => t(a) + ' ' + L.formatDuration(ms)).join(', ') + ')' : '');
      const steps = (p.checklist || []).map(c => (c.done ? '[x] ' : '[ ] ') + c.text).join(' | ') || '-';
      const renders = (p.renders || []).map(r => `${r.name} (${(r.size / 1048576).toFixed(1)} MB, ${r.at.slice(0, 16).replace('T', ' ')}) → ${r.file}`).join('\n  ') || '-';
      if (EN()) return text(`${p.title} [id ${p.id}]
Status: ${statusLabel(p.status)}${p.revisions ? ' · revision round ' + p.revisions : ''} · type ${t(p.type)} · priority ${prio}
Client: ${p.client || '?'} (${t(p.contact)})${cl.notes ? '\nNotes about the client: ' + cl.notes : ''}
Deadline: ${p.deadline || '-'} · fee ${M(p.reward || 0)} · paid ${M(L.paidOf(p))}${tip ? ` · usually ${M(tip.medReward)} for ${t(p.type)}` : ''}
Folder: ${p.folder || '(none)'}
Time: ${timeT}
Steps: ${steps}
Renders: ${renders}

Brief and notes:
${p.notes || '(empty)'}`);
      return text(`${p.title} [id ${p.id}]
Stav: ${statusLabel(p.status)}${p.revisions ? ' · ' + p.revisions + '. kolo úprav' : ''} · typ ${p.type} · priorita ${prio}
Klient: ${p.client || '?'} (${p.contact})${cl.notes ? '\nPoznámky o klientovi: ' + cl.notes : ''}
Deadline: ${p.deadline || '-'} · odmena ${M(p.reward || 0)} · zaplatené ${M(L.paidOf(p))}${tip ? ` · zvyčajne za ${p.type} ${M(tip.medReward)}` : ''}
Priečinok: ${p.folder || '(nemá)'}
Čas: ${timeT}
Postup: ${steps}
Rendery: ${renders}

Zadanie a poznámky:
${p.notes || '(prázdne)'}`);
    }
  },
  {
    name: 'add_project_note',
    description: 'Append a timestamped note to a job in WorkingOnIt (e.g. feedback summary, shot list, ideas, what was done). Shows up on the job page. Requires the app to be running.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, text: { type: 'string' } }, required: ['project', 'text'] },
    run: async ({ project, text: note }) => {
      const { state } = await getState();
      const p = findProject(state, project);
      await action('appendNote', { id: p.id, text: note });
      return text(t('Poznámka pridaná do {title}.', { title: q(p.title) }));
    }
  },
  {
    name: 'set_project_status',
    description: 'Move a job to another status: todo (Na rade), working (Pracujem), review (klient pozerá), revisions (Úpravy), done (Hotovo).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, status: { type: 'string', enum: ['todo', 'working', 'review', 'revisions', 'done'] } }, required: ['project', 'status'] },
    run: async ({ project, status }) => {
      const { state } = await getState();
      const p = findProject(state, project);
      await action('setStatus', { id: p.id, status });
      return text(`${q(p.title)} → ${statusLabel(status)}.`);
    }
  },
  {
    name: 'create_project',
    description: 'Create a new job. Either pass the raw client message in `message` (the app parses client, type, price and deadline itself), or explicit fields. Creates the project folder too if the user has that enabled.',
    inputSchema: { type: 'object', properties: { message: { type: 'string' }, title: { type: 'string' }, client: { type: 'string' }, type: { type: 'string', enum: L.TYPES }, deadline: { type: 'string', description: 'YYYY-MM-DD' }, reward: { type: 'number' }, notes: { type: 'string' } } },
    run: async (a) => {
      let id;
      if (a.message && !a.title) id = await action('createFromText', { text: a.message });
      else {
        const fields = { title: a.title || t('Nová zákazka'), client: a.client || '', type: a.type || 'Edit', deadline: a.deadline || '', reward: a.reward || 0, notes: [a.notes, a.message].filter(Boolean).join('\n\n') };
        id = await action('createProject', { fields });
      }
      const { state } = await getState();
      const p = state.projects.find(x => x.id === id);
      return text(t('Vytvorené: {what}', { what: p ? projectLine(state, p) : id }));
    }
  },
  {
    name: 'look_at_video',
    description: "Extract evenly spaced still frames from a video file (a render, footage, or reference) so you can see it and give editing feedback: pacing, framing, text readability, color consistency, transitions, hook in the first seconds. Pass `path`, or `project` to use that job's newest render. Optionally limit to a time range. Note: you only see frames, not audio.",
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, project: { type: 'string' }, count: { type: 'number', description: 'number of frames, 1–16, default 8' }, start_sec: { type: 'number' }, end_sec: { type: 'number' } } },
    run: async ({ path: file, project, count, start_sec, end_sec }) => {
      if (!file) {
        const { state } = await getState();
        const p = findProject(state, project);
        const r = (p.renders || [])[0];
        if (!r) throw new Error(t('Zákazka {title} zatiaľ nemá zachytený žiadny render. Pošli cestu k videu v parametri path.', { title: q(p.title) }));
        file = r.file;
      }
      if (!fs.existsSync(file)) throw new Error(t('Súbor neexistuje: {file}', { file }));
      const info = await probe(file);
      if (!info.duration) throw new Error(t('Toto nevyzerá ako video, ktoré ffmpeg vie prečítať.'));
      const n = Math.max(1, Math.min(16, Math.round(count || 8)));
      const a = Math.max(0, Math.min(info.duration, start_sec || 0)), b = Math.max(a + 0.1, Math.min(info.duration, end_sec || info.duration));
      const span = b - a, out = [];
      const width = n > 10 ? 640 : 860;
      const times = [];
      for (let i = 0; i < n; i++) times.push(a + span * (i + 0.5) / n);
      out.push({ type: 'text', text: `${path.basename(file)} · ${info.width}×${info.height}${info.fps ? ' · ' + info.fps + ' fps' : ''} · ${info.codec || '?'} · ${t('dĺžka {d}', { d: tc(info.duration) })}${info.size ? ' · ' + (info.size / 1048576).toFixed(1) + ' MB' : ''}${info.audio ? ' · ' + t('zvuk {codec}', { codec: info.audio }) : ' · ' + t('bez zvuku')}\n${t('Snímky z úseku {a}–{b}:', { a: tc(a), b: tc(b) })}` });
      for (const at of times) {
        const jpg = await frameAt(file, at, width);
        out.push({ type: 'text', text: t('Čas {tc}', { tc: tc(at) }) });
        out.push({ type: 'image', data: jpg.toString('base64'), mimeType: 'image/jpeg' });
      }
      return { content: out };
    }
  },
  {
    name: 'look_at_image',
    description: 'Show an image file from disk (thumbnail, design, screenshot, frame) so you can review it.',
    inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: async ({ path: file }) => {
      if (!fs.existsSync(file)) throw new Error(t('Súbor neexistuje: {file}', { file }));
      const ext = path.extname(file).toLowerCase();
      const size = fs.statSync(file).size;
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) && size < 3.5e6) {
        return { content: [{ type: 'image', data: fs.readFileSync(file).toString('base64'), mimeType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg' }] };
      }
      const jpg = await frameAt(file, 0, 1568);
      return { content: [{ type: 'image', data: jpg.toString('base64'), mimeType: 'image/jpeg' }] };
    }
  },
  {
    name: 'ae_get_project_info',
    description: 'Read the currently open Adobe After Effects project: project path, active composition (size, fps, duration, current time) and its layers (name, type, in/out, selected), or the list of compositions. After Effects must be running on the user\'s PC.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => { const r = await aeRun(AE_INFO(), 'Claude: info'); return text((r.ok ? '' : t('CHYBA: ')) + JSON.stringify(r.result, null, 1)); }
  },
  {
    name: 'ae_run_script',
    description: "Run ExtendScript (JavaScript ES3, After Effects scripting DOM: app.project, CompItem, layers, properties, expressions) inside the user's running After Effects. The code is the BODY of a function: use `return` to send a value back (objects/arrays are serialized). Everything runs in one undo group, so the user can undo it with one Ctrl+Z. Use ES3 only (var, no arrow functions, no let/const, no template strings). Prefer reading with ae_get_project_info first, make targeted changes, and tell the user what you changed. Never delete or overwrite their work without asking.",
    inputSchema: { type: 'object', properties: { code: { type: 'string' }, undo_name: { type: 'string', description: 'name of the step in the Undo history' } }, required: ['code'] },
    run: async ({ code, undo_name }) => {
      const r = await aeRun(code, undo_name ? 'Claude: ' + undo_name : 'Claude');
      return text(r.ok ? 'OK\n' + JSON.stringify(r.result, null, 1) : t('CHYBA v skripte: {msg}', { msg: r.result }), !r.ok);
    }
  },
  {
    name: 'save_snippet',
    description: 'Save a reusable snippet (AE expression, Fusion expression, Resolve Lua console script, export settings, text) into WorkingOnIt → Templates (Šablóny), so the user can copy it later.',
    inputSchema: { type: 'object', properties: { program: { type: 'string', enum: ['resolve', 'ae', 'premiere', 'other'] }, title: { type: 'string' }, code: { type: 'string' }, note: { type: 'string' } }, required: ['program', 'title', 'code'] },
    run: async (a) => { await action('saveSnippet', { snippet: { program: a.program, title: a.title, code: a.code, note: a.note || t('Od Claude') } }); return text(t('Uložené do Šablóny.')); }
  },
  {
    name: 'list_templates',
    description: "List the user's template folders (per program: DaVinci Resolve, After Effects, Premiere, other) with the files in them, and their saved snippets.",
    inputSchema: { type: 'object', properties: { program: { type: 'string', enum: ['resolve', 'ae', 'premiere', 'other'] } } },
    run: async ({ program }) => {
      const { state } = await getState();
      const tf = state.settings.templateFolders || {};
      const lines = [];
      for (const prog of program ? [program] : ['resolve', 'ae', 'premiere', 'other']) {
        for (const dir of tf[prog] || []) {
          let files = [];
          try { files = fs.readdirSync(dir).slice(0, 80); } catch (e) { }
          lines.push(`[${prog}] ${dir}\n  ${files.join('\n  ') || t('(prázdne)')}`);
        }
        for (const sn of (state.snippets || []).filter(x => x.program === prog)) lines.push(`[${prog}] snippet ${q(sn.title)}: ${sn.code.slice(0, 200)}`);
      }
      return text(lines.join('\n') || t('Zatiaľ žiadne šablóny.'));
    }
  },
  {
    name: 'list_ideas',
    description: 'List ideas and storyboards from the WorkingOnIt idea notebook (title, text, tags, linked job, storyboard frames). Optional filter by text or linked job.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search text (optional)' }, project: { type: 'string', description: 'Only ideas linked to this job (id or name, optional)' } } },
    async run(a) {
      const { state } = await getState();
      let list = state.ideas || [];
      if (a.project) { const p = findProject(state, a.project); list = list.filter(i => i.projectId === p.id); }
      if (a.query) { const n = L.normalize(a.query); list = list.filter(i => L.normalize((i.title || '') + ' ' + (i.text || '') + ' ' + (i.tags || []).join(' ')).includes(n)); }
      if (!list.length) return text(a.query || a.project ? t('Žiadne nápady pre tento filter.') : t('Zatiaľ žiadne nápady.'));
      return text(list.slice(0, 40).map(i => {
        const proj = i.projectId && state.projects.find(p => p.id === i.projectId);
        const fr = (i.frames || []);
        return `## ${i.title || t('Bez názvu')} [id ${i.id}]${proj ? t(' · zákazka: {title}', { title: proj.title }) : ''}${(i.tags || []).length ? ' · #' + i.tags.join(' #') : ''}\n${String(i.text || '').slice(0, 1500) || t('(bez textu)')}` +
          (fr.length ? `\nStoryboard (${i.aspect || '16:9'}, ${L.storyboardSeconds(i)} s):\n` + fr.map((f, k) => `${k + 1}. ${f.shot ? t(f.shot) : t('záber')}${f.move ? ', ' + t(f.move) : ''}, ${f.duration || 0} s: ${f.caption || '-'}${f.audio ? t(' (zvuk: {a})', { a: f.audio }) : ''}${f.image ? t(' [má obrázok]') : ''}`).join('\n') : '');
      }).join('\n\n'));
    }
  },
  {
    name: 'save_idea',
    description: 'Create a new idea (or update one by id) in the WorkingOnIt idea notebook, optionally with a storyboard. Use it to save brainstorms, shot lists and storyboards so the user can sketch over them in the app. Text is plain text (new lines become paragraphs). Frames replace the existing storyboard when given.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Existing idea id to update (optional)' },
        title: { type: 'string' },
        text: { type: 'string', description: 'Plain text of the idea / notes' },
        tags: { type: 'array', items: { type: 'string' } },
        project: { type: 'string', description: 'Link to a job (id or name, optional)' },
        aspect: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
        frames: { type: 'array', description: 'Storyboard frames in order', items: { type: 'object', properties: { caption: { type: 'string' }, shot: { type: 'string', description: 'e.g. Detail, Polocelok, Celok, POV, Gameplay, Text / grafika' }, move: { type: 'string', description: 'e.g. Statický, Pan, Zoom in, Speed ramp' }, duration: { type: 'number', description: 'seconds' }, audio: { type: 'string' } } } }
      }
    },
    async run(a) {
      const { state } = await getState();
      const idea = {};
      if (a.id) { if (!(state.ideas || []).some(i => i.id === a.id)) throw new Error(t('Nápad s týmto id neexistuje.')); idea.id = a.id; }
      if (a.title != null) idea.title = String(a.title).slice(0, 120);
      if (a.text != null) {
        const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        idea.text = String(a.text);
        idea.html = idea.text.split(/\r?\n/).map(l => l.trim() ? '<p>' + esc(l) + '</p>' : '').join('');
      }
      if (Array.isArray(a.tags)) idea.tags = a.tags.map(String).slice(0, 12);
      if (a.project) idea.projectId = findProject(state, a.project).id;
      if (a.aspect) idea.aspect = a.aspect;
      if (Array.isArray(a.frames)) idea.frames = a.frames.slice(0, 60).map(f => ({ caption: String(f.caption || ''), shot: String(f.shot || ''), move: String(f.move || ''), duration: Number(f.duration) || 3, audio: String(f.audio || '') }));
      if (!idea.id && !idea.title) idea.title = (idea.text || t('Nápad')).split(/\r?\n/)[0].slice(0, 60);
      const id = await action('saveIdea', { idea });
      const nf = idea.frames ? idea.frames.length : 0;
      return text(t('Uložené do Nápadov') + (nf ? t(', storyboard má {shots}', { shots: nf + ' ' + L.plural(nf, 'záber', 'zábery', 'záberov') }) : '') + '. id ' + id);
    }
  }
];

function text(s, isError) { return { content: [{ type: 'text', text: s }], isError: !!isError }; }

function instructions() {
  const st = readFileState();
  const set = (st && st.settings) || {};
  const who = String(set.userName || '').trim() || 'The user';
  const brand = String(set.brand || '').trim();
  const apps = L.editorNames(set.editorApps || '').filter(n => !/photoshop|illustrator/i.test(n));
  return `WorkingOnIt is ${who === 'The user' ? 'the user\'s' : who + "'s"} personal job tracker for video-editing work${brand ? ' (' + brand + ')' : ''}: edits, motion graphics, intros, trailers, shorts.${apps.length ? ' Editors in use: ' + apps.join(', ') + '.' : ''} ${set.language === 'en' ? 'The app is in English; reply in English unless the user writes in another language.' : 'The app is in Slovak; reply in Slovak unless the user writes in another language.'}
Use get_overview to see current jobs, get_project for a brief, look_at_video to actually see renders before giving feedback, and add_project_note to save useful results (shot lists, feedback summaries) to the job. Use list_ideas / save_idea for the user's idea notebook and storyboards (a storyboard is a list of frames with caption, shot type, camera move and duration in seconds). ae_get_project_info and ae_run_script work inside a running After Effects. For DaVinci Resolve Studio 21.1+ the user can enable Resolve's own built-in MCP (File → Setup AI Assistants).`;
}

/* ---------- JSON-RPC cez stdio ---------- */
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
/* jazyk výstupov podľa nastavení appky */
function useLang() {
  const st = readFileState();
  const s = (st && st.settings) || {};
  I18N.setLang(s.language === 'en' ? 'en' : 'sk');
  I18N.setCurrency(s.currency);
}
async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notifikácie ignorujeme
  try {
    if (method === 'initialize' || method === 'tools/call') useLang();
    if (method === 'initialize') {
      return send({ jsonrpc: '2.0', id, result: { protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'workingonit', version: VERSION }, instructions: instructions() } });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS.map(x => ({ name: x.name, description: x.description, inputSchema: x.inputSchema })) } });
    if (method === 'tools/call') {
      const tool = TOOLS.find(x => x.name === params.name);
      if (!tool) return send({ jsonrpc: '2.0', id, error: { code: -32602, message: t('Neznámy nástroj {name}', { name: params.name }) } });
      try { return send({ jsonrpc: '2.0', id, result: await tool.run(params.arguments || {}) }); }
      catch (e) { return send({ jsonrpc: '2.0', id, result: text(t('Chyba: {msg}', { msg: e.message }), true) }); }
    }
    if (method === 'resources/list') return send({ jsonrpc: '2.0', id, result: { resources: [] } });
    if (method === 'prompts/list') return send({ jsonrpc: '2.0', id, result: { prompts: [] } });
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { log('zlý JSON', line.slice(0, 80)); continue; }
    handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
log('beží, dáta v', DATA_DIR);
