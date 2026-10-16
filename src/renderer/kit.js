/* Kit: boopy a chat cez lokálne AI (Ollama) */
window.Kit = (function () {
  const t = (s, v) => I18N.t(s, v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- boop ---------- */
  const BOOPS = [
    'Boop prijatý. Ukladám do 05_Renders.',
    'Hej! To bol môj nos, nie tlačidlo Render.',
    'Ešte raz a pridám ti keyframe na ucho.',
    'Boop zaznamenaný. +0 XP, ale +100 k nálade.',
    'Opatrne, môj nos je v 4K.',
    'Ctrl+Z na ten boop? Nie. Ostáva.',
    'Ten boop prišiel o frame neskôr. Prerendrujem.',
    'Mrrp?',
    'Tento boop si dám na timeline ako SFX.',
    'Render boopu: 100 %. Export bez chýb.',
    'Moje uši práve spravili ease-in-out.',
    'Au. Teraz mám v nose motion blur.',
    'Nos mám kalibrovaný na Rec.709, cez HDR ma neboopuj.',
    'Píp. To nebol zvukový efekt, to som bol ja.',
    'Som líška, nie antistresová loptička. …dobre, ešte jeden.',
    'Boop? Boop. 🦊',
    'Za každý boop by som chcel {m}. Bol by som tvoj najlepší klient.',
    'Uložené ako Kit_boop_FINAL_final2.mp4',
    'Ten boop mal krásny timing. Na beat.',
    'Ak ma boopneš 10× za sebou, odomkneš… ďalší boop.',
    'Moja srsť sa práve pre-renderovala.',
    'Takto vyzerá J-cut: boop najprv počuješ, až potom ho vidíš. Boop.'
  ];
  let boopCount = 0, boopTimer = null, last = -1;
  function boopLine(S) {
    boopCount++;
    clearTimeout(boopTimer);
    boopTimer = setTimeout(() => { boopCount = 0; }, 6000);
    if (boopCount === 5) return t('Dobre, dobre, máš ma 😳');
    if (boopCount === 10) return t('Achievement odomknutý: <b>Profesionálny booper</b>. Teraz späť do práce?');
    if (boopCount > 12) return t(['…', 'Boop-limit dosiahnutý. Reštartujem nos.', 'Už ani nepípnem. Pípnem.'][boopCount % 3]);
    const hour = new Date().getHours();
    if ((hour >= 1 && hour < 5) && Math.random() < 0.4) return t('Je {time}. Aj boopy by už mali spať.', { time: new Date().toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) });
    const waiting = S.projects.filter(p => WOI.isActive(p, S.settings) && p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    if (waiting && waiting.client && Math.random() < 0.18) return t('Kým ma boopuješ, {client} čaká na <b>{title}</b>. Len hovorím.', { client: esc(waiting.client), title: esc(waiting.title) });
    let i; do { i = Math.floor(Math.random() * BOOPS.length); } while (i === last && BOOPS.length > 1);
    last = i;
    return t(BOOPS[i], { m: WOI.formatMoney(1) });
  }

  /* ---------- mini markdown ---------- */
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '', list = false, code = null;
    for (let l of lines) {
      if (/^\s*```/.test(l)) {
        if (code === null) { if (list) { html += '</ul>'; list = false; } code = []; }
        else { html += '<pre class="code">' + code.join('\n') + '</pre>'; code = null; }
        continue;
      }
      if (code !== null) { code.push(l); continue; }
      l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^#{1,4}\s+(.*)$/, '<b>$1</b>');
      const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!list) { html += '<ul>'; list = true; } html += '<li>' + li[1] + '</li>'; continue; }
      if (list) { html += '</ul>'; list = false; }
      html += l.trim() ? '<p>' + l + '</p>' : '';
    }
    if (list) html += '</ul>';
    if (code !== null) html += '<pre class="code">' + code.join('\n') + '</pre>';
    return html;
  }

  /* ---------- chat ---------- */
  function createChat({ api, getState, toast, openSettings }) {
    const root = document.getElementById('chat');
    const threads = new Map(); // 'i:'+ideaId | projectId | '' → [{role, content}]
    let projectId = '', ideaId = '', busy = null, status = null, phase = null, thinkLen = 0;

    const GENERAL = ['Čo mám dnes urobiť ako prvé?', 'Kto mi dlhuje a ako mu slušne napísať?', 'Ako som na tom tento mesiac?', 'Koľko si mám pýtať za 60 s intro?'];
    const FOR_PROJECT = ['Daj mi 5 nápadov na toto video', 'Rozpíš štruktúru videa po sekundách', 'Napíš klientovi update, ako to ide', 'Je cena za toto férová?'];
    const FOR_IDEA = ['Rozviň tento nápad do 3 smerov', 'Navrhni hook na prvé 3 sekundy', 'Aký storyboard by si spravil?', 'Akú hudbu a zvuky by si použil?'];
    const setup = (html, buttons) => `<div class="chat-setup">${html}<div class="row" style="display:flex;gap:8px;flex-wrap:wrap">${buttons}</div></div>`;

    const key = () => ideaId ? 'i:' + ideaId : projectId;
    function thread() { if (!threads.has(key())) threads.set(key(), []); return threads.get(key()); }
    function proj() { return getState().projects.find(p => p.id === projectId); }
    function idea() { return ideaId ? (getState().ideas || []).find(i => i.id === ideaId) : null; }
    const PHASE = { get starting() { return t('Spúšťam Ollamu…'); }, get loading() { return t('Načítavam model do grafiky…'); }, get thinking() { return t('Premýšľam…'); } };

    async function checkStatus() {
      try { status = await api.action('aiStatus'); } catch (e) { status = { running: false, models: [] }; }
      render();
    }

    function render() {
      const S = getState();
      const name = S.settings.mascotName || 'Kit';
      const p = proj(), it = idea();
      const msgs = thread();
      const enabled = S.settings.ollamaEnabled;
      const auto = S.settings.ollamaAutoStart !== false;
      let body = null;
      if (!enabled) {
        body = setup(`<p>${t('<b>{name}</b> vie odpovedať cez lokálne AI. Beží iba u teba na PC, je zadarmo a nič neodchádza na internet.', { name: esc(name) })}</p>
          <ol><li>${t('Nainštaluj si <b>Ollamu</b> z ollama.com (ak ju ešte nemáš).')}</li><li>${t('Zapni lokálne AI tlačidlom nižšie.')}</li><li>${t('V Nastaveniach → Lokálne AI stiahni odporúčaný model jedným klikom.')}</li></ol>`,
          `<button class="btn primary small" data-c="enable">${t('Zapnúť lokálne AI')}</button><button class="btn small" data-c="settings">${t('Otvoriť nastavenia AI')}</button>`);
      } else if (status && !status.running && !status.installed) {
        body = setup(`<p>${t('Na chat potrebujem <b>Ollamu</b>. Je zadarmo a beží iba u teba na PC.')}</p><ol><li>${t('Stiahni a nainštaluj ju z ollama.com.')}</li><li>${t('Vráť sa sem a klikni na Skontrolovať.')}</li></ol>`,
          `<button class="btn primary small" data-c="download">${t('Stiahnuť Ollamu')}</button><button class="btn small" data-c="check">${t('Skontrolovať')}</button>`);
      } else if (status && !status.running && !auto) {
        body = setup(`<p>${t('Ollama je nainštalovaná, ale nebeží. Môžem ju spustiť na pozadí.')}</p><p class="hint">${t('Ak chceš, aby som ju spúšťal sám, zapni to v Nastaveniach → Lokálne AI.')}</p>`,
          `<button class="btn primary small" data-c="start">${t('Spustiť Ollamu')}</button><button class="btn small" data-c="settings">${t('Nastavenia AI')}</button>`);
      } else if (status && status.running && status.versionOk === false) {
        body = setup(`<p>${t('Máš starú Ollamu ({v}). Modely Gemma 4 potrebujú verziu {min} alebo novšiu.', { v: esc(status.version || '?'), min: esc(status.minVersion || '0.22') })}</p><p class="hint">${t('Klikni na ikonku Ollamy pri hodinách → Update, alebo stiahni novú verziu.')}</p>`,
          `<button class="btn primary small" data-c="download">${t('Stiahnuť novú verziu')}</button><button class="btn small" data-c="check">${t('Skontrolovať')}</button>`);
      } else if (status && status.running && !status.models.length) {
        const rec = (status.catalog || []).find(m => m.name === status.recommended);
        body = setup(`<p>${t('Ollama beží, ale ešte nemáš stiahnutý model.')}${rec ? t(' Pre tvoje PC odporúčam <b>{title}</b> ({size}).', { title: esc(rec.title), size: esc(rec.size) }) : ''}</p>`,
          `${rec ? `<button class="btn primary small" data-c="pull" data-m="${esc(rec.name)}">${t('Stiahnuť {title}', { title: esc(rec.title) })}</button>` : ''}<button class="btn small" data-c="settings">${t('Nastavenia AI')}</button>`);
      }
      if (!body) {
        const hello = it ? t('Čo s nápadom <b>{title}</b>?', { title: esc(it.title || t('bez názvu')) }) : p ? t('Čo potrebuješ k <b>{title}</b>?', { title: esc(p.title) }) : t('Ahoj{name}! Spýtaj sa ma na zákazky, peniaze alebo nápady na video.', { name: S.settings.userName ? ' ' + esc(S.settings.userName) : '' });
        const sugg = it ? FOR_IDEA : p ? FOR_PROJECT : GENERAL;
        body = `<div class="chat-msgs" id="chatMsgs">
          ${msgs.length ? msgs.map((m, i) => `<div class="msg ${m.role}">${m.role === 'assistant' ? (busy && i === msgs.length - 1 && !m.content && phase ? `<span class="phase">${esc(PHASE[phase] || '')}${phase === 'thinking' && thinkLen ? ' <small>' + t('{n} tokenov', { n: Math.round(thinkLen / 4) }) + '</small>' : ''}</span>` : md(m.content || '')) + (busy && i === msgs.length - 1 ? '<i class="caret"></i>' : '') + (m.content && !(busy && i === msgs.length - 1) ? `<div class="msg-acts"><button class="msg-copy" data-copy="${i}">${t('Kopírovať')}</button>${/```/.test(m.content) ? `<button class="msg-copy" data-snip="${i}">${t('Uložiť do šablón')}</button>` : ''}${it ? `<button class="msg-copy" data-toidea="${i}">${t('Pridať do nápadu')}</button>` : ''}</div>` : '') : esc(m.content)}</div>`).join('')
          : `<div class="chat-hello"><div class="mascot" id="chatKit"></div><p>${hello}</p>${status && !status.running && auto ? `<p class="hint">${t('Ollamu spustím pri prvej otázke, chvíľu to potrvá.')}</p>` : ''}</div>`}
        </div>
        ${!msgs.length ? `<div class="chips">${sugg.map(x => t(x)).map(q => `<button class="chip-btn" data-s="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
        <div class="chat-input"><textarea id="chatIn" rows="1" placeholder="${t('Napíš {name}…', { name: esc(WOI.decl(name, 'dat')) })}"></textarea>${busy ? `<button class="btn small" data-c="stop">${t('Stop')}</button>` : `<button class="btn primary small" data-c="send">${t('Poslať')}</button>`}</div>`;
      }
      const ctxLabel = it ? `<span class="chat-ctx">${t('O nápade: <b>{title}</b>', { title: esc(it.title || t('bez názvu')) })}<button data-c="noctx" title="${t('Pýtať sa všeobecne')}">✕</button></span>`
        : p ? `<span class="chat-ctx">${t('O projekte: <b>{title}</b>', { title: esc(p.title) })}<button data-c="noctx" title="${t('Pýtať sa všeobecne')}">✕</button></span>` : '';
      const loaded = status && status.loaded && status.loaded.length ? status.loaded[0] : null;
      root.innerHTML = `<div class="chat-head"><div class="mini-kit" id="miniKit"></div><div class="grow"><b>${esc(name)}</b><small>${busy && phase ? esc(PHASE[phase] || '') : status && status.model ? esc(status.model) + (loaded ? t(' · v pamäti grafiky') : t(' · spí')) : status && !status.running ? t('Ollama zatiaľ nebeží') : t('lokálne AI')}</small></div>
          ${loaded ? `<button class="btn ghost small" data-c="unload" title="${t('Uvoľní model z grafiky hneď')}">${t('Uspať model')}</button>` : ''}
          <button class="btn ghost small" data-c="new">${t('Nový chat')}</button><button class="btn ghost small" data-c="close" aria-label="${t('Zavrieť')}">✕</button></div>
        ${ctxLabel}${body}`;
      Mascot.mount(root.querySelector('#miniKit'));
      const ck = root.querySelector('#chatKit'); if (ck) Mascot.mount(ck);
      const box = root.querySelector('#chatMsgs'); if (box) box.scrollTop = box.scrollHeight;
      const ta = root.querySelector('#chatIn');
      if (ta) {
        ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; });
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
        if (!busy) setTimeout(() => ta.focus(), 30);
      }
      root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => send(b.dataset.s));
      root.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { api.action('writeClipboard', { text: thread()[+b.dataset.copy].content }); toast(t('Skopírované.')); });
      root.querySelectorAll('[data-toidea]').forEach(b => b.onclick = async () => {
        const cur = idea(); if (!cur) return;
        const txt = thread()[+b.dataset.toidea].content;
        const add = md(txt).replace(/<pre class="code">/g, '<pre>');
        await api.action('saveIdea', { idea: { id: cur.id, html: (cur.html || '') + '<hr>' + add, text: (cur.text || '') + '\n\n' + txt } });
        toast(t('Pridané do nápadu.'), { icon: '💡' });
      });
      root.querySelectorAll('[data-snip]').forEach(b => b.onclick = () => {
        const i = +b.dataset.snip, msg = thread()[i].content, ask = (thread()[i - 1] || {}).content || t('Snippet od {name}', { name: WOI.decl(getState().settings.mascotName || 'Kit', 'gen') });
        const blocks = msg.match(/```[\w-]*\n?([\s\S]*?)```/g) || [];
        const code = blocks.map(x => x.replace(/^```[\w-]*\n?/, '').replace(/```$/, '').trim()).join('\n\n');
        const all = (ask + ' ' + msg).toLowerCase();
        const program = /fusion|lua|resolve|davinci/.test(all) ? 'resolve' : /premiere/.test(all) ? 'premiere' : /expression|after effects|\bae\b|wiggle|loopout|extendscript|jsx/.test(all) ? 'ae' : 'other';
        api.action('saveSnippet', { snippet: { program, title: ask.slice(0, 60), note: t('Od {name}', { name: WOI.decl(getState().settings.mascotName || 'Kit', 'gen') }), code } })
          .then(() => toast(t('Uložené do Šablóny → {program}.', { program: ({ resolve: 'DaVinci', ae: 'After Effects', premiere: 'Premiere', other: t('Ostatné') })[program] }), { icon: '📌' }));
      });
      root.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
        const c = b.dataset.c;
        if (c === 'close') close();
        if (c === 'new') { threads.set(key(), []); render(); }
        if (c === 'noctx') { projectId = ''; ideaId = ''; render(); }
        if (c === 'stop' && busy) api.action('aiStop', { id: busy });
        if (c === 'send') send(root.querySelector('#chatIn').value);
        if (c === 'unload') { await api.action('aiUnload'); toast(t('Model uvoľnený z grafiky.')); checkStatus(); }
        if (c === 'enable') { await api.action('updateSettings', { patch: { ollamaEnabled: true } }); checkStatus(); }
        if (c === 'settings') { close(); openSettings(); }
        if (c === 'download') api.action('aiOpenDownload');
        if (c === 'check') { status = null; render(); checkStatus(); }
        if (c === 'start') { b.disabled = true; b.textContent = t('Spúšťam…'); try { status = await api.action('aiStatus', { start: true }); } catch (e) { } render(); }
        if (c === 'pull') { api.action('aiPull', { name: b.dataset.m }); toast(t('Sťahujem model, priebeh uvidíš v Nastaveniach → Lokálne AI.'), { icon: '🧠' }); close(); openSettings(); }
      });
    }

    async function send(text) {
      text = String(text || '').trim();
      if (!text || busy) return;
      const msgs = thread();
      msgs.push({ role: 'user', content: text });
      const id = 'c' + Date.now();
      busy = id;
      msgs.push({ role: 'assistant', content: '' });
      render();
      try {
        phase = null; thinkLen = 0;
        await api.action('aiChat', { id, projectId: projectId || null, ideaId: ideaId || null, messages: msgs.slice(0, -1) });
      } catch (e) { msgs.pop(); busy = null; render(); }
    }

    api.on('ai', ev => {
      if (!ev || ev.id !== busy) return;
      const msgs = thread();
      const m = msgs[msgs.length - 1];
      if (ev.model) { if (status) status.model = ev.model; return; }
      if (ev.status || ev.thinking) {
        phase = ev.status || 'thinking'; if (ev.thinking) thinkLen = ev.thinking;
        if (!m.content) render();
        return;
      }
      if (ev.delta) {
        phase = null;
        m.content += ev.delta;
        const box = root.querySelector('#chatMsgs');
        const last = box && box.lastElementChild;
        if (last) { last.innerHTML = md(m.content) + '<i class="caret"></i>'; box.scrollTop = box.scrollHeight; }
      }
      if (ev.done) {
        busy = null; phase = null;
        if (ev.error) { m.content = (m.content ? m.content + '\n\n' : '') + '⚠ ' + ev.error; }
        if (!m.content) msgs.pop();
        render();
        checkStatus();
      }
    });

    function open(opts) {
      opts = opts || {};
      if ('projectId' in opts) projectId = opts.projectId || '';
      ideaId = opts.ideaId || '';
      if (opts.fresh) threads.set(key(), []);
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('open'));
      checkStatus();
      if (opts.q) setTimeout(() => send(opts.q), 50);
    }
    function close() { root.classList.remove('open'); setTimeout(() => { if (!root.classList.contains('open')) root.hidden = true; }, 300); }
    return { open, close, render, isOpen: () => !root.hidden };
  }

  return { boopLine, createChat, md };
})();
