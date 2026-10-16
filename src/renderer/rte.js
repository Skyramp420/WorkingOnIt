/* Jednoduchý editor poznámok s formátovaním (ako v Notione):
   nadpisy, tučné, zoznamy, úlohy, citát, kód, zvýraznenie, odkazy, obrázky (vložiť / pretiahnuť) a skratky ako „# “ či „- “. */
window.RTE = (function () {
  const ALLOWED = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'A', 'IMG', 'HR', 'MARK', 'SPAN', 'FIGURE']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK', 'TITLE', 'HEAD', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);

  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    const walk = node => {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === 8) { ch.remove(); continue; }
        if (ch.nodeType !== 1) continue;
        if (DROP.has(ch.tagName)) { ch.remove(); continue; }
        walk(ch);
        if (!ALLOWED.has(ch.tagName)) { ch.replaceWith(...Array.from(ch.childNodes)); continue; }
        for (const at of Array.from(ch.attributes)) {
          const n = at.name.toLowerCase(), v = at.value;
          const ok = (ch.tagName === 'A' && n === 'href' && /^(https?:|mailto:)/i.test(v)) ||
            (ch.tagName === 'IMG' && n === 'src' && /^(file:|data:image\/)/i.test(v)) ||
            (ch.tagName === 'IMG' && n === 'alt') ||
            (n === 'class' && /^(todo|done)$/.test(v)) ||
            (n === 'data-done' && /^[01]$/.test(v));
          if (!ok) ch.removeAttribute(at.name);
        }
        if (ch.tagName === 'A') { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener'); }
      }
    };
    walk(doc.body);
    return doc.body.innerHTML;
  }

  function textToHtml(text) {
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lines = String(text || '').split(/\n/);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.map(l => l.trim() ? '<p>' + esc(l) + '</p>' : '<p><br></p>').join('');
  }

  const tr = s => (window.I18N ? I18N.t(s) : s);
  const BTN = [
    ['h1', 'Nadpis', '<b style="font:700 13px var(--display)">H1</b>'],
    ['h2', 'Podnadpis', '<b style="font:700 12px var(--display)">H2</b>'],
    ['|'],
    ['bold', 'Tučné (Ctrl+B)', '<b>B</b>'],
    ['italic', 'Kurzíva (Ctrl+I)', '<i style="font-family:serif">I</i>'],
    ['underline', 'Podčiarknuté (Ctrl+U)', '<u>U</u>'],
    ['strike', 'Prečiarknuté', '<s>S</s>'],
    ['mark', 'Zvýrazniť', '<span style="background:color-mix(in srgb,var(--amber) 45%,transparent);border-radius:3px;padding:0 3px">A</span>'],
    ['|'],
    ['ul', 'Odrážky', '<svg viewBox="0 0 20 20"><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="14" r="1.5" fill="currentColor"/><path d="M8 6h9M8 14h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    ['ol', 'Číslovaný zoznam', '<svg viewBox="0 0 20 20"><text x="1.5" y="8.5" font-size="7" fill="currentColor" font-family="sans-serif">1</text><text x="1.5" y="16.5" font-size="7" fill="currentColor" font-family="sans-serif">2</text><path d="M8 6h9M8 14h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    ['todo', 'Úlohy', '<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.8 6.5l1.4 1.4L7.6 5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 6.5h6.5M11 14.5h6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    ['quote', 'Citát', '<svg viewBox="0 0 20 20"><path d="M4 4v12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8 7h9M8 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    ['code', 'Kód', '<svg viewBox="0 0 20 20"><path d="M7 6l-4 4 4 4M13 6l4 4-4 4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
    ['hr', 'Oddeľovač', '<svg viewBox="0 0 20 20"><path d="M3 10h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    ['|'],
    ['link', 'Odkaz', '<svg viewBox="0 0 20 20"><path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l1-1" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>'],
    ['image', 'Obrázok (alebo vlož cez Ctrl+V)', '<svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="7" cy="8.2" r="1.5" fill="currentColor"/><path d="M3 15l4.5-4 3.5 3 2.5-2 4 3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>']
  ];

  function create(root, opts) {
    const extra = (opts.extra || []).map(x => `<button type="button" data-x="${x.id}" title="${x.title}" class="rte-x">${x.html}</button>`).join('');
    root.innerHTML = `<div class="rte-bar">${BTN.map(b => b[0] === '|' ? '<i class="rte-sep"></i>' : `<button type="button" data-c="${b[0]}" title="${tr(b[1])}">${b[2]}</button>`).join('')}${extra ? '<i class="rte-sep"></i>' + extra : ''}<input type="file" accept="image/*" multiple hidden></div>
      <div class="rte" contenteditable="true" spellcheck="true" data-ph="${opts.placeholder || ''}"></div>`;
    const ed = root.querySelector('.rte'), file = root.querySelector('input[type=file]');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
    ed.innerHTML = sanitize(opts.html || '') || '';
    let tmr;
    const changed = () => { clearTimeout(tmr); tmr = setTimeout(() => opts.onChange(sanitize(ed.innerHTML), ed.innerText.trim()), 600); };
    const exec = (c, v) => { ed.focus(); document.execCommand(c, false, v); changed(); };
    const block = tag => {
      const cur = document.queryCommandValue('formatBlock').toLowerCase();
      exec('formatBlock', cur === tag ? 'p' : tag);
    };
    // zoznamy robíme priamo v DOM: execCommand v Chromiu vnára <ul> do <p> a spája susedné zoznamy
    const listCmd = (cmd, todo) => {
      ed.focus();
      const sel = getSelection();
      if (!sel.rangeCount) return;
      let n = sel.anchorNode;
      let blk = (n.nodeType === 1 ? n : n.parentElement).closest('li,p,div,h1,h2,h3,blockquote,pre');
      if (!blk || blk === ed || !ed.contains(blk)) {
        // text priamo v editore: zabalíme ho do odseku
        const p = document.createElement('p');
        if (n.nodeType === 3 && n.parentNode === ed) { n.replaceWith(p); p.appendChild(n); } else { ed.appendChild(p); p.appendChild(document.createElement('br')); }
        blk = p;
      }
      const tag = cmd === 'insertOrderedList' ? 'OL' : 'UL';
      if (blk.tagName === 'LI') { // už je v zozname: prepni typ
        const list = blk.parentElement;
        if (todo) list.classList.toggle('todo');
        else if (list.tagName !== tag) { const nl = document.createElement(tag); nl.innerHTML = list.innerHTML; list.replaceWith(nl); }
        changed(); return;
      }
      const list = document.createElement(tag);
      if (todo) list.className = 'todo';
      const li = document.createElement('li');
      while (blk.firstChild) li.appendChild(blk.firstChild);
      if (!li.textContent.trim() && !li.querySelector('img')) { li.innerHTML = ''; li.appendChild(document.createElement('br')); }
      list.appendChild(li);
      blk.replaceWith(list);
      const r = document.createRange();
      const last = li.lastChild;
      if (last && last.nodeType === 3) r.setStart(last, last.textContent.length); else if (last && last.tagName === 'BR') r.setStartBefore(last); else r.selectNodeContents(li);
      r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
      changed();
    };
    const insertTodo = () => listCmd('insertUnorderedList', true);
    const insertImages = async files => {
      for (const f of files) {
        if (!/^image\//.test(f.type)) continue;
        const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
        const src = await opts.onImage({ data, ext: (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg') });
        if (src) { ed.focus(); document.execCommand('insertHTML', false, `<img src="${src}" alt=""><p><br></p>`); }
      }
      changed();
    };
    root.querySelector('.rte-bar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    // pamätáme si posledné miesto kurzora, aby sa obrázok z kreslenia vložil tam, kde si písal
    let lastRange = null;
    const keepRange = () => { const sel = getSelection(); if (sel.rangeCount && ed.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange(); };
    ed.addEventListener('keyup', keepRange); ed.addEventListener('mouseup', keepRange); ed.addEventListener('blur', keepRange);
    (opts.extra || []).forEach(x => { const b = root.querySelector(`[data-x="${x.id}"]`); if (b) b.onclick = () => { keepRange(); x.run(); }; });
    // len vstavané tlačidlá; doplnkové (napr. kreslenie) majú vlastný onclick vyššie
    root.querySelectorAll('.rte-bar button[data-c]').forEach(b => b.onclick = () => {
      const c = b.dataset.c;
      if (c === 'h1') block('h1');
      else if (c === 'h2') block('h2');
      else if (c === 'bold') exec('bold');
      else if (c === 'italic') exec('italic');
      else if (c === 'underline') exec('underline');
      else if (c === 'strike') exec('strikeThrough');
      else if (c === 'mark') { const sel = getSelection(); if (sel.toString()) exec('insertHTML', '<mark>' + sel.toString().replace(/[<>&]/g, '') + '</mark>'); }
      else if (c === 'ul') listCmd('insertUnorderedList');
      else if (c === 'ol') listCmd('insertOrderedList');
      else if (c === 'todo') insertTodo();
      else if (c === 'quote') block('blockquote');
      else if (c === 'code') block('pre');
      else if (c === 'hr') exec('insertHTML', '<hr><p><br></p>');
      else if (c === 'link') {
        const sel = getSelection();
        const range = sel.rangeCount && ed.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
        if (opts.askLink) opts.askLink(b, u => {
          if (!u) return;
          ed.focus();
          if (range) { sel.removeAllRanges(); sel.addRange(range); }
          const href = /^(https?:|mailto:)/.test(u) ? u : 'https://' + u;
          if (range && !range.collapsed) exec('createLink', href);
          else exec('insertHTML', `<a href="${href.replace(/"/g, '%22')}">${href.replace(/[<>&]/g, '')}</a>&nbsp;`);
        });
      }
      else if (c === 'image') file.click();
    });
    file.onchange = () => { insertImages(Array.from(file.files)); file.value = ''; };

    // úlohy: klik na krúžok odškrtne
    ed.addEventListener('click', e => {
      const li = e.target.closest('ul.todo > li');
      if (li && e.offsetX < 24) { li.dataset.done = li.dataset.done === '1' ? '0' : '1'; changed(); }
      const a = e.target.closest('a');
      if (a && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(a.href); }
    });
    ed.addEventListener('dblclick', e => { if (e.target.tagName === 'IMG' && opts.onOpenImage) opts.onOpenImage(e.target.src); });

    // markdown skratky na začiatku riadku
    ed.addEventListener('keydown', e => {
      if (e.key === ' ') {
        const sel = getSelection(); if (!sel.rangeCount) return;
        const node = sel.anchorNode;
        if (!node || node.nodeType !== 3) return;
        const before = node.textContent.slice(0, sel.anchorOffset);
        const map = { '#': () => block('h1'), '##': () => block('h2'), '###': () => block('h3'), '-': () => listCmd('insertUnorderedList'), '*': () => listCmd('insertUnorderedList'), '1.': () => listCmd('insertOrderedList'), '>': () => block('blockquote'), '[]': () => insertTodo(), '```': () => block('pre') };
        const blockEl = node.parentElement.closest('p,div,h1,h2,h3,li,blockquote') || ed;
        const isStart = blockEl.textContent.trim() === before.trim() || blockEl === ed;
        if (map[before] && isStart) {
          e.preventDefault();
          const rest = node.textContent.slice(sel.anchorOffset);
          const r = document.createRange();
          if (rest) { node.textContent = rest; r.setStart(node, 0); }
          else { const br = document.createElement('br'); node.replaceWith(br); r.setStartBefore(br); }
          r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
          map[before]();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); root.querySelector('[data-c=link]').click(); }
    });
    ed.addEventListener('input', changed);
    ed.addEventListener('paste', e => {
      const files = Array.from(e.clipboardData.files || []).filter(f => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); insertImages(files); return; }
      const html = e.clipboardData.getData('text/html');
      if (html) { e.preventDefault(); document.execCommand('insertHTML', false, sanitize(html)); changed(); }
    });
    ed.addEventListener('dragover', e => { if (Array.from(e.dataTransfer.items || []).some(i => i.kind === 'file')) { e.preventDefault(); root.classList.add('drop'); } });
    ed.addEventListener('dragleave', () => root.classList.remove('drop'));
    ed.addEventListener('drop', e => {
      root.classList.remove('drop');
      const files = Array.from(e.dataTransfer.files || []).filter(f => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); insertImages(files); }
    });
    return {
      el: ed,
      setHtml(h) { if (document.activeElement !== ed) ed.innerHTML = sanitize(h || ''); },
      focus() { ed.focus(); },
      /* vloží HTML tam, kde bol kurzor (inak na koniec) */
      insertHtml(h) {
        ed.focus();
        const sel = getSelection();
        if (lastRange && ed.contains(lastRange.startContainer)) { sel.removeAllRanges(); sel.addRange(lastRange); }
        else { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
        document.execCommand('insertHTML', false, sanitize(h));
        keepRange();
        changed();
      },
      replaceImage(oldSrc, newSrc) {
        let n = 0;
        ed.querySelectorAll('img').forEach(img => { if (img.src === oldSrc || img.getAttribute('src') === oldSrc) { img.src = newSrc; n++; } });
        if (n) changed();
        return n;
      },
      flush() { clearTimeout(tmr); opts.onChange(sanitize(ed.innerHTML), ed.innerText.trim()); }
    };
  }

  return { create, sanitize, textToHtml };
})();
