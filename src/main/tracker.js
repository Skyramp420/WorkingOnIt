/* Automatické meranie času: sleduje, ktoré okno je v popredí (DaVinci, Premiere, AE...)
   a či si pri PC. Beží cez jeden dlhožijúci PowerShell proces, takže nepotrebuje žiadne natívne moduly.
   Projekt spozná podľa názvu okna, cesty k súboru, knižnice projektov DaVinci a mena klienta.
   Nový projekt, na ktorom chvíľu robíš, sám pridá ako zákazku. */
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const L = require('../shared/logic');
const D = require('./detect');
const log = require('./log');

const INTERVAL = 2000;
const AUTO_ADD_MS = 45000;          // koľko treba na novom projekte robiť, kým ho pridám
const STICKY_MS = 10 * 60000;       // dialógy a panely programu patria k poslednému projektu
const WATCHDOG_MS = 30000;

const PS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$interval = [int]$args[0]
if (-not $interval) { $interval = 2000 }
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WoiWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  public static uint IdleMs() {
    LASTINPUTINFO i = new LASTINPUTINFO();
    i.cbSize = (uint)Marshal.SizeOf(i);
    GetLastInputInfo(ref i);
    return unchecked((uint)Environment.TickCount - i.dwTime);
  }
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
  $h = [WoiWin]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 1024
  [void][WoiWin]::GetWindowText($h, $sb, 1024)
  [uint32]$procId = 0
  [void][WoiWin]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId).ProcessName } catch {}
  $o = @{ proc = $name; title = $sb.ToString(); idle = [WoiWin]::IdleMs() }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds $interval
}
`;

function prettyApp(proc) {
  return L.editorName(proc);
}
const procKey = p => String(p || '').toLowerCase().replace(/\.exe$/, '');

class Tracker extends EventEmitter {
  constructor(store, scriptDir, opts) {
    super();
    this.store = store;
    this.scriptDir = scriptDir;
    this.proc = null;
    this.live = { mode: 'off' };
    this.lastSample = null;
    this.supported = process.platform === 'win32';
    this.env = (opts && opts.env) || { appData: process.env.APPDATA || '', localAppData: process.env.LOCALAPPDATA || '' };
    this.pending = new Map();   // nové projekty: normalizovaný názov → { ms, info, emitted }
    this.sticky = null;         // posledný projekt v programe: { proc, projectId, name, at }
    this._asked = new Set();
  }

  start() {
    this.stop();
    const st = this.store.get().settings;
    if (!this.supported) { this._setLive({ mode: 'unsupported' }); return; }
    if (!st.trackingEnabled) { this._setLive({ mode: 'disabled' }); return; }
    const file = path.join(this.scriptDir, 'tracker.ps1');
    try { fs.writeFileSync(file, '﻿' + PS_SCRIPT, 'utf8'); } catch (e) { log.warn('tracker: skript sa nedal zapísať', e); }
    const sys = process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const bin = sys && fs.existsSync(sys) ? sys : 'powershell.exe';
    this._stopping = false;
    this._errLines = 0;
    this._lastSampleAt = Date.now();
    try {
      this.proc = spawn(bin, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file, String(INTERVAL)], { windowsHide: true });
    } catch (e) { log.error('tracker: PowerShell sa nespustil', e); this._retry(); return; }
    const proc = this.proc;
    proc.on('error', e => { log.error('tracker: PowerShell zlyhal', e.message); });
    if (proc.stderr) proc.stderr.on('data', d => { if (this._errLines++ < 5) log.warn('tracker:', String(d).trim().slice(0, 400)); });
    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', line => {
      let s = null;
      try { s = JSON.parse(line); } catch (e) { return; /* neúplný riadok */ }
      this._lastSampleAt = Date.now();
      try { this.onSample(s); } catch (e) { log.error('tracker: chyba pri spracovaní', e); }
    });
    proc.on('exit', code => {
      if (this.proc === proc) this.proc = null;
      if (!this._stopping) { log.warn('tracker: PowerShell skončil (' + code + '), spúšťam znova'); this._retry(); }
    });
    // strážca: keď PowerShell zamrzne a neposiela nič, reštartujeme ho
    clearInterval(this._dog);
    this._dog = setInterval(() => {
      if (this.proc && Date.now() - this._lastSampleAt > WATCHDOG_MS) { log.warn('tracker: 30 s bez dát, reštartujem'); this.start(); }
    }, 10000);
  }

  _retry() { clearTimeout(this._retryT); this._retryT = setTimeout(() => { if (!this._stopping) this.start(); }, 5000); }

  stop() {
    this._stopping = true;
    clearInterval(this._dog); clearTimeout(this._retryT);
    if (this.proc) { const p = this.proc; this.proc = null; try { p.kill(); } catch (e) { } }
    this.store.endAuto();
  }

  isEditor(proc) {
    const apps = String(this.store.get().settings.editorApps || '').split(/\r?\n|,/).map(s => procKey(s.trim())).filter(Boolean);
    const p = procKey(proc);
    return !!p && apps.some(a => a.endsWith('*') ? p.startsWith(a.slice(0, -1)) : a === p);
  }

  /* ku ktorej zákazke patrí okno: { project, how, info, pendingName } */
  resolve(proc, title, now) {
    now = now || Date.now();
    const state = this.store.get();
    const st = state.settings;
    let info = D.extractProjectInfo(proc, title);
    info = D.enrich(proc, title, info, this.env);
    const key = procKey(proc);
    const m = info && info.untitled ? null : D.matchProject(state, info, title, now);
    let project = (m && m.project) || null;
    let how = m && m.how;
    const sticky = this.sticky && this.sticky.proc === key && now - this.sticky.at < STICKY_MS ? this.sticky : null;
    if (!project && !info && sticky) {
      if (sticky.projectId) { project = state.projects.find(p => p.id === sticky.projectId) || null; how = project ? 'sticky' : null; }
      else if (sticky.info) info = sticky.info;
    }
    const mode = st.newProjectMode || 'auto';
    const ignored = n => (st.ignoredNames || []).some(x => L.normalize(x) === L.normalize(n));
    const named = !!(info && info.name && !info.untitled && !ignored(info.name));
    let pendingName = null;
    if (!project && named) {
      if (mode === 'auto') pendingName = info.name;
      else if (mode === 'ask') this._checkUnknown(proc, info, m && m.client);
    }
    if (!project && !pendingName && state.focusProjectId) {
      project = state.projects.find(x => x.id === state.focusProjectId && L.isActive(x, state.settings)) || null;
      if (project) how = 'focus';
    }
    // zapamätáme si, na čom v programe robíš (dialógy a panely nemajú názov projektu)
    if (info && info.untitled) this.sticky = null;
    else if (info || how === 'sticky') this.sticky = { proc: key, projectId: project && how !== 'focus' ? project.id : null, info: pendingName ? info : null, at: now };
    return { project, how, info, pendingName, client: m && m.client };
  }

  onSample({ proc, title, idle }) {
    const now = Date.now();
    this.lastSample = { proc, title, idle, at: now };
    const state = this.store.get();
    const st = state.settings;
    const isEditor = this.isEditor(proc);
    const idleLimit = (Number(st.idleMinutes) || 4) * 60000;
    const isIdle = idle > idleLimit;
    const grace = Math.max(0, Number(st.awayGraceMinutes) || 0) * 60000;

    const manual = this.store.runningManual();
    if (manual) {
      this.store.endAuto();
      this.away = null;
      this._setLive({ mode: 'manual', projectId: manual.projectId, since: manual.start, app: 'Časovač' });
      return;
    }

    if (isEditor && !isIdle) {
      let r = this.resolve(proc, title, now);
      const app = prettyApp(proc);
      // projekt sa práve pridal ako zákazka: tento tik už patrí jej
      if (r.pendingName && this._pending(r, app)) r = this.resolve(proc, title, now);
      // návrat do programu do limitu: čas mimo sa započíta do tej istej session
      const gap = this.away ? grace + INTERVAL * 2 : INTERVAL * 3 + 2000;
      this.away = null;
      const projectId = r.project ? r.project.id : null;
      this.store.trackTick({ projectId, app, title }, INTERVAL, gap);
      this.lastEditor = { at: now, app, projectId };
      if (projectId) this.emit('worked', projectId, INTERVAL);
      const s = this.store._autoSession;
      this._setLive({ mode: 'auto', projectId, app, title, since: s ? s.start : new Date().toISOString(), how: r.pendingName ? 'pending' : r.how, name: r.info && !r.info.untitled ? r.info.name : null });
      return;
    }

    if (isEditor && isIdle) {
      // AFK pred programom: odrežeme minúty, kým sme si to nevšimli
      if (this.store._autoSession && this.live.mode !== 'idle') this.store.trimAuto(idle);
      this.store.endAuto();
      this.away = null;
      this._setLive({ mode: 'idle', app: prettyApp(proc), projectId: this.lastEditor && this.lastEditor.projectId });
      return;
    }

    // iný program v popredí
    const s = this.store._autoSession;
    if (s && grace && this.lastEditor && now - this.lastEditor.at <= grace && !isIdle) {
      if (!this.away) this.away = { since: new Date(this.lastEditor.at).toISOString() };
      this._setLive({ mode: 'away', projectId: s.projectId, app: this.lastEditor.app, since: s.start, awaySince: this.away.since, graceUntil: new Date(this.lastEditor.at + grace).toISOString(), other: proc });
      return;
    }
    this.store.endAuto();
    this.away = null;
    this._setLive({ mode: 'off', app: null });
  }

  /* nový projekt: po chvíli práce ho ohlásime, appka ho pridá */
  _pending(r, app) {
    const n = L.normalize(r.pendingName);
    const p = this.pending.get(n) || { ms: 0, emitted: false };
    p.ms += INTERVAL;
    p.info = r.info;
    this.pending.set(n, p);
    if (!p.emitted && p.ms >= AUTO_ADD_MS) {
      p.emitted = true;
      this.emit('autoAdd', Object.assign({ app, client: r.client || '' }, r.info));
      return true;
    }
    return false;
  }

  /* zákazku sme práve pridali alebo spojili: odteraz ju spoznáme hneď */
  learned(name) { this.pending.delete(L.normalize(name)); this.sticky = null; }

  /* režim „pýtať sa“: projekt otvorený v programe, ktorý v appke nemáš */
  _checkUnknown(proc, info, client) {
    const n = L.normalize(info.name);
    if (this._asked.has(n)) return;
    this._asked.add(n);
    this.emit('unknown', Object.assign({ app: prettyApp(proc), client: client || '' }, info));
  }

  _setLive(live) {
    const a = this.live, b = live;
    const same = a.mode === b.mode && a.projectId === b.projectId && a.app === b.app && a.since === b.since && a.awaySince === b.awaySince && a.how === b.how && a.name === b.name;
    this.live = live;
    this.store.live.tracking = live;
    if (!same) this.emit('live', live);
  }
}

/* staré meno, nech nič nepadne */
function extractProjectName(proc, title) {
  const i = D.extractProjectInfo(proc, title);
  return i && !i.untitled ? { name: i.name, file: i.file, folder: i.folder } : null;
}

module.exports = { Tracker, prettyApp, extractProjectName, INTERVAL, AUTO_ADD_MS };
