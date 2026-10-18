/* WorkingOnIt — hlavný proces */
const { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, Notification, nativeImage, clipboard, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const Store = require('./store');
const { Tracker } = require('./tracker');
const { RenderWatcher } = require('./watcher');
const { RemoteServer } = require('./remote');
const { LocalApi } = require('./localapi');
const H = require('./helpers');
const O = require('./ollama');
const U = require('./updater');
const Clip = require('./clip');
const { Sync } = require('./sync');
const log = require('./log');
const L = require('../shared/logic');
const P = require('../shared/parse');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'assets', 'icon.png').replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
const SHORTCUT = 'CommandOrControl+Alt+Shift+W';
const THEME_BG = { lampa: '#1c1713', nokturno: '#0a0d1c', atrament: '#15131f', polnoc: '#0e1220', oled: '#000000', les: '#0f1716', papier: '#eceaf3' };
/* farba okna, kým sa načíta obsah (Čistá: podľa svetlého/tmavého režimu) */
function themeBg(st) {
  if ((st.theme || 'clean') === 'clean') return nativeTheme.shouldUseDarkColors ? '#252527' : '#ebebed';
  return THEME_BG[st.theme] || '#1c1713';
}
/* svetlý/tmavý režim: Automaticky = podľa Windowsu; natívne prvky (posuvníky, dialógy) idú s ním */
function applyAppearance(st) {
  const a = st.appearance || 'auto';
  nativeTheme.themeSource = (st.theme || 'clean') === 'clean' ? (a === 'light' || a === 'dark' ? a : 'system') : st.theme === 'papier' ? 'light' : 'dark';
}
let spot = null;
const aiJobs = new Map();

// nainštalovaná appka a testovacia (Spustit.bat) majú každá svoje dáta, musí to byť pred zámkom aj pred ready
const DATA = require('./datadir').resolve({ appData: app.getPath('appData'), packaged: app.isPackaged });
app.setPath('userData', DATA.dir);

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// chyby nezhodia appku: zapíšu sa do logu a appka beží ďalej
process.on('uncaughtException', e => { log.error('uncaught', e); });
process.on('unhandledRejection', e => { log.error('unhandledRejection', e); });
const ollamaLog = () => path.join(app.getPath('userData'), 'logs', 'ollama.log');
app.setAppUserModelId('sk.shapefx.workingonit');

let win = null, tray = null, store, tracker, watcher, remote, localApi, sync;
let quitting = false;

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  if (spot && !spot.isDestroyed() && (channel === 'state' || channel === 'live')) spot.webContents.send(channel, data);
}

function showWindow(then) {
  if (!win || win.isDestroyed()) {
    createWindow();
    if (then) win.webContents.once('did-finish-load', () => setTimeout(() => send('event', then), 300));
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (then) send('event', then);
}
/* okno schované do lišty dlhšie ako 10 minút sa zatvorí celé (uvoľní ~150 MB RAM a grafiku).
   Meranie času, rendery a synchronizácia bežia ďalej v hlavnom procese, pri otvorení sa okno postaví znova. */
let winSleep = null;
function sleepLater() {
  clearTimeout(winSleep);
  winSleep = setTimeout(() => {
    if (!win || win.isDestroyed() || win.isVisible()) return;
    log.info('okno uspané (schované 10 min)');
    const w = win; win = null; w.destroy();
  }, Number(process.env.WOI_SLEEP_MS) || 10 * 60000);
}

function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON, silent: false });
  n.on('click', () => { showWindow(); if (onClick) onClick(); });
  n.show();
}

/* verejná mobilná stránka (bez dát), nastavíš ju v package.json → woi.mobileUrl */
function mobileWebUrl() {
  try { const u = String((require(path.join(ROOT, 'package.json')).woi || {}).mobileUrl || '').trim(); return u ? u.replace(/\/?$/, '/') : ''; } catch (e) { return ''; }
}

/* ---------- nová zákazka z projektu v programe, stav podľa práce ---------- */
function addFromEditor(info) {
  const r = H.addFromEditor(store, info);
  tracker.learned(info.name);
  log.info((r.merged ? 'projekt priradený k zákazke ' : 'nová zákazka z ' + (info.app || 'editora') + ': ') + r.project.title);
  return r;
}
const workedMs = new Map();
function autoStatus(id, ms) {
  const r = H.autoStatus(store, workedMs, id, ms);
  if (!r) return;
  send('event', Object.assign({ type: 'autoStatus', id }, r));
  log.info('stav podľa práce: ' + r.title + ' ' + r.from + ' → ' + r.to);
}

/* ---------- akcie (zdieľané pre appku aj mobil) ---------- */
async function runAction(type, p = {}, source = 'app') {
  const s = store.get();
  switch (type) {
    case 'createProject': {
      const proj = store.createProject(p.fields || {});
      if (s.settings.autoCreateFolder && s.settings.rootFolder && p.createFolder !== false) {
        try { H.createProjectFolder(store, proj.id); watcher.refresh(); } catch (e) { send('event', { type: 'toast', kind: 'error', text: e.message }); }
      }
      return proj.id;
    }
    case 'createFromText': {
      const parsed = P.parseMessage(p.text || '');
      const proj = store.createProject(Object.assign({ title: t('Nová zákazka') }, parsed.fields));
      if (s.settings.autoCreateFolder && s.settings.rootFolder) { try { H.createProjectFolder(store, proj.id); watcher.refresh(); } catch (e) { } }
      if (source === 'mobile') notify(t('Nová zákazka z mobilu'), proj.title);
      return proj.id;
    }
    case 'updateProject': return store.updateProject(p.id, p.patch) && true;
    case 'setStatus': store.setStatus(p.id, p.status); return true;
    case 'moveProject': store.moveProject(p.id, p.status, p.beforeId); return true;
    case 'deleteProject': store.deleteProject(p.id); return true;
    case 'addPayment': store.addPayment(p.id, p.amount, p.note); return true;
    case 'removePayment': store.removePayment(p.id, p.index); return true;
    case 'appendNote': {
      const proj = store.project(p.id); if (!proj) return false;
      const stamp = new Date().toLocaleString(I18N.locale(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
      const escH = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const patch = { notes: (proj.notes ? proj.notes + '\n\n' : '') + '[' + stamp + '] ' + p.text };
      if (proj.notesHtml) patch.notesHtml = proj.notesHtml + '<p><b>' + escH(stamp) + '</b> ' + escH(p.text) + '</p>';
      store.updateProject(p.id, patch);
      return true;
    }
    case 'archiveProject': store.archiveProject(p.id, p.value); return true;
    case 'duplicateProject': { const n = store.duplicateProject(p.id); return n && n.id; }
    case 'updateClient': store.updateClient(p.key, p.patch); return true;
    case 'unlockAchievements': return store.unlockAchievements(p.ids);
    case 'boop': return store.boop();
    case 'saveImage': {
      const proj = store.project(p.id);
      const dir = proj && proj.folder && fs.existsSync(proj.folder) ? path.join(proj.folder, t('_poznamky')) : path.join(app.getPath('userData'), 'obrazky', p.id || 'ine');
      fs.mkdirSync(dir, { recursive: true });
      const ext = (String(p.ext || 'png').toLowerCase().match(/^(png|jpe?g|gif|webp)$/) || ['png'])[0];
      const file = path.join(dir, 'obrazok-' + Date.now().toString(36) + '.' + ext);
      fs.writeFileSync(file, Buffer.from(String(p.data || ''), 'base64'));
      return require('url').pathToFileURL(file).href;
    }
    case 'openFileUrl': { try { shell.openPath(require('url').fileURLToPath(p.url)); } catch (e) { } return true; }
    case 'captureRecap': {
      const img = await win.webContents.capturePage(p.rect);
      if (p.mode === 'copy') { await Clip.writeImage(img); return 'copied'; }
      const r = await dialog.showSaveDialog(win, { defaultPath: 'WorkingOnIt-recap.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (r.canceled) return null;
      fs.writeFileSync(r.filePath, img.toPNG()); return r.filePath;
    }
    /* šablóny */
    case 'listFolder': {
      const root = p.path;
      if (!root || !fs.existsSync(root)) return { missing: true, items: [] };
      const out = [];
      const walk = (dir, depth) => {
        let ents = [];
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        for (const d of ents) {
          if (out.length >= 400 || d.name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(d.name)) continue;
          const full = path.join(dir, d.name);
          let st = null; try { st = fs.statSync(full); } catch (e) { continue; }
          out.push({ name: d.name, path: full, dir: d.isDirectory(), size: st.size, mtime: st.mtimeMs, rel: path.relative(root, full), depth });
          if (d.isDirectory() && depth < 1) walk(full, depth + 1);
        }
      };
      walk(root, 0);
      return { items: out };
    }
    case 'addTemplateFolder': {
      const r = await dialog.showOpenDialog(win, { title: t('Priečinok so šablónami'), properties: ['openDirectory'] });
      if (r.canceled) return null;
      const tf = Object.assign({}, s.settings.templateFolders || {});
      tf[p.program] = Array.from(new Set((tf[p.program] || []).concat([r.filePaths[0]])));
      store.updateSettings({ templateFolders: tf });
      return r.filePaths[0];
    }
    case 'removeTemplateFolder': {
      const tf = Object.assign({}, s.settings.templateFolders || {});
      tf[p.program] = (tf[p.program] || []).filter(x => x !== p.path);
      store.updateSettings({ templateFolders: tf }); return true;
    }
    case 'suggestTemplateFolders': {
      // bežné miesta, kde programy držia šablóny a presety
      const home = app.getPath('home'), appData = app.getPath('appData'), docs = app.getPath('documents');
      const cand = {
        resolve: [path.join(appData, 'Blackmagic Design', 'DaVinci Resolve', 'Support', 'Fusion', 'Templates'), 'C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Fusion\\Templates', path.join(appData, 'Blackmagic Design', 'DaVinci Resolve', 'Support', 'LUT')],
        premiere: [path.join(appData, 'Adobe', 'Common', 'Motion Graphics Templates')],
        ae: [],
        other: []
      };
      try { for (const d of fs.readdirSync(path.join(docs, 'Adobe'))) if (/^After Effects/i.test(d)) cand.ae.push(path.join(docs, 'Adobe', d, 'User Presets')); } catch (e) { }
      const tf = Object.assign({}, s.settings.templateFolders || {});
      let added = 0;
      for (const [prog, list] of Object.entries(cand)) for (const dir of list) {
        if (fs.existsSync(dir) && !(tf[prog] || []).includes(dir)) { tf[prog] = (tf[prog] || []).concat([dir]); added++; }
      }
      if (added) store.updateSettings({ templateFolders: tf });
      return added;
    }
    case 'copyToProject': {
      const proj = store.project(p.projectId);
      if (!proj || !proj.folder || !fs.existsSync(proj.folder)) throw new Error(t('Zákazka nemá priečinok. Najprv ho vytvor na jej stránke.'));
      const assets = fs.readdirSync(proj.folder).find(d => /^0?3[_ ]?assets?$/i.test(d) || /^assets?$/i.test(d));
      const destDir = assets ? path.join(proj.folder, assets) : proj.folder;
      let dest = path.join(destDir, path.basename(p.path)), n = 2;
      while (fs.existsSync(dest)) { const ext = path.extname(p.path); dest = path.join(destDir, path.basename(p.path, ext) + ' (' + n++ + ')' + ext); }
      fs.cpSync(p.path, dest, { recursive: true });
      return dest;
    }
    case 'saveSnippet': return store.saveSnippet(p.snippet);
    case 'deleteSnippet': store.deleteSnippet(p.id); return true;

    /* Claude (desktop appka) cez MCP */
    case 'claudeStatus': return claudeConfig(false);
    case 'connectClaude': return claudeConfig(true);
    case 'disconnectClaude': return claudeConfig(false, true);
    case 'aeDetect': {
      if (s.settings.aePath && fs.existsSync(s.settings.aePath)) return s.settings.aePath;
      const found = [];
      for (const r of [process.env.ProgramFiles || 'C:\\Program Files']) {
        try { for (const d of fs.readdirSync(path.join(r, 'Adobe'))) { const exe = path.join(r, 'Adobe', d, 'Support Files', 'AfterFX.exe'); if (/after effects/i.test(d) && fs.existsSync(exe)) found.push(exe); } } catch (e) { }
      }
      return found.sort().reverse()[0] || null;
    }
    case 'pickAePath': {
      const r = await dialog.showOpenDialog(win, { title: t('Nájdi AfterFX.exe'), defaultPath: 'C:\\Program Files\\Adobe', filters: [{ name: 'AfterFX.exe', extensions: ['exe'] }], properties: ['openFile'] });
      if (r.canceled) return null;
      store.updateSettings({ aePath: r.filePaths[0] }); return r.filePaths[0];
    }

    case 'aiModels': {
      const run = await O.ensureRunning({ autoStart: false });
      return run.running ? await O.models().catch(() => null) : null;
    }
    case 'aiStart': return O.ensureRunning({ autoStart: true, exe: s.settings.ollamaPath, logFile: ollamaLog() });
    case 'aiOpenDownload': shell.openExternal('https://ollama.com/download'); return true;
    case 'aiPull': {
      const ctrl = new AbortController(); aiJobs.set('pull:' + p.name, ctrl);
      (async () => {
        const run = await O.ensureRunning({ autoStart: true, exe: s.settings.ollamaPath, logFile: ollamaLog() });
        if (!run.running) throw new Error(run.installed === false ? t('Ollama nie je nainštalovaná. Stiahni ju z ollama.com.') : (run.error || t('Ollama nebeží.')));
        if (!run.versionOk && /^gemma4/.test(p.name)) throw new Error(t('Gemma 4 potrebuje Ollamu {min} alebo novšiu, máš {v}. Aktualizuj Ollamu a skús znova.', { min: O.MIN_VERSION, v: run.version }));
        await O.pull(p.name, prog => send('ai', { pull: p.name, ...prog }), ctrl.signal);
      })()
        .then(() => { log.info('model stiahnutý', p.name); send('ai', { pull: p.name, done: true }); })
        .catch(e => { log.warn('sťahovanie modelu', p.name, e.message); send('ai', { pull: p.name, done: true, error: e.name === 'AbortError' ? t('Zrušené.') : e.message }); })
        .finally(() => aiJobs.delete('pull:' + p.name));
      return true;
    }
    case 'aiPullCancel': { const j = aiJobs.get('pull:' + p.name); if (j) j.abort(); return true; }
    case 'aiDelete': await O.remove(p.name); return true;
    case 'toggleCheck': {
      const proj = store.project(p.id); if (!proj) return false;
      const item = proj.checklist.find(c => c.id === p.itemId); if (item) item.done = !item.done;
      store.changed('project'); return true;
    }
    case 'setChecklist': store.updateProject(p.id, { checklist: p.checklist }); return true;
    case 'setFocus': store.setFocus(p.id); return true;
    case 'startTimer': store.startManual(p.id); tracker.onSample(tracker.lastSample || { proc: '', title: '', idle: 0 }); return true;
    case 'stopTimer': store.stopManual(); tracker.onSample(tracker.lastSample || { proc: '', title: '', idle: 0 }); return true;
    case 'assignSession': store.assignSession(p.sessionId, p.projectId); return true;
    case 'assignSimilar': return store.assignSimilar(p.sessionId, p.projectId);
    case 'deleteSession': store.deleteSession(p.sessionId); return true;
    case 'addManualSession': store.addManualSession(p.projectId, p.minutes, p.date); return true;
    case 'assignLooseRender': {
      const r = (s.looseRenders || []).find(x => x.file === p.file);
      if (r) { store.addRender(p.projectId, r); s.looseRenders = s.looseRenders.filter(x => x !== r); store.changed('render'); }
      return true;
    }
    case 'dismissLooseRender': s.looseRenders = (s.looseRenders || []).filter(x => x.file !== p.file); store.changed('render'); return true;
    case 'removeRender': {
      const proj = store.project(p.id); if (!proj) return false;
      proj.renders = proj.renders.filter(r => r.file !== p.file); store.changed('render'); return true;
    }
    case 'createFolder': { const dir = H.createProjectFolder(store, p.id); watcher.refresh(); return dir; }
    case 'openFolder': {
      const proj = store.project(p.id);
      if (!proj || !proj.folder) throw new Error(t('Projekt ešte nemá priečinok.'));
      if (!fs.existsSync(proj.folder)) throw new Error(t('Priečinok už neexistuje: {path}', { path: proj.folder }));
      shell.openPath(proj.folder); return true;
    }
    case 'openPath': if (p.path && fs.existsSync(p.path)) shell.openPath(p.path); return true;
    case 'revealFile': if (p.path && fs.existsSync(p.path)) shell.showItemInFolder(p.path); else throw new Error(t('Súbor sa nenašiel.')); return true;
    case 'pickFolder': {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: p.defaultPath || app.getPath('videos') });
      return r.canceled ? null : r.filePaths[0];
    }
    case 'linkFolder': {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: s.settings.rootFolder || app.getPath('videos') });
      if (r.canceled) return null;
      store.updateProject(p.id, { folder: r.filePaths[0] }); watcher.refresh(); return r.filePaths[0];
    }
    case 'updateSettings': {
      const before = Object.assign({}, s.settings);
      store.updateSettings(p.patch);
      const now = s.settings;
      if (['trackingEnabled', 'editorApps', 'idleMinutes'].some(k => before[k] !== now[k])) tracker.start();
      if (['rootFolder', 'extraWatchFolders', 'renderExtensions'].some(k => before[k] !== now[k])) watcher.start();
      if (['remoteEnabled', 'remotePort', 'remoteToken'].some(k => before[k] !== now[k])) remote.start();
      // pri spustení zo zdrojákov (Spustit.bat) by sa do štartu Windows zapísal holý Electron, preto len v nainštalovanej appke
      if (before.launchAtLogin !== now.launchAtLogin && app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!now.launchAtLogin, args: ['--hidden'] });
      if (before.zoom !== now.zoom && win) win.webContents.setZoomFactor(Number(now.zoom) || 1);
      if ((before.theme !== now.theme || before.appearance !== now.appearance)) { applyAppearance(now); if (win) win.setBackgroundColor(themeBg(now)); }
      if (before.language !== now.language) {
        // nový používateľ bez zákaziek dostane aj predvolené priečinky v novom jazyku
        const fix = L.languageDefaultsPatch(before, before.language, now.language, s.projects.length > 0);
        if (Object.keys(fix).length) store.updateSettings(fix);
        applyLanguage();
      }
      if (before.currency !== now.currency) I18N.setCurrency(now.currency);
      if (before.spotlightHotkey !== now.spotlightHotkey) { const ok = registerHotkeys(); if (!ok) throw new Error(t('Skratku „{key}“ sa nepodarilo zaregistrovať. Možno ju používa iný program.', { key: now.spotlightHotkey })); }
      if (!before.ollamaEnabled && now.ollamaEnabled && now.ollamaAutoStart !== false) O.ensureRunning({ autoStart: true, exe: now.ollamaPath, logFile: ollamaLog() }).catch(() => { });
      return true;
    }
    case 'resetToken': store.updateSettings({ remoteToken: require('crypto').randomBytes(9).toString('base64url') }); remote.start(); return true;
    case 'remoteInfo': {
      const info = remote.info();
      for (const a of info.addresses) a.qr = await QRCode.toDataURL(a.url, { margin: 1, width: 360, color: { dark: '#1c1713ff', light: '#ffffffff' } });
      return info;
    }
    case 'parseMessage': {
      const base = P.parseMessage(p.text || '');
      return base;
    }
    case 'aiParse': {
      const run = await O.ensureRunning({ autoStart: s.settings.ollamaAutoStart !== false, exe: s.settings.ollamaPath, logFile: ollamaLog() });
      if (!run.running) throw new Error(t('Ollama nebeží.'));
      return H.ollamaParse(await O.resolveModel(s.settings.ollamaModel), p.text || '', L.projectTypes(s.settings));
    }
    case 'ollamaModels': try { return (await O.models()).map(m => m.name); } catch (e) { return null; }
    case 'readClipboard': return Clip.readText();
    case 'importNotion': {
      const r = await dialog.showOpenDialog(win, { title: t('Vyber CSV export z Notionu'), filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
      if (r.canceled) return null;
      const list = P.parseNotionCSV(fs.readFileSync(r.filePaths[0], 'utf8'));
      return store.importProjects(list);
    }
    case 'exportBackup': {
      const r = await dialog.showSaveDialog(win, { defaultPath: t('WorkingOnIt-zaloha') + '-' + L.dayKey(Date.now()) + '.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (r.canceled) return null;
      fs.writeFileSync(r.filePath, JSON.stringify(s, null, 1)); return r.filePath;
    }
    case 'openDataFolder': shell.openPath(app.getPath('userData')); return true;
    case 'markOnboarded': store.markOnboarded(); return true;
    case 'debugTracker': {
      const D = require('./detect');
      const last = tracker.lastSample;
      let info = null, match = null;
      if (last && tracker.isEditor(last.proc)) {
        info = D.enrich(last.proc, last.title, D.extractProjectInfo(last.proc, last.title), tracker.env);
        const m = info && info.untitled ? null : D.matchProject(s, info, last.title);
        match = m && m.project ? { title: m.project.title, how: m.how } : null;
      }
      return { supported: tracker.supported, live: tracker.live, last, info, match, watching: watcher.roots().map(r => r.dir) };
    }
    case 'quit': quitting = true; app.quit(); return true;
    /* vlastná online databáza */
    case 'syncStatus': return Object.assign(sync.status(), { code: sync.connectionCode(), mobileUrl: mobileWebUrl() });
    case 'syncConnect': return sync.connect(p);
    case 'syncCheckSchema': return sync.checkSchema();
    case 'syncCreate': return sync.createAccount(String(p.email || '').trim(), String(p.password || ''));
    case 'syncLogin': return sync.login(String(p.email || '').trim(), String(p.password || ''));
    case 'syncNow': return sync.syncNow();
    case 'syncLogout': await sync.logout(); return true;
    case 'syncPassword': return sync.changePassword(String(p.password || ''));
    case 'syncDisconnect': await sync.disconnect(); return true;
    case 'syncCopySql': await Clip.writeText(fs.readFileSync(path.join(__dirname, 'sql', I18N.lang === 'en' ? 'setup.en.sql' : 'setup.sql'), 'utf8')); return true;
    case 'syncQr': {
      const u = mobileWebUrl(); const code = sync.connectionCode();
      if (!u || !code) return null;
      const link = u + '#c=' + code;
      return { link, qr: await QRCode.toDataURL(link, { margin: 1, width: 260, color: { dark: '#1c1713', light: '#ffffff' } }) };
    }

    /* aktualizácie */
    case 'updateStatus': return U.status();
    case 'updateCheck': return U.check();
    case 'updateInstall': return U.install(() => { quitting = true; });

    /* okno */
    case 'winMinimize': win.minimize(); return true;
    case 'winToggleMax': win.isMaximized() ? win.unmaximize() : win.maximize(); return win.isMaximized();
    case 'winClose': win.close(); return true;
    case 'winIsMax': return win.isMaximized();

    /* spotlight */
    case 'showMain': hideSpotlight(); showWindow(p.event || null); return true;
    case 'hideSpotlight': hideSpotlight(); return true;
    case 'openSpotlight': showSpotlight(); return true;
    case 'writeClipboard': await Clip.writeText(String(p.text || '')); return true;

    /* projekt otvorený v editore */
    case 'ignoreName': {
      const list = (s.settings.ignoredNames || []).concat([p.name]);
      store.updateSettings({ ignoredNames: list.slice(-200) }); return true;
    }
    case 'aliasProject': {
      if (!store.aliasName(p.id, p.name)) return false;
      // čas, ktorý sa už nameral s týmto názvom okna, priradíme tiež
      store.claimSessions(p.name, p.id);
      tracker.learned(p.name);
      return true;
    }
    case 'claimSessionsByName': {
      const c = store.claimSessions(p.name, p.id, p.fromId);
      tracker.learned(p.name);
      return c;
    }
    case 'mergeProject': {
      const from = store.project(p.from);
      if (!from || !store.mergeProjects(p.from, p.into)) return false;
      tracker.learned(from.title);
      return true;
    }
    case 'notAJob': {
      // automaticky pridaná zákazka nie je zákazka: zmažeme ju a názov si zapamätáme
      const proj = store.project(p.id); if (!proj) return false;
      const names = [proj.title].concat(proj.aliases || []);
      store.updateSettings({ ignoredNames: (s.settings.ignoredNames || []).concat(names).slice(-200) });
      store.deleteProject(proj.id);
      for (const n of names) tracker.learned(n);
      return true;
    }
    case 'retarget': {
      // „na čom práve robíš“: projekt v programe patrí tejto zákazke
      const live = tracker.live || {};
      const proj = store.project(p.id); if (!proj) return false;
      if (live.mode === 'auto' && live.name) {
        store.aliasName(proj.id, live.name);
        const cur = store._autoSession;
        if (cur) { cur.projectId = proj.id; store.changed('time'); }
        store.claimSessions(live.name, proj.id);
        tracker.learned(live.name);
      }
      store.setFocus(proj.id);
      if (tracker.lastSample) tracker.onSample(tracker.lastSample);
      return true;
    }
    case 'addFromEditorNow': {
      const live = tracker.live || {};
      if (!live.name) return null;
      const info = Object.assign({ app: live.app, name: live.name }, (tracker.pending.get(L.normalize(live.name)) || {}).info || {});
      const r = addFromEditor(info);
      if (tracker.lastSample) tracker.onSample(tracker.lastSample);
      return r.project.id;
    }

    /* AI */
    case 'aiStatus': {
      const st = s.settings;
      const run = await O.ensureRunning({ autoStart: !!p.start, exe: st.ollamaPath, logFile: ollamaLog() });
      let models = [], model = null, loaded = [];
      if (run.running) {
        models = await O.models().catch(() => []);
        loaded = (await O.loaded()) || [];
        if (models.length) model = await O.resolveModel(st.ollamaModel).catch(() => null);
      }
      const gpu = await O.gpu().catch(() => null);
      return Object.assign({ enabled: !!st.ollamaEnabled, models, model, loaded, gpu, recommended: O.recommend(gpu && gpu.vramGB), catalog: O.MODELS, minVersion: O.MIN_VERSION }, run);
    }
    case 'aiUnload': { for (const m of (await O.loaded()) || []) await O.unload(m.name); return true; }
    case 'aiStop': { const j = aiJobs.get(p.id); if (j) j.abort(); return true; }
    case 'aiChat': {
      const ctrl = new AbortController();
      aiJobs.set(p.id, ctrl);
      kitChat({
        messages: p.messages, projectId: p.projectId, ideaId: p.ideaId, signal: ctrl.signal,
        onStatus: x => send('ai', { id: p.id, status: x }),
        onModel: m => send('ai', { id: p.id, model: m }),
        onThinking: n => send('ai', { id: p.id, thinking: n }),
        onDelta: d => send('ai', { id: p.id, delta: d })
      })
        .then(() => send('ai', { id: p.id, done: true }))
        .catch(e => { if (e.name !== 'AbortError') log.warn('Kit chat', e.message); send('ai', { id: p.id, error: e.name === 'AbortError' ? null : e.message, done: true }); })
        .finally(() => aiJobs.delete(p.id));
      return { ok: true };
    }

    /* nápady */
    case 'saveIdea': return store.saveIdea(p.idea || {});
    case 'deleteIdea': store.deleteIdea(p.id); return true;
    case 'captureIdea': {
      // rýchly nápad (z mobilu): text a voliteľná fotka
      const id = L.uid();
      const escH = x => String(x || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      // prvý riadok sa stane názvom, zvyšok poznámkou (aby sa na karte neopakoval)
      const lines = String(p.text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      let title = String(p.title || '').trim(), body = lines;
      if (!title && lines.length) {
        if (lines[0].length <= 60) { title = lines[0]; body = lines.slice(1); }
        else title = lines[0].slice(0, 58).replace(/\s+\S*$/, '') + '…';
      }
      let html = body.map(x => '<p>' + escH(x) + '</p>').join('');
      let cover = '';
      if (p.image && p.image.data) {
        const dir = path.join(app.getPath('userData'), 'obrazky', id);
        fs.mkdirSync(dir, { recursive: true });
        const ext = (String(p.image.ext || 'jpg').toLowerCase().match(/^(png|jpe?g|webp)$/) || ['jpg'])[0];
        const file = path.join(dir, 'foto-' + Date.now().toString(36) + '.' + ext);
        fs.writeFileSync(file, Buffer.from(String(p.image.data), 'base64'));
        cover = require('url').pathToFileURL(file).href;
        html += '<p><img src="' + cover + '"></p>';
      }
      const proj = p.projectId && store.project(p.projectId);
      return store.saveIdea({ id, title: title || t('Nápad'), html, text: body.join('\n'), cover, projectId: proj ? proj.id : '', tags: source === 'mobile' ? [t('z mobilu')] : [] });
    }
    case 'readImageData': {
      // obrázok ako data URL (na export storyboardu bez „zašpineného“ canvasu)
      const file = require('url').fileURLToPath(p.url);
      const inside = d => { const rel = path.relative(path.resolve(d), path.resolve(file)); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
      const okDir = [app.getPath('userData')].concat(s.projects.filter(x => x.folder).map(x => x.folder)).some(inside);
      if (!okDir || !/\.(png|jpe?g|gif|webp)$/i.test(file)) throw new Error(t('Obrázok sa nedá načítať.'));
      const ext = path.extname(file).slice(1).toLowerCase().replace('jpg', 'jpeg');
      return 'data:image/' + ext + ';base64,' + fs.readFileSync(file).toString('base64');
    }
    case 'saveImageFile': {
      const r = await dialog.showSaveDialog(win, { defaultPath: L.sanitizeName(p.name || 'storyboard') + '.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (r.canceled) return null;
      fs.writeFileSync(r.filePath, Buffer.from(String(p.data || '').replace(/^data:image\/png;base64,/, ''), 'base64'));
      return r.filePath;
    }
    case 'copyImage': await Clip.writeImage(nativeImage.createFromDataURL(p.dataUrl)); return true;

    /* zálohy, logy, o appke */
    case 'listBackups': return store.backups().map(b => ({ name: b.name, date: b.date, size: b.size }));
    case 'restoreBackup': store.restoreBackup(p.name); watcher.refresh(); log.info('obnovené zo zálohy', p.name); return true;
    case 'appInfo': return { version: app.getVersion(), test: !app.isPackaged, data: app.getPath('userData'), logs: log.dir(), electron: process.versions.electron, platform: process.platform, recovered: store.recovered || null };
    case 'openLogs': if (log.dir()) shell.openPath(log.dir()); return true;
    case 'resetOnboarding': store.get().seenOnboarding = false; store.changed('settings'); return true;
    case 'detectEditors': return detectEditors();
    case 'openExternal': if (/^https:\/\//.test(String(p.url || ''))) shell.openExternal(p.url); return true;
    default: throw new Error(t('Neznáma akcia: {type}', { type }));
  }
}

/* ---------- okno ---------- */
/* appka sa nesmie preklikať na cudzí web; odkazy otvoríme v prehliadači */
function guardNavigation(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (url !== w.webContents.getURL()) { e.preventDefault(); if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); }
  });
}

function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1400, height: 880, minWidth: 980, minHeight: 640,
    backgroundColor: themeBg(store.get().settings),
    title: 'WorkingOnIt',
    icon: ICON,
    show: !hidden,
    frame: false,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();
  guardNavigation(win);
  win.webContents.on('render-process-gone', (e, d) => { log.error('renderer spadol', d); if (d.reason !== 'clean-exit' && !quitting) setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 800); });
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(Number(store.get().settings.zoom) || 1));
  const maxState = () => send('event', { type: 'maximized', value: win.isMaximized() });
  win.on('maximize', maxState); win.on('unmaximize', maxState);
  win.on('hide', sleepLater);
  win.on('show', () => clearTimeout(winSleep));
  win.on('closed', () => { win = null; });
  if (hidden) sleepLater();

  win.on('close', e => {
    if (quitting) return;
    if (store.get().settings.closeAction === 'quit') { quitting = true; setImmediate(() => app.quit()); return; }
    e.preventDefault();
    win.hide();
    if (!store.get().notified.trayHint) {
      store.get().notified.trayHint = true; store.save();
      notify(t('WorkingOnIt beží ďalej'), t('Čas a rendery sa sledujú aj na pozadí. Ikonka je vedľa hodín.'));
    }
  });
}

function buildTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('WorkingOnIt');
  tray.on('click', () => showWindow());
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const live = tracker ? tracker.live : { mode: 'off' };
  const s = store.get();
  const proj = live.projectId && s.projects.find(p => p.id === live.projectId);
  const running = !!store.runningManual();
  const focus = s.projects.find(p => p.id === s.focusProjectId);
  tray.setToolTip('WorkingOnIt' + (live.mode === 'auto' ? t(' · meriam {what}', { what: proj ? proj.title : live.app }) : running ? t(' · časovač beží') : ''));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('Otvoriť WorkingOnIt'), click: () => showWindow() },
    { label: 'Spotlight', click: () => showSpotlight() },
    { label: t('Nová zákazka zo schránky'), click: () => showWindow({ type: 'quickAdd', fromClipboard: true }) },
    { type: 'separator' },
    running
      ? { label: t('Zastaviť časovač'), click: () => runAction('stopTimer') }
      : { label: focus ? t('Spustiť časovač: {title}', { title: focus.title }) : t('Spustiť časovač'), click: () => runAction('startTimer', { id: focus ? focus.id : null }) },
    { type: 'separator' },
    { label: t('Ukončiť'), click: () => { quitting = true; app.quit(); } }
  ]));
}

/* Kit chat (appka aj mobil). Keď Ollama nebeží, spustí ju na pozadí. */
async function kitChat({ messages, projectId, ideaId, signal, onDelta, onThinking, onStatus, onModel }) {
  const s = store.get(), st = s.settings;
  if (!st.ollamaEnabled) throw new Error(t('Lokálne AI je vypnuté. Zapni ho v Nastaveniach → Lokálne AI.'));
  let run = await O.ensureRunning({ autoStart: false });
  if (!run.running) {
    if (st.ollamaAutoStart === false) throw new Error(t('Ollama nebeží. Spusti ju, alebo v Nastaveniach zapni, aby som ju spúšťal sám.'));
    if (onStatus) onStatus('starting');
    run = await O.ensureRunning({ autoStart: true, exe: st.ollamaPath, logFile: ollamaLog() });
    if (!run.running) throw new Error(run.installed === false ? t('Ollama nie je nainštalovaná. Stiahni ju z ollama.com a skús znova.') : (run.error || t('Ollamu sa nepodarilo spustiť.')));
  }
  const model = await O.resolveModel(st.ollamaModel);
  if (onModel) onModel(model);
  const inMem = ((await O.loaded()) || []).some(m => m.name === model);
  if (!inMem && onStatus) onStatus('loading');
  const msgs = [{ role: 'system', content: H.kitSystemPrompt(s, projectId, ideaId) }].concat((messages || []).slice(-16));
  const keep = Number(st.aiKeepAlive);
  let lastT = 0;
  return O.chat({
    model, messages: msgs, keepAlive: (isNaN(keep) ? 2 : keep) + 'm', signal, onDelta, think: !!st.aiThink,
    onThinking: n => { const now = Date.now(); if (onThinking && now - lastT > 300) { lastT = now; onThinking(n); } }
  });
}

/* ktoré strihacie programy sú na PC nainštalované (pre sprievodcu) */
function detectEditors() {
  if (process.platform !== 'win32') return [];
  const found = new Set();
  const pf = [process.env.ProgramFiles || 'C:\\Program Files', process.env['ProgramFiles(x86)']].filter(Boolean);
  const la = process.env.LOCALAPPDATA || '';
  const ls = d => { try { return fs.readdirSync(d); } catch (e) { return []; } };
  const has = f => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
  for (const root of pf) {
    if (has(path.join(root, 'Blackmagic Design', 'DaVinci Resolve', 'Resolve.exe'))) found.add('Resolve.exe');
    if (has(path.join(root, 'Blackmagic Design', 'Fusion 19', 'Fusion.exe')) || ls(path.join(root, 'Blackmagic Design')).some(d => /^Fusion/i.test(d))) found.add('Fusion.exe');
    for (const d of ls(path.join(root, 'Adobe'))) {
      if (/^Adobe Premiere Pro/i.test(d)) found.add('Adobe Premiere Pro.exe');
      if (/^Adobe After Effects/i.test(d)) found.add('AfterFX.exe');
      if (/^Adobe Photoshop/i.test(d)) found.add('Photoshop.exe');
      if (/^Adobe Illustrator/i.test(d)) found.add('Illustrator.exe');
    }
    if (ls(path.join(root, 'VEGAS')).length || ls(root).some(d => /^VEGAS Pro/i.test(d))) found.add('vegas*');
    if (ls(path.join(root, 'Blender Foundation')).length) found.add('blender.exe');
    if (has(path.join(root, 'Shotcut', 'shotcut.exe'))) found.add('Shotcut.exe');
    if (has(path.join(root, 'kdenlive', 'bin', 'kdenlive.exe'))) found.add('kdenlive.exe');
    if (ls(path.join(root, 'Maxon Cinema 4D 2025')).length || ls(root).some(d => /^Maxon Cinema 4D/i.test(d))) found.add('Cinema 4D.exe');
  }
  if (la && (has(path.join(la, 'CapCut', 'Apps', 'CapCut.exe')) || ls(path.join(la, 'CapCut')).length)) found.add('CapCut.exe');
  return Array.from(found);
}

/* ---------- Claude desktop: zápis MCP servera do jeho konfigurácie ---------- */
function claudeConfigPaths() {
  const out = [];
  const appData = app.getPath('appData');
  out.push(path.join(appData, 'Claude', 'claude_desktop_config.json'));
  // verzia z Microsoft Store má konfiguráciu inde
  try {
    const pk = path.join(process.env.LOCALAPPDATA || '', 'Packages');
    for (const d of fs.readdirSync(pk)) if (/^Claude_/i.test(d)) out.push(path.join(pk, d, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json'));
  } catch (e) { }
  return out;
}
function mcpEntry() {
  const unpack = p => p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
  return {
    command: process.execPath,
    args: [unpack(path.join(ROOT, 'src', 'mcp', 'server.js'))],
    env: { ELECTRON_RUN_AS_NODE: '1', WOI_DATA: app.getPath('userData') }
  };
}
/* nainštalovaná appka: štart s Windowsom a prepojenie s Claude ukazujú na ňu, nie na starú
   verziu spúšťanú zo zdrojákov (Spustit.bat), ktorú si si možno predtým nastavil */
function fixInstallPaths(st) {
  try { app.setLoginItemSettings({ openAtLogin: !!st.launchAtLogin, args: ['--hidden'] }); } catch (e) { log.warn('štart s Windowsom', e.message); }
  try {
    const entry = mcpEntry();
    for (const file of claudeConfigPaths()) {
      if (!fs.existsSync(file)) continue;
      const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
      const cur = cfg.mcpServers && cfg.mcpServers.workingonit;
      if (!cur || JSON.stringify(cur) === JSON.stringify(entry)) continue;
      fs.copyFileSync(file, file + '.pred-workingonit.bak');
      cfg.mcpServers.workingonit = entry;
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
      log.info('Claude: cesta k WorkingOnIt aktualizovaná', file);
    }
  } catch (e) { log.warn('Claude konfigurácia', e.message); }
}

function claudeConfig(write, remove) {
  const paths = claudeConfigPaths();
  const found = paths.filter(p => fs.existsSync(path.dirname(p)));
  const res = { installed: found.length > 0, connected: false, files: [], entry: mcpEntry() };
  for (const file of found) {
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fs.existsSync(file) && (write || remove)) throw new Error(t('Konfigurácia Claude sa nedá prečítať: {file}', { file })); }
    const has = !!(cfg.mcpServers && cfg.mcpServers.workingonit);
    if (write || remove) {
      if (fs.existsSync(file)) fs.copyFileSync(file, file + '.pred-workingonit.bak');
      cfg.mcpServers = cfg.mcpServers || {};
      if (remove) delete cfg.mcpServers.workingonit; else cfg.mcpServers.workingonit = mcpEntry();
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    }
    const now = write ? true : remove ? false : has;
    res.files.push({ file, connected: now, others: Object.keys(cfg.mcpServers || {}).filter(k => k !== 'workingonit') });
    if (now) res.connected = true;
  }
  return res;
}

/* ---------- spotlight (plávajúce okno nad všetkým) ---------- */
function createSpotlight() {
  spot = new BrowserWindow({
    width: 760, height: 520, frame: false, transparent: true, resizable: false, movable: false,
    show: false, skipTaskbar: true, alwaysOnTop: true, fullscreenable: false, maximizable: false, minimizable: false,
    backgroundColor: '#00000000', hasShadow: false,
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  guardNavigation(spot);
  spot.setAlwaysOnTop(true, 'screen-saver');
  spot.loadFile(path.join(ROOT, 'src', 'renderer', 'spotlight.html'));
  spot.on('blur', () => hideSpotlight());
  spot.on('closed', () => { spot = null; });
}
/* spotlight sa vytvorí až pri prvom použití a po 15 minútach bez použitia sa zatvorí (šetrí asi 70 MB RAM) */
let spotIdle = null;
function showSpotlight() {
  clearTimeout(spotIdle);
  if (!spot || spot.isDestroyed()) {
    createSpotlight();
    spot.once('ready-to-show', () => showSpotlight());
    return;
  }
  const { screen } = require('electron');
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  spot.setBounds({ x: Math.round(d.x + (d.width - 760) / 2), y: Math.round(d.y + d.height * 0.16), width: 760, height: 520 });
  spot.show(); spot.focus();
  Clip.readText().then(txt => { if (spot && !spot.isDestroyed()) spot.webContents.send('event', { type: 'spotlightOpen', clipboard: txt.slice(0, 4000) }); }).catch(() => { });
}
function hideSpotlight() {
  if (spot && !spot.isDestroyed() && spot.isVisible()) spot.hide();
  clearTimeout(spotIdle);
  spotIdle = setTimeout(() => { if (spot && !spot.isDestroyed() && !spot.isVisible()) spot.destroy(); }, Number(process.env.WOI_SLEEP_MS) || 15 * 60000);
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  // Ctrl+Alt samotné je na slovenskej klávesnici AltGr, preto aj Shift
  try { globalShortcut.register(SHORTCUT, () => showWindow({ type: 'quickAdd', fromClipboard: true })); } catch (e) { }
  const key = store.get().settings.spotlightHotkey;
  if (!key) return true;
  try { return globalShortcut.register(key, () => (spot && spot.isVisible()) ? hideSpotlight() : showSpotlight()); } catch (e) { return false; }
}

/* ---------- jazyk ---------- */
const systemLang = () => { try { return (app.getPreferredSystemLanguages() || [])[0] || app.getLocale(); } catch (e) { return app.getLocale(); } };
function applyLanguage() {
  const st = store.get().settings;
  I18N.setLang(st.language, systemLang());
  I18N.setCurrency(st.currency);
  refreshTray();
}

/* ---------- štart ---------- */
app.whenReady().then(() => {
  log.init(path.join(app.getPath('userData'), 'logs'));
  log.info('štart', app.getVersion(), process.platform, 'electron ' + process.versions.electron, app.isPackaged ? 'nainštalovaná' : 'TEST', DATA.dir);
  for (const n of DATA.note) log.info('dáta:', n);
  store = new Store(app.getPath('userData'));
  if (store.recovered) log.warn('dáta obnovené zo zálohy', store.recovered);
  const st = store.get().settings;
  // nový používateľ: jazyk podľa systému (slovenčina a čeština → slovenčina, inak angličtina), uložíme ho
  if (!I18N.LANGS.some(l => l.id === st.language)) {
    const lang = I18N.guess(systemLang());
    let region = '';
    try { region = app.getSystemLocale(); } catch (e) { }
    const fresh = !store.get().projects.length;
    Object.assign(st, { language: lang }, fresh ? { currency: I18N.guessCurrency(region || systemLang()) } : {}, L.languageDefaultsPatch(st, 'sk', lang, !fresh));
    store.save();
    log.info('jazyk', lang, systemLang(), region, st.currency);
  }
  I18N.setLang(st.language, systemLang()); I18N.setCurrency(st.currency);
  applyAppearance(st);
  // Windows prepol svetlý/tmavý režim: okno dostane správnu farbu pozadia
  nativeTheme.on('updated', () => { if (win && !win.isDestroyed()) win.setBackgroundColor(themeBg(store.get().settings)); });
  if (app.isPackaged) fixInstallPaths(st);
  if (!st.rootFolder) {
    // rozumný predvolený priečinok, vytvorí sa až pri prvom projekte
    store.get().settings.rootFolder = path.join(app.getPath('videos'), t('WorkingOnIt Projekty'));
    store.save();
  }

  tracker = new Tracker(store, app.getPath('userData'));
  // prihlásenie do vlastnej databázy šifruje Windows (DPAPI), keď to ide
  const { safeStorage } = require('electron');
  const canEnc = () => { try { return safeStorage.isEncryptionAvailable(); } catch (e) { return false; } };
  sync = new Sync(store, app.getPath('userData'), {
    encrypt: s => canEnc() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : s,
    decrypt: s => String(s).startsWith('enc:') ? safeStorage.decryptString(Buffer.from(String(s).slice(4), 'base64')) : s
  });
  watcher = new RenderWatcher(store);
  remote = new RemoteServer({ store, runAction, rootDir: ROOT, kitChat, userData: app.getPath('userData') });
  localApi = new LocalApi({ store, runAction, getLive: () => tracker.live });

  let pushT = null;
  store.on('changed', () => {
    // jazyk alebo mena prišli z iného zariadenia (online databáza)
    const ss = store.get().settings;
    if ((I18N.LANGS.some(l => l.id === ss.language) && ss.language !== I18N.lang) || ss.currency !== I18N.currency) applyLanguage();
    clearTimeout(pushT);
    pushT = setTimeout(() => { send('state', store.get()); refreshTray(); }, 60);
  });
  store.on('status', ({ project, to }) => {
    if (to === 'done') send('event', { type: 'celebrate', projectId: project.id });
  });
  tracker.on('live', live => { send('live', live); refreshTray(); remote.push(); });
  tracker.on('unknown', info => {
    send('event', Object.assign({ type: 'unknownProject' }, info));
    // keď robíš v strihacom programe, okno WorkingOnIt je za ním: ozveme sa notifikáciou
    if (!win || !win.isVisible() || win.isMinimized() || !win.isFocused()) {
      notify(t('{name}: nový projekt?', { name: store.get().settings.mascotName || 'Kit' }), t('V {app} máš otvorený „{project}“. Klikni a pridám ho do WorkingOnIt.', { app: info.app, project: info.name }),
        () => send('event', Object.assign({ type: 'unknownProject', open: true }, info)));
    }
  });
  tracker.on('autoAdd', info => {
    try {
      const r = addFromEditor(info);
      send('event', { type: 'autoAdded', id: r.project.id, name: info.name, app: info.app, merged: !!r.merged, claimed: r.claimed });
      if ((!win || !win.isVisible() || win.isMinimized() || !win.isFocused()) && !r.merged) {
        notify(t('Nová zákazka: {title}', { title: r.project.title }), t('Robíš na nej v {app}, tak meriam čas. Klikni a doplň klienta a cenu.', { app: info.app }),
          () => send('event', { type: 'openProject', id: r.project.id }));
      }
    } catch (e) { log.error('autoAdd', e); }
  });
  tracker.on('worked', (id, ms) => autoStatus(id, ms));
  watcher.on('render', ({ project, render, how }) => {
    const s = store.get();
    if (project && s.settings.renderAutoReview && ['working', 'revisions'].includes(project.status)) store.setStatus(project.id, 'review');
    send('event', { type: 'render', projectId: project ? project.id : null, render, how });
    if (s.settings.notifyRenders) {
      notify(project ? t('Render hotový · {title}', { title: project.title }) : t('Nový render bez projektu'), render.name + ' (' + (render.size / 1048576).toFixed(1) + ' MB)',
        () => send('event', project ? { type: 'openProject', id: project.id } : { type: 'go', view: 'time' }));
    }
  });

  ipcMain.handle('state', () => ({ state: store.get(), live: tracker.live, platform: process.platform, version: app.getVersion(), recovered: store.recovered || null }));
  ipcMain.handle('action', async (e, { type, payload }) => {
    try { return { ok: true, result: await runAction(type, payload, 'app') }; }
    catch (err) { log.warn('akcia ' + type + ' zlyhala:', err.message); return { ok: false, error: err.message }; }
  });
  ipcMain.on('log', (e, { level, msg }) => { (log[level] || log.info)('[okno]', String(msg).slice(0, 4000)); });

  const hidden = process.argv.includes('--hidden') || st.startMinimized;
  createWindow(hidden);
  buildTray();
  tracker.start();
  watcher.start();
  remote.start();
  localApi.start();
  sync.on('status', st => send('sync', st));
  sync.start();

  registerHotkeys();

  // aktualizácie: kontrola po štarte a potom každé 4 hodiny (len v nainštalovanej verzii)
  U.init({ send, getSettings: () => store.get().settings, notify: (title, b) => notify(title, b, () => send('event', { type: 'go', view: 'settings', anchor: 'about' })) });

  // lokálne AI: keď je zapnuté, Ollamu potichu spustíme, aby Kit odpovedal hneď
  if (st.ollamaEnabled && st.ollamaAutoStart !== false) {
    setTimeout(() => O.ensureRunning({ autoStart: true, exe: st.ollamaPath, logFile: ollamaLog() })
      .then(r => log.info('ollama', r.running ? 'beží ' + r.version + (r.started ? ' (spustil som ju)' : '') : 'nebeží', r.error || ''))
      .catch(e => log.warn('ollama', e.message)), 6000);
  }

  const checkDeadlines = () => {
    if (!store.get().settings.notifyDeadlines) return;
    for (const r of H.dueReminders(store)) notify(r.title, r.body, () => send('event', { type: 'openProject', id: r.project.id }));
  };
  setTimeout(checkDeadlines, 8000);
  setInterval(checkDeadlines, 15 * 60000);
  // raz za minútu prepočítať (deadliny „dnes/zajtra“, live časovače)
  setInterval(() => send('tick', Date.now()), 60000);
});

app.on('second-instance', () => showWindow());
let quitSynced = false;
app.on('before-quit', e => {
  quitting = true;
  if (tracker) tracker.stop(); if (remote) remote.stop();
  if (store) { store.stopManual && store.runningManual() && store.stopManual(); store.save(true); }
  // posledné zmeny ešte pošleme do databázy (najviac 4 s), aby ich mali aj ostatné zariadenia
  if (!quitSynced && sync && sync.status().signedIn) {
    quitSynced = true; e.preventDefault();
    Promise.race([sync.syncNow(), new Promise(r => setTimeout(r, 4000))]).catch(() => { }).finally(() => app.quit());
  }
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', e => { /* zostávame v tray */ });
