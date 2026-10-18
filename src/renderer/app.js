/* WorkingOnIt — rozhranie */
(async function () {
  const L = window.WOI;
  const api = window.api;
  const t = I18N.t, tp = I18N.tp;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = html => { const tpl = document.createElement('template'); tpl.innerHTML = html.trim(); return tpl.content.firstElementChild; };
  const statusOf = id => L.STATUSES.find(s => s.id === id) || L.STATUSES[0];
  const sColor = id => `var(--s-${id})`;
  const withCur = (list, v) => v && !list.includes(v) ? list.concat([v]) : list;
  /* predvolené hodnoty zoznamov (Iné, Osobne, zábery…) sa ukladajú po slovensky, zobrazujú sa preložené */
  const CANON = new Set([].concat(window.WOI.CONTACTS, window.WOI.TYPES, window.WOI.SHOTS, window.WOI.MOVES, ['Časovač', 'Ručne']));
  const tv = v => CANON.has(v) ? I18N.t(v) : v;
  const opts = (list, val) => list.map(o => {
    const v = typeof o === 'string' ? o : o.id, label = typeof o === 'string' ? tv(o) : o.label;
    return `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');

  const ICON = {
    play: '<svg viewBox="0 0 12 12"><path d="M3 1.8v8.4c0 .5.6.8 1 .5l6.3-4.2c.4-.3.4-.8 0-1.1L4 1.3c-.4-.3-1 0-1 .5z"/></svg>',
    stop: '<svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1.6"/></svg>',
    cal: '<svg viewBox="0 0 12 12"><path d="M3 1v1H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H9V1H8v1H4V1zM2 5h8v5H2z"/></svg>',
    clock: '<svg viewBox="0 0 12 12"><path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm.6 2.4v2.4l1.8 1.1-.6 1-2.4-1.5V3.4z"/></svg>',
    film: '<svg viewBox="0 0 12 12"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5v7A1.5 1.5 0 0 1 9.5 11h-7A1.5 1.5 0 0 1 1 9.5zM3 3v1.2h1.2V3zm0 2.4v1.2h1.2V5.4zm0 2.4V9h1.2V7.8zm4.8-4.8v1.2H9V3zm0 2.4v1.2H9V5.4zm0 2.4V9H9V7.8z"/></svg>',
    folder: '<svg viewBox="0 0 20 20"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    close: '<svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    pin: '<svg viewBox="0 0 20 20"><path d="M10 2.5a5 5 0 0 0-5 5c0 3.8 5 10 5 10s5-6.2 5-10a5 5 0 0 0-5-5z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="7.5" r="1.8" fill="currentColor"/></svg>',
    search: '<svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5" stroke-width="1.8"/><path d="M13.2 13.2L17 17" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  const PERSONAS = [
    { id: 'kamos', icon: '🦊', get name() { return t('Kamoš'); }, get desc() { return t('Uvoľnený, vtipný, úprimný'); } },
    { id: 'reziser', icon: '🎬', get name() { return t('Režisér'); }, get desc() { return t('Prísny feedback s časmi'); } },
    { id: 'chill', icon: '🍵', name: 'Chill', get desc() { return t('Pokojný, berie stres'); } },
    { id: 'hype', icon: '⚡', name: 'Hype', get desc() { return t('Energia, gamer slang'); } },
    { id: 'vlastna', icon: '✍️', get name() { return t('Vlastná'); }, get desc() { return t('Napíšeš si ho sám'); } }
  ];

  /* ---------------- stav ---------------- */
  const boot = await api.getState();
  let S = boot.state;
  // jazyk a mena: všetko ďalej sa vykreslí už v nich
  I18N.setLang(S.settings.language, navigator.language);
  I18N.setCurrency(S.settings.currency);
  I18N.apply(document);
  let LIVE = boot.live || { mode: 'off' };
  const PLATFORM = boot.platform;
  const VERSION = boot.version || '';
  let view = 'board';
  let scope = 'active';
  let query = '';
  let openId = null;
  let prevLevel = L.levelOf(L.xpOf(S)).level;
  const localDone = new Map();
  Look.apply(S.settings);
  Polish.start();
  /* šetrenie: keď appka nie je v popredí (strihaš v inom programe) alebo na ňu 2 minúty nesiahneš,
     nekonečné animácie (Kit, pulzujúce bodky) stoja. Procesor a grafika potom nerobia nič. */
  (() => {
    let lastInput = Date.now();
    const update = () => document.body.classList.toggle('bg', document.hidden || !document.hasFocus() || Date.now() - lastInput > 120000);
    const poke = () => { lastInput = Date.now(); if (document.body.classList.contains('bg')) update(); };
    ['pointermove', 'pointerdown', 'keydown', 'wheel'].forEach(e => addEventListener(e, poke, { passive: true, capture: true }));
    addEventListener('focus', update); addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    setInterval(update, 30000);
    update();
  })();
  // testovacia appka (Spustit.bat) má vlastné dáta, nech sa nedá pomýliť s nainštalovanou
  api.action('appInfo').then(i => {
    if (!i || !i.test) return;
    document.body.classList.add('is-test');
    const tb = $('.titlebar'); if (tb) tb.insertAdjacentHTML('afterbegin', `<span class="test-badge" title="${esc(t('Testovacia verzia zo Spustit.bat, má vlastné dáta oddelené od nainštalovanej appky'))}">TEST</span>`);
    document.title = 'WorkingOnIt TEST';
  }).catch(() => { });

  async function act(type, payload) {
    try { return await api.action(type, payload); }
    catch (e) { toast(e.message, { kind: 'error' }); throw e; }
  }
  const project = id => S.projects.find(p => p.id === id);
  const running = () => S.sessions.find(s => !s.end && s.manual);
  const userName = () => String(S.settings.userName || '').trim();

  // chyby v okne zapíšeme do logu (Nastavenia → O appke → Otvoriť logy)
  addEventListener('error', e => { try { api.log('error', (e.message || 'chyba') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno); } catch (x) { } });
  addEventListener('unhandledrejection', e => { try { api.log('warn', 'nezachytené: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); } catch (x) { } });

  /* ---------------- maskot ---------------- */
  Mascot.configure(S.settings.kit);
  Mascot.mount($('#mascot'));
  let tipIndex = 0, moodTimer = null, forcedMood = null;
  /* tipy: príklady berieme z tvojich vlastných zákaziek, nie vymyslené mená */
  function tips() {
    const a = S.projects.find(p => L.isActive(p, S.settings));
    const word = a ? esc(String(a.title).split(/\s+/)[0].toLowerCase()) : t('názov zákazky');
    const apps = L.editorNames(S.settings.editorApps);
    return [
      t('Tip: <b>Ctrl+K</b> otvorí spotlight. Skús napísať „{w} hotovo“.', { w: word }),
      t('Tip: <b>{key}</b> otvorí spotlight odkiaľkoľvek, aj nad strihacím programom.', { key: esc(String(S.settings.spotlightHotkey || '').replace('Control', 'Ctrl')) }),
      t('Tip: klikni na mňa. Len tak. Boop.'),
      t('Tip: pomenuj projekt v {app} rovnako ako tu a čas sa priradí sám.', { app: esc(apps[0] || t('strihacom programe')) }),
      t('Tip: rendery ukladaj do priečinka <b>Renders</b> alebo <b>Final</b> v zákazke, všimnem si ich.'),
      t('Tip: klikni na ▶ na karte a meriam čas aj mimo strihacieho programu.'),
      t('Tip: v <b>Nápadoch</b> si môžeš kresliť náčrty a skladať storyboardy.'),
      t('Tip: v Peniazoch uvidíš svoje reálne {ph} podľa projektov.', { ph: L.perHour() })
    ];
  }
  function mascotLines() {
    const now = Date.now(), lines = [];
    const name = esc(userName());
    const hiName = s => name ? s + ', ' + name : s;
    const active = S.projects.filter(p => L.isActive(p, S.settings));
    const hour = new Date().getHours();
    if (LIVE.mode === 'auto' || LIVE.mode === 'manual') {
      const p = project(LIVE.projectId);
      lines.push({ mood: 'focused', text: p ? t('Meriam ti <b>{title}</b>. Idem s tebou.', { title: esc(p.title) }) : t('Meriam čas, ale neviem pre ktorú zákazku. Klikni na krúžok hore a vyber ju.') });
    }
    if (LIVE.mode === 'away') lines.push({ mood: '', text: t('Odbehol si z {app}. Ak sa vrátiš do {min} min, čas sa započíta. Inak to beriem ako prestávku.', { app: esc(LIVE.app), min: S.settings.awayGraceMinutes }) });
    if (hour >= 23 || hour < 5) lines.push({ mood: 'sleepy', text: t('{hi}. Render to dokončí aj bez teba, choď spať.', { hi: hiName(t('Je {time}', { time: new Date().toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) })) }) });
    for (const p of active) {
      const d = L.deadlineInfo(p, now);
      if (d.level === 'overdue') lines.push({ mood: 'worried', text: t('<b>{title}</b> je {when}. Napíš {client}, kedy to bude, ušetríš si stres.', { title: esc(p.title), when: d.label, client: esc(p.client || t('klientovi')) }) });
      else if (d.level === 'today') lines.push({ mood: 'worried', text: t('Dnes odovzdávaš <b>{title}</b>. Zvládneš to.', { title: esc(p.title) }) });
    }
    const unassigned = S.sessions.filter(s => !s.projectId && s.end).reduce((a, s) => a + L.sessionMs(s), 0);
    if (unassigned > 10 * 60000) lines.push({ mood: '', text: t('Mám <b>{time}</b> času bez projektu. Priraď ho v sekcii Čas.', { time: L.formatDuration(unassigned) }) });
    const owed = S.projects.filter(p => p.status === 'done' && L.owedOf(p) > 0);
    if (owed.length) lines.push({ mood: '', text: t('{client} ti ešte dlhuje <b>{money}</b> za {title}. Pripomenúť sa nie je trápne.', { client: esc(owed[0].client || t('Klient')), money: L.formatMoney(L.owedOf(owed[0])), title: esc(owed[0].title) }) });
    const today = L.msBetween(S, L.startOfDay(now), now + 1);
    if (!lines.length && today === 0 && active.length && hour >= 12) lines.push({ mood: '', text: t('{hi}. Aj 20 minút sa počíta.', { hi: hiName(t('Dnes ešte nič')) }) });
    if (!lines.length && !S.projects.length) lines.push({ mood: '', text: t('{hi}, ja som {name}. Vlož mi správu od klienta a zvyšok vyplním ja.', { hi: hiName(t('Ahoj')), name: esc(S.settings.mascotName || 'Kit') }) });
    return lines;
  }
  /* Kitova otázka s tlačidlami (napr. neznámy projekt v editore) má prednosť pred tipmi */
  let kitPrompt = null;
  function askKit(prompt) {
    kitPrompt = prompt;
    updateMascot();
    cheer(1500);
    FX.sound.pop();
  }
  let bubbleHold = 0; // kým beží boop hláška, tipy ju neprepíšu
  function setBubble(html) {
    const b = $('#bubble');
    if (b.dataset.text === html) return;
    b.dataset.text = html;
    b.classList.remove('swap'); void b.offsetWidth;
    b.innerHTML = html;
    b.classList.add('swap');
    fitBubble();
  }
  /* keď sa Kitov text nezmestí, klikom sa karta rozbalí a ukáže celý (a ďalším klikom zbalí) */
  function fitBubble() {
    const b = $('#bubble');
    b.classList.remove('open');
    requestAnimationFrame(() => b.classList.toggle('clip', b.scrollHeight > b.clientHeight + 2));
  }
  function updateMascot(advance, force) {
    const b = $('#bubble'), acts = $('#bubbleActions');
    if (!kitPrompt && !force && Date.now() < bubbleHold) return;
    if (kitPrompt) {
      setBubble(kitPrompt.text);
      acts.hidden = false;
      acts.innerHTML = '';
      kitPrompt.actions.forEach(a => {
        const btn = el(`<button class="btn small ${a.primary ? 'primary' : 'ghost'}">${esc(a.label)}</button>`);
        btn.onclick = e => { const keep = a.run(e); if (!keep) { kitPrompt = null; updateMascot(); } };
        acts.appendChild(btn);
      });
      return;
    }
    acts.hidden = true;
    const lines = mascotLines();
    let line;
    if (lines.length) line = lines[(advance ? ++tipIndex : tipIndex) % lines.length];
    else { const T = tips(); line = { mood: '', text: T[(advance ? ++tipIndex : tipIndex) % T.length] }; }
    setBubble(line.text);
    if (!forcedMood) Mascot.setMood($('#mascot'), line.mood);
  }
  function cheer(ms) {
    forcedMood = 'happy';
    Mascot.setMood($('#mascot'), 'happy');
    clearTimeout(moodTimer);
    moodTimer = setTimeout(() => { forcedMood = null; if (Date.now() < bubbleHold) Mascot.setMood($('#mascot'), ''); else updateMascot(); }, ms || 2600);
  }
  /* boop! */
  let boopShowT = null;
  $('#mascot').addEventListener('click', e => {
    const svg = $('#mascot .kit');
    svg.classList.remove('boop'); void svg.getBoundingClientRect(); svg.classList.add('boop');
    FX.sound.boop();
    act('boop').catch(() => { });
    const pop = el('<div class="boop-pop">boop!</div>');
    pop.style.left = (e.clientX - 18) + 'px'; pop.style.top = (e.clientY - 26) + 'px';
    document.body.appendChild(pop); setTimeout(() => pop.remove(), 1000);
    if (kitPrompt) { cheer(1400); return; }
    bubbleHold = Date.now() + 6000;
    setBubble(Kit.boopLine(S));
    cheer(1400);
    clearTimeout(boopShowT);
    boopShowT = setTimeout(() => { bubbleHold = 0; updateMascot(false, true); }, 6000);
  });

  function renderLevel() {
    const xp = L.xpOf(S);
    const lv = L.levelOf(xp);
    $('#lvlNum').textContent = 'Lvl ' + lv.level;
    $('#lvlTitle').textContent = L.levelTitle(lv.level, S.settings.brand);
    $('#xpFill').style.width = Math.round(lv.pct * 100) + '%';
    $('#xpText').textContent = lv.into + ' / ' + lv.need + ' XP';
    const st = L.streak(S);
    const inRow = st ? t('{n} {d} v rade', { n: st, d: L.plural(st, 'deň', 'dni', 'dní') }) : '';
    $('#streak').textContent = inRow;
    const foot = $('#sideFoot');
    if (foot) foot.innerHTML = `<b>Level ${lv.level}</b>, ${esc(L.levelTitle(lv.level, S.settings.brand).toLowerCase())}${st ? `<span>${inRow}</span>` : ''}<i style="--p:${Math.round(lv.pct * 100)}%"></i>`;
    if (lv.level > prevLevel) {
      toast(t('<b>Level up!</b> Si Lvl {n}, {title}', { n: lv.level, title: esc(L.levelTitle(lv.level, S.settings.brand)) }), { icon: '⭐' });
      const r = $('#buddy').getBoundingClientRect();
      FX.confetti(r.left + 60, r.top + 40, 120);
      FX.sound.level();
      cheer(3500);
    }
    prevLevel = lv.level;
  }

  /* ---------------- REC lišta ---------------- */
  let tcTimer = null;
  function renderRec() {
    const rec = $('#rec');
    const on = LIVE.mode === 'auto' || LIVE.mode === 'manual';
    rec.classList.toggle('on', on);
    rec.classList.toggle('auto', LIVE.mode === 'auto');
    rec.classList.toggle('idle', LIVE.mode === 'idle');
    rec.classList.toggle('away', LIVE.mode === 'away');
    const p = project(LIVE.projectId);
    const focus = project(S.focusProjectId);
    const todayMs = L.msBetween(S, L.startOfDay(Date.now()), Date.now() + 1);
    let what, app, btn;
    if (LIVE.mode === 'auto') {
      const HOW = { folder: t('podľa priečinka'), name: t('podľa názvu projektu'), similar: t('podľa podobného názvu'), client: t('podľa klienta'), title: t('podľa názvu okna'), focus: t('podľa aktívnej zákazky') };
      if (LIVE.how === 'pending' && LIVE.name) {
        what = LIVE.name;
        app = t('Nový projekt v {app}, o chvíľu ho pridám ako zákazku', { app: LIVE.app });
      } else {
        what = p ? p.title : (LIVE.name || t('Bez zákazky'));
        app = LIVE.app + (p && HOW[LIVE.how] ? ', ' + HOW[LIVE.how] : '');
      }
      btn = 'Zmeniť';
    } else if (LIVE.mode === 'manual') {
      what = p ? p.title : t('Časovač bez projektu');
      app = t('Ručný časovač');
      btn = 'Zastaviť';
    } else if (LIVE.mode === 'away') {
      what = t('Pauza, {what}', { what: p ? p.title : t('mimo programu') });
      const left = Math.max(0, Math.round((Date.parse(LIVE.graceUntil) - Date.now()) / 60000));
      app = t('Mimo {app}, vráť sa do {min} min a čas sa započíta', { app: LIVE.app, min: left || 1 });
      btn = 'Spustiť';
    } else if (LIVE.mode === 'idle') {
      what = t('Pauza, si preč od PC');
      app = LIVE.app ? t('{app}, pokračujem, keď sa vrátiš', { app: LIVE.app }) : t('Pokračujem, keď sa vrátiš');
      btn = 'Spustiť';
    } else {
      what = t('Nič sa nenahráva');
      app = todayMs ? t('Dnes spolu {time}', { time: L.formatDuration(todayMs) }) : (LIVE.mode === 'disabled' ? t('Automatické meranie je vypnuté') : t('Otvor strihací program alebo spusti časovač'));
      btn = 'Spustiť';
    }
    $('#recWhat').textContent = what;
    $('#recApp').textContent = app;
    $('#recBtn').textContent = t(btn);
    // krúžok ako na nahrávačke: bodka = spustiť, štvorček = zastaviť, pulzuje keď sa meria
    const krb = $('#kitRecBtn');
    krb.dataset.state = LIVE.mode || 'off';
    const krbLabel = LIVE.mode === 'manual' ? t('Zastaviť časovač') : LIVE.mode === 'auto' ? t('Zmeniť zákazku') : t('Spustiť časovač');
    krb.title = krbLabel; krb.setAttribute('aria-label', krbLabel);
    $('#kitTime').classList.toggle('on', on);
    // čas pri Kitovi, napísaný ľudsky („47 min na Turnaj highlights“)
    // veľký text v Kitovej karte vždy na jeden riadok: dlhší text sa zmenší, karta tak nemení výšku
    const fitBig = b => {
      b.style.fontSize = '';
      if (!b.clientWidth) return;
      const full = parseFloat(getComputedStyle(b).fontSize);
      if (b.scrollWidth > b.clientWidth + 1) b.style.fontSize = Math.max(13, Math.floor(full * b.clientWidth / b.scrollWidth * 10) / 10) + 'px';
    };
    fitBig($('#ktBig'));
    const human = () => {
      const mins = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? m + ' min' : (Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : '')).trim(); };
      let big, small;
      if (on && LIVE.since) {
        big = mins(Date.now() - Date.parse(LIVE.since));
        if (LIVE.mode === 'manual') small = p ? t('na <em>{title}</em>, ručný časovač', { title: esc(p.title) }) : t('ručný časovač bez zákazky');
        else if (LIVE.how === 'pending' && LIVE.name) small = t('na novom projekte <em>{name}</em> v {app}', { name: esc(LIVE.name), app: esc(LIVE.app) });
        else small = p ? t('na <em>{title}</em> v {app}', { title: esc(p.title), app: esc(LIVE.app) }) : t('v {app}, bez zákazky', { app: esc(LIVE.app) });
      } else if (LIVE.mode === 'away') { big = t('Pauza'); small = t('Vráť sa do {app} a čas pobeží ďalej', { app: esc(LIVE.app) }); }
      else if (LIVE.mode === 'idle') { big = t('Pauza'); small = t('Si preč od PC, počkám'); }
      else { big = todayMs >= 60000 ? mins(todayMs) : t('Dnes nič'); small = todayMs >= 60000 ? t('dnes spolu') : (LIVE.mode === 'disabled' ? t('Meranie je vypnuté') : t('Otvor strihací program, začnem merať')); }
      const b = $('#ktBig'), s2 = $('#ktSmall');
      if (b.textContent !== big) b.textContent = big;
      fitBig(b);
      if (s2.innerHTML !== small) s2.innerHTML = small;
    };
    human();
    clearInterval(renderRec.humanT); renderRec.humanT = setInterval(human, 15000);
    $('#recBtn').title = btn === 'Spustiť' && focus ? t('Spustiť časovač pre {title}', { title: focus.title }) : '';
    clearInterval(tcTimer);
    const tc = $('#recTc');
    tc.classList.toggle('away-tc', LIVE.mode === 'away');
    const draw = () => {
      if (LIVE.mode === 'away' && LIVE.since) tc.textContent = L.timecode(Date.parse(LIVE.awaySince) - Date.parse(LIVE.since));
      else tc.textContent = on && LIVE.since ? L.timecode(Date.now() - Date.parse(LIVE.since)) : L.timecode(todayMs);
      if (LIVE.mode === 'away') $('#recApp').textContent = t('Mimo {app}, vráť sa do {min} min a čas sa započíta', { app: LIVE.app, min: Math.max(1, Math.ceil((Date.parse(LIVE.graceUntil) - Date.now()) / 60000)) });
    };
    draw();
    if (on) tcTimer = setInterval(draw, 40);
    else if (LIVE.mode === 'away') tcTimer = setInterval(draw, 5000);
  }
  $('#kitRecBtn').addEventListener('click', e => recMenu(e));
  $('#sideFoot').addEventListener('click', () => go('profile'));
  $('#bubble').addEventListener('click', () => { const b = $('#bubble'); if (b.classList.contains('clip') || b.classList.contains('open')) { b.classList.toggle('open'); b.classList.toggle('clip', !b.classList.contains('open')); } });
  $('#recBtn').addEventListener('click', e => recMenu(e));
  function recMenu(e) {
    if (LIVE.mode === 'manual') { act('stopTimer'); FX.sound.rec(); return; }
    const auto = LIVE.mode === 'auto';
    const items = S.projects.filter(p => L.isActive(p, S.settings) || p.id === LIVE.projectId).map(p => ({
      label: p.title, sub: p.client, color: sColor(p.status), on: auto ? p.id === LIVE.projectId : p.id === S.focusProjectId,
      run: () => {
        if (!auto) { FX.sound.rec(); return act('startTimer', { id: p.id }); }
        act('retarget', { id: p.id }).then(() => { if (LIVE.name) toast(t('Odteraz viem, že „{name}“ patrí k <b>{title}</b>.', { name: esc(LIVE.name), title: esc(p.title) })); });
      }
    }));
    if (auto && LIVE.name && LIVE.how === 'pending') {
      items.unshift({ label: t('Pridať „{name}“ ako zákazku', { name: LIVE.name }), sub: t('hneď, nečakať'), run: () => act('addFromEditorNow').then(id => { if (id) openDrawer(id); }) });
      items.push({ label: t('Nie je to zákazka'), sub: t('nemerať ho k ničomu'), run: () => act('ignoreName', { name: LIVE.name }) });
    }
    if (!auto) items.push({ label: t('Bez zákazky'), sub: t('priradíš neskôr'), run: () => act('startTimer', { id: null }) });
    if (!items.length) return act('startTimer', { id: null });
    menu(e.currentTarget, items, auto ? t('Na čom práve robíš?') : t('Spustiť časovač pre'));
  }

  /* jednoduché vyskakovacie menu */
  function menu(anchor, items, title) {
    closeMenu();
    const r = anchor.getBoundingClientRect();
    const m = el(`<div class="menu" style="position:fixed;z-index:35;top:${r.bottom + 6}px;right:${innerWidth - r.right}px;background:var(--raise);border:1px solid var(--line);border-radius:14px;padding:6px;min-width:240px;max-height:360px;overflow:auto;box-shadow:0 18px 40px var(--shadow);transform-origin:100% 0">
      ${title ? `<div style="padding:6px 10px 8px;color:var(--muted);font-size:12px">${esc(title)}</div>` : ''}
    </div>`);
    items.forEach(it => {
      const b = el(`<button style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:${it.on ? 'var(--raise2)' : 'none'};padding:8px 10px;border-radius:9px;text-align:left">
        <i style="width:8px;height:8px;border-radius:3px;background:${it.color || 'var(--faint)'};flex:none"></i>
        <span style="flex:1;min-width:0"><b style="font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.label)}</b>${it.sub ? `<small style="color:var(--muted)">${esc(it.sub)}</small>` : ''}</span></button>`);
      b.onmouseenter = () => b.style.background = 'var(--raise2)';
      b.onmouseleave = () => b.style.background = it.on ? 'var(--raise2)' : 'none';
      b.onclick = () => { closeMenu(); it.run(); };
      m.appendChild(b);
    });
    document.body.appendChild(m);
    // menu musí ostať celé v okne: pri tlačidle vľavo sa otvorí doprava, pri spodnom okraji nahor
    const mw = m.offsetWidth, mh = m.offsetHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 < innerWidth / 2 ? r.left : r.right - mw, innerWidth - mw - 8));
    const top = innerHeight - r.bottom - 14 >= mh ? r.bottom + 6 : Math.max(8, r.top - mh - 6);
    m.style.right = 'auto'; m.style.left = left + 'px'; m.style.top = top + 'px';
    m.style.transformOrigin = `${Math.round(r.left + r.width / 2 - left)}px ${top > r.top ? 0 : mh}px`;
    setTimeout(() => document.addEventListener('pointerdown', closeMenuOutside), 0);
  }
  function closeMenuOutside(e) { if (!e.target.closest('.menu:not(.out)')) closeMenu(); }
  function closeMenu() {
    $$('.menu:not(.out)').forEach(m => { m.classList.add('out'); setTimeout(() => m.remove(), 140); });
    document.removeEventListener('pointerdown', closeMenuOutside);
  }

  /* ---------------- kontextové menu (pravý klik) ---------------- */
  function popMenu(pos, items, title) {
    closeMenu();
    const m = el(`<div class="menu" style="position:fixed;z-index:60;min-width:230px;max-height:${innerHeight - 40}px;overflow:auto;padding:6px;border-radius:14px;box-shadow:0 18px 40px var(--shadow)">${title ? `<div style="padding:5px 10px 7px;color:var(--muted);font-size:12px">${esc(title)}</div>` : ''}</div>`);
    items.filter(Boolean).forEach(it => {
      if (it === 'sep') { m.appendChild(el('<div class="msep"></div>')); return; }
      const b = el(`<button class="mi${it.danger ? ' danger' : ''}">${it.color ? `<i style="background:${it.color};box-shadow:0 0 8px ${it.color}"></i>` : ''}<span>${esc(it.label)}</span>${it.check ? '<span class="check">✓</span>' : ''}${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`);
      b.onclick = e => { e.stopPropagation(); if (!it.keep) closeMenu(); it.run(b); };
      m.appendChild(b);
    });
    document.body.appendChild(m);
    let x, y;
    if (pos instanceof Element) { const r = pos.getBoundingClientRect(); x = r.right - m.offsetWidth; y = r.bottom + 6; }
    else { x = pos.x; y = pos.y; }
    x = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8));
    y = Math.max(46, Math.min(y, innerHeight - m.offsetHeight - 8));
    m.style.left = x + 'px'; m.style.top = y + 'px';
    const ox = pos instanceof Element ? m.offsetWidth : Math.max(0, Math.min(m.offsetWidth, (pos.x || 0) - x));
    m.style.transformOrigin = ox + 'px ' + (y < (pos.y || 0) ? '100%' : '0');
    setTimeout(() => document.addEventListener('pointerdown', closeMenuOutside), 0);
    FX.sound.open();
  }

  function projectMenu(id, pos) {
    const p = project(id); if (!p) return;
    const isManual = running() && running().projectId === id;
    const arch = L.isArchived(p, S.settings);
    const owed = L.owedOf(p);
    popMenu(pos, [
      { label: t('Otvoriť'), hint: 'Enter', run: () => openDrawer(id, $(`.card[data-id="${id}"]`)) },
      'sep',
      ...L.STATUSES.map(st => ({ label: st.label, color: sColor(st.id), check: p.status === st.id, run: () => {
        if (p.status === st.id) return;
        morphNext = Date.now();
        act('setStatus', { id, status: st.id });
        if (st.id === 'done') { const c = $(`.card[data-id="${id}"]`); const r = c ? c.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0 }; celebrate(id, r.left + r.width / 2, r.top + 20); }
        else FX.sound.drop();
      } })),
      'sep',
      p.status !== 'done' ? { label: isManual ? t('Zastaviť časovač') : t('Spustiť časovač'), run: () => { FX.sound.rec(); act(isManual ? 'stopTimer' : 'startTimer', { id }); } } : null,
      p.status !== 'done' ? { label: id === S.focusProjectId ? t('Už na tom robím ✓') : t('Robím na tom'), run: () => act('setFocus', { id: id === S.focusProjectId ? null : id }) } : null,
      owed > 0 ? { label: t('Zaplatené, {money}', { money: L.formatMoney(owed) }), run: () => { act('addPayment', { id }); FX.sound.pay(); toast(t('Platba zapísaná.'), { icon: '💸' }); } } : null,
      p.folder ? { label: t('Otvoriť priečinok'), run: () => act('openFolder', { id }) } : { label: t('Vytvoriť priečinok'), run: () => act('createFolder', { id }).then(() => toast(t('Priečinok je pripravený.'))) },
      { label: t('Napísať klientovi…'), run: b => {
        const T = clientTemplates(p);
        popMenu(pos, T.list.map(x => ({ label: x.label, run: () => { act('writeClipboard', { text: x.text }); toast(t('Správa skopírovaná ({lang}).', { lang: T.langName }), { icon: '📋' }); } })), t('Skopírovať správu pre {client}', { client: p.client || t('klienta') }));
      }, keep: true },
      { label: t('Spýtať sa {name}', { name: L.decl(S.settings.mascotName, 'gen') }), run: () => chat.open({ projectId: id }) },
      'sep',
      { label: t('Duplikovať'), run: async () => { const nid = await act('duplicateProject', { id }); toast(t('Kópia vytvorená.'), { actions: [{ label: t('Otvoriť'), run: () => openDrawer(nid) }] }); } },
      { label: arch ? t('Vrátiť z archívu') : t('Archivovať'), run: () => { act('archiveProject', { id, value: !arch }); toast(arch ? t('Vrátené na nástenku.') : t('{title} je v archíve.', { title: esc(p.title) }), { icon: arch ? '↩' : '📦', actions: arch ? [] : [{ label: t('Späť#undo'), run: () => act('archiveProject', { id, value: false }) }] }); } },
      { label: t('Zmazať…'), danger: true, run: () => toast(t('Naozaj zmazať <b>{title}</b>?', { title: esc(p.title) }), { icon: '!', kind: '', actions: [{ label: t('Zmazať'), run: () => { act('deleteProject', { id }); if (openId === id) closeDrawer(); } }] }) }
    ], p.title);
  }

  /* ---------------- toasty ---------------- */
  /* ikonky v hláškach: namiesto emoji jednoduché čiarové ikonky */
  const TOAST_IC = { '🎬': 'film', '🎞': 'film', '📋': 'copy', '⭐': 'spark', '✨': 'sparkle', '🎉': 'sparkle', '🧠': 'chip', '🔌': 'link', '🔒': 'shield', '📁': 'folder', '📥': 'download', '💡': 'bulb', '📅': 'calendar', '↩': 'undo', '🏅': 'target', '✓': 'check', '+': 'plus', '↻': 'redo' };
  function toastIcon(o) {
    if (o.kind === 'error') return '!';
    const n = TOAST_IC[o.icon] || (o.icon && ICONS.has && ICONS.has(o.icon) ? o.icon : 'check');
    return ICONS.svg(n);
  }
  function toast(html, o) {
    o = o || {};
    const tn = el(`<div class="toast ${o.kind || ''}"><span class="ic">${toastIcon(o)}</span><span class="grow">${o.kind === 'error' ? esc(html) : html}</span></div>`);
    (o.actions || []).forEach(a => {
      const b = el(`<button class="btn small">${esc(a.label)}</button>`);
      b.onclick = () => { a.run(); kill(); };
      tn.appendChild(b);
    });
    $('#toasts').appendChild(tn);
    let dead = false;
    const kill = () => {
      if (dead) return; dead = true;
      tn.classList.add('out');
      setTimeout(() => {
        const h = tn.offsetHeight;
        const a = tn.animate([{ height: h + 'px', marginTop: '0px' }, { height: '0px', marginTop: '-8px', paddingTop: '0px', paddingBottom: '0px' }], { duration: 180, easing: 'cubic-bezier(.4,0,.2,1)' });
        a.onfinish = () => tn.remove();
      }, 220);
    };
    setTimeout(kill, o.ms || (o.actions ? 9000 : 3800));
  }

  /* ---------------- navigácia ---------------- */
  const TITLES = {
    board: [t('Nástenka'), () => {
      const a = S.projects.filter(p => L.isActive(p, S.settings)).length;
      const soon = S.projects.filter(p => ['overdue', 'today', 'soon'].includes(L.deadlineInfo(p).level)).length;
      return a ? tp(a, '{n} aktívna zákazka', '{n} aktívne zákazky', '{n} aktívnych zákaziek') + (soon ? t(', {n} s blízkym deadlinom', { n: soon }) : '') : t('Zatiaľ prázdno');
    }],
    timeline: [t('Časová os'), () => t('Ako na tom si a čo ťa čaká. Deadline posunieš ťahaním za kosoštvorec.')],
    ideas: [t('Nápady'), () => t('Nápady, náčrty a storyboardy. Keď chceš, prepojíš ich so zákazkou.')],
    time: [t('Čas'), () => t('Čo si dnes a tento týždeň odrobil a v ktorom programe.')],
    money: [t('Peniaze'), () => t('Čo prišlo, čo ešte nie a koľko reálne zarábaš za hodinu.')],
    archive: [t('Archív'), () => t('Hotové po {n} {d} a všetko, čo archivuješ ručne. Pravý klik = rýchle akcie.', { n: S.settings.archiveAfterDays, d: L.plural(+S.settings.archiveAfterDays, 'dni', 'dňoch', 'dňoch') })],
    clients: [t('Klienti'), () => clientSel ? t('Karta klienta') : t('Kto ti dáva prácu, koľko platí a ako rýchlo.')],
    profile: [t('Profil'), () => t('Level, šatník pre Kita, odznaky a mesačné recapy.')],
    templates: [t('Šablóny'), () => t('Tvoje šablóny, snippety a export presety podľa programu.')],
    settings: [t('Nastavenia'), () => t('Prispôsob si appku. Hocičo nájdeš cez hľadanie vľavo.')]
  };
  function go(v) {
    // smer prechodu podľa poradia v menu: nižšia položka príde zdola, vyššia zhora
    const order = $$('#nav button').map(b => b.dataset.view);
    document.documentElement.style.setProperty('--view-dir', order.indexOf(v) >= order.indexOf(view) ? 1 : -1);
    view = v;
    $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
    const sec = $('#view-' + v);
    sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');
    clearTimeout(sec._enterT); sec._enterT = setTimeout(() => sec.classList.remove('enter'), 1300);
    sec.scrollTop = 0;
    renderView();
    moveNavInd();
  }
  /* svietiaci indikátor v menu, ktorý sa presunie na aktívnu položku */
  function moveNavInd(instant) {
    const nav = $('#nav'), b = nav && $('#nav button.active');
    let ind = $('#navInd');
    if (!nav) return;
    if (!ind) { ind = el('<i id="navInd" class="nav-ind"></i>'); nav.prepend(ind); instant = true; }
    if (!b) { ind.style.opacity = 0; return; }
    if (instant) ind.style.transition = 'none';
    ind.style.opacity = 1;
    ind.style.transform = `translateY(${b.offsetTop}px)`;
    ind.style.height = b.offsetHeight + 'px';
    if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  $$('#nav button').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'clients') clientSel = null; if (ideas.isOpen()) ideas.close(true); if (openId) closeDrawer(); go(b.dataset.view); }));

  function renderHeader() {
    const [title, sub] = TITLES[view];
    $('#viewTitle').textContent = title;
    $('#viewSub').textContent = sub();
    const unassigned = S.sessions.filter(s => !s.projectId && s.end).length + (S.looseRenders || []).length;
    const badge = $('#timeBadge');
    badge.hidden = !unassigned;
    badge.textContent = unassigned;
  }

  function renderView() {
    renderHeader();
    if (view === 'board') renderBoard();
    else if (view === 'timeline') renderTimeline();
    else if (view === 'ideas') ideas.render($('#view-ideas'));
    else if (view === 'time') renderTime();
    else if (view === 'money') renderMoney();
    else if (view === 'archive') renderArchive();
    else if (view === 'clients') renderClients();
    else if (view === 'profile') renderProfile();
    else if (view === 'templates') renderTemplates();
    else if (view === 'settings') renderSettings();
  }

  function renderAll() {
    renderView();
    renderRec();
    renderLevel();
    updateMascot();
    if (openId) refreshDrawer();
  }

  /* ---------------- nástenka ---------------- */
  function archived() {
    return S.projects.filter(p => L.isArchived(p, S.settings));
  }
  const archivedCount = () => archived().length;

  function visibleProjects() {
    const q = L.normalize(query);
    return S.projects.filter(p => {
      if (L.isArchived(p, S.settings)) return false;
      if (q && !L.normalize(p.title + ' ' + p.client + ' ' + p.type).includes(q)) return false;
      return true;
    });
  }

  function cardHTML(p) {
    const d = L.deadlineInfo(p);
    const ms = L.projectMs(S, p.id);
    const isLive = (LIVE.mode === 'auto' || LIVE.mode === 'manual') && LIVE.projectId === p.id;
    const isManual = running() && running().projectId === p.id;
    const owed = L.owedOf(p);
    const done = p.status === 'done';
    const over = !done && d.level === 'overdue';
    const cl = p.checklist || [];
    const prog = cl.length ? cl.filter(c => c.done).length / cl.length : null;
    const lines = [];
    const who = [p.client, tv(p.type)].filter(Boolean).join(', ');
    if (who) lines.push(`<div class="ln who">${esc(who)}</div>`);
    if (p.deadline && !done) lines.push(`<div class="ln dl ${d.level}">${ICON.cal}<span>${esc(over ? d.label.charAt(0).toUpperCase() + d.label.slice(1) : d.level === 'today' ? t('Deadline dnes') : t('Deadline {when}', { when: d.label }))}</span></div>`);
    if (done && p.reward) lines.push(owed > 0 ? `<div class="ln owed">${t('Čaká {money}', { money: L.formatMoney(owed) })}</div>` : `<div class="ln paid">${t('Zaplatené')}</div>`);
    if (ms >= 60000 || isLive) lines.push(`<div class="ln time${isLive ? ' live' : ''}">${ICON.clock}<span>${L.formatDuration(ms)}${isLive ? t(', práve meriam') : ''}</span></div>`);
    if (p.renders.length) lines.push(`<div class="ln">${ICON.film}<span>${p.renders.length} ${L.plural(p.renders.length, 'render', 'rendre', 'renderov')}</span></div>`);
    return `<article class="card${p.id === S.focusProjectId && !done ? ' focus' : ''}${isLive ? ' live' : ''}${over ? ' over' : ''}${done ? ' is-done' : ''}" data-id="${p.id}" style="--c:${sColor(p.status)};--pc:var(--paper-${p.status});--vtn:c-${p.id}" tabindex="0">
      ${isLive ? '<i class="tape" aria-hidden="true"></i>' : ''}
      <div class="card-top"><h4>${esc(p.title || t('Bez názvu'))}</h4>${p.reward ? `<span class="price">${L.formatMoney(p.reward)}</span>` : ''}</div>
      <div class="lines">${lines.join('')}</div>
      ${prog !== null ? `<div class="progress"><i style="width:${Math.round(prog * 100)}%"></i></div>` : ''}
      ${!done ? `<button class="play${isManual ? ' on' : ''}" title="${isManual ? t('Zastaviť časovač') : t('Spustiť časovač')}" data-play="${p.id}">${isManual ? ICON.stop : ICON.play}</button>` : ''}
      ${p.priority === 'high' && !done ? `<i class="prio" title="${t('Vysoká priorita')}"></i>` : ''}
      ${over ? `<span class="stamp">${t('Po termíne')}</span>` : ''}
    </article>`;
  }

  let boardPending = false;
  function renderBoard() {
    const root = $('#view-board');
    if (drag && drag.moved) { boardPending = true; return; }
    boardPending = false;
    if (!S.projects.length) {
      root.innerHTML = `<div class="empty">
        <div class="mascot" id="bigKit"></div>
        <h2>${t('Prvá zákazka?')}</h2>
        <p>${t('Skopíruj správu od klienta z Discordu a vlož ju sem. Názov, cenu a deadline vyplním sám a založím aj priečinok na projekt.')}</p>
        <div class="row"><button class="btn primary" data-empty="add">${t('Vložiť správu od klienta')}</button><button class="btn" data-empty="notion">${t('Importovať z Notionu')}</button></div>
      </div>`;
      Mascot.mount($('#bigKit'));
      $('[data-empty=add]', root).onclick = () => openQuickAdd();
      $('[data-empty=notion]', root).onclick = importNotion;
      return;
    }
    const rects = captureRects(root);
    const list = visibleProjects();
    root.innerHTML = `<div class="board-tools">
        <label class="search">${ICON.search}<input id="q" placeholder="${t('Hľadať zákazku alebo klienta')}" value="${esc(query)}"></label>
        ${archivedCount() ? `<button class="btn ghost small" data-goarch>${t('Archív ({n})', { n: archivedCount() })}</button>` : ''}
      </div>
      <div class="board">${L.STATUSES.map(s => {
        const items = list.filter(p => p.status === s.id);
        const sum = items.reduce((a, p) => a + (Number(p.reward) || 0), 0);
        return `<div class="col" data-status="${s.id}" style="--c:${sColor(s.id)};--pc:var(--paper-${s.id})">
          <div class="col-head"><i class="dot"></i><h3>${s.label}</h3><span class="count">${items.length}</span>${sum ? `<span class="sum">${L.formatMoney(sum)}</span>` : ''}</div>
          <div class="col-list">${items.map(cardHTML).join('') || `<div class="col-empty">${esc(s.hint)}</div>`}</div>
          ${s.id === 'todo' ? `<button class="add-in-col">${t('+ Nová zákazka')}</button>` : ''}
        </div>`;
      }).join('')}</div>`;
    const q = $('#q', root);
    q.addEventListener('input', () => { query = q.value; const pos = q.selectionStart; renderBoard(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    const ga = $('[data-goarch]', root); if (ga) ga.onclick = () => go('archive');
    const addCol = $('.add-in-col', root); if (addCol) addCol.onclick = () => openQuickAdd();
    $$('[data-play]', root).forEach(b => {
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.onclick = e => {
        e.stopPropagation();
        const id = b.dataset.play;
        FX.sound.rec();
        if (running() && running().projectId === id) act('stopTimer'); else act('startTimer', { id });
      };
    });
    $$('.card', root).forEach(c => {
      c.addEventListener('pointerdown', e => startDrag(e, c));
      c.addEventListener('keydown', e => { if (e.key === 'Enter') openDrawer(c.dataset.id, c); if (e.key === 'ContextMenu') projectMenu(c.dataset.id, c); });
      c.addEventListener('contextmenu', e => { e.preventDefault(); projectMenu(c.dataset.id, { x: e.clientX, y: e.clientY }); });
    });
    root.classList.add('no-tr');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-tr')));
    playFlip(root, rects);
  }

  /* FLIP: karty plynulo preletia na nové miesto */
  function captureRects(root) {
    const m = new Map();
    $$('.card', root).forEach(c => m.set(c.dataset.id, c.getBoundingClientRect()));
    return m;
  }
  let dropped = null; // { id, rect, ghost } – karta, ktorú si práve pustil
  function playFlip(root, rects) {
    const dp = dropped && project(dropped.id);
    const drop = dp && dp.status === dropped.status && Date.now() - dropped.at < 1500 ? dropped : null;
    if (drop) { rects.set(drop.id, drop.rect); dropped = null; }
    if (!rects.size) return;
    $$('.card', root).forEach(c => {
      const a = rects.get(c.dataset.id);
      if (drop && c.dataset.id === drop.id) {
        const b = c.getBoundingClientRect();
        drop.ghost.remove();
        c.animate([
          { transform: `translate(${a.left - b.left}px,${a.top - b.top}px) rotate(2.5deg) scale(1.03)`, boxShadow: '0 24px 50px rgba(2,4,16,.45)' },
          { transform: 'none', boxShadow: '0 6px 18px rgba(2,4,16,.18)' }
        ], { duration: 420, easing: 'cubic-bezier(.34,1.3,.64,1)' });
        return;
      }
      if (!a) { c.animate([{ opacity: 0, transform: 'scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  /* ťahanie kariet */
  let drag = null;
  function startDrag(e, card) {
    if (e.button !== 0) return;
    closeMenu();
    const r = card.getBoundingClientRect();
    drag = { card, id: card.dataset.id, x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, moved: false };
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
  }
  function onDrag(e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      drag.ghost = drag.card.cloneNode(true);
      drag.ghost.classList.add('ghost');
      drag.ghost.style.width = drag.w + 'px';
      document.body.appendChild(drag.ghost);
      drag.card.classList.add('dragging');
      document.body.style.cursor = 'grabbing';
    }
    drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
    drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const col = under && under.closest('.col');
    $$('.col').forEach(c => c.classList.toggle('over', c === col));
    drag.col = col;
    drag.before = null;
    if (col) {
      const cards = $$('.card:not(.dragging)', col);
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { drag.before = c.dataset.id; break; }
      }
    }
  }
  function endDrag(e) {
    window.removeEventListener('pointermove', onDrag);
    const d = drag; drag = null;
    document.body.style.cursor = '';
    if (!d) return;
    if (!d.moved) { openDrawer(d.id, d.card); return; }
    if (boardPending) setTimeout(renderBoard, 0);
    $$('.col').forEach(c => c.classList.remove('over'));
    if (!d.col) {
      // pustené mimo stĺpca: duch sa vráti na pôvodné miesto
      const home = d.card.getBoundingClientRect(), g = d.ghost.getBoundingClientRect();
      const back = d.ghost.animate([{ transform: 'rotate(2.5deg) scale(1.03)' }, { transform: `translate(${home.left - g.left}px,${home.top - g.top}px)` }], { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      back.onfinish = () => { d.ghost.remove(); d.card.classList.remove('dragging'); };
      return;
    }
    // duch ostane visieť, kým nepríde nový stav, potom karta plynulo dosadne na miesto
    dropped = { id: d.id, status: d.col.dataset.status, rect: d.ghost.getBoundingClientRect(), ghost: d.ghost, at: Date.now() };
    const g = d.ghost;
    setTimeout(() => { if (dropped && dropped.ghost === g) { dropped = null; g.remove(); renderBoard(); } else if (g.isConnected) g.remove(); }, 900);
    const status = d.col.dataset.status;
    const p = project(d.id);
    const wasDone = p.status === 'done';
    FX.sound.drop();
    act('moveProject', { id: d.id, status, beforeId: d.before });
    if (status === 'done' && !wasDone) celebrate(d.id, e.clientX, e.clientY);
  }

  /* kartička v stĺpci Hotovo sa „usadí“ a jej suma odletí do súčtu stĺpca */
  function doneSettle(id) {
    if (window.__motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches || view !== 'board') return;
    const card = $(`.card[data-id="${id}"]`), p = project(id);
    if (!card || !p || p.status !== 'done') return;
    card.classList.remove('settle'); void card.offsetWidth; card.classList.add('settle');
    setTimeout(() => card.classList.remove('settle'), 700);
    const from = $('.price', card) || card, sum = $('.col[data-status="done"] .col-head .sum');
    const a = from.getBoundingClientRect();
    const chip = document.createElement('div');
    chip.className = 'money-fly';
    chip.textContent = '+' + L.formatMoney(p.reward);
    chip.style.left = a.left + 'px'; chip.style.top = a.top + 'px';
    document.body.appendChild(chip);
    const b = sum ? sum.getBoundingClientRect() : { left: a.left, top: a.top - 60, width: 0 };
    const dx = b.left + b.width / 2 - (a.left + chip.offsetWidth / 2), dy = b.top - a.top;
    const anim = chip.animate([
      { transform: 'translate(0, 0) scale(.7)', opacity: 0 },
      { transform: 'translate(0, -14px) scale(1.12)', opacity: 1, offset: .22 },
      { transform: `translate(${dx * .55}px, ${Math.min(dy, 0) * .55 - 30}px) scale(1)`, opacity: 1, offset: .62 },
      { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: sum ? .9 : 0 }
    ], { duration: 950, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'forwards' });
    anim.onfinish = () => {
      chip.remove();
      if (sum && sum.isConnected) { sum.classList.remove('bump'); void sum.offsetWidth; sum.classList.add('bump'); setTimeout(() => sum.classList.remove('bump'), 600); }
    };
  }

  function celebrate(id, x, y) {
    localDone.set(id, Date.now());
    const p = project(id);
    const onTime = p && p.deadline && L.dayKey(Date.now()) <= p.deadline;
    FX.confetti(x, y, 110);
    FX.xp(x, y - 10, onTime ? '+75 XP' : '+50 XP');
    FX.sound.done();
    cheer();
    if (p && Number(p.reward) > 0) setTimeout(() => doneSettle(id), 620); // po presune kartičky do stĺpca Hotovo
    if (p && L.owedOf(p) > 0) {
      setTimeout(() => toast(t('Hotovo! <b>{title}</b>, {client} ešte nezaplatil {money}.', { title: esc(p.title), client: esc(p.client || t('klient')), money: L.formatMoney(L.owedOf(p)) }), {
        icon: '🎉', actions: [{ label: t('Už zaplatil'), run: () => { act('addPayment', { id }); FX.sound.pay(); } }]
      }), 600);
    }
  }

  /* ---------------- šablóny správ pre klienta ---------------- */
  function clientTemplates(p) {
    const n = p.notes || '';
    // jazyk správy podľa toho, ako píše klient; keď sa to nedá zistiť, jazyk appky
    const lang = /[ěřůŘĚŮ]|\b(jsem|bych|chtěl|ještě|děkuji|díky|prosím tě)\b/i.test(n) ? 'cs'
      : /[áäčďéíĺľňóôŕšťúýž]/i.test(n) ? 'sk'
      : /\b(the|please|thanks|can you|would|video for)\b/i.test(n) ? 'en' : (I18N.lang === 'en' ? 'en' : 'sk');
    const owed = L.formatMoney(L.owedOf(p));
    const dl = p.deadline ? L.formatDate(p.deadline) : '';
    const T = {
      sk: [
        ['Preview je hotové', `Ahoj! Preview k ${p.title} je hotové 🎬 Pozri si ho a daj mi vedieť, čo by si chcel upraviť. Ak je všetko ok, pošlem final.`],
        ['Potrebujem podklady', `Ahoj! Púšťam sa do ${p.title}. Pošleš mi prosím footage / logo / hudbu, ktoré tam chceš mať? Čím skôr to budem mať, tým skôr to bude hotové.`],
        ['Ako to ide', `Ahoj! Len update k ${p.title}: idem podľa plánu${dl ? ' a deadline ' + dl + ' stíham' : ''}. Ozvem sa s preview.`],
        ['Posun deadlinu', `Ahoj, potreboval by som k ${p.title} ešte pár dní navyše, chcem to spraviť poriadne. Vyhovovalo by ti to o 2 – 3 dni neskôr? Prepáč za zdržanie.`],
        ['Hotovo + platba', `Ahoj! ${p.title} je hotové a posielam final 🎉 Ďakujem za spoluprácu. Platbu ${owed} mi môžeš poslať, keď sa ti to bude hodiť.`],
        ['Pripomienka platby', `Ahoj, len jemne pripomínam platbu ${owed} za ${p.title}. Vďaka!`]
      ],
      cs: [
        ['Preview je hotové', `Ahoj! Preview k ${p.title} je hotové 🎬 Mrkni na něj a dej mi vědět, co bys chtěl upravit. Když bude všechno ok, pošlu final.`],
        ['Potřebuju podklady', `Ahoj! Pouštím se do ${p.title}. Pošleš mi prosím footage / logo / hudbu, co tam chceš mít? Čím dřív to budu mít, tím dřív to bude hotové.`],
        ['Jak to jde', `Ahoj! Jen update k ${p.title}: jedu podle plánu${dl ? ' a deadline ' + dl + ' stíhám' : ''}. Ozvu se s preview.`],
        ['Posun deadlinu', `Ahoj, potřeboval bych k ${p.title} ještě pár dní navíc, chci to udělat pořádně. Vyhovovalo by ti to o 2–3 dny později? Sorry za zdržení.`],
        ['Hotovo + platba', `Ahoj! ${p.title} je hotové a posílám final 🎉 Díky za spolupráci. Platbu ${owed} mi můžeš poslat, až se ti to bude hodit.`],
        ['Připomínka platby', `Ahoj, jen jemně připomínám platbu ${owed} za ${p.title}. Díky!`]
      ],
      en: [
        ['Preview ready', `Hey! The preview for ${p.title} is ready 🎬 Have a look and tell me what you'd like changed. If it's all good, I'll send the final.`],
        ['Need assets', `Hey! Starting on ${p.title}. Could you send me the footage / logo / music you want in it? The sooner I have it, the sooner it's done.`],
        ['Progress update', `Hey! Quick update on ${p.title}: on track${dl ? ' for ' + dl : ''}. I'll ping you with a preview soon.`],
        ['Deadline shift', `Hey, I'd need a couple more days for ${p.title}, I want to get it right. Would 2-3 days later work for you? Sorry for the delay.`],
        ['Done + payment', `Hey! ${p.title} is done, sending the final 🎉 Thanks for working with me. You can send the ${owed} whenever it suits you.`],
        ['Payment reminder', `Hey, just a friendly reminder about the ${owed} for ${p.title}. Thanks!`]
      ]
    };
    const NAMES = [t('Preview je hotové'), t('Potrebujem podklady'), t('Ako to ide'), t('Posun deadlinu'), t('Hotovo + platba'), t('Pripomienka platby')];
    return { lang, langName: { sk: t('slovensky'), cs: t('česky'), en: t('anglicky') }[lang], list: T[lang].map(([label, text], i) => ({ label: NAMES[i] || label, text })) };
  }

  /* ---------------- stránka projektu (celá obrazovka) ---------------- */
  let editor = null, pageFrom = null;
  let morphing = false, morphNext = 0;
  function openDrawer(id, fromEl) {
    const d = $('#drawer');
    const wasOpen = !!openId;
    // Čistá téma: skutočný morphing karty na stránku (nadpis karty sa zmení na nadpis stránky)
    if (!wasOpen && fromEl && fromEl.isConnected && !morphing && Polish.canMorph()) {
      morphing = true;
      const h = fromEl.querySelector('h4');
      fromEl.style.viewTransitionName = 'woi-morph'; if (h) h.style.viewTransitionName = 'woi-title';
      FX.sound.open();
      Polish.morph(() => {
        fromEl.style.viewTransitionName = ''; if (h) h.style.viewTransitionName = '';
        openDrawer(id, fromEl);
        d.style.viewTransitionName = 'woi-morph';
        const ti = $('.d-title', d); if (ti) ti.style.viewTransitionName = 'woi-title';
      }, { cls: 'vt-page' }).then(() => { morphing = false; d.style.viewTransitionName = ''; const ti = $('.d-title', d); if (ti) ti.style.viewTransitionName = ''; });
      return;
    }
    openId = id;
    closeMenu();
    buildDrawer();
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    d.scrollTop = 0;
    pageFrom = fromEl && fromEl.getBoundingClientRect ? fromEl.getBoundingClientRect() : null;
    if (!wasOpen && morphing) return;
    if (!wasOpen) {
      FX.sound.open();
      const r = d.getBoundingClientRect();
      const f = pageFrom;
      const from = f ? `inset(${f.top - r.top}px ${r.right - f.right}px ${r.bottom - f.bottom}px ${f.left - r.left}px round 16px)` : 'inset(2% 2% 2% 2% round 26px)';
      d.animate([{ clipPath: from, opacity: f ? 1 : 0 }, { clipPath: 'inset(0px 0px 0px 0px round 26px)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2,.85,.25,1)' });
      $$('.pg-main > *, .pg-side > *', d).forEach((x, i) => x.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 120 + i * 30, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    }
  }
  function closeDrawer() {
    if (!openId) return;
    const d = $('#drawer');
    const card = $(`.card[data-id="${openId}"]`);
    if (card && card.offsetParent && !morphing && Polish.canMorph()) {
      morphing = true;
      const ti = $('.d-title', d), h = card.querySelector('h4');
      d.style.viewTransitionName = 'woi-morph'; if (ti) ti.style.viewTransitionName = 'woi-title';
      openId = null; editor = null;
      FX.sound.close();
      Polish.morph(() => {
        d.style.viewTransitionName = ''; if (ti) ti.style.viewTransitionName = '';
        d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); d.innerHTML = '';
        card.style.viewTransitionName = 'woi-morph'; if (h) h.style.viewTransitionName = 'woi-title';
      }, { cls: 'vt-page' }).then(() => { morphing = false; card.style.viewTransitionName = ''; if (h) h.style.viewTransitionName = ''; });
      return;
    }
    openId = null; editor = null;
    FX.sound.close();
    const r = d.getBoundingClientRect(), f = card && card.getBoundingClientRect();
    const to = f && f.width ? `inset(${f.top - r.top}px ${r.right - f.right}px ${r.bottom - f.bottom}px ${f.left - r.left}px round 16px)` : 'inset(2% 2% 2% 2% round 26px)';
    const anim = d.animate([{ clipPath: 'inset(0px 0px 0px 0px round 26px)', opacity: 1 }, { clipPath: to, opacity: f ? 0.6 : 0 }], { duration: 300, easing: 'cubic-bezier(.4,0,.6,1)' });
    anim.onfinish = () => { if (!openId) { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); d.innerHTML = ''; } };
  }

  /* malý popover na zadanie odkazu (window.prompt v appke nefunguje) */
  function askText(anchor, label, cb, value) {
    closeMenu();
    const r = anchor.getBoundingClientRect();
    const m = el(`<div class="menu pop-input" style="position:fixed;z-index:60;top:${r.bottom + 6}px;left:${Math.min(r.left, innerWidth - 340)}px"><label>${esc(label)}</label><input value="${esc(value || '')}" placeholder="https://"><div class="row"><button class="btn ghost small" data-no>${t('Zrušiť')}</button><button class="btn primary small" data-ok>${t('Pridať')}</button></div></div>`);
    document.body.appendChild(m);
    const inp = $('input', m);
    const done = v => { m.remove(); cb(v); };
    $('[data-ok]', m).onclick = () => done(inp.value.trim());
    $('[data-no]', m).onclick = () => done(null);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim()); if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    setTimeout(() => inp.focus(), 10);
  }

  function buildDrawer() {
    const p = project(openId);
    if (!p) return closeDrawer();
    const d = $('#drawer');
    const back = TITLES[view] ? TITLES[view][0] : t('Nástenka');
    d.innerHTML = `
      <div class="pg-top">
        <button class="btn ghost small" data-x>← ${esc(back)}</button>
        <span class="crumb">${esc(p.title)}</span>
        <span class="grow"></span>
        <button class="btn ghost small" data-more title="${t('Ďalšie možnosti')}">•••</button>
        <button class="btn ghost small" data-x aria-label="${t('Zavrieť')}">${'<span style="width:14px;height:14px;display:block">' + ICON.close + '</span>'}</button>
      </div>
      <div class="pg-cover" style="--c:${sColor(p.status)}"><i></i><i></i></div>
      <div class="pg-wrap d-head" style="--c:${sColor(p.status)}">
        <div class="pg-main">
          <span class="pg-type">${esc(tv(p.type))}${p.archived === true || L.isArchived(p, S.settings) ? t(', v archíve') : ''}</span>
          <input class="d-title" data-f="title" value="${esc(p.title)}" placeholder="${t('Názov projektu')}">
          <div class="d-sub" id="dSub"></div>
          <div class="status-pick">${L.STATUSES.map(s => `<button data-st="${s.id}" style="--c:${sColor(s.id)}" class="${p.status === s.id ? 'on' : ''}">${s.label}</button>`).join('')}</div>
          <div class="d-actions" id="dActions"></div>
          <section class="pg-sec">
            <div class="sec-h"><h5>${t('Zadanie a poznámky')}</h5><span class="aside">${t('Ctrl+V vloží obrázok, „# “ nadpis, „- “ odrážky, „[] “ úloha')}</span></div>
            <div class="rte-wrap" id="dEditor"></div>
          </section>
          <section class="pg-sec" id="dChecklist"></section>
          <section class="pg-sec" id="dRenders"></section>
        </div>
        <aside class="pg-side">
          <div class="box pg-props">
            <div class="prop"><label>${t('Klient')}</label><div class="prop-in"><input data-f="client" value="${esc(p.client)}" placeholder="${t('Meno alebo prezývka')}" list="clientList"><button class="btn ghost small" data-client title="${t('Karta klienta')}">→</button></div></div>
            <datalist id="clientList">${L.clientStats(S).map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
            <div class="prop"><label>${t('Kontakt')}</label><select data-f="contact">${opts(withCur(L.contactTypes(S.settings), p.contact), p.contact)}</select></div>
            <div class="prop"><label>${t('Typ')}</label><select data-f="type">${opts(withCur(L.projectTypes(S.settings), p.type), p.type)}</select></div>
            <div class="prop"><label>${t('Priorita')}</label><select data-f="priority">${opts(L.PRIORITIES, p.priority)}</select></div>
            <div class="prop"><label>${t('Deadline')}</label><input type="date" data-f="deadline" value="${esc(p.deadline)}"></div>
            <div class="prop"><label>${t('Odmena')}</label><div class="suffix"><input type="number" min="0" step="1" data-f="reward" value="${p.reward || ''}" placeholder="0"><span>${esc(I18N.currencySymbol())}</span></div></div>
            <div id="dTip"></div>
          </div>
          <div class="box" id="dMoney"></div>
          <div class="box" id="dTime"></div>
          <div class="box" id="dIdeas"></div>
          <div class="box" id="dFolder"></div>
          <div class="box" id="dHistory"></div>
          <div class="pg-danger"><button class="btn small" id="dArchive"></button><button class="btn danger small" id="dDelete">${t('Zmazať')}</button></div>
        </aside>
      </div>`;
    $$('[data-x]', d).forEach(b => b.onclick = closeDrawer);
    $('[data-more]', d).onclick = e => projectMenu(p.id, e.currentTarget);
    $('[data-client]', d).onclick = () => { const c = project(openId).client; if (c) { closeDrawer(); openClient(L.clientKey(c)); } };
    $$('[data-st]', d).forEach(b => b.onclick = e => {
      const was = project(openId).status;
      if (b.dataset.st === was) return;
      act('setStatus', { id: openId, status: b.dataset.st });
      $$('[data-st]', d).forEach(x => x.classList.toggle('on', x === b));
      $('.d-head', d).style.setProperty('--c', sColor(b.dataset.st));
      $('.pg-cover', d).style.setProperty('--c', sColor(b.dataset.st));
      if (b.dataset.st === 'done') { const r = b.getBoundingClientRect(); celebrate(openId, r.left + r.width / 2, r.top); }
      else FX.sound.pop();
    });
    // ukladanie polí
    $$('[data-f]', d).forEach(inp => {
      const save = () => {
        const f = inp.dataset.f;
        let v = inp.value;
        if (f === 'reward') v = parseFloat(v) || 0;
        if (f === 'title' && !v.trim()) return;
        act('updateProject', { id: openId, patch: { [f]: v } });
        if (f === 'title') $('.crumb', d).textContent = v;
      };
      inp.addEventListener('change', save);
      if (inp.dataset.f === 'title') { let tm; inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(save, 700); }); }
    });
    // editor poznámok
    const pid = p.id;
    editor = RTE.create($('#dEditor'), {
      html: p.notesHtml || RTE.textToHtml(p.notes),
      placeholder: t('Čo presne klient chce, odkazy na footage, feedback… Obrázky vlož cez Ctrl+V alebo ich sem pretiahni.'),
      onChange: (html, text) => act('updateProject', { id: pid, patch: { notesHtml: html, notes: text } }),
      onImage: ({ data, ext }) => act('saveImage', { id: pid, data, ext }),
      onOpenImage: url => act('openFileUrl', { url }),
      askLink: (anchor, cb) => askText(anchor, t('Odkaz'), cb),
      extra: [{ id: 'draw', title: t('Nakresliť náčrt'), html: ICONS.svg('brush'), run: async () => {
        const r = await Sketch.open({ title: t('Náčrt k zákazke'), aspect: 'free' });
        if (!r || openId !== pid) return;
        const url = await act('saveImage', { id: pid, data: r.data, ext: 'png' });
        editor.insertHtml(`<img src="${url}" alt=""><p><br></p>`);
        FX.sound.pop();
      } }]
    });
    editor.lastHtml = p.notesHtml || '';
    let armed = false;
    $('#dDelete').onclick = e => {
      if (!armed) { armed = true; e.target.textContent = t('Naozaj? Klikni znova'); setTimeout(() => { armed = false; e.target.textContent = t('Zmazať'); }, 3000); return; }
      act('deleteProject', { id: openId }); closeDrawer(); toast(t('Zákazka zmazaná.'));
    };
    $('#dArchive').onclick = () => {
      const pp = project(openId), arch = L.isArchived(pp, S.settings);
      act('archiveProject', { id: openId, value: !arch });
      toast(arch ? t('Vrátené na nástenku.') : t('Presunuté do archívu.'), { icon: arch ? '↩' : '📦' });
      if (!arch) closeDrawer();
    };
    refreshDrawer();
  }

  /* dynamické časti draweru (neprepisujú rozpísané polia) */
  function refreshDrawer() {
    const p = project(openId);
    if (!p) return closeDrawer();
    const d = $('#drawer');
    const dl = L.deadlineInfo(p);
    const ms = L.projectMs(S, p.id);
    $('#dSub').innerHTML = `
      ${p.deadline ? `<span class="chip ${dl.level}">${ICON.cal}${esc(dl.label)}</span>` : ''}
      <span class="chip time">${ICON.clock}${L.formatDuration(ms)}</span>
      ${p.revisions ? `<span class="chip" style="color:${p.revisions > 2 ? 'var(--amber)' : 'var(--muted)'}" title="${t('Koľkokrát išla zákazka do Úprav')}">${t('{n}. kolo úprav', { n: p.revisions })}</span>` : ''}
      ${p.id === S.focusProjectId ? `<span class="chip" style="color:var(--amber)">${t('Aktívny projekt')}</span>` : ''}`;
    // ak sa status zmenil z mobilu
    $$('[data-st]', d).forEach(x => x.classList.toggle('on', x.dataset.st === p.status));
    $('.d-head', d).style.setProperty('--c', sColor(p.status));
    for (const inp of $$('[data-f]', d)) {
      if (document.activeElement === inp) continue;
      const f = inp.dataset.f;
      const v = f === 'reward' ? (p.reward || '') : (p[f] || '');
      if (String(inp.value) !== String(v)) inp.value = v;
    }
    // poznámky zmenené inde (napr. z mobilu)
    if (editor && (p.notesHtml || '') !== editor.lastHtml && document.activeElement !== editor.el) {
      const fromOutside = !editor.el.contains(document.activeElement);
      editor.lastHtml = p.notesHtml || '';
      if (fromOutside && RTE.sanitize(editor.el.innerHTML) !== editor.lastHtml) editor.setHtml(editor.lastHtml);
    } else if (editor) editor.lastHtml = p.notesHtml || '';
    // cenový tip
    const tip = L.priceTip(S, p.type, p.id);
    const tipBox = $('#dTip');
    if (tip) {
      const low = p.reward && tip.suggest && p.reward < tip.suggest * 0.8;
      tipBox.innerHTML = `<div class="tip${low ? ' warn' : ''}"><b>${low ? t('Pýtaš menej ako zvyčajne') : t('Cenový tip')}</b>
        ${t('Za {type} si pýtal zvyčajne <b>{money}</b>{hours}.', { type: esc(tv(p.type)), money: L.formatMoney(tip.medReward), hours: tip.medHours ? t(', robil si na tom ~{time}', { time: L.formatDuration(tip.medHours * 3600000) }) : '' })}
        ${tip.byTime ? t('Pri cieli {goal} to vychádza aspoň na <b>{money}</b>.', { goal: L.formatMoney(tip.goal) + '/' + t('hod'), money: L.formatMoney(tip.byTime) }) : ''}
        ${!p.reward || low ? `<button class="btn small" data-usetip>${t('Nastaviť {money}', { money: L.formatMoney(tip.suggest) })}</button>` : ''}</div>`;
      const u = $('[data-usetip]', tipBox); if (u) u.onclick = () => act('updateProject', { id: p.id, patch: { reward: tip.suggest } });
    } else tipBox.innerHTML = '';
    const archBtn = $('#dArchive');
    if (archBtn) archBtn.textContent = L.isArchived(p, S.settings) ? t('Vrátiť na nástenku') : t('Archivovať');

    // akcie
    const isManual = running() && running().projectId === p.id;
    const a = $('#dActions');
    a.innerHTML = `
      ${p.status !== 'done' ? `<button class="btn ${isManual ? 'danger' : 'primary'} small" data-a="timer">${isManual ? t('Zastaviť časovač') : t('Spustiť časovač')}</button>` : ''}
      <button class="btn small" data-a="msg">${t('Napísať klientovi')}</button>
      <button class="btn small" data-a="kit">${t('Spýtať sa {name}', { name: esc(L.decl(S.settings.mascotName, 'gen')) })}</button>`;
    $$('[data-a]', a).forEach(b => b.onclick = async () => {
      const k = b.dataset.a;
      if (k === 'timer') { FX.sound.rec(); act(isManual ? 'stopTimer' : 'startTimer', { id: p.id }); }
      if (k === 'kit') chat.open({ projectId: p.id });
      if (k === 'msg') {
        const T = clientTemplates(p);
        menu(b, T.list.map(x => ({ label: x.label, sub: x.text.slice(0, 60) + '…', run: () => {
          act('writeClipboard', { text: x.text }); toast(t('Správa skopírovaná ({lang}). Vlož ju do Discordu.', { lang: T.langName }), { icon: '📋' });
        } })).concat(S.settings.ollamaEnabled ? [{ label: t('Napísať s {name}', { name: L.decl(S.settings.mascotName, 'ins') }), sub: t('Vlastná správa cez lokálne AI'), color: 'var(--lilac)', run: () => chat.open({ projectId: p.id, q: t('Napíš krátku správu pre klienta ({client}) v jeho jazyku o aktuálnom stave tejto zákazky.', { client: p.client || t('klient') }) }) }] : []), t('Skopírovať správu pre {client}', { client: p.client || t('klienta') }));
      }
    });

    // peniaze
    const paid = L.paidOf(p), owed = L.owedOf(p);
    $('#dMoney').innerHTML = `
      <div class="sec-h"><h5>${t('Peniaze')}</h5>${ms > 15 * 60000 && paid ? `<span class="aside">${L.formatMoney(paid / (ms / 3600000))} / ${t('hod')}</span>` : ''}</div>
      <div class="money-box">
        <div><b>${L.formatMoney(p.reward)}</b><span>${t('Odmena')}</span></div>
        <div><b style="color:var(--mint)">${L.formatMoney(paid)}</b><span>${t('Zaplatené')}</span></div>
        <div><b style="color:${owed ? 'var(--amber)' : 'var(--muted)'}">${L.formatMoney(owed)}</b><span>${t('Zostáva')}</span></div>
      </div>
      <div class="d-actions" style="margin:10px 0 0">
        ${owed > 0 ? `<button class="btn small" data-pay="all">${t('Zaplatil všetko')}</button>` : ''}
        <div class="suffix" style="width:120px"><input class="input" type="number" min="0" id="payAmt" placeholder="${t('Suma')}" style="padding:6px 26px 6px 10px"><span>${esc(I18N.currencySymbol())}</span></div>
        <button class="btn ghost small" data-pay="part">${t('Pridať platbu')}</button>
      </div>
      ${p.payments.length ? `<div class="list" style="margin-top:8px">${p.payments.map((x, i) => `<div class="li"><span class="grow">${L.formatMoney(x.amount)} ${x.note ? '<span class="dim">' + esc(x.note) + '</span>' : ''}</span><span class="dim">${L.formatDate(x.at)}</span><button class="x" data-rmpay="${i}" title="${t('Odstrániť')}">✕</button></div>`).join('')}</div>` : ''}`;
    $$('[data-pay]', d).forEach(b => b.onclick = () => {
      const amt = b.dataset.pay === 'all' ? owed : parseFloat($('#payAmt').value);
      if (!amt) return;
      act('addPayment', { id: p.id, amount: amt });
      const r = b.getBoundingClientRect(); FX.confetti(r.left + r.width / 2, r.top, 40); FX.sound.pay();
    });
    $$('[data-rmpay]', d).forEach(b => b.onclick = () => act('removePayment', { id: p.id, index: +b.dataset.rmpay }));

    // checklist
    const cl = p.checklist || [];
    $('#dChecklist').innerHTML = `
      <div class="sec-h"><h5>${t('Postup')}</h5><span class="aside">${cl.length ? cl.filter(c => c.done).length + ' / ' + cl.length : ''}</span></div>
      <div class="list">${cl.map(c => `<label class="check${c.done ? ' done' : ''}"><input type="checkbox" data-ck="${c.id}"${c.done ? ' checked' : ''}><input type="text" data-ckt="${c.id}" value="${esc(c.text)}"><button class="x" data-ckx="${c.id}" style="border:0;background:none;color:var(--faint)">✕</button></label>`).join('')}
        <div class="check"><span style="width:18px;text-align:center;color:var(--faint)">+</span><input type="text" id="ckNew" placeholder="${t('Pridať krok a stlač Enter')}"></div>
      </div>
      ${!cl.length ? `<button class="btn ghost small" id="ckDefault" style="margin-top:8px">${t('Pridať bežný postup pre video')}</button>` : ''}`;
    const setCl = list => act('setChecklist', { id: p.id, checklist: list });
    $$('[data-ck]', d).forEach(c => c.onchange = () => {
      const list = cl.map(x => x.id === c.dataset.ck ? Object.assign({}, x, { done: c.checked }) : x);
      if (c.checked) FX.sound.pop();
      if (c.checked && list.every(x => x.done)) { const r = c.getBoundingClientRect(); FX.confetti(r.left, r.top, 50); }
      setCl(list);
    });
    $$('[data-ckt]', d).forEach(c => c.onchange = () => setCl(cl.map(x => x.id === c.dataset.ckt ? Object.assign({}, x, { text: c.value }) : x)));
    $$('[data-ckx]', d).forEach(c => c.onclick = e => { e.preventDefault(); setCl(cl.filter(x => x.id !== c.dataset.ckx)); });
    $('#ckNew').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) { setCl(cl.concat([{ id: L.uid(), text: e.target.value.trim(), done: false }])); } };
    const def = $('#ckDefault');
    if (def) def.onclick = () => setCl(['Footage a podklady stiahnuté', 'Hrubý strih', 'Zvuk, hudba a SFX', 'Grafika a titulky', 'Color', 'Preview poslané klientovi', 'Feedback zapracovaný', 'Final odovzdaný'].map(x => ({ id: L.uid(), text: t(x), done: false })));

    // rendery
    $('#dRenders').innerHTML = `
      <div class="sec-h"><h5>${t('Rendery')}</h5><span class="aside">${p.renders.length || ''}</span></div>
      ${p.renders.length ? `<div class="list">${p.renders.map(r => `<div class="li"><span style="color:var(--accent);width:14px;height:14px;flex:none">${ICON.film}</span><span class="grow" title="${esc(r.file)}">${esc(r.name)}</span><span class="dim">${(r.size / 1048576).toFixed(1)} MB, ${L.formatDate(r.at)}</span><button class="x" data-rev="${esc(r.file)}" title="${t('Ukázať v priečinku')}">↗</button><button class="x" data-rmr="${esc(r.file)}" title="${t('Odstrániť zo zoznamu')}">✕</button></div>`).join('')}</div>`
        : `<p class="hint">${p.folder ? t('Keď vyrenderuješ video do 05_Renders alebo 06_Final, objaví sa tu samo.') : t('Vytvor alebo prepoj priečinok a rendery sa sem budú pridávať samé.')}</p>`}`;
    $$('[data-rev]', d).forEach(b => b.onclick = () => act('revealFile', { path: b.dataset.rev }));
    $$('[data-rmr]', d).forEach(b => b.onclick = () => act('removeRender', { id: p.id, file: b.dataset.rmr }));

    // čas
    const sess = S.sessions.filter(s => s.projectId === p.id).slice(-6).reverse();
    $('#dTime').innerHTML = `
      <div class="sec-h"><h5>${t('Čas')}</h5><span class="aside">${t('{time} spolu', { time: L.formatDuration(ms) })}</span></div>
      ${sess.length ? `<div class="list">${sess.map(s => `<div class="li"><span class="grow">${esc(s.app)}</span><span class="dim">${new Date(s.start).toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'numeric' })} ${new Date(s.start).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' })}</span><span class="tc">${L.formatDuration(L.sessionMs(s), true)}</span></div>`).join('')}</div>` : `<p class="hint">${t('Zatiaľ žiadny čas. Otvor projekt v strihacom programe alebo spusti časovač.')}</p>`}
      <div class="d-actions" style="margin:10px 0 0"><div class="suffix" style="width:130px"><input class="input" type="number" min="1" id="manMin" placeholder="${t('Minúty')}" style="padding:6px 34px 6px 10px"><span>min</span></div><button class="btn ghost small" id="manAdd">${t('Pridať čas ručne')}</button></div>`;
    $('#manAdd').onclick = () => { const m = parseFloat($('#manMin').value); if (m > 0) act('addManualSession', { projectId: p.id, minutes: m }); };

    // nápady k zákazke
    ideas.projectBox($('#dIdeas'), p.id);

    // priečinok
    // priečinok: cesta a akcie na jednom mieste (otvoriť / zmeniť, alebo vytvoriť / prepojiť)
    const fb = $('#dFolder');
    fb.innerHTML = p.folder
      ? `<div class="sec-h"><h5>${t('Priečinok')}</h5><button class="btn ghost small" data-f="link">${t('Zmeniť')}</button></div>
         <button class="path path-open" data-f="open" title="${t('Otvoriť priečinok')}"><span class="fo-ic">${ICON.folder}</span><span class="fo-path">${esc(p.folder)}</span></button>`
      : `<div class="sec-h"><h5>${t('Priečinok')}</h5></div><p class="dim small">${t('Táto zákazka zatiaľ nemá priečinok.')}</p>
         <div class="row-btns"><button class="btn small" data-f="mk">${t('Vytvoriť priečinok')}</button><button class="btn ghost small" data-f="link">${t('Prepojiť existujúci')}</button></div>`;
    $$('[data-f]', fb).forEach(b => b.onclick = async () => {
      const k = b.dataset.f;
      if (k === 'open') act('openFolder', { id: p.id });
      if (k === 'link') act('linkFolder', { id: p.id });
      if (k === 'mk') { const dir = await act('createFolder', { id: p.id }); if (dir) toast(t('Priečinok je pripravený.'), { actions: [{ label: t('Otvoriť'), run: () => act('openFolder', { id: p.id }) }] }); }
    });

    // história
    const hist = (p.history || []).slice(-5).reverse();
    $('#dHistory').innerHTML = `<div class="sec-h"><h5>${t('História')}</h5></div>
      <div class="list">${hist.map(h => `<div class="li"><span class="grow">${esc(statusOf(h.from).label)} → <b style="color:${sColor(h.to)}">${esc(statusOf(h.to).label)}</b></span><span class="dim">${new Date(h.at).toLocaleString(I18N.locale(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('')}
      <div class="li"><span class="grow">${t('Vytvorené')}</span><span class="dim">${new Date(p.createdAt).toLocaleString(I18N.locale(), { day: 'numeric', month: 'numeric', year: 'numeric' })}</span></div></div>`;
  }

  function hideModal(clear) {
    const wrap = $('#modalWrap');
    if (wrap.hidden || wrap.classList.contains('closing')) return;
    const m = $('#modal'), btn = $('#addBtn');
    if (m.dataset.morph === 'add' && btn.offsetParent && Polish.canMorph()) {
      delete m.dataset.morph;
      m.style.viewTransitionName = 'woi-sheet';
      Polish.morph(() => {
        m.style.viewTransitionName = ''; wrap.hidden = true; wrap.classList.remove('morphed'); if (clear) m.innerHTML = '';
        btn.style.viewTransitionName = 'woi-sheet';
      }, { cls: 'vt-sheet' }).then(() => { btn.style.viewTransitionName = ''; });
      return;
    }
    delete m.dataset.morph;
    wrap.classList.remove('morphed');
    wrap.classList.add('closing');
    setTimeout(() => { if (!wrap.classList.contains('closing')) return; wrap.hidden = true; wrap.classList.remove('closing'); if (clear) $('#modal').innerHTML = ''; }, 170);
  }

  /* ---------------- nová zákazka ---------------- */
  async function openQuickAdd(opts2) {
    opts2 = opts2 || {};
    const st = S.settings;
    const touched = new Set();
    const wrap = $('#modalWrap'), m = $('#modal');
    const contacts = L.contactTypes(st), types = L.projectTypes(st);
    const clients = L.recentClients(S, 60);
    const exTitle = (S.projects[0] || {}).title;
    m.innerHTML = `
      <h2>${t('Nová zákazka')}</h2>
      <p class="lead">${t('Vlož správu od klienta. Údaje vpravo doplním sám, ty ich len skontroluješ.')}</p>
      <div class="qa">
        <div>
          <div class="paste"><textarea id="qaText" placeholder="${esc(t('Napr.\n\n{client} — dnes o 18:22\nAhoj, spravíš mi intro na YouTube? Budget 40 €, do piatku.', { client: clients[0] || t('Klient') }))}"></textarea><div class="scan" id="qaScan"><i></i></div></div>
          <div class="paste-tools">
            <button class="btn small" id="qaClip">${t('Vložiť zo schránky')}</button>
            ${st.ollamaEnabled ? `<button class="btn ghost small" id="qaAI">${t('Vylepšiť cez AI (Ollama)')}</button>` : ''}
            <span class="hint" id="qaHint" style="margin:0;align-self:center"></span>
          </div>
        </div>
        <div class="fields">
          <div class="field full"><label>${t('Názov projektu')}</label><input data-q="title" placeholder="${esc(exTitle ? t('Napr. {title}', { title: exTitle }) : t('Napr. Intro pre YouTube kanál'))}"></div>
          <div class="field"><label>${t('Klient')}</label><input data-q="client" list="qaClients" autocomplete="off" placeholder="${esc(clients.length ? t('Začni písať, našepkám') : t('Meno alebo prezývka'))}"><datalist id="qaClients">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist><span class="hint qa-known" id="qaKnown"></span></div>
          <div class="field"><label>${t('Kontakt')}</label><select data-q="contact">${opts(contacts, contacts.includes(st.defaultContact) ? st.defaultContact : contacts[0])}</select></div>
          <div class="field"><label>${t('Typ')}</label><select data-q="type">${opts(types, types.includes(st.defaultType) ? st.defaultType : types[0])}</select></div>
          <div class="field"><label>${t('Priorita')}</label><select data-q="priority">${opts(L.PRIORITIES, '')}</select></div>
          <div class="field"><label>${t('Deadline')}</label><input type="date" data-q="deadline"></div>
          <div class="field"><label>${t('Odmena')}</label><div class="suffix"><input type="number" min="0" data-q="reward" placeholder="0"><span>${esc(I18N.currencySymbol())}</span></div></div>
          <div class="field full" id="qaTip"></div>
        </div>
      </div>
      <div class="modal-foot">
        <label class="toggle" title="${st.rootFolder ? esc(st.rootFolder) : t('Najprv nastav hlavný priečinok')}"><input type="checkbox" id="qaFolder"${st.autoCreateFolder && st.rootFolder ? ' checked' : ''}${st.rootFolder ? '' : ' disabled'}>${t('Vytvoriť priečinok')}</label>
        <label class="toggle"><input type="checkbox" id="qaStart">${t('Začať hneď')}</label>
        <span class="grow"></span>
        <button class="btn ghost" id="qaCancel">${t('Zrušiť')}</button>
        <button class="btn primary" id="qaSave">${t('Pridať zákazku')}</button>
      </div>`;
    wrap.classList.remove('closing');
    wrap.hidden = false;
    const text = $('#qaText');
    $$('[data-q]', m).forEach(i => i.addEventListener('input', () => touched.add(i.dataset.q)));
    // stály klient: doplníme kontakt (a typ) podľa jeho poslednej zákazky
    const knownClient = () => {
      const inp = $('[data-q="client"]', m), box = $('#qaKnown', m);
      const k = L.clientDefaults(S, inp.value);
      if (!k) { box.textContent = ''; return; }
      box.textContent = t('Stály klient, {jobs}, naposledy {title} ({date})', { jobs: tp(k.count, '{n} zákazka', '{n} zákazky', '{n} zákaziek'), title: k.last.title, date: L.formatDate(k.last.createdAt) });
      const cs = $('[data-q="contact"]', m), ts = $('[data-q="type"]', m);
      if (!touched.has('contact') && k.contact) { if (![...cs.options].some(o => o.value === k.contact)) cs.add(new Option(tv(k.contact), k.contact)); cs.value = k.contact; }
      if (!touched.has('type') && !typeFromText && k.type && [...ts.options].some(o => o.value === k.type)) ts.value = k.type;
      updateTip();
    };
    let typeFromText = false;
    $('[data-q="client"]', m).addEventListener('input', knownClient);
    $('[data-q="client"]', m).addEventListener('change', knownClient);
    const updateTip = () => {
      const type = $('[data-q="type"]', m).value, rew = parseFloat($('[data-q="reward"]', m).value) || 0;
      const tip = L.priceTip(S, type);
      const box = $('#qaTip', m);
      if (!tip) { box.innerHTML = ''; return; }
      const low = rew && rew < tip.suggest * 0.8;
      box.innerHTML = `<div class="tip${low ? ' warn' : ''}" style="margin-top:0"><b>${low ? t('Je to menej ako zvyčajne') : t('Cenový tip')}</b>${t('Za {type} si pýtal zvyčajne <b>{money}</b>{hours}.', { type: esc(tv(type)), money: L.formatMoney(tip.medReward), hours: tip.medHours ? t(' a robil si ~{time}', { time: L.formatDuration(tip.medHours * 3600000) }) : '' })}${tip.byTime ? t(' Pri cieli {goal} aspoň <b>{money}</b>.', { goal: L.formatMoney(tip.goal) + '/' + t('hod'), money: L.formatMoney(tip.byTime) }) : ''}</div>`;
    };
    $$('[data-q="type"], [data-q="reward"]', m).forEach(i => { i.addEventListener('input', updateTip); i.addEventListener('change', updateTip); });
    setTimeout(updateTip, 0);

    let lastFound = '';
    const apply = (res, animate) => {
      const found = [];
      for (const [k, v] of Object.entries(res.fields || {})) {
        const inp = $(`[data-q="${k}"]`, m);
        if (!inp || touched.has(k) || v == null || v === '') continue;
        if (inp.tagName === 'SELECT' && ![...inp.options].some(o => o.value === v)) continue;
        if (String(inp.value) !== String(v)) { inp.value = v; found.push(k); }
      }
      typeFromText = !!(res.fields && res.fields.type);
      if (res.fields && res.fields.client) knownClient();
      if (animate && found.length) {
        const scan = $('#qaScan'); scan.classList.remove('go'); void scan.offsetWidth; scan.classList.add('go');
        found.forEach((k, i) => setTimeout(() => {
          const f = $(`[data-q="${k}"]`, m).closest('.field');
          f.classList.remove('found'); void f.offsetWidth; f.classList.add('found');
        }, 120 + i * 110));
        FX.sound.pop();
      }
      const n = (res.found || []).filter(k => k !== 'contact').length;
      const key = (res.found || []).join();
      updateTip && updateTip();
      if (key !== lastFound) $('#qaHint').textContent = (n ? tp(n, 'Našiel som {n} údaj.', 'Našiel som {n} údaje.', 'Našiel som {n} údajov.') : (text.value.trim() ? t('Nič som nenašiel, vyplň to ručne.') : '')) + (res.fields && res.fields.rewardNote ? ' ' + res.fields.rewardNote : '');
      lastFound = key;
    };
    let parseT;
    text.addEventListener('input', () => {
      clearTimeout(parseT);
      parseT = setTimeout(() => apply(L.parseMessage(text.value), true), 260);
    });
    $('#qaClip').onclick = async () => {
      const c = await act('readClipboard');
      if (c) { text.value = c; apply(L.parseMessage(c), true); }
    };
    const ai = $('#qaAI');
    if (ai) ai.onclick = async () => {
      if (!text.value.trim()) return;
      ai.disabled = true; ai.textContent = t('Premýšľam…');
      try {
        const res = await act('aiParse', { text: text.value });
        apply(res, true);
        if (res.fields.summary) text.value = text.value.trim() + '\n\n— ' + t('Zhrnutie') + ': ' + res.fields.summary;
      } catch (e) { } finally { ai.disabled = false; ai.textContent = t('Vylepšiť cez AI (Ollama)'); }
    };
    const close = () => hideModal(true);
    $('#qaCancel').onclick = close;
    const save = async () => {
      const fields = {};
      $$('[data-q]', m).forEach(i => { fields[i.dataset.q] = i.dataset.q === 'reward' ? (parseFloat(i.value) || 0) : i.value.trim(); });
      if (!fields.title) fields.title = (tv(fields.type) || t('Zákazka')) + (fields.client ? t(' pre {client}', { client: fields.client }) : '');
      fields.notes = text.value.trim();
      if ($('#qaStart').checked) fields.status = 'working';
      fields.contactFromUser = true;
      if (opts2.folder) fields.folder = opts2.folder;
      const id = await act('createProject', { fields, createFolder: !opts2.folder && $('#qaFolder').checked });
      if (opts2.claimName) act('claimSessionsByName', { name: opts2.claimName, id, fromId: opts2.fromId || null }).then(n => { if (n) toast(t('Priradil som aj {entries} času z {app}.', { entries: tp(n, '{n} záznam', '{n} záznamy', '{n} záznamov'), app: esc(opts2.app || t('editora')) })); });
      if ($('#qaStart').checked) act('setFocus', { id });
      close();
      FX.sound.done();
      cheer(1800);
      const r = $('#addBtn').getBoundingClientRect();
      FX.confetti(r.left + r.width / 2, r.bottom, 40);
      toast(t('Pridané: <b>{title}</b>', { title: esc(fields.title) }), { actions: [{ label: t('Otvoriť'), run: () => openDrawer(id) }] });
    };
    $('#qaSave').onclick = save;
    m.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); };
    text.focus();

    // predvyplnenie (zo spotlightu alebo z editora)
    if (opts2.text) { text.value = opts2.text; apply(L.parseMessage(opts2.text), true); }
    if (opts2.prefill) {
      for (const [k, v] of Object.entries(opts2.prefill)) { const inp = $(`[data-q="${k}"]`, m); if (inp && v) { inp.value = v; touched.add(k); } }
      if (opts2.prefill.status === 'working') $('#qaStart').checked = true;
      if (opts2.folder) { const f = $('#qaFolder'); f.checked = false; f.disabled = true; f.parentElement.title = opts2.folder; f.parentElement.lastChild.textContent = t('Priečinok: {name}', { name: opts2.folder.split(/[\\/]/).pop() }); }
      $('#qaHint').textContent = opts2.hint || '';
      $(`[data-q="client"]`, m).focus();
    }
    if (opts2.fromClipboard !== false && !opts2.text && !opts2.prefill) {
      try {
        const c = await api.action('readClipboard');
        const res = c ? L.parseMessage(c) : null;
        if (res && res.found.filter(k => ['client', 'reward', 'deadline', 'type'].includes(k)).length >= 2 && c.length < 4000) {
          text.value = c; apply(res, true);
          $('#qaHint').textContent = t('Vložil som správu zo schránky.');
        }
      } catch (e) { }
    }
  }
  // tlačidlo „Nová zákazka“ sa premení na okno (a pri zatvorení späť)
  $('#addBtn').addEventListener('click', () => {
    const btn = $('#addBtn');
    if (!Polish.canMorph() || !$('#modalWrap').hidden) { openQuickAdd(); return; }
    btn.style.viewTransitionName = 'woi-sheet';
    Polish.morph(async () => {
      btn.style.viewTransitionName = '';
      $('#modalWrap').classList.add('morphed');
      await openQuickAdd();
      const m = $('#modal'); m.style.viewTransitionName = 'woi-sheet'; m.dataset.morph = 'add';
    }, { cls: 'vt-sheet' }).then(() => { $('#modal').style.viewTransitionName = ''; });
  });
  $('#modalWrap').addEventListener('pointerdown', e => { if (e.target.id === 'modalWrap') hideModal(); });

  /* ---------------- časová os ---------------- */
  function renderTimeline() { timeline.render($('#view-timeline')); }

  /* ---------------- čas ---------------- */
  function renderTime() {
    const root = $('#view-time');
    const now = Date.now();
    const today = L.startOfDay(now), week = L.startOfWeek(now);
    const todayMs = L.msBetween(S, today, now + 1);
    const weekMs = L.msBetween(S, week, now + 1);
    const lastWeekMs = L.msBetween(S, new Date(+week - 7 * L.DAY), week);
    const byProj = {};
    for (const s of S.sessions) if (s.projectId && Date.parse(s.start) >= +week) byProj[s.projectId] = (byProj[s.projectId] || 0) + L.sessionMs(s);
    const top = Object.entries(byProj).sort((a, b) => b[1] - a[1])[0];
    const topP = top && project(top[0]);
    const streak = L.streak(S);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = new Date(week); d.setDate(d.getDate() + i); const e = new Date(d); e.setDate(e.getDate() + 1); days.push({ d, ms: L.msBetween(S, d, e) }); }
    const maxDay = Math.max(3600000, ...days.map(x => x.ms));
    const apps = {};
    for (const s of S.sessions) if (Date.parse(s.start) >= now - 30 * L.DAY) apps[s.app] = (apps[s.app] || 0) + L.sessionMs(s);
    const appList = Object.entries(apps).sort((a, b) => b[1] - a[1]);
    const maxApp = appList.length ? appList[0][1] : 1;
    const APPC = { 'DaVinci Resolve': 'var(--accent)', 'Premiere Pro': 'var(--lilac)', 'After Effects': 'var(--pink)', 'Časovač': 'var(--amber)', 'Ručne': 'var(--mint)', Blender: 'var(--amber)' };
    const unassigned = S.sessions.filter(s => !s.projectId && s.end).slice(-30).reverse();
    const loose = S.looseRenders || [];
    const activeOpts = `<option value="">${t('Priradiť k…')}</option>` + S.projects.filter(p => p.status !== 'done' || Date.parse(p.doneAt || 0) > now - 21 * L.DAY).map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
    const groups = {};
    for (const s of S.sessions.slice().reverse()) {
      if (Date.parse(s.start) < now - 14 * L.DAY) break;
      const k = L.dayKey(Date.parse(s.start));
      (groups[k] = groups[k] || []).push(s);
    }
    const diff = weekMs - lastWeekMs;
    root.innerHTML = `
      <div class="stats">
        <div class="stat accent"><div class="k">${t('Dnes')}</div><div class="v tc">${L.timecode(todayMs).slice(0, 8)}</div><div class="s">${L.formatDuration(todayMs)}</div></div>
        <div class="stat"><div class="k">${t('Tento týždeň')}</div><div class="v">${L.formatDuration(weekMs, true)}</div><div class="s">${lastWeekMs ? t('{diff} oproti minulému', { diff: (diff >= 0 ? '+' : '−') + L.formatDuration(Math.abs(diff)) }) : t('Minulý týždeň bez záznamu')}</div></div>
        <div class="stat"><div class="k">${t('Najviac času na')}</div><div class="v" style="font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${topP ? esc(topP.title) : '—'}</div><div class="s">${top ? t('{time} tento týždeň', { time: L.formatDuration(top[1]) }) : t('Zatiaľ nič')}</div></div>
        <div class="stat"><div class="k">${t('Séria')}</div><div class="v">${streak} ${L.plural(streak, 'deň', 'dni', 'dní')}</div><div class="s">${t('Dni s aspoň 10 minútami práce')}</div></div>
      </div>
      ${unassigned.length ? `<div class="box inbox" style="margin-bottom:14px"><h3>${t('Čas bez projektu')} <span class="aside">${L.formatDuration(unassigned.reduce((a, s) => a + L.sessionMs(s), 0))}</span></h3>
        <div class="list">${unassigned.map(s => `<div class="li"><span class="grow" title="${esc(s.title || '')}"><b style="font-weight:600">${esc(tv(s.app))}</b> <span class="dim">${esc(s.title || '')}</span></span><span class="dim">${new Date(s.start).toLocaleString(I18N.locale(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span><span class="tc">${L.formatDuration(L.sessionMs(s), true)}</span><select data-assign="${s.id}">${activeOpts}</select><button class="x" data-del="${s.id}" title="${t('Zahodiť')}">✕</button></div>`).join('')}</div>
        <p class="hint">${t('Keď vyberieš projekt, priradím k nemu aj ostatné záznamy s rovnakým názvom okna.')}</p></div>` : ''}
      ${loose.length ? `<div class="box inbox" style="margin-bottom:14px"><h3>${t('Rendery bez projektu')}</h3><div class="list">${loose.map(r => `<div class="li"><span class="grow" title="${esc(r.file)}">${esc(r.name)}</span><span class="dim">${(r.size / 1048576).toFixed(1)} MB</span><select data-loose="${esc(r.file)}">${activeOpts}</select><button class="x" data-loosex="${esc(r.file)}">✕</button></div>`).join('')}</div></div>` : ''}
      <div class="grid2">
        <div class="box"><h3>${t('Tento týždeň')}</h3><div class="week">${days.map(x => `<div class="d${+x.d === +today ? ' today' : ''}"><small>${t(['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'][(x.d.getDay() + 6) % 7])}</small><div class="fill"><i style="height:${Math.round(x.ms / maxDay * 100)}%"></i></div><b>${x.ms ? L.formatDuration(x.ms, true) : '–'}</b></div>`).join('')}</div></div>
        <div class="box"><h3>${t('Programy')} <span class="aside">${t('posledných 30 dní')}</span></h3>${appList.length ? `<div class="apps">${appList.map(([a, ms]) => `<div class="app-row" style="--c:${APPC[a] || 'var(--accent)'}"><span>${esc(tv(a))}</span><div class="track"><i style="width:${Math.round(ms / maxApp * 100)}%"></i></div><span class="t">${L.formatDuration(ms, true)}</span></div>`).join('')}</div>` : `<p class="hint">${PLATFORM === 'win32' ? t('Otvor DaVinci, Premiere alebo After Effects a začnem merať.') : t('Automatické meranie funguje vo Windows appke.')}</p>`}</div>
      </div>
      <div class="box" style="margin-top:14px"><h3>${t('Záznamy')} <span class="aside">${t('posledných 14 dní')}</span></h3>
        ${Object.keys(groups).length ? Object.entries(groups).map(([k, list]) => `<div class="day-group"><h4>${new Date(k + 'T12:00:00').toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' })}<span>${L.formatDuration(list.reduce((a, s) => a + L.sessionMs(s), 0), true)}</span></h4><div class="list">${list.map(s => `<div class="li"><span class="dim tc" style="color:var(--muted)">${new Date(s.start).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' })}–${s.end ? new Date(s.end).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) : t('teraz')}</span><span class="grow">${s.projectId && project(s.projectId) ? `<b style="font-weight:600;color:${sColor(project(s.projectId).status)}">${esc(project(s.projectId).title)}</b>` : `<span style="color:var(--amber)">${t('Bez projektu')}</span>`} <span class="dim">${esc(tv(s.app))}</span></span><span class="tc">${L.formatDuration(L.sessionMs(s), true)}</span><button class="x" data-del="${s.id}" title="${t('Zmazať záznam')}">✕</button></div>`).join('')}</div></div>`).join('') : `<p class="hint">${t('Zatiaľ žiadne záznamy.')}</p>`}
      </div>`;
    $$('[data-assign]', root).forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      const n = await act('assignSimilar', { sessionId: sel.dataset.assign, projectId: sel.value });
      toast(n > 1 ? tp(n, 'Priradil som {n} záznam.', 'Priradil som {n} záznamy.', 'Priradil som {n} záznamov.') : t('Priradené.'));
    });
    $$('[data-del]', root).forEach(b => b.onclick = () => act('deleteSession', { sessionId: b.dataset.del }));
    $$('[data-loose]', root).forEach(sel => sel.onchange = () => sel.value && act('assignLooseRender', { file: sel.dataset.loose, projectId: sel.value }));
    $$('[data-loosex]', root).forEach(b => b.onclick = () => act('dismissLooseRender', { file: b.dataset.loosex }));
  }

  /* ---------------- archív ---------------- */
  let archQ = '', archClient = '', archType = '';
  function renderArchive() {
    const root = $('#view-archive');
    const all = archived().sort((a, b) => (b.doneAt || b.updatedAt || '').localeCompare(a.doneAt || a.updatedAt || ''));
    if (!all.length) {
      root.innerHTML = `<div class="empty"><h2>${t('Archív je zatiaľ prázdny')}</h2><p>${t('Hotové zákazky sa sem presunú samé {n} {d} po dokončení. Dovtedy ich vidíš na nástenke v stĺpci Hotovo.', { n: S.settings.archiveAfterDays, d: L.plural(+S.settings.archiveAfterDays, 'deň', 'dni', 'dní') })}</p></div>`;
      return;
    }
    const q = L.normalize(archQ);
    const list = all.filter(p => (!q || L.normalize(p.title + ' ' + p.client + ' ' + p.notes).includes(q)) && (!archClient || p.client === archClient) && (!archType || p.type === archType));
    const clients = Array.from(new Set(all.map(p => p.client).filter(Boolean))).sort();
    const types = Array.from(new Set(all.map(p => p.type))).sort();
    const sumPaid = list.reduce((a, p) => a + L.paidOf(p), 0);
    const sumMs = list.reduce((a, p) => a + L.projectMs(S, p.id), 0);
    const onTime = list.filter(p => p.deadline && p.doneAt && L.dayKey(Date.parse(p.doneAt)) <= p.deadline).length;
    const withDl = list.filter(p => p.deadline).length;
    const groups = {};
    for (const p of list) { const d = new Date(p.doneAt || p.updatedAt || p.createdAt); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); (groups[k] = groups[k] || []).push(p); }
    root.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="k">${t('Hotových zákaziek')}</div><div class="v">${list.length}</div><div class="s">${archClient || archType || archQ ? t('podľa filtra') : t('celkovo v archíve')}</div></div>
        <div class="stat good"><div class="k">${t('Zaplatené')}</div><div class="v">${L.formatMoney(sumPaid)}</div><div class="s">${sumMs > 0 && sumPaid ? L.formatMoney(Math.round(sumPaid / (sumMs / 3600000) * 10) / 10) + ' / ' + t('hod') : ''}</div></div>
        <div class="stat"><div class="k">${t('Odpracované')}</div><div class="v">${L.formatDuration(sumMs, true)}</div><div class="s">${list.length ? t('priemerne {time} na zákazku', { time: L.formatDuration(sumMs / list.length) }) : ''}</div></div>
        <div class="stat"><div class="k">${t('Načas')}</div><div class="v">${withDl ? Math.round(onTime / withDl * 100) + ' %' : '—'}</div><div class="s">${withDl ? t('{a} z {b} s deadlinom', { a: onTime, b: withDl }) : t('bez deadlinov')}</div></div>
      </div>
      <div class="arch-tools">
        <label class="search">${ICON.search}<input id="archQ" placeholder="${t('Hľadať v archíve (aj v zadaní)')}" value="${esc(archQ)}"></label>
        <select id="archClient"><option value="">${t('Všetci klienti')}</option>${clients.map(c => `<option${c === archClient ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select id="archType"><option value="">${t('Všetky typy')}</option>${types.map(c => `<option value="${esc(c)}"${c === archType ? ' selected' : ''}>${esc(tv(c))}</option>`).join('')}</select>
      </div>
      <div class="arch-row arch-head"><span>${t('Zákazka')}</span><span>${t('Klient')}</span><span>${t('Hotové')}</span><span class="r">${t('Čas')}</span><span class="r">${t('Peniaze')}</span><span class="r">${esc(L.perHour())}</span></div>
      ${Object.entries(groups).map(([k, items]) => {
        const [y, m] = k.split('-');
        return `<div class="arch-month"><h4>${new Date(+y, +m - 1, 1).toLocaleDateString(I18N.locale(), { month: 'long', year: 'numeric' })}<span>${t('{jobs}, {money}', { jobs: tp(items.length, '{n} zákazka', '{n} zákazky', '{n} zákaziek'), money: L.formatMoney(items.reduce((a, p) => a + L.paidOf(p), 0)) })}</span></h4>
          ${items.map(p => { const ms = L.projectMs(S, p.id), paid = L.paidOf(p), owed = L.owedOf(p);
            return `<div class="arch-row" data-open="${p.id}"><b>${esc(p.title)}<span class="dim" style="font-weight:400">, ${esc(tv(p.type))}</span></b><span class="dim">${esc(p.client || '—')}</span><span class="dim">${p.status === 'done' ? L.formatDate(p.doneAt) : `<span style="color:${sColor(p.status)}">${esc(statusOf(p.status).label)}</span>`}</span><span class="r dim">${ms > 60000 ? L.formatDuration(ms, true) : '—'}</span><span class="r" style="color:${owed ? 'var(--amber)' : 'var(--text)'}">${p.reward ? L.formatMoney(paid) + (owed ? ' / ' + L.formatMoney(p.reward) : '') : '—'}</span><span class="r dim">${ms > 15 * 60000 && paid ? L.formatMoney(Math.round(paid / (ms / 3600000) * 10) / 10) : '—'}</span></div>`; }).join('')}</div>`;
      }).join('') || `<p class="hint">${t('Nič nesedí na filter.')}</p>`}`;
    const qi = $('#archQ');
    qi.oninput = () => { archQ = qi.value; const pos = qi.selectionStart; renderArchive(); const n = $('#archQ'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#archClient').onchange = e => { archClient = e.target.value; renderArchive(); };
    $('#archType').onchange = e => { archType = e.target.value; renderArchive(); };
    $$('[data-open]', root).forEach(r => {
      r.onclick = () => openDrawer(r.dataset.open, r);
      r.oncontextmenu = e => { e.preventDefault(); projectMenu(r.dataset.open, { x: e.clientX, y: e.clientY }); };
    });
  }

  /* ---------------- klienti ---------------- */
  let clientSel = null;
  function openClient(key) { clientSel = key; go('clients'); }
  function avatar(name, size) {
    let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const ini = String(name || '?').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    return `<span class="ava" style="--h:${h};width:${size || 44}px;height:${size || 44}px;font-size:${Math.round((size || 44) * 0.38)}px">${esc(ini)}</span>`;
  }
  function payBadge(c) {
    if (c.owed > 0) return `<span class="badge warn">${t('Dlhuje {money}', { money: L.formatMoney(c.owed) })}</span>`;
    if (c.avgPayDays == null) return '';
    if (c.avgPayDays <= 2) return `<span class="badge good">${t('Platí hneď')}</span>`;
    if (c.avgPayDays <= 7) return `<span class="badge">${t('Platí do {n} {d}', { n: Math.ceil(c.avgPayDays), d: L.plural(Math.ceil(c.avgPayDays), 'dňa', 'dní', 'dní') })}</span>`;
    return `<span class="badge warn">${t('Platí pomaly (~{n} dní)', { n: Math.round(c.avgPayDays) })}</span>`;
  }
  function renderClients() {
    const root = $('#view-clients');
    const list = L.clientStats(S);
    if (clientSel) {
      const c = list.find(x => x.key === clientSel);
      if (!c) { clientSel = null; return renderClients(); }
      const m = c.meta || {};
      const projs = c.projects.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const dec1 = x => x.toLocaleString(I18N.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      root.innerHTML = `<button class="btn ghost small" id="clBack">${t('← Všetci klienti')}</button>
        <div class="cl-head">${avatar(c.name, 72)}<div><h2>${esc(c.name)}</h2><p>${t('{jobs}, od {date}, {contacts}', { jobs: tp(c.count, '{n} zákazka', '{n} zákazky', '{n} zákaziek'), date: L.formatDate(new Date(c.first).toISOString()), contacts: esc(c.contacts.map(tv).join(', ') || t('bez kontaktu')) })}</p><div class="badges">${payBadge(c)}${c.avgRevisions != null && c.avgRevisions >= 2 ? `<span class="badge warn">${t('Veľa úprav (~{n} kola)', { n: dec1(c.avgRevisions) })}</span>` : ''}${c.hourly && c.hourly >= (S.settings.hourlyGoal || 15) ? `<span class="badge good">${t('Oplatí sa')}</span>` : ''}</div></div>
          <span class="grow"></span><button class="btn primary" id="clNew">${t('Nová zákazka pre {name}', { name: esc(c.name) })}</button></div>
        <div class="stats">
          <div class="stat good"><div class="k">${t('Zaplatil spolu')}</div><div class="v">${L.formatMoney(c.paid)}</div><div class="s">${c.pipeline ? t('{money} ešte v rozrobených', { money: L.formatMoney(c.pipeline) }) : ''}</div></div>
          <div class="stat"><div class="k">${t('Reálne za hodinu')}</div><div class="v">${c.hourly ? L.formatMoney(Math.round(c.hourly * 10) / 10) : '—'}</div><div class="s">${t('{time} odpracovaných', { time: L.formatDuration(c.ms) })}</div></div>
          <div class="stat"><div class="k">${t('Platí za')}</div><div class="v">${c.avgPayDays != null ? (c.avgPayDays < 1 ? t('hneď') : t('{n} d', { n: Math.round(c.avgPayDays) })) : '—'}</div><div class="s">${t('priemerne po odovzdaní')}</div></div>
          <div class="stat"><div class="k">${t('Kolá úprav')}</div><div class="v">${c.avgRevisions != null ? dec1(c.avgRevisions) : '—'}</div><div class="s">${t('priemerne na zákazku')}</div></div>
        </div>
        <div class="grid2">
          <div class="box"><h3>${t('Zákazky')}</h3><div class="list">${projs.map(p => `<div class="li cl-proj" data-open="${p.id}" style="cursor:pointer"><i style="width:8px;height:8px;border-radius:50%;background:${sColor(p.status)};box-shadow:0 0 8px ${sColor(p.status)}"></i><span class="grow"><b style="font-weight:700">${esc(p.title)}</b><span class="dim">, ${esc(tv(p.type))}</span></span><span class="dim">${L.formatDate(p.createdAt)}</span><b>${p.reward ? L.formatMoney(p.reward) : ''}</b></div>`).join('')}</div></div>
          <div class="box"><h3>${t('Poznámky o klientovi')}</h3>
            <div class="field"><label>${t('Discord / e-mail / odkaz')}</label><input id="clHandle" value="${esc(m.handle || '')}" placeholder="${t('napr. @nick na Discorde alebo e-mail')}"></div>
            <div class="field" style="margin-top:10px"><label>${t('Čo si o ňom pamätať')}</label><textarea id="clNotes" rows="8" placeholder="${t('Má rád rýchle strihy, platí cez PayPal, vždy chce 2 verzie…')}">${esc(m.notes || '')}</textarea></div>
            <p class="hint">${t('Typy: {list}', { list: Object.entries(c.types).map(([ty, n]) => esc(tv(ty)) + ' ' + n + '×').join(', ') })}</p>
          </div>
        </div>`;
      $('#clBack').onclick = () => { clientSel = null; renderClients(); renderHeader(); };
      $('#clNew').onclick = () => openQuickAdd({ prefill: { client: c.name, contact: c.contacts[0] || 'Discord DM' }, hint: t('Nová zákazka pre {name}.', { name: c.name }) });
      const save = () => act('updateClient', { key: c.key, patch: { handle: $('#clHandle').value, notes: $('#clNotes').value } });
      $('#clHandle').onchange = save; $('#clNotes').onchange = save;
      $$('[data-open]', root).forEach(r => { r.onclick = () => openDrawer(r.dataset.open, r); r.oncontextmenu = e => { e.preventDefault(); projectMenu(r.dataset.open, { x: e.clientX, y: e.clientY }); }; });
      return;
    }
    if (!list.length) { root.innerHTML = `<div class="empty"><h2>${t('Zatiaľ žiadni klienti')}</h2><p>${t('Klienti sa sem pridajú sami, keď pri zákazke vyplníš meno klienta.')}</p></div>`; return; }
    root.innerHTML = `<div class="cl-grid">${list.map(c => `<button class="cl-card" data-key="${esc(c.key)}">
        ${avatar(c.name)}
        <span class="cl-tx"><b>${esc(c.name)}</b><small>${tp(c.count, '{n} zákazka', '{n} zákazky', '{n} zákaziek')}, ${L.formatMoney(c.paid)}${c.hourly ? ', ' + L.formatMoney(Math.round(c.hourly)) + '/h' : ''}</small><span class="badges">${payBadge(c)}</span></span>
      </button>`).join('')}</div>`;
    $$('[data-key]', root).forEach(b => b.onclick = () => { clientSel = b.dataset.key; renderClients(); renderHeader(); });
  }

  /* ---------------- profil: level, odznaky, recapy ---------------- */
  function renderProfile() {
    const root = $('#view-profile');
    const xp = L.xpOf(S), lv = L.levelOf(xp);
    const ach = L.achievementsState(S);
    const got = ach.filter(a => a.ok).length;
    const months = [];
    const first = S.sessions.length ? Math.min(...S.sessions.map(x => Date.parse(x.start))) : Date.now();
    const d = new Date(); d.setDate(1);
    for (let i = 0; i < 12; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); if (+new Date(m.getFullYear(), m.getMonth() + 1, 1) < first) break; months.push(m); }
    root.innerHTML = `
      <div class="prof-hero">
        <div class="mascot" id="profKit"></div>
        <div class="grow"><div class="lvl-big">Lvl ${lv.level}</div><div class="lvl-name">${esc(L.levelTitle(lv.level, S.settings.brand))}</div>
          <div class="xpbar big"><i style="width:${Math.round(lv.pct * 100)}%"></i></div>
          <div class="hint">${t('{into} / {need} XP do ďalšieho levelu. XP dostávaš za odpracované hodiny (10 XP/h), dokončené zákazky (+50, načas +25) a rendery (+5).', { into: lv.into, need: lv.need })}</div></div>
      </div>
      <div class="box" id="wardrobe"></div>
      <div class="box" style="margin-top:14px"><h3>${t('Odznaky')} <span class="aside">${got} / ${ach.length}</span></h3>
        <div class="badge-grid">${ach.map(a => `<div class="ach${a.ok ? ' ok' : ''}" title="${esc(a.desc)}"><span class="ach-ic">${a.ok ? a.icon : '🔒'}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>${a.ok && a.at ? `<small class="ach-at">${L.formatDate(a.at)}</small>` : ''}</div>`).join('')}</div>
      </div>
      <div class="box" style="margin-top:14px"><h3>${t('Mesačné recapy')}</h3>
        <div class="recap-list">${months.map((m, i) => `<button class="recap-btn" data-y="${m.getFullYear()}" data-m="${m.getMonth()}"><b>${m.toLocaleDateString(I18N.locale(), { month: 'long' })}</b><small>${m.getFullYear()}${i === 0 ? t(', zatiaľ') : ''}</small></button>`).join('') || `<p class="hint">${t('Recap sa objaví po prvom odmeranom čase.')}</p>`}</div>
      </div>`;
    Mascot.mount($('#profKit'));
    renderWardrobe();
    $$('[data-y]', root).forEach(b => b.onclick = () => openRecap(+b.dataset.y, +b.dataset.m));
  }

  /* ---------------- šablóny ---------------- */
  let tplProg = 'resolve', tplQ = '', tplDuration = 60;
  const folderCache = {};
  async function renderTemplates() {
    const root = $('#view-templates');
    const prog = TPL.PROGRAMS.find(x => x.id === tplProg);
    const folders = (S.settings.templateFolders || {})[tplProg] || [];
    const snippets = TPL.SNIPPETS.filter(x => x.program === tplProg).map(x => Object.assign({ builtin: true }, x))
      .concat((S.snippets || []).filter(x => (x.program || 'other') === tplProg));
    const q = L.normalize(tplQ);
    root.innerHTML = `
      <div class="tpl-tabs">${TPL.PROGRAMS.map(pr => `<button class="tpl-tab${pr.id === tplProg ? ' on' : ''}" data-prog="${pr.id}" style="--c:${pr.color}"><i></i>${esc(pr.name)}</button>`).join('')}
        <label class="search" style="margin-left:auto">${ICON.search}<input id="tplQ" placeholder="${t('Hľadať v šablónach a snippetoch')}" value="${esc(tplQ)}"></label></div>

      <div class="box" style="--c:${prog.color}"><h3>${t('Moje súbory')} <span class="aside">${folders.length ? tp(folders.length, '{n} priečinok', '{n} priečinky', '{n} priečinkov') : ''}</span></h3>
        ${folders.length ? folders.map((f, i) => `<div class="tpl-folder" data-fi="${i}"><div class="tpl-fhead"><b>${esc(f.split(/[\\/]/).pop())}</b><span class="path">${esc(f)}</span><span class="grow"></span><button class="btn ghost small" data-fopen="${esc(f)}">${t('Otvoriť')}</button><button class="btn ghost small" data-frm="${esc(f)}">${t('Odobrať')}</button></div><div class="tpl-files" id="tplf-${i}"><p class="hint">${t('Načítavam…')}</p></div></div>`).join('')
          : `<p class="hint" style="margin-top:-4px">${t('Pridaj priečinok, kde máš veci pre {app}. Napríklad:', { app: esc(prog.name) })}</p><ul class="tpl-ideas">${TPL.IDEAS[tplProg].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}
        <div class="row-btns"><button class="btn small" id="tplAdd">${t('+ Pridať priečinok')}</button>${tplProg !== 'other' ? `<button class="btn ghost small" id="tplSuggest">${t('Nájsť štandardné priečinky')}</button>` : ''}</div>
        <p class="hint">${t('Klik na súbor = otvoriť, pravý klik = skopírovať do zákazky, ukázať v priečinku…')}</p>
      </div>

      <div class="box" style="margin-top:14px"><h3>${t('Snippety')} <span class="aside">${tplProg === 'ae' ? 'expressions' : tplProg === 'resolve' ? t('Fusion a konzola') : ''}</span></h3>
        <div class="snip-grid">${snippets.filter(x => !q || L.normalize(x.title + ' ' + x.note + ' ' + x.code).includes(q)).map(x => `<div class="snip"><div class="snip-h"><b>${esc(x.title)}</b>${x.builtin ? '' : `<span class="badge">${t('tvoj')}</span>`}<span class="grow"></span><button class="btn small" data-copy="${esc(x.id)}">${t('Kopírovať')}</button>${x.builtin ? '' : `<button class="btn ghost small" data-sdel="${esc(x.id)}">✕</button>`}</div>${x.note ? `<small>${esc(x.note)}</small>` : ''}<pre>${esc(x.code)}</pre></div>`).join('') || `<p class="hint">${t('Zatiaľ tu nič nie je. Pridaj vlastný snippet alebo si ho nechaj napísať od Kita a ulož ho z chatu.')}</p>`}</div>
        <details class="snip-add"><summary>${t('+ Pridať vlastný snippet')}</summary>
          <div class="fields" style="margin-top:10px"><div class="field"><label>${t('Názov')}</label><input id="snTitle" placeholder="${t('Napr. Glitch na text')}"></div><div class="field"><label>${t('Poznámka')}</label><input id="snNote" placeholder="${t('Kam to dať, čo meniť')}"></div>
          <div class="field full"><label>${t('Kód / text')}</label><textarea id="snCode" rows="5" style="font-family:var(--tc);font-size:12.5px"></textarea></div></div>
          <button class="btn primary small" id="snSave" style="margin-top:10px">${t('Uložiť do {app}', { app: esc(prog.short) })}</button>
        </details>
        <div class="row-btns"><button class="btn ghost small" id="snAsk">${t('Nechať {name} napísať snippet', { name: esc(L.decl(S.settings.mascotName, 'gen')) })}</button></div>
      </div>

      <div class="box" style="margin-top:14px"><h3>${t('Export presety')}</h3>
        <p class="hint" style="margin:-4px 0 12px">${esc(TPL.WHERE[tplProg])}</p>
        <div class="exp-grid">${TPL.EXPORTS.map(e => `<div class="exp"><b>${esc(e.name)}</b>
          <dl><dt>${t('Rozlíšenie')}</dt><dd>${esc(e.size)}</dd><dt>FPS</dt><dd>${esc(e.fps)}</dd><dt>Bitrate</dt><dd>${esc(e.bitrate)}</dd><dt>${t('Zvuk')}</dt><dd>${esc(e.audio)}</dd></dl>
          <small>${esc(e.note)}</small>
          ${e.calc ? `<div class="calc"><label>${t('Dĺžka videa')} <input type="number" id="calcDur" min="1" value="${tplDuration}"> s</label><div id="calcOut"></div></div>` : ''}</div>`).join('')}</div>
      </div>`;

    $$('[data-prog]', root).forEach(b => b.onclick = () => { tplProg = b.dataset.prog; renderTemplates(); });
    const qi = $('#tplQ'); qi.oninput = () => { tplQ = qi.value; const pos = qi.selectionStart; renderTemplates().then(() => { const n = $('#tplQ'); n.focus(); n.setSelectionRange(pos, pos); }); };
    $('#tplAdd').onclick = () => act('addTemplateFolder', { program: tplProg });
    const sg = $('#tplSuggest'); if (sg) sg.onclick = async () => { const n = await act('suggestTemplateFolders'); toast(n ? tp(n, 'Pridal som {n} priečinok.', 'Pridal som {n} priečinky.', 'Pridal som {n} priečinkov.') : t('Štandardné priečinky som nenašiel. Pridaj ich ručne.')); };
    $$('[data-fopen]', root).forEach(b => b.onclick = () => act('openPath', { path: b.dataset.fopen }));
    $$('[data-frm]', root).forEach(b => b.onclick = () => act('removeTemplateFolder', { program: tplProg, path: b.dataset.frm }));
    $$('[data-copy]', root).forEach(b => b.onclick = () => { const sn = snippets.find(x => x.id === b.dataset.copy); act('writeClipboard', { text: sn.code }); toast(t('Skopírované. Vlož to do {app}.', { app: prog.short }), { icon: '📋' }); FX.sound.pop(); });
    $$('[data-sdel]', root).forEach(b => b.onclick = () => act('deleteSnippet', { id: b.dataset.sdel }));
    $('#snSave').onclick = () => {
      const code = $('#snCode').value.trim(); if (!code) return;
      act('saveSnippet', { snippet: { program: tplProg, title: $('#snTitle').value.trim() || 'Snippet', note: $('#snNote').value.trim(), code } }).then(() => toast(t('Snippet uložený.')));
    };
    $('#snAsk').onclick = () => chat.open({ projectId: '', q: t('Napíš mi užitočný snippet pre {app}{kind}. Najprv sa ma krátko spýtaj, čo presne potrebujem.', { app: prog.name, kind: tplProg === 'ae' ? ' (expression)' : tplProg === 'resolve' ? t(' (Fusion expression alebo Lua do konzoly)') : '' }) });
    const calc = () => {
      const d = Number(($('#calcDur') || {}).value) || 0; tplDuration = d || tplDuration;
      const out = $('#calcOut'); if (!out) return;
      out.innerHTML = [[20, t('Bez Nitra')], [50, 'Nitro Basic'], [500, 'Nitro']].map(([mb, n]) => { const k = TPL.bitrateFor(mb, d, 128); return `<div><span>${n} (${mb} MB)</span><b>${k ? (k >= 1000 ? (k / 1000).toLocaleString(I18N.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Mbps' : k + ' kbps') : '—'}</b></div>`; }).join('');
    };
    const cd = $('#calcDur'); if (cd) { cd.oninput = calc; calc(); }

    // súbory v priečinkoch
    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      const res = folderCache[f] && Date.now() - folderCache[f].at < 15000 ? folderCache[f].res : await act('listFolder', { path: f }).catch(() => ({ items: [] }));
      folderCache[f] = { at: Date.now(), res };
      const box = $('#tplf-' + i); if (!box) return;
      if (res.missing) { box.innerHTML = `<p class="hint" style="color:var(--amber)">${t('Priečinok neexistuje.')}</p>`; continue; }
      const items = res.items.filter(it => it.depth === 0 || !it.dir).filter(it => !q || L.normalize(it.rel).includes(q));
      box.innerHTML = items.length ? items.slice(0, 120).map(it => `<button class="tpl-file" data-path="${esc(it.path)}" data-dir="${it.dir ? 1 : 0}" title="${esc(it.rel)}"><span class="kind">${esc(TPL.kindOf(it.name, it.dir))}</span><b>${esc(it.name)}</b>${it.depth ? `<small>${esc(it.rel.split(/[\\/]/)[0])}</small>` : ''}</button>`).join('') + (items.length > 120 ? `<p class="hint">${t('…a ďalších {n}', { n: items.length - 120 })}</p>` : '') : `<p class="hint">${t('Prázdne.')}</p>`;
      $$('[data-path]', box).forEach(b => {
        b.onclick = () => act('openPath', { path: b.dataset.path });
        b.oncontextmenu = e => { e.preventDefault(); fileMenu(b.dataset.path, { x: e.clientX, y: e.clientY }); };
      });
    }
  }
  function fileMenu(file, pos) {
    const active = S.projects.filter(p => !L.isArchived(p, S.settings) && p.status !== 'done');
    popMenu(pos, [
      { label: t('Otvoriť'), run: () => act('openPath', { path: file }) },
      { label: t('Ukázať v priečinku'), run: () => act('revealFile', { path: file }) },
      { label: t('Kopírovať cestu'), run: () => { act('writeClipboard', { text: file }); toast(t('Cesta skopírovaná.')); } },
      'sep',
      ...active.slice(0, 10).map(p => ({ label: t('Do zákazky: {title}', { title: p.title }), color: sColor(p.status), run: async () => {
        const dest = await act('copyToProject', { path: file, projectId: p.id });
        toast(t('Skopírované do <b>{title}</b>.', { title: esc(p.title) }), { icon: '📁', actions: [{ label: t('Ukázať'), run: () => act('revealFile', { path: dest }) }] });
      } }))
    ], file.split(/[\\/]/).pop());
  }

  /* šatník: farby a doplnky pre Kita */
  let wrTab = 'colors';
  function renderWardrobe() {
    const box = $('#wardrobe'); if (!box) return;
    const cur = Object.assign({}, Mascot.DEFAULT, S.settings.kit || {});
    const ctx = { level: L.levelOf(L.xpOf(S)).level, badges: S.achievements || {} };
    const badgeName = id => (L.ACHIEVEMENTS.find(a => a.id === id) || {}).title || id;
    const TABS = [['colors', t('Farby')], ['hat', t('Čiapky')], ['glasses', t('Okuliare')], ['neck', t('Na krk')], ['extra', t('Extra')]];
    let tiles = '';
    if (wrTab === 'colors') {
      tiles = Mascot.PALETTES.map(pl => {
        const c = Object.assign({}, cur, { fur: pl.fur, cream: pl.cream, inner: pl.inner, eyes: pl.eyes });
        const on = cur.fur === pl.fur && cur.cream === pl.cream && cur.eyes === pl.eyes;
        return `<button class="wr-tile${on ? ' on' : ''}" data-pal="${pl.id}"><span class="wr-mini">${Mascot.svg(c)}</span><b>${esc(t(pl.name))}</b></button>`;
      }).join('');
    } else {
      tiles = Mascot.ITEMS[wrTab].map(it => {
        const ok = Mascot.isUnlocked(it, ctx);
        const c = Object.assign({}, cur, { [wrTab]: it.id });
        const on = (cur[wrTab] || '') === it.id;
        const hint = it.unlock ? (it.unlock.level ? 'Lvl ' + it.unlock.level : t('Odznak: {name}', { name: badgeName(it.unlock.badge) })) : '';
        return `<button class="wr-tile${on ? ' on' : ''}${ok ? '' : ' locked'}" data-item="${it.id}" ${ok ? '' : 'disabled'} title="${ok ? '' : esc(t('Odomkneš: {what}', { what: hint }))}"><span class="wr-mini">${Mascot.svg(c)}</span><b>${esc(t(it.name))}</b>${!ok ? `<small>🔒 ${esc(hint)}</small>` : ''}</button>`;
      }).join('');
    }
    box.innerHTML = `<h3>${t('Šatník')} <span class="aside">${t('Kit sa prezlečie všade v appke')}</span></h3>
      <div class="wr">
        <div class="wr-preview"><div class="mascot" id="wrKit"></div><button class="btn small" id="wrRandom">${t('Náhodný outfit')}</button><button class="btn ghost small" id="wrReset">${t('Pôvodný')}</button></div>
        <div class="wr-side">
          <div class="seg">${TABS.map(([id, n]) => `<button data-wtab="${id}" class="${wrTab === id ? 'on' : ''}">${n}</button>`).join('')}</div>
          <div class="wr-grid">${tiles}</div>
          ${wrTab === 'colors' ? `<div class="wr-colors">${[['fur', t('Srsť')], ['cream', t('Brucho a líca')], ['inner', t('Uši vnútri')], ['eyes', t('Oči')]].map(([k, n]) => `<label><input type="color" data-col="${k}" value="${cur[k]}">${n}</label>`).join('')}</div>` : ''}
        </div>
      </div>`;
    const prev = $('#wrKit'); prev.innerHTML = Mascot.svg(cur);
    const save = patch => {
      const next = Object.assign({}, cur, patch);
      prev.innerHTML = Mascot.svg(next);
      const k = prev.querySelector('.kit'); k.classList.add('happy'); setTimeout(() => k.classList.remove('happy'), 900);
      FX.sound.pop();
      act('updateSettings', { patch: { kit: next } }).then(() => renderWardrobe());
    };
    $$('[data-wtab]', box).forEach(b => b.onclick = () => { if (wrTab === b.dataset.wtab) return; const dir = Polish.dirOf(b); wrTab = b.dataset.wtab; Polish.slide(() => $('.wr-grid', $('#wardrobe') || document), dir, renderWardrobe); });
    $$('[data-pal]', box).forEach(b => b.onclick = () => { const pl = Mascot.PALETTES.find(x => x.id === b.dataset.pal); save({ fur: pl.fur, cream: pl.cream, inner: pl.inner, eyes: pl.eyes }); });
    $$('[data-item]', box).forEach(b => b.onclick = () => save({ [wrTab]: b.dataset.item }));
    $$('[data-col]', box).forEach(inp => {
      inp.oninput = () => { prev.innerHTML = Mascot.svg(Object.assign({}, cur, { [inp.dataset.col]: inp.value })); };
      inp.onchange = () => save({ [inp.dataset.col]: inp.value });
    });
    $('#wrReset').onclick = () => save(Object.assign({}, Mascot.DEFAULT));
    $('#wrRandom').onclick = () => {
      const pick = arr => arr[Math.floor(Math.random() * arr.length)];
      const pl = pick(Mascot.PALETTES);
      const free = k => Mascot.ITEMS[k].filter(it => Mascot.isUnlocked(it, ctx)).map(it => it.id);
      save({ fur: pl.fur, cream: pl.cream, inner: pl.inner, eyes: pl.eyes, hat: pick(free('hat')), glasses: pick(free('glasses')), neck: pick(free('neck')), extra: pick(free('extra')) });
    };
  }

  /* odznaky: kontrola po každej zmene dát */
  let achReady = false;
  function checkAchievements() {
    const ach = L.achievementsState(S);
    const fresh = ach.filter(a => a.ok && !a.at);
    if (!fresh.length) { achReady = true; return; }
    act('unlockAchievements', { ids: fresh.map(a => a.id) }).catch(() => { });
    if (!achReady && fresh.length > 2) {
      toast(t('Odomkol si {badges} za to, čo už máš za sebou.', { badges: tp(fresh.length, '{n} odznak', '{n} odznaky', '{n} odznakov') }), { icon: '🏅', actions: [{ label: t('Pozrieť'), run: () => go('profile') }] });
    } else {
      fresh.forEach((a, i) => setTimeout(() => {
        toast(`${t('<b>Nový odznak:</b> {title}', { title: esc(a.title) })}<br><span style="color:var(--muted);font-size:12.5px">${esc(a.desc)}</span>`, { icon: a.icon, actions: [{ label: t('Profil'), run: () => go('profile') }] });
        FX.sound.badge();
        const r = $('#buddy').getBoundingClientRect(); FX.confetti(r.left + 100, r.top + 60, 70); cheer(2500);
      }, i * 1400));
    }
    achReady = true;
  }

  /* ---------------- mesačný recap (ako Wrapped) ---------------- */
  function openRecap(y, m) {
    const R = L.recapData(S, y, m);
    const monthName = new Date(y, m, 1).toLocaleDateString(I18N.locale(), { month: 'long' });
    const SK = I18N.lang === 'sk';
    const monthIn = SK ? ['januári', 'februári', 'marci', 'apríli', 'máji', 'júni', 'júli', 'auguste', 'septembri', 'októbri', 'novembri', 'decembri'][m] : monthName;
    const weekday = R.bestWeekdayIdx == null ? '' : SK ? ['pondelok', 'utorok', 'stredu', 'štvrtok', 'piatok', 'sobotu', 'nedeľu'][R.bestWeekdayIdx] : R.bestWeekday;
    const name = esc(userName());
    const hours = R.ms / 3600000;
    const films = Math.round(hours / 2);
    const topApp = R.apps[0];
    const appPct = topApp && R.ms ? Math.round(topApp[1] / R.ms * 100) : 0;
    const slides = [
      { c: 'var(--accent)', html: `<div class="rc-kit" id="rcKit"></div><small>${t('Tvoj')}</small><h1>${esc(monthName)}</h1><p>${t('Poďme sa pozrieť, čo si v {month} stihol{name}.', { month: esc(monthIn), name: name ? ', ' + name : '' })}</p>` },
      { c: 'var(--amber)', html: `<small>${t('Odpracoval si')}</small><h1 class="num">${L.formatDuration(R.ms, true)}</h1><p>${films >= 1 ? t('To je ako {films} za sebou.', { films: tp(films, '{n} celovečerný film', '{n} celovečerné filmy', '{n} celovečerných filmov') }) : t('Malý, ale poctivý mesiac.')} ${R.days ? t('Pracoval si {days}.', { days: tp(R.days, '{n} deň', '{n} dni', '{n} dní') }) : ''}</p>${R.bestDay ? `<p class="sub">${t('Najsilnejší deň: <b>{date}</b> s {time}. Najradšej robíš v <b>{weekday}</b>.', { date: new Date(R.bestDay.date + 'T12:00').toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'long' }), time: L.formatDuration(R.bestDay.ms), weekday: esc(weekday) })}</p>` : ''}` },
      { c: 'var(--mint)', html: `<small>${t('Odovzdal si')}</small><h1 class="num">${R.done}</h1><p>${L.plural(R.done, 'zákazku', 'zákazky', 'zákaziek')}${R.withDl ? t(', {a} z {b} načas', { a: R.onTime, b: R.withDl }) : ''}${t('. Nových prišlo {n}.', { n: R.fresh })}</p>${R.fastest ? `<p class="sub">${t('Najrýchlejšia: <b>{title}</b> za {time}.', { title: esc(R.fastest.p.title), time: L.formatDuration(R.fastest.d) })}</p>` : ''}${R.topProject && R.topProject.project ? `<p class="sub">${t('Najviac času zjedla <b>{title}</b> ({time}).', { title: esc(R.topProject.project.title), time: L.formatDuration(R.topProject.ms) })}</p>` : ''}` },
      { c: 'var(--lilac)', html: `<small>${t('Prišlo ti')}</small><h1 class="num">${L.formatMoney(R.paid)}</h1>${R.hourly ? `<p>${t('Vychádza to na <b>{money}</b> za hodinu.', { money: L.formatMoney(Math.round(R.hourly * 10) / 10) })}</p>` : `<p>${t('Za tento mesiac bez platieb.')}</p>`}${R.topClient ? `<p class="sub">${t('Najlepší klient: <b>{name}</b> ({money}).', { name: esc(R.topClient[0]), money: L.formatMoney(R.topClient[1]) })}</p>` : ''}` },
      { c: 'var(--s-review)', html: `<small>${t('Tvoj hlavný program')}</small><h1>${esc(topApp ? tv(topApp[0]) : '—')}</h1><p>${topApp ? t('{pct} % času. ', { pct: appPct }) : ''}${R.longest ? t('Najdlhšia session: {time}.', { time: L.formatDuration(R.longest.ms) }) : ''}</p>${R.latest ? `<p class="sub">${t('Najneskôr si skončil o <b>{time}</b>.', { time: R.latest.toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) })} ${R.latest.getHours() < 5 ? t('Nočná sova') + ' 🦉' : ''}</p>` : ''}` },
      R.badges.length ? { c: 'var(--pink)', html: `<small>${t('Nové odznaky')}</small><div class="rc-badges">${R.badges.map(a => `<div><span>${a.icon}</span><b>${esc(a.title)}</b></div>`).join('')}</div>` } : null,
      { c: 'var(--accent)', final: true, html: `<div class="rc-card" id="rcCard"><div class="rc-card-top"><b>WorkingOnIt</b><span>${esc(monthName)} ${y}</span></div>
          <div class="rc-grid"><div><small>${t('Čas')}</small><b>${L.formatDuration(R.ms, true)}</b></div><div><small>${t('Hotové')}</small><b>${R.done}</b></div><div><small>${t('Prišlo')}</small><b>${L.formatMoney(R.paid)}</b></div><div><small>${esc(L.perHour())}</small><b>${R.hourly ? L.formatMoney(Math.round(R.hourly)) : '—'}</b></div></div>
          <div class="rc-foot">${topApp ? esc(tv(topApp[0])) + ', ' : ''}${t('{days} práce', { days: tp(R.days, '{n} deň', '{n} dni', '{n} dní') })}${R.badges.length ? ', ' + R.badges.map(a => a.icon).join(' ') : ''}</div></div>
          <div class="row"><button class="btn primary small" data-cap="copy">${t('Skopírovať obrázok')}</button><button class="btn small" data-cap="save">${t('Uložiť PNG')}</button></div>` }
    ].filter(Boolean);
    let i = 0, timer = null;
    const ov = el(`<div class="recap"><div class="rc-bars">${slides.map(() => '<i><b></b></i>').join('')}</div><button class="rc-x" aria-label="${t('Zavrieť')}">✕</button><div class="rc-stage"></div><button class="rc-nav prev" aria-label="${t('Späť')}"></button><button class="rc-nav next" aria-label="${t('Ďalej')}"></button></div>`);
    document.body.appendChild(ov);
    const show = n => {
      i = Math.max(0, Math.min(slides.length - 1, n));
      const sl = slides[i];
      ov.style.setProperty('--c', sl.c);
      const st = $('.rc-stage', ov);
      st.innerHTML = `<div class="rc-slide">${sl.html}</div>`;
      $$('.rc-bars i', ov).forEach((b, k) => { b.className = k < i ? 'done' : k === i ? 'now' : ''; });
      const k = $('#rcKit', ov); if (k) { Mascot.mount(k); Mascot.setMood(k, 'happy'); }
      if (sl.final) {
        FX.sound.done(); setTimeout(() => FX.confetti(innerWidth / 2, innerHeight / 2, 120), 200);
        $$('[data-cap]', ov).forEach(b => b.onclick = async e => {
          e.stopPropagation();
          const r = $('#rcCard', ov).getBoundingClientRect(), z = Number(S.settings.zoom) || 1;
          const res = await act('captureRecap', { mode: b.dataset.cap, rect: { x: Math.round(r.left * z), y: Math.round(r.top * z), width: Math.round(r.width * z), height: Math.round(r.height * z) } });
          if (res === 'copied') toast(t('Obrázok je v schránke, vlož ho na Discord.'), { icon: '📋' }); else if (res) toast(t('Uložené.'));
        });
      } else FX.sound.pop();
      clearTimeout(timer);
      if (!sl.final) timer = setTimeout(() => show(i + 1), 6500);
    };
    const close = () => { clearTimeout(timer); document.removeEventListener('keydown', key, true); ov.classList.add('closing'); setTimeout(() => ov.remove(), 260); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === 'ArrowRight' || e.key === ' ') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); };
    document.addEventListener('keydown', key, true);
    $('.rc-x', ov).onclick = close;
    $('.prev', ov).onclick = () => show(i - 1);
    $('.next', ov).onclick = () => show(i + 1);
    show(0);
  }

  /* Kit ponúkne recap začiatkom mesiaca */
  function maybeOfferRecap() {
    const d = new Date();
    if (d.getDate() > 6 || kitPrompt) return;
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const key = 'recap:' + prev.getFullYear() + '-' + prev.getMonth();
    if ((S.notified || {})[key] || localStorageGet(key)) return;
    const R = L.recapData(S, prev.getFullYear(), prev.getMonth());
    if (R.ms < 30 * 60000 && !R.done) return;
    const mn = prev.toLocaleDateString(I18N.locale(), { month: 'long' });
    askKit({ text: t('Tvoj <b>{month}</b> je uzavretý! Mám pre teba recap.', { month: esc(mn) }), actions: [{ label: t('Ukáž'), primary: true, run: () => { localStorageSet(key); openRecap(prev.getFullYear(), prev.getMonth()); } }, { label: t('Neskôr'), run: () => localStorageSet(key) }] });
  }
  /* začiatkom mesiaca minulý mesiac, inak aktuálny */
  function recapDefault() {
    const d = new Date();
    const m = d.getDate() <= 6 ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : d;
    return [m.getFullYear(), m.getMonth()];
  }
  function localStorageGet(k) { try { return localStorage.getItem('woi:' + k); } catch (e) { return null; } }
  function localStorageSet(k) { try { localStorage.setItem('woi:' + k, '1'); } catch (e) { } }

  /* ---------------- peniaze ---------------- */
  function renderMoney() {
    const root = $('#view-money');
    const m = L.moneyStats(S);
    const goal = Number(S.settings.hourlyGoal) || 0;
    const maxM = Math.max(1, ...m.months.map(x => x.amount));
    const owedList = S.projects.filter(p => L.owedOf(p) > 0 && p.status === 'done');
    const pipeList = S.projects.filter(p => L.owedOf(p) > 0 && p.status !== 'done');
    const rates = S.projects.map(p => ({ p, ms: L.projectMs(S, p.id), paid: L.paidOf(p) || (p.status === 'done' ? 0 : 0), reward: Number(p.reward) || 0 }))
      .filter(r => r.ms > 15 * 60000 && r.reward > 0)
      .map(r => Object.assign(r, { rate: r.reward / (r.ms / 3600000) }))
      .sort((a, b) => a.rate - b.rate);
    const low = goal && rates.find(r => r.rate < goal && r.p.status === 'done');
    root.innerHTML = `
      <div class="stats">
        <div class="stat good"><div class="k">${t('Tento mesiac prišlo')}</div><div class="v">${L.formatMoney(m.thisMonth)}</div><div class="s">${new Date().toLocaleDateString(I18N.locale(), { month: 'long', year: 'numeric' })}</div></div>
        <div class="stat accent"><div class="k">${t('Dlhujú ti za hotové')}</div><div class="v">${L.formatMoney(m.owed)}</div><div class="s">${m.owedCount ? tp(m.owedCount, '{n} zákazka', '{n} zákazky', '{n} zákaziek') : t('Nikto ti nedlhuje')}${m.pipeline ? t(', {money} v rozrobených', { money: L.formatMoney(m.pipeline) }) : ''}</div></div>
        <div class="stat"><div class="k">${t('Reálne za hodinu')}</div><div class="v">${m.hourly ? L.formatMoney(Math.round(m.hourly * 10) / 10) : '—'}</div><div class="s">${m.hourly ? (goal ? (m.hourly >= goal ? t('Nad tvojím cieľom {goal}', { goal: L.formatMoney(goal) }) : t('Cieľ je {goal}', { goal: L.formatMoney(goal) + '/' + t('hod') })) : t('z odmeraného času')) : t('Treba zaplatenú zákazku s odmeraným časom')}</div></div>
        <div class="stat"><div class="k">${t('Celkovo zarobené')}</div><div class="v">${L.formatMoney(m.total)}</div><div class="s">${t('odkedy používaš WorkingOnIt')}</div></div>
      </div>
      <div class="grid2">
        <div class="box"><h3>${t('Posledných 6 mesiacov')}</h3><div class="bars">${m.months.map((x, i) => `<div class="bar${i === 5 ? ' now' : ''}"><i style="height:${Math.round(x.amount / maxM * 100)}%;--c:${i === 5 ? 'var(--mint)' : 'color-mix(in srgb, var(--mint) 45%, var(--raise))'};animation-delay:${i * 60}ms">${x.amount ? `<span>${L.formatMoney(Math.round(x.amount))}</span>` : ''}</i><small>${L.monthShort(x.date.getMonth())}</small></div>`).join('')}</div></div>
        <div class="box"><h3>${t('Kto ešte nezaplatil')} <span class="aside">${t('hotové zákazky')}</span></h3>${owedList.length ? `<div class="list">${owedList.map(p => `<div class="li"><span class="grow"><b style="font-weight:600">${esc(p.client || t('Bez mena'))}</b> <span class="dim">${t('{title}, hotové {date}', { title: esc(p.title), date: L.formatDate(p.doneAt) })}</span></span><b style="color:var(--amber)">${L.formatMoney(L.owedOf(p))}</b><button class="btn small" data-paid="${p.id}">${t('Zaplatené')}</button></div>`).join('')}</div>` : `<p class="hint">${t('Za hotové zákazky ti nikto nedlhuje.')}</p>`}
          ${pipeList.length ? `<h3 style="margin-top:18px">${t('Príde po dokončení')} <span class="aside">${L.formatMoney(m.pipeline)}</span></h3><div class="list">${pipeList.map(p => `<div class="li"><span class="grow"><b style="font-weight:600">${esc(p.client || t('Bez mena'))}</b> <span class="dim">${esc(p.title)}</span></span><span class="dim" style="color:${sColor(p.status)}">${esc(statusOf(p.status).label)}</span><b>${L.formatMoney(L.owedOf(p))}</b><button class="btn ghost small" data-paid="${p.id}" title="${t('Zaplatil vopred')}">${t('Zaplatené')}</button></div>`).join('')}</div>` : ''}</div>
      </div>
      <div class="box" style="margin-top:14px"><h3>${t('{ph} podľa projektov', { ph: esc(L.perHour()) })} <span class="aside">${t('odmena ÷ odmeraný čas')}</span></h3>
        ${low ? `<p class="hint" style="margin:-4px 0 12px;color:var(--text)">${t('Pri <b>{title}</b> vyšlo {rate} na hodinu, čo je pod tvojím cieľom {goal}. Pri podobnej zákazke si pýtaj aspoň {money}.', { title: esc(low.p.title), rate: L.formatMoney(Math.round(low.rate * 10) / 10), goal: L.formatMoney(goal), money: L.formatMoney(Math.ceil(goal * low.ms / 3600000)) })}</p>` : ''}
        ${rates.length ? `<div class="apps">${rates.slice().reverse().map(r => `<div class="app-row" style="--c:${goal && r.rate < goal ? 'var(--amber)' : 'var(--mint)'};grid-template-columns:200px 1fr 90px"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.p.title)} <span class="dim" style="color:var(--faint)">${L.formatDuration(r.ms, true)}</span></span><div class="track"><i style="width:${Math.min(100, Math.round(r.rate / Math.max(goal * 2, rates[rates.length - 1].rate) * 100))}%"></i></div><span class="t">${L.formatMoney(Math.round(r.rate * 10) / 10)}</span></div>`).join('')}</div>` : `<p class="hint">${t('Keď budeš mať zákazky s odmenou aj odmeraným časom, uvidíš tu, ktoré sa reálne oplatia.')}</p>`}
      </div>`;
    $$('[data-paid]', root).forEach(b => b.onclick = () => {
      act('addPayment', { id: b.dataset.paid });
      const r = b.getBoundingClientRect(); FX.confetti(r.left + r.width / 2, r.top, 60); FX.sound.pay(); cheer(1500);
    });
  }

  /* ---------------- nastavenia ---------------- */
  const SET_DESC = {
    you: t('Ako ti má hovoriť a akú má povahu v chate.'),
    look: t('Téma, farba, animácie a zvuky.'),
    new: t('Čo sa vyplní samo, keď pridáš zákazku.'),
    folders: t('Kam ukladám zákazky a akú štruktúru priečinkov im spravím.'),
    time: t('V ktorých programoch meriam čas a kedy si dávam pauzu.'),
    renders: t('Ako spoznám nový render a čo s ním urobím.'),
    goals: t('Upozornenia na deadliny, cieľová hodinovka a archív.'),
    mobil: t('Zákazky a Kit v telefóne, keď je PC zapnuté.'),
    cloud: t('Tvoje dáta na všetkých PC aj v mobile, aj keď je PC vypnuté. Databáza je tvoja.'),
    ai: t('Kit odpovedá cez model, ktorý beží u teba na PC. Zadarmo a súkromne.'),
    claude: t('Claude desktop appka uvidí zákazky, rendery aj nápady a vie pracovať v After Effects.'),
    window: t('Klávesové skratky, okno a spúšťanie so systémom.'),
    data: t('Kde sú tvoje dáta, zálohy a import z Notionu.'),
    about: t('Verzia, sprievodca a riešenie problémov.')
  };
  const setSections = () => [
    ['you', t('Ty a {name}', { name: S.settings.mascotName || 'Kit' }), 'kit'], ['look', t('Vzhľad'), 'palette'], ['new', t('Nová zákazka'), 'newjob'],
    ['folders', t('Priečinky'), 'folder'], ['time', t('Meranie času'), 'clock'], ['renders', t('Rendery'), 'film'],
    ['goals', t('Pripomienky a ciele'), 'target'], ['cloud', t('Online databáza'), 'cloud'], ['mobil', t('Mobil cez wifi'), 'phone'], ['ai', t('Lokálne AI'), 'chip'],
    ['claude', 'Claude', 'spark'], ['window', t('Okno a skratky'), 'keyboard'], ['data', t('Dáta a zálohy'), 'shield'], ['about', t('O appke'), 'info']
  ];
  let setQ = '', setSpy = null;
  const setIcon = ic => ic === 'kit' ? '<span class="set-kit" data-minikit></span>' : ICONS.svg(ic);
  const exampleProject = () => S.projects[0] || { client: t('Klient'), title: 'Intro', type: L.projectTypes(S.settings)[0] || 'Edit' };

  async function renderSettings() {
    const root = $('#view-settings');
    const st = S.settings;
    const keepScroll = root.scrollTop;
    const tog = (k, label, sub) => `<div class="set-row"><div class="grow"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div><label class="toggle"><input type="checkbox" data-s="${k}"${st[k] ? ' checked' : ''}></label></div>`;
    const tree = (pattern, template) => {
      const name = L.folderNameFrom(pattern, exampleProject(), Date.now());
      const lines = String(template || '').split(/\r?\n/).filter(Boolean).map(l => '  '.repeat(l.split(/[\\/]/).length) + '└ ' + l.split(/[\\/]/).pop());
      return name + '\n' + lines.join('\n') + '\n  └ ' + t('_zadanie.txt');
    };
    const THEMES = [['clean', t('Čistá'), 'linear-gradient(90deg, #f5f5f7 0 55%, #2c2c2e 55%)', '#ffffff', '#1d1d1f'], ['lampa', t('Lampa'), '#1c1713', '#f2cbd5', '#efe8dc'], ['nokturno', t('Nokturno'), '#0a0d1c', '#1a2045', '#eaedff'], ['atrament', t('Atrament'), '#15131f', '#252234', '#ece8ff'], ['polnoc', t('Polnoc'), '#0e1220', '#1d2338', '#e6ebff'], ['oled', t('OLED čierna'), '#000000', '#16161d', '#f0f0f5'], ['les', t('Nočný les'), '#0f1716', '#1c2b29', '#e4f3ee'], ['papier', t('Papier'), '#eceaf3', '#ffffff', '#1d1a2b']];
    const contacts = L.contactTypes(st), types = L.projectTypes(st);
    const apps = String(st.editorApps || '').split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
    const known = e => apps.some(a => a.toLowerCase() === e.exe.toLowerCase());
    const custom = apps.filter(a => !L.EDITORS.some(e => e.exe.toLowerCase() === a.toLowerCase()));
    const sec = (id, title, ic, content, extraCls) => `<section class="box set-sec${extraCls ? ' ' + extraCls : ''}" id="set-${id}" data-sec="${id}">
        <div class="set-h"><span class="set-ic">${setIcon(ic)}</span><div><h3>${title}</h3><p>${SET_DESC[id]}</p></div></div>${content}</section>`;
    const listEdit = (key, label, items, ph) => `<div class="field full"><label>${label}</label><div class="list-edit" data-list="${key}">${items.map(x => `<span class="tagchip on">${esc(tv(x))}<button data-rm="${esc(x)}" title="${t('Odobrať')}">✕</button></span>`).join('')}<input placeholder="${esc(ph)}"></div></div>`;
    const claudeEx = (S.projects.find(p => L.isActive(p, S.settings)) || {}).title;

    const S2 = setSections();
    root.innerHTML = `<div class="set2">
      <nav class="set-nav">
        <label class="search small">${ICONS.svg('search')}<input id="setQ" placeholder="${t('Hľadať v nastaveniach')}" value="${esc(setQ)}"></label>
        ${S2.map(([id, title, ic]) => `<button data-go="${id}"><span class="si">${setIcon(ic)}</span><span>${esc(title)}</span></button>`).join('')}
      </nav>
      <div class="set-body">
      ${sec('you', t('Ty a {name}', { name: esc(st.mascotName || 'Kit') }), 'kit', `
        <div class="fields">
          <div class="field"><label>${t('Tvoje meno')}</label><input data-s="userName" value="${esc(st.userName)}" placeholder="${t('Ako ti má {name} hovoriť', { name: esc(st.mascotName || 'Kit') })}"></div>
          <div class="field"><label>${t('Meno maskota')}</label><input data-s="mascotName" value="${esc(st.mascotName)}"></div>
          <div class="field full"><label>${t('Tvoja značka alebo kanál')} <span class="dim">${t('nepovinné')}</span></label><input data-s="brand" value="${esc(st.brand || '')}" placeholder="${t('Napr. názov tvojho štúdia')}"><span class="hint" style="margin:0">${t('Uvidíš ju v najvyššom leveli a vďaka nej ťa lepšie pochopí {name} aj Claude.', { name: esc(st.mascotName || 'Kit') })}</span></div>
        </div>
        <div class="set-row"><div class="grow"><b>${t('Jazyk')}</b><span>Slovenčina / English</span></div>
          <select id="langSel" class="sel-inline">${I18N.LANGS.map(l => `<option value="${l.id}"${I18N.lang === l.id ? ' selected' : ''}>${l.name}</option>`).join('')}</select></div>
        <div class="set-row"><div class="grow"><b>${t('Mena')}</b><span>${t('Ako ukazujem odmeny a platby')}</span></div>
          <select data-s="currency" class="sel-inline">${I18N.CURRENCIES.map(c => `<option value="${c}"${(st.currency || 'EUR') === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="lbl" style="margin:16px 0 8px">${t('Povaha v chate')}</div>
        <div class="persona-grid">${PERSONAS.map(pp => `<button class="persona${(st.kitPersona || 'kamos') === pp.id ? ' on' : ''}" data-persona="${pp.id}"><span>${pp.icon}</span><b>${esc(pp.name)}</b><small>${esc(pp.desc)}</small></button>`).join('')}</div>
        <div class="field" id="personaCustom" style="margin-top:10px${st.kitPersona === 'vlastna' ? '' : ';display:none'}"><label>${t('Kto je {name}? Opíš jeho povahu, ako hovorí a čo má rád', { name: esc(st.mascotName || 'Kit') })}</label><textarea data-s="kitPersonaCustom" rows="4" placeholder="${t('Napr.: Si sarkastická líška, ktorá miluje After Effects a nenávidí Comic Sans. Hovoríš krátko, štipľavo, ale vždy pomôžeš.')}">${esc(st.kitPersonaCustom || '')}</textarea></div>
        <div class="field" style="margin-top:10px"><label>${t('Ďalšie priania (platia pre každú povahu)')}</label><input data-s="kitPersonaExtra" value="${esc(st.kitPersonaExtra || '')}" placeholder="${t('Napr.: volaj ma šéfe, občas pridaj anglický slang, buď stručnejší')}"></div>
        <div class="set-row" style="border-top:0"><div class="grow"><span>${st.ollamaEnabled ? t('Zmeny platia hneď pre nový rozhovor.') : t('Chat potrebuje lokálne AI, zapneš ho nižšie v sekcii Lokálne AI.')}</span></div><button class="btn small" id="tryPersona"${st.ollamaEnabled ? '' : ' disabled'}>${t('Vyskúšať v chate')}</button></div>`)}

      ${sec('look', t('Vzhľad'), 'palette', `
        <div class="themes">${THEMES.map(([id, name, bg, pn, tx]) => `<button class="theme-card${(st.theme || 'clean') === id ? ' on' : ''}" data-theme="${id}" style="--tb:${bg};--tp:${pn};--tt:${tx}"><i></i>${name}</button>`).join('')}</div>
        ${(st.theme || 'clean') === 'clean' ? `<div class="set-row" style="margin-top:12px"><div class="grow"><b>${t('Režim')}</b><span>${t('Automaticky sa prepína so svetlým a tmavým režimom Windowsu')}</span></div>
          <div class="seg">${[['auto', t('Automaticky')], ['light', t('Svetlý')], ['dark', t('Tmavý')]].map(([v, l]) => `<button data-appear="${v}" class="${(st.appearance || 'auto') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>` : ''}
        <div class="set-row" style="margin-top:12px"><div class="grow"><b>${t('Akcentová farba')}</b><span>${t('Tlačidlá, výber, zvýraznenie')}</span></div>
          <div class="swatches">${Look.ACCENTS.map(a => `<button class="swatch${st.accent === a.id ? ' on' : ''}" style="--sw:${a.id}" data-accent="${a.id}" title="${esc(t(a.name))}"></button>`).join('')}<input type="color" id="accentPick" class="cw-wheel${Look.ACCENTS.some(a => a.id === st.accent) ? '' : ' on'}" value="${esc(st.accent)}" title="${t('Vlastná farba')}"></div></div>
        <div class="set-row"><div class="grow"><b>${t('Animácie')}</b><span>${t('Konfety, pohyb maskota, efekty')}</span></div>
          <div class="seg">${[['full', t('Všetky')], ['calm', t('Jemné')], ['off', t('Vypnuté')]].map(([v, l]) => `<button data-motion="${v}" class="${(st.motion || 'full') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="set-row"><div class="grow"><b>${t('Veľkosť rozhrania')}</b><span>${t('Na veľkom monitore môžeš ísť väčšie')}</span></div>
          <div class="seg">${[[0.9, '90 %'], [1, '100 %'], [1.1, '110 %'], [1.25, '125 %']].map(([v, l]) => `<button data-zoom="${v}" class="${Number(st.zoom || 1) === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        ${tog('compact', t('Kompaktné karty'), t('Viac zákaziek na obrazovku'))}
        ${tog('showKit', t('Zobraziť {name}', { name: esc(L.decl(st.mascotName, 'gen')) }), t('Maskot a jeho bublina v ľavom paneli'))}
        ${tog('sounds', t('Zvuky'), t('Mäkké zvuky pri dokončení, presune, rendri a platbe'))}
        <div class="set-row"><div class="grow"><b>${t('Hlasitosť')}</b><span>${t('Vypočuj si ich')}</span></div>
          <input type="range" min="0" max="1" step="0.05" id="volume" value="${st.soundVolume == null ? 0.7 : st.soundVolume}" style="width:150px;accent-color:var(--accent)">
          <div class="seg"><button data-snd="pop">${t('Klik')}</button><button data-snd="done">${t('Hotovo')}</button><button data-snd="pay">${t('Platba')}</button><button data-snd="level">Level up</button></div></div>`)}

      ${sec('new', t('Nová zákazka'), 'newjob', `
        <div class="fields">
          <div class="field"><label>${t('Predvolený kontakt')}</label><select data-s="defaultContact">${opts(contacts, contacts.includes(st.defaultContact) ? st.defaultContact : contacts[0])}</select></div>
          <div class="field"><label>${t('Predvolený typ')}</label><select data-s="defaultType">${opts(types, types.includes(st.defaultType) ? st.defaultType : types[0])}</select></div>
          <div class="field"><label>${t('Nová zákazka začína v stĺpci')}</label><select data-s="defaultStatus">${opts(L.STATUSES.filter(x => x.id !== 'done'), st.defaultStatus || 'todo')}</select></div>
          ${listEdit('contactTypes', t('Typy kontaktu'), contacts, t('+ pridať (napr. Fiverr, Telegram)'))}
          ${listEdit('projectTypes', t('Typy zákaziek'), types, t('+ pridať (napr. Podcast, Reels)'))}
        </div>
        <p class="hint">${t('Keď klient už u teba niečo mal, kontakt sa doplní podľa jeho poslednej zákazky a meno klienta ti appka našepká.')}</p>
        <div class="set-row"><div class="grow"><b>${t('Pôvodné zoznamy')}</b><span>${t('Vráti typy kontaktu a zákaziek na predvolené')}</span></div><button class="btn ghost small" id="resetLists">${t('Obnoviť')}</button></div>`)}

      ${sec('folders', t('Priečinky'), 'folder', `
        <div class="fields">
          <div class="field full"><label>${t('Hlavný priečinok')}</label><div style="display:flex;gap:8px"><input data-s="rootFolder" value="${esc(st.rootFolder)}" style="flex:1"><button class="btn small" id="pickRoot">${t('Vybrať')}</button></div></div>
          <div class="field full"><label>${t('Názov priečinka')}</label><input data-s="folderPattern" value="${esc(st.folderPattern)}"><span class="hint" style="margin:0">${t('Môžeš použiť {tokens}', { tokens: I18N.lang === 'sk' ? '{rok} {mesiac} {den} {klient} {nazov} {typ}' : '{year} {month} {day} {client} {title} {type}' })}</span></div>
          <div class="field"><label>${t('Podpriečinky (jeden na riadok)')}</label><textarea data-s="folderTemplate" rows="9">${esc(st.folderTemplate)}</textarea></div>
          <div class="field"><label>${t('Náhľad')}</label><div class="preview-tree">${esc(tree(st.folderPattern, st.folderTemplate))}</div></div>
        </div>
        ${tog('autoCreateFolder', t('Vytvárať priečinok automaticky'), t('Pri každej novej zákazke, ak je nastavený hlavný priečinok'))}`)}

      ${sec('time', t('Meranie času'), 'clock', `
        ${tog('trackingEnabled', t('Merať automaticky'), PLATFORM === 'win32' ? t('Keď je vybraný program v popredí a nie si preč od PC') : t('Automatické meranie zatiaľ funguje len vo Windows'))}
        <div class="set-row"><div class="grow"><b>${t('Nový projekt v programe')}</b><span>${t('Keď na projekte, ktorý v appke nemáš, robíš aspoň minútu')}</span></div>
          <select data-s="newProjectMode" class="sel-inline"><option value="auto"${(st.newProjectMode || 'auto') === 'auto' ? ' selected' : ''}>${t('Pridať ako zákazku')}</option><option value="ask"${st.newProjectMode === 'ask' ? ' selected' : ''}>${t('Opýtať sa')}</option><option value="off"${st.newProjectMode === 'off' ? ' selected' : ''}>${t('Nič nerobiť')}</option></select></div>
        ${tog('autoStatus', t('Meniť stav podľa práce'), t('Keď začneš robiť na zákazke z „Na rade“, presuniem ju do „Pracujem“. Keď sa vrátiš k hotovej, dám ju do „Úpravy“.'))}
        <div class="lbl" style="margin:12px 0 8px">${t('Programy')}</div>
        <div class="ed-grid">${L.EDITORS.map(e => `<label class="ed-chip${known(e) ? ' on' : ''}"><input type="checkbox" data-ed="${esc(e.exe)}"${known(e) ? ' checked' : ''}>${esc(e.name)}</label>`).join('')}</div>
        <div class="fields" style="margin-top:12px">
          <div class="field"><label>${t('Ďalšie programy (názov .exe, jeden na riadok)')}</label><textarea id="edCustom" rows="3" placeholder="${t('Napr. Topaz Video AI.exe')}">${esc(custom.join('\n'))}</textarea><span class="hint" style="margin:0">${t('Názov nájdeš v Správcovi úloh → Podrobnosti.')}</span></div>
          <div class="field"><label>${t('Pauza, keď si preč od PC')}</label><div class="suffix"><input type="number" min="1" max="60" data-s="idleMinutes" value="${esc(st.idleMinutes)}"><span>min</span></div>
            <label style="margin-top:10px">${t('Odbehnutie do iného programu sa ešte počíta')}</label><div class="suffix"><input type="number" min="0" max="30" data-s="awayGraceMinutes" value="${esc(st.awayGraceMinutes)}"><span>min</span></div>
            <span class="hint" style="margin:0">${t('Napr. pozrieš referenciu alebo odpíšeš klientovi. Keď sa vrátiš skôr, čas sa nepreruší.')}</span>
            <div id="trackDiag" class="hint"></div></div>
        </div>
        ${(st.ignoredNames || []).length ? `<div class="set-row"><div class="grow"><b>${t('Ignorované projekty')}</b><span>${esc(st.ignoredNames.slice(-6).join(', '))}</span></div><button class="btn ghost small" id="clearIgnored">${t('Vymazať zoznam')}</button></div>` : ''}`)}

      ${sec('renders', t('Rendery'), 'film', `
        <p class="desc">${t('V hlavnom priečinku sledujem len podpriečinky s „Render“, „Export“ alebo „Final“ v názve, aby sa za render nepovažoval footage.')}</p>
        <div class="fields"><div class="field"><label>${t('Prípony')}</label><input data-s="renderExtensions" value="${esc(st.renderExtensions)}"></div>
        <div class="field"><label>${t('Ďalšie export priečinky (sleduje sa všetko)')}</label><textarea data-s="extraWatchFolders" rows="3" placeholder="D:\\Exports">${esc(st.extraWatchFolders)}</textarea></div></div>
        ${tog('notifyRenders', t('Notifikácia pri novom rendri'))}
        ${tog('renderAutoReview', t('Po rendri presunúť do Review'), t('Iba ak je zákazka v stave Pracujem alebo Úpravy'))}`)}

      ${sec('goals', t('Pripomienky a ciele'), 'target', `
        ${tog('notifyDeadlines', t('Upozorniť na deadliny'), t('2 dni a 1 deň pred, v deň deadlinu a po ňom'))}
        <div class="fields"><div class="field"><label>${t('Cieľová hodinovka')}</label><div class="suffix"><input type="number" min="0" data-s="hourlyGoal" value="${esc(st.hourlyGoal)}"><span>${esc(I18N.currencySymbol())}</span></div><span class="hint" style="margin:0">${t('Podľa nej ti dám cenový tip a ukážem, ktoré zákazky sa neoplatia.')}</span></div>
        <div class="field"><label>${t('Hotové presunúť do Archívu po')}</label><div class="suffix"><input type="number" min="0" max="90" data-s="archiveAfterDays" value="${esc(st.archiveAfterDays)}"><span>${t('dňoch')}</span></div></div></div>`)}

      ${sec('cloud', t('Online databáza'), 'cloud', `<div id="cloudBox"><p class="hint">${t('Zisťujem stav…')}</p></div>`)}

      ${sec('mobil', t('Mobil cez wifi'), 'phone', `
        <p class="desc">${t('Na mobile naskenuj QR kód a pridaj si stránku na plochu. Doma to ide cez wifi. Mimo domu nainštaluj <b>Tailscale</b> na PC aj mobil (zadarmo) a použi Tailscale adresu. PC musí byť zapnuté.')}</p>
        ${tog('remoteEnabled', t('Povoliť prístup z mobilu'), t('Stránka je chránená tajným kódom v odkaze'))}
        <div id="remoteBox" style="margin-top:10px"></div>`)}

      ${sec('ai', t('Lokálne AI'), 'chip', `
        <div id="aiState" class="ai-state"><span class="dot"></span><div class="grow"><b>${t('Zisťujem stav Ollamy…')}</b></div></div>
        ${tog('ollamaEnabled', t('Používať lokálne AI'), t('Chat s {name}, presnejšie čítanie správ od klientov a nápady', { name: esc(L.decl(st.mascotName, 'ins')) }))}
        ${tog('ollamaAutoStart', t('Spúšťať Ollamu automaticky'), t('Keď nebeží, spustím ju potichu na pozadí. Inak ju musíš zapnúť sám.'))}
        ${tog('aiThink', t('Premýšľať pred odpoveďou'), t('Presnejšie pri zložitých otázkach, ale odpoveď príde o 10 až 30 sekúnd neskôr'))}
        <div id="aiModels" class="ai-models"></div>
        <div class="fields">
          <div class="field"><label>${t('Iný model z ollama.com/library')}</label><div style="display:flex;gap:8px"><input id="aiCustom" placeholder="${t('napr. qwen3.5:9b')}" style="flex:1"><button class="btn small" id="aiCustomPull">${t('Stiahnuť')}</button></div></div>
          <div class="field"><label>${t('Uvoľniť model z grafiky po')}</label><div class="suffix"><input type="number" min="0" max="60" data-s="aiKeepAlive" value="${esc(st.aiKeepAlive)}"><span>min</span></div><span class="hint" style="margin:0">${t('Po poslednej otázke. 0 = hneď, hodí sa pri renderovaní.')}</span></div>
        </div>`)}

      ${sec('claude', 'Claude', 'spark', `
        <div id="claudeBox"><p class="hint">${t('Zisťujem…')}</p></div>
        <div class="claude-cols">
          <div><h4>After Effects</h4>
            <p class="hint">${t('Aby ti Claude vedel v AE pridávať vrstvy, expressions a podobne, zapni v AE <b>Edit → Preferences → Scripting &amp; Expressions → Allow Scripts to Write Files and Access Network</b>. Všetko, čo urobí, vrátiš jedným Ctrl+Z.')}</p>
            <div class="set-row" style="border-top:0;padding-top:4px"><div class="grow"><span id="aePathTxt">${t('Hľadám After Effects…')}</span></div><button class="btn ghost small" id="aePick">${t('Zmeniť')}</button></div></div>
          <div><h4>DaVinci Resolve Studio</h4>
            <p class="hint">${t('Resolve Studio 21.1 má vlastné prepojenie s Claude: <b>File → Setup AI Assistants → Claude</b>. Claude potom vie skladať timeline z Media Pool, mazať krátke strihy, meniť nastavenia projektu a pustiť render. Spolu s WorkingOnIt vie najprv prečítať zadanie a potom strihať podľa neho.')}</p></div>
        </div>
        <h4 style="margin-top:14px">${t('Čo mu môžeš napísať')}</h4>
        <div class="prompt-list">${[
          claudeEx ? t('Pozri sa na posledný render {title} vo WorkingOnIt a daj mi feedback na tempo, hook a čitateľnosť textu.', { title: claudeEx }) : t('Pozri sa na môj posledný render vo WorkingOnIt a daj mi feedback na tempo, hook a čitateľnosť textu.'),
          t('Prečítaj zadanie {what} a sprav storyboard po záberoch. Ulož ho do Nápadov vo WorkingOnIt.', { what: claudeEx || t('mojej najbližšej zákazky') }),
          t('V After Effects v aktívnej kompozícii pridaj vybraným vrstvám jemný wiggle na pozíciu a fade-in na začiatku.'),
          t('Čo mám dnes vo WorkingOnIt urobiť ako prvé a komu mám napísať kvôli platbe?')
        ].map(x => `<button class="prompt" data-prompt="${esc(x)}"><span>${esc(x)}</span><small>${t('Kopírovať')}</small></button>`).join('')}</div>`)}

      ${sec('window', t('Okno a skratky'), 'keyboard', `
        <div class="fields"><div class="field"><label>${t('Skratka pre spotlight odkiaľkoľvek')}</label><input data-s="spotlightHotkey" value="${esc(st.spotlightHotkey)}" placeholder="Control+Shift+Space"><span class="hint" style="margin:0">${t('V appke funguje aj Ctrl+K. Formát: Control+Shift+Space, Alt+Q…')}</span></div>
        <div class="field"><label>${t('Krížik na okne')}</label><select data-s="closeAction"><option value="tray"${st.closeAction !== 'quit' ? ' selected' : ''}>${t('Schovať do lišty (meranie beží ďalej)')}</option><option value="quit"${st.closeAction === 'quit' ? ' selected' : ''}>${t('Ukončiť appku')}</option></select></div></div>
        ${tog('launchAtLogin', t('Spustiť so systémom'), t('Naštartuje sa potichu do lišty, aby meranie bežalo hneď'))}
        ${tog('startMinimized', t('Štartovať minimalizovane'))}
        <div class="kbd-list">${[['Ctrl+K', t('spotlight')], ['Ctrl+N', t('nová zákazka')], ['Ctrl+J', t('chat s {name}', { name: L.decl(st.mascotName, 'ins') })], [t('Ctrl+1 až 9'), t('sekcie v menu')], ['Ctrl+Shift+Alt+W', t('zákazka zo schránky odkiaľkoľvek')], ['Esc', t('zavrieť')]].map(([k, label]) => `<span><kbd>${k}</kbd>${esc(label)}</span>`).join('')}</div>`)}

      ${sec('data', t('Dáta a zálohy'), 'shield', `
        <div class="set-row"><div class="grow"><b>${t('Import z Notionu')}</b><span>${t('V Notione: ••• → Export → Markdown &amp; CSV, potom vyber CSV súbor')}</span></div><button class="btn small" id="impNotion">${t('Importovať')}</button></div>
        <div class="set-row"><div class="grow"><b>${t('Záloha do súboru')}</b><span>${t('Každý deň robím zálohu sám, toto je navyše, napr. na USB')}</span></div><button class="btn small" id="expBackup">${t('Exportovať')}</button><button class="btn ghost small" id="openData">${t('Otvoriť priečinok s dátami')}</button></div>
        <div class="lbl" style="margin:14px 0 8px">${t('Denné zálohy')} <span class="dim">${t('(posledných 21 dní)')}</span></div>
        <div id="backupList" class="list"><p class="hint">${t('Načítavam…')}</p></div>`)}

      ${sec('about', t('O appke'), 'info', `
        <div class="about">
          <div class="about-brand"><svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#2c2c2e"/><rect x="5" y="8.5" width="13" height="4.2" rx="2.1" fill="#ff9f0a"/><rect x="11.5" y="14" width="15.5" height="4.2" rx="2.1" fill="#0a84ff"/><rect x="7" y="19.5" width="10.5" height="4.2" rx="2.1" fill="#bf5af2"/><rect x="19.6" y="6.5" width="1.4" height="19" rx=".7" fill="#ff453a"/><circle cx="20.3" cy="7" r="2.3" fill="#ff453a"/></svg><div><b>WorkingOnIt</b><span>${t('verzia {v}', { v: esc(VERSION) })}</span></div></div>
          <div class="set-row" id="updRow"><div class="grow"><b>${t('Aktualizácie')}</b><span id="updTxt">${t('Zisťujem…')}</span></div><span id="updBtns"></span></div>
          ${tog('updateChannel', t('Skúšať nové verzie skôr'), t('Dostaneš testovacie verzie hneď, ako vyjdú. Môžu mať chyby.'))}
          <div class="set-row"><div class="grow"><b>${t('Sprievodca prvým spustením')}</b><span>${t('Znova nastaví meno, priečinky a programy')}</span></div><button class="btn small" id="rerunOb">${t('Spustiť sprievodcu')}</button></div>
          <div class="set-row"><div class="grow"><b>${t('Niečo nefunguje?')}</b><span>${t('Chyby zapisujem do logu. Pri hlásení problému ho priprav.')}</span></div><button class="btn ghost small" id="openLogs">${t('Otvoriť logy')}</button></div>
        </div>`)}
      </div>
    </div>`;

    $$('[data-minikit]', root).forEach(k => { Mascot.mount(k); });
    root.scrollTop = keepScroll;

    // navigácia v nastaveniach + hľadanie
    $$('[data-go]', root).forEach(b => b.onclick = () => { const target = $('#set-' + b.dataset.go, root); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const qIn = $('#setQ', root);
    const filterSecs = () => {
      const n = L.normalize(setQ);
      $$('.set-sec', root).forEach(s => { s.hidden = !!n && !L.normalize(s.textContent).includes(n); });
      $$('[data-go]', root).forEach(b => { const target = $('#set-' + b.dataset.go, root); b.hidden = !!(target && target.hidden); });
    };
    qIn.oninput = () => { setQ = qIn.value; filterSecs(); };
    filterSecs();
    // zvýraznená položka v menu = sekcia, ktorej nadpis je práve hore (pri konci stránky posledná)
    if (setSpy) root.removeEventListener('scroll', setSpy);
    let spyRaf = 0, spyLock = 0;
    const markNav = id => $$('[data-go]', root).forEach(b => b.classList.toggle('on', b.dataset.go === id));
    setSpy = () => {
      if (spyRaf || Date.now() < spyLock) return;
      spyRaf = requestAnimationFrame(() => {
        spyRaf = 0;
        const secs = $$('.set-sec', root).filter(x => !x.hidden);
        if (!secs.length) return;
        const top = root.getBoundingClientRect().top + 80;
        let cur = secs[0];
        for (const x of secs) if (x.getBoundingClientRect().top <= top) cur = x;
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) cur = secs[secs.length - 1];
        markNav(cur.dataset.sec);
      });
    };
    root.addEventListener('scroll', setSpy, { passive: true });
    setSpy();
    // klik v menu: zvýrazní hneď a počas plynulého posunu ho nič neprepíše
    $$('[data-go]', root).forEach(b => b.addEventListener('click', () => { markNav(b.dataset.go); spyLock = Date.now() + 700; setTimeout(setSpy, 720); }));

    $$('[data-s]', root).forEach(inp => {
      const save = () => {
        const k = inp.dataset.s;
        let v = inp.type === 'checkbox' ? inp.checked : inp.value;
        if (k === 'updateChannel') v = inp.checked ? 'beta' : '';
        if (['idleMinutes', 'hourlyGoal', 'remotePort', 'archiveAfterDays'].includes(k)) v = Number(v) || L.DEFAULT_SETTINGS[k];
        if (['awayGraceMinutes', 'aiKeepAlive'].includes(k)) v = Math.max(0, Number(v) || 0);
        if (['spotlightHotkey', 'userName', 'brand', 'mascotName'].includes(k)) v = String(v).trim();
        if (k === 'mascotName' && !v) v = 'Kit';
        if (k === 'sounds') window.__sounds = v;
        if (k === 'currency') I18N.setCurrency(v);
        act('updateSettings', { patch: { [k]: v } }).then(() => { if (['ollamaEnabled', 'ollamaAutoStart', 'mascotName'].includes(k)) renderSettings(); if (k === 'currency') renderAll(); });
      };
      inp.addEventListener('change', save);
    });
    $('[data-s=folderTemplate]', root).addEventListener('input', e => { $('.preview-tree', root).textContent = tree($('[data-s=folderPattern]', root).value, e.target.value); });
    $('[data-s=folderPattern]', root).addEventListener('input', e => { $('.preview-tree', root).textContent = tree(e.target.value, $('[data-s=folderTemplate]', root).value); });
    $('#pickRoot').onclick = async () => { const d = await act('pickFolder', { defaultPath: st.rootFolder }); if (d) act('updateSettings', { patch: { rootFolder: d } }).then(renderSettings); };
    $('#impNotion').onclick = importNotion;
    $$('[data-prompt]', root).forEach(b => b.onclick = () => { act('writeClipboard', { text: b.dataset.prompt }); toast(t('Skopírované. Vlož to do Claude.'), { icon: '📋' }); });
    // jazyk: celé okno sa prekreslí nanovo
    $('#langSel', root).onchange = e => act('updateSettings', { patch: { language: e.target.value } }).then(() => location.reload());
    renderClaudeBox();
    act('aeDetect').then(p => { const box = $('#aePathTxt'); if (box) box.textContent = p ? 'After Effects: ' + p : t('After Effects som nenašiel. Ak ho máš, nastav cestu k AfterFX.exe.'); }).catch(() => { });
    $('#aePick').onclick = () => act('pickAePath').then(() => renderSettings());
    $$('[data-persona]', root).forEach(b => b.onclick = () => {
      act('updateSettings', { patch: { kitPersona: b.dataset.persona } });
      $$('[data-persona]', root).forEach(x => x.classList.toggle('on', x === b));
      $('#personaCustom').style.display = b.dataset.persona === 'vlastna' ? '' : 'none';
      FX.sound.pop();
    });
    $('#tryPersona').onclick = () => chat.open({ projectId: '', fresh: true, q: t('Ahoj, predstav sa mi v dvoch vetách.') });
    $('#volume').oninput = e => { window.__volume = Number(e.target.value); };
    $('#volume').onchange = e => { act('updateSettings', { patch: { soundVolume: Number(e.target.value) } }); FX.sound.pop(); };
    $$('[data-snd]', root).forEach(b => b.onclick = () => { const was = window.__sounds; window.__sounds = true; FX.sound[b.dataset.snd](); window.__sounds = was; });
    $$('[data-theme]', root).forEach(b => b.onclick = () => Polish.morph(() => { Look.apply(Object.assign({}, S.settings, { theme: b.dataset.theme })); }).then(() => act('updateSettings', { patch: { theme: b.dataset.theme } })).then(() => renderSettings()));
    $$('[data-appear]', root).forEach(b => b.onclick = () => {
      $$('[data-appear]', root).forEach(x => x.classList.toggle('on', x === b));
      Polish.morph(() => { Look.apply(Object.assign({}, S.settings, { appearance: b.dataset.appear })); }).then(() => act('updateSettings', { patch: { appearance: b.dataset.appear } }));
    });
    $$('[data-accent]', root).forEach(b => b.onclick = () => act('updateSettings', { patch: { accent: b.dataset.accent } }).then(() => renderSettings()));
    $('#accentPick').onchange = e => act('updateSettings', { patch: { accent: e.target.value } }).then(() => renderSettings());
    $('#accentPick').oninput = e => Look.apply(Object.assign({}, S.settings, { accent: e.target.value }));
    $$('[data-motion]', root).forEach(b => b.onclick = () => act('updateSettings', { patch: { motion: b.dataset.motion } }).then(() => renderSettings()));
    $$('[data-zoom]', root).forEach(b => b.onclick = () => act('updateSettings', { patch: { zoom: Number(b.dataset.zoom) } }).then(() => renderSettings()));
    const ci = $('#clearIgnored'); if (ci) ci.onclick = () => act('updateSettings', { patch: { ignoredNames: [] } }).then(() => renderSettings());
    $('#expBackup').onclick = async () => { const f = await act('exportBackup'); if (f) toast(t('Záloha uložená.')); };
    $('#openData').onclick = () => act('openDataFolder');
    $('#openLogs').onclick = () => act('openLogs');
    $('#rerunOb').onclick = () => Onboarding.open(obCtx());

    // zoznamy (typy kontaktu a zákaziek)
    $$('[data-list]', root).forEach(box => {
      const key = box.dataset.list;
      const cur = () => key === 'contactTypes' ? L.contactTypes(S.settings) : L.projectTypes(S.settings);
      const put = list => {
        const patch = { [key]: list };
        const defKey = key === 'contactTypes' ? 'defaultContact' : 'defaultType';
        if (!list.includes(S.settings[defKey])) patch[defKey] = list[0];
        act('updateSettings', { patch }).then(renderSettings);
      };
      $$('[data-rm]', box).forEach(b => b.onclick = () => { const l = cur().filter(x => x !== b.dataset.rm); if (!l.length) return toast(t('Aspoň jedna možnosť musí ostať.')); put(l); });
      const inp = $('input', box);
      inp.onkeydown = e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = inp.value.trim().slice(0, 40);
        if (!v || cur().some(x => L.normalize(x) === L.normalize(v))) { inp.value = ''; return; }
        put(cur().concat([v]));
      };
    });
    $('#resetLists').onclick = () => act('updateSettings', { patch: { contactTypes: L.CONTACTS.slice(), projectTypes: L.TYPES.slice(), defaultContact: L.DEFAULT_SETTINGS.defaultContact, defaultType: L.DEFAULT_SETTINGS.defaultType } }).then(() => { toast(t('Zoznamy obnovené.')); renderSettings(); });

    // programy na meranie času
    const saveEditors = () => {
      const picked = $$('[data-ed]', root).filter(c => c.checked).map(c => c.dataset.ed);
      const extra = $('#edCustom', root).value.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
      act('updateSettings', { patch: { editorApps: picked.concat(extra.filter(x => !picked.includes(x))).join('\n') } });
    };
    $$('[data-ed]', root).forEach(c => c.onchange = () => { c.closest('.ed-chip').classList.toggle('on', c.checked); saveEditors(); });
    $('#edCustom', root).onchange = saveEditors;

    // diagnostika merania
    act('debugTracker').then(d => {
      const box = $('#trackDiag'); if (!box) return;
      if (!d.supported) box.textContent = t('Tento počítač nie je Windows, automatické meranie nebeží.');
      else if (d.last) {
        const HOW = { folder: t('podľa priečinka'), name: t('podľa názvu'), similar: t('podľa podobného názvu'), client: t('podľa klienta'), title: t('podľa názvu okna') };
        box.textContent = t('Práve v popredí: {app}', { app: L.editorName(d.last.proc || '?') }) + (d.live.mode === 'auto' ? t(', meriam') : '')
          + (d.info ? (d.info.untitled ? t('. Projekt nemá názov.') : t('. Projekt „{name}“', { name: d.info.name }) + (d.match ? t(' patrí k zákazke {title} ({how}).', { title: d.match.title, how: HOW[d.match.how] || d.match.how }) : t(' zatiaľ nepatrí k žiadnej zákazke.'))) : '.');
      }
      else box.textContent = t('Čakám na prvé dáta…');
    }).catch(() => { });

    // mobil
    if (st.remoteEnabled) {
      act('remoteInfo').then(info => {
        const box = $('#remoteBox'); if (!box) return;
        if (info.error) { box.innerHTML = `<p class="hint" style="color:var(--rec)">${esc(info.error)}</p>`; return; }
        if (!info.addresses.length) { box.innerHTML = `<p class="hint">${t('Nenašiel som sieť. Si pripojený na wifi alebo kábel?')}</p>`; return; }
        box.innerHTML = `<div class="qr-wrap"><div class="qr"><img id="qrImg" alt="${t('QR kód pre mobil')}"></div><div class="addr">${info.addresses.map((a, i) => `<button class="li${i === 0 ? ' on' : ''}" data-qr="${i}"><span class="tag ${a.kind === 'tailscale' ? 'ts' : ''}">${a.kind === 'tailscale' ? t('Tailscale, všade') : t('Wifi, doma')}</span><span class="grow path" style="color:var(--text)">${esc(a.ip)}:${info.port}</span><span class="dim">${esc(a.name)}</span></button>`).join('')}
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px"><div class="field" style="width:110px"><input data-s2="remotePort" type="number" value="${esc(info.port)}" title="Port"></div><button class="btn ghost small" id="resetTok">${t('Zmeniť prístupový kód')}</button></div>
          <p class="hint">${t('Odkaz obsahuje tajný kód. Keď ho zmeníš, starý odkaz na mobile prestane fungovať. Pri prvom spustení sa Windows môže opýtať na firewall, povoľ súkromné siete.')}</p></div></div>`;
        const show = i => { $('#qrImg').src = info.addresses[i].qr; $$('[data-qr]', box).forEach(b => b.classList.toggle('on', +b.dataset.qr === i)); };
        show(0);
        $$('[data-qr]', box).forEach(b => b.onclick = () => show(+b.dataset.qr));
        $('#resetTok').onclick = () => act('resetToken').then(() => renderSettings());
        $('[data-s2=remotePort]', box).onchange = e => act('updateSettings', { patch: { remotePort: Number(e.target.value) || 4747 } }).then(() => setTimeout(renderSettings, 400));
      }).catch(() => { });
    }

    // zálohy
    act('listBackups').then(list => {
      const box = $('#backupList'); if (!box) return;
      if (!list || !list.length) { box.innerHTML = `<p class="hint">${t('Prvá záloha sa urobí pri najbližšom uložení.')}</p>`; return; }
      box.innerHTML = list.slice(0, 8).map(b => `<div class="li"><span class="grow">${new Date(b.date + 'T12:00').toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="dim">${(b.size / 1024).toFixed(0)} kB</span><button class="btn ghost small" data-restore="${esc(b.name)}">${t('Obnoviť#restore')}</button></div>`).join('') + (list.length > 8 ? `<p class="hint">${t('…a {n} starších v priečinku s dátami.', { n: list.length - 8 })}</p>` : '');
      $$('[data-restore]', box).forEach(b => {
        let armed = false;
        b.onclick = async () => {
          if (!armed) { armed = true; b.textContent = t('Naozaj? Prepíše to dnešok'); b.classList.add('danger'); setTimeout(() => { armed = false; b.textContent = t('Obnoviť#restore'); b.classList.remove('danger'); }, 3500); return; }
          await act('restoreBackup', { name: b.dataset.restore });
          toast(t('Dáta obnovené zo zálohy. Aktuálny stav som si predtým odložil.'), { icon: '↩' });
        };
      });
    }).catch(() => { });

    renderAi();
    renderUpdate();
    renderCloud();
  }

  /* ---------------- vlastná online databáza ---------------- */
  let cloudInfo = null;
  const ago = iso => { if (!iso) return t('ešte nie'); const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? t('práve teraz') : m < 60 ? t('pred {n} min', { n: m }) : t('o {time}', { time: new Date(iso).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) }); };
  async function renderCloud(fresh) {
    const box = $('#cloudBox'); if (!box) return;
    cloudInfo = fresh ? Object.assign(cloudInfo || {}, fresh) : await act('syncStatus').catch(() => null);
    const c = cloudInfo; if (!c || !$('#cloudBox')) return;
    if (!c.configured) {
      box.innerHTML = `<p class="desc">${t('Každý si spraví vlastnú bezplatnú databázu na Supabase. Appka ťa prevedie krokmi, zaberie to asi 5 minút. Potom máš zákazky, čas aj nápady na každom PC, kde sa prihlásiš, a v mobile aj bez zapnutého PC. K dátam nemá prístup nikto okrem teba.')}</p>
        <div class="row-btns"><button class="btn primary small" data-cl="setup">${t('Nastaviť vlastnú databázu')}</button><button class="btn small" data-cl="have">${t('Mám už databázu')}</button></div>`;
    } else if (!c.signedIn) {
      box.innerHTML = `<div class="ai-state warn"><span class="dot warn"></span><div class="grow"><b>${t('Nie si prihlásený')}</b><span>${esc(c.url)}</span></div></div>
        <div class="fields" style="margin-top:12px"><div class="field"><label>${t('E-mail')}</label><input id="clEmail" type="email" value="${esc(c.email || '')}" autocomplete="username"></div><div class="field"><label>${t('Heslo')}</label><input id="clPass" type="password" autocomplete="current-password"></div></div>
        <div class="row-btns"><button class="btn primary small" data-cl="login">${t('Prihlásiť sa')}</button><button class="btn ghost small" data-cl="disconnect">${t('Odpojiť databázu')}</button></div><p class="hint" id="clErr"></p>`;
    } else {
      box.innerHTML = `<div class="ai-state ${c.error ? 'warn' : 'on'}"><span class="dot ${c.error ? 'warn' : 'on'}"></span><div class="grow"><b>${c.busy ? t('Synchronizujem…') : c.error ? t('Synchronizácia sa nepodarila') : t('Synchronizované {when}', { when: ago(c.lastSync) })}</b><span>${c.error ? esc(c.error) : esc(c.email) + ', ' + tp(c.items, '{n} položka', '{n} položky', '{n} položiek') + (c.files ? ', ' + tp(c.files, '{n} obrázok', '{n} obrázky', '{n} obrázkov') : '')}</span></div><button class="btn ghost small" data-cl="now">${t('Synchronizovať')}</button></div>
        <div class="box-in" style="margin-top:14px"><b>${t('Ďalšie zariadenie')}</b><p class="hint" style="margin:4px 0 10px">${t('Na inom PC: Nastavenia → Online databáza → Mám už databázu, vlož tento kód a prihlás sa. Heslo v kóde nie je.')}</p>
          <div class="code-row"><input readonly value="${esc(c.code || '')}" id="clCode"><button class="btn small" data-cl="copycode">${t('Kopírovať kód')}</button></div>
          <div id="clQr" class="cl-qr"></div></div>
        <div class="row-btns" style="margin-top:12px"><button class="btn ghost small" data-cl="pass">${t('Zmeniť heslo')}</button><button class="btn ghost small" data-cl="logout">${t('Odhlásiť')}</button><button class="btn ghost small" data-cl="disconnect">${t('Odpojiť databázu')}</button></div>
        <div class="box-in" id="clPassBox" hidden style="margin-top:10px"><b>${t('Nové heslo')}</b><p class="hint" style="margin:4px 0 10px">${t('Platí pre všetky zariadenia aj mobil. Toto PC ostane prihlásené.')}</p>
          <div class="field"><input type="password" id="clNew1" placeholder="${t('Nové heslo (aspoň 8 znakov)')}" autocomplete="new-password"></div>
          <div class="field" style="margin-top:8px"><input type="password" id="clNew2" placeholder="${t('Ešte raz pre kontrolu')}" autocomplete="new-password"></div>
          <div class="err" id="clPassErr" style="color:var(--rec);min-height:1.2em;margin-top:6px;font-size:12.5px"></div>
          <div class="row-btns"><button class="btn primary small" data-cl="passsave">${t('Uložiť heslo')}</button></div></div>`;
      act('syncQr').then(q => { const el2 = $('#clQr'); if (!el2) return; el2.innerHTML = q ? `<img src="${q.qr}" alt="${t('QR kód pre mobil')}"><div><b>${t('Mobil')}</b><p class="hint">${t('Naskenuj kód, prihlás sa a pridaj si stránku na plochu. Funguje aj bez zapnutého PC.')}</p></div>` : `<p class="hint">${t('Mobilnú stránku zapneš pri vydaní appky (návod vo VYDANIE.md).')}</p>`; }).catch(() => { });
    }
    $$('[data-cl]', box).forEach(b => b.onclick = async () => {
      const k = b.dataset.cl;
      if (k === 'setup') return cloudWizard();
      if (k === 'have') return cloudHave();
      if (k === 'now') { b.disabled = true; renderCloud(await act('syncNow').catch(() => null)); return; }
      if (k === 'copycode') { await act('writeClipboard', { text: c.code }); toast(t('Kód je v schránke.'), { icon: 'copy' }); return; }
      if (k === 'pass') { const pb = $('#clPassBox'); pb.hidden = !pb.hidden; if (!pb.hidden) $('#clNew1').focus(); return; }
      if (k === 'passsave') {
        const p1 = $('#clNew1').value, p2 = $('#clNew2').value, err = $('#clPassErr');
        err.textContent = '';
        if (p1.length < 8) { err.textContent = t('Heslo musí mať aspoň 8 znakov.'); return; }
        if (p1 !== p2) { err.textContent = t('Heslá sa nezhodujú.'); return; }
        b.disabled = true;
        try { await api.action('syncPassword', { password: p1 }); toast(t('Heslo je zmenené. Na mobile sa prihlás novým.'), { icon: '🔑' }); $('#clPassBox').hidden = true; $('#clNew1').value = $('#clNew2').value = ''; }
        catch (e) { err.textContent = e.message; }
        b.disabled = false; return;
      }
      if (k === 'logout') { await act('syncLogout'); toast(t('Odhlásené. Dáta na tomto PC ostali.')); return renderCloud(); }
      if (k === 'disconnect') {
        if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = t('Naozaj odpojiť?'); setTimeout(() => { b.dataset.armed = ''; b.textContent = t('Odpojiť databázu'); }, 3500); return; }
        await act('syncDisconnect'); toast(t('Databáza odpojená. Dáta na tomto PC ostali.')); return renderCloud();
      }
      if (k === 'login') {
        b.disabled = true; $('#clErr').textContent = '';
        try { const r = await api.action('syncLogin', { email: $('#clEmail').value, password: $('#clPass').value }); toast(t('Prihlásené. Stiahol som {items}.', { items: tp(r.pulled || 0, '{n} položku', '{n} položky', '{n} položiek') })); renderCloud(); }
        catch (e) { $('#clErr').textContent = e.message; b.disabled = false; }
      }
    });
  }
  api.on('sync', st => { if (view === 'settings') renderCloud(st); });

  /* sprievodca: vlastná databáza krok za krokom */
  function cloudWizard(start) {
    let step = start || 0, ref = '', created = null;
    const w = el(`<div class="cw-wrap"><div class="cw"><button class="cw-x" aria-label="${t('Zavrieť')}">✕</button><div class="cw-dots"></div><div class="cw-body"></div></div></div>`);
    document.body.appendChild(w);
    const close = () => { w.remove(); renderCloud(); };
    $('.cw-x', w).onclick = close;
    w.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    const STEPS = ['intro', 'project', 'keys', 'sql', 'account', 'done'];
    const draw = () => {
      $('.cw-dots', w).innerHTML = STEPS.map((x, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
      const b = $('.cw-body', w);
      const id = STEPS[step];
      if (id === 'intro') b.innerHTML = `<h2>${t('Vlastná online databáza')}</h2><p>${t('Tvoje zákazky, čas a nápady budú v databáze, ktorá patrí len tebe. Použijeme Supabase, má bezplatný plán, ktorý ti bohato stačí.')}</p>
        <ul class="cw-list"><li>${t('Zaberie to asi 5 minút.')}</li><li>${t('Budeš potrebovať e-mail alebo GitHub či Google účet.')}</li><li>${t('Nič neplatíš. Bezplatný projekt sa po týždni bez používania uspí a obnovíš ho jedným klikom.')}</li></ul>
        <div class="cw-acts"><button class="btn primary" data-n>${t('Začať')}</button></div>`;
      if (id === 'project') b.innerHTML = `<h2>${t('1. Vytvor projekt')}</h2><ol class="cw-list">
          <li>${t('Otvor Supabase a prihlás sa (najrýchlejšie cez GitHub alebo Google).')}</li>
          <li>${t('Klikni <b>New project</b>. Názov napr. <b>WorkingOnIt</b>, heslo databázy si nechaj vygenerovať (netreba si ho pamätať), región <b>Central EU (Frankfurt)</b>.')}</li>
          <li>${t('Klikni <b>Create new project</b> a počkaj asi minútu, kým sa pripraví.')}</li></ol>
        <div class="cw-acts"><button class="btn" data-open="https://supabase.com/dashboard/new/new-project">${t('Otvoriť Supabase')}</button><span class="grow"></span><button class="btn ghost" data-b>${t('Späť')}</button><button class="btn primary" data-n>${t('Projekt beží')}</button></div>`;
      if (id === 'keys') b.innerHTML = `<h2>${t('2. Adresa a kľúč')}</h2><p>${t('V projekte otvor <b>Project Settings → API Keys</b> (alebo tlačidlo <b>Connect</b> hore). Skopíruj <b>Project URL</b> a kľúč <b>publishable</b> (v starších projektoch <b>anon public</b>). Tajný kľúč (secret, service_role) sem nikdy nedávaj.')}</p>
        <div class="fields"><div class="field full"><label>Project URL</label><input id="cwUrl" placeholder="https://abcd1234.supabase.co"></div><div class="field full"><label>${t('Kľúč publishable alebo anon public')}</label><input id="cwKey" placeholder="${t('sb_publishable_… alebo eyJhbGciOi…')}"></div></div>
        <p class="cw-err" id="cwErr"></p>
        <div class="cw-acts"><button class="btn" data-open="https://supabase.com/dashboard/project/_/settings/api-keys">${t('Otvoriť API Keys')}</button><span class="grow"></span><button class="btn ghost" data-b>${t('Späť')}</button><button class="btn primary" id="cwCheck">${t('Overiť')}</button></div>`;
      if (id === 'sql') b.innerHTML = `<h2>${t('3. Priprav databázu')}</h2><ol class="cw-list"><li>${t('Klikni <b>Kopírovať kód</b>.')}</li><li>${t('Otvor <b>SQL Editor</b>, vlož kód (Ctrl+V) a klikni <b>Run</b>.')}</li><li>${t('Dole by sa malo ukázať „WorkingOnIt je pripravený ✓“.')}</li></ol>
        <p class="hint">${t('Kód vytvorí jednu tabuľku, priečinok na obrázky a pravidlá, aby k dátam mal prístup len tvoj účet.')}</p>
        <p class="cw-err" id="cwErr"></p>
        <div class="cw-acts"><button class="btn" id="cwCopy">${t('Kopírovať kód')}</button><button class="btn" data-open="https://supabase.com/dashboard/project/${esc(ref || '_')}/sql/new">${t('Otvoriť SQL Editor')}</button><span class="grow"></span><button class="btn ghost" data-b>${t('Späť')}</button><button class="btn primary" id="cwSchema">${t('Hotovo, overiť')}</button></div>`;
      if (id === 'account') b.innerHTML = `<h2>${t('4. Tvoj účet')}</h2><p>${t('Týmto e-mailom a heslom sa prihlásiš na ďalšom PC aj v mobile. Databáza bude mať len tento jeden účet.')}</p>
        <div class="fields"><div class="field full"><label>${t('E-mail')}</label><input id="cwEmail" type="email" autocomplete="username" value="${esc(cloudInfo && cloudInfo.email || '')}"></div><div class="field full"><label>${t('Heslo (aspoň 8 znakov)')}</label><input id="cwPass" type="password" autocomplete="new-password"></div></div>
        <p class="cw-err" id="cwErr"></p>
        <div class="cw-acts"><span class="grow"></span><button class="btn ghost" data-b>${t('Späť')}</button><button class="btn primary" id="cwCreate">${t('Vytvoriť účet a nahrať dáta')}</button></div>`;
      if (id === 'done') b.innerHTML = `<h2>${t('Hotovo')}</h2><p>${t('Nahral som {items}. Odteraz sa zmeny synchronizujú samy, keď je appka zapnutá.', { items: tp(created ? created.pushed : 0, '{n} položku', '{n} položky', '{n} položiek') })}</p>
        <p>${t('Ďalšie PC a mobil pripojíš v <b>Nastavenia → Online databáza</b>, nájdeš tam kód aj QR kód.')}</p>
        <div class="cw-acts"><span class="grow"></span><button class="btn primary" id="cwEnd">${t('Super')}</button></div>`;
      $$('[data-n]', b).forEach(x => x.onclick = () => { step++; draw(); });
      $$('[data-b]', b).forEach(x => x.onclick = () => { step = Math.max(0, step - (id === 'account' ? 2 : 1)); draw(); });
      $$('[data-open]', b).forEach(x => x.onclick = () => act('openExternal', { url: x.dataset.open }));
      const err = m => { const e2 = $('#cwErr', b); if (e2) e2.textContent = m || ''; };
      const chk = $('#cwCheck', b); if (chk) chk.onclick = async () => {
        chk.disabled = true; err('');
        try {
          const r = await api.action('syncConnect', { url: $('#cwUrl', b).value, key: $('#cwKey', b).value });
          const m = String($('#cwUrl', b).value).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i); ref = m ? m[1] : '';
          step = r.schema ? 4 : 3; draw();
        } catch (e) { err(e.message); chk.disabled = false; }
      };
      const cp = $('#cwCopy', b); if (cp) cp.onclick = async () => { await act('syncCopySql'); cp.textContent = t('Skopírované ✓'); };
      const sc = $('#cwSchema', b); if (sc) sc.onclick = async () => {
        sc.disabled = true; err('');
        try { if (await api.action('syncCheckSchema')) { step = 4; draw(); } else { err(t('Tabuľku zatiaľ nevidím. Spustil si kód cez Run? Ak áno, počkaj pár sekúnd a skús znova.')); sc.disabled = false; } }
        catch (e) { err(e.message); sc.disabled = false; }
      };
      const cr = $('#cwCreate', b); if (cr) cr.onclick = async () => {
        cr.disabled = true; err(''); cr.textContent = t('Nahrávam…');
        try { created = await api.action('syncCreate', { email: $('#cwEmail', b).value, password: $('#cwPass', b).value }); step = 5; draw(); FX.sound.done(); }
        catch (e) { err(e.message + (/majiteľa|owner/i.test(e.message) ? t(' Ak je to tvoj účet, zavri sprievodcu a použi „Mám už databázu“.') : '')); cr.disabled = false; cr.textContent = t('Vytvoriť účet a nahrať dáta'); }
      };
      const end = $('#cwEnd', b); if (end) end.onclick = close;
      const f = $('input', b); if (f) setTimeout(() => f.focus(), 60);
    };
    draw();
  }

  /* pripojenie ďalšieho zariadenia: kód + prihlásenie */
  function cloudHave(afterLogin) {
    const w = el(`<div class="cw-wrap"><div class="cw"><button class="cw-x" aria-label="${t('Zavrieť')}">✕</button><div class="cw-body">
      <h2>${t('Mám už databázu')}</h2><p>${t('Vlož kód z prvého PC (Nastavenia → Online databáza) a prihlás sa svojím e-mailom a heslom.')}</p>
      <div class="fields"><div class="field full"><label>${t('Kód na pripojenie')}</label><input id="hvCode" placeholder="WOI1.…"></div>
      <div class="field"><label>${t('E-mail')}</label><input id="hvEmail" type="email" autocomplete="username"></div><div class="field"><label>${t('Heslo')}</label><input id="hvPass" type="password" autocomplete="current-password"></div></div>
      <details class="hint"><summary>${t('Nemám kód, mám adresu a kľúč')}</summary><div class="fields" style="margin-top:8px"><div class="field full"><label>Project URL</label><input id="hvUrl" placeholder="https://abcd1234.supabase.co"></div><div class="field full"><label>${t('Kľúč publishable alebo anon public')}</label><input id="hvKey"></div></div></details>
      <p class="cw-err" id="hvErr"></p>
      <div class="cw-acts"><span class="grow"></span><button class="btn primary" id="hvGo">${t('Prihlásiť a stiahnuť dáta')}</button></div></div></div></div>`);
    document.body.appendChild(w);
    const close = () => { w.remove(); renderCloud(); };
    $('.cw-x', w).onclick = close;
    setTimeout(() => $('#hvCode', w).focus(), 60);
    $('#hvGo', w).onclick = async () => {
      const b = $('#hvGo', w); b.disabled = true; b.textContent = t('Sťahujem…'); $('#hvErr', w).textContent = '';
      try {
        const code = $('#hvCode', w).value.trim();
        await api.action('syncConnect', code ? { code } : { url: $('#hvUrl', w).value, key: $('#hvKey', w).value });
        const r = await api.action('syncLogin', { email: $('#hvEmail', w).value, password: $('#hvPass', w).value });
        w.remove(); toast(t('Pripojené. Stiahol som {items}.', { items: tp(r.pulled || 0, '{n} položku', '{n} položky', '{n} položiek') })); FX.sound.done();
        renderCloud(); if (afterLogin) afterLogin(r);
      } catch (e) { $('#hvErr', w).textContent = e.message; b.disabled = false; b.textContent = t('Prihlásiť a stiahnuť dáta'); }
    };
  }

  /* ---------------- aktualizácie ---------------- */
  let updInfo = null;
  async function renderUpdate(fresh) {
    if (fresh) updInfo = fresh; else updInfo = await act('updateStatus').catch(() => null);
    const txtEl = $('#updTxt'), bx = $('#updBtns');
    if (!txtEl || !updInfo) return;
    const u = updInfo;
    let txt = '', btns = '';
    if (!u.supported) txt = u.reason === 'store' ? t('Aktualizácie rieši Microsoft Store.') : t('Spúšťaš appku zo zdrojákov (Spustit.bat). Automaticky sa aktualizuje nainštalovaná verzia.');
    else if (u.status === 'checking') txt = t('Hľadám novú verziu…');
    else if (u.status === 'downloading') txt = t('Sťahujem verziu {v}', { v: esc(u.version || '') }) + (u.percent ? ', ' + u.percent + ' %' : '');
    else if (u.status === 'ready') { txt = t('Verzia {v} je pripravená. Nainštaluje sa, keď appku zavrieš.', { v: esc(u.version) }); btns = `<button class="btn primary small" data-upd="install">${t('Reštartovať teraz')}</button>`; }
    else if (u.status === 'error') { txt = esc(u.error || t('Aktualizácia sa nepodarila.')); btns = `<button class="btn small" data-upd="check">${t('Skúsiť znova')}</button>`; }
    else { txt = t('Máš verziu {v}', { v: esc(u.current) }) + (u.status === 'latest' ? t(', je najnovšia.') : '.'); btns = `<button class="btn ghost small" data-upd="check">${t('Skontrolovať')}</button>`; }
    txtEl.innerHTML = txt;
    bx.innerHTML = btns;
    const tg = $('[data-s=updateChannel]'); if (tg) tg.checked = S.settings.updateChannel === 'beta';
    $$('[data-upd]', bx).forEach(b => b.onclick = async () => {
      if (b.dataset.upd === 'install') { act('updateInstall'); return; }
      b.disabled = true; renderUpdate(await act('updateCheck').catch(() => null));
    });
  }
  let updToastFor = null;
  api.on('update', u => {
    updInfo = u;
    if (view === 'settings') renderUpdate(u);
    if (u && u.status === 'ready' && updToastFor !== u.version) {
      updToastFor = u.version;
      toast(t('Nová verzia <b>{v}</b> je stiahnutá. Nainštaluje sa pri zavretí appky.', { v: esc(u.version) }), { icon: 'download', ms: 15000, actions: [{ label: t('Reštartovať teraz'), run: () => act('updateInstall') }] });
    }
  });

  async function renderClaudeBox() {
    const box = $('#claudeBox'); if (!box) return;
    const st = await act('claudeStatus').catch(e => ({ error: e.message }));
    if (!$('#claudeBox')) return;
    if (st.error) { box.innerHTML = `<p class="hint" style="color:var(--rec)">${esc(st.error)}</p>`; return; }
    if (!st.installed) { box.innerHTML = `<div class="claude-st"><span class="dot off"></span><div class="grow"><b>${t('Claude desktop appku som nenašiel')}</b><span>${t('Nainštaluj si ju z claude.ai/download a potom sa sem vráť.')}</span></div></div>`; return; }
    const others = Array.from(new Set(st.files.flatMap(f => f.others)));
    box.innerHTML = st.connected
      ? `<div class="claude-st"><span class="dot on"></span><div class="grow"><b>${t('Pripojené')}</b><span>${t('Ak si Claude práve mal otvorené, úplne ho ukonči (aj z lišty pri hodinách) a spusti znova. Potom uvidíš nástroje WorkingOnIt pri písaní správy.')}${others.length ? t(' Ostatné prepojenia ostali: {list}.', { list: esc(others.join(', ')) }) : ''}</span></div><button class="btn ghost small" id="clOff">${t('Odpojiť')}</button></div>`
      : `<div class="claude-st"><span class="dot off"></span><div class="grow"><b>${t('Zatiaľ nepripojené')}</b><span>${t('Pridám WorkingOnIt do nastavení Claude{others} a pôvodný súbor si zálohujem.', { others: others.length ? t(' (tvoje {list} tam ostane)', { list: esc(others.join(', ')) }) : '' })}</span></div><button class="btn primary small" id="clOn">${t('Pripojiť ku Claude')}</button></div>`;
    const on = $('#clOn'); if (on) on.onclick = async () => { await act('connectClaude'); toast(t('Hotovo. Reštartuj Claude desktop appku.'), { icon: '🔌' }); FX.sound.done(); renderClaudeBox(); };
    const off = $('#clOff'); if (off) off.onclick = async () => { await act('disconnectClaude'); toast(t('Odpojené.')); renderClaudeBox(); };
  }

  /* ---------------- lokálne AI: stav Ollamy a modely ---------------- */
  const pulls = {};
  let aiInfo = null;
  async function renderAi(start) {
    const stateBox = $('#aiState'), modelsBox = $('#aiModels');
    if (!stateBox) return;
    if (start) stateBox.innerHTML = `<span class="dot busy"></span><div class="grow"><b>${t('Spúšťam Ollamu…')}</b><span>${t('Zvyčajne to trvá pár sekúnd.')}</span></div>`;
    const a = aiInfo = await act('aiStatus', { start: !!start }).catch(() => null);
    if (!$('#aiState')) return;
    const st = S.settings;
    if (!a) { stateBox.innerHTML = `<span class="dot off"></span><div class="grow"><b>${t('Stav sa nepodarilo zistiť')}</b></div>`; return; }
    const cat = a.catalog || [];
    const rec = cat.find(m => m.name === a.recommended) || cat[0];
    const gpuTxt = a.gpu ? t('Grafika {name} ({vram} GB), pre ňu odporúčam {model}.', { name: esc(a.gpu.name), vram: a.gpu.vramGB, model: esc(rec ? rec.title : '') }) : '';
    const gbs = x => (x / 1073741824).toLocaleString(I18N.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    let html, cls;
    if (!a.running && !a.installed) {
      cls = 'off'; html = `<b>${t('Ollama nie je nainštalovaná')}</b><span>${t('Je to zadarmo program, cez ktorý beží AI priamo na tvojom PC. Po inštalácii sa sem vráť.')}</span>`;
      html += `</div><button class="btn primary small" data-ai="download">${t('Stiahnuť Ollamu')}</button><button class="btn ghost small" data-ai="check">${t('Skontrolovať znova')}</button>`;
    } else if (!a.running) {
      cls = 'off'; html = `<b>${t('Ollama nebeží')}</b><span>${a.error ? esc(a.error) : t('Je nainštalovaná, ale vypnutá, napríklad si ju ukončil pri hodinách.')} ${st.ollamaAutoStart !== false ? t('Pri prvej otázke ju spustím sám.') : ''}</span>`;
      html += `</div><button class="btn primary small" data-ai="start">${t('Spustiť Ollamu')}</button>`;
    } else if (!a.versionOk) {
      cls = 'warn'; html = `<b>${t('Ollama {v} je stará', { v: esc(a.version) })}</b><span>${t('Modely Gemma 4 potrebujú verziu {min} alebo novšiu. Aktualizuj ju (ikonka Ollamy pri hodinách → Update) alebo stiahni novú.', { min: esc(a.minVersion) })}</span>`;
      html += `</div><button class="btn small" data-ai="download">${t('Stiahnuť novú verziu')}</button>`;
    } else if (!a.models.length) {
      cls = 'warn'; html = `<b>${t('Ollama beží, ale nemáš stiahnutý model')}</b><span>${gpuTxt || t('Odporúčam Gemma 4 12B.')} ${t('Stiahneš ho nižšie jedným klikom.')}</span></div>`;
    } else {
      const ld = (a.loaded || [])[0];
      cls = 'on'; html = `<b>${t('Beží, {model}', { model: esc(a.model || '') })}</b><span>${ld ? t('Model je práve v pamäti grafiky ({gb} GB).', { gb: gbs(ld.vram) }) : t('Model spí, grafika je voľná.')} ${gpuTxt}</span>`;
      html += `</div>${ld ? `<button class="btn ghost small" data-ai="unload">${t('Uvoľniť z grafiky')}</button>` : ''}`;
    }
    stateBox.className = 'ai-state ' + cls;
    stateBox.innerHTML = `<span class="dot ${cls}"></span><div class="grow">${html}`;
    $$('[data-ai]', stateBox).forEach(b => b.onclick = async () => {
      const k = b.dataset.ai;
      if (k === 'download') act('aiOpenDownload');
      if (k === 'check') renderAi();
      if (k === 'start') { b.disabled = true; await renderAi(true); if (aiInfo && aiInfo.running) toast(t('Ollama beží.'), { icon: '🧠' }); }
      if (k === 'unload') { await act('aiUnload'); toast(t('Model uvoľnený z grafiky.')); renderAi(); }
    });

    // modely
    if (!modelsBox) return;
    const names = (a.models || []).map(m => m.name);
    const gb = b => gbs(b) + ' GB';
    const row = (name, title, size, note, isInst, isRec) => {
      const pr = pulls[name];
      const pct = pr && pr.total ? Math.round(pr.completed / pr.total * 100) : 0;
      return `<div class="ai-model${st.ollamaModel === name && isInst ? ' on' : ''}" data-row="${esc(name)}">
        <div class="grow"><b>${esc(title)}</b> <span class="dim">${esc(name)}, ${esc(size)}</span>${isRec ? ` <span class="badge good">${a.gpu ? t('Odporúčam pre tvoje PC') : t('Odporúčam')}</span>` : ''}${note ? `<small>${esc(note)}</small>` : ''}
          ${pr && !pr.error ? `<div class="pull"><i style="width:${pr.total ? pct : 3}%"></i></div><small class="pull-t">${esc(pr.status ? t(pr.status) : t('Sťahujem…'))}${pr.total ? t(', {pct} % z {size}', { pct, size: gb(pr.total) }) : ''}</small>` : ''}
          ${pr && pr.error ? `<small class="err">${esc(pr.error)}</small>` : ''}</div>
        ${isInst ? (st.ollamaModel === name || (!names.includes(st.ollamaModel) && a.model === name) ? `<span class="badge good">${t('Používam')}</span>` : `<button class="btn small" data-use="${esc(name)}">${t('Použiť')}</button>`) + `<button class="btn ghost small" data-del="${esc(name)}" title="${t('Zmazať z disku')}">${t('Zmazať')}</button>`
          : pr && !pr.error ? `<button class="btn ghost small" data-cancel="${esc(name)}">${t('Zrušiť')}</button>` : `<button class="btn ${isRec ? 'primary' : ''} small" data-pull="${esc(name)}"${a.running || a.installed ? '' : ` disabled title="${t('Najprv nainštaluj Ollamu')}"`}>${pr && pr.error ? t('Skúsiť znova') : t('Stiahnuť')}</button>`}
      </div>`;
    };
    const others = (a.models || []).filter(m => !cat.some(r => r.name === m.name));
    modelsBox.innerHTML = `<div class="sec-h"><h5>${t('Modely')}</h5><span class="aside">${t('Gemma 4 od Googlu vie zo všetkého, čo sa zmestí do bežnej grafiky, najlepšie po slovensky')}</span></div>
      ${cat.map(r => row(r.name, r.title, r.size, r.note, names.includes(r.name), r.name === a.recommended)).join('')}
      ${a.gpu ? '' : `<p class="hint">${t('Grafiku som nevedel zistiť. Na notebooku alebo s grafikou pod 10 GB vezmi radšej E4B alebo E2B.')}</p>`}
      ${others.length ? `<div class="lbl" style="margin:10px 0 6px">${t('Ďalšie stiahnuté')}</div>` + others.map(m => row(m.name, m.name.split(':')[0], gb(m.size), m.params ? t('{n} parametrov', { n: m.params }) : '', true, false)).join('') : ''}
      ${Object.keys(pulls).filter(n => !cat.some(r => r.name === n) && !names.includes(n)).map(n => row(n, n.split(':')[0], '?', '', false, false)).join('')}`;
    $$('[data-use]', modelsBox).forEach(b => b.onclick = () => act('updateSettings', { patch: { ollamaModel: b.dataset.use, ollamaEnabled: true } }).then(() => { toast(t('{name} teraz používa {model}.', { name: S.settings.mascotName || 'Kit', model: b.dataset.use })); renderSettings(); }));
    $$('[data-pull]', modelsBox).forEach(b => b.onclick = () => pullModel(b.dataset.pull));
    $$('[data-cancel]', modelsBox).forEach(b => b.onclick = () => act('aiPullCancel', { name: b.dataset.cancel }));
    $$('[data-del]', modelsBox).forEach(b => {
      let armed = false;
      b.onclick = async () => {
        if (!armed) { armed = true; b.textContent = t('Naozaj?'); setTimeout(() => { armed = false; b.textContent = t('Zmazať'); }, 3000); return; }
        await act('aiDelete', { name: b.dataset.del }); toast(t('Model zmazaný z disku.')); renderAi();
      };
    });
    const cp = $('#aiCustomPull'), ci = $('#aiCustom');
    if (cp && ci) {
      const go2 = () => { const n = ci.value.trim().toLowerCase(); if (!/^[a-z0-9][\w.\-/]*(:[\w.\-]+)?$/.test(n)) return toast(t('Napíš názov modelu, napr. qwen3.5:9b'), { kind: 'error' }); ci.value = ''; pullModel(n); };
      cp.onclick = go2; ci.onkeydown = e => { if (e.key === 'Enter') go2(); };
    }
  }
  function pullModel(name) {
    pulls[name] = { status: 'Pripravujem…', total: 0, completed: 0 }; // preloží sa pri vykreslení
    act('aiPull', { name }).catch(() => { delete pulls[name]; });
    renderAi();
  }
  api.on('ai', ev => {
    if (!ev || !ev.pull) return;
    if (ev.done) {
      if (ev.error) { pulls[ev.pull] = { error: ev.error }; toast(t('Model {name} sa nestiahol: {err}', { name: ev.pull, err: ev.error }), { kind: 'error' }); }
      else {
        delete pulls[ev.pull];
        const first = !(aiInfo && aiInfo.models && aiInfo.models.length);
        if (first) act('updateSettings', { patch: { ollamaModel: ev.pull, ollamaEnabled: true } });
        toast(t('Model <b>{name}</b> je stiahnutý.', { name: esc(ev.pull) }) + (first ? t(' {mascot} ho odteraz používa.', { mascot: esc(S.settings.mascotName || 'Kit') }) : ''), { icon: '🧠', actions: first ? [] : [{ label: t('Použiť'), run: () => act('updateSettings', { patch: { ollamaModel: ev.pull, ollamaEnabled: true } }).then(() => view === 'settings' && renderSettings()) }] });
        FX.sound.done();
      }
    } else pulls[ev.pull] = { status: { 'pulling manifest': 'Pripravujem…', 'verifying sha256 digest': 'Overujem…', 'writing manifest': 'Dokončujem…', success: 'Hotovo' }[ev.status] || 'Sťahujem…', total: ev.total, completed: ev.completed };
    if (view !== 'settings') return;
    const box = $('#aiModels');
    const rowEl = box && $$('[data-row]', box).find(r => r.dataset.row === ev.pull);
    const pr = pulls[ev.pull];
    if (!ev.done && rowEl && $('.pull i', rowEl) && pr) {
      const pct = pr.total ? Math.round(pr.completed / pr.total * 100) : 3;
      $('.pull i', rowEl).style.width = pct + '%';
      const pt = $('.pull-t', rowEl); if (pt) pt.textContent = t(pr.status) + (pr.total ? t(', {pct} % z {size}', { pct, size: (pr.total / 1073741824).toLocaleString(I18N.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' GB' }) : '');
    } else renderAi();
  });

  async function importNotion() {
    const n = await act('importNotion');
    if (n == null) return;
    toast(n ? t('Importoval som {jobs} z Notionu.', { jobs: tp(n, '{n} zákazku', '{n} zákazky', '{n} zákaziek') }) : t('Nič nové na import, všetko už tu je.'), { icon: '📥' });
    if (n) { go('board'); cheer(); }
  }

  /* ---------------- projekt otvorený v editore, ktorý tu nie je ---------------- */
  function addFromEditor(ev) {
    openQuickAdd({ prefill: { title: ev.name, status: 'working' }, folder: ev.folder || null, claimName: ev.name, fromId: ev.focusId, app: ev.app,
      hint: t('Projekt z {app}{file}. Doplň klienta a cenu.', { app: ev.app, file: ev.file ? ', ' + ev.file.split(/[\\/]/).pop() : '' }) });
  }
  /* tracker sám pridal zákazku z projektu v programe */
  function onAutoAdded(ev) {
    const p = project(ev.id); if (!p) return;
    if (ev.merged) { toast(t('Projekt „{name}“ som priradil k <b>{title}</b>, je v jej priečinku.', { name: esc(ev.name), title: esc(p.title) }), { icon: '✓' }); return; }
    FX.sound.done();
    toast(t('Nová zákazka z {app}: <b>{title}</b>. Meriam na nej čas.', { app: esc(ev.app), title: esc(p.title) }), { icon: '+', ms: 14000, actions: [
      { label: t('Doplniť'), run: () => openDrawer(p.id) },
      { label: t('Patrí k…'), run: () => {
        const others = S.projects.filter(x => x.id !== p.id && L.isActive(x, S.settings));
        if (!others.length) return;
        popMenu({ x: innerWidth - 360, y: innerHeight - 120 }, others.map(x => ({ label: x.title, sub: x.client, color: sColor(x.status), run: () => act('mergeProject', { from: p.id, into: x.id }).then(() => toast(t('Spojené s <b>{title}</b>.', { title: esc(x.title) }))) })), t('Ku ktorej zákazke patrí?'));
      } },
      { label: t('Nie je to zákazka'), run: () => act('notAJob', { id: p.id }).then(() => toast(t('Dobre, tento projekt už nebudem pridávať.'))) }
    ] });
  }
  function onUnknownProject(ev) {
    if (ev.open) { addFromEditor(ev); return; }
    const focus = project(ev.focusId);
    const actions = [{ label: t('Pridať'), primary: true, run: () => addFromEditor(ev) }];
    actions.push({ label: focus ? t('Patrí k {title}', { title: focus.title }) : t('Patrí k…'), run: e => {
      if (focus) { act('aliasProject', { id: focus.id, name: ev.name }); toast(t('Odteraz viem, že „{name}“ je {title}.', { name: esc(ev.name), title: esc(focus.title) })); return; }
      menu(e.currentTarget, S.projects.filter(p => L.isActive(p, S.settings)).map(p => ({ label: p.title, sub: p.client, color: sColor(p.status), run: () => {
        act('aliasProject', { id: p.id, name: ev.name }); toast(t('Odteraz viem, že „{name}“ je {title}.', { name: esc(ev.name), title: esc(p.title) })); kitPrompt = null; updateMascot();
      } })), t('Ku ktorej zákazke patrí?'));
      return true;
    } });
    actions.push({ label: t('Nie, ignoruj'), run: () => act('ignoreName', { name: ev.name }) });
    askKit({ text: t('V {app} máš otvorený <b>{name}</b>, ale u mňa taká zákazka nie je. Pridáme ju?', { app: esc(ev.app), name: esc(ev.name) }), actions });
  }

  $('.lvl').addEventListener('click', () => go('profile'));
  $('.lvl').title = t('Profil, odznaky a recapy');

  /* ---------------- chat s Kitom ---------------- */
  const chat = Kit.createChat({ api, getState: () => S, toast, openSettings: () => { closeIdeaAndDrawer(); go('settings'); setTimeout(() => { const a = document.getElementById('set-ai'); if (a) a.scrollIntoView({ behavior: 'smooth' }); }, 400); } });

  /* ---------------- moduly: nápady, časová os, sprievodca ---------------- */
  const ctx = {
    getS: () => S, act, toast, esc, el, $, $$, L, ICON, FX, platform: PLATFORM,
    openDrawer: (id, from) => { if (ideas.isOpen()) ideas.close(true); openDrawer(id, from); },
    projectMenu, popMenu, closeMenu, askText, sColor, cheer, go,
    openQuickAdd: o => openQuickAdd(o), importNotion: () => importNotion(), cloudHave: after => cloudHave(after),
    get chat() { return chat; }
  };
  const ideas = Ideas.create(ctx);
  const timeline = Timeline.create(ctx);
  const obCtx = () => ctx;
  function closeIdeaAndDrawer() { if (ideas.isOpen()) ideas.close(true); if (openId) closeDrawer(); }
  $('#askKit').addEventListener('click', () => chat.isOpen() ? chat.close() : chat.open({ projectId: '' }));

  /* ---------------- spotlight v appke ---------------- */
  const spot = Spotlight.mount($('#spotWrap'), {
    getState: () => S,
    close: () => closeSpot(),
    run: async (a) => {
      closeSpot();
      switch (a.type) {
        case 'open': openDrawer(a.id); break;
        case 'quickAdd': openQuickAdd(a.text ? { text: a.text } : {}); break;
        case 'go': go(a.view); if (a.anchor) setTimeout(() => { const x = document.getElementById('set-' + a.anchor); if (x) x.scrollIntoView({ behavior: 'smooth' }); }, 400); break;
        case 'ask': chat.open({ q: a.q, projectId: '' }); break;
        case 'askProject': chat.open({ projectId: a.id }); break;
        case 'notion': importNotion(); break;
        case 'status': {
          const was = project(a.id) && project(a.id).status;
          await act('setStatus', { id: a.id, status: a.status });
          if (a.status === 'done' && was !== 'done') celebrate(a.id, innerWidth / 2, innerHeight / 3);
          else toast(`${esc(project(a.id).title)} → ${statusOf(a.status).label}`);
          break;
        }
        case 'pay': await act('addPayment', { id: a.id }); FX.sound.done(); toast(t('Platba zapísaná.'), { icon: '💸' }); break;
        case 'folder': act('openFolder', { id: a.id }); break;
        case 'timer': FX.sound.rec(); act('startTimer', { id: a.id || null }); break;
        case 'stopTimer': FX.sound.rec(); act('stopTimer'); break;
        case 'theme': act('updateSettings', { patch: { theme: a.theme } }); break;
        case 'recap': openRecap(...recapDefault()); break;
        case 'client': openClient(a.key); break;
        case 'idea': {
          if (!a.text) { closeIdeaAndDrawer(); go('ideas'); ideas.newIdea({ kind: a.kind || 'note' }); break; }
          const id = await act('captureIdea', { text: a.text });
          FX.sound.pop();
          toast(t('Nápad uložený: <b>{text}</b>', { text: esc(a.text.slice(0, 50)) }), { icon: '💡', actions: [{ label: t('Otvoriť'), run: () => { go('ideas'); ideas.open(id); } }] });
          break;
        }
      }
    }
  });
  async function openSpot() {
    if (!$('#modalWrap').hidden) return;
    let clip = '';
    try { clip = await api.action('readClipboard'); } catch (e) { }
    $('#spotWrap').classList.remove('closing');
    $('#spotWrap').hidden = false;
    spot.open(clip);
  }
  function closeSpot() {
    const w = $('#spotWrap');
    if (w.hidden || w.classList.contains('closing')) return;
    w.classList.add('closing');
    setTimeout(() => { if (!w.classList.contains('closing')) return; w.hidden = true; w.classList.remove('closing'); }, 130);
  }
  $('#spotWrap').addEventListener('mousedown', e => { if (e.target.id === 'spotWrap') closeSpot(); });
  $('#spotBtn').addEventListener('click', openSpot);

  /* ---------------- okno ---------------- */
  // ikonky sú v HTML obe, prepína sa len stav (žiadne prepisovanie SVG, nič neposkočí)
  function setMaxIcon(max) {
    const b = $('#winMax');
    b.classList.toggle('is-max', !!max);
    b.setAttribute('aria-label', max ? t('Obnoviť veľkosť') : t('Maximalizovať'));
  }
  $('#winMin').onclick = () => api.action('winMinimize');
  $('#winMax').onclick = async () => setMaxIcon(await api.action('winToggleMax'));
  $('#winClose').onclick = () => api.action('winClose');
  api.action('winIsMax').then(setMaxIcon).catch(() => { });

  /* ---------------- udalosti z hlavného procesu ---------------- */
  api.on('state', s => {
    // jazyk zmenený inde (napr. na inom PC cez online databázu): okno sa prekreslí celé
    if (I18N.LANGS.some(l => l.id === s.settings.language) && s.settings.language !== I18N.lang) { location.reload(); return; }
    const kitWas = JSON.stringify(S.settings.kit);
    S = s;
    I18N.setCurrency(S.settings.currency);
    Look.apply(S.settings);
    if (JSON.stringify(S.settings.kit) !== kitWas) { Mascot.configure(S.settings.kit); Mascot.refreshAll(); }
    clearTimeout(window.__achT); window.__achT = setTimeout(checkAchievements, 600);
    $('#askKitLabel').textContent = t('Opýtať sa {name}', { name: L.decl(S.settings.mascotName, 'gen') });
    if (chat.isOpen()) chat.render();
    if (!$('#spotWrap').hidden) spot.refresh();
    ideas.refresh();
    // sekciu neprekresľujeme, keď v nej práve píšeš (nastavenia, poznámky o klientovi, snippet…)
    const ae = document.activeElement;
    if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable) && $('#view-' + view).contains(ae)) { renderHeader(); renderLevel(); updateMascot(); if (openId) refreshDrawer(); return; }
    // karta sa presunula cez menu alebo Späť: všetky karty plynulo prejdú na nové miesta
    if (morphNext && Date.now() - morphNext < 2500 && view === 'board' && !openId && !drag) { morphNext = 0; Polish.morph(renderAll, { cls: 'vt-cards' }); return; }
    renderAll();
  });
  api.on('live', live => {
    const was = LIVE.mode;
    LIVE = live || { mode: 'off' };
    renderRec();
    if (view === 'board') renderBoard();
    if (was !== LIVE.mode) updateMascot();
  });
  api.on('tick', () => { renderHeader(); renderRec(); updateMascot(); if (view === 'board') renderBoard(); if (view === 'timeline' && !openId) renderTimeline(); });
  api.on('event', ev => {
    if (!ev) return;
    if (ev.type === 'quickAdd') { if ($('#modalWrap').hidden) openQuickAdd({ fromClipboard: ev.fromClipboard, text: ev.text }); }
    else if (ev.type === 'openProject') { if (ideas.isOpen()) ideas.close(true); if (!['board', 'archive', 'timeline'].includes(view)) go('board'); openDrawer(ev.id); }
    else if (ev.type === 'openIdea') { closeIdeaAndDrawer(); go('ideas'); ideas.open(ev.id); }
    else if (ev.type === 'recap') openRecap(...recapDefault());
    else if (ev.type === 'go') { if (ev.client) clientSel = ev.client; go(ev.view); if (ev.anchor) setTimeout(() => { const a = document.getElementById('set-' + ev.anchor); if (a) a.scrollIntoView({ behavior: 'smooth' }); }, 400); }
    else if (ev.type === 'ask') chat.open({ q: ev.q, projectId: ev.projectId || '' });
    else if (ev.type === 'maximized') setMaxIcon(ev.value);
    else if (ev.type === 'unknownProject') onUnknownProject(ev);
    else if (ev.type === 'autoAdded') onAutoAdded(ev);
    else if (ev.type === 'autoStatus') {
      const p = project(ev.id); if (!p) return;
      toast(t('<b>{title}</b> som presunul do stavu {status}, lebo na nej robíš.', { title: esc(p.title), status: esc(L.STATUSES.find(x => x.id === ev.to).label) }), { icon: '↻', actions: [{ label: t('Späť#undo'), run: () => { morphNext = Date.now(); act('setStatus', { id: ev.id, status: ev.from }); } }] });
    }
    else if (ev.type === 'toast') toast(ev.text, { kind: ev.kind });
    else if (ev.type === 'celebrate') {
      if (Date.now() - (localDone.get(ev.projectId) || 0) > 3000) { FX.confetti(innerWidth / 2, innerHeight / 3, 100); FX.sound.done(); cheer(); }
    } else if (ev.type === 'render') {
      FX.sound.render();
      const p = project(ev.projectId);
      if (p) {
        cheer(1800);
        const actions = [{ label: t('Ukázať'), run: () => act('revealFile', { path: ev.render.file }) }];
        if (['working', 'revisions'].includes(p.status)) actions.unshift({ label: t('Poslať do Review'), run: () => act('setStatus', { id: p.id, status: 'review' }) });
        toast(t('Render hotový: <b>{name}</b>, {title}', { name: esc(ev.render.name), title: esc(p.title) }), { icon: '🎬', actions });
      } else {
        toast(t('Nový render <b>{name}</b> nepatrí k žiadnemu projektu.', { name: esc(ev.render.name) }), { icon: '🎬', actions: [{ label: t('Priradiť'), run: () => go('time') }] });
      }
    }
  });

  /* ---------------- klávesy ---------------- */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#spotWrap').hidden ? openSpot() : closeSpot(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); chat.isOpen() ? chat.close() : chat.open({ projectId: openId || '' }); return; }
    if (e.key === 'Escape') {
      if (document.querySelector('.sk-wrap, .ob-wrap')) return;
      if (!$('#spotWrap').hidden) { closeSpot(); return; }
      if (!$('#modalWrap').hidden) { hideModal(); return; }
      if (ideas.isOpen()) {
        const a = document.activeElement;
        // prvé Esc len opustí rozpísané pole, druhé zavrie nápad
        if (a && a.closest('#ideaPage') && (a.matches('input, textarea, select') || a.isContentEditable)) { a.blur(); return; }
        ideas.close(); return;
      }
      if (chat.isOpen() && !openId) { chat.close(); return; }
      if (openId) { closeDrawer(); return; }
      closeMenu();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); openQuickAdd(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && view === 'board') { e.preventDefault(); const q = $('#q'); if (q) q.focus(); }
    if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) { e.preventDefault(); { const b = $$('#nav button[data-view]')[+e.key - 1]; if (b) b.click(); } }
  });

  /* ---------------- štart ---------------- */
  renderAll();
  moveNavInd(true);
  if (document.fonts) document.fonts.ready.then(() => moveNavInd(true));
  addEventListener('resize', () => moveNavInd(true));
  setInterval(() => updateMascot(true), 45000);
  setTimeout(checkAchievements, 1500);
  setTimeout(maybeOfferRecap, 4000);
  // po zmene jazyka v sprievodcovi sa okno načíta znova a sprievodca pokračuje
  const obAgain = (() => { try { const v = sessionStorage.getItem('woi-ob'); sessionStorage.removeItem('woi-ob'); return !!v; } catch (e) { return false; } })();
  if (obAgain || (!S.seenOnboarding && S.projects.length === 0)) setTimeout(() => Onboarding.open(ctx), 400);
  else if (!S.seenOnboarding) act('markOnboarded');
  // doterajší používateľ: raz sa spýtame na spúšťanie so systémom, inak meranie nebeží
  if (PLATFORM === 'win32' && S.seenOnboarding && !S.settings.launchAtLogin && !S.settings.askedLaunch && S.projects.length) {
    setTimeout(() => {
      act('updateSettings', { patch: { askedLaunch: true } });
      toast(t('Mám sa spúšťať s Windowsom? Inak nemeriam čas, kým ma neotvoríš.'), { icon: '↻', ms: 20000, actions: [
        { label: t('Áno'), run: () => act('updateSettings', { patch: { launchAtLogin: true } }).then(() => toast(t('Hotovo, odteraz štartujem potichu do lišty.'))) },
        { label: t('Nie'), run: () => { } }
      ] });
    }, 5000);
  }
  if (boot.recovered) setTimeout(() => toast(t('Súbor s dátami bol poškodený, obnovil som ho zo zálohy ({file}). Poškodenú verziu som odložil vedľa.', { file: boot.recovered }), { kind: 'error', ms: 15000 }), 1200);
})();
