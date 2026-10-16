/* Nápady: zápisník na nápady, náčrty a storyboardy. Nápad môže (ale nemusí) patriť k zákazke.
   Ideas.create(ctx) → { render, open, close, isOpen, refresh, newIdea, projectBox } */
window.Ideas = (function () {
  const t = (s, v) => I18N.t(s, v), tp = (n, a, b, c, v) => I18N.tp(n, a, b, c, v);
  const COLORS = [['', 'Bez farby'], ['#6ee7c8', 'Mätová'], ['#7cc4ff', 'Modrá'], ['#b9a4ff', 'Levanduľová'], ['#f9a8d4', 'Ružová'], ['#ffd27a', 'Jantárová'], ['#ff8a6b', 'Koralová']];
  const ASPECTS = ['16:9', '9:16', '1:1', '4:5'];
  const RATIO = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5] };
  const firstImg = html => { const m = String(html || '').match(/<img[^>]+src="([^"]+)"/i); return m ? m[1].replace(/&amp;/g, '&') : ''; };
  const coverOf = i => i.cover || firstImg(i.html) || ((i.frames || []).find(f => f.image) || {}).image || '';
  const isEmpty = i => !String(i.title || '').trim() && !String(i.text || '').trim() && !firstImg(i.html) && !(i.frames || []).some(f => f.image || String(f.caption || '').trim());
  const ago = iso => {
    const d = (Date.now() - Date.parse(iso)) / 60000;
    if (!(d >= 0)) return '';
    if (d < 1) return t('práve teraz');
    if (d < 60) return t('pred {n} min', { n: Math.round(d) });
    if (d < 1440) return t('pred {n} h', { n: Math.round(d / 60) });
    if (d < 2880) return t('včera');
    return new Date(iso).toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'numeric' });
  };

  function create(ctx) {
    const { act, toast, esc, el, $, $$, L } = ctx;
    const I = n => ICONS.svg(n);
    let q = '', filter = 'all', tagF = '', projF = '';
    let openId = null, page = null, editor = null, tab = 'notes', saveT = null, pending = {}, lastFramesJson = '', lastHtml = '';

    const S = () => ctx.getS();
    const ideas = () => S().ideas || [];
    const idea = id => ideas().find(i => i.id === id);
    const proj = id => S().projects.find(p => p.id === id);

    /* ---------- ukladanie (s malým oneskorením, aby sa nezapisovalo pri každom písmene) ---------- */
    function save(patch, now) {
      const target = patch.id || openId;
      const it = idea(target); if (it) Object.assign(it, patch);
      // iný nápad ako ten otvorený (napr. z menu na kartičke): uložiť hneď
      if (target !== openId) { act('saveIdea', { idea: Object.assign({ id: target }, patch) }).catch(() => { }); return; }
      Object.assign(pending, patch);
      clearTimeout(saveT);
      const go = () => { const p = pending; pending = {}; if (Object.keys(p).length) act('saveIdea', { idea: Object.assign({ id: target }, p) }).catch(() => { }); };
      if (now) go(); else saveT = setTimeout(go, 450);
    }
    async function saveImage(id, data, ext) { return act('saveImage', { id, data, ext: ext || 'png' }); }
    async function asDataUrl(url) { return /^data:/.test(url) ? url : act('readImageData', { url }); }

    /* ---------- prehľad (mriežka kartičiek) ---------- */
    function render(root) {
      const all = ideas();
      const tags = {};
      all.forEach(i => (i.tags || []).forEach(tg => { tags[tg] = (tags[tg] || 0) + 1; }));
      const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
      const linkedProjects = Array.from(new Set(all.map(i => i.projectId).filter(Boolean))).map(proj).filter(Boolean);
      const n = L.normalize(q);
      const list = all.filter(i => {
        if (filter === 'pinned' && !i.pinned) return false;
        if (filter === 'storyboard' && !(i.frames || []).length) return false;
        if (filter === 'linked' && !i.projectId) return false;
        if (tagF && !(i.tags || []).includes(tagF)) return false;
        if (projF && i.projectId !== projF) return false;
        if (n && !L.normalize((i.title || '') + ' ' + (i.text || '') + ' ' + (i.tags || []).join(' ') + ' ' + ((proj(i.projectId) || {}).title || '')).includes(n)) return false;
        return true;
      }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

      root.innerHTML = `
        <div class="ideas-tools">
          <button class="btn primary" data-new="note">${I('plus')}${t('Nový nápad')}</button>
          <button class="btn" data-new="board">${I('storyboard')}Storyboard</button>
          <button class="btn" data-new="sketch">${I('brush')}${t('Rýchly náčrt')}</button>
          <span class="grow"></span>
          <label class="search">${I('search')}<input id="ideaQ" placeholder="${t('Hľadať v nápadoch')}" value="${esc(q)}"></label>
        </div>
        ${all.length ? `<div class="ideas-filters">
          <div class="seg">${[['all', t('Všetko')], ['pinned', t('Pripnuté')], ['storyboard', t('Storyboardy')], ['linked', t('K zákazkám')]].map(([k, label]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${label}</button>`).join('')}</div>
          ${topTags.map(tg => `<button class="tagchip${tagF === tg ? ' on' : ''}" data-tag="${esc(tg)}">#${esc(tg)}</button>`).join('')}
          ${linkedProjects.length ? `<select id="ideaProj"><option value="">${t('Všetky zákazky')}</option>${linkedProjects.map(p => `<option value="${p.id}"${projF === p.id ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}</select>` : ''}
        </div>` : ''}
        ${list.length ? `<div class="ideas-grid">${list.map(card).join('')}</div>`
          : all.length ? `<div class="empty small"><p>${t('Nič také som nenašiel.')}</p></div>`
          : `<div class="empty ideas-empty">
              <div class="mascot" id="ideasKit"></div>
              <h2>${t('Miesto na nápady')}</h2>
              <p>${t('Zapisuj si nápady na videá, kresli náčrty, vkladaj referencie a skladaj storyboardy. Keď chceš, prepojíš nápad so zákazkou.')}</p>
              <div class="ideas-how">
                <div>${I('note')}<b>${t('Poznámky')}</b><span>${t('Text s formátovaním a obrázkami cez Ctrl+V')}</span></div>
                <div>${I('brush')}<b>${t('Kreslenie')}</b><span>${t('Pero s tlakom pre tablet, fix, šípky, mriežka')}</span></div>
                <div>${I('storyboard')}<b>Storyboard</b><span>${t('Zábery s kresbou, typom záberu a dĺžkou, export do PNG')}</span></div>
              </div>
            </div>`}`;
      if (!all.length && window.Mascot) { Mascot.mount($('#ideasKit', root)); Mascot.setMood($('#ideasKit', root), 'happy'); }
      $$('[data-new]', root).forEach(b => b.onclick = () => newIdea({ kind: b.dataset.new }));
      const qi = $('#ideaQ', root);
      qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(root); const n2 = $('#ideaQ', root); n2.focus(); n2.setSelectionRange(pos, pos); };
      $$('[data-f]', root).forEach(b => b.onclick = () => { if (filter === b.dataset.f) return; const dir = Polish.dirOf(b); filter = b.dataset.f; Polish.slide(() => $('.ideas-grid', root) || $('.empty', root), dir, () => render(root)); });
      $$('[data-tag]', root).forEach(b => b.onclick = () => { tagF = tagF === b.dataset.tag ? '' : b.dataset.tag; render(root); });
      const ps = $('#ideaProj', root); if (ps) ps.onchange = () => { projF = ps.value; render(root); };
      $$('.idea-card', root).forEach(c => {
        c.onclick = e => { if (e.target.closest('[data-pin]')) return; open(c.dataset.id, { from: c }); };
        c.oncontextmenu = e => { e.preventDefault(); cardMenu(c.dataset.id, { x: e.clientX, y: e.clientY }); };
        const pin = $('[data-pin]', c);
        pin.onclick = e => { e.stopPropagation(); const it = idea(c.dataset.id); act('saveIdea', { idea: { id: it.id, pinned: !it.pinned } }); };
      });
    }

    function card(i) {
      const cov = coverOf(i), p = proj(i.projectId), fr = i.frames || [];
      const strip = fr.length >= 2 && fr.some(f => f.image);
      return `<article class="idea-card${i.pinned ? ' pinned' : ''}" data-id="${i.id}" style="${i.color ? '--ic:' + i.color : ''}" tabindex="0">
        ${strip ? `<div class="ic-strip r${(i.aspect || '16:9').replace(':', '-')}">${fr.slice(0, 4).map(f => f.image ? `<img src="${esc(f.image)}" alt="" loading="lazy">` : '<i></i>').join('')}</div>`
          : cov ? `<div class="ic-cover"><img src="${esc(cov)}" alt="" loading="lazy"></div>` : ''}
        <div class="ic-body">
          <h4>${esc(i.title || t('Bez názvu'))}</h4>
          ${i.text ? `<p>${esc(String(i.text).slice(0, 240))}</p>` : ''}
          <div class="ic-meta">
            ${fr.length ? `<span class="chip">${I('storyboard')}${tp(fr.length, '{n} záber', '{n} zábery', '{n} záberov')}, ${L.storyboardSeconds(i)} s</span>` : ''}
            ${p ? `<span class="chip" style="color:var(--s-${p.status})">${I('link')}${esc(p.title)}</span>` : ''}
            ${(i.tags || []).slice(0, 3).map(tg => `<span class="chip tag">#${esc(tg)}</span>`).join('')}
            <span class="ic-time">${ago(i.updatedAt)}</span>
          </div>
        </div>
        <button class="ic-pin${i.pinned ? ' on' : ''}" data-pin title="${i.pinned ? t('Odopnúť') : t('Pripnúť hore')}">${I('pin')}</button>
      </article>`;
    }

    function cardMenu(id, pos) {
      const it = idea(id); if (!it) return;
      ctx.popMenu(pos, [
        { label: t('Otvoriť'), run: () => open(id) },
        { label: it.pinned ? t('Odopnúť') : t('Pripnúť hore'), run: () => act('saveIdea', { idea: { id, pinned: !it.pinned } }) },
        { label: t('Prepojiť so zákazkou…'), keep: true, run: () => linkMenu(id, pos) },
        { label: t('Duplikovať'), run: async () => { const c = JSON.parse(JSON.stringify(it)); delete c.id; c.title = (c.title || t('Nápad')) + t(' (kópia)'); c.frames = (c.frames || []).map(f => Object.assign({}, f, { id: undefined })); const nid = await act('saveIdea', { idea: c }); toast(t('Kópia vytvorená.'), { actions: [{ label: t('Otvoriť'), run: () => open(nid) }] }); } },
        'sep',
        { label: t('Zmazať'), danger: true, run: () => toast(t('Zmazať nápad <b>{title}</b>?', { title: esc(it.title || t('Bez názvu')) }), { icon: '!', actions: [{ label: t('Zmazať'), run: () => { act('deleteIdea', { id }); if (openId === id) close(true); } }] }) }
      ], it.title || t('Nápad'));
    }

    function linkMenu(id, pos, after) {
      const it = idea(id);
      const active = S().projects.filter(p => p.status !== 'done' || p.id === it.projectId);
      ctx.popMenu(pos, [
        ...active.map(p => ({ label: p.title, color: ctx.sColor(p.status), check: it.projectId === p.id, run: () => { save({ id, projectId: p.id }, true); if (after) after(); } })),
        it.projectId ? 'sep' : null,
        it.projectId ? { label: t('Zrušiť prepojenie'), run: () => { save({ id, projectId: '' }, true); if (after) after(); } } : null
      ], t('K zákazke'));
    }

    /* nový nápad sa do stavu dostane až o chvíľu (cez udalosť), dovtedy ho držíme lokálne */
    function ensureLocal(id, data) {
      const st = S();
      st.ideas = st.ideas || [];
      let it = st.ideas.find(i => i.id === id);
      if (!it) { it = L.newIdea(Object.assign({}, data, { id })); if (Array.isArray(it.frames)) it.frames = it.frames.map(f => L.newFrame(f)); st.ideas.unshift(it); }
      else Object.assign(it, data);
      return it;
    }

    /* ---------- nový nápad ---------- */
    async function newIdea(opts) {
      opts = opts || {};
      const base = { title: opts.title || '', projectId: opts.projectId || '' };
      let aspect = '16:9';
      try { aspect = localStorage.getItem('woi:ideaAspect') || '16:9'; } catch (e) { }
      if (opts.kind === 'board') Object.assign(base, { aspect, frames: [1, 2, 3, 4].map(() => L.newFrame({})), title: opts.title || '' });
      if (opts.kind === 'sketch') {
        const r = await Sketch.open({ title: t('Rýchly náčrt'), aspect: 'free' });
        if (!r) return null;
        Object.assign(base, { title: t('Náčrt {date}', { date: new Date().toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'numeric' }) }) });
        const id = await act('saveIdea', { idea: base });
        const url = await saveImage(id, r.data, 'png');
        const extra = { cover: url, html: `<p><img src="${url}" alt=""></p><p><br></p>` };
        await act('saveIdea', { idea: Object.assign({ id }, extra) });
        ensureLocal(id, Object.assign({}, base, extra));
        FX.sound.pop();
        open(id, { tab: 'notes' });
        return id;
      }
      const id = await act('saveIdea', { idea: base });
      ensureLocal(id, base);
      FX.sound.pop();
      open(id, { tab: opts.kind === 'board' ? 'board' : 'notes', fresh: true });
      return id;
    }

    /* ---------- stránka nápadu ---------- */
    function open(id, opts) {
      opts = opts || {};
      const it = idea(id); if (!it) return;
      if (openId && openId !== id) close(true, true);
      openId = id;
      tab = opts.tab || ((it.frames || []).length && !String(it.text || '').trim() ? 'board' : 'notes');
      page = $('#ideaPage');
      build();
      const first = !page.classList.contains('open');
      page.classList.add('open'); page.setAttribute('aria-hidden', 'false'); page.scrollTop = 0;
      if (first) {
        FX.sound.open();
        const f = opts.from && opts.from.getBoundingClientRect ? opts.from.getBoundingClientRect() : null, r = page.getBoundingClientRect();
        const from = f ? `inset(${f.top - r.top}px ${r.right - f.right}px ${r.bottom - f.bottom}px ${f.left - r.left}px round 18px)` : 'inset(3% 3% 3% 3% round 26px)';
        page.animate([{ clipPath: from, opacity: f ? 1 : 0 }, { clipPath: 'inset(0px 0px 0px 0px round 26px)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.85,.25,1)' });
      }
      if (opts.fresh) setTimeout(() => { const ti = $('.id-title', page); if (ti) ti.focus(); }, 60);
    }

    function close(silent, keepPage) {
      if (!openId) return;
      if (editor && editor.flush) editor.flush();
      clearTimeout(saveT);
      const p = pending; pending = {};
      const id = openId;
      if (Object.keys(p).length) act('saveIdea', { idea: Object.assign({ id }, p) }).catch(() => { });
      const it = idea(id);
      // prázdny nápad, do ktorého si nič nenapísal, neostane visieť
      if (it && isEmpty(Object.assign({}, it, p))) act('deleteIdea', { id }).catch(() => { });
      openId = null; editor = null;
      if (!silent) FX.sound.close();
      const pg = page || $('#ideaPage');
      if (keepPage) return;
      const anim = pg.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.99)' }], { duration: 200, easing: 'ease-in' });
      anim.onfinish = () => { if (!openId) { pg.classList.remove('open'); pg.setAttribute('aria-hidden', 'true'); pg.innerHTML = ''; } };
    }

    function build() {
      if (editor && editor.flush) editor.flush();
      const it = idea(openId);
      const p = proj(it.projectId);
      const color = it.color || 'var(--accent)';
      page.innerHTML = `
        <div class="pg-top">
          <button class="btn ghost small" data-x>${t('← Nápady')}</button>
          <span class="crumb">${esc(it.title || t('Nový nápad'))}</span>
          <span class="grow"></span>
          ${S().settings.ollamaEnabled ? `<button class="btn ghost small" data-kit>${I('sparkle')}${t('Rozvinúť s {name}', { name: esc(L.decl(S().settings.mascotName, 'ins')) })}</button>` : ''}
          <button class="btn ghost small" data-more title="${t('Ďalšie možnosti')}">•••</button>
          <button class="btn ghost small" data-x aria-label="${t('Zavrieť')}"><span style="width:14px;height:14px;display:block">${ctx.ICON.close}</span></button>
        </div>
        <div class="pg-cover" style="--c:${color}"><i></i><i></i></div>
        <div class="idea-wrap" style="--c:${color}">
          <input class="d-title id-title" value="${esc(it.title)}" placeholder="${t('Názov nápadu')}">
          <div class="id-meta">
            <div class="id-colors">${COLORS.map(([c, n]) => `<button class="id-color${(it.color || '') === c ? ' on' : ''}" data-color="${c}" title="${esc(t(n))}" style="--sw:${c || 'transparent'}"></button>`).join('')}</div>
            <button class="btn ghost small id-pin${it.pinned ? ' on' : ''}" data-pinme>${I('pin')}${it.pinned ? t('Pripnuté') : t('Pripnúť')}</button>
            <button class="btn ghost small" data-link>${I('link')}<span>${p ? esc(p.title) : t('Prepojiť so zákazkou')}</span></button>
            ${p ? `<button class="btn ghost small" data-openproj title="${t('Otvoriť zákazku')}">→</button>` : ''}
            <div class="id-tags" id="idTags"></div>
          </div>
          <div class="id-tabs">
            <button data-tab="notes" class="${tab === 'notes' ? 'on' : ''}">${I('note')}${t('Poznámky')}</button>
            <button data-tab="board" class="${tab === 'board' ? 'on' : ''}">${I('storyboard')}Storyboard <span class="n">${(it.frames || []).length || ''}</span></button>
          </div>
          <div id="idBody"></div>
          <div class="id-foot">${t('Vytvorené {date}', { date: new Date(it.createdAt).toLocaleString(I18N.locale(), { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}<span class="grow"></span><button class="btn danger small" data-del>${I('trash')}${t('Zmazať nápad')}</button></div>
        </div>`;
      $$('[data-x]', page).forEach(b => b.onclick = () => close());
      $('[data-more]', page).onclick = e => cardMenu(openId, e.currentTarget);
      const kb = $('[data-kit]', page); if (kb) kb.onclick = () => { if (editor && editor.flush) editor.flush(); ctx.chat.open({ ideaId: openId, projectId: it.projectId || '', fresh: true, q: (it.frames || []).length ? t('Pozri sa na tento storyboard a navrhni, čo zlepšiť (tempo, poradie záberov, hook).') : t('Pomôž mi rozvinúť tento nápad na video. Daj 3 konkrétne smery.') }); };
      const title = $('.id-title', page);
      title.oninput = () => { save({ title: title.value }); $('.crumb', page).textContent = title.value || t('Nový nápad'); };
      title.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (tab === 'notes' && editor) editor.focus(); } };
      $$('[data-color]', page).forEach(b => b.onclick = () => {
        save({ color: b.dataset.color }, true);
        $$('[data-color]', page).forEach(x => x.classList.toggle('on', x === b));
        const c = b.dataset.color || 'var(--accent)';
        $('.pg-cover', page).style.setProperty('--c', c); $('.idea-wrap', page).style.setProperty('--c', c);
      });
      $('[data-pinme]', page).onclick = e => { const v = !idea(openId).pinned; save({ pinned: v }, true); e.currentTarget.classList.toggle('on', v); e.currentTarget.lastChild.textContent = v ? t('Pripnuté') : t('Pripnúť'); };
      $('[data-link]', page).onclick = e => linkMenu(openId, e.currentTarget, () => setTimeout(build, 30));
      const op = $('[data-openproj]', page); if (op) op.onclick = () => { const pid = idea(openId).projectId; close(); ctx.openDrawer(pid); };
      let armed = false;
      $('[data-del]', page).onclick = e => {
        if (!armed) { armed = true; e.currentTarget.lastChild.textContent = t('Naozaj? Klikni znova'); setTimeout(() => { armed = false; const b = $('[data-del]', page); if (b) b.lastChild.textContent = t('Zmazať nápad'); }, 3000); return; }
        const id = openId; openId = null; pending = {};
        act('deleteIdea', { id }); page.classList.remove('open'); page.innerHTML = ''; toast(t('Nápad zmazaný.'));
      };
      $$('[data-tab]', page).forEach(b => b.onclick = () => {
        if (b.classList.contains('on')) return;
        if (editor && editor.flush) editor.flush();
        const dir = Polish.dirOf(b);
        tab = b.dataset.tab; $$('[data-tab]', page).forEach(x => x.classList.toggle('on', x === b));
        Polish.slide(() => $('#idBody', page), dir, body); // poznámky ↔ storyboard sa posunú ako stránky
      });
      renderTags();
      body();
    }

    function renderTags() {
      const box = $('#idTags', page); if (!box) return;
      const it = idea(openId);
      const all = Array.from(new Set(ideas().flatMap(i => i.tags || [])));
      box.innerHTML = `${(it.tags || []).map(tg => `<span class="tagchip on">#${esc(tg)}<button data-rmtag="${esc(tg)}" title="${t('Odobrať')}">✕</button></span>`).join('')}
        <input id="tagIn" list="tagList" placeholder="${(it.tags || []).length ? t('+ štítok') : t('+ pridať štítok')}"><datalist id="tagList">${all.map(tg => `<option value="${esc(tg)}">`).join('')}</datalist>`;
      $$('[data-rmtag]', box).forEach(b => b.onclick = () => { save({ tags: (idea(openId).tags || []).filter(x => x !== b.dataset.rmtag) }, true); renderTags(); });
      const inp = $('#tagIn', box);
      const add = () => {
        const v = inp.value.replace(/^#/, '').replace(/,/g, ' ').trim().slice(0, 30);
        if (!v) return;
        const tags = idea(openId).tags || [];
        if (!tags.includes(v)) save({ tags: tags.concat([v]) }, true);
        renderTags(); setTimeout(() => { const n = $('#tagIn', page); if (n) n.focus(); }, 10);
      };
      inp.onkeydown = e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !inp.value && (idea(openId).tags || []).length) { save({ tags: idea(openId).tags.slice(0, -1) }, true); renderTags(); setTimeout(() => { const n = $('#tagIn', page); if (n) n.focus(); }, 10); } };
      inp.onchange = add;
    }

    function body() {
      const box = $('#idBody', page);
      if (tab === 'notes') notes(box); else board(box);
    }

    /* ---------- poznámky ---------- */
    function notes(box) {
      const it = idea(openId);
      const id = openId;
      box.innerHTML = `<div class="rte-wrap" id="idEditor"></div>
        <p class="hint">${t('Obrázky a screenshoty vlož cez Ctrl+V alebo ich sem pretiahni. Dvojklik na obrázok: kresliť cez neho alebo ho dať ako obálku.')}</p>`;
      lastHtml = it.html || '';
      editor = RTE.create($('#idEditor', box), {
        html: it.html || RTE.textToHtml(it.text),
        placeholder: t('O čom je nápad? Hook, pointa, referencie, hudba… Píš voľne, „# “ urobí nadpis a „- “ odrážky.'),
        onChange: (html, text) => { if (openId === id) { lastHtml = html; save({ html, text }); } },
        onImage: ({ data, ext }) => saveImage(id, data, ext),
        extra: [{ id: 'draw', title: t('Nakresliť náčrt'), html: ICONS.svg('brush'), run: async () => {
          const r = await Sketch.open({ title: t('Náčrt k nápadu'), aspect: 'free' });
          if (!r || openId !== id) return;
          const url = await saveImage(id, r.data, 'png');
          editor.insertHtml(`<img src="${url}" alt=""><p><br></p>`);
          if (!idea(id).cover) save({ cover: url });
          FX.sound.pop();
        } }]
      });
      editor.el.addEventListener('dblclick', e => {
        const img = e.target.closest('img'); if (!img) return;
        const src = img.getAttribute('src');
        ctx.popMenu({ x: e.clientX, y: e.clientY }, [
          { label: t('Kresliť cez obrázok'), run: async () => {
            const base = await asDataUrl(src).catch(() => null);
            const r = await Sketch.open({ title: t('Kreslenie cez obrázok'), aspect: 'free', base });
            if (!r || openId !== id) return;
            const url = await saveImage(id, r.data, 'png');
            editor.replaceImage(src, url);
            if (idea(id).cover === src) save({ cover: url });
          } },
          { label: t('Nastaviť ako obálku'), run: () => { save({ cover: src }, true); toast(t('Obálka nastavená.')); } },
          { label: t('Otvoriť v prehliadači obrázkov'), run: () => act('openFileUrl', { url: src }) }
        ], t('Obrázok'));
      });
    }

    /* ---------- storyboard ---------- */
    function board(box) {
      const it = idea(openId);
      const id = openId;
      const frames = (it.frames || []).map(f => Object.assign({}, f));
      lastFramesJson = JSON.stringify(frames);
      const aspect = it.aspect || '16:9';
      const [rw, rh] = RATIO[aspect] || [16, 9];
      const total = frames.reduce((a, f) => a + (Number(f.duration) || 0), 0);
      const commit = (now) => { lastFramesJson = JSON.stringify(frames); save({ frames: frames.map(f => Object.assign({}, f)) }, now); const n = $('[data-tab="board"] .n', page); if (n) n.textContent = frames.length || ''; const tot = $('#sbTotal', box); if (tot) tot.textContent = summary(); };
      const summary = () => { const sec = frames.reduce((a, f) => a + (Number(f.duration) || 0), 0); return `${tp(frames.length, '{n} záber', '{n} zábery', '{n} záberov')}, ${sec >= 60 ? Math.floor(sec / 60) + ' min ' + (sec % 60) + ' s' : sec + ' s'}`; };
      box.innerHTML = `
        <div class="sb-bar">
          <div class="seg">${ASPECTS.map(a => `<button data-aspect="${a}" class="${aspect === a ? 'on' : ''}">${a}</button>`).join('')}</div>
          <span class="sb-total" id="sbTotal">${summary()}</span>
          <span class="grow"></span>
          <button class="btn small" data-sb="copy" ${frames.length ? '' : 'disabled'}>${I('copy')}${t('Kopírovať ako obrázok')}</button>
          <button class="btn small" data-sb="export" ${frames.length ? '' : 'disabled'}>${I('download')}${t('Uložiť PNG')}</button>
        </div>
        <div class="sb-grid r${aspect.replace(':', '-')}" style="--rw:${rw};--rh:${rh}">
          ${frames.map((f, i) => frameHtml(f, i)).join('')}
          <button class="sb-add" data-add>${I('plus')}<span>${t('Pridať záber')}</span></button>
        </div>
        <p class="hint">${t('Klikni na prázdne políčko a kresli, alebo doň vlož obrázok (Ctrl+V, keď je políčko vybraté, alebo ho pretiahni). Poradie zmeníš ťahaním za číslo.')}</p>`;
      if (!total && !frames.length) { /* prázdny storyboard */ }

      $$('[data-aspect]', box).forEach(b => b.onclick = () => { save({ aspect: b.dataset.aspect }, true); try { localStorage.setItem('woi:ideaAspect', b.dataset.aspect); } catch (e) { } board(box); });
      $('[data-add]', box).onclick = () => { frames.push(L.newFrame({ duration: frames.length ? frames[frames.length - 1].duration || 3 : 3 })); commit(true); board(box); setTimeout(() => { const c = $$('.sb-frame', box).pop(); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30); };
      $('[data-sb="export"]', box).onclick = () => exportBoard(idea(id), 'save');
      $('[data-sb="copy"]', box).onclick = () => exportBoard(idea(id), 'copy');

      $$('.sb-frame', box).forEach(fe => {
        const i = +fe.dataset.i, f = frames[i];
        const setImg = async (data, ext) => { const url = await saveImage(id, data, ext); f.image = url; commit(true); if (!idea(id).cover) save({ cover: url }); board(box); };
        const draw = async () => {
          const base = f.image ? await asDataUrl(f.image).catch(() => null) : null;
          const r = await Sketch.open({ title: t('Záber {n}', { n: i + 1 }) + (f.caption ? ', ' + f.caption.slice(0, 40) : ''), aspect, base });
          if (r && openId === id) setImg(r.data, 'png');
        };
        $('.sb-img', fe).onclick = e => { if (e.target.closest('[data-fx]')) return; fe.focus(); if (!f.image) draw(); };
        $$('[data-fx]', fe).forEach(b => b.onclick = async e => {
          e.stopPropagation();
          const k = b.dataset.fx;
          if (k === 'draw') draw();
          if (k === 'pick') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const file = inp.files[0]; if (!file) return; const d = await fileData(file); setImg(d.data, d.ext); }; inp.click(); }
          if (k === 'clear') { f.image = ''; commit(true); board(box); }
          if (k === 'dup') { frames.splice(i + 1, 0, L.newFrame(Object.assign({}, f, { id: undefined }))); commit(true); board(box); }
          if (k === 'del') { frames.splice(i, 1); commit(true); board(box); }
          if (k === 'left' && i > 0) { [frames[i - 1], frames[i]] = [frames[i], frames[i - 1]]; commit(true); board(box); }
          if (k === 'right' && i < frames.length - 1) { [frames[i + 1], frames[i]] = [frames[i], frames[i + 1]]; commit(true); board(box); }
        });
        fe.addEventListener('paste', async e => {
          const item = Array.from((e.clipboardData || {}).items || []).find(x => x.type.startsWith('image/'));
          if (!item || e.target.closest('textarea,input')) return;
          e.preventDefault();
          const d = await fileData(item.getAsFile()); setImg(d.data, d.ext);
        });
        fe.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.items || []).some(x => x.kind === 'file')) { e.preventDefault(); fe.classList.add('drop'); } });
        fe.addEventListener('dragleave', () => fe.classList.remove('drop'));
        fe.addEventListener('drop', async e => {
          fe.classList.remove('drop');
          const file = Array.from(e.dataTransfer.files || []).find(x => x.type.startsWith('image/'));
          if (file) { e.preventDefault(); const d = await fileData(file); setImg(d.data, d.ext); }
        });
        // polia
        $$('[data-ff]', fe).forEach(inp => {
          const k = inp.dataset.ff;
          const upd = () => { f[k] = k === 'duration' ? Math.max(0, Math.min(600, parseFloat(String(inp.value).replace(',', '.')) || 0)) : inp.value; if (k === 'duration') $('.sb-sec', fe).textContent = f.duration + ' s'; commit(); };
          inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', upd);
          if (inp.tagName === 'TEXTAREA') { const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(200, inp.scrollHeight) + 'px'; }; inp.addEventListener('input', grow); setTimeout(grow, 0); }
        });
        // presúvanie za číslo
        const handle = $('.sb-num', fe);
        handle.draggable = true;
        handle.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-frame', String(i)); e.dataTransfer.effectAllowed = 'move'; fe.classList.add('dragging'); });
        handle.addEventListener('dragend', () => fe.classList.remove('dragging'));
        fe.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-frame')) { e.preventDefault(); fe.classList.add('over'); } });
        fe.addEventListener('dragleave', () => fe.classList.remove('over'));
        fe.addEventListener('drop', e => {
          const from = e.dataTransfer.getData('text/x-frame');
          fe.classList.remove('over');
          if (from === '') return;
          e.preventDefault();
          const a = +from; if (a === i) return;
          const [m] = frames.splice(a, 1); frames.splice(i, 0, m);
          commit(true); board(box);
        });
      });
    }

    function frameHtml(f, i) {
      return `<div class="sb-frame" data-i="${i}" tabindex="0">
        <div class="sb-head"><span class="sb-num" title="${t('Ťahaj na presun')}">${i + 1}</span>
          <span class="sb-sec">${(Number(f.duration) || 0)} s</span>
          <span class="grow"></span>
          <button class="sb-mini" data-fx="left" title="${t('Posunúť doľava')}">${I('left')}</button><button class="sb-mini" data-fx="right" title="${t('Posunúť doprava')}">${I('right')}</button>
          <button class="sb-mini" data-fx="dup" title="${t('Duplikovať')}">${I('duplicate')}</button><button class="sb-mini" data-fx="del" title="${t('Zmazať záber')}">${I('trash')}</button>
        </div>
        <div class="sb-img${f.image ? ' has' : ''}">
          ${f.image ? `<img src="${esc(f.image)}" alt="" draggable="false"><div class="sb-acts"><button class="btn small" data-fx="draw">${I('brush')}${t('Kresliť')}</button><button class="btn small" data-fx="pick">${I('image')}${t('Vymeniť')}</button><button class="btn small" data-fx="clear" title="${t('Odstrániť obrázok')}">${I('trash')}</button></div>`
            : `<div class="sb-empty">${I('brush')}<span>${t('Klikni a kresli')}</span><button class="btn ghost small" data-fx="pick">${I('image')}${t('alebo vlož obrázok')}</button></div>`}
        </div>
        <textarea data-ff="caption" rows="2" placeholder="${t('Čo sa v zábere deje')}">${esc(f.caption)}</textarea>
        <div class="sb-row">
          <select data-ff="shot" title="${t('Typ záberu')}"><option value="">${t('Záber')}</option>${L.SHOTS.map(s => `<option value="${esc(s)}"${f.shot === s ? ' selected' : ''}>${esc(t(s))}</option>`).join('')}${f.shot && !L.SHOTS.includes(f.shot) ? `<option selected>${esc(f.shot)}</option>` : ''}</select>
          <select data-ff="move" title="${t('Pohyb kamery')}"><option value="">${t('Kamera')}</option>${L.MOVES.map(s => `<option value="${esc(s)}"${f.move === s ? ' selected' : ''}>${esc(t(s))}</option>`).join('')}${f.move && !L.MOVES.includes(f.move) ? `<option selected>${esc(f.move)}</option>` : ''}</select>
        </div>
        <div class="sb-row">
          <label class="sb-dur" title="${t('Dĺžka záberu')}"><input data-ff="duration" type="number" min="0" step="0.5" value="${esc(f.duration)}"><span>s</span></label>
          <input data-ff="audio" value="${esc(f.audio)}" placeholder="${t('Zvuk, hudba, SFX')}">
        </div>
      </div>`;
    }

    function fileData(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res({ data: String(r.result).split(',')[1], ext: (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg') });
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }

    /* export storyboardu do jedného obrázka (na Discord / pre klienta) */
    async function exportBoard(it, mode) {
      const frames = it.frames || [];
      if (!frames.length) return;
      const aspect = it.aspect || '16:9';
      const [rw, rh] = RATIO[aspect] || [16, 9];
      const cols = aspect === '9:16' ? Math.min(5, frames.length) : aspect === '16:9' ? Math.min(3, frames.length) : Math.min(4, frames.length);
      const cellW = aspect === '9:16' ? 300 : aspect === '16:9' ? 520 : 380;
      const imgH = Math.round(cellW * rh / rw), gap = 28, pad = 48, textH = 132;
      const rows = Math.ceil(frames.length / cols);
      const W = pad * 2 + cols * cellW + (cols - 1) * gap;
      const headH = 120;
      const H = pad + headH + rows * (imgH + textH) + (rows - 1) * gap + pad;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      // farby a písmo podľa aktuálnej témy
      const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const FB = css('--body') || 'Nunito, sans-serif', FD = css('--display') || FB;
      const BG = css('--ink') || '#0d1126', BG2 = css('--panel') || '#151a3a', TX = css('--text') || '#eef0ff', MU = css('--muted') || '#9aa3d4', CELL = css('--raise') || '#1b2148';
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, BG); g.addColorStop(1, BG2);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const accent = it.color || css('--accent') || '#6ee7c8';
      c.fillStyle = accent; c.fillRect(pad, pad, 6, 64);
      c.fillStyle = TX; c.font = '700 40px ' + FD; c.textBaseline = 'top';
      c.fillText(it.title || 'Storyboard', pad + 22, pad - 2);
      const p = proj(it.projectId);
      const sec = L.storyboardSeconds(it);
      c.fillStyle = MU; c.font = '500 20px ' + FB;
      c.fillText([tp(frames.length, '{n} záber', '{n} zábery', '{n} záberov'), sec + ' s', aspect, p ? p.title + (p.client ? ', ' + p.client : '') : ''].filter(Boolean).join(',  '), pad + 22, pad + 44);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const imgs = await Promise.all(frames.map(f => f.image ? asDataUrl(f.image).then(u => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; })).catch(() => null) : Promise.resolve(null)));
      const wrap = (text, maxW, maxLines) => {
        const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
        let line = '';
        for (const w of words) { const cand = line ? line + ' ' + w : w; if (c.measureText(cand).width > maxW && line) { lines.push(line); line = w; } else line = cand; }
        if (line) lines.push(line);
        if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
        return lines;
      };
      frames.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = pad + col * (cellW + gap), y = pad + headH + row * (imgH + textH + gap);
        c.save();
        c.beginPath(); c.roundRect ? c.roundRect(x, y, cellW, imgH, 14) : c.rect(x, y, cellW, imgH); c.clip();
        c.fillStyle = CELL; c.fillRect(x, y, cellW, imgH);
        const im = imgs[i];
        if (im) { const k = Math.min(cellW / im.width, imgH / im.height), w = im.width * k, h = im.height * k; c.drawImage(im, x + (cellW - w) / 2, y + (imgH - h) / 2, w, h); }
        else { c.strokeStyle = MU + '55'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(x + 10, y + 10, cellW - 20, imgH - 20); c.setLineDash([]); }
        c.restore();
        c.fillStyle = accent; c.beginPath(); c.arc(x + 22, y + 22, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = BG; c.font = '700 17px ' + FD; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), x + 22, y + 23); c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillStyle = MU; c.font = '700 16px ' + FB;
        c.fillText([f.shot && t(f.shot), f.move && t(f.move), (Number(f.duration) || 0) + ' s'].filter(Boolean).join(',  '), x, y + imgH + 12);
        c.fillStyle = TX; c.font = '500 17px ' + FB;
        wrap(f.caption, cellW, f.audio ? 3 : 4).forEach((l, k) => c.fillText(l, x, y + imgH + 38 + k * 22));
        if (f.audio) { c.fillStyle = MU; c.font = 'italic 500 15px ' + FB; c.fillText('♪ ' + wrap(f.audio, cellW - 20, 1)[0], x, y + imgH + 38 + 3 * 22 + 2); }
      });
      c.fillStyle = MU; c.globalAlpha = .6; c.font = '500 14px ' + FB; c.textAlign = 'right';
      c.fillText('WorkingOnIt', W - pad, H - pad + 16); c.globalAlpha = 1;
      const dataUrl = cv.toDataURL('image/png');
      if (mode === 'copy') { await act('copyImage', { dataUrl }); toast(t('Storyboard je v schránke. Vlož ho do Discordu cez Ctrl+V.'), { icon: '📋' }); }
      else { const f = await act('saveImageFile', { name: it.title || 'storyboard', data: dataUrl }); if (f) toast(t('Storyboard uložený.'), { actions: [{ label: t('Ukázať'), run: () => act('revealFile', { path: f }) }] }); }
    }

    /* zmeny zvonku (napr. Claude pridal storyboard) */
    function refresh() {
      if (!openId || !page) return;
      const it = idea(openId);
      if (!it) { openId = null; page.classList.remove('open'); page.innerHTML = ''; return; }
      if (Object.keys(pending).length) return;
      const ae = document.activeElement;
      if (tab === 'board') {
        const typing = ae && page.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
        if (!typing && JSON.stringify(it.frames || []) !== lastFramesJson) body();
      } else if (editor && ae !== editor.el && (it.html || '') !== lastHtml) {
        lastHtml = it.html || '';
        editor.setHtml(lastHtml);
      }
    }

    /* malý box na stránke zákazky */
    function projectBox(boxEl, projectId) {
      const list = ideas().filter(i => i.projectId === projectId);
      boxEl.innerHTML = `<div class="sec-h"><h5>${t('Nápady a storyboardy')}</h5><span class="aside">${list.length || ''}</span></div>
        ${list.length ? `<div class="pi-list">${list.map(i => { const cov = coverOf(i); return `<button class="pi" data-idea="${i.id}">${cov ? `<img src="${esc(cov)}" alt="">` : `<span class="pi-ic">${I((i.frames || []).length ? 'storyboard' : 'bulb')}</span>`}<span><b>${esc(i.title || t('Bez názvu'))}</b><small>${(i.frames || []).length ? tp(i.frames.length, '{n} záber', '{n} zábery', '{n} záberov') : ago(i.updatedAt)}</small></span></button>`; }).join('')}</div>` : `<p class="hint">${t('Náčrty, referencie alebo storyboard k tejto zákazke.')}</p>`}
        <div class="d-actions" style="margin:8px 0 0"><button class="btn small" data-pi="note">${I('plus')}${t('Nápad')}</button><button class="btn small" data-pi="board">${I('storyboard')}Storyboard</button></div>`;
      $$('[data-idea]', boxEl).forEach(b => b.onclick = () => open(b.dataset.idea, { from: b }));
      $$('[data-pi]', boxEl).forEach(b => b.onclick = () => { const p = proj(projectId); newIdea({ kind: b.dataset.pi, projectId, title: b.dataset.pi === 'board' ? t('Storyboard: {title}', { title: p ? p.title : '' }) : '' }); });
    }

    return { render, open, close, isOpen: () => !!openId, current: () => openId, refresh, newIdea, projectBox };
  }

  return { create };
})();
