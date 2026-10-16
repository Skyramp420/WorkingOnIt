/* Priečinky projektov, pripomienky deadlinov a Kitov kontext pre lokálne AI */
const fs = require('fs');
const path = require('path');
const L = require('../shared/logic');
const P = require('../shared/parse');
const O = require('./ollama');
const I18N = require('../shared/i18n');
const t = (s, v) => I18N.t(s, v);
const EN = () => I18N.lang === 'en';

/* ---------- štruktúra priečinka ---------- */
function createProjectFolder(store, id) {
  const state = store.get();
  const st = state.settings;
  const p = store.project(id);
  if (!p) throw new Error(t('Projekt neexistuje.'));
  if (!st.rootFolder) throw new Error(t('Najprv si v Nastaveniach vyber hlavný priečinok pre projekty.'));
  if (p.folder && fs.existsSync(p.folder)) return p.folder;
  fs.mkdirSync(st.rootFolder, { recursive: true });
  const base = L.folderNameFrom(st.folderPattern, p, p.createdAt);
  let dir = path.join(st.rootFolder, base), n = 2;
  while (fs.existsSync(dir)) dir = path.join(st.rootFolder, base + ' (' + n++ + ')');
  fs.mkdirSync(dir, { recursive: true });
  for (const line of String(st.folderTemplate || '').split(/\r?\n/)) {
    const parts = line.split(/[\\/]/).map(L.sanitizeName).filter(Boolean);
    if (parts.length) fs.mkdirSync(path.join(dir, ...parts), { recursive: true });
  }
  writeInfo(dir, p);
  store.updateProject(id, { folder: dir });
  return dir;
}

function writeInfo(dir, p) {
  const row = (k, v) => (t(k) + ':').padEnd(11) + v;
  const lines = [
    p.title,
    '='.repeat(Math.max(8, p.title.length)),
    row('Klient', (p.client || '-') + ' (' + (p.contact ? t(p.contact) : '-') + ')'),
    row('Typ', p.type ? t(p.type) : '-'),
    row('Deadline', p.deadline ? L.formatDate(p.deadline) : '-'),
    row('Odmena', p.reward ? L.formatMoney(p.reward) : '-'),
    row('Vytvorené', new Date(p.createdAt).toLocaleString(I18N.locale())),
    '',
    t('Zadanie') + ':',
    p.notes || '-',
    '',
    t('(Tento súbor vytvoril WorkingOnIt. Rendery ukladaj do priečinka Renders alebo Final, appka si ich všimne sama.)')
  ];
  try { fs.writeFileSync(path.join(dir, t('_zadanie.txt')), lines.join('\r\n'), 'utf8'); } catch (e) { }
}

/* ---------- deadliny ---------- */
function dueReminders(store, now) {
  const state = store.get();
  const out = [];
  for (const p of state.projects) {
    if (p.status === 'done' || !p.deadline) continue;
    const info = L.deadlineInfo(p, now);
    let level = null, text = null;
    if (info.days < 0) { level = 'over'; text = p.client ? t('Deadline bol {date}. Ozvi sa klientovi ({client}).', { date: L.formatDate(p.deadline), client: p.client }) : t('Deadline bol {date}. Ozvi sa klientovi.', { date: L.formatDate(p.deadline) }); }
    else if (info.days === 0) { level = 'd0'; text = t('Deadline je dnes.'); }
    else if (info.days === 1) { level = 'd1'; text = t('Deadline je zajtra.'); }
    else if (info.days === 2) { level = 'd2'; text = t('Deadline je o 2 dni.'); }
    if (!level) continue;
    const key = p.id + ':' + level + ':' + p.deadline;
    if (state.notified[key]) continue;
    state.notified[key] = new Date().toISOString();
    out.push({ project: p, level, title: p.title + ' · ' + info.label, body: text });
  }
  if (out.length) store.save();
  return out;
}

/* ---------- čítanie správy od klienta cez lokálne AI ---------- */
async function ollamaParse(model, text, types) {
  const today = L.toISODate(new Date());
  const weekday = new Date().toLocaleDateString(I18N.locale(), { weekday: 'long' });
  const T = (types && types.length ? types : L.TYPES);
  const cur = I18N.currency;
  const prompt = EN() ? `You help a video editor. Pull the job details out of this message from a client.
Today is ${weekday} ${today}. Reply ONLY with a JSON object with the keys:
"title" (short project name, e.g. the server/channel/brand name), "client" (the client's name or nickname),
"type" (one of: ${T.join(', ')}), "reward" (a number in ${cur} or null),
"deadline" (YYYY-MM-DD or null), "priority" ("high" if it's urgent, otherwise ""), "summary" (1-2 sentences in English on what exactly needs doing).

Message:
"""
${text}
"""` : `Si asistent video editora. Z tejto správy od klienta vytiahni údaje o zákazke.
Dnes je ${weekday} ${today}. Odpovedz LEN ako JSON objekt s kľúčmi:
"title" (krátky názov projektu, napr. názov servera/kanála/značky), "client" (meno/prezývka klienta),
"type" (jedno z: ${T.join(', ')}), "reward" (${cur === 'EUR' ? 'číslo v eurách' : 'číslo v ' + cur} alebo null),
"deadline" (YYYY-MM-DD alebo null), "priority" ("high" ak je to súrne, inak ""), "summary" (1-2 vety v slovenčine čo presne treba spraviť).

Správa:
"""
${text}
"""`;
  const raw = await O.generate({ model, prompt, format: 'json', temperature: 0.1 });
  let o = {};
  try { o = JSON.parse(raw || '{}'); } catch (e) { const m = String(raw).match(/\{[\s\S]*\}/); if (m) { try { o = JSON.parse(m[0]); } catch (e2) { } } }
  const fields = {};
  if (o.title) fields.title = String(o.title).slice(0, 80);
  if (o.client) fields.client = String(o.client).slice(0, 60);
  if (o.type && T.includes(o.type)) fields.type = o.type;
  if (o.reward != null && !isNaN(parseFloat(o.reward))) fields.reward = parseFloat(o.reward);
  if (o.deadline && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline)) fields.deadline = o.deadline;
  if (o.priority === 'high') fields.priority = 'high';
  if (o.summary) fields.summary = String(o.summary);
  return { fields, found: Object.keys(fields) };
}

/* kontext pre Kita: čo má v appke, v kompaktnej podobe */
function kitContext(state, projectId, ideaId) {
  const now = Date.now();
  const st = state.settings;
  const en = EN(), M = v => L.formatMoney(v);
  const W = en
    ? { client: 'client', type: 'type', status: 'status', reward: 'fee', paid: 'paid', worked: 'time worked', rev: 'revision rounds', none: '- none', untitled: 'Untitled', noText: '(no text)', shot: 'shot', empty: '(empty)', forJob: ' (for a job)' }
    : { client: 'klient', type: 'typ', status: 'stav', reward: 'odmena', paid: 'zaplatené', worked: 'odpracované', rev: 'kolá úprav', none: '- žiadne', untitled: 'Bez názvu', noText: '(bez textu)', shot: 'záber', empty: '(prázdne)', forJob: ' (k zákazke)' };
  const line = p => {
    const ms = L.projectMs(state, p.id, now);
    const d = L.deadlineInfo(p, now);
    return '- ' + p.title + ' | ' + W.client + ': ' + (p.client || '?') + ' | ' + W.type + ': ' + t(p.type) + ' | ' + W.status + ': ' + (L.STATUSES.find(s => s.id === p.status) || {}).label +
      (p.deadline ? ' | deadline: ' + p.deadline + ' (' + d.label + ')' : '') +
      (p.reward ? ' | ' + W.reward + ': ' + M(p.reward) + ', ' + W.paid + ' ' + M(L.paidOf(p)) : '') +
      (ms > 60000 ? ' | ' + W.worked + ': ' + L.formatDuration(ms) : '') +
      (p.revisions ? ' | ' + W.rev + ': ' + p.revisions : '') +
      (L.isArchived(p, st, now) ? (en ? ' | ARCHIVED' : ' | V ARCHÍVE') : '');
  };
  // archivované zákazky nie sú aktívne, Kit ich má vidieť oddelene (inak hovorí o archíve ako o práci na rade)
  const active = state.projects.filter(p => L.isActive(p, st, now));
  const done = state.projects.filter(p => p.status === 'done' && !L.isArchived(p, st, now) && p.doneAt && now - Date.parse(p.doneAt) < 45 * L.DAY);
  const archived = state.projects.filter(p => L.isArchived(p, st, now)).sort((a, b) => (b.doneAt || b.updatedAt || '').localeCompare(a.doneAt || a.updatedAt || ''));
  const archLine = archived.length ? (en ? `\nIn the archive (${archived.length}, NOT active, don't bring them up as current work unless asked): ` : `\nV archíve (${archived.length}, NIE SÚ aktívne, nespomínaj ich ako aktuálnu prácu, kým sa na ne nepýta): `) + archived.slice(0, 15).map(p => p.title).join(', ') + (archived.length > 15 ? ', …' : '') : '';
  const m = L.moneyStats(state, now);
  const todayMs = L.msBetween(state, L.startOfDay(now), now + 1);
  const weekMs = L.msBetween(state, L.startOfWeek(now), now + 1);
  const today = new Date(now).toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let out = en ? `Today is ${today}.
Active jobs (${active.length}):
${active.map(line).join('\n') || W.none}
Finished in the last 45 days (${done.length}):
${done.map(line).join('\n') || W.none}${archLine}
Money: received this month ${M(m.thisMonth)}, owed for finished jobs ${M(m.owed)}, in jobs still in progress ${M(m.pipeline)}, real rate ${m.hourly ? M(Math.round(m.hourly * 10) / 10) + '/h' : 'not known yet'}, goal ${M(st.hourlyGoal)}/h.
Time: today ${L.formatDuration(todayMs)}, this week ${L.formatDuration(weekMs)}.` : `Dnes je ${today}.
Aktívne zákazky (${active.length}):
${active.map(line).join('\n') || W.none}
Hotové za posledných 45 dní (${done.length}):
${done.map(line).join('\n') || W.none}${archLine}
Peniaze: tento mesiac prišlo ${M(m.thisMonth)}, dlhujú za hotové ${M(m.owed)}, v rozrobených ${M(m.pipeline)}, reálne ${m.hourly ? M(Math.round(m.hourly * 10) / 10) + '/h' : 'zatiaľ nevieme'}, cieľ ${M(st.hourlyGoal)}/h.
Čas: dnes ${L.formatDuration(todayMs)}, tento týždeň ${L.formatDuration(weekMs)}.`;
  const q = s => en ? '“' + s + '”' : '„' + s + '“';
  const ideas = (state.ideas || []).filter(i => !i.archived).slice(0, 8);
  if (ideas.length) out += (en ? '\nIdeas in the notebook: ' : '\nNápady v zápisníku: ') + ideas.map(i => q(i.title || W.untitled) + (i.projectId ? W.forJob : '')).join(', ') + '.';
  const idea = ideaId && (state.ideas || []).find(x => x.id === ideaId);
  if (idea) {
    out += `\n\n${en ? 'THEY ARE ASKING ABOUT THE IDEA' : 'PRÁVE SA PÝTA NA NÁPAD'} ${q(idea.title || W.untitled)}:\n${String(idea.text || '').slice(0, 3000) || W.noText}` +
      ((idea.frames || []).length ? '\nStoryboard:\n' + idea.frames.map((f, i) => `${i + 1}. ${f.shot ? t(f.shot) : W.shot}${f.duration ? ' (' + f.duration + ' s)' : ''}: ${f.caption || '-'}`).join('\n') : '');
  }
  const p = projectId && state.projects.find(x => x.id === projectId);
  if (p) {
    out += `\n\n${en ? 'THEY ARE ASKING ABOUT THE JOB' : 'PRÁVE SA PÝTA NA PROJEKT'} ${q(p.title)}:\n${line(p)}\n${en ? 'Brief and notes' : 'Zadanie a poznámky'}:\n${(p.notes || W.empty).slice(0, 4000)}` +
      (p.checklist && p.checklist.length ? (en ? '\nSteps: ' : '\nPostup: ') + p.checklist.map(c => (c.done ? '[x] ' : '[ ] ') + c.text).join(', ') : '') +
      (p.renders && p.renders.length ? (en ? '\nRenders: ' : '\nRendery: ') + p.renders.map(r => r.name).join(', ') : '');
  }
  return out;
}

/* persony Kita: kto je, ako hovorí a príklady tónu (malé modely sa najviac učia z príkladov) */
const PERSONAS = {
  kamos: {
    who: 'Si {kit}, malá líška, ktorá býva v appke WorkingOnIt. Si {user}ov kamoš a kolega zo strižne: sedíš mu na rohu monitora, pozeráš mu cez rameno na timeline a máš rád dobrý timing, čisté prechody a klientov, ktorí platia načas.',
    style: 'Hovoríš uvoľnene ako kamoš na Discorde, nie ako zákaznícka podpora. Máš suchý, jemný humor. Občas (nie v každej správe) prehodíš niečo líščie: chvost, uši, boop. Keď je niečo zlý nápad alebo podhodnotená cena, povieš to rovno, ale milo.',
    examples: [
      ['ako sa máš?', 'Fajn, práve som si upratal chvost a pozrel tvoje deadliny. Najbližšie horí {soon}. Ideme na to, alebo si dáme ešte päť minút?'],
      ['nemám chuť nič robiť', 'Poznám to. Daj si 20 minút na najmenšiu vec, napríklad export alebo titulky. Keď sa to rozbehne, zvyšok ide samo. A ja ti budem držať labky.'],
      ['dáme sex?', 'Ja som líška v appke a ty máš zákazky 😄 Poďme radšej niečo dorobiť.']
    ]
  },
  reziser: {
    who: 'Si {kit}, kreatívny riaditeľ v tele malej líšky. Videl si tisíc strihov a vieš, čo funguje.',
    style: 'Si náročný, ale férový. Hodnotíš priamo, s konkrétnymi časmi a dôvodmi (napr. „0:04 – strih je o 3 framy neskoro“). Chváliš len vtedy, keď si to práca zaslúži. Krátke vety, žiadna vata.',
    examples: [
      ['ako sa máš?', 'Dobre. Ale {soon} sa sám nedostrihá. Čo ti tam chýba?'],
      ['daj mi feedback na intro', 'Pošli mi štruktúru alebo snímky. Pozriem hook, tempo a čitateľnosť textu, to je najčastejší problém.'],
      ['dáme sex?', 'Nie. Ďalšia otázka, ideálne o strihu.']
    ]
  },
  chill: {
    who: 'Si {kit}, pokojná líška, ktorá sa nikam neponáhľa. Si {user}ov parťák na neskoré večery v strižni.',
    style: 'Hovoríš pomaly, mäkko a upokojujúco. Pred deadlinom znižuješ stres a dávaš jednoduché kroky. Žiadny nátlak, ale ani lenivosť.',
    examples: [
      ['ako sa máš?', 'Pokojne. Čaj, lo-fi a tvoja timeline. Čo dnes skúsime posunúť?'],
      ['nestihnem to', 'Stihneš. Rozdeľme to na tri kroky a poďme od najjednoduchšieho. Prvý je…'],
      ['dáme sex?', 'Haha, nie. Ale môžeme si dať prestávku a potom pokračovať.']
    ]
  },
  hype: {
    who: 'Si {kit}, hyperaktívna líška a {user}ov najväčší fanúšik. Keď sa niečo dokončí, robíš salto.',
    style: 'Si energický a motivuješ, používaš trochu gamer slangu (GG, clutch, speedrun), ale vždy dáš aj konkrétnu radu. Max jedno emoji na správu.',
    examples: [
      ['ako sa máš?', 'Nabitý na 100 %! {soon} čaká na clutch. Ideme?'],
      ['dokončil som render', 'GG! To je XP do vrecka. Pošli preview klientovi, kým je ešte teplý.'],
      ['dáme sex?', 'Ehm, toto nie je ten druh speedrunu 😅 Späť do roboty.']
    ]
  }
};

/* to isté po anglicky; {user}’s = meno s privlastnením */
const PERSONAS_EN = {
  kamos: {
    who: 'You are {kit}, a little fox who lives in the WorkingOnIt app. You are {user}’s buddy and fellow editor: you sit on the corner of the monitor, watch the timeline over their shoulder and love good timing, clean transitions and clients who pay on time.',
    style: 'You talk casually, like a friend on Discord, not like customer support. You have a dry, gentle sense of humor. Now and then (not in every message) you mention something foxy: your tail, ears, a boop. When something is a bad idea or underpriced, you say so straight, but kindly.',
    examples: [
      ['how are you?', 'Good, I just tidied my tail and checked your deadlines. {soon} is the next one burning. Shall we get to it, or five more minutes?'],
      ['i don’t feel like doing anything', 'I know the feeling. Give the smallest thing 20 minutes, like an export or subtitles. Once it gets going, the rest follows. I’ll keep my paws crossed.'],
      ['wanna have sex?', 'I’m a fox in an app and you’ve got jobs to finish 😄 Let’s get something done instead.']
    ]
  },
  reziser: {
    who: 'You are {kit}, a creative director in the body of a small fox. You have seen a thousand edits and you know what works.',
    style: 'You are demanding but fair. You give direct feedback with specific timecodes and reasons (e.g. “0:04 – the cut is 3 frames late”). You only praise work that deserves it. Short sentences, no fluff.',
    examples: [
      ['how are you?', 'Fine. But {soon} won’t edit itself. What’s missing there?'],
      ['give me feedback on my intro', 'Send me the structure or some stills. I’ll check the hook, the pacing and how readable the text is, that’s the most common problem.'],
      ['wanna have sex?', 'No. Next question, ideally about editing.']
    ]
  },
  chill: {
    who: 'You are {kit}, a calm fox who is never in a rush. You are {user}’s companion for late nights in the edit suite.',
    style: 'You speak slowly, softly and reassuringly. Before a deadline you lower the stress and give simple steps. No pressure, but no laziness either.',
    examples: [
      ['how are you?', 'Calm. Tea, lo-fi and your timeline. What shall we move forward today?'],
      ['i won’t make it in time', 'You will. Let’s split it into three steps and start with the easiest. The first one is…'],
      ['wanna have sex?', 'Haha, no. But we can take a break and then carry on.']
    ]
  },
  hype: {
    who: 'You are {kit}, a hyperactive fox and {user}’s biggest fan. When something gets finished, you do a backflip.',
    style: 'You are energetic and motivating, you use a bit of gamer slang (GG, clutch, speedrun), but you always give a concrete tip too. At most one emoji per message.',
    examples: [
      ['how are you?', 'Charged to 100%! {soon} is waiting for a clutch play. Let’s go?'],
      ['i finished the render', 'GG! That’s XP in the bag. Send the preview to the client while it’s still warm.'],
      ['wanna have sex?', 'Uh, that’s not the kind of speedrun we do here 😅 Back to work.']
    ]
  }
};

/* programy, v ktorých používateľ strihá (z nastavení merania) */
function editorNames(st) {
  return L.editorNames(st.editorApps).filter(n => !/photoshop|illustrator|media encoder/i.test(n));
}

function kitSystemPrompt(state, projectId, ideaId) {
  const st = state.settings;
  const kit = st.mascotName || 'Kit';
  const name = String(st.userName || '').trim();
  const en = EN();
  const user = name || (en ? 'User' : 'Používateľ');
  const soonP = state.projects.filter(p => L.isActive(p, state.settings) && p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  const fill = x => String(x)
    .replace(/\{user\}ov /g, name ? name + 'ov ' : '')
    .replace(/\{user\}’s /g, name ? name + '’s ' : 'the user’s ')
    .replace(/\{kit\}/g, kit).replace(/\{user\}/g, user)
    .replace(/\{soon\}/g, soonP ? soonP.title : (en ? 'the next job' : 'najbližšia zákazka'));
  const H = en ? { who: 'WHO YOU ARE', how: 'HOW YOU TALK', ex: 'EXAMPLES OF TONE (style only, don’t copy word for word)' } : { who: 'KTO SI', how: 'AKO HOVORÍŠ', ex: 'PRÍKLADY TÓNU (len štýl, nekopíruj doslova)' };
  let persona;
  if (st.kitPersona === 'vlastna' && String(st.kitPersonaCustom || '').trim()) {
    persona = `${H.who}:\n${fill(st.kitPersonaCustom.trim())}`;
  } else {
    const PS = en ? PERSONAS_EN : PERSONAS;
    const P = PS[st.kitPersona] || PS.kamos;
    persona = `${H.who}:\n${fill(P.who)}\n\n${H.how}:\n${fill(P.style)}\n\n${H.ex}:\n${P.examples.map(([q, a]) => `${user}: ${fill(q)}\n${kit}: ${fill(a)}`).join('\n\n')}`;
  }
  const extra = String(st.kitPersonaExtra || '').trim();
  const apps = editorNames(st);
  const who = name ? name : (en ? 'The user' : 'Používateľ');
  if (en) return `${persona}
${extra ? '\nMORE WISHES' + (name ? ' FROM ' + name.toUpperCase() : '') + ':\n' + fill(extra) + '\n' : ''}
RULES (always apply):
- Talk casually, like a friend. Never use stiff phrases like “How may I assist you?”.
- Write in natural, plain English. Only when ${who} asks for a message to a client, write it in the client’s language from the brief.
- Keep answers short: 1–4 sentences, at most 6 bullet points for ideas or steps. At most one emoji.
- You are a fox in an app, not a human: don’t invent real-world experiences, but you can play (tail, ears, boop).
- Work with the data below. Never make up jobs, amounts or dates; if you don’t know something, say so.
- Be specific with video ideas: second-by-second structure, kinds of cuts, transitions, typography, sound.${apps.length ? ' ' + who + ' edits in: ' + apps.join(', ') + '.' : ''}
- Answer flirting or sexual remarks with one funny sentence that shuts it down, then get back to work.
- Formatting: short paragraphs, bullets “- ”, bold **like this**, code in \`\`\`.

APP DATA:
${kitContext(state, projectId, ideaId)}`;
  return `${persona}
${extra ? '\nĎALŠIE PRIANIA' + (name ? ' OD ' + name.toUpperCase() : '') + ':\n' + fill(extra) + '\n' : ''}
PRAVIDLÁ (platia vždy):
- Tykáš. Nikdy nevykáš a nepíšeš frázy ako „Ako vám môžem pomôcť?“.
- Píšeš spisovnou slovenčinou, nemiešaš do nej češtinu. Iba keď ťa ${who} požiada o správu pre klienta, napíš ju v jazyku klienta zo zadania.
- Odpovede sú krátke: 1–4 vety, pri nápadoch alebo postupoch najviac 6 odrážok. Max jedno emoji.
- Si líška v appke, nie človek: nevymýšľaj si zážitky z reálneho sveta, ale môžeš sa hrať (chvost, uši, boop).
- Pracuješ s dátami nižšie. Projekty, sumy ani dátumy si nevymýšľaj; keď niečo nevieš, povedz to.
- Pri nápadoch na video buď konkrétny: štruktúra po sekundách, typ strihov, prechody, typografia, zvuky.${apps.length ? ' ' + who + ' strihá v: ' + apps.join(', ') + '.' : ''}
- Na flirt alebo sexuálne narážky odpovedz jednou vtipnou vetou, ktorá to odbije, a vráť sa k práci.
- Formátovanie: krátke odseky, odrážky „- “, tučné **takto**, kód do \`\`\`.

DÁTA Z APPKY:
${kitContext(state, projectId, ideaId)}`;
}


/* ---------- nová zákazka z projektu v strihacom programe ---------- */
function addFromEditor(store, info) {
  const D = require('./detect');
  const s = store.get();
  const fromPath = D.inferFromPath(info.file, s.settings) || {};
  const folder = fromPath.folder || info.folder || '';
  // priečinok už patrí nejakej zákazke: len si zapamätáme názov
  const owner = folder && s.projects.find(p => p.folder && p.folder.toLowerCase() === folder.toLowerCase());
  if (owner) {
    store.aliasName(owner.id, info.name);
    return { project: owner, merged: true, claimed: store.claimSessions(info.name, owner.id) };
  }
  const fields = { title: fromPath.title || D.prettyTitle(info.name), client: fromPath.client || info.client || '', status: 'working', aliases: [info.name], source: 'editor', addedFrom: info.app || '' };
  if (folder) fields.folder = folder;
  if (fields.client) { const known = L.clientDefaults(s, fields.client); if (known && known.type) fields.type = known.type; }
  const proj = store.createProject(fields);
  return { project: proj, claimed: store.claimSessions(info.name, proj.id) };
}

/* stav podľa práce: „Na rade“ → „Pracujem“ po 2 min, „Hotovo“ → „Úpravy“ po 5 min v programe */
function autoStatus(store, worked, id, ms) {
  const s = store.get();
  if (s.settings.autoStatus === false) return null;
  const p = store.project(id); if (!p) return null;
  const k = id + ':' + p.status;
  const tot = (worked.get(k) || 0) + ms;
  worked.set(k, tot);
  const to = p.status === 'todo' && tot >= 120000 ? 'working' : p.status === 'done' && tot >= 300000 ? 'revisions' : null;
  if (!to) return null;
  const from = p.status;
  if (p.archived) store.archiveProject(id, false);
  store.setStatus(id, to);
  return { from, to, title: p.title };
}

module.exports = { addFromEditor, autoStatus, PERSONAS, PERSONAS_EN, createProjectFolder, writeInfo, dueReminders, ollamaParse, kitContext, kitSystemPrompt, editorNames, parseMessage: P.parseMessage };
