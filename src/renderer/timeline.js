/* Časová os: kde som, čo ma čaká a koľko som odrobil. Polohy sú v percentách,
   takže sa os prispôsobí šírke okna; hustotu popisov dní rieši ResizeObserver.
   Timeline.create(ctx) → { render } */
window.Timeline = (function () {
  const t = (s, v) => I18N.t(s, v), tp = (n, a, b, c, v) => I18N.tp(n, a, b, c, v);
  const DAY = 86400000;
  const RANGES = {
    '2w': { past: 3, future: 10, get label() { return t('2 týždne'); } },
    month: { past: 7, future: 23, get label() { return t('Mesiac'); } },
    '3m': { past: 14, future: 75, get label() { return t('3 mesiace'); } }
  };
  const WD = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
  const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
  const monthName = m => I18N.lang === 'sk' ? MONTHS[m] : new Date(2026, m, 1).toLocaleDateString(I18N.locale(), { month: 'long' });

  function create(ctx) {
    const { esc, $, $$, L, act, toast } = ctx;
    const I = n => ICONS.svg(n);
    let showDone = false, ro = null;
    try { showDone = localStorage.getItem('woi:tlDone') === '1'; } catch (e) { }

    const dayStart = x => { const d = new Date(x); d.setHours(0, 0, 0, 0); return +d; };
    const dlStart = p => +new Date(p.deadline + 'T00:00:00');
    const shortDate = x => { const d = new Date(x); return I18N.lang === 'sk' ? WD[d.getDay()] + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '.' : d.toLocaleDateString(I18N.locale(), { weekday: 'short', day: 'numeric', month: 'short' }); };

    function render(root) {
      const S = ctx.getS(), now = Date.now();
      const rk = RANGES[S.settings.timelineRange] ? S.settings.timelineRange : 'month';
      const R = RANGES[rk];
      const today = dayStart(now);
      const start = today - R.past * DAY, end = today + (R.future + 1) * DAY, span = end - start;
      const days = R.past + R.future + 1;
      const pct = x => (x - start) / span * 100;
      const clamp = v => Math.max(0, Math.min(100, v));

      const active = S.projects.filter(p => p.status !== 'done' && !L.isArchived(p, S.settings));
      const done = showDone ? S.projects.filter(p => p.status === 'done' && p.doneAt && Date.parse(p.doneAt) >= start) : [];
      const sortKey = p => p.deadline ? dlStart(p) : 9e15 + Date.parse(p.createdAt);
      const rows = active.slice().sort((a, b) => sortKey(a) - sortKey(b)).concat(done.sort((a, b) => Date.parse(b.doneAt) - Date.parse(a.doneAt)));

      /* čas po dňoch (všetky projekty) a po projektoch */
      const perDay = new Array(days).fill(0), perProj = {};
      for (const s of S.sessions) {
        const ts = Date.parse(s.start);
        if (ts < start || ts >= end) continue;
        const i = Math.floor((dayStart(ts) - start) / DAY);
        if (i < 0 || i >= days) continue;
        const ms = L.sessionMs(s, now);
        perDay[i] += ms;
        if (s.projectId) { (perProj[s.projectId] = perProj[s.projectId] || {})[i] = (perProj[s.projectId][i] || 0) + ms; }
      }

      /* súhrn hore */
      const overdue = active.filter(p => p.deadline && L.deadlineInfo(p, now).days < 0);
      const soon = active.filter(p => p.deadline && L.deadlineInfo(p, now).days >= 0 && L.deadlineInfo(p, now).days <= 7).sort((a, b) => a.deadline.localeCompare(b.deadline));
      const week = +L.startOfWeek(now);
      const weekMs = L.msBetween(S, new Date(week), now + 1), lastWeekMs = L.msBetween(S, new Date(week - 7 * DAY), new Date(week));
      const pipeline = active.reduce((a, p) => a + L.owedOf(p), 0);

      /* agenda */
      const groups = [
        ['over', t('Po termíne'), p => L.deadlineInfo(p, now).days < 0],
        ['today', t('Dnes'), p => L.deadlineInfo(p, now).days === 0],
        ['tom', t('Zajtra'), p => L.deadlineInfo(p, now).days === 1],
        ['week', t('Tento týždeň'), p => { const d = dlStart(p); return L.deadlineInfo(p, now).days > 1 && d < week + 7 * DAY; }],
        ['next', t('Budúci týždeň'), p => { const d = dlStart(p); return d >= week + 7 * DAY && d < week + 14 * DAY; }],
        ['later', t('Neskôr'), p => dlStart(p) >= week + 14 * DAY]
      ];
      const used = new Set();
      const agenda = groups.map(([k, label, fn]) => {
        const items = active.filter(p => p.deadline && !used.has(p.id) && fn(p)).sort((a, b) => a.deadline.localeCompare(b.deadline));
        items.forEach(p => used.add(p.id));
        return { k, label, items };
      }).filter(g => g.items.length);
      const noDl = active.filter(p => !p.deadline);
      if (noDl.length) agenda.push({ k: 'none', label: t('Bez deadlinu'), items: noDl });

      /* os: mesiace a dni */
      let months = '', daysHtml = '', cols = '';
      for (let i = 0; i < days; i++) {
        const tday = start + i * DAY, d = new Date(tday);
        const we = d.getDay() === 0 || d.getDay() === 6;
        const cls = [we ? 'we' : '', d.getDay() === 1 ? 'mon' : '', d.getDate() === 1 ? 'm1' : '', tday === today ? 'today' : '', tday < today ? 'past' : ''].filter(Boolean).join(' ');
        daysHtml += `<div class="tl3-day ${cls}" style="left:${i / days * 100}%;width:${100 / days}%"><b>${d.getDate()}</b><span class="wd">${t(WD[d.getDay()])}</span></div>`;
        if (we) cols += `<i class="tl3-we" style="left:${i / days * 100}%;width:${100 / days}%"></i>`;
        if (d.getDate() === 1 && i > 0) cols += `<i class="tl3-msep" style="left:${i / days * 100}%"></i>`;
        if (i === 0 || d.getDate() === 1) {
          const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const w = (Math.min(+next, end) - tday) / span * 100;
          months += `<div class="tl3-month" style="left:${i / days * 100}%;width:${w}%">${monthName(d.getMonth())}${d.getMonth() === 0 || i === 0 ? ' ' + d.getFullYear() : ''}</div>`;
        }
      }
      const nowPct = pct(now);
      cols += `<i class="tl3-pastshade" style="width:${clamp(pct(today))}%"></i><div class="tl3-now" style="left:${nowPct}%"><span>${t('Dnes')}</span></div>`;

      /* riadky */
      const rowHtml = p => {
        const isDone = p.status === 'done';
        const dl = p.deadline ? dlStart(p) : null;
        const dlEnd = dl ? dl + DAY : null;
        const created = Date.parse(p.createdAt);
        const firstWork = S.sessions.filter(s => s.projectId === p.id).reduce((m, s) => Math.min(m, Date.parse(s.start)), Infinity);
        const t0 = Math.min(created, firstWork);
        let t1 = isDone ? Date.parse(p.doneAt) : dlEnd ? dlEnd : Math.max(now + 3 * DAY, t0 + 3 * DAY);
        const info = L.deadlineInfo(p, now);
        const over = !isDone && dlEnd && dlEnd <= now + 1;
        const prog = L.projectProgress(p);
        const left = clamp(pct(t0)), right = clamp(pct(t1));
        const hidden = right <= 0 || left >= 100;
        const ms = L.projectMs(S, p.id, now);
        const work = Object.entries(perProj[p.id] || {}).map(([i, w]) => `<i class="tl3-w" style="left:${(+i + .5) / days * 100}%;--s:${Math.max(.35, Math.min(1, w / (4 * 3600000)))}" title="${shortDate(start + i * DAY)}: ${L.formatDuration(w)}"></i>`).join('');
        const title = [p.title, L.STATUSES.find(s => s.id === p.status).label, Math.round(prog * 100) + ' %', p.deadline ? t('deadline {date} ({when})', { date: shortDate(dl), when: info.label }) : t('bez deadlinu'), ms > 60000 ? t('odpracované {time}', { time: L.formatDuration(ms) }) : ''].filter(Boolean).join(', ');
        return `<div class="tl3-row${isDone ? ' done' : ''}${over ? ' late' : ''}" data-open="${p.id}" style="--c:var(--s-${p.status})">
          <div class="tl3-lab"><i class="dot"></i><span class="t"><b>${esc(p.title)}</b><small>${esc([p.client, isDone ? t('hotovo {date}', { date: L.formatDate(p.doneAt) }) : p.deadline ? info.label : t('bez deadlinu')].filter(Boolean).join(', '))}</small></span></div>
          <div class="tl3-track">
            ${over ? `<div class="tl3-over" style="left:${clamp(pct(dlEnd))}%;width:${Math.max(0, clamp(nowPct) - clamp(pct(dlEnd)))}%"></div>` : ''}
            ${hidden ? '' : `<div class="tl3-bar${!p.deadline && !isDone ? ' open' : ''}" style="left:${left}%;width:${Math.max(.6, right - left)}%" title="${esc(title)}">
              <i class="fill" style="width:${Math.round(prog * 100)}%"></i>${isDone ? '<span class="lbl">✓</span>' : prog > 0 ? `<span class="lbl">${Math.round(prog * 100)} %</span>` : ''}
              ${t0 < start ? '<span class="cut l">‹</span>' : ''}${t1 > end ? '<span class="cut r">›</span>' : ''}</div>`}
            ${dl && !isDone && dl >= start && dl < end ? `<button class="tl3-dl" data-dl="${p.id}" style="left:${pct(dlEnd)}%" title="${t('Deadline {date}. Ťahaj na iný deň.', { date: shortDate(dl) })}"><i></i></button>` : ''}
            ${work}
          </div>
        </div>`;
      };

      const maxDay = Math.max(3600000 * 4, ...perDay);
      const load = perDay.map((ms, i) => ms ? `<i class="tl3-load${start + i * DAY === today ? ' today' : ''}" style="left:${(i + .15) / days * 100}%;width:${.7 / days * 100}%;height:${Math.max(6, ms / maxDay * 100)}%" title="${shortDate(start + i * DAY)}: ${L.formatDuration(ms)}"></i>` : '').join('');
      const dlMarks = {};
      active.filter(p => p.deadline).forEach(p => { const i = Math.floor((dlStart(p) - start) / DAY); if (i >= 0 && i < days) dlMarks[i] = (dlMarks[i] || 0) + 1; });
      const marks = Object.entries(dlMarks).map(([i, n]) => `<i class="tl3-mark${n > 1 ? ' many' : ''}" style="left:${(+i + .5) / days * 100}%" title="${shortDate(start + i * DAY)}: ${n} ${L.plural(n, 'deadline', 'deadliny', 'deadlinov')}">${n > 1 ? n : ''}</i>`).join('');

      const statTile = (cls, k, v, sub) => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`;
      root.innerHTML = `<div class="tl3">
        <div class="stats">
          ${statTile(overdue.length ? 'bad' : '', t('Po termíne'), overdue.length, overdue.length ? esc(overdue.slice(0, 2).map(p => p.title).join(', ')) : t('Nič nemeškáš'))}
          ${statTile(soon.length ? 'accent' : '', t('Najbližších 7 dní'), tp(soon.length, '{n} deadline', '{n} deadliny', '{n} deadlinov'), soon.length ? esc(soon[0].title) + ', ' + L.deadlineInfo(soon[0], now).label : t('Pokojný týždeň'))}
          ${statTile('', t('Tento týždeň odrobené'), L.formatDuration(weekMs, true), lastWeekMs ? t('{diff} oproti minulému', { diff: (weekMs >= lastWeekMs ? '+' : '−') + L.formatDuration(Math.abs(weekMs - lastWeekMs), true) }) : t('Minulý týždeň bez záznamu'))}
          ${statTile('good', t('Rozpracované'), tp(active.length, '{n} zákazka', '{n} zákazky', '{n} zákaziek'), pipeline ? t('{money} ešte príde', { money: L.formatMoney(pipeline) }) : t('Všetko zaplatené'))}
        </div>
        <div class="tl3-tools">
          <div class="seg">${Object.entries(RANGES).map(([k, r]) => `<button data-range="${k}" class="${rk === k ? 'on' : ''}">${r.label}</button>`).join('')}</div>
          <label class="toggle"><input type="checkbox" id="tlDone"${showDone ? ' checked' : ''}>${t('Ukázať hotové')}</label>
          <span class="grow"></span>
          <span class="tl3-legend"><span><i class="lg-bar"></i>${t('Od zadania po deadline, plná časť = postup')}</span><span><i class="lg-dl"></i>${t('Deadline (dá sa posunúť)')}</span><span><i class="lg-over"></i>${t('Po termíne')}</span><span><i class="lg-w"></i>${t('Odrobené')}</span></span>
        </div>
        <div class="tl3-main">
          <div class="tl3-chart">
            ${rows.length ? `
            <div class="tl3-head"><div class="tl3-lab">${t('Zákazka')}</div><div class="tl3-axis" id="tlAxis"><div class="tl3-months">${months}</div><div class="tl3-days">${daysHtml}</div></div></div>
            <div class="tl3-rows"><div class="tl3-cols">${cols}</div>${rows.map(rowHtml).join('')}
              <div class="tl3-row tl3-loadrow"><div class="tl3-lab"><span class="t"><b>${t('Vyťaženie')}</b><small>${t('odrobené hodiny a deadliny')}</small></span></div><div class="tl3-track">${load}${marks}</div></div>
            </div>` : `<div class="empty small"><div class="mascot" id="tlKit"></div><h2>${t('Nič ťa nečaká')}</h2><p>${t('Keď pridáš zákazku s deadlinom, uvidíš ju tu ako pás od zadania po odovzdanie.')}</p><div class="row"><button class="btn primary" data-addjob>${t('Pridať zákazku')}</button></div></div>`}
          </div>
          <aside class="tl3-agenda">
            <h3>${t('Čo ťa čaká')}</h3>
            ${agenda.length ? agenda.map(g => `<div class="ag-group ag-${g.k}"><div class="ag-h">${g.label}<span>${g.items.length}</span></div>${g.items.map(p => {
              const info = L.deadlineInfo(p, now), prog = L.projectProgress(p);
              return `<button class="ag-item" data-open="${p.id}" style="--c:var(--s-${p.status})"><i class="dot"></i><span class="t"><b>${esc(p.title)}</b><small>${esc([p.client, L.STATUSES.find(s => s.id === p.status).label].filter(Boolean).join(', '))}</small><span class="ag-prog"><i style="width:${Math.round(prog * 100)}%"></i></span></span><span class="r"><b class="${info.level}">${p.deadline ? (info.days >= 0 && info.days <= 1 ? info.label : shortDate(dlStart(p))) : '—'}</b>${p.reward ? `<small>${L.formatMoney(p.reward)}</small>` : ''}</span></button>`;
            }).join('')}</div>`).join('') : `<p class="hint">${t('Žiadne rozpracované zákazky.')}</p>`}
          </aside>
        </div>
      </div>`;

      if (!rows.length && window.Mascot) { const k = $('#tlKit', root); if (k) { Mascot.mount(k); Mascot.setMood(k, 'happy'); } }
      const add = $('[data-addjob]', root); if (add) add.onclick = () => ctx.openQuickAdd();
      $$('[data-range]', root).forEach(b => b.onclick = () => act('updateSettings', { patch: { timelineRange: b.dataset.range } }));
      $('#tlDone', root).onchange = e => { showDone = e.target.checked; try { localStorage.setItem('woi:tlDone', showDone ? '1' : '0'); } catch (x) { } render(root); };
      $$('[data-open]', root).forEach(r => {
        r.addEventListener('click', e => { if (e.target.closest('.tl3-dl') || r.dataset.dragged) return; ctx.openDrawer(r.dataset.open, r.querySelector('.tl3-bar') || r); });
        r.addEventListener('contextmenu', e => { e.preventDefault(); ctx.projectMenu(r.dataset.open, { x: e.clientX, y: e.clientY }); });
      });

      /* ťahanie deadlinu */
      $$('[data-dl]', root).forEach(btn => {
        btn.addEventListener('pointerdown', e => {
          e.preventDefault(); e.stopPropagation();
          const track = btn.parentElement, row = btn.closest('.tl3-row');
          const tr = track.getBoundingClientRect();
          const p = ctx.getS().projects.find(x => x.id === btn.dataset.dl);
          const orig = p.deadline;
          let day = null, moved = false;
          btn.setPointerCapture(e.pointerId);
          btn.classList.add('drag');
          const tip = document.createElement('div'); tip.className = 'tl3-tip'; document.body.appendChild(tip);
          const move = ev => {
            const x = Math.max(0, Math.min(tr.width - 1, ev.clientX - tr.left));
            const i = Math.floor(x / tr.width * days);
            const tday = start + i * DAY;
            if (i !== day) { day = i; moved = moved || L.toISODate(new Date(tday)) !== orig; }
            btn.style.left = ((i + 1) / days * 100) + '%';
            tip.textContent = shortDate(tday);
            tip.style.left = ev.clientX + 'px'; tip.style.top = (tr.top - 30) + 'px';
          };
          const up = () => {
            btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up);
            btn.classList.remove('drag'); tip.remove();
            if (day == null) return;
            const iso = L.toISODate(new Date(start + day * DAY));
            if (moved && iso !== orig) {
              row.dataset.dragged = '1'; setTimeout(() => { delete row.dataset.dragged; }, 50);
              act('updateProject', { id: p.id, patch: { deadline: iso } });
              FX.sound.drop();
              toast(t('Deadline <b>{title}</b> → {date}', { title: esc(p.title), date: shortDate(start + day * DAY) }), { icon: '📅', actions: [{ label: t('Späť#undo'), run: () => act('updateProject', { id: p.id, patch: { deadline: orig } }) }] });
            }
          };
          btn.addEventListener('pointermove', move); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
        });
        btn.addEventListener('click', e => e.stopPropagation());
      });

      /* hustota popisov podľa šírky */
      if (ro) ro.disconnect();
      const axis = $('#tlAxis', root), tl = $('.tl3', root);
      if (axis && window.ResizeObserver) {
        ro = new ResizeObserver(() => {
          const dpx = axis.clientWidth / days;
          tl.dataset.density = dpx >= 34 ? 'full' : dpx >= 19 ? 'num' : dpx >= 9 ? 'mon' : 'min';
        });
        ro.observe(axis);
      }
    }

    return { render };
  }

  return { create, RANGES };
})();
