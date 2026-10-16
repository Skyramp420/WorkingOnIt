/* WorkingOnIt — čítanie správ od klientov a Notion importu */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WOI = Object.assign(root.WOI || {}, factory());
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;
  /* preklady a jazyk (i18n.js); bez nich slovenčina */
  let NODE_I18N = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') { try { NODE_I18N = require('./i18n.js'); } catch (e) { } }
  const I = () => (typeof I18N !== 'undefined' ? I18N : NODE_I18N);
  const tr = (s, v) => { const i = I(); return i ? i.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m)); };
  // 10/15 v americkej angličtine je mesiac/deň
  const usDates = () => { const i = I(); return !!(i && i.lang === 'en' && /^en-US$/i.test(i.locale())); };

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today(now) {
    const d = new Date(now || Date.now()); d.setHours(0, 0, 0, 0); return d;
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

  const WEEKDAYS = [
    // index podľa Date.getDay()
    ['nedel', 'sunday', 'sun'],
    ['pondel', 'monday', 'mon'],
    ['utor', 'uter', 'tuesday', 'tue'],
    ['stred', 'wednesday', 'wed'],
    ['stvrt', 'ctvrt', 'thursday', 'thu'],
    ['piat', 'patek', 'patku', 'friday', 'fri'],
    ['sobot', 'saturday', 'sat']
  ];
  const MONTHS = [
    ['januar', 'january', 'jan', 'leden', 'ledn'], ['februar', 'february', 'feb', 'unor'], ['marec', 'marca', 'march', 'mar', 'brez'],
    ['april', 'apr', 'duben', 'dubn'], ['maj', 'may', 'kveten', 'kvetn'], ['jun', 'june', 'cerven', 'cervn'], ['jul', 'july', 'cervenec', 'cervenc'], ['august', 'aug', 'srpen', 'srpn'],
    ['septemb', 'sept', 'sep', 'zari'], ['oktob', 'october', 'oct', 'okt', 'rijen', 'rijn'], ['novemb', 'nov', 'listopad'], ['decemb', 'dec', 'prosin']
  ];
  function monthIndex(word) {
    const w = fold(word);
    for (let i = 0; i < MONTHS.length; i++) for (const k of MONTHS[i]) if (w.startsWith(k)) return i;
    return -1;
  }

  function futureDate(day, month, year, now) {
    const t = today(now);
    let y = year != null ? (year < 100 ? 2000 + year : year) : t.getFullYear();
    let d = new Date(y, month, day);
    if (year == null && d < addDays(t, -1)) d = new Date(y + 1, month, day);
    if (d.getMonth() !== month) return null;
    return d;
  }

  /* --- deadline ---
     Zbiera všetkých kandidátov. Prednosť má ten, pred ktorým je „do“, „deadline“, „by“...
     (aby „na 31. 10. mám event, ale video do piatku“ dalo piatok). */
  function findDeadline(text, now) {
    const f = fold(text);
    const t = today(now);
    const body = f.replace(/^.*\s[—–-]\s.*$/m, ''); // Discord hlavička nie je deadline
    const cands = [];
    const add = (re, toDate) => {
      const g = new RegExp(re.source, 'g');
      let m;
      while ((m = g.exec(body))) {
        const d = toDate(m);
        if (d) cands.push({ date: iso(d), src: m[0].trim(), index: m.index, len: m[0].length });
        if (m[0].length === 0) g.lastIndex++;
      }
    };
    add(/\b(pozajtra|pozitri)\b/, () => addDays(t, 2));
    add(/\b(zajtra|tomorrow|zitra)\b/, () => addDays(t, 1));
    add(/\b(do dnes|dnes vecer|este dnes|today|tonight|asap|eod|end of (?:the )?day|co najskor|co nejdriv)\b/, () => t);
    add(/\b(?:do|za|in|within)\s+(\d{1,2}|a couple(?: of)?|a few|one|two|three|four|five|six|seven|ten)\s*(?:dni|dnov|dnu|den|days?|d)\b/, m => {
      const map = { 'a couple': 2, 'a couple of': 2, 'a few': 3, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
      return addDays(t, map[m[1]] || +m[1]);
    });
    add(/\b(?:koniec tyzdna|konca tyzdna|end of (?:the )?week|eow)\b/, () => addDays(t, (5 - t.getDay() + 7) % 7));
    add(/\b(?:do|za|in|within)\s+(\d{1,2}|dvoch|dvou|dva|two|troch|tri|three)\s*(?:tyzd\w*|tyd\w*|weeks?)\b/, m => {
      const map = { dvoch: 2, dvou: 2, dva: 2, two: 2, troch: 3, tri: 3, three: 3 };
      return addDays(t, (map[m[1]] || +m[1]) * 7);
    });
    add(/\b(?:do|za|in|within)\s+(?:a\s+|1\s+|jedneho\s+)?(?:tyzdna|tyzden|tyden|tydne|week)\b/, () => addDays(t, 7));
    add(/\b(?:buduci tyzden|next week|dalsi tyzden|pristi tyden)\b/, () => addDays(t, ((5 - t.getDay() + 7) % 7) + 7));
    add(/\b(?:cez vikend|o vikendu|weekend|vikend)\b/, () => addDays(t, ((0 - t.getDay() + 7) % 7) || 7));
    add(/\b(?:koniec mesiaca|konca mesiaca|konce mesice|end of (?:the )?month)\b/, () => new Date(t.getFullYear(), t.getMonth() + 1, 0));
    add(/\b(\d{1,2})\s*([./])\s*(\d{1,2})\s*[./]?\s*(\d{4}|\d{2})?\b/, m => {
      let d = +m[1], mo = +m[3];
      if (m[2] === '/' && usDates()) { d = +m[3]; mo = +m[1]; }
      return (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) ? futureDate(d, mo - 1, m[4] ? +m[4] : null, now) : null;
    });
    add(/\b(\d{1,2})(?:\.|st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,})\b(?:\s+(\d{4}))?/, m => { const mi = monthIndex(m[2]); return mi >= 0 ? futureDate(+m[1], mi, m[3] ? +m[3] : null, now) : null; });
    // „by the 20th“: deň v tomto mesiaci (alebo v ďalšom, ak už bol)
    add(/\b(?:by|on|until|till|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/, m => {
      const after = m.input.slice(m.index + m[0].length).match(/^\s+(?:of\s+)?([a-z]{3,})/);
      if (after && monthIndex(after[1]) >= 0) return null;
      const d = +m[1]; if (d < 1 || d > 31) return null;
      let x = new Date(t.getFullYear(), t.getMonth(), d);
      if (x < t) x = new Date(t.getFullYear(), t.getMonth() + 1, d);
      return x.getDate() === d ? x : null;
    });
    add(/\b([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/, m => { const mi = monthIndex(m[1]); return mi >= 0 ? futureDate(+m[2], mi, m[3] ? +m[3] : null, now) : null; });
    for (let i = 0; i < 7; i++) {
      for (const k of WEEKDAYS[i]) {
        add(new RegExp('\\b(?:(do|v|vo|na|by|on|until|till)\\s+)?' + k + '\\w*\\b'), m => {
          if (k.length <= 3 && !/^(by|on|until|till)$/.test(m[1] || '')) return null;
          let diff = (i - t.getDay() + 7) % 7; if (diff === 0) diff = 7;
          return addDays(t, diff);
        });
      }
    }
    if (!cands.length) return null;
    const cue = /(?:\bdo|\bby|\buntil|\btill|deadline|termin|odovzd|odevzd|hotove|hotovo|potrebujem|potrebuji|need it|due)\W*\s*$/;
    for (const c of cands) {
      const before = body.slice(Math.max(0, c.index - 18), c.index);
      c.cue = /^(do|by|until|till)\b/.test(c.src) || cue.test(before);
    }
    cands.sort((a, b) => (b.cue - a.cue) || (a.index - b.index));
    return { date: cands[0].date, src: cands[0].src };
  }

  /* --- cena --- */
  function findPrice(text) {
    const s = String(text).replace(/^.*\s[—–]\s.*$/m, '');
    let m;
    const num = x => parseFloat(String(x).replace(/\s/g, '').replace(',', '.'));
    if ((m = s.match(/(\d[\d\s]{0,6}(?:[.,]\d{1,2})?)\s*(kč|kc\b|czk|korun\w*)/i))) return { amount: num(m[1]), currency: 'Kč', code: 'CZK', src: m[0].trim() };
    if ((m = s.match(/(\d[\d\s]{0,6}(?:[.,]\d{1,2})?)\s*(€|eur(?:os|o|a|ov|s)?\b|e\b|\$|usd\b|dol\w*|bucks?\b|£|gbp\b|pounds?\b|quid\b)/i))) {
      const gbp = /£|gbp|pound|quid/i.test(m[2]), usd = /\$|usd|dol|buck/i.test(m[2]);
      return { amount: num(m[1]), currency: gbp ? '£' : usd ? '$' : '€', code: gbp ? 'GBP' : usd ? 'USD' : 'EUR', src: m[0].trim() };
    }
    if ((m = s.match(/(€|\$|£)\s*(\d+(?:[.,]\d{1,2})?)/))) return { amount: num(m[2]), currency: m[1], code: { '€': 'EUR', '$': 'USD', '£': 'GBP' }[m[1]], src: m[0] };
    if ((m = fold(s).match(/\b(?:budget|budzet|rozpocet|cena|price|pay|zaplatim|zaplatil by som|dam ti|dam|za)\s*(?:je|is|of|ti|you|cca|okolo|around|about|max)?\s*:?\s*(\d{1,5}(?:[.,]\d{1,2})?)\b(?!\s*[./:]\s*\d)(?!\s*(?:dni|den|tyzd|days?|weeks?|min|sek|s\b|h\b|hod))/))) return { amount: num(m[1]), currency: '', code: '', src: m[0] };
    return null;
  }

  /* --- typ --- */
  // [typ, regex, váha] – podstatné mená (upútavka, intro) vážia viac než formát (9:16)
  const TYPE_RULES = [
    ['Thumbnail', /\b(thumbnail|thumb|miniatur\w*|thumbik|nahledovk\w*)\b/g, 3],
    ['Intro', /\b(intro|outro)\w*/g, 3],
    ['Trailer', /\b(trailer|teaser|uputav\w*|upoutav\w*|promo\w*|reklam\w*)\b/g, 3],
    ['Montage', /\b(montage|montaz\w*|montaz|fragmovie|frag movie|frags?)\b/g, 3],
    ['Shorts / TikTok', /\b(shorts?|tiktok|tik tok|reels?)\b/g, 2],
    ['Shorts / TikTok', /\b(vertical|vertikal\w*|na vysku|9:16)\b/g, 1],
    ['Motion GFX', /\b(motion|gfx|animac\w*|animat\w*|lower ?third|overlay|logo anim\w*|gui|ui anim\w*|typograf\w*|kinetic)\b/g, 2],
    ['Edit', /\b(edit\w*|strih\w*|zostrih\w*|sestrih\w*|vlog|cut)\b/g, 1],
    ['Edit', /\b(video\w*)\b/g, 0.5]
  ];
  function findType(text) {
    const f = fold(text);
    const score = {};
    let first = {};
    TYPE_RULES.forEach(([type, re, w], i) => {
      const m = f.match(re);
      if (m) { score[type] = (score[type] || 0) + w * Math.min(m.length, 3); if (!(type in first)) first[type] = i; }
    });
    const best = Object.keys(score).sort((a, b) => score[b] - score[a] || first[a] - first[b])[0];
    return best ? { type: best, src: best } : null;
  }

  /* --- odosielateľ --- */
  function findClient(text) {
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const l of lines.slice(0, 4)) {
      let m = l.match(/^(.{2,40}?)\s+[—–]\s+.*(\d{1,2}[:.]\d{2}|today|yesterday|dnes|včera|vcera|\d{4})/i);
      if (m) return { client: m[1].trim(), discord: true };
      m = l.match(/^\[\s*\d{1,2}:\d{2}(?:\s*[AP]M)?\s*\]\s*([^:]{2,40}):/i);
      if (m) return { client: m[1].trim(), discord: true };
      m = l.match(/^(?:od|from)\s*:\s*([^<\n]{2,60})/i);
      if (m) return { client: m[1].trim().replace(/"/g, ''), email: true };
    }
    // samotné meno na prvom riadku, nasledované časom (nový Discord copy formát)
    if (lines.length > 2 && /^[\w.\- ]{2,32}$/.test(lines[0]) && /^[—–]?\s*\d{1,2}[:.]\d{2}/.test(lines[1] + ' ' + (lines[2] || ''))) {
      return { client: lines[0], discord: true };
    }
    return null;
  }

  /* --- názov --- */
  function findTitle(text, client) {
    const body = String(text).replace(/^.*\s[—–]\s.*$/m, '');
    let m;
    if ((m = body.match(/["„“]([^"„“\n]{3,40})["“”]/))) return m[1].trim();
    // názvy serverov: „Arena SMP“, „Mega Network“
    if ((m = body.match(/\b((?:[A-Z][\w]+\s){0,2}(?:SMP|MC|Network|Craft|Realms?|Server))\b/)) && m[1].split(/\s/).length > 1) return m[1].trim();
    // CamelCase alebo slová ako SkyForge, CraftSMP
    const camel = body.match(/\b([A-Z][a-z0-9]+[A-Z][A-Za-z0-9]+|[A-Z]{2,}[a-z]+[A-Za-z0-9]*|[A-Z][a-z]+[A-Z]{2,}[A-Za-z0-9]*)\b/);
    if (camel && camel[1] !== client) return camel[1];
    if ((m = body.match(/\b(?:server|serveru|kanál|kanal|kanálu|kanalu|channel|projekt|project|značku|znacku|brand|pre|for)\s+(?:môj\s+|moj\s+|my\s+|the\s+)?([A-Z][\w\-]{2,30})/))) return m[1];
    return null;
  }

  function parseMessage(text, now) {
    const res = { fields: {}, found: [] };
    if (!text || !text.trim()) return res;
    const c = findClient(text);
    if (c) { res.fields.client = c.client; res.found.push('client'); res.fields.contact = c.email ? 'E-mail' : 'Discord DM'; res.found.push('contact'); }
    else if (/instagram|insta\b|\bdm\b na ig/i.test(text)) { res.fields.contact = 'Instagram'; res.found.push('contact'); }
    const ty = findType(text);
    if (ty) { res.fields.type = ty.type; res.found.push('type'); }
    const pr = findPrice(text);
    const mine = (I() && I().currency) || 'EUR';
    if (pr && pr.code === 'CZK' && mine !== 'CZK') { res.fields.rewardNote = tr('Klient uviedol {amount} Kč, prepočítaj si to na svoju menu.', { amount: pr.amount }); }
    else if (pr && pr.amount > 0 && pr.amount < 100000) { res.fields.reward = pr.amount; res.found.push('reward'); }
    const dl = findDeadline(text, now);
    if (dl) { res.fields.deadline = dl.date; res.found.push('deadline'); }
    const ti = findTitle(text, res.fields.client);
    if (ti) { res.fields.title = ti; res.found.push('title'); }
    else if (res.fields.type || res.fields.client) {
      res.fields.title = (res.fields.type || 'Video') + (res.fields.client ? tr(' pre {c}', { c: res.fields.client }) : '');
    }
    if (/\b(urgent|urgently|asap|rush|right away|as soon as possible|rýchlo|rychlo|súrne|surne|čím skôr|cim skor|co nejdřív|spěchá|hned)\b/i.test(text)) { res.fields.priority = 'high'; res.found.push('priority'); }
    res.fields.notes = String(text).trim();
    return res;
  }

  /* --- Notion CSV --- */
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
  }

  const NOTION_STATUS = {
    'to do': 'todo', 'todo': 'todo', 'not started': 'todo',
    'working on it': 'working', 'in progress': 'working',
    'almost finished': 'revisions', 'review': 'review',
    'done': 'done', 'finished': 'done', 'complete': 'done', 'completed': 'done', 'hotovo': 'done'
  };
  function notionDate(s) {
    if (!s) return '';
    const first = String(s).split('→')[0].trim();
    const d = new Date(first.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i, ''));
    return isNaN(d) ? '' : iso(d);
  }
  function parseNotionCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const head = rows[0].map(h => fold(h).trim());
    const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    const iName = col('name', 'nazov', 'title', 'task'), iStatus = col('status'), iType = col('type', 'typ'),
      iDeadline = col('deadline', 'due', 'due date'), iContact = col('contact', 'kontakt'),
      iContactName = col('contact name', 'klient', 'client'), iReward = col('reward for work', 'reward', 'cena', 'price'),
      iPaid = col('already paid', 'paid', 'zaplatene'), iPrio = col('priority', 'priorita'),
      iCreated = col('date created', 'created', 'created time'), iFile = col('project file', 'file');
    const num = v => parseFloat(String(v || '').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    return rows.slice(1).map(r => {
      const g = i => (i >= 0 ? (r[i] || '').trim() : '');
      const st = NOTION_STATUS[fold(g(iStatus))] || 'todo';
      const prio = fold(g(iPrio));
      const created = notionDate(g(iCreated));
      const paid = num(g(iPaid));
      const p = {
        title: g(iName) || tr('Bez názvu'),
        status: st,
        type: g(iType) || 'Edit',
        deadline: notionDate(g(iDeadline)),
        contact: g(iContact) || 'Discord DM',
        client: g(iContactName),
        reward: num(g(iReward)),
        payments: paid ? [{ at: new Date().toISOString(), amount: paid, note: tr('Import z Notionu') }] : [],
        priority: /high|vysok/.test(prio) ? 'high' : /med|stred/.test(prio) ? 'mid' : /low|nizk/.test(prio) ? 'low' : '',
        folder: g(iFile),
        notes: ''
      };
      if (created) p.createdAt = new Date(created + 'T12:00:00').toISOString();
      if (st === 'done') p.doneAt = new Date().toISOString();
      return p;
    });
  }

  return { parseMessage, findDeadline, findPrice, findType, findClient, findTitle, parseCSV, parseNotionCSV };
});
