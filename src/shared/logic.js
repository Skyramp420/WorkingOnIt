/* WorkingOnIt — zdieľaná logika (beží v appke, v mobile aj v testoch) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WOI = Object.assign(root.WOI || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;

  /* preklady (i18n.js); bez nich ostane slovenčina */
  const SK_PLURAL = (n, one, few, many) => { n = Math.abs(n); return n === 1 ? one : n >= 2 && n <= 4 ? few : many; };
  const STUB = { t: (s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)) : s, plural: SK_PLURAL, locale: () => 'sk-SK', lang: 'sk', currency: 'EUR' };
  let NODE_I18N = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') { try { NODE_I18N = require('./i18n.js'); } catch (e) { } }
  const I = () => (typeof I18N !== 'undefined' ? I18N : NODE_I18N) || STUB;
  const t = (s, v) => I().t(s, v);

  const STATUSES = [
    { id: 'todo', get label() { return t('Na rade'); }, get hint() { return t('Zákazky, ktoré čakajú'); } },
    { id: 'working', get label() { return t('Pracujem'); }, get hint() { return t('Práve strihám / animujem'); } },
    { id: 'review', get label() { return t('Review'); }, get hint() { return t('Klient pozerá preview'); } },
    { id: 'revisions', get label() { return t('Úpravy'); }, get hint() { return t('Zapracúvam feedback'); } },
    { id: 'done', get label() { return t('Hotovo'); }, get hint() { return t('Odovzdané'); } }
  ];
  const STATUS_IDS = STATUSES.map(s => s.id);

  const TYPES = ['Edit', 'Motion GFX', 'Intro', 'Shorts / TikTok', 'Montage', 'Thumbnail', 'Trailer', 'Iné'];
  const CONTACTS = ['Discord DM', 'Discord server', 'Instagram', 'E-mail', 'Osobne', 'Iné'];
  const PRIORITIES = [
    { id: '', get label() { return t('Bez priority'); } },
    { id: 'low', get label() { return t('Nízka'); } },
    { id: 'mid', get label() { return t('Stredná'); } },
    { id: 'high', get label() { return t('Vysoká'); } }
  ];

  /* strihacie a grafické programy, ktoré vie meranie času spoznať (exe, * = začiatok názvu) */
  const EDITORS = [
    { exe: 'Resolve.exe', name: 'DaVinci Resolve' },
    { exe: 'Adobe Premiere Pro.exe', name: 'Premiere Pro' },
    { exe: 'AfterFX.exe', name: 'After Effects' },
    { exe: 'CapCut.exe', name: 'CapCut' },
    { exe: 'vegas*', name: 'Vegas Pro' },
    { exe: 'Fusion.exe', name: 'Fusion' },
    { exe: 'Shotcut.exe', name: 'Shotcut' },
    { exe: 'kdenlive.exe', name: 'Kdenlive' },
    { exe: 'Photoshop.exe', name: 'Photoshop' },
    { exe: 'Illustrator.exe', name: 'Illustrator' },
    { exe: 'blender.exe', name: 'Blender' },
    { exe: 'Cinema 4D.exe', name: 'Cinema 4D' }
  ];
  const editorKey = exe => String(exe || '').trim().toLowerCase().replace(/\.exe$/, '');
  function editorName(exe) {
    const k = editorKey(exe);
    const hit = EDITORS.find(e => { const ek = editorKey(e.exe); return ek.endsWith('*') ? k.startsWith(ek.slice(0, -1)) : ek === k; });
    return hit ? hit.name : String(exe || '').replace(/\.exe$/i, '');
  }
  function editorNames(list) {
    return Array.from(new Set(String(list || '').split(/\r?\n|,/).map(x => x.trim()).filter(Boolean).map(editorName)));
  }

  const DEFAULT_SETTINGS = {
    userName: '',
    brand: '',
    mascotName: 'Kit',
    rootFolder: '',
    folderPattern: '{rok}-{mesiac}_{klient}_{nazov}',
    folderTemplate: '01_Footage\n02_Audio\n02_Audio/Music\n02_Audio/SFX\n03_Assets\n03_Assets/Fonts\n03_Assets/Graphics\n04_Projekt\n05_Renders\n06_Final',
    autoCreateFolder: true,
    trackingEnabled: true,
    editorApps: 'Resolve.exe\nAdobe Premiere Pro.exe\nAfterFX.exe\nPhotoshop.exe\nIllustrator.exe\nblender.exe\nCapCut.exe',
    idleMinutes: 4,
    awayGraceMinutes: 3,
    ignoredNames: [],
    closeAction: 'tray',
    spotlightHotkey: 'Control+Shift+Space',
    theme: 'clean',
    appearance: 'auto',
    accent: '#ff9f0a',
    soundVolume: 0.7,
    kitPersona: 'kamos',
    kitPersonaCustom: '',
    kitPersonaExtra: '',
    kit: { fur: '#ff9f5a', cream: '#fff1e4', inner: '#3b2f55', eyes: '#231c36', hat: '', glasses: '', neck: '', extra: '' },
    templateFolders: {},
    aePath: '',
    clients: {},
    motion: 'full',
    compact: false,
    showKit: true,
    zoom: 1,
    archiveAfterDays: 7,
    aiKeepAlive: 2,
    renderExtensions: 'mp4 mov mkv webm gif avi mxf',
    extraWatchFolders: '',
    renderAutoReview: false,
    notifyDeadlines: true,
    notifyRenders: true,
    remoteEnabled: false,
    remotePort: 4747,
    remoteToken: '',
    ollamaEnabled: false,
    ollamaModel: 'gemma4:12b-it-qat',
    ollamaAutoStart: true,
    ollamaPath: '',
    aiThink: false,
    defaultContact: 'Discord DM',
    contactTypes: CONTACTS.slice(),
    defaultType: 'Edit',
    projectTypes: TYPES.slice(),
    defaultStatus: 'todo',
    timelineRange: 'month',
    hourlyGoal: 15,
    sounds: true,
    startMinimized: false,
    launchAtLogin: false,
    newProjectMode: 'auto',
    autoStatus: true,
    language: '',
    currency: 'EUR'
  };

  /* predvolené priečinky podľa jazyka (anglický používateľ nechce „04_Projekt“) */
  const LANG_DEFAULTS = {
    sk: { folderPattern: DEFAULT_SETTINGS.folderPattern, folderTemplate: DEFAULT_SETTINGS.folderTemplate },
    en: { folderPattern: '{year}-{month}_{client}_{title}', folderTemplate: DEFAULT_SETTINGS.folderTemplate.replace('04_Projekt', '04_Project') }
  };
  function defaultsFor(lang) { return Object.assign({}, LANG_DEFAULTS[lang === 'en' ? 'en' : 'sk']); }
  /* zmena jazyka: nedotknuté predvolené priečinky sa prepnú tiež (len kým nie sú žiadne zákazky) */
  function languageDefaultsPatch(st, from, to, hasProjects) {
    if (hasProjects || from === to) return {};
    const a = defaultsFor(from), b = defaultsFor(to), out = {};
    for (const k of ['folderPattern', 'folderTemplate']) if (!st[k] || st[k] === a[k]) out[k] = b[k];
    return out;
  }

  /* zoznamy, ktoré si používateľ môže upraviť v nastaveniach */
  function contactTypes(st) {
    const l = st && Array.isArray(st.contactTypes) ? st.contactTypes.map(String).map(x => x.trim()).filter(Boolean) : [];
    return l.length ? l : CONTACTS.slice();
  }
  function projectTypes(st) {
    const l = st && Array.isArray(st.projectTypes) ? st.projectTypes.map(String).map(x => x.trim()).filter(Boolean) : [];
    return l.length ? l : TYPES.slice();
  }

  /* čo vieme o klientovi z minulých zákaziek (kontakt, typ, posledná zákazka) */
  function clientDefaults(state, client) {
    const n = normalize(client);
    if (!n) return null;
    const list = (state.projects || []).filter(p => normalize(p.client) === n).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!list.length) return null;
    const count = {};
    for (const p of list) count[p.type] = (count[p.type] || 0) + 1;
    const type = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    return { name: list[0].client, contact: list[0].contact, type, last: list[0], count: list.length };
  }
  /* klienti zoradení podľa toho, ako nedávno a často s nimi robíš */
  function recentClients(state, limit) {
    const map = new Map();
    for (const p of state.projects || []) {
      const k = normalize(p.client); if (!k) continue;
      const m = map.get(k) || { name: p.client, n: 0, last: '' };
      m.n++; if (String(p.createdAt) > m.last) { m.last = String(p.createdAt); m.name = p.client; }
      map.set(k, m);
    }
    return Array.from(map.values()).sort((a, b) => b.last.localeCompare(a.last) || b.n - a.n).slice(0, limit || 50).map(x => x.name);
  }

  /* odhad, ako ďaleko je zákazka (postup, inak podľa stavu) */
  const STATUS_PROGRESS = { todo: 0, working: 0.4, review: 0.75, revisions: 0.85, done: 1 };
  function projectProgress(p) {
    if (p.status === 'done') return 1;
    const cl = p.checklist || [];
    if (cl.length) return cl.filter(c => c.done).length / cl.length;
    return STATUS_PROGRESS[p.status] || 0;
  }

  /* nápady a storyboardy */
  const SHOTS = ['Detail', 'Polodetail', 'Polocelok', 'Celok', 'Total', 'Cez rameno', 'POV', 'Z vtáčej perspektívy', 'Gameplay', 'Screen / UI', 'Text / grafika'];
  const MOVES = ['Statický', 'Pan', 'Tilt', 'Zoom in', 'Zoom out', 'Dolly / jazda', 'Z ruky', 'Speed ramp', 'Prechod'];
  function newIdea(fields) {
    const now = new Date().toISOString();
    return Object.assign({ id: uid(), title: '', html: '', text: '', color: '', tags: [], projectId: '', pinned: false, aspect: '16:9', frames: [], cover: '', createdAt: now, updatedAt: now }, fields || {});
  }
  function newFrame(fields) {
    return Object.assign({ id: uid(), image: '', caption: '', shot: '', move: '', duration: 3, audio: '' }, fields || {});
  }
  function storyboardSeconds(idea) {
    return (idea.frames || []).reduce((a, f) => a + (Number(f.duration) || 0), 0);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalize(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function emptyState() {
    return {
      version: 1,
      projects: [],
      sessions: [],
      settings: Object.assign({}, DEFAULT_SETTINGS),
      focusProjectId: null,
      notified: {},
      ideas: [],
      seenOnboarding: false,
      createdAt: new Date().toISOString()
    };
  }

  function newProject(fields) {
    const now = new Date().toISOString();
    return Object.assign({
      id: uid(),
      title: '',
      client: '',
      contact: 'Discord DM',
      type: 'Edit',
      status: 'todo',
      priority: '',
      deadline: '',
      reward: 0,
      payments: [],
      notes: '',
      folder: '',
      renders: [],
      checklist: [],
      history: [],
      createdAt: now,
      updatedAt: now,
      doneAt: null
    }, fields || {});
  }

  /* ---------- čas ---------- */
  function sessionMs(s, now) {
    const end = s.end ? Date.parse(s.end) : (now || Date.now());
    return Math.max(0, end - Date.parse(s.start));
  }

  function projectMs(state, id, now) {
    let t = 0;
    for (const s of state.sessions) if (s.projectId === id) t += sessionMs(s, now);
    return t;
  }

  function startOfDay(d) {
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
  }

  function startOfWeek(d) {
    const x = startOfDay(d);
    const wd = (x.getDay() + 6) % 7; // pondelok = 0
    x.setDate(x.getDate() - wd);
    return x;
  }

  /* čas v intervale [from, to) – sessions sa orežú */
  function msBetween(state, from, to, filter) {
    let t = 0;
    const now = Date.now();
    for (const s of state.sessions) {
      if (filter && !filter(s)) continue;
      const a = Date.parse(s.start);
      const b = s.end ? Date.parse(s.end) : now;
      const lo = Math.max(a, +from), hi = Math.min(b, +to);
      if (hi > lo) t += hi - lo;
    }
    return t;
  }

  function dayKey(d) {
    const x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }

  function streak(state, now) {
    now = now || Date.now();
    const days = new Set();
    for (const s of state.sessions) {
      if (sessionMs(s, now) >= 10 * 60000) days.add(dayKey(Date.parse(s.start)));
    }
    for (const p of state.projects) if (p.doneAt) days.add(dayKey(Date.parse(p.doneAt)));
    let n = 0;
    const d = startOfDay(now);
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // dnešok sa ešte môže pridať
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- XP a levely ---------- */
  function xpOf(state, now) {
    let ms = 0;
    for (const s of state.sessions) if (s.projectId) ms += sessionMs(s, now);
    let xp = Math.floor(ms / 3600000 * 10);
    for (const p of state.projects) {
      if (p.status === 'done') {
        xp += 50;
        if (p.deadline && p.doneAt && dayKey(Date.parse(p.doneAt)) <= p.deadline) xp += 25;
      }
      xp += (p.renders || []).length * 5;
    }
    return xp;
  }

  function levelOf(xp) {
    let lvl = 1, need = 100, base = 0;
    while (xp >= base + need) { base += need; lvl++; need = 100 + 50 * (lvl - 1); }
    return { level: lvl, into: xp - base, need, pct: (xp - base) / need };
  }

  const LEVEL_TITLES = ['Nováčik', 'Strihač', 'Keyframer', 'Color nerd', 'Motion mág', 'Render lord', 'Timeline legenda', '{brand} boss'];
  function levelTitle(lvl, brand) {
    const x = LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((lvl - 1) / 2))];
    if (x === '{brand} boss') return String(brand || '').trim() ? t('{brand} boss', { brand: String(brand).trim() }) : t('Šéf štúdia');
    return t(x);
  }

  /* ---------- deadliny ---------- */
  function plural(n, one, few, many) {
    return I().plural(n, one, few, many);
  }

  function deadlineInfo(p, now) {
    if (!p.deadline) return { level: 'none', label: t('Bez deadlinu'), days: null };
    if (p.status === 'done') return { level: 'done', label: formatDate(p.deadline), days: null };
    const today = startOfDay(now || Date.now());
    const dl = new Date(p.deadline + 'T00:00:00');
    const days = Math.round((dl - today) / DAY);
    let label, level;
    if (days < 0) { label = t('po termíne {n} {d}', { n: -days, d: plural(-days, 'deň', 'dni', 'dní') }); level = 'overdue'; }
    else if (days === 0) { label = t('dnes'); level = 'today'; }
    else if (days === 1) { label = t('zajtra'); level = 'soon'; }
    else { label = t('o {n} {d}', { n: days, d: plural(days, 'deň', 'dni', 'dní') }); level = days <= 3 ? 'soon' : 'ok'; }
    return { level, label, days };
  }

  /* ---------- peniaze ---------- */
  function paidOf(p) {
    return (p.payments || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
  }
  function owedOf(p) {
    return Math.max(0, (Number(p.reward) || 0) - paidOf(p));
  }
  function moneyStats(state, now) {
    const d = new Date(now || Date.now());
    const y = d.getFullYear(), m = d.getMonth();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const md = new Date(y, m - i, 1);
      months.push({ key: md.getFullYear() + '-' + md.getMonth(), date: md, amount: 0 });
    }
    let thisMonth = 0, total = 0, owed = 0, owedCount = 0, pipeline = 0, pipelineCount = 0;
    for (const p of state.projects) {
      for (const pay of p.payments || []) {
        const pd = new Date(pay.at);
        const key = pd.getFullYear() + '-' + pd.getMonth();
        const slot = months.find(x => x.key === key);
        if (slot) slot.amount += Number(pay.amount) || 0;
        if (pd.getFullYear() === y && pd.getMonth() === m) thisMonth += Number(pay.amount) || 0;
        total += Number(pay.amount) || 0;
      }
      const o = owedOf(p);
      if (o > 0 && p.status === 'done') { owed += o; owedCount++; }
      else if (o > 0) { pipeline += o; pipelineCount++; }
    }
    // €/hod iba z projektov, kde je aj čas aj platba
    let rateMoney = 0, rateMs = 0;
    for (const p of state.projects) {
      const ms = projectMs(state, p.id, now);
      const paid = paidOf(p);
      if (ms > 15 * 60000 && paid > 0) { rateMoney += paid; rateMs += ms; }
    }
    const hourly = rateMs ? rateMoney / (rateMs / 3600000) : null;
    return { thisMonth, total, owed, owedCount, pipeline, pipelineCount, months, hourly };
  }

  /* ---------- párovanie okna s projektom ---------- */
  function matchProjectByTitle(state, title) {
    const t = normalize(title);
    if (!t) return null;
    let best = null, bestLen = 0;
    const recent = Date.now() - 21 * DAY;
    for (const p of state.projects) {
      if (p.status === 'done' && (!p.doneAt || Date.parse(p.doneAt) < recent)) continue;
      const keys = [p.title].concat(p.aliases || []);
      if (p.folder) keys.push(p.folder.split(/[\\/]/).filter(Boolean).pop());
      for (const k of keys) {
        const n = normalize(k);
        if (n.length >= 3 && t.includes(n) && n.length > bestLen) { best = p; bestLen = n.length; }
      }
    }
    return best;
  }

  /* ---------- priečinky ---------- */
  function sanitizeName(s) {
    return String(s || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  }
  function folderNameFrom(pattern, p, date) {
    const d = new Date(date || Date.now());
    const map = {
      rok: String(d.getFullYear()),
      mesiac: String(d.getMonth() + 1).padStart(2, '0'),
      den: String(d.getDate()).padStart(2, '0'),
      klient: sanitizeName(p.client) || t('Klient'),
      nazov: sanitizeName(p.title) || t('Projekt'),
      typ: sanitizeName(p.type) || ''
    };
    // anglické názvy tých istých polí
    Object.assign(map, { year: map.rok, month: map.mesiac, day: map.den, client: map.klient, title: map.nazov, type: map.typ });
    const out = String(pattern || DEFAULT_SETTINGS.folderPattern).replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
    return sanitizeName(out.replace(/_+/g, '_').replace(/^_|_$/g, '')) || t('Projekt');
  }

  /* ---------- formátovanie ---------- */
  function formatDuration(ms, short) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (short) return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm';
    if (!h) return m + ' min';
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function timecode(ms, fps) {
    fps = fps || 25;
    const totalFrames = Math.floor(ms / 1000 * fps);
    const f = totalFrames % fps;
    const s = Math.floor(totalFrames / fps);
    const p = n => String(n).padStart(2, '0');
    return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60) + ':' + p(f);
  }
  function formatMoney(n) {
    const v = Number(n) || 0, i = I(), cur = i.currency || 'EUR';
    const digits = { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 };
    if (i.lang === 'sk' && cur === 'EUR') return v.toLocaleString('sk-SK', digits) + ' €';
    try { return new Intl.NumberFormat(i.locale(), Object.assign({ style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }, digits)).format(v); }
    catch (e) { return v.toLocaleString(i.locale(), digits) + ' ' + cur; }
  }
  /* „€/hod“ podľa meny a jazyka */
  function perHour() { const i = I(); return (i.currencySymbol ? i.currencySymbol() : '€') + '/' + t('hod'); }
  const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function monthShort(m) { return I().lang === 'sk' ? MONTHS_SHORT[m] : new Date(2026, m, 1).toLocaleDateString(I().locale(), { month: 'short' }); }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return '';
    const other = d.getFullYear() !== new Date().getFullYear();
    if (I().lang !== 'sk') return d.toLocaleDateString(I().locale(), Object.assign({ day: 'numeric', month: 'short' }, other ? { year: 'numeric' } : {}));
    return d.getDate() + '. ' + MONTHS_SHORT[d.getMonth()] + (other ? ' ' + d.getFullYear() : '');
  }
  function toISODate(d) { return dayKey(d); }

  /* ---------- stav ---------- */
  function setStatus(p, status, now) {
    if (!STATUS_IDS.includes(status) || p.status === status) return false;
    const at = new Date(now || Date.now()).toISOString();
    p.history = (p.history || []).concat([{ at, from: p.status, to: status }]);
    p.status = status;
    if (status === 'revisions') p.revisions = (p.revisions || 0) + 1;
    if (p.archived === true && status !== 'done') delete p.archived; // pohnutá zákazka sa vráti na nástenku
    p.doneAt = status === 'done' ? at : null;
    p.updatedAt = at;
    return true;
  }


  /* ---------- archív ---------- */
  function isArchived(p, settings, now) {
    if (p.archived === true) return true;
    if (p.archived === false) return false;
    if (p.status !== 'done') return false;
    const days = Number(settings && settings.archiveAfterDays);
    const cutoff = (now || Date.now()) - (isNaN(days) ? 7 : days) * DAY;
    return !p.doneAt || Date.parse(p.doneAt) < cutoff;
  }

  /* aktívna = nie je hotová a nie je v archíve (aj ručne archivovaná zákazka „Na rade“ už aktívna nie je) */
  function isActive(p, settings, now) { return !!p && p.status !== 'done' && !isArchived(p, settings, now); }

  function median(arr) {
    if (!arr.length) return null;
    const a = arr.slice().sort((x, y) => x - y), m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ---------- cenový tip z vlastnej histórie ---------- */
  function priceTip(state, type, excludeId) {
    const goal = Number(state.settings.hourlyGoal) || 0;
    const same = state.projects.filter(p => p.id !== excludeId && p.type === type && Number(p.reward) > 0);
    if (!same.length) return null;
    const timed = same.filter(p => p.status === 'done' && projectMs(state, p.id) > 15 * 60000);
    const medReward = median(same.map(p => Number(p.reward)));
    const medHours = timed.length ? median(timed.map(p => projectMs(state, p.id) / 3600000)) : null;
    const byTime = medHours && goal ? Math.ceil(goal * medHours) : null;
    const suggest = Math.max(medReward || 0, byTime || 0);
    return { count: same.length, timedCount: timed.length, medReward, medHours, byTime, suggest, goal };
  }

  /* ---------- klienti ---------- */
  function clientKey(name) { return normalize(name) || '_bez_mena'; }
  function clientStats(state) {
    const map = new Map();
    for (const p of state.projects) {
      if (!p.client) continue;
      const k = clientKey(p.client);
      if (!map.has(k)) map.set(k, { key: k, name: p.client, projects: [], paid: 0, owed: 0, pipeline: 0, ms: 0, payDays: [], revisions: [], types: {}, contacts: new Set(), first: null, last: null });
      const c = map.get(k);
      c.projects.push(p);
      c.paid += paidOf(p);
      if (p.status === 'done') c.owed += owedOf(p); else c.pipeline += owedOf(p);
      c.ms += projectMs(state, p.id);
      if (p.contact) c.contacts.add(p.contact);
      c.types[p.type] = (c.types[p.type] || 0) + 1;
      if (p.status === 'done' || p.revisions) c.revisions.push(p.revisions || 0);
      if (p.doneAt && (p.payments || []).length) {
        const lastPay = Math.max.apply(null, p.payments.map(x => Date.parse(x.at)));
        c.payDays.push(Math.max(0, (lastPay - Date.parse(p.doneAt)) / DAY));
      }
      const t = Date.parse(p.createdAt);
      if (!c.first || t < c.first) c.first = t;
      if (!c.last || t > c.last) { c.last = t; c.name = p.client; }
    }
    return Array.from(map.values()).map(c => Object.assign(c, {
      count: c.projects.length,
      done: c.projects.filter(p => p.status === 'done').length,
      hourly: c.ms > 15 * 60000 && c.paid ? c.paid / (c.ms / 3600000) : null,
      avgPayDays: c.payDays.length ? c.payDays.reduce((a, b) => a + b, 0) / c.payDays.length : null,
      avgRevisions: c.revisions.length ? c.revisions.reduce((a, b) => a + b, 0) / c.revisions.length : null,
      contacts: Array.from(c.contacts),
      meta: (state.clients || {})[c.key] || {}
    })).sort((a, b) => (b.paid + b.pipeline) - (a.paid + a.pipeline) || b.count - a.count);
  }

  /* ---------- odznaky ---------- */
  function hourOfSessions(state, test) {
    return state.sessions.some(s => { const h = new Date(s.start).getHours(); return test(h) && sessionMs(s) > 10 * 60000; });
  }
  const ACHIEVEMENTS = [
    { id: 'first', icon: '✨', get title() { return t('Prvá iskra'); }, get desc() { return t('Pridaj prvú zákazku.'); }, test: s => s.projects.length >= 1 },
    { id: 'firstDone', icon: '🎬', get title() { return t('Odovzdané'); }, get desc() { return t('Dokonči prvú zákazku.'); }, test: s => s.projects.some(p => p.status === 'done') },
    { id: 'ontime5', icon: '🎯', get title() { return t('Presný ako metronóm'); }, get desc() { return t('5 zákaziek odovzdaných načas.'); }, test: s => s.projects.filter(p => p.status === 'done' && p.deadline && p.doneAt && dayKey(Date.parse(p.doneAt)) <= p.deadline).length >= 5 },
    { id: 'speedrun', icon: '⚡', get title() { return t('Speedrun'); }, get desc() { return t('Zákazka hotová do 24 hodín od pridania.'); }, test: s => s.projects.some(p => p.doneAt && Date.parse(p.doneAt) - Date.parse(p.createdAt) < DAY) },
    { id: 'h10', icon: '⏱️', get title() { return t('10 hodín v strižni'); }, get desc() { return t('Odmeraj 10 hodín práce.'); }, test: (s, c) => c.hours >= 10 },
    { id: 'h50', icon: '🕯️', get title() { return t('Päťdesiatka'); }, get desc() { return t('Odmeraj 50 hodín práce.'); }, test: (s, c) => c.hours >= 50 },
    { id: 'h100', icon: '🌙', get title() { return t('Storočnica'); }, get desc() { return t('Odmeraj 100 hodín práce.'); }, test: (s, c) => c.hours >= 100 },
    { id: 'owl', icon: '🦉', get title() { return t('Nočná sova'); }, get desc() { return t('Strihaj medzi 1:00 a 4:00 ráno.'); }, test: s => hourOfSessions(s, h => h >= 1 && h < 4) },
    { id: 'lark', icon: '🌅', get title() { return t('Ranné vtáča'); }, get desc() { return t('Začni pracovať pred 7:00.'); }, test: s => hourOfSessions(s, h => h >= 4 && h < 7) },
    { id: 'streak7', icon: '🔥', get title() { return t('Týždeň v kuse'); }, get desc() { return t('7 dní po sebe aspoň 10 minút práce.'); }, test: (s, c) => c.bestStreak >= 7 },
    { id: 'renders10', icon: '🎞️', get title() { return t('Render farma'); }, get desc() { return t('10 renderov zachytených appkou.'); }, test: s => s.projects.reduce((a, p) => a + (p.renders || []).length, 0) >= 10 },
    { id: 'm100', icon: '💶', get title() { return t('Prvá stovka'); }, get desc() { return t('Zarob {m}.', { m: formatMoney(100) }); }, test: (s, c) => c.paid >= 100 },
    { id: 'm500', icon: '💎', get title() { return t('Päťstovka'); }, get desc() { return t('Zarob {m}.', { m: formatMoney(500) }); }, test: (s, c) => c.paid >= 500 },
    { id: 'm1000', icon: '👑', get title() { return t('Tisícka'); }, get desc() { return t('Zarob {m}.', { m: formatMoney(1000) }); }, test: (s, c) => c.paid >= 1000 },
    { id: 'clients5', icon: '🤝', get title() { return t('Sieť kontaktov'); }, get desc() { return t('Pracuj pre 5 rôznych klientov.'); }, test: s => new Set(s.projects.map(p => normalize(p.client)).filter(Boolean)).size >= 5 },
    { id: 'clean', icon: '🧾', get title() { return t('Čistý účet'); }, get desc() { return t('Aspoň 3 hotové zákazky a nikto ti nedlhuje.'); }, test: s => s.projects.filter(p => p.status === 'done').length >= 3 && !s.projects.some(p => p.status === 'done' && owedOf(p) > 0) },
    { id: 'worth', icon: '📈', get title() { return t('Zaslúžená hodinovka'); }, get desc() { return t('Zákazka s {ph} nad tvojím cieľom.', { ph: perHour() }); }, test: s => s.projects.some(p => { const ms = projectMs(s, p.id); return ms > 30 * 60000 && paidOf(p) / (ms / 3600000) >= (Number(s.settings.hourlyGoal) || 15); }) },
    { id: 'allround', icon: '🎨', get title() { return t('Všestranný'); }, get desc() { return t('Dokonči 4 rôzne typy zákaziek.'); }, test: s => new Set(s.projects.filter(p => p.status === 'done').map(p => p.type)).size >= 4 },
    { id: 'boop', icon: '🦊', get title() { return t('Profesionálny booper'); }, get desc() { return t('Boopni maskota 25-krát.'); }, test: s => ((s.stats || {}).boops || 0) >= 25 },
    { id: 'archivist', icon: '📚', get title() { return t('Archivár'); }, get desc() { return t('20 zákaziek v archíve.'); }, test: s => s.projects.filter(p => isArchived(p, s.settings)).length >= 20 }
  ];
  function bestStreak(state) {
    const days = new Set();
    for (const s of state.sessions) if (sessionMs(s) >= 10 * 60000) days.add(dayKey(Date.parse(s.start)));
    const sorted = Array.from(days).sort();
    let best = 0, cur = 0, prev = null;
    for (const d of sorted) {
      const t = Date.parse(d + 'T12:00:00');
      cur = prev && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1;
      best = Math.max(best, cur); prev = t;
    }
    return best;
  }
  function achievementsState(state) {
    let ms = 0, paid = 0;
    for (const s of state.sessions) if (s.projectId) ms += sessionMs(s);
    for (const p of state.projects) paid += paidOf(p);
    const ctx = { hours: ms / 3600000, paid, bestStreak: bestStreak(state) };
    return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: a.title, desc: a.desc, ok: !!a.test(state, ctx), at: (state.achievements || {})[a.id] || null }));
  }

  /* ---------- mesačný recap ---------- */
  function recapData(state, year, month) {
    const from = new Date(year, month, 1), to = new Date(year, month + 1, 1);
    const inMonth = t => t >= +from && t < +to;
    const sessions = state.sessions.filter(s => inMonth(Date.parse(s.start)));
    const ms = sessions.reduce((a, s) => a + sessionMs(s), 0);
    const byDay = {}, byWeekday = [0, 0, 0, 0, 0, 0, 0], byApp = {}, byProject = {};
    let latest = null, longest = null;
    for (const s of sessions) {
      const d = new Date(s.start), m = sessionMs(s);
      byDay[dayKey(d)] = (byDay[dayKey(d)] || 0) + m;
      byWeekday[(d.getDay() + 6) % 7] += m;
      byApp[s.app] = (byApp[s.app] || 0) + m;
      if (s.projectId) byProject[s.projectId] = (byProject[s.projectId] || 0) + m;
      const endH = new Date(s.end || Date.now());
      const lateScore = (endH.getHours() + 19) % 24 * 60 + endH.getMinutes(); // 5:00 = 0, 4:59 = max
      if (m > 10 * 60000 && (!latest || lateScore > latest.score)) latest = { score: lateScore, at: endH };
      if (!longest || m > longest.ms) longest = { ms: m, projectId: s.projectId, app: s.app };
    }
    const done = state.projects.filter(p => p.doneAt && inMonth(Date.parse(p.doneAt)));
    const onTime = done.filter(p => p.deadline && dayKey(Date.parse(p.doneAt)) <= p.deadline).length;
    const withDl = done.filter(p => p.deadline).length;
    const fresh = state.projects.filter(p => inMonth(Date.parse(p.createdAt)));
    let paid = 0; const byClient = {};
    for (const p of state.projects) for (const pay of p.payments || []) {
      if (inMonth(Date.parse(pay.at))) { paid += Number(pay.amount) || 0; if (p.client) byClient[p.client] = (byClient[p.client] || 0) + (Number(pay.amount) || 0); }
    }
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || null;
    const bestDay = top(byDay);
    const WD = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa'].map(x => t(x));
    const wdIdx = byWeekday.indexOf(Math.max.apply(null, byWeekday));
    const topProj = top(byProject);
    const badges = Object.entries(state.achievements || {}).filter(([id, at]) => inMonth(Date.parse(at))).map(([id]) => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
    return {
      year, month, ms, days: Object.keys(byDay).length, sessions: sessions.length,
      bestDay: bestDay ? { date: bestDay[0], ms: bestDay[1] } : null,
      bestWeekday: ms ? WD[wdIdx] : null, bestWeekdayIdx: ms ? wdIdx : null,
      apps: Object.entries(byApp).sort((a, b) => b[1] - a[1]),
      topProject: topProj ? { project: state.projects.find(p => p.id === topProj[0]), ms: topProj[1] } : null,
      longest, latest: latest ? latest.at : null,
      done: done.length, onTime, withDl, fresh: fresh.length,
      fastest: done.map(p => ({ p, d: Date.parse(p.doneAt) - Date.parse(p.createdAt) })).sort((a, b) => a.d - b.d)[0] || null,
      paid, topClient: top(byClient), hourly: ms > 30 * 60000 && paid ? paid / (ms / 3600000) : null,
      badges
    };
  }

  /* jednoduché skloňovanie mena maskota: Kit → Kita / Kitovi / Kitom */
  function decl(name, c) {
    name = String(name || 'Kit');
    if (I().lang !== 'sk') return name;
    const suf = { gen: 'a', dat: 'ovi', ins: 'om' }[c] || '';
    if (!suf || !/[a-zA-Zá-žÁ-Ž]$/.test(name)) return name;          // Nick_, xX, 2k…
    if (/[^o]o$/i.test(name) && name.length > 2) return name.slice(0, -1) + suf; // Marko → Markovi
    if (/[aeiouyáéíóúý]$/i.test(name)) return name;
    if (/[A-Z]{2,}$/.test(name)) return name;                          // skratky: AE, GFX
    return name + suf;
  }

  return {
    DAY, STATUSES, EDITORS, editorName, editorNames, contactTypes, projectTypes, clientDefaults, recentClients, projectProgress, SHOTS, MOVES, newIdea, newFrame, storyboardSeconds, decl, isArchived, isActive, median, priceTip, clientKey, clientStats, ACHIEVEMENTS, achievementsState, bestStreak, recapData, STATUS_IDS, TYPES, CONTACTS, PRIORITIES, DEFAULT_SETTINGS, defaultsFor, languageDefaultsPatch,
    uid, normalize, emptyState, newProject,
    sessionMs, projectMs, msBetween, startOfDay, startOfWeek, dayKey, streak,
    xpOf, levelOf, levelTitle, plural, deadlineInfo,
    paidOf, owedOf, moneyStats, matchProjectByTitle,
    sanitizeName, folderNameFrom,
    formatDuration, timecode, formatMoney, formatDate, toISODate, MONTHS_SHORT, monthShort, perHour,
    setStatus
  };
});
