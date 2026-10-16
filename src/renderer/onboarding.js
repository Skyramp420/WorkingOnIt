/* Sprievodca pri prvom spustení: meno, priečinky, programy, voliteľné veci. Dá sa spustiť znova z Nastavení. */
window.Onboarding = (function () {
  const t = (s, v) => I18N.t(s, v);
  const PRESETS = {
    video: { get name() { return t('Strih videa'); }, get desc() { return t('Footage, Audio (Music, SFX), Assets, Projekt, Renders, Final'); }, tpl: null },
    simple: { get name() { return t('Jednoduchá'); }, get desc() { return t('Footage, Projekt, Renders'); }, get tpl() { return '01_Footage\n02_' + t('Projekt') + '\n03_Renders'; } },
    none: { get name() { return t('Bez priečinkov'); }, get desc() { return t('Priečinky si robím sám'); }, tpl: null }
  };

  function open(ctx) {
    const { act, esc, L } = ctx;
    const I = n => ICONS.svg(n);
    const S = ctx.getS(), st = S.settings;
    const cur = String(st.editorApps || '').split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
    const d = {
      userName: st.userName || '', brand: st.brand || '', mascotName: st.mascotName || 'Kit',
      rootFolder: st.rootFolder || '', preset: st.autoCreateFolder === false ? 'none' : 'video',
      editors: new Set(cur), extraEditors: cur.filter(x => !L.EDITORS.some(e => e.exe.toLowerCase() === x.toLowerCase())),
      trackingEnabled: st.trackingEnabled !== false, ollamaEnabled: !!st.ollamaEnabled, remoteEnabled: !!st.remoteEnabled, launchAtLogin: st.launchAtLogin || !S.seenOnboarding
    };
    let step = 0, detected = [], ai = null;
    const steps = ['hello', 'folders', 'editors', 'extras', 'done'];

    const wrap = document.createElement('div');
    wrap.className = 'ob-wrap';
    wrap.innerHTML = `<div class="ob"><div class="ob-dots"></div><div class="ob-body"></div></div>`;
    document.body.appendChild(wrap);
    const body = wrap.querySelector('.ob-body'), dots = wrap.querySelector('.ob-dots');

    act('detectEditors').then(list => {
      detected = list || [];
      // čerstvá inštalácia: predvyber, čo je naozaj nainštalované
      if (detected.length && !S.projects.length && !S.sessions.length) d.editors = new Set(detected);
      if (steps[step] === 'editors') draw();
    }).catch(() => { });
    act('aiStatus').then(a => { ai = a; if (steps[step] === 'extras') draw(); }).catch(() => { ai = { running: false, installed: false }; });

    const nav = (back, next, nextLabel) => `<div class="ob-nav">${back ? `<button class="btn ghost" data-back>${t('Späť')}</button>` : '<span></span>'}<span class="grow"></span>${step < steps.length - 1 ? `<button class="btn ghost" data-skip>${t('Preskočiť sprievodcu')}</button>` : ''}<button class="btn primary" data-next>${nextLabel || t('Ďalej')}</button></div>`;
    const toggle = (k, title, sub, icon) => `<label class="ob-opt${d[k] ? ' on' : ''}"><span class="ob-ic">${I(icon)}</span><span class="t"><b>${title}</b><small>${sub}</small></span><input type="checkbox" data-k="${k}"${d[k] ? ' checked' : ''}></label>`;

    function draw() {
      dots.innerHTML = steps.map((s, i) => `<i class="${i === step ? 'on' : i < step ? 'past' : ''}"></i>`).join('');
      const s = steps[step];
      if (s === 'hello') {
        body.innerHTML = `<div class="seg ob-lang" role="group" aria-label="Jazyk / Language">${I18N.LANGS.map(l => `<button data-lang="${l.id}" class="${I18N.lang === l.id ? 'on' : ''}">${l.name}</button>`).join('')}</div>
          <div class="ob-hero"><div class="ob-kit" id="obKit"></div><div>
            <h1>${t('Ahoj! Ja som {name}.', { name: esc(d.mascotName) })}</h1>
            <p>${t('Pomôžem ti mať prehľad o zákazkách: čo robíš, dokedy to máš a koľko za to dostaneš. Čas meriam sám, keď strihaš, rendery si všimnem a z kopírovanej správy od klienta vyplním zákazku.')}</p></div></div>
          <div class="fields">
            <div class="field"><label>${t('Ako ti mám hovoriť?')}</label><input data-v="userName" value="${esc(d.userName)}" placeholder="${t('Tvoje meno alebo prezývka')}" autofocus></div>
            <div class="field"><label>${t('Tvoja značka alebo kanál')} <span class="dim">${t('(nepovinné)')}</span></label><input data-v="brand" value="${esc(d.brand)}" placeholder="${t('Napr. názov tvojho štúdia')}"></div>
          </div>
          <button class="ob-have" data-have>${t('Už mám WorkingOnIt na inom PC s online databázou')}</button>
          ${nav(false, true, t('Poďme na to'))}`;
        Mascot.mount(body.querySelector('#obKit')); Mascot.setMood(body.querySelector('#obKit'), 'happy');
        // druhé PC: prihlásenie do vlastnej databázy, nastavenia a zákazky sa stiahnu
        body.querySelector('[data-have]').onclick = () => ctx.cloudHave && ctx.cloudHave(() => finish(false));
        // jazyk: appka sa prekreslí v novom jazyku a sprievodca začne znova
        body.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { if (b.dataset.lang === I18N.lang) return; try { sessionStorage.setItem('woi-ob', '1'); } catch (e) { } act('updateSettings', { patch: { language: b.dataset.lang } }); });
      }
      if (s === 'folders') {
        const tpl = PRESETS[d.preset].tpl || (d.preset === 'video' ? (st.folderTemplate || L.defaultsFor(I18N.lang).folderTemplate) : '');
        body.innerHTML = `<h2>${I('folder')}${t('Kde máš projekty?')}</h2>
          <p class="lead">${t('Ku každej zákazke ti viem založiť priečinok so štruktúrou. V jeho Renders a Final potom sledujem nové videá.')}</p>
          <div class="field"><label>${t('Hlavný priečinok')}</label><div class="ob-path"><input data-v="rootFolder" value="${esc(d.rootFolder)}"><button class="btn small" data-pick>${t('Vybrať…')}</button></div><span class="hint">${t('Vytvorí sa až pri prvej zákazke.')}</span></div>
          <div class="ob-presets">${Object.entries(PRESETS).map(([k, p]) => `<button class="ob-preset${d.preset === k ? ' on' : ''}" data-preset="${k}"><b>${p.name}</b><small>${p.desc}</small></button>`).join('')}</div>
          ${tpl ? `<div class="preview-tree ob-tree">${esc(L.folderNameFrom(st.folderPattern || L.DEFAULT_SETTINGS.folderPattern, { client: t('Klient'), title: 'Intro', type: 'Edit' }, Date.now()))}\n${tpl.split('\n').map(l => '  '.repeat(l.split('/').length) + '└ ' + l.split('/').pop()).join('\n')}</div>` : ''}
          ${nav(true)}`;
      }
      if (s === 'editors') {
        const win = ctx.platform === 'win32';
        body.innerHTML = `<h2>${I('clock')}${t('V čom strihaš?')}</h2>
          <p class="lead">${t('Kým je niektorý z týchto programov v popredí a nie si preč od PC, meriam čas. Zákazku spoznám podľa názvu projektu v okne.')}${win ? '' : ' <b>' + t('Automatické meranie zatiaľ funguje len vo Windows.') + '</b>'}</p>
          <div class="ob-editors">${L.EDITORS.map(e => { const on = d.editors.has(e.exe); const found = detected.some(x => x.toLowerCase() === e.exe.toLowerCase()); return `<button class="ob-ed${on ? ' on' : ''}" data-ed="${esc(e.exe)}"><span class="ck">${on ? I('check') : ''}</span><b>${esc(e.name)}</b>${found ? `<small>${t('nájdené na PC')}</small>` : ''}</button>`; }).join('')}</div>
          ${toggle('trackingEnabled', t('Merať čas automaticky'), t('Keď to vypneš, môžeš stále spúšťať časovač ručne.'), 'clock')}
          ${nav(true)}`;
      }
      if (s === 'extras') {
        const aiLine = !ai ? t('Zisťujem, či máš Ollamu…')
          : ai.running ? t('Ollama beží') + (ai.models && ai.models.length ? t(', modelov: {n}', { n: ai.models.length }) : '') + '.' + (ai.gpu ? t(' Grafika: {name} ({vram} GB).', { name: esc(ai.gpu.name), vram: ai.gpu.vramGB }) : '')
          : ai.installed ? t('Ollama je nainštalovaná. Keď to zapneš, spustím ju sám.')
          : t('Treba nainštalovať Ollamu (zadarmo, ollama.com). Model si potom stiahneš v Nastaveniach.');
        body.innerHTML = `<h2>${I('sparkle')}${t('Pár voliteľných vecí')}</h2>
          <p class="lead">${t('Všetko sa dá kedykoľvek zmeniť v Nastaveniach.')}</p>
          ${toggle('ollamaEnabled', t('{name} odpovedá cez lokálne AI', { name: esc(d.mascotName) }), aiLine + t(' Beží iba u teba na PC, nič neodchádza na internet.'), 'chip')}
          ${ai && !ai.installed && !ai.running ? `<div class="ob-sub"><button class="btn small" data-ollama>${t('Stiahnuť Ollamu')}</button></div>` : ''}
          ${toggle('remoteEnabled', t('Zákazky aj v mobile'), t('V Nastaveniach → Mobil cez wifi potom naskenuješ QR kód. Funguje doma cez wifi, mimo domu cez Tailscale.'), 'phone')}
          ${toggle('launchAtLogin', t('Spúšťať so systémom'), t('Naštartujem sa potichu do lišty, aby meranie času bežalo hneď.'), 'rocket')}
          ${nav(true, true, t('Dokončiť'))}`;
      }
      if (s === 'done') {
        body.innerHTML = `<div class="ob-hero done"><div class="ob-kit" id="obKit"></div><div>
            <h1>${t('Hotovo{name}!', { name: d.userName ? ', ' + esc(d.userName) : '' })}</h1>
            <p>${t('Najrýchlejšie začneš tak, že skopíruješ správu od klienta a vložíš ju do novej zákazky. Kedykoľvek stlač <kbd>Ctrl K</kbd> a napíš, čo chceš urobiť.')}</p></div></div>
          <div class="ob-cta">
            <button class="btn primary" data-end="add">${I('plus')}${t('Pridať prvú zákazku')}</button>
            <button class="btn" data-end="notion">${t('Importovať z Notionu')}</button>
            <button class="btn ghost" data-end="look">${t('Rozhliadnuť sa')}</button>
          </div>`;
        Mascot.mount(body.querySelector('#obKit')); Mascot.setMood(body.querySelector('#obKit'), 'happy');
        FX.confetti(innerWidth / 2, innerHeight / 3, 120); FX.sound.level();
      }
      bind();
      const af = body.querySelector('[autofocus]'); if (af) setTimeout(() => af.focus(), 60);
      body.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }

    function bind() {
      body.querySelectorAll('[data-v]').forEach(inp => inp.oninput = () => { d[inp.dataset.v] = inp.value; });
      body.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => { d[inp.dataset.k] = inp.checked; inp.closest('.ob-opt').classList.toggle('on', inp.checked); });
      body.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { d.preset = b.dataset.preset; draw(); });
      body.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { const e = b.dataset.ed; d.editors.has(e) ? d.editors.delete(e) : d.editors.add(e); draw(); });
      const pick = body.querySelector('[data-pick]'); if (pick) pick.onclick = async () => { const f = await act('pickFolder', { defaultPath: d.rootFolder }); if (f) { d.rootFolder = f; draw(); } };
      const ol = body.querySelector('[data-ollama]'); if (ol) ol.onclick = () => act('aiOpenDownload');
      const back = body.querySelector('[data-back]'); if (back) back.onclick = () => { step--; draw(); };
      const skip = body.querySelector('[data-skip]'); if (skip) skip.onclick = () => finish(false);
      const next = body.querySelector('[data-next]'); if (next) next.onclick = () => { if (steps[step] === 'extras') finish(true); else { step++; draw(); } };
      body.querySelectorAll('[data-end]').forEach(b => b.onclick = () => {
        close();
        if (b.dataset.end === 'add') ctx.openQuickAdd({ fromClipboard: true });
        if (b.dataset.end === 'notion') ctx.importNotion();
      });
      body.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { const n = body.querySelector('[data-next]'); if (n) n.click(); } }));
    }

    async function finish(apply) {
      if (apply) {
        const patch = {
          userName: d.userName.trim(), brand: d.brand.trim(), rootFolder: d.rootFolder.trim() || st.rootFolder,
          autoCreateFolder: d.preset !== 'none', trackingEnabled: d.trackingEnabled,
          ollamaEnabled: d.ollamaEnabled, remoteEnabled: d.remoteEnabled, launchAtLogin: d.launchAtLogin,
          editorApps: Array.from(d.editors).concat(d.extraEditors.filter(x => !d.editors.has(x))).join('\n')
        };
        if (d.preset === 'simple') patch.folderTemplate = PRESETS.simple.tpl;
        if (d.preset === 'video') patch.folderTemplate = st.folderTemplate || L.defaultsFor(I18N.lang).folderTemplate;
        await act('updateSettings', { patch }).catch(() => { });
      }
      await act('markOnboarded').catch(() => { });
      if (apply) { step = steps.length - 1; draw(); } else close();
    }

    function close() {
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 220);
    }

    draw();
    return { close };
  }

  return { open };
})();
