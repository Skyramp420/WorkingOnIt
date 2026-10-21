/* Rýchle testy logiky bez Electronu: node test/run-tests.js */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const L = require('../src/shared/logic');
const P = require('../src/shared/parse');
const Store = require('../src/main/store');
const H = require('../src/main/helpers');
const { RenderWatcher } = require('../src/main/watcher');
const { RemoteServer } = require('../src/main/remote');
const { Tracker } = require('../src/main/tracker');

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ✓ ' + name); } catch (e) { console.log('  ✗ ' + name + '\n    ' + e.stack); process.exitCode = 1; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
// písmo Bricolage pribudlo vo verzii 1.6; kým nebeží npm install, testy ho nevyžadujú
// písma sú v node_modules až po npm install novej verzie (Spustit.bat to urobí sám)
const HAS_FONT = ['bricolage-grotesque', 'inter'].every(f => fs.existsSync(path.join(__dirname, '..', 'node_modules', '@fontsource-variable', f)));

(async () => {
  const now = new Date('2026-10-14T19:00:00');
  console.log('Parser');
  await test('Discord správa', () => {
    const r = P.parseMessage('Marek — 14.10.2026 18:22\nAhoj, potreboval by som intro pre môj server SkyForge, budget 40€, do piatku?', now).fields;
    assert.deepStrictEqual([r.client, r.type, r.reward, r.deadline, r.title], ['Marek', 'Intro', 40, '2026-10-16', 'SkyForge']);
  });
  await test('anglicky + next week', () => {
    const r = P.parseMessage('Tomi — Today at 18:22\ncan u make a montage for my channel CraftSMP, 25 eur, by next week', now).fields;
    assert.strictEqual(r.reward, 25); assert.strictEqual(r.type, 'Montage'); assert.strictEqual(r.deadline, '2026-10-23');
  });
  await test('dátum bez roka + "zaplatím 60 e"', () => {
    const r = P.parseMessage('zostrih vlogu do 28.10., zaplatím 60 e', now).fields;
    assert.strictEqual(r.deadline, '2026-10-28'); assert.strictEqual(r.reward, 60);
  });
  await test('trvanie videa nie je cena', () => {
    const r = P.parseMessage('potrebujem edit na 3 minúty, za 50', now).fields;
    assert.strictEqual(r.reward, 50);
  });
  await test('česká správa: upútavka, deadline „do pátku“ má prednosť pred dátumom eventu', () => {
    const r = P.parseMessage('Ahoj, na 31. 10. jsem naplánoval Halloweenský event na Arena SMP a chtěl bych upoutávku. Song má 1 minutu a 54 sekund, formát 16:9 i 9:16 na TikTok. Zaplatím 1500 Kč, hotové do pátku?', now).fields;
    assert.strictEqual(r.type, 'Trailer'); assert.strictEqual(r.title, 'Arena SMP'); assert.strictEqual(r.deadline, '2026-10-16');
    assert.strictEqual(r.reward, undefined); assert.ok(r.rewardNote.includes('1500'));
  });
  await test('Notion CSV', () => {
    const csv = 'Name,Status,Type,Deadline,Contact,Contact Name,Reward For Work,Already Paid,Priority\nSkyForge,Almost Finished,Motion GFX,"August 28, 2026",Discord DM,Marek,60,20,\nTherapie,To Do,,,,,,,\n';
    const list = P.parseNotionCSV(csv);
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].status, 'revisions'); assert.strictEqual(list[0].deadline, '2026-08-28');
    assert.strictEqual(list[0].reward, 60); assert.strictEqual(list[0].payments[0].amount, 20);
    assert.strictEqual(list[1].status, 'todo');
  });

  console.log('Logika');
  await test('levely a XP', () => {
    assert.strictEqual(L.levelOf(0).level, 1); assert.strictEqual(L.levelOf(100).level, 2); assert.strictEqual(L.levelOf(249).level, 2); assert.strictEqual(L.levelOf(250).level, 3);
  });
  await test('deadline texty', () => {
    const p = { deadline: '2026-10-11', status: 'todo' };
    assert.strictEqual(L.deadlineInfo(p, +now).label, 'po termíne 3 dni');
    assert.strictEqual(L.deadlineInfo({ deadline: '2026-10-15', status: 'todo' }, +now).label, 'zajtra');
    assert.strictEqual(L.deadlineInfo({ deadline: '2026-10-21', status: 'todo' }, +now).label, 'o 7 dní');
  });
  await test('párovanie okna s projektom', () => {
    const s = { projects: [L.newProject({ title: 'SkyForge' }), L.newProject({ title: 'Intro' })] };
    assert.strictEqual(L.matchProjectByTitle(s, 'Adobe After Effects 2025 - C:\\Projekty\\SkyForge_v2.aep *').title, 'SkyForge');
    assert.strictEqual(L.matchProjectByTitle(s, 'DaVinci Resolve Studio - Untitled'), null);
  });
  await test('názov priečinka', () => {
    assert.strictEqual(L.folderNameFrom('{rok}-{mesiac}_{klient}_{nazov}', { client: 'Ma:rek', title: 'Sky/Forge?' }, new Date('2026-10-02')), '2026-10_Marek_SkyForge');
  });

  await test('archív: ručne, automaticky po dňoch, a návrat', () => {
    const st = { archiveAfterDays: 7 };
    const old = { status: 'done', doneAt: new Date(Date.now() - 10 * L.DAY).toISOString() };
    assert.strictEqual(L.isArchived(old, st), true);
    assert.strictEqual(L.isArchived(Object.assign({}, old, { archived: false }), st), false);
    assert.strictEqual(L.isArchived({ status: 'todo', archived: true }, st), true);
    const p = L.newProject({ status: 'todo', archived: true });
    L.setStatus(p, 'working');
    assert.strictEqual(L.isArchived(p, st), false, 'pohnutá zákazka sa vráti na nástenku');
  });
  await test('dáta: nainštalovaná appka začína načisto, skúšanie ide do testovacej appky', () => {
    const D = require('../src/main/datadir');
    const ad = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-ad-'));
    const prod = path.join(ad, 'WorkingOnIt'), test = path.join(ad, 'WorkingOnIt Test');
    fs.mkdirSync(path.join(prod, 'zalohy'), { recursive: true });
    fs.writeFileSync(path.join(prod, 'data.json'), '{"skuska":1}');
    // 1) Spustit.bat si staré dáta zoberie
    assert.strictEqual(D.resolve({ appData: ad, packaged: false }).dir, test);
    assert.ok(fs.existsSync(path.join(test, 'data.json')) && !fs.existsSync(path.join(prod, 'data.json')));
    // 2) nainštalovaná appka: prázdny priečinok so značkou
    assert.strictEqual(D.resolve({ appData: ad, packaged: true }).dir, prod);
    assert.ok(fs.existsSync(path.join(prod, D.MARK)) && !fs.existsSync(path.join(prod, 'data.json')));
    // 3) skutočné dáta v produkcii sa už nikdy nepresunú
    fs.writeFileSync(path.join(prod, 'data.json'), '{"ostre":1}');
    D.resolve({ appData: ad, packaged: true }); D.resolve({ appData: ad, packaged: false });
    assert.strictEqual(fs.readFileSync(path.join(prod, 'data.json'), 'utf8'), '{"ostre":1}');
    // 4) inštalácia skôr než Spustit.bat: skúšobné dáta idú preč z produkcie (do testovacej, nič sa nemaže)
    const ad2 = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-ad2-'));
    fs.mkdirSync(path.join(ad2, 'WorkingOnIt')); fs.writeFileSync(path.join(ad2, 'WorkingOnIt', 'data.json'), '{"skuska":2}');
    D.resolve({ appData: ad2, packaged: true });
    assert.ok(!fs.existsSync(path.join(ad2, 'WorkingOnIt', 'data.json')));
    assert.strictEqual(fs.readFileSync(path.join(ad2, 'WorkingOnIt Test', 'data.json'), 'utf8'), '{"skuska":2}');
  });
  await test('Kit nevidí archivované zákazky ako aktívne', () => {
    const s = L.emptyState();
    const a = L.newProject({ title: 'Gennario trailer', client: 'Gen', status: 'todo' }); a.archived = true;
    const b = L.newProject({ title: 'Reels pre kaviareň', client: 'Lumo', status: 'todo' });
    s.projects.push(a, b);
    assert.strictEqual(L.isActive(a, s.settings), false);
    assert.strictEqual(L.isActive(b, s.settings), true);
    const ctx = H.kitContext(s);
    const act = ctx.split(/\n(?:Hotové|Finished)/)[0];
    assert.ok(act.includes('Reels pre kaviareň') && !act.includes('Gennario'), act);
    assert.ok(/(V archíve|In the archive)[^\n]*Gennario trailer/.test(ctx), ctx);
  });
  await test('cenový tip, klienti, odznaky, recap', () => {
    const s = L.emptyState();
    const mk = (f, hours) => { const p = L.newProject(f); s.projects.push(p); if (hours) s.sessions.push({ projectId: p.id, app: 'X', start: new Date(Date.now() - hours * 3600000).toISOString(), end: new Date().toISOString() }); return p; };
    const done = new Date().toISOString();
    mk({ title: 'a', client: 'Gen', type: 'Intro', reward: 20, status: 'done', doneAt: done, payments: [{ at: done, amount: 20 }] }, 2);
    mk({ title: 'b', client: 'gen', type: 'Intro', reward: 30, status: 'done', doneAt: done, payments: [{ at: done, amount: 30 }] }, 2);
    const tip = L.priceTip(s, 'Intro');
    assert.strictEqual(tip.medReward, 25); assert.strictEqual(tip.byTime, 30); assert.strictEqual(tip.suggest, 30);
    const c = L.clientStats(s);
    assert.strictEqual(c.length, 1, 'Gen a gen je ten istý klient'); assert.strictEqual(c[0].paid, 50);
    const ach = L.achievementsState(s).filter(a => a.ok).map(a => a.id);
    assert.ok(ach.includes('first') && ach.includes('firstDone') && ach.includes('speedrun'));
    const r = L.recapData(s, new Date().getFullYear(), new Date().getMonth());
    assert.strictEqual(r.done, 2); assert.strictEqual(r.paid, 50); assert.strictEqual(Math.round(r.ms / 3600000), 4);
  });

  console.log('Store, priečinky, rendery, mobil');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-'));
  const store = new Store(path.join(tmp, 'data'));
  store.updateSettings({ rootFolder: path.join(tmp, 'Projekty') });
  let id;
  await test('vytvorenie projektu + priečinok', () => {
    id = store.createProject({ title: 'SkyForge', client: 'Marek', reward: 60 }).id;
    const dir = H.createProjectFolder(store, id);
    assert.ok(fs.existsSync(path.join(dir, '05_Renders')));
    assert.ok(fs.existsSync(path.join(dir, '02_Audio', 'Music')));
    assert.ok(fs.readFileSync(path.join(dir, '_zadanie.txt'), 'utf8').includes('Marek'));
    assert.strictEqual(store.project(id).folder, dir);
  });
  await test('status + platby + uloženie na disk', async () => {
    store.setStatus(id, 'done');
    store.addPayment(id);
    assert.strictEqual(L.owedOf(store.project(id)), 0);
    store.save(true);
    const again = new Store(path.join(tmp, 'data'));
    assert.strictEqual(again.project(id).status, 'done');
    assert.ok(fs.readdirSync(path.join(tmp, 'data', 'zalohy')).length >= 1);
  });
  await test('meranie: tiky sa spájajú do jednej session', () => {
    store.trackTick({ projectId: id, app: 'DaVinci Resolve', title: 'x' }, 2000);
    store.trackTick({ projectId: id, app: 'DaVinci Resolve', title: 'x' }, 2000);
    store.trackTick({ projectId: null, app: 'Premiere Pro', title: 'y' }, 2000);
    assert.strictEqual(store.get().sessions.length, 2);
  });
  await test('tracker priradí čas podľa názvu okna a pauzne pri AFK', () => {
    const t = new Tracker(store, tmp);
    store.setStatus(id, 'working');
    t.onSample({ proc: 'AfterFX', title: 'Adobe After Effects 2025 - SkyForge.aep', idle: 1000 });
    assert.strictEqual(t.live.mode, 'auto'); assert.strictEqual(t.live.projectId, id);
    t.onSample({ proc: 'AfterFX', title: 'Adobe After Effects 2025 - SkyForge.aep', idle: 10 * 60000 });
    assert.strictEqual(t.live.mode, 'idle');
    t.onSample({ proc: 'chrome', title: 'YouTube', idle: 0 });
    assert.strictEqual(t.live.mode, 'off');
  });
  await test('odbehnutie z programu: pauza a po návrate pokračuje tá istá session', () => {
    const t = new Tracker(store, tmp);
    store.updateSettings({ awayGraceMinutes: 3 });
    t.onSample({ proc: 'Resolve', title: 'DaVinci Resolve - SkyForge', idle: 0 });
    const before = store.get().sessions.length;
    t.onSample({ proc: 'chrome', title: 'YouTube', idle: 0 });
    assert.strictEqual(t.live.mode, 'away');
    t.onSample({ proc: 'Resolve', title: 'DaVinci Resolve - SkyForge', idle: 0 });
    assert.strictEqual(t.live.mode, 'auto');
    assert.strictEqual(store.get().sessions.length, before, 'nemala vzniknúť nová session');
    store.updateSettings({ awayGraceMinutes: 0 });
    t.onSample({ proc: 'chrome', title: 'YouTube', idle: 0 });
    assert.strictEqual(t.live.mode, 'off');
  });
  await test('neznámy projekt v editore → otázka, ignorovaný už nie', () => {
    store.updateSettings({ newProjectMode: 'ask' });
    const t = new Tracker(store, tmp);
    const asked = [];
    t.on('unknown', e => asked.push(e.name));
    t.onSample({ proc: 'Adobe Premiere Pro', title: 'Adobe Premiere Pro 2025 - C:\\Edits\\Arena\\04_Projekt\\Arena trailer.prproj *', idle: 0 });
    t.onSample({ proc: 'Adobe Premiere Pro', title: 'Adobe Premiere Pro 2025 - C:\\Edits\\Arena\\04_Projekt\\Arena trailer.prproj *', idle: 0 });
    assert.deepStrictEqual(asked, ['Arena trailer']);
    store.updateSettings({ ignoredNames: ['Bez mena test'] });
    t.onSample({ proc: 'AfterFX', title: 'Adobe After Effects 2025 - Bez mena test.aep', idle: 0 });
    t.onSample({ proc: 'AfterFX', title: 'Adobe After Effects 2025 - Untitled Project.aep', idle: 0 });
    assert.strictEqual(asked.length, 1);
    const { extractProjectName } = require('../src/main/tracker');
    assert.strictEqual(extractProjectName('x', 'Adobe Premiere Pro 2025 - C:\\Edits\\Arena\\04_Projekt\\Arena trailer.prproj *').folder, 'C:\\Edits\\Arena');
    store.updateSettings({ newProjectMode: 'auto', ignoredNames: [] });
  });

  await test('názvy okien: DaVinci, AE 2026, Premiere, Vegas, Blender, dialógy', () => {
    const D = require('../src/main/detect');
    const x = (proc, t) => D.extractProjectInfo(proc, t);
    assert.strictEqual(x('Resolve', 'DaVinci Resolve Studio - Tatry').name, 'Tatry');
    assert.strictEqual(x('Resolve', 'DaVinci Resolve Studio - Marek - intro').name, 'Marek - intro');
    assert.ok(x('Resolve', 'DaVinci Resolve Studio - Untitled Project 37').untitled);
    assert.strictEqual(x('Resolve', 'DaVinci Resolve Studio - Project Manager'), null);
    const ae = x('AfterFX', 'Adobe After Effects 2026 - therapie (converted).aep *');
    assert.strictEqual(ae.name, 'therapie'); assert.strictEqual(ae.file, null);
    const pr = x('Adobe Premiere Pro', 'Adobe Premiere Pro 2026 - C:\\Edits\\Marek\\Projekt\\Highlights_v3 (Converted).prproj *');
    assert.strictEqual(pr.name, 'Highlights'); assert.strictEqual(pr.folder, 'C:\\Edits\\Marek');
    assert.strictEqual(x('vegas220', 'Arena.veg * - VEGAS Pro 22.0').name, 'Arena');
    assert.strictEqual(x('vegas220', 'VEGAS Pro 22.0 - SkyForge.veg').name, 'SkyForge');
    assert.strictEqual(x('blender', 'Blender [C:\\3d\\logo_v2.blend]').name, 'logo');
    assert.strictEqual(x('AfterFX', 'Composition Settings'), null);
    assert.strictEqual(x('AfterFX', 'Adobe After Effects 2026'), null);
    assert.strictEqual(D.prettyTitle('arena_trailer'), 'Arena trailer');
  });

  await test('spárovanie: priečinok, názov, klient, iný priečinok = iná zákazka', () => {
    const D = require('../src/main/detect');
    const now = Date.parse('2026-10-15T12:00:00Z');
    const st = { focusProjectId: null, sessions: [], projects: [
      L.newProject({ id: 'h', title: 'Halloween 2026 trailer', client: 'StemYk / Therapie', status: 'done', doneAt: '2026-10-15T10:51:00Z', folder: 'C:\\P\\2026-10_StemYk Therapie_Halloween 2026 trailer' }),
      L.newProject({ id: 'a', title: 'Arena', client: 'Studio Lumo', status: 'working', folder: 'C:\\Edits\\Arena' }),
      L.newProject({ id: 'o', title: 'Starý klip', status: 'done', doneAt: '2025-01-01T00:00:00Z', aliases: ['stary_klip'] })
    ] };
    const m = (proc, t) => D.matchProject(st, D.extractProjectInfo(proc, t), t, now);
    assert.strictEqual(m('AfterFX', 'Adobe After Effects 2026 - therapie (converted).aep *').project.id, 'h');
    assert.strictEqual(m('AfterFX', 'Adobe After Effects 2026 - therapie (converted).aep *').how, 'client');
    const live = m('Resolve', 'DaVinci Resolve Studio - Therapie LIVE');
    assert.ok(!live.project); assert.strictEqual(live.client, 'StemYk / Therapie');
    assert.strictEqual(m('AfterFX', 'Adobe After Effects 2026 - C:\\Edits\\Arena\\titulky.aep').how, 'folder');
    assert.strictEqual(m('AfterFX', 'Adobe After Effects 2026 - C:\\Edits\\Arena 2\\Arena 2.aep'), null);
    assert.strictEqual(m('Resolve', 'DaVinci Resolve Studio - Arena').how, 'name');
    assert.strictEqual(m('Resolve', 'DaVinci Resolve Studio - Studio intro'), null, 'všeobecné slovo „studio“ nie je klient');
    assert.strictEqual(m('Resolve', 'DaVinci Resolve Studio - stary_klip').project.id, 'o', 'presný názov nájde aj starú zákazku');
    const inf = D.inferFromPath('C:\\P\\2026-11_Pixelka_Turnaj highlights\\04_Projekt\\turnaj.aep', { rootFolder: 'C:\\P', folderPattern: '{rok}-{mesiac}_{klient}_{nazov}' });
    assert.deepStrictEqual([inf.folder, inf.client, inf.title], ['C:\\P\\2026-11_Pixelka_Turnaj highlights', 'Pixelka', 'Turnaj highlights']);
  });

  await test('nový projekt v programe: po chvíli sa sám pridá a prevezme odmeraný čas', () => {
    const t = new Tracker(store, tmp, { env: {} });
    const added = [];
    t.on('autoAdd', info => { added.push(info.name); H.addFromEditor(store, info); t.learned(info.name); });
    const sample = { proc: 'Resolve', title: 'DaVinci Resolve Studio - Tatry', idle: 0 };
    for (let i = 0; i < 10; i++) t.onSample(sample);
    assert.strictEqual(t.live.how, 'pending');
    assert.strictEqual(t.live.projectId, null);
    for (let i = 0; i < 20; i++) t.onSample(sample);
    assert.deepStrictEqual(added, ['Tatry']);
    const p = store.get().projects.find(x => x.title === 'Tatry');
    assert.ok(p && p.status === 'working' && p.source === 'editor');
    assert.ok(!store.get().sessions.some(x => x.auto && !x.projectId && /Tatry/.test(x.title)), 'čas pred pridaním patrí zákazke');
    t.onSample(sample);
    assert.strictEqual(t.live.projectId, p.id); assert.strictEqual(t.live.how, 'name');
    // dialóg v DaVinci nemá názov projektu: čas ide ďalej k Tatrám
    t.onSample({ proc: 'Resolve', title: 'Project Settings', idle: 0 });
    assert.strictEqual(t.live.projectId, p.id); assert.strictEqual(t.live.how, 'sticky');
    // nepomenovaný projekt: k Tatrám už nie
    t.onSample({ proc: 'Resolve', title: 'DaVinci Resolve Studio - Untitled Project 38', idle: 0 });
    assert.notStrictEqual(t.live.projectId, p.id);
    t.onSample({ proc: 'chrome', title: 'x', idle: 0 });
    store.deleteProject(p.id);
  });

  await test('stav podľa práce: Na rade → Pracujem, Hotovo → Úpravy', () => {
    const q = store.createProject({ title: 'Stav test', status: 'todo' });
    const w = new Map();
    assert.strictEqual(H.autoStatus(store, w, q.id, 60000), null);
    assert.deepStrictEqual(H.autoStatus(store, w, q.id, 60000).to, 'working');
    store.setStatus(q.id, 'done');
    assert.strictEqual(H.autoStatus(store, w, q.id, 200000), null);
    assert.strictEqual(H.autoStatus(store, w, q.id, 100000).to, 'revisions');
    store.deleteProject(q.id);
  });
  await test('render v 05_Renders sa priradí, footage nie', async () => {
    const w = new RenderWatcher(store);
    const events = [];
    w.on('render', e => events.push(e));
    w.start();
    const dir = store.project(id).folder;
    fs.writeFileSync(path.join(dir, '01_Footage', 'clip.mp4'), Buffer.alloc(1000));
    fs.writeFileSync(path.join(dir, '05_Renders', 'SkyForge_v1.mp4'), Buffer.alloc(5000));
    await wait(13000);
    w.stop();
    assert.strictEqual(events.length, 1, 'počet renderov: ' + events.length);
    assert.strictEqual(events[0].project.id, id);
    assert.strictEqual(store.project(id).renders[0].name, 'SkyForge_v1.mp4');
  });
  await test('mobil: bez kódu 401, s kódom dáta + akcia', async () => {
    store.updateSettings({ remotePort: 47999, remoteEnabled: true });
    const rs = new RemoteServer({ store, rootDir: path.join(__dirname, '..'), runAction: async (type, p) => { if (type === 'setStatus') store.setStatus(p.id, p.status); return true; } });
    rs.start();
    await wait(300);
    const get = (u, opt) => new Promise((res, rej) => { const r = http.request('http://127.0.0.1:47999' + u, opt || {}, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ code: x.statusCode, body: b, headers: x.headers })); }); r.on('error', rej); if (opt && opt.body) r.write(opt.body); r.end(); });
    assert.strictEqual((await get('/api/state')).code, 401);
    const tok = store.get().settings.remoteToken;
    const st = await get('/api/state?t=' + tok);
    assert.strictEqual(JSON.parse(st.body).projects.length, 1);
    const html = await get('/?t=' + tok);
    assert.strictEqual(html.code, 302); assert.ok(html.headers['set-cookie'][0].includes(tok));
    const a = await get('/api/action', { method: 'POST', headers: { 'x-token': tok }, body: JSON.stringify({ type: 'setStatus', payload: { id, status: 'review' } }) });
    assert.strictEqual(a.code, 200); assert.strictEqual(store.project(id).status, 'review');
    const bad = await get('/api/action', { method: 'POST', headers: { 'x-token': tok }, body: JSON.stringify({ type: 'deleteProject', payload: { id } }) });
    assert.strictEqual(bad.code, 400);
    rs.stop();
  });

  await test('mobil: Kit chat streamuje, obrázky len z povolených priečinkov', async () => {
    store.updateSettings({ remotePort: 47997, remoteEnabled: true });
    const seen = [];
    const rs = new RemoteServer({ store, rootDir: path.join(__dirname, '..'), userData: tmp, runAction: async () => true,
      kitChat: async ({ messages, projectId, onDelta }) => { seen.push([messages.length, projectId]); onDelta('Ahoj '); await wait(20); onDelta('Alex'); } });
    rs.start();
    await wait(300);
    const tok = store.get().settings.remoteToken;
    const get = (u, opt) => new Promise((res, rej) => { const r = http.request('http://127.0.0.1:47997' + u, opt || {}, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ code: x.statusCode, body: b })); }); r.on('error', rej); if (opt && opt.body) r.write(opt.body); r.end(); });
    const k = await get('/api/kit', { method: 'POST', headers: { 'x-token': tok }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], projectId: id }) });
    assert.strictEqual(k.body, 'Ahoj Alex');
    // po naskenovaní QR kódu ide prihlásenie cez cookie
    assert.strictEqual((await get('/', { headers: { cookie: 'woi=' + tok } })).code, 200);
    assert.strictEqual((await get('/', { headers: { cookie: 'woi=zly' } })).code, 401);
    assert.deepStrictEqual(seen[0], [1, id]);
    const u = require('url').pathToFileURL(__filename).href;
    assert.strictEqual((await get('/api/img?u=' + encodeURIComponent(u), { headers: { 'x-token': tok } })).code, 404);
    // písmo je v node_modules až po npm install novej verzie
    const font = HAS_FONT ? ['/fonts/bricolage-latin.woff2', '/fonts/inter-latin.woff2', '/fonts/inter-latin-ext.woff2'] : [];
    for (const f of ['/renderer/mascot.js', '/renderer/kit.js', '/renderer/rte.js', '/shared/sbclient.js', '/shared/syncmodel.js', '/mobile/cloud.js', '/manifest.json'].concat(font)) assert.strictEqual((await get(f)).code, 200, f);
    rs.stop();
  });

  await test('verzia MCP servera sedí s appkou', async () => {
    const v = fs.readFileSync(path.join(__dirname, '..', 'src', 'mcp', 'server.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
    assert.strictEqual(v, require('../package.json').version);
  });

  await test('verejná mobilná verzia: všetky súbory, na ktoré stránka odkazuje, existujú', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-web-'));
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build-mobile-web.js'), out]);
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.ok(html.includes('window.WOI_CLOUD = true'));
    const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g), ...html.matchAll(/url\(([^)]+\.woff2)\)/g)].map(m => m[1]).filter(r => !r.startsWith('/') && !r.startsWith('$'));
    assert.ok(refs.length >= 10, 'odkazy: ' + refs.length);
    for (const r of refs) if (HAS_FONT || !r.endsWith('.woff2')) assert.ok(fs.existsSync(path.join(out, r)), 'chýba ' + r);
    assert.ok(!/\/api\/|src="\//.test(html.replace(/fetch\('\/api[^']*'|EventSource\('\/api[^']*'|\/api\/img\?u=/g, '')), 'žiadne absolútne cesty mimo /api');
    const mf = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
    assert.strictEqual(mf.start_url, './');
  });

  await test('lokálne API pre Claude: token, povolené akcie, filtrované polia', async () => {
    const { LocalApi, PORT } = require('../src/main/localapi');
    const calls = [];
    const api = new LocalApi({ store, getLive: () => ({ mode: 'off' }), runAction: async (type, p) => { calls.push([type, p]); return 'ok'; } });
    api.start();
    await wait(200);
    const req = (u, tok, body) => new Promise((res, rej) => { const r = http.request('http://127.0.0.1:' + PORT + u, { method: body ? 'POST' : 'GET', headers: { 'x-token': tok || '' } }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res({ code: x.statusCode, body: b })); }); r.on('error', rej); if (body) r.write(JSON.stringify(body)); r.end(); });
    const tok = store.get().settings.localToken;
    assert.ok(tok && tok.length >= 16);
    assert.strictEqual((await req('/state', 'zly')).code, 401);
    assert.ok(JSON.parse((await req('/state', tok)).body).state.projects.length >= 1);
    assert.strictEqual((await req('/action', tok, { type: 'deleteProject', payload: { id } })).code, 400);
    const r = await req('/action', tok, { type: 'updateProject', payload: { id, patch: { title: 'Nový', folder: 'C:\\Windows' } } });
    assert.strictEqual(r.code, 200);
    assert.deepStrictEqual(calls[0][1].patch, { title: 'Nový' });
    api.stop();
  });

  await test('skloňovanie mien pre Kita a klientov', async () => {
    assert.strictEqual(L.decl('Kit', 'gen'), 'Kita');
    assert.strictEqual(L.decl('Marek', 'dat'), 'Marekovi');
    assert.strictEqual(L.decl('Nexo_', 'dat'), 'Nexo_');
    assert.strictEqual(L.decl('Pixelka', 'dat'), 'Pixelka');
    assert.strictEqual(L.decl('GFX', 'gen'), 'GFX');
  });

  await test('pomôcky: postup, klienti, značka, programy', () => {
    assert.strictEqual(L.projectProgress({ status: 'todo', checklist: [{ done: true }, { done: false }] }), 0.5);
    assert.strictEqual(L.projectProgress({ status: 'review', checklist: [] }), 0.75);
    assert.strictEqual(L.levelTitle(15, ''), 'Šéf štúdia');
    assert.strictEqual(L.levelTitle(15, 'Studio X'), 'Studio X boss');
    assert.strictEqual(L.editorName('vegas220.exe'), 'Vegas Pro');
    assert.strictEqual(L.decl('Marko', 'dat'), 'Markovi');
    const st = { projects: [{ client: 'Marek', createdAt: '2026-10-01', contact: 'E-mail', type: 'Intro' }, { client: 'Tomi', createdAt: '2026-10-05' }, { client: 'marek', createdAt: '2026-10-03', contact: 'E-mail', type: 'Intro' }] };
    assert.deepStrictEqual(L.recentClients(st), ['Tomi', 'marek']);
    assert.strictEqual(L.clientDefaults(st, 'MAREK').contact, 'E-mail');
  });

  await test('nová zákazka: predvolené hodnoty a stály klient', () => {
    store.updateSettings({ defaultContact: 'Instagram', defaultType: 'Intro' });
    const a = store.createProject({ title: 'A' });
    assert.strictEqual(a.contact, 'Instagram'); assert.strictEqual(a.type, 'Intro'); assert.strictEqual(a.status, 'todo');
    store.createProject({ title: 'B', client: 'Studio Lumo', contact: 'E-mail' });
    const c = store.createProject({ title: 'C', client: 'studio lumo' });
    assert.strictEqual(c.contact, 'E-mail'); assert.strictEqual(c.client, 'Studio Lumo');
    const d = store.createProject({ title: 'D', client: 'studio lumo', contact: 'Osobne', contactFromUser: true });
    assert.strictEqual(d.contact, 'Osobne'); assert.ok(!('contactFromUser' in d));
    store.updateSettings({ defaultContact: 'Discord DM', defaultType: 'Edit' });
  });

  await test('nápady: uloženie, storyboard, zmazanie', () => {
    const iid = store.saveIdea({ title: 'Glitch na beat', frames: [{ caption: 'úvod' }, { caption: 'drop', duration: 2 }] });
    const it = store.idea(iid);
    assert.strictEqual(it.frames.length, 2); assert.ok(it.frames[0].id); assert.strictEqual(it.frames[0].duration, 3);
    assert.strictEqual(L.storyboardSeconds(it), 5);
    store.saveIdea({ id: iid, pinned: true, tags: ['efekty'] });
    assert.strictEqual(store.idea(iid).pinned, true); assert.strictEqual(store.idea(iid).title, 'Glitch na beat');
    store.deleteIdea(iid);
    assert.strictEqual(store.idea(iid), undefined);
  });

  await test('tracker spozná program cez * (Vegas Pro)', () => {
    const t = new Tracker(store, tmp);
    store.updateSettings({ editorApps: 'vegas*\nResolve.exe' });
    t.onSample({ proc: 'vegas220', title: 'VEGAS Pro 22.0 - SkyForge.veg', idle: 0 });
    assert.strictEqual(t.live.mode, 'auto'); assert.strictEqual(t.live.app, 'Vegas Pro');
    t.onSample({ proc: 'chrome', title: 'x', idle: 0 });
    store.updateSettings({ editorApps: L.DEFAULT_SETTINGS.editorApps });
  });

  await test('poškodený data.json sa obnoví zo zálohy', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-bad-'));
    fs.mkdirSync(path.join(dir, 'zalohy'));
    const good = L.emptyState(); good.projects.push(L.newProject({ title: 'Zachránená' }));
    fs.writeFileSync(path.join(dir, 'zalohy', 'data-2026-10-10.json'), JSON.stringify(good));
    fs.writeFileSync(path.join(dir, 'data.json'), '{"projects": [ {"title": "rozbit');
    const st2 = new Store(dir);
    assert.strictEqual(st2.get().projects[0].title, 'Zachránená');
    assert.ok(st2.recovered);
    assert.ok(fs.readdirSync(dir).some(f => /^data\.poskodene-/.test(f)));
  });

  await test('prechod zo starej verzie: značka, mobil a bez sprievodcu', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-old-'));
    const old = L.emptyState(); old.projects.push(L.newProject({ title: 'Stará' }));
    old.settings = { v12: true, rootFolder: path.join(dir, 'Pixelka Projekty'), userName: 'Tester' };
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(old));
    const st3 = new Store(dir).get();
    assert.strictEqual(st3.settings.brand, 'Pixelka');
    assert.strictEqual(st3.settings.remoteEnabled, true);
    assert.strictEqual(st3.seenOnboarding, true);
    assert.ok(st3.settings.contactTypes.length && st3.settings.projectTypes.length);
    // doterajší používateľ ostáva v slovenčine, aj keď má Windows po anglicky
    assert.strictEqual(st3.settings.language, 'sk');
    // nový používateľ: mobil vypnutý, sprievodca sa ukáže, jazyk určí appka podľa systému
    const fresh = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'woi-new-'))).get();
    assert.strictEqual(fresh.settings.remoteEnabled, false);
    assert.ok(!fresh.seenOnboarding);
    assert.strictEqual(fresh.settings.language, '');
  });

  await test('obnova z dennej zálohy', () => {
    store.save(true);
    const list = store.backups();
    assert.ok(list.length >= 1);
    const before = store.get().projects.length;
    store.createProject({ title: 'Po zálohe' });
    store.restoreBackup(list[0].name);
    assert.ok(store.get().projects.length <= before + 1);
    assert.ok(fs.readdirSync(path.join(tmp, 'data')).some(f => /^data\.pred-obnovou-/.test(f)));
  });

  console.log('Angličtina');
  const I18N = require('../src/shared/i18n');
  const EN = require('../src/shared/lang-en');
  const SRC = path.join(__dirname, '..', 'src');
  const SK_CHARS = /[áäčďéíĺľňóôŕšťúýž]/i;
  const english = async fn => { I18N.setLang('en', 'en-US'); I18N.setCurrency('USD'); try { return await fn(); } finally { I18N.setLang('sk'); I18N.setCurrency('EUR'); } };

  await test('slovník: každý text v t() aj v HTML má anglický preklad s rovnakými premennými', () => {
    const files = [];
    for (const d of ['renderer', 'shared', 'main', 'mcp', 'mobile']) for (const f of fs.readdirSync(path.join(SRC, d))) {
      if (/\.(js|html)$/.test(f) && !/^(mock|lang-en|i18n)\.js$/.test(f)) files.push(path.join(SRC, d, f));
    }
    const un = x => x.replace(/\\(.)/g, (m, c) => (c === 'n' ? '\n' : c));
    const html = x => x.replace(/&#10;/g, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    const vars = (x, n) => (String(x).match(/\{(\w+)\}/g) || []).filter(v => !(n && v === '{n}')).sort().filter((v, i, a) => a.indexOf(v) === i).join(',');
    const bad = []; let count = 0;
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8'), rel = path.relative(SRC, file);
      const check = (key, plural) => {
        count++;
        const v = EN[key];
        if (v === undefined) return bad.push(rel + ': chýba ' + JSON.stringify(key));
        if (vars(key, plural) !== vars(Array.isArray(v) ? v.join(' ') : v, plural)) bad.push(rel + ': premenné ' + JSON.stringify(key));
      };
      for (const m of src.matchAll(/(?<![\w$.])(?:t|tr)\(\s*'((?:[^'\\\n]|\\.)*)'|I18N\.t\(\s*'((?:[^'\\\n]|\\.)*)'/g)) check(un(m[1] != null ? m[1] : m[2]));
      for (const m of src.matchAll(/(?<![\w$])(?:tp|plural)\(\s*[^'\n]*?,\s*'((?:[^'\\\n]|\\.)*)'\s*,\s*'((?:[^'\\\n]|\\.)*)'\s*,\s*'((?:[^'\\\n]|\\.)*)'/g)) check([m[1], m[2], m[3]].map(un).join('|'), true);
      if (/\.html$/.test(file)) {
        for (const m of src.matchAll(/<(\w+)\b[^>]*\sdata-t(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) check(html(m[2].trim()));
        for (const m of src.matchAll(/<\w+\b([^>]*)\sdata-t-attrs="([^"]+)"/g)) for (const a of m[2].split(',')) {
          const val = (m[1].match(new RegExp('\\s' + a.trim() + '="([^"]*)"')) || [])[1];
          if (val) check(html(val));
        }
      }
    }
    assert.ok(count > 900, 'našlo len ' + count + ' textov');
    assert.deepStrictEqual(bad, []);
  });

  await test('po anglicky: peniaze, dátumy, deadliny a čítanie správy od klienta', () => english(() => {
    assert.strictEqual(L.formatMoney(1234.5), '$1,234.50');
    assert.strictEqual(L.formatDate('2026-03-05'), 'Mar 5');
    assert.strictEqual(L.deadlineInfo({ deadline: '2026-10-11', status: 'todo' }, +now).label, '3 days overdue');
    assert.strictEqual(L.deadlineInfo({ deadline: '2026-10-15', status: 'todo' }, +now).label, 'tomorrow');
    const r = P.parseMessage('Jake — Today at 6:22 PM\nhey can you make me an intro for my channel NovaPlays? budget $40, by friday', now).fields;
    assert.deepStrictEqual([r.client, r.type, r.reward, r.deadline, r.title], ['Jake', 'Intro', 40, '2026-10-16', 'NovaPlays']);
    assert.strictEqual(P.parseMessage('can u edit my vlog? I\'ll pay you 60, need it in two days', now).fields.reward, 60);
    assert.strictEqual(P.parseMessage('can u edit my vlog? I\'ll pay you 60, need it in two days', now).fields.deadline, '2026-10-16');
    assert.strictEqual(P.parseMessage('thumbnail for my stream, £25, by the 20th', now).fields.deadline, '2026-10-20');
    assert.strictEqual(P.parseMessage('promo for Acme, 50 USD, due 10/20', now).fields.deadline, '2026-10-20');
    assert.strictEqual(P.parseMessage('montage, 40 bucks, end of the week please', now).fields.reward, 40);
    assert.strictEqual(P.parseMessage('Jake — Today at 6:22 PM\nneed an outro asap', now).fields.title, 'Intro for Jake');
  }));

  await test('po anglicky: Kit, súbor so zadaním a dáta bez slovenčiny', () => english(() => {
    const st = L.emptyState(); st.settings.userName = 'Sam';
    const p = L.newProject({ title: 'Promo', client: 'Acme', type: 'Iné', contact: 'Osobne', deadline: '2026-10-20', reward: 120, status: 'working', checklist: [] });
    st.projects.push(p);
    const prompt = H.kitSystemPrompt(st, p.id, null);
    assert.ok(!SK_CHARS.test(prompt), (prompt.match(/.{0,50}[áäčďéíĺľňóôŕšťúýž].{0,50}/i) || [])[0]);
    assert.ok(/You are Kit/.test(prompt) && /fee: \$120/.test(prompt));
    for (const x of L.STATUSES.concat(L.PRIORITIES)) assert.ok(!SK_CHARS.test(x.label + (x.hint || '')), x.label);
    for (const a of L.ACHIEVEMENTS) assert.ok(!SK_CHARS.test(a.title + a.desc), a.id);
    for (const m of require('../src/main/ollama').MODELS) assert.ok(!SK_CHARS.test(m.note + m.size), m.name);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-en-'));
    H.writeInfo(dir, p);
    const txt = fs.readFileSync(path.join(dir, '_brief.txt'), 'utf8');
    assert.ok(/^Client:\s+Acme \(In person\)/m.test(txt) && /^Type:\s+Other/m.test(txt) && /^Fee:\s+\$120/m.test(txt), txt);
  }));

  await test('jazyk: predvolené priečinky v angličtine a anglický vzor spozná aj tracker', () => {
    const fix = L.languageDefaultsPatch(L.DEFAULT_SETTINGS, 'sk', 'en', false);
    assert.strictEqual(fix.folderPattern, '{year}-{month}_{client}_{title}'); assert.ok(fix.folderTemplate.includes('04_Project'));
    assert.deepStrictEqual(L.languageDefaultsPatch(L.DEFAULT_SETTINGS, 'sk', 'en', true), {});
    assert.strictEqual(L.languageDefaultsPatch(Object.assign({}, L.DEFAULT_SETTINGS, { folderPattern: 'vlastný' }), 'sk', 'en', false).folderPattern, undefined);
    assert.strictEqual(L.folderNameFrom('{year}-{month}_{client}_{title}', { client: 'Acme', title: 'Promo' }, new Date('2026-10-02')), '2026-10_Acme_Promo');
    const D = require('../src/main/detect');
    const inf = D.inferFromPath('C:\\P\\2026-11_Acme_Spring promo\\04_Project\\a.aep', { rootFolder: 'C:\\P', folderPattern: '{year}-{month}_{client}_{title}' });
    assert.strictEqual(inf.client, 'Acme'); assert.strictEqual(inf.title, 'Spring promo');
  });

  await test('Claude (MCP) odpovedá v jazyku appky', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-mcp-'));
    const st = L.emptyState(); st.settings.language = 'en'; st.settings.currency = 'USD';
    st.projects.push(L.newProject({ title: 'Promo', client: 'Acme', reward: 120, status: 'working' }));
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(st));
    const run = msgs => new Promise((resolve, reject) => {
      const ch = require('child_process').spawn(process.execPath, [path.join(SRC, 'mcp', 'server.js')], { env: Object.assign({}, process.env, { WOI_DATA: dir }) });
      let out = ''; ch.stdout.on('data', d => { out += d; if (out.split('\n').filter(Boolean).length >= msgs.length) ch.stdin.end(); });
      ch.on('close', () => resolve(out.split('\n').filter(Boolean).map(l => JSON.parse(l)))); ch.on('error', reject);
      for (const m of msgs) ch.stdin.write(JSON.stringify(m) + '\n');
    });
    const [init, ov] = await run([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_overview', arguments: {} } }]);
    assert.ok(/The app is in English/.test(init.result.instructions));
    const txt = ov.result.content[0].text;
    assert.ok(/Active jobs \(1\):/.test(txt) && /client Acme/.test(txt) && /\$120/.test(txt), txt);
    assert.ok(!SK_CHARS.test(txt), txt);
  });

  console.log('Vlastná databáza (falošný Supabase)');
  {
    const FS = require('../test/fixtures/fake-supabase');
    const { Sync } = require('../src/main/sync');
    const sbs = await FS.start({ schema: false });
    const mk = name => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-sync-' + name + '-')); const st = new Store(d); return { dir: d, store: st, sync: new Sync(st, d) }; };
    const A = mk('a'), B = mk('b');
    await test('pripojenie: chýbajúce SQL, potom účet a prvé nahratie', async () => {
      const r = await A.sync.connect({ url: sbs.url + '/', key: sbs.key });
      assert.strictEqual(r.schema, false);
      sbs.db.schema = true;
      assert.strictEqual(await A.sync.checkSchema(), true);
      const p = A.store.createProject({ title: 'Cloud test', client: 'Marek', reward: 50 });
      A.store.addPayment(p.id, 20);
      A.store.trackTick({ projectId: p.id, app: 'DaVinci Resolve', title: 'x' }, 2000);
      A.store.updateSettings({ userName: 'Tester', contactTypes: ['Discord DM', 'Instagram'] });
      const img = path.join(A.dir, 'obrazky', 'n1'); fs.mkdirSync(img, { recursive: true });
      fs.writeFileSync(path.join(img, 'obrazok-abc.png'), Buffer.from([137, 80, 78, 71, 1, 2, 3]));
      const url = require('url').pathToFileURL(path.join(img, 'obrazok-abc.png')).href;
      A.store.saveIdea({ title: 'Nápad s obrázkom', html: '<p>x</p><p><img src="' + url + '"></p>', frames: [{ caption: 'z1', image: url }] });
      const out = await A.sync.createAccount('tester@example.com', 'heslo-1234');
      assert.ok(out.pushed >= 5, 'odoslané ' + out.pushed);
      assert.strictEqual(sbs.db.files.size, 1);
      const idea = Array.from(sbs.db.items.values()).find(r => r.kind === 'idea');
      assert.ok(JSON.stringify(idea.data).includes('sb://'), 'obrázok v databáze ako sb://');
      assert.ok(!JSON.stringify(idea.data).includes('file:'), 'v databáze nie sú cesty z PC');
    });
    await test('druhé zariadenie: kód, prihlásenie, stiahne všetko aj obrázky', async () => {
      const code = A.sync.connectionCode();
      assert.ok(/^WOI1\./.test(code));
      await B.sync.connect({ code });
      await assert.rejects(() => B.sync.createAccount('iny@example.com', 'heslo-9999'), /majiteľa/);
      await assert.rejects(() => B.sync.login('tester@example.com', 'zle-heslo'), /Nesprávny/);
      const r = await B.sync.login('tester@example.com', 'heslo-1234');
      assert.ok(r.pulled >= 4, 'stiahnuté ' + r.pulled);
      const sb = B.store.get();
      const p = sb.projects.find(x => x.title === 'Cloud test');
      assert.ok(p && L.paidOf(p) === 20);
      assert.strictEqual(sb.settings.userName, 'Tester');
      assert.deepStrictEqual(sb.settings.contactTypes, ['Discord DM', 'Instagram']);
      assert.ok(sb.sessions.some(x => x.projectId === p.id));
      const idea = sb.ideas.find(x => x.title === 'Nápad s obrázkom');
      const f = idea.frames[0].image;
      assert.ok(f.startsWith('file://') && fs.existsSync(require('url').fileURLToPath(f)), 'obrázok stiahnutý na druhé PC');
      assert.ok(idea.html.includes(f));
      // nič sa nevracia späť: druhé kolo nič nepošle ani nestiahne
      const again = await B.sync.syncNow();
      assert.strictEqual(again.pushed, 0); assert.strictEqual(again.pulled, 0);
      const againA = await A.sync.syncNow();
      assert.strictEqual(againA.pushed, 0, 'A po ozvene nič neposiela');
    });
    await test('zmeny tam a späť, mazanie, novšia zmena vyhrá', async () => {
      const pB = B.store.get().projects.find(x => x.title === 'Cloud test');
      B.store.setStatus(pB.id, 'review');
      const ideaB = B.store.get().ideas[0];
      B.store.deleteIdea(ideaB.id);
      await B.sync.syncNow();
      await A.sync.syncNow();
      const pA = A.store.get().projects.find(x => x.title === 'Cloud test');
      assert.strictEqual(pA.status, 'review');
      assert.ok(!A.store.get().ideas.some(x => x.id === ideaB.id), 'zmazaný nápad zmizol aj na A');
      // konflikt: obe zmenia názov, neskoršia zmena vyhrá
      A.store.updateProject(pA.id, { title: 'Názov z A' });
      await new Promise(r => setTimeout(r, 15));
      B.store.updateProject(pB.id, { title: 'Názov z B' });
      await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
      assert.strictEqual(A.store.project(pA.id).title, 'Názov z B');
      assert.strictEqual(B.store.project(pB.id).title, 'Názov z B');
    });
    await test('mobil online (bez PC): prihlásenie kódom, zmeny sa dostanú do PC', async () => {
      // mobilná stránka v Node: prehliadač nahradíme pár náhradami
      const mem = {};
      Object.assign(global, {
        window: global, WOI: Object.assign({}, L, require('../src/shared/parse.js')), SyncModel: require('../src/shared/syncmodel.js'), SB: require('../src/shared/sbclient.js'),
        localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
        location: { hash: '', pathname: '/' }, history: { replaceState() { } },
        document: { hidden: false, addEventListener() { }, querySelectorAll: () => [] }
      });
      delete require.cache[require.resolve('../src/mobile/cloud.js')];
      require('../src/mobile/cloud.js');
      const C = global.Cloud;
      let data = null; C.onData = d => { data = d; }; C.onStatus = () => { };
      await assert.rejects(() => C.login('nesprávny kód', 'tester@example.com', 'heslo-1234'), /Kód nesedí/);
      await C.login(A.sync.connectionCode(), 'tester@example.com', 'heslo-1234');
      const pm = data.projects.find(x => x.title === 'Názov z B');
      assert.ok(pm && data.cloud, 'mobil vidí zákazky z databázy');
      assert.ok(JSON.parse(mem['woi-cloud']).session.refresh_token, 'prihlásenie ostane v telefóne');
      await C.act('setStatus', { id: pm.id, status: 'done' });
      await C.act('startTimer', { id: pm.id });
      assert.strictEqual(data.live.mode, 'manual');
      const jpg = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]).toString('base64');
      const ideaId = await C.act('captureIdea', { text: 'Záber cez sklo\nráno', image: { data: jpg } });
      await C.act('createFromText', { text: 'Intro pre Nexo do piatku, 40 €' });
      await assert.rejects(() => C.act('deleteProject', { id: pm.id }), /len s appkou na PC/);
      await B.sync.syncNow();
      const sb = B.store.get();
      assert.strictEqual(B.store.project(pm.id).status, 'done');
      assert.ok(B.store.runningManual() && B.store.runningManual().projectId === pm.id, 'časovač z mobilu beží aj na PC');
      const idea = sb.ideas.find(x => x.id === ideaId);
      assert.ok(idea && idea.cover.startsWith('file://') && fs.existsSync(require('url').fileURLToPath(idea.cover)), 'fotka z mobilu je na PC');
      assert.ok(sb.projects.some(x => x.source === 'mobil' && x.reward === 40));
      await C.act('stopTimer');
      await B.sync.syncNow();
      assert.ok(!B.store.runningManual(), 'zastavený časovač aj na PC');
      C.logout();
      assert.ok(!mem['woi-cloud'], 'po odhlásení v telefóne nič neostane');
      for (const k of ['window', 'WOI', 'SyncModel', 'SB', 'localStorage', 'location', 'history', 'document', 'Cloud']) delete global[k];
    });
    await test('zmena hesla z PC: mobil sa prihlási novým, staré už nejde', async () => {
      await assert.rejects(() => A.sync.changePassword('kratke'), /aspoň 8/);
      await assert.rejects(() => A.sync.changePassword('heslo-1234'), /iné ako to súčasné/);
      await A.sync.changePassword('nove-heslo-5678');
      // ďalšie zariadenie (napr. mobil) sa prihlasuje rovnako
      const other = require('../src/shared/sbclient.js').create({ url: A.sync.cfg.url, key: A.sync.cfg.key, fetch: A.sync.fetch });
      await assert.rejects(() => other.signIn('tester@example.com', 'heslo-1234'), /heslo/i);
      await other.signIn('tester@example.com', 'nove-heslo-5678');
      assert.ok(other.session && other.session.access_token);
      assert.ok(A.sync.sb.session, 'PC ostalo prihlásené');
      await A.sync.syncNow();
    });
    await test('nová prázdna databáza na tej istej adrese: PC pošle všetko znova', async () => {
      Object.assign(sbs.db, { users: [], items: new Map(), files: new Map(), tokens: new Map(), refresh: new Map() });
      await B.sync.connect({ code: A.sync.connectionCode() });
      const r = await B.sync.createAccount('novy@example.com', 'heslo-5678');
      assert.ok(r.pushed >= 5, 'odoslané ' + r.pushed);
      assert.ok(Array.from(sbs.db.items.values()).some(x => x.kind === 'project' && x.data.title === 'Názov z B'));
    });
    await test('uspatá databáza a odhlásenie: zrozumiteľná chyba, appka ide ďalej', async () => {
      sbs.set({ paused: true });
      const st = await B.sync.syncNow();
      assert.ok(/uspatá/.test(st.error));
      sbs.set({ paused: false });
      const ok = await B.sync.syncNow();
      assert.strictEqual(ok.error, null);
      await B.sync.logout();
      assert.strictEqual(B.sync.status().signedIn, false);
      assert.ok(B.store.get().projects.length >= 1, 'dáta na PC ostali');
    });
    await sbs.stop();
  }

  console.log('Lokálne AI (falošná Ollama)');
  const O = require('../src/main/ollama');
  process.env.OLLAMA_HOST = '127.0.0.1:11555';
  O.setBase();
  const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'woi-ollama-'));
  process.env.FAKE_OLLAMA_LOG = path.join(fakeDir, 'req.log');
  const fake = path.join(__dirname, 'fixtures', 'fake-ollama.js');
  const reqs = () => fs.existsSync(process.env.FAKE_OLLAMA_LOG) ? fs.readFileSync(process.env.FAKE_OLLAMA_LOG, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  await test('keď Ollama nebeží, appka to vie povedať', async () => {
    const r = await O.ensureRunning({ autoStart: false });
    assert.strictEqual(r.running, false);
  });
  await test('Ollamu spustí sama na pozadí', async () => {
    if (process.platform === 'win32') { require('child_process').spawn(process.execPath, [fake], { detached: true, stdio: 'ignore' }).unref(); await wait(600); return; }
    const sh = path.join(fakeDir, 'ollama');
    fs.writeFileSync(sh, '#!/bin/sh\nexec "' + process.execPath + '" "' + fake + '"\n'); fs.chmodSync(sh, 0o755);
    const r = await O.ensureRunning({ autoStart: true, exe: sh, logFile: path.join(fakeDir, 'serve.log') });
    assert.strictEqual(r.running, true); assert.strictEqual(r.started, true); assert.strictEqual(r.versionOk, true);
  });
  await test('chat: Gemma nepremýšľa (think: false), odpoveď sa streamuje', async () => {
    let out = '';
    const full = await O.chat({ model: 'gemma4:12b-it-qat', messages: [{ role: 'user', content: 'ahoj' }], onDelta: d => { out += d; } });
    assert.strictEqual(full, 'Ahoj kamoš'); assert.strictEqual(out, 'Ahoj kamoš');
    const last = reqs().filter(r => r.url === '/api/chat').pop();
    assert.strictEqual(last.body.think, false);
    await O.chat({ model: 'nothink:latest', messages: [], onDelta: () => { } });
    assert.ok(!('think' in reqs().filter(r => r.url === '/api/chat').pop().body));
  });
  await test('chat: model bez podpory „think“ skúsi znova bez neho', async () => {
    const full = await O.chat({ model: 'strict:latest', messages: [], onDelta: () => { } });
    assert.strictEqual(full, 'Ahoj kamoš');
    const calls = reqs().filter(r => r.url === '/api/chat' && r.body.model === 'strict:latest');
    assert.strictEqual(calls.length, 2); assert.ok('think' in calls[0].body); assert.ok(!('think' in calls[1].body));
  });
  await test('modely: zoznam, výber a zrozumiteľná chyba pri sťahovaní', async () => {
    assert.strictEqual(await O.resolveModel('gemma4:12b-it-qat'), 'gemma4:12b-it-qat');
    assert.strictEqual(await O.resolveModel('gemma4:26b'), 'gemma4:12b-it-qat');
    await assert.rejects(O.pull('neexistuje:1b', () => { }), /neexistuje/);
    const seen = [];
    await O.pull('gemma4:e2b-it-qat', p => seen.push(p.status));
    assert.ok(seen.includes('success'));
  });
  try { await fetch('http://127.0.0.1:11555/shutdown'); } catch (e) { }

  console.log(`\n${passed} testov prešlo` + (process.exitCode ? ', niektoré zlyhali' : ''));
  process.exit(process.exitCode || 0);
})();
