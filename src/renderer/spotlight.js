/* Spotlight: jeden riadok na všetko. Používa sa v appke (Ctrl+K) aj v plávajúcom okne (globálna skratka). */
window.Spotlight = (function () {
  const L = window.WOI;
  const t = (s, v) => I18N.t(s, v), tp = (n, a, b, c, v) => I18N.tp(n, a, b, c, v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const G = {
    plus: '<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    play: '<path d="M7 4.5v11l9-5.5z" fill="currentColor"/>',
    stop: '<rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor"/>',
    go: '<path d="M4 10h11M11 5l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    ask: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V13A2.5 2.5 0 0 1 4 10.5z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    info: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v5M10 6.2v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    folder: '<path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6l1.8 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    money: '<rect x="2" y="5" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10.5" r="2.4" fill="currentColor"/>',
    clip: '<rect x="3" y="5" width="14" height="10" rx="3" fill="currentColor"/>',
    bulb: '<path d="M7.2 13.6c-1.6-1.1-2.7-2.9-2.7-5A5.5 5.5 0 0 1 10 3a5.5 5.5 0 0 1 5.5 5.6c0 2.1-1.1 3.9-2.7 5v1.4H7.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.8 17h4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    paint: '<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7.5" cy="8" r="1.4" fill="currentColor"/><circle cx="12.5" cy="8" r="1.4" fill="currentColor"/><circle cx="10" cy="12.6" r="1.4" fill="currentColor"/>'
  };

  // slová fungujú po slovensky aj po anglicky („podcast hotovo“, „podcast done“)
  const statusLabel = id => (L.STATUSES.find(s => s.id === id) || {}).label;
  const ACTIONS = [
    { re: /^(hotovo|hotove|done|dokoncene|dokoncit|odovzdane|finished|complete|delivered)$/, get label() { return statusLabel('done'); }, run: 'status', status: 'done' },
    { re: /^(review|preview|poslane|sent)$/, get label() { return statusLabel('review'); }, run: 'status', status: 'review' },
    { re: /^(upravy|uprava|revision|revisions|feedback|changes|fixes)$/, get label() { return statusLabel('revisions'); }, run: 'status', status: 'revisions' },
    { re: /^(pracujem|robim|working|rozrobene|wip|doing)$/, get label() { return statusLabel('working'); }, run: 'status', status: 'working' },
    { re: /^(todo|narade|rade|next|queued)$/, get label() { return statusLabel('todo'); }, run: 'status', status: 'todo' },
    { re: /^(zaplatene|zaplatil|zaplatila|paid|platba|payment)$/, get label() { return t('Zaplatené'); }, run: 'pay' },
    { re: /^(priecinok|folder|subory|files)$/, get label() { return t('Otvoriť priečinok'); }, run: 'folder' },
    { re: /^(start|spusti|spustit|casovac|timer|meraj|track)$/, get label() { return t('Spustiť časovač'); }, run: 'timer' },
    { re: /^(kit|spytaj|napady|napad|ideas|ask)$/, get label() { return t('Opýtať sa {name}', { name: 'Kit' }); }, run: 'askProject' }
  ];

  const THEMES = {
    get lampa() { return t('Lampa'); }, get nokturno() { return t('Nokturno'); }, get atrament() { return t('Atrament'); }, get polnoc() { return t('Polnoc'); },
    get oled() { return t('OLED čierna'); }, get les() { return t('Nočný les'); }, get papier() { return t('Papier (svetlá)'); }
  };

  function score(hay, q) {
    hay = fold(hay); q = fold(q);
    if (!q) return 0;
    const i = hay.indexOf(q);
    if (i === 0) return 100;
    if (i > 0) return 80 - Math.min(30, i);
    // všetky slová z dopytu niekde v texte
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(w => hay.includes(w))) return 60;
    // znaky v poradí (sf → SkyForge)
    let j = 0;
    for (const ch of hay) if (ch === q[j]) j++;
    return j === q.length && q.length >= 2 ? 30 : 0;
  }

  function results(q, ctx) {
    const S = ctx.S, out = [];
    const raw = q.trim();
    const fq = fold(raw);
    const active = S.projects.filter(p => L.isActive(p, S.settings));
    const running = S.sessions.find(s => !s.end && s.manual);
    const sColor = id => `var(--s-${id})`;
    const proj = p => ({ kind: 'project', id: p.id, icon: 'clip', color: sColor(p.status), title: p.title, sub: [p.client, (L.STATUSES.find(s => s.id === p.status) || {}).label, p.deadline && p.status !== 'done' ? L.deadlineInfo(p).label : ''].filter(Boolean).join(' · '), hint: t('Otvoriť'), act: { type: 'open', id: p.id } });

    // prázdny dopyt: návrhy
    if (!raw) {
      const clip = ctx.clipboard && ctx.clipboard.length < 4000 ? L.parseMessage(ctx.clipboard) : null;
      if (clip && clip.found.filter(k => ['client', 'reward', 'deadline', 'type'].includes(k)).length >= 2) {
        const f = clip.fields;
        out.push({ icon: 'plus', color: 'var(--accent)', title: t('Nová zákazka zo schránky'), sub: [f.title, f.client, f.reward ? L.formatMoney(f.reward) : '', f.deadline ? L.formatDate(f.deadline) : ''].filter(Boolean).join(' · '), hint: t('Pridať'), act: { type: 'quickAdd', text: ctx.clipboard } });
      }
      if (running) out.push({ icon: 'stop', color: 'var(--rec)', title: t('Zastaviť časovač'), sub: (S.projects.find(p => p.id === running.projectId) || {}).title || t('Bez projektu'), act: { type: 'stopTimer' } });
      active.slice().sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9')).slice(0, 5).forEach(p => out.push(proj(p)));
      out.push({ icon: 'plus', color: 'var(--accent)', title: t('Nová zákazka'), sub: t('Vlož správu od klienta'), act: { type: 'quickAdd' } });
      if (ctx.aiEnabled) out.push({ icon: 'ask', color: 'var(--lilac)', title: t('Opýtať sa {name}', { name: L.decl(S.settings.mascotName, 'gen') }), sub: t('Napíš otázku a stlač Enter'), act: { type: 'ask', q: '' } });
      return out.slice(0, 9);
    }

    // „!“ = rýchly nápad do zápisníka
    if (raw.startsWith('!')) {
      const txt = raw.slice(1).trim();
      out.push({ icon: 'bulb', color: 'var(--amber)', title: txt ? t('Uložiť nápad: {text}', { text: txt }) : t('Napíš nápad za „!“'), sub: t('Uloží sa do Nápadov, rozpracuješ ho neskôr'), hint: t('Uložiť'), act: txt ? { type: 'idea', text: txt } : null });
      return out.filter(x => x.act);
    }

    // „?“ = otázka pre Kita
    if (raw.startsWith('?')) {
      const qq = raw.slice(1).trim();
      quickAnswers(fq, S).forEach(a => out.push(a));
      out.unshift({ icon: 'ask', color: 'var(--lilac)', title: qq ? t('Opýtať sa: {q}', { q: qq }) : t('Opýtať sa {name}', { name: L.decl(S.settings.mascotName, 'gen') }), sub: ctx.aiEnabled ? t('Odpovie lokálne AI') : t('Lokálne AI je vypnuté, zapneš ho v Nastaveniach'), act: { type: 'ask', q: qq } });
      return out.slice(0, 9);
    }

    // „+ text“, „nová ...“ alebo „new job ...“ = nová zákazka z textu
    const nm = raw.match(/^(\+|nov[aá]\s+(?:zakazka|zákazka)?\s*|new\s+job\s+)(.*)$/i);
    if (nm && nm[2].trim()) {
      const r = L.parseMessage(nm[2]);
      const f = r.fields;
      out.push({ icon: 'plus', color: 'var(--accent)', title: t('Vytvoriť: {title}', { title: f.title || nm[2] }), sub: [f.client, f.type ? t(f.type) : '', f.reward ? L.formatMoney(f.reward) : '', f.deadline ? t('do {date}', { date: L.formatDate(f.deadline) }) : ''].filter(Boolean).join(' · ') || t('Doplníš v ďalšom kroku'), hint: t('Vytvoriť'), act: { type: 'quickAdd', text: nm[2] } });
    }

    // projekt + akcia („podcast hotovo“)
    const tokens = fq.split(/\s+/);
    let action = null, rest = tokens;
    for (let k = tokens.length - 1; k >= 0 && tokens.length > 1; k--) {
      let a = ACTIONS.find(x => x.re.test(tokens[k])), two = false;
      if (!a && k < tokens.length - 1) { a = ACTIONS.find(x => x.re.test(tokens[k] + tokens[k + 1])); two = !!a; }
      if (a) { action = a; rest = tokens.filter((_, i) => i !== k && !(two && i === k + 1)); break; }
    }
    const pq = rest.join(' ');
    const scored = S.projects.map(p => ({ p, s: Math.max(score(p.title, pq), score(p.client, pq) * 0.7, (p.aliases || []).reduce((m, a) => Math.max(m, score(a, pq)), 0)) - (p.status === 'done' ? 15 : 0) }))
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    if (action && scored.length) {
      const p = scored[0].p;
      const sub = action.run === 'pay' ? t('Zapíše {m}', { m: L.formatMoney(L.owedOf(p)) }) : action.run === 'status' ? t('Presunúť z „{s}“', { s: statusLabel(p.status) || '' }) : '';
      out.push({ icon: action.run === 'pay' ? 'money' : action.run === 'folder' ? 'folder' : action.run === 'timer' ? 'play' : action.run === 'askProject' ? 'ask' : 'go', color: action.status ? sColor(action.status) : 'var(--accent)', title: p.title + ' → ' + (action.run === 'askProject' ? t('Opýtať sa {name}', { name: L.decl(S.settings.mascotName, 'gen') }) : action.label), sub, hint: t('Spustiť'), act: { type: action.run, id: p.id, status: action.status } });
    }
    scored.slice(0, 5).forEach(x => out.push(proj(x.p)));
    if (L.clientStats) L.clientStats(S).filter(c => score(c.name, fq) >= 60).slice(0, 2).forEach(c => out.push({ icon: 'info', color: 'var(--lilac)', title: c.name, sub: t('Klient') + ' · ' + tp(c.count, '{n} zákazka', '{n} zákazky', '{n} zákaziek') + ' · ' + L.formatMoney(c.paid), act: { type: 'client', key: c.key } }));

    // príkazy
    const cmds = [
      { k: 'nova zakazka pridat new job add', icon: 'plus', title: t('Nová zákazka'), act: { type: 'quickAdd' } },
      running ? { k: 'zastavit stop casovac timer', icon: 'stop', color: 'var(--rec)', title: t('Zastaviť časovač'), act: { type: 'stopTimer' } }
        : { k: 'spustit casovac timer start meranie track', icon: 'play', title: t('Spustiť časovač'), sub: S.focusProjectId ? (S.projects.find(p => p.id === S.focusProjectId) || {}).title : t('Bez projektu'), act: { type: 'timer', id: S.focusProjectId } },
      { k: 'nastenka board kanban', icon: 'go', title: t('Nástenka'), act: { type: 'go', view: 'board' } },
      { k: 'casova os timeline deadliny deadlines calendar', icon: 'go', title: t('Časová os'), act: { type: 'go', view: 'timeline' } },
      { k: 'napady ideas zapisnik nacrty notes sketches', icon: 'bulb', title: t('Nápady'), act: { type: 'go', view: 'ideas' } },
      { k: 'novy napad idea zapisat new note', icon: 'bulb', color: 'var(--amber)', title: t('Nový nápad'), sub: t('Alebo napíš „! text“ a uložím ho hneď'), act: { type: 'idea', kind: 'note' } },
      { k: 'storyboard zabery kreslit shots draw', icon: 'bulb', color: 'var(--amber)', title: t('Nový storyboard'), act: { type: 'idea', kind: 'board' } },
      { k: 'cas hodiny zaznamy time hours log', icon: 'go', title: t('Čas'), act: { type: 'go', view: 'time' } },
      { k: 'peniaze money zarobok platby dlhy earnings payments', icon: 'money', title: t('Peniaze'), act: { type: 'go', view: 'money' } },
      { k: 'archiv historia hotove history archive', icon: 'go', title: t('Archív'), act: { type: 'go', view: 'archive' } },
      { k: 'klienti clients zakaznici kniha customers', icon: 'go', title: t('Klienti'), act: { type: 'go', view: 'clients' } },
      { k: 'profil odznaky achievementy level badges profile', icon: 'go', title: t('Profil a odznaky'), act: { type: 'go', view: 'profile' } },
      { k: 'recap wrapped mesiac zhrnutie month summary', icon: 'go', color: 'var(--pink)', title: t('Mesačný recap'), act: { type: 'recap' } },
      { k: 'nastavenia settings preferences', icon: 'go', title: t('Nastavenia'), act: { type: 'go', view: 'settings' } },
      { k: 'mobil qr telefon phone mobile', icon: 'go', title: t('Mobil (QR kód)'), act: { type: 'go', view: 'settings', anchor: 'mobil' } },
      { k: 'kit chat ai opytat spytat ask', icon: 'ask', color: 'var(--lilac)', title: t('Chat s {name}', { name: L.decl(S.settings.mascotName, 'ins') }), act: { type: 'ask', q: '' } },
      { k: 'import notion csv', icon: 'go', title: t('Import z Notionu'), act: { type: 'notion' } }
    ];
    Object.entries(THEMES).forEach(([id, name]) => cmds.push({ k: 'tema vzhlad theme ' + fold(name) + ' ' + id, icon: 'paint', title: t('Téma: {name}', { name }), act: { type: 'theme', theme: id } }));
    cmds.map(c => ({ c, s: Math.max(score(c.title, fq), score(c.k, fq) * 0.9) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4)
      .forEach(({ c }) => out.push({ icon: c.icon, color: c.color || 'var(--muted)', title: c.title, sub: c.sub || '', act: c.act }));

    quickAnswers(fq, S).forEach(a => out.push(a));

    if (raw.length > 2) out.push({ icon: 'ask', color: 'var(--lilac)', title: t('Opýtať sa {name}: {q}', { name: L.decl(S.settings.mascotName, 'gen'), q: raw }), sub: ctx.aiEnabled ? t('Lokálne AI') : t('Lokálne AI je vypnuté'), act: { type: 'ask', q: raw } });
    if (raw.endsWith('?')) { const ask = out.pop(); out.unshift(ask); }
    return out.slice(0, 9);
  }

  /* odpovede bez AI, rovno z dát */
  function quickAnswers(fq, S) {
    const out = [];
    const now = Date.now();
    if (/dlh|nezaplat|kto mi|owe|zaplatil|unpaid|debt/.test(fq)) {
      const list = S.projects.filter(p => p.status === 'done' && L.owedOf(p) > 0);
      const sum = list.reduce((a, p) => a + L.owedOf(p), 0);
      out.push({ icon: 'money', color: 'var(--amber)', title: sum ? t('Dlhujú ti {m}', { m: L.formatMoney(sum) }) : t('Nikto ti nedlhuje'), sub: list.map(p => (p.client || p.title) + ' ' + L.formatMoney(L.owedOf(p))).join(', '), act: { type: 'go', view: 'money' } });
    }
    if (/dnes|today|co mam|dnesok/.test(fq)) {
      const ms = L.msBetween(S, L.startOfDay(now), now + 1);
      const due = S.projects.filter(p => L.isActive(p, S.settings) && ['today', 'overdue'].includes(L.deadlineInfo(p).level));
      out.push({ icon: 'info', color: 'var(--accent)', title: t('Dnes: {d}', { d: L.formatDuration(ms) }), sub: due.length ? t('Horí: {list}', { list: due.map(p => p.title + ' (' + L.deadlineInfo(p).label + ')').join(', ') }) : t('Žiadny deadline dnes'), act: { type: 'go', view: 'time' } });
    }
    if (/deadline|termin|kedy|due|when/.test(fq)) {
      const next = S.projects.filter(p => L.isActive(p, S.settings) && p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
      out.push({ icon: 'info', color: 'var(--rec)', title: next.length ? t('Najbližšie: {title} {when}', { title: next[0].title, when: L.deadlineInfo(next[0]).label }) : t('Žiadne deadliny'), sub: next.slice(1).map(p => p.title + ' ' + L.deadlineInfo(p).label).join(' · '), act: { type: 'go', view: 'timeline' } });
    }
    if (/tyzd|week|hodin|odrob|hours/.test(fq)) {
      out.push({ icon: 'info', color: 'var(--amber)', title: t('Tento týždeň: {d}', { d: L.formatDuration(L.msBetween(S, L.startOfWeek(now), now + 1)) }), sub: t('Dnes {d}', { d: L.formatDuration(L.msBetween(S, L.startOfDay(now), now + 1)) }), act: { type: 'go', view: 'time' } });
    }
    if (/zarob|mesiac|prijm|earn|income|month/.test(fq)) {
      const m = L.moneyStats(S, now);
      out.push({ icon: 'money', color: 'var(--mint)', title: t('Tento mesiac prišlo {m}', { m: L.formatMoney(m.thisMonth) }), sub: t('Celkovo {m}', { m: L.formatMoney(m.total) }) + (m.hourly ? ' · ' + L.formatMoney(Math.round(m.hourly * 10) / 10) + '/h' : ''), act: { type: 'go', view: 'money' } });
    }
    return out;
  }

  /* UI */
  function mount(root, opts) {
    root.innerHTML = `<div class="spot">
      <div class="spot-in"><svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M13.2 13.2L17 17" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        <input class="spot-q" placeholder="${t('Hľadaj alebo napíš príkaz')}" spellcheck="false" autocomplete="off"><kbd>Esc</kbd></div>
      <div class="spot-list" role="listbox"></div>
      <div class="spot-foot"><span><kbd>↑</kbd><kbd>↓</kbd> ${t('vybrať#key')}</span><span><kbd>↵</kbd> ${t('spustiť#key')}</span><span><kbd>Tab</kbd> ${t('doplniť#key')}</span><span><kbd>+</kbd> ${t('zákazka#key')}</span><span><kbd>!</kbd> ${t('nápad#key')}</span><span><kbd>?</kbd> ${t('otázka#key')}</span></div>
    </div>`;
    const input = root.querySelector('.spot-q'), list = root.querySelector('.spot-list');
    let items = [], sel = 0, clip = '';
    const render = () => {
      items = results(input.value, { S: opts.getState(), clipboard: clip, aiEnabled: opts.getState().settings.ollamaEnabled });
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map((it, i) => `<div class="spot-item${i === sel ? ' on' : ''}" data-i="${i}" role="option">
        <span class="spot-ic" style="--c:${it.color || 'var(--muted)'}"><svg viewBox="0 0 20 20">${G[it.icon] || G.go}</svg></span>
        <span class="spot-tx"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>
        ${i === sel ? `<span class="spot-hint">${esc(it.hint || 'Enter')}</span>` : ''}</div>`).join('')
        : `<div class="spot-empty">${t('Nič som nenašiel. Skús „+“ pre novú zákazku alebo „?“ pre otázku.')}</div>`;
      list.querySelectorAll('.spot-item').forEach(el => {
        el.onmousemove = () => { const i = +el.dataset.i; if (i !== sel) { sel = i; render(); } };
        el.onclick = () => run(items[+el.dataset.i]);
      });
    };
    const run = it => { if (it) opts.run(it.act, input.value); };
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); opts.close(); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const it = items[sel];
        if (it && it.act && it.act.type === 'open') { input.value = it.title + ' '; sel = 0; render(); }
      }
    });
    return {
      open(clipboard) {
        clip = clipboard || ''; input.value = ''; sel = 0;
        // príklad z tvojich dát, nie vymyslený
        const S = opts.getState(), c = L.recentClients ? L.recentClients(S, 1)[0] : '';
        input.placeholder = t('Hľadaj, „+ intro{client} {price} do piatku“, „! nápad“ alebo „? otázka pre {name}“', { client: c ? t(' pre {c}', { c }) : '', price: L.formatMoney(40), name: L.decl(S.settings.mascotName, 'gen') });
        render(); setTimeout(() => input.focus(), 10);
      },
      refresh: render
    };
  }

  return { results, mount, THEMES };
})();
