/* Kresliaci blok: náčrty k nápadom a políčka storyboardu.
   Sketch.open({ title, aspect, base, bg }) → Promise<{ data, dataUrl } | null>
   Kreslí sa vektorovo (ťahy sa pamätajú), takže späť/znova je presné a nežerie pamäť. */
window.Sketch = (function () {
  const t = (s, v) => I18N.t(s, v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ASPECTS = { '16:9': [1600, 900], '9:16': [900, 1600], '1:1': [1200, 1200], '4:5': [1080, 1350], free: [1600, 1000] };
  const COLORS = ['#f5f3ff', '#1d1a2b', '#6ee7c8', '#ff6b8b', '#ffd27a', '#b9a4ff', '#7cc4ff', '#ff8a3d'];
  const SIZES = [3, 7, 14, 28];
  const BGS = { dark: ['#141a38', 'Tmavé'], paper: ['#f4f1e8', 'Papier'], white: ['#ffffff', 'Biele'], black: ['#05060c', 'Čierne'] };
  const TOOLS = [['pen', 'Pero', 'B'], ['marker', 'Fix (priesvitný)', 'M'], ['eraser', 'Guma', 'E'], ['line', 'Čiara', 'L'], ['arrow', 'Šípka (pohyb kamery)', 'A'], ['rect', 'Obdĺžnik / rám', 'R'], ['ellipse', 'Elipsa', 'O']];
  let last = { tool: 'pen', color: COLORS[0], size: 1, bg: 'dark', grid: true };
  try { last = Object.assign(last, JSON.parse(localStorage.getItem('woi:sketch') || '{}')); } catch (e) { }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || .5) + (b[2] || .5)) / 2];
  const penW = (size, p) => size * (0.35 + (p == null ? .5 : p) * 1.3);

  /* jeden úsek pera: z polovice (a,b) cez b do polovice (b,c) */
  function penSeg(ctx, a, b, c, size) {
    const m1 = mid(a, b), m2 = mid(b, c);
    ctx.lineWidth = penW(size, b[2]);
    ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.quadraticCurveTo(b[0], b[1], m2[0], m2[1]); ctx.stroke();
  }
  function dot(ctx, p, w) { ctx.beginPath(); ctx.arc(p[0], p[1], w / 2, 0, Math.PI * 2); ctx.fill(); }
  /* koniec ťahu pera: dotiahne posledný polúsek k poslednému bodu */
  function penTail(ctx, op) {
    const pts = op.pts, n = pts.length;
    if (n < 2) return;
    const m = mid(pts[n - 2], pts[n - 1]);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = op.c; ctx.lineWidth = penW(op.s, pts[n - 1][2]);
    ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(pts[n - 1][0], pts[n - 1][1]); ctx.stroke(); ctx.restore();
  }

  function drawStroke(ctx, op) {
    const pts = op.pts;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = op.c;
    if (op.t === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    if (op.t === 'marker') {
      ctx.globalAlpha = .42; ctx.lineWidth = op.s * 2.4;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); else ctx.lineTo(pts[0][0] + .1, pts[0][1]);
      ctx.stroke();
    } else {
      const size = op.t === 'eraser' ? op.s * 2.6 : op.s;
      if (op.t === 'eraser') { ctx.lineWidth = size; }
      dot(ctx, pts[0], op.t === 'eraser' ? size : penW(size, pts[0][2]));
      for (let i = 1; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 2)], b = pts[i - 1], c = pts[i];
        if (op.t === 'eraser') { ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
        else penSeg(ctx, i === 1 ? b : a, b, c, size);
      }
    }
    ctx.restore();
    if (op.t === 'pen') penTail(ctx, op);
  }
  function drawShape(ctx, op) {
    const [x1, y1] = op.a, [x2, y2] = op.b;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ctx.fillStyle = op.c; ctx.lineWidth = op.s;
    ctx.beginPath();
    if (op.t === 'line' || op.t === 'arrow') {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (op.t === 'arrow') {
        const ang = Math.atan2(y2 - y1, x2 - x1), len = Math.max(14, op.s * 4.2);
        ctx.beginPath();
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - len * Math.cos(ang - .45), y2 - len * Math.sin(ang - .45));
        ctx.moveTo(x2, y2); ctx.lineTo(x2 - len * Math.cos(ang + .45), y2 - len * Math.sin(ang + .45));
        ctx.stroke();
      }
    } else if (op.t === 'rect') {
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (op.t === 'ellipse') {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function drawImage(ctx, op) { ctx.drawImage(op.img, op.x, op.y, op.w, op.h); }
  function drawOp(ctx, op) {
    if (op.pts) drawStroke(ctx, op);
    else if (op.img) drawImage(ctx, op);
    else if (op.a) drawShape(ctx, op);
  }

  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(t('Obrázok sa nepodarilo načítať.'))); i.src = src; });
  }
  function fileToDataUrl(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }

  function open(opts) {
    opts = opts || {};
    const aspect = ASPECTS[opts.aspect] ? opts.aspect : 'free';
    const [W, H] = ASPECTS[aspect];
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'sk-wrap';
      const tb = (name, title, attr) => `<button class="sk-b" ${attr} title="${esc(title)}">${ICONS.svg(name)}</button>`;
      wrap.innerHTML = `<div class="sk" role="dialog" aria-label="${t('Kreslenie')}">
        <div class="sk-top">
          <span class="sk-title">${ICONS.svg('brush')}<b>${esc(opts.title || t('Náčrt'))}</b>${aspect !== 'free' ? `<span class="chip">${aspect}</span>` : ''}</span>
          <span class="grow"></span>
          <span class="sk-hint">${t('Pero reaguje na tlak tabletu · Ctrl+V vloží obrázok · Ctrl+Z späť')}</span>
          <button class="btn ghost small" data-x>${t('Zrušiť')}</button>
          <button class="btn primary small" data-save>${ICONS.svg('check')}${t('Uložiť')}</button>
        </div>
        <div class="sk-body">
          <div class="sk-tools">
            <div class="sk-group">${TOOLS.map(([id, name, k]) => tb(id, t(name) + ' (' + k + ')', `data-tool="${id}"`)).join('')}</div>
            <div class="sk-group sk-colors">${COLORS.map(c => `<button class="sk-c" data-color="${c}" style="--sw:${c}" title="${c}"></button>`).join('')}<label class="sk-c sk-custom" title="${t('Vlastná farba')}"><input type="color" data-custom value="#ff6b8b"></label></div>
            <div class="sk-group sk-sizes">${SIZES.map((sz, i) => `<button class="sk-b" data-size="${i}" title="${t('Hrúbka {n} ([ a ])', { n: i + 1 })}"><i style="width:${4 + i * 4}px;height:${4 + i * 4}px"></i></button>`).join('')}</div>
            <div class="sk-group">
              ${tb('undo', t('Späť (Ctrl+Z)'), 'data-do="undo"')}${tb('redo', t('Znova (Ctrl+Shift+Z)'), 'data-do="redo"')}
              ${tb('grid', t('Mriežka tretín (G)'), 'data-do="grid"')}${tb('image', t('Vložiť obrázok'), 'data-do="image"')}
              ${tb('trash', t('Vymazať všetko'), 'data-do="clear"')}
            </div>
            <div class="sk-group sk-bgs">${Object.entries(BGS).map(([k, [c, n]]) => `<button class="sk-bg" data-bg="${k}" style="--sw:${c}" title="${t('Pozadie: {name}', { name: t(n) })}"></button>`).join('')}</div>
            <input type="file" accept="image/*" hidden data-file>
          </div>
          <div class="sk-stage"><div class="sk-paper"><canvas class="sk-cv-bg" width="${W}" height="${H}"></canvas><canvas class="sk-cv-ink" width="${W}" height="${H}"></canvas><canvas class="sk-cv-pre" width="${W}" height="${H}"></canvas><div class="sk-grid"><i></i><i></i><i></i><i></i></div></div></div>
        </div>
      </div>`;
      document.body.appendChild(wrap);
      const $ = s => wrap.querySelector(s), $$ = s => Array.from(wrap.querySelectorAll(s));
      const bgC = $('.sk-cv-bg'), ink = $('.sk-cv-ink'), pre = $('.sk-cv-pre');
      const bx = bgC.getContext('2d'), ix = ink.getContext('2d'), px = pre.getContext('2d');
      const paper = $('.sk-paper'), stage = $('.sk-stage');
      let ops = [], redo = [], baseImg = null, cur = null, dirty = false;
      const st = Object.assign({}, last, opts.bg ? { bg: opts.bg } : {});

      const fit = () => {
        const r = stage.getBoundingClientRect();
        const k = Math.min((r.width - 24) / W, (r.height - 24) / H);
        paper.style.width = Math.max(50, W * k) + 'px'; paper.style.height = Math.max(50, H * k) + 'px';
      };
      const paintBg = () => { bx.fillStyle = (BGS[st.bg] || BGS.dark)[0]; bx.fillRect(0, 0, W, H); paper.dataset.bg = st.bg; };
      const redraw = () => {
        ix.clearRect(0, 0, W, H);
        let from = 0;
        for (let i = ops.length - 1; i >= 0; i--) if (ops[i].t === 'clear') { from = i + 1; break; }
        if (from === 0 && baseImg) {
          const k = Math.min(W / baseImg.width, H / baseImg.height), w = baseImg.width * k, h = baseImg.height * k;
          ix.drawImage(baseImg, (W - w) / 2, (H - h) / 2, w, h);
        }
        for (let i = from; i < ops.length; i++) drawOp(ix, ops[i]);
      };
      const sync = () => {
        $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === st.tool));
        $$('[data-color]').forEach(b => b.classList.toggle('on', b.dataset.color === st.color));
        const custom = !COLORS.includes(st.color);
        $('.sk-custom').classList.toggle('on', custom); if (custom) $('[data-custom]').value = st.color;
        $$('[data-size]').forEach(b => b.classList.toggle('on', +b.dataset.size === st.size));
        $$('[data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg === st.bg));
        $('[data-do="grid"]').classList.toggle('on', !!st.grid);
        $('.sk-grid').hidden = !st.grid;
        $('[data-do="undo"]').disabled = !ops.length; $('[data-do="redo"]').disabled = !redo.length;
        pre.style.cursor = st.tool === 'eraser' ? 'cell' : 'crosshair';
        try { localStorage.setItem('woi:sketch', JSON.stringify({ tool: st.tool, color: st.color, size: st.size, bg: st.bg, grid: st.grid })); } catch (e) { }
      };
      const push = op => { ops.push(op); redo = []; dirty = true; sync(); };

      /* kreslenie */
      const pos = e => { const r = pre.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; };
      pre.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        pre.setPointerCapture(e.pointerId);
        const p = pos(e), size = SIZES[st.size] * (W / 1600 + .4);
        if (['pen', 'marker', 'eraser'].includes(st.tool)) {
          cur = { t: st.tool, c: st.color, s: size, pts: [p] };
          if (st.tool === 'pen') { ix.save(); ix.fillStyle = st.color; dot(ix, p, penW(size, p[2])); ix.restore(); }
          if (st.tool === 'eraser') drawStroke(ix, cur);
          if (st.tool === 'marker') { px.clearRect(0, 0, W, H); drawStroke(px, cur); }
        } else cur = { t: st.tool, c: st.color, s: Math.max(2, size * .8), a: p.slice(0, 2), b: p.slice(0, 2) };
      });
      pre.addEventListener('pointermove', e => {
        if (!cur) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of (evs.length ? evs : [e])) {
          const p = pos(ev);
          if (cur.pts) {
            const pts = cur.pts, lastP = pts[pts.length - 1];
            if (Math.hypot(p[0] - lastP[0], p[1] - lastP[1]) < 1.2) continue;
            pts.push(p);
            const n = pts.length;
            if (cur.t === 'pen') { ix.save(); ix.lineCap = 'round'; ix.strokeStyle = cur.c; penSeg(ix, pts[Math.max(0, n - 3)], pts[n - 2], pts[n - 1], cur.s); ix.restore(); }
            else if (cur.t === 'eraser') { ix.save(); ix.globalCompositeOperation = 'destination-out'; ix.lineCap = 'round'; ix.lineWidth = cur.s * 2.6; ix.beginPath(); ix.moveTo(pts[n - 2][0], pts[n - 2][1]); ix.lineTo(p[0], p[1]); ix.stroke(); ix.restore(); }
          } else {
            cur.b = p.slice(0, 2);
            if (e.shiftKey && (cur.t === 'line' || cur.t === 'arrow')) {
              // Shift = vodorovne / zvislo / 45°
              const dx = cur.b[0] - cur.a[0], dy = cur.b[1] - cur.a[1], ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
              cur.b = [cur.a[0] + Math.cos(ang) * len, cur.a[1] + Math.sin(ang) * len];
            }
          }
        }
        if (cur.t === 'marker') { px.clearRect(0, 0, W, H); drawStroke(px, cur); }
        else if (!cur.pts) { px.clearRect(0, 0, W, H); drawShape(px, cur); }
      });
      const end = () => {
        if (!cur) return;
        px.clearRect(0, 0, W, H);
        if (cur.t === 'pen') penTail(ix, cur);
        if (cur.t === 'marker') drawStroke(ix, cur);
        if (!cur.pts) { if (Math.hypot(cur.b[0] - cur.a[0], cur.b[1] - cur.a[1]) < 3) { cur = null; return; } drawShape(ix, cur); }
        push(cur); cur = null;
      };
      pre.addEventListener('pointerup', end);
      pre.addEventListener('pointercancel', end);

      /* obrázky */
      const addImage = async src => {
        try {
          const img = await loadImg(src);
          const k = Math.min(W / img.width, H / img.height);
          const w = img.width * k, h = img.height * k;
          const op = { t: 'image', img, x: (W - w) / 2, y: (H - h) / 2, w, h };
          drawImage(ix, op); push(op);
        } catch (e) { }
      };
      $('[data-file]').onchange = async e => { const f = e.target.files[0]; if (f) addImage(await fileToDataUrl(f)); e.target.value = ''; };
      const onPaste = async e => {
        const item = Array.from((e.clipboardData || {}).items || []).find(i => i.type.startsWith('image/'));
        if (!item) return;
        e.preventDefault(); e.stopPropagation();
        addImage(await fileToDataUrl(item.getAsFile()));
      };
      document.addEventListener('paste', onPaste, true);
      paper.addEventListener('dragover', e => { e.preventDefault(); });
      paper.addEventListener('drop', async e => { e.preventDefault(); const f = Array.from(e.dataTransfer.files || []).find(x => x.type.startsWith('image/')); if (f) addImage(await fileToDataUrl(f)); });

      /* ovládanie */
      const doAct = k => {
        if (k === 'undo' && ops.length) { redo.push(ops.pop()); redraw(); dirty = true; }
        if (k === 'redo' && redo.length) { ops.push(redo.pop()); redraw(); dirty = true; }
        if (k === 'grid') st.grid = !st.grid;
        if (k === 'image') $('[data-file]').click();
        if (k === 'clear' && (ops.length || baseImg)) { push({ t: 'clear' }); redraw(); }
        sync();
      };
      $$('[data-tool]').forEach(b => b.onclick = () => { st.tool = b.dataset.tool; sync(); });
      $$('[data-color]').forEach(b => b.onclick = () => { st.color = b.dataset.color; if (st.tool === 'eraser') st.tool = 'pen'; sync(); });
      $('[data-custom]').oninput = e => { st.color = e.target.value; if (st.tool === 'eraser') st.tool = 'pen'; sync(); };
      $$('[data-size]').forEach(b => b.onclick = () => { st.size = +b.dataset.size; sync(); });
      $$('[data-bg]').forEach(b => b.onclick = () => { st.bg = b.dataset.bg; paintBg(); sync(); });
      $$('[data-do]').forEach(b => b.onclick = () => doAct(b.dataset.do));

      let armed = false;
      const finish = result => {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('paste', onPaste, true);
        removeEventListener('resize', fit);
        wrap.classList.add('closing');
        setTimeout(() => wrap.remove(), 180);
        resolve(result);
      };
      const cancel = () => {
        if (dirty && !armed) { armed = true; const x = $('[data-x]'); x.textContent = t('Zahodiť kresbu?'); x.classList.add('danger'); setTimeout(() => { armed = false; x.textContent = t('Zrušiť'); x.classList.remove('danger'); }, 2600); return; }
        finish(null);
      };
      const save = () => {
        const out = document.createElement('canvas'); out.width = W; out.height = H;
        const o = out.getContext('2d');
        o.drawImage(bgC, 0, 0); o.drawImage(ink, 0, 0);
        const dataUrl = out.toDataURL('image/png');
        finish({ dataUrl, data: dataUrl.split(',')[1], width: W, height: H, ext: 'png' });
      };
      $('[data-x]').onclick = cancel;
      $('[data-save]').onclick = save;
      const onKey = e => {
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'color') return;
        let handled = true;
        if (k === 'escape') cancel();
        else if (mod && k === 'z') doAct(e.shiftKey ? 'redo' : 'undo');
        else if (mod && k === 'y') doAct('redo');
        else if (mod && (k === 's' || k === 'enter')) save();
        else if (mod) handled = false;
        else if (k === 'b') { st.tool = 'pen'; sync(); }
        else if (k === 'm') { st.tool = 'marker'; sync(); }
        else if (k === 'e') { st.tool = 'eraser'; sync(); }
        else if (k === 'l') { st.tool = 'line'; sync(); }
        else if (k === 'a') { st.tool = 'arrow'; sync(); }
        else if (k === 'r') { st.tool = 'rect'; sync(); }
        else if (k === 'o') { st.tool = 'ellipse'; sync(); }
        else if (k === 'g') doAct('grid');
        else if (k === '[') { st.size = Math.max(0, st.size - 1); sync(); }
        else if (k === ']') { st.size = Math.min(SIZES.length - 1, st.size + 1); sync(); }
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
      };
      document.addEventListener('keydown', onKey, true);
      addEventListener('resize', fit);

      paintBg(); sync();
      requestAnimationFrame(fit);
      if (opts.base) loadImg(opts.base).then(img => { baseImg = img; redraw(); }).catch(() => { });
    });
  }

  return { open, ASPECTS };
})();
