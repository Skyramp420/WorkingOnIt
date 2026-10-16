/* Drobnosti rozhrania, ktoré platia všade: vlastné vyskakovacie menu namiesto <select>,
   posuvný jazdec v segmentových ovládačoch, prípony pri číslach a plynulé prechody (morphing). */
window.Polish = (function () {
  const CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6.2 8 3.5l3 2.7M5 9.8 8 12.5l3-2.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.7l4.6-5.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const reduce = () => document.body.classList.contains('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clean = () => document.documentElement.dataset.theme === 'clean';

  /* ---------- vyskakovacie menu ---------- */
  let openMenu = null;
  function closeMenu(instant) {
    if (!openMenu) return;
    const { el, btn, onKey, onDown } = openMenu;
    openMenu = null;
    btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onDown, true);
    removeEventListener('resize', closeMenu); removeEventListener('blur', closeMenu);
    if (instant || reduce()) el.remove(); else { el.classList.add('out'); setTimeout(() => el.remove(), 140); }
  }
  /* items: [{ label, value, checked, disabled, sep }]; onPick(item) */
  function menu(anchor, items, onPick) {
    closeMenu(true);
    const el = document.createElement('div');
    el.className = 'pop-menu'; el.setAttribute('role', 'listbox');
    el.innerHTML = items.map((it, i) => it.sep ? '<hr>' : `<button type="button" role="option" data-i="${i}"${it.disabled ? ' disabled' : ''} aria-selected="${!!it.checked}"><i>${it.checked ? CHECK : ''}</i><span></span></button>`).join('');
    el.querySelectorAll('button').forEach(b => { b.querySelector('span').textContent = items[+b.dataset.i].label; });
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    el.style.minWidth = Math.max(160, r.width) + 'px';
    const mh = el.offsetHeight, mw = el.offsetWidth;
    const below = innerHeight - r.bottom - 8 >= mh || r.top < mh;
    const top = below ? Math.min(r.bottom + 5, innerHeight - mh - 8) : Math.max(8, r.top - mh - 5);
    const left = Math.max(8, Math.min(r.left, innerWidth - mw - 8));
    el.style.top = top + 'px'; el.style.left = left + 'px';
    el.style.setProperty('--ox', Math.round(r.left + r.width / 2 - left) + 'px');
    el.style.setProperty('--oy', below ? '0px' : mh + 'px');
    const btns = Array.from(el.querySelectorAll('button:not([disabled])'));
    let hl = Math.max(0, btns.findIndex(b => items[+b.dataset.i].checked));
    const setHl = i => { btns.forEach((b, k) => b.classList.toggle('hl', k === i)); hl = i; if (btns[i]) btns[i].scrollIntoView({ block: 'nearest' }); };
    btns.forEach((b, k) => { b.onmouseenter = () => setHl(k); b.onclick = () => { const it = items[+b.dataset.i]; closeMenu(); onPick(it); }; });
    el.addEventListener('mouseleave', () => setHl(-1));
    if (btns[hl] && items[+btns[hl].dataset.i].checked) btns[hl].scrollIntoView({ block: 'center' });
    let typed = '', typedT = null;
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); anchor.focus(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHl(Math.min(btns.length - 1, hl + 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHl(Math.max(0, hl - 1)); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (btns[hl]) btns[hl].click(); return; }
      if (e.key === 'Tab') { closeMenu(); return; }
      if (e.key.length === 1) {
        typed += e.key.toLowerCase(); clearTimeout(typedT); typedT = setTimeout(() => { typed = ''; }, 700);
        const k = btns.findIndex(b => items[+b.dataset.i].label.toLowerCase().startsWith(typed));
        if (k >= 0) setHl(k);
      }
    };
    const onDown = e => { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closeMenu(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    addEventListener('resize', closeMenu); addEventListener('blur', closeMenu);
    openMenu = { el, btn: anchor, onKey, onDown };
    anchor.classList.add('open'); anchor.setAttribute('aria-expanded', 'true');
    return el;
  }

  /* ---------- <select> → tlačidlo s menu (pôvodný select ostáva, zmeny idú cez jeho udalosti) ---------- */
  function label(sel) { const o = sel.options[sel.selectedIndex]; return o ? o.textContent : ''; }
  function enhanceSelect(sel) {
    if (sel.dataset.pb || sel.multiple || sel.size > 1 || sel.closest('[data-native]')) return;
    sel.dataset.pb = '1';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pb' + (sel.classList.contains('sel-inline') ? ' inline' : '');
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    if (sel.title) b.title = sel.title;
    if (sel.id) b.dataset.for = sel.id;
    b.innerHTML = '<span></span>' + CHEV;
    const sync = () => { b.querySelector('span').textContent = label(sel); b.disabled = sel.disabled; };
    sync();
    // šírka podľa najdlhšej možnosti, aby tlačidlo pri zmene neposkakovalo
    const cs = getComputedStyle(sel);
    if (sel.closest('.field')) { /* plná šírka poľa */ }
    else if (parseFloat(cs.flexGrow) > 0) { b.style.flex = cs.flexGrow + ' ' + cs.flexShrink + ' ' + cs.flexBasis; b.style.minWidth = '0'; }
    else b.style.minWidth = Math.min(240, Math.max(0, ...Array.from(sel.options).map(o => o.textContent.length)) * 7.2 + 40) + 'px';
    sel.classList.add('pb-src');
    sel.after(b);
    sel.addEventListener('change', sync);
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    const open = () => {
      if (sel.disabled) return;
      if (openMenu && openMenu.btn === b) { closeMenu(); return; }
      const items = [];
      for (const node of sel.children) {
        if (node.tagName === 'OPTGROUP') { if (items.length) items.push({ sep: true }); for (const o of node.children) items.push({ label: o.textContent, value: o.value, checked: o.selected, disabled: o.disabled }); }
        else if (node.tagName === 'OPTION' && !node.hidden) items.push({ label: node.textContent, value: node.value, checked: node.selected, disabled: node.disabled });
      }
      menu(b, items, it => {
        if (sel.value === it.value) return;
        sel.value = it.value; sync();
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
  }

  /* ---------- posuvný jazdec v segmentových ovládačoch ---------- */
  const lastPos = new Map();
  const segKey = el => { const host = el.closest('[id]'); return (host ? host.id : '') + '|' + el.className + '|' + el.children.length; };
  function placeThumb(seg, animate) {
    const on = seg.querySelector(':scope > button.on');
    let th = seg.querySelector(':scope > .seg-thumb');
    if (!on || !clean()) { if (th) th.style.opacity = 0; return; }
    if (!th) { th = document.createElement('i'); th.className = 'seg-thumb'; seg.prepend(th); animate = false; const prev = lastPos.get(segKey(seg)); if (prev) { th.style.transition = 'none'; th.style.transform = `translateX(${prev.x}px)`; th.style.width = prev.w + 'px'; void th.offsetWidth; th.style.transition = ''; animate = true; } }
    const x = on.offsetLeft, w = on.offsetWidth;
    if (!animate || reduce()) { th.style.transition = 'none'; }
    th.style.opacity = 1;
    th.style.transform = `translateX(${x}px)`; th.style.width = w + 'px';
    const c = getComputedStyle(on).getPropertyValue('--c');
    if (c) th.style.setProperty('--thumbc', 'color-mix(in srgb, ' + c.trim() + ' 22%, var(--panel))');
    if (!animate || reduce()) { void th.offsetWidth; th.style.transition = ''; }
    lastPos.set(segKey(seg), { x, w });
  }
  function enhanceSeg(seg) {
    if (seg.dataset.segd) { placeThumb(seg, true); return; }
    seg.dataset.segd = '1';
    placeThumb(seg, false);
    new MutationObserver(() => placeThumb(seg, true)).observe(seg, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- zvislá navigácia (nastavenia): výber sa presúva ako jedna pilulka ---------- */
  let vLast = null;
  function placePill(nav, animate) {
    const on = nav.querySelector(':scope > button.on');
    let p = nav.querySelector(':scope > .v-pill');
    // pozor: každá zmena tu spustí MutationObserver znova, preto meníme len to, čo naozaj treba
    if (!clean()) { if (p) p.remove(); if (nav.classList.contains('has-pill')) nav.classList.remove('has-pill'); return; }
    if (!p) { p = document.createElement('i'); p.className = 'v-pill'; nav.prepend(p); nav.classList.add('has-pill'); animate = !!vLast; if (vLast) { p.style.transition = 'none'; p.style.transform = `translateY(${vLast.y}px)`; p.style.height = vLast.h + 'px'; void p.offsetWidth; p.style.transition = ''; } }
    if (!on) { p.style.opacity = 0; return; }
    if (!animate || reduce()) p.style.transition = 'none';
    p.style.opacity = 1; p.style.transform = `translateY(${on.offsetTop}px)`; p.style.height = on.offsetHeight + 'px';
    p.style.left = on.offsetLeft + 'px'; p.style.width = on.offsetWidth + 'px';
    if (!animate || reduce()) { void p.offsetWidth; p.style.transition = ''; }
    vLast = { y: on.offsetTop, h: on.offsetHeight };
  }
  function enhanceVnav(nav) {
    if (nav.dataset.vp) { placePill(nav, true); return; }
    nav.dataset.vp = '1';
    placePill(nav, false);
    // reaguj len na zmeny tlačidiel, nie na vlastnú pilulku ani triedu na <nav> (inak nekonečná slučka a zamrznuté okno)
    const own = n => n.nodeType === 1 && n.classList.contains('v-pill');
    new MutationObserver(muts => {
      if (muts.some(m => m.type === 'attributes' ? m.target !== nav : ![...m.addedNodes, ...m.removedNodes].every(own))) placePill(nav, true);
    }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* ---------- prípona pri čísle (min, dňoch, €) nesmie prekryť číslo ---------- */
  function fixSuffix(box) {
    const inp = box.querySelector('input'), sp = box.querySelector('span');
    if (!inp || !sp || !sp.offsetWidth) return;
    inp.style.paddingRight = (sp.offsetWidth + 20) + 'px';
  }

  /* ---------- výber farby: vlastné okienko namiesto systémového ---------- */
  const PRESETS = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#40c8e0', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ac8e68', '#8e8e93', '#ffffff', '#1d1d1f'];
  const hex2hsv = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return { h: 0, s: 0, v: 1 };
    const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hh = 0; if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
  };
  const hsv2hex = ({ h, s, v }) => {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };
  let openPicker = null;
  function closePicker() {
    if (!openPicker) return;
    const { el, input, start, onKey, onDown } = openPicker; openPicker = null;
    document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true);
    if (reduce()) el.remove(); else { el.classList.add('out'); setTimeout(() => el.remove(), 140); }
    if (input.isConnected && input.value !== start) input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function colorPicker(input) {
    closeMenu(true); closePicker();
    const anchor = input;
    let hsv = hex2hsv(input.value);
    const recent = (() => { try { return JSON.parse(localStorage.getItem('woi-colors') || '[]'); } catch (e) { return []; } })();
    const el = document.createElement('div');
    el.className = 'cpick';
    el.innerHTML = `<div class="cp-sv"><i class="cp-knob"></i></div>
      <input type="range" class="cp-hue" min="0" max="360" step="1" aria-label="Hue">
      <div class="cp-row"><span class="cp-prev"></span><span class="cp-hash">#</span><input class="cp-hex" maxlength="7" spellcheck="false"></div>
      <div class="cp-sw">${PRESETS.concat(recent.filter(c => !PRESETS.includes(c)).slice(0, 6)).map(c => `<button type="button" style="--sw:${c}" data-c="${c}" title="${c}"></button>`).join('')}</div>`;
    document.body.appendChild(el);
    const sv = el.querySelector('.cp-sv'), knob = el.querySelector('.cp-knob'), hue = el.querySelector('.cp-hue'), hexIn = el.querySelector('.cp-hex'), prev = el.querySelector('.cp-prev');
    const paint = (fromHex) => {
      const hex = hsv2hex(hsv);
      sv.style.setProperty('--hue', `hsl(${hsv.h} 100% 50%)`);
      knob.style.left = (hsv.s * 100) + '%'; knob.style.top = ((1 - hsv.v) * 100) + '%';
      knob.style.background = hex; prev.style.background = hex; hue.value = hsv.h;
      if (!fromHex) hexIn.value = hex.slice(1).toUpperCase();
      el.querySelectorAll('.cp-sw button').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === hex));
      if (input.value !== hex) { input.value = hex; input.dispatchEvent(new Event('input', { bubbles: true })); }
    };
    const dragSV = e => {
      const r = sv.getBoundingClientRect();
      hsv.s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      hsv.v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      paint();
    };
    sv.addEventListener('pointerdown', e => { sv.setPointerCapture(e.pointerId); dragSV(e); sv.onpointermove = dragSV; sv.onpointerup = () => { sv.onpointermove = null; }; });
    hue.addEventListener('input', () => { hsv.h = Number(hue.value); paint(); });
    hexIn.addEventListener('input', () => { const v = hexIn.value.replace(/[^0-9a-f]/gi, ''); if (v.length === 6) { hsv = hex2hsv('#' + v); paint(true); } });
    el.querySelectorAll('.cp-sw button').forEach(b => b.onclick = () => { hsv = hex2hsv(b.dataset.c); paint(); });
    // poloha pod prvkom (alebo nad, ak dole nie je miesto)
    const r = anchor.getBoundingClientRect(), mh = el.offsetHeight, mw = el.offsetWidth;
    const below = innerHeight - r.bottom - 10 >= mh || r.top < mh;
    el.style.top = (below ? Math.min(r.bottom + 8, innerHeight - mh - 8) : Math.max(8, r.top - mh - 8)) + 'px';
    const left = Math.max(8, Math.min(r.left + r.width / 2 - mw / 2, innerWidth - mw - 8));
    el.style.left = left + 'px';
    el.style.setProperty('--ox', Math.round(r.left + r.width / 2 - left) + 'px'); el.style.setProperty('--oy', below ? '0px' : mh + 'px');
    const start = input.value;
    paint();
    const remember = () => { try { const c = input.value.toLowerCase(); if (!PRESETS.includes(c)) localStorage.setItem('woi-colors', JSON.stringify([c].concat(recent.filter(x => x !== c)).slice(0, 6))); } catch (e) { } };
    const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape' && input.value !== start) { hsv = hex2hsv(start); paint(); } else remember(); closePicker(); } };
    const onDown = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) { remember(); closePicker(); } };
    document.addEventListener('keydown', onKey, true); document.addEventListener('mousedown', onDown, true);
    openPicker = { el, input, start, onKey, onDown };
  }
  function enhanceColor(input) {
    if (input.dataset.cw || input.closest('[data-native]')) return;
    input.dataset.cw = '1';
    input.addEventListener('click', e => { e.preventDefault(); if (openPicker && openPicker.input === input) closePicker(); else colorPicker(input); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); colorPicker(input); } });
  }

  /* ---------- prejdi nový obsah ---------- */
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('select').forEach(enhanceSelect);
    if (root.tagName === 'SELECT') enhanceSelect(root);
    root.querySelectorAll('.seg, .status-pick, .id-tabs').forEach(enhanceSeg);
    if (root.matches && root.matches('.seg, .status-pick, .id-tabs')) enhanceSeg(root);
    root.querySelectorAll('.suffix').forEach(fixSuffix);
    root.querySelectorAll('input[type=color]').forEach(enhanceColor);
    root.querySelectorAll('.set-nav').forEach(enhanceVnav);
    if (root.matches && root.matches('.set-nav')) enhanceVnav(root);
  }
  let queued = new Set(), raf = 0;
  function start() {
    scan(document.body);
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) queued.add(n);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; const list = Array.from(queued); queued = new Set(); list.forEach(n => { if (n.isConnected) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', () => { document.querySelectorAll('.seg, .status-pick, .id-tabs').forEach(s => placeThumb(s, false)); document.querySelectorAll('.set-nav').forEach(n => placePill(n, false)); });
  }

  /* ---------- morphing: plynulý prechod medzi dvoma stavmi rozhrania ---------- */
  function canMorph() { return !!document.startViewTransition && clean() && !reduce() && !document.hidden; }
  /* zmení rozhranie v update(); prvky s rovnakým view-transition-name sa premenia jeden na druhý */
  function morph(update, opts) {
    opts = opts || {};
    if (!canMorph()) { update(); return Promise.resolve(); }
    const root = document.documentElement;
    if (opts.cls) root.classList.add(opts.cls);
    let vt;
    try { vt = document.startViewTransition(() => update()); }
    catch (e) { if (opts.cls) root.classList.remove(opts.cls); update(); return Promise.resolve(); }
    return vt.finished.catch(() => { }).finally(() => { if (opts.cls) root.classList.remove(opts.cls); });
  }

  /* prepnutie záložky: obsah odíde na jednu stranu a nový príde z druhej.
     getEl() vráti prvok s obsahom (pred aj po zmene, môže to byť iný prvok), dir = 1 doprava, -1 doľava */
  function slide(getEl, dir, update) {
    const old = getEl();
    if (!old || !canMorph()) { update(); return Promise.resolve(); }
    document.documentElement.style.setProperty('--slide-dir', dir < 0 ? -1 : 1);
    old.style.viewTransitionName = 'woi-slide';
    let neu = null;
    return morph(() => {
      old.style.viewTransitionName = '';
      update();
      neu = getEl();
      if (neu) neu.style.viewTransitionName = 'woi-slide';
    }, { cls: 'vt-slide' }).then(() => { if (neu) neu.style.viewTransitionName = ''; });
  }
  /* smer podľa poradia tlačidiel v skupine */
  function dirOf(btn) {
    const sibs = Array.from(btn.parentElement.querySelectorAll(':scope > button'));
    const cur = sibs.findIndex(b => b.classList.contains('on'));
    return sibs.indexOf(btn) >= cur ? 1 : -1;
  }

  return { start, menu, closeMenu, morph, canMorph, scan, placeThumb, slide, dirOf };
})();
