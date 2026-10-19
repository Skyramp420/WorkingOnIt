/* Lokálne AI cez Ollamu: zistí stav, keď treba spustí server na pozadí,
   spravuje modely a streamuje chat. Všetko beží len na tomto PC. */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);
const gb = n => n.toLocaleString(I18N.locale()) + ' GB';

/* odporúčané modely; tagy overené v knižnici Ollamy (Gemma 4 potrebuje Ollamu 0.22+) */
const MODELS = [
  { name: 'gemma4:12b-it-qat', title: 'Gemma 4 · 12B', get size() { return gb(7.2); }, minVram: 10, get note() { return t('Najlepší pomer slovenčiny a rýchlosti. Celý sa zmestí do grafiky s 10 GB a viac.'); } },
  { name: 'gemma4:26b-a4b-it-qat', title: 'Gemma 4 · 26B MoE', get size() { return gb(16); }, minVram: 20, get note() { return t('Ešte lepšie odpovede. Pri 16 GB grafiky sa časť presunie do RAM, takže odpovedá pomalšie.'); } },
  { name: 'gemma4:e4b-it-qat', title: 'Gemma 4 · E4B', get size() { return gb(6.1); }, minVram: 6, get note() { return t('Pre grafiky s 6–8 GB. Rýchly, slovenčina je o niečo slabšia.'); } },
  { name: 'gemma4:e2b-it-qat', title: 'Gemma 4 · E2B', get size() { return gb(4.3); }, minVram: 0, get note() { return t('Najmenší, pre notebooky a slabšie PC.'); } }
];
const MIN_VERSION = '0.22.0';

function baseUrl() {
  let h = String(process.env.OLLAMA_HOST || '').trim();
  if (!h) return 'http://127.0.0.1:11434';
  if (!/^https?:\/\//i.test(h)) h = 'http://' + h;
  try {
    const u = new URL(h);
    if (['0.0.0.0', '[::]', '::'].includes(u.hostname)) u.hostname = '127.0.0.1';
    if (!u.port) u.port = '11434';
    return u.origin;
  } catch (e) { return 'http://127.0.0.1:11434'; }
}
let BASE = baseUrl();
const setBase = url => { BASE = url || baseUrl(); };

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* fetch s časovým limitom; external = signál zvonku (napr. Stop v chate) */
async function req(p, { method = 'GET', body, timeout = 4000, signal } = {}) {
  const ctrl = new AbortController();
  const tmo = timeout ? setTimeout(() => ctrl.abort(new Error('timeout')), timeout) : null;
  const onAbort = () => ctrl.abort(signal.reason);
  if (signal) { if (signal.aborted) ctrl.abort(signal.reason); else signal.addEventListener('abort', onAbort, { once: true }); }
  try {
    return await fetch(BASE + p, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
  } finally {
    if (tmo) clearTimeout(tmo);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

function cmpVersion(a, b) {
  const pa = String(a || '0').split(/[.-]/).map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}

async function version() {
  try {
    const r = await req('/api/version', { timeout: 1500 });
    if (!r.ok) return null;
    const j = await r.json();
    return j.version || '0';
  } catch (e) { return null; }
}

/* kde môže byť ollama.exe / ollama */
function candidates() {
  const out = [];
  if (process.platform === 'win32') {
    const la = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    out.push(path.join(la, 'Programs', 'Ollama', 'ollama.exe'));
    for (const pf of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) out.push(path.join(pf, 'Ollama', 'ollama.exe'));
  } else if (process.platform === 'darwin') {
    out.push('/Applications/Ollama.app/Contents/Resources/ollama', '/opt/homebrew/bin/ollama', '/usr/local/bin/ollama');
  } else {
    out.push('/usr/local/bin/ollama', '/usr/bin/ollama');
  }
  const exe = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) if (dir) out.push(path.join(dir.replace(/^"|"$/g, ''), exe));
  return out;
}
function findExe(custom) {
  for (const f of [custom].concat(candidates()).filter(Boolean)) {
    try { if (fs.statSync(f).isFile()) return f; } catch (e) { /* ďalší */ }
  }
  return null;
}

/* Spustí `ollama serve` potichu na pozadí (bez okna).
   Pozor: nie „detached“. Odpojený proces na Windowse nemá vôbec konzolu, a tak každý pomocný proces,
   ktorý si Ollama spustí (hľadanie grafiky, načítanie modelu), otvoril vlastné čierne okno CMD.
   Takto má Ollama skrytú konzolu a jej pomocníci ju zdedia, takže sa neukáže nič. */
let starting = null;
async function ensureRunning({ autoStart = true, exe = '', logFile = '' } = {}) {
  const v = await version();
  if (v) return { running: true, installed: true, version: v, versionOk: cmpVersion(v, MIN_VERSION) >= 0 };
  const bin = findExe(exe);
  if (!autoStart || !bin) return { running: false, installed: !!bin, exe: bin };
  if (starting) return starting;
  starting = (async () => {
    let out = 'ignore';
    try {
      if (logFile) { fs.mkdirSync(path.dirname(logFile), { recursive: true }); out = fs.openSync(logFile, 'a'); }
    } catch (e) { out = 'ignore'; }
    try {
      const child = spawn(bin, ['serve'], { detached: false, windowsHide: true, stdio: ['ignore', out, out], env: Object.assign({}, process.env) });
      child.on('error', () => { });
      child.unref();
    } catch (e) {
      return { running: false, installed: true, exe: bin, error: t('Ollamu sa nepodarilo spustiť: {msg}', { msg: e.message }) };
    } finally {
      if (typeof out === 'number') { try { fs.closeSync(out); } catch (e) { } }
    }
    for (let i = 0; i < 60; i++) {
      await sleep(i < 10 ? 250 : 500);
      const v2 = await version();
      if (v2) return { running: true, installed: true, started: true, exe: bin, version: v2, versionOk: cmpVersion(v2, MIN_VERSION) >= 0 };
    }
    return { running: false, installed: true, exe: bin, error: t('Ollama sa nespustila ani po 25 sekundách.') };
  })();
  try { return await starting; } finally { starting = null; }
}

async function models() {
  const r = await req('/api/tags', { timeout: 4000 });
  if (!r.ok) throw new Error(t('Ollama vrátila chybu {status}.', { status: r.status }));
  const j = await r.json();
  return (j.models || []).map(m => ({ name: m.name, size: m.size, modified: m.modified_at, family: m.details && m.details.family, params: m.details && m.details.parameter_size }));
}

/* vyberie model: nastavený, ak existuje, inak rovnaký rod, inak prvý stiahnutý */
async function resolveModel(wanted) {
  const list = (await models()).map(m => m.name);
  if (!list.length) throw new Error(t('V Ollame nemáš stiahnutý žiadny model. Stiahneš ho v Nastaveniach → Lokálne AI.'));
  const w = String(wanted || '');
  const hit = list.find(n => n === w) || list.find(n => n === w + ':latest') || list.find(n => n.split(':')[0] === w.split(':')[0]);
  return hit || list[0];
}

const capCache = new Map();
async function capabilities(model) {
  if (capCache.has(model)) return capCache.get(model);
  let caps = [];
  try {
    const r = await req('/api/show', { method: 'POST', body: { model, name: model }, timeout: 5000 });
    if (r.ok) { const j = await r.json(); caps = j.capabilities || []; }
  } catch (e) { /* staršia Ollama: bez capabilities */ }
  capCache.set(model, caps);
  return caps;
}

function friendlyError(msg, model) {
  const m = String(msg || '');
  if (/not found|no such model|pull the model/i.test(m)) return t('Model „{model}“ nie je stiahnutý. Stiahneš ho v Nastaveniach → Lokálne AI.', { model });
  if (/out of memory|cudaMalloc|insufficient memory|requires more system memory/i.test(m)) return t('Na model nestačí pamäť. Zavri ťažké programy (napr. render) alebo vyber menší model.');
  if (/ECONNREFUSED|fetch failed|ECONNRESET|socket/i.test(m)) return t('Spojenie s Ollamou sa prerušilo. Skús to znova.');
  return m;
}

/* jedno volanie s NDJSON streamom; ak model nepozná „think“, skúsi to bez neho */
async function streamCall(p, body, { signal, onLine, timeout = 0 }) {
  let r = await req(p, { method: 'POST', body, signal, timeout });
  if (!r.ok) {
    let txt = ''; try { txt = (await r.json()).error || ''; } catch (e) { }
    if ('think' in body && /think/i.test(txt)) {
      const b2 = Object.assign({}, body); delete b2.think;
      r = await req(p, { method: 'POST', body: b2, signal, timeout });
      if (!r.ok) { try { txt = (await r.json()).error || ''; } catch (e) { } throw new Error(friendlyError(txt || t('Ollama vrátila chybu {status}.', { status: r.status }), body.model)); }
    } else throw new Error(friendlyError(txt || t('Ollama vrátila chybu {status}.', { status: r.status }), body.model));
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.error) throw new Error(friendlyError(j.error, body.model));
      onLine(j);
    }
  }
  if (buf.trim()) { const j = JSON.parse(buf); if (j.error) throw new Error(friendlyError(j.error, body.model)); onLine(j); }
}

/* streamovaný chat; onDelta dostáva text, onThinking dĺžku premýšľania */
async function chat({ model, messages, keepAlive, signal, onDelta, onThinking, think = false, temperature = 0.7, numCtx = 8192 }) {
  const body = { model, messages, stream: true, keep_alive: keepAlive, options: { temperature, num_ctx: numCtx } };
  const caps = await capabilities(model);
  if (caps.includes('thinking')) body.think = !!think;
  let full = '', thought = 0;
  await streamCall('/api/chat', body, {
    signal,
    onLine: j => {
      const m = j.message || {};
      if (m.thinking) { thought += m.thinking.length; if (onThinking) onThinking(thought); }
      if (m.content) { full += m.content; onDelta(m.content); }
    }
  });
  return full;
}

/* jednorazová odpoveď (JSON pri čítaní správy od klienta) */
async function generate({ model, prompt, format, temperature = 0.1, timeout = 90000 }) {
  const body = { model, prompt, stream: false, format, options: { temperature } };
  const caps = await capabilities(model);
  if (caps.includes('thinking')) body.think = false;
  let r = await req('/api/generate', { method: 'POST', body, timeout });
  if (!r.ok) {
    let txt = ''; try { txt = (await r.json()).error || ''; } catch (e) { }
    if (body.think === false && /think/i.test(txt)) { delete body.think; r = await req('/api/generate', { method: 'POST', body, timeout }); }
    if (!r.ok) throw new Error(friendlyError(txt || t('Ollama vrátila chybu {status}.', { status: r.status }), model));
  }
  const j = await r.json();
  return j.response || '';
}

function pullError(status, txt, name) {
  const m = String(txt || '');
  if (status === 412 || /newer version|requires a newer/i.test(m)) return t('Tento model potrebuje novšiu Ollamu. Aktualizuj ju (ikonka Ollamy pri hodinách → Update) a skús znova.');
  if (/file does not exist|manifest unknown|not found/i.test(m)) return t('Model „{model}“ v knižnici Ollamy neexistuje. Skontroluj názov na ollama.com/library.', { model: name });
  if (/no space|disk/i.test(m)) return t('Na disku nie je dosť miesta.');
  if (/dial tcp|lookup|i\/o timeout|connection/i.test(m)) return t('Nedá sa pripojiť na internet alebo ollama.com.');
  return m || t('Sťahovanie zlyhalo ({status}).', { status });
}

/* stiahnutie modelu s priebehom */
async function pull(name, onProgress, signal) {
  const r = await req('/api/pull', { method: 'POST', body: { model: name, name, stream: true }, signal, timeout: 0 });
  if (!r.ok) { let txt = ''; try { txt = (await r.json()).error || ''; } catch (e) { } throw new Error(pullError(r.status, txt, name)); }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', last = 0, ok = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.error) throw new Error(pullError(0, j.error, name));
      if (j.status === 'success') ok = true;
      const now = Date.now();
      if (now - last > 250 || j.status === 'success') { last = now; onProgress({ status: j.status, total: j.total || 0, completed: j.completed || 0 }); }
    }
  }
  if (!ok) throw new Error(t('Sťahovanie sa prerušilo. Skús to znova, pokračuje od miesta, kde skončilo.'));
  capCache.delete(name);
}

async function remove(name) {
  const r = await req('/api/delete', { method: 'DELETE', body: { model: name, name } });
  if (!r.ok) throw new Error(t('Model sa nepodarilo zmazať ({status}).', { status: r.status }));
  capCache.delete(name);
}

async function unload(model) {
  try { await req('/api/generate', { method: 'POST', body: { model, keep_alive: 0 } }); } catch (e) { }
}

async function loaded() {
  try {
    const r = await req('/api/ps', { timeout: 2500 });
    const j = await r.json();
    return (j.models || []).map(m => ({ name: m.name, vram: m.size_vram, size: m.size, until: m.expires_at }));
  } catch (e) { return null; }
}

/* grafika: názov a pamäť (len NVIDIA cez nvidia-smi, inak nevieme) */
let gpuP = null;
function gpu() {
  if (gpuP) return gpuP;
  gpuP = new Promise(resolve => {
    const bins = process.platform === 'win32'
      ? ['nvidia-smi', path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'nvidia-smi.exe'), 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']
      : ['nvidia-smi'];
    const tryAt = i => {
      if (i >= bins.length) return resolve(null);
      execFile(bins[i], ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], { timeout: 4000, windowsHide: true }, (err, out) => {
        if (err || !out) return tryAt(i + 1);
        const best = String(out).trim().split(/\r?\n/).map(l => l.split(',').map(x => x.trim())).map(([name, mb]) => ({ name, vramGB: Math.round((parseFloat(mb) || 0) / 1024) }))
          .sort((a, b) => b.vramGB - a.vramGB)[0];
        resolve(best && best.vramGB ? best : null);
      });
    };
    tryAt(0);
  });
  return gpuP;
}
function recommend(vramGB) {
  if (!vramGB) return MODELS[0].name;
  return (MODELS.find(m => vramGB >= m.minVram) || MODELS[MODELS.length - 1]).name;
}

module.exports = { MODELS, MIN_VERSION, setBase, baseUrl: () => BASE, version, cmpVersion, findExe, ensureRunning, models, resolveModel, capabilities, chat, generate, pull, remove, unload, loaded, gpu, recommend, friendlyError };
