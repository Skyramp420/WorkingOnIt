/* Ukážkový režim: keď stránku otvoríš priamo v prehliadači (bez Electronu), beží s vymyslenými dátami.
   V appke sa tento súbor ignoruje. */
(function () {
  if (window.api) return;
  const L = window.WOI;
  const H = 3600000, now = Date.now();
  const iso = t => new Date(t).toISOString();
  const d = n => L.toISODate(new Date(now + n * L.DAY));
  const S = L.emptyState();
  S.seenOnboarding = !/onboarding/.test(location.hash);
  S.settings.rootFolder = 'C:\\Users\\Uzivatel\\Videos\\WorkingOnIt Projekty';
  S.settings.userName = /onboarding/.test(location.hash) ? '' : 'Adam';
  const mk = (f) => { const p = L.newProject(f); S.projects.push(p); return p; };
  const a = mk({ title: 'Skyline SMP trailer', client: 'Marek', type: 'Trailer', status: 'revisions', deadline: d(-3), reward: 60, createdAt: iso(now - 12 * L.DAY), folder: 'C:\\Users\\Uzivatel\\Videos\\WorkingOnIt Projekty\\2026-10_Marek_Skyline', checklist: [{ id: 'a', text: 'Hrubý strih', done: true }, { id: 'b', text: 'Grafika a titulky', done: true }, { id: 'c', text: 'Feedback zapracovaný', done: false }] });
  const b = mk({ title: 'Turnaj highlights', client: 'Pixelka', type: 'Montage', status: 'working', deadline: d(2), reward: 45, priority: 'high', createdAt: iso(now - 5 * L.DAY) });
  const c = mk({ title: 'Reels pre kaviareň', client: 'Studio Lumo', type: 'Shorts / TikTok', status: 'todo', deadline: d(9), reward: 25, createdAt: iso(now - 1 * L.DAY) });
  mk({ title: 'Shorts zo streamu', client: 'Nexo', type: 'Shorts / TikTok', status: 'todo', deadline: d(5), reward: 30, createdAt: iso(now - 2 * L.DAY) });
  const e = mk({ title: 'Intro pre podcast', client: 'Studio Lumo', type: 'Intro', status: 'review', deadline: d(1), reward: 35, createdAt: iso(now - 7 * L.DAY), renders: [{ file: 'C:\\x\\podcast_intro_v2.mp4', name: 'podcast_intro_v2.mp4', size: 48234000, at: iso(now - 3 * H) }] });
  const f = mk({ title: 'Thumbnail balík', client: 'Marek', type: 'Thumbnail', status: 'done', reward: 20, createdAt: iso(now - 9 * L.DAY), doneAt: iso(now - 2 * L.DAY), payments: [{ at: iso(now - 2 * L.DAY), amount: 20 }] });
  mk({ title: 'Reveal servera', client: 'Vortex', type: 'Edit', status: 'done', reward: 50, createdAt: iso(now - 20 * L.DAY), doneAt: iso(now - 4 * L.DAY) });
  mk({ title: 'Logo animácia', client: 'Tomi', type: 'Motion GFX', status: 'todo', reward: 40, createdAt: iso(now - 3 * L.DAY) });
  mk({ title: 'Svadobný zostrih', client: 'Rodina Novákovci', type: 'Edit', status: 'todo', deadline: d(26), reward: 180, createdAt: iso(now - 1 * L.DAY), contact: 'E-mail' });
  S.projects.forEach(p => { if (!p.history.length) p.history = [{ at: p.createdAt, from: 'todo', to: p.status }]; });
  const sess = (pid, app, dayOff, hourStart, mins) => {
    const st = new Date(L.startOfDay(now).getTime() + dayOff * L.DAY + hourStart * H);
    S.sessions.push({ id: L.uid(), projectId: pid, app, start: iso(st), end: iso(+st + mins * 60000), auto: true, title: '' });
  };
  sess(a.id, 'After Effects', -6, 17, 140); sess(a.id, 'After Effects', -5, 18, 95); sess(a.id, 'After Effects', -1, 20, 70);
  sess(b.id, 'DaVinci Resolve', -2, 16, 120); sess(b.id, 'DaVinci Resolve', 0, 14, 85); sess(b.id, 'DaVinci Resolve', -3, 10, 200);
  sess(e.id, 'Premiere Pro', -3, 19, 110); sess(f.id, 'Photoshop', -3, 15, 75); sess(c.id, 'CapCut', -1, 9, 50);
  sess(null, 'DaVinci Resolve', -1, 22, 34); S.sessions[S.sessions.length - 1].title = 'DaVinci Resolve - Untitled Project 3';
  S.sessions.sort((x, y) => x.start.localeCompare(y.start));
  S.projects.find(p => p.title === 'Reveal servera').payments = [{ at: iso(now - 40 * L.DAY), amount: 30 }];
  S.focusProjectId = b.id;
  a.notesHtml = '<h2>Zadanie</h2><p>Trailer pre Minecraft server, 30 s, epický štýl.</p><ul class="todo"><li data-done="1">Logo reveal</li><li data-done="0">Kinetic typo na beat</li></ul><blockquote>Klient chce viac glitch efektov.</blockquote>';
  mk({ title: 'Lobby teaser', client: 'Marek', type: 'Trailer', status: 'done', reward: 40, createdAt: iso(now - 40 * L.DAY), doneAt: iso(now - 30 * L.DAY), payments: [{ at: iso(now - 28 * L.DAY), amount: 40 }] });
  S.ideas = [
    L.newIdea({ title: 'Glitch prechody na beat', text: 'Každý drop v hudbe = RGB split + posun o 2 framy. Skúsiť aj datamosh na konci.', html: '<p>Každý drop v hudbe = <b>RGB split</b> + posun o 2 framy.</p><p>Skúsiť aj datamosh na konci.</p>', tags: ['efekty', 'trailer'], color: '#b9a4ff', pinned: true, createdAt: iso(now - 4 * L.DAY), updatedAt: iso(now - 2 * H) }),
    L.newIdea({ title: 'Storyboard · Skyline SMP', projectId: a.id, aspect: '16:9', color: '#6ee7c8', tags: ['trailer'], frames: [
      L.newFrame({ caption: 'Čierna obrazovka, tlkot srdca, logo prebliká na beat', shot: 'Text / grafika', move: 'Statický', duration: 3 }),
      L.newFrame({ caption: 'Prelet nad spawnom pri západe slnka', shot: 'Z vtáčej perspektívy', move: 'Dolly / jazda', duration: 4, audio: 'swell + whoosh' }),
      L.newFrame({ caption: 'Rýchle strihy z PvP, speed ramp na každý kill', shot: 'Gameplay', move: 'Speed ramp', duration: 6 }),
      L.newFrame({ caption: 'Názov servera a IP adresa, kinetic typo', shot: 'Text / grafika', move: 'Zoom in', duration: 4 })
    ], createdAt: iso(now - 3 * L.DAY), updatedAt: iso(now - 26 * H) }),
    L.newIdea({ title: 'Séria shorts: 3 tipy za 30 s', text: 'Formát pre klientov s malým rozpočtom. Hook do 1 s, titulky veľké, koniec s otázkou.', html: '<p>Formát pre klientov s malým rozpočtom.</p><ul><li>Hook do 1 s</li><li>Veľké titulky</li><li>Koniec s otázkou</li></ul>', tags: ['shorts'], createdAt: iso(now - 9 * L.DAY), updatedAt: iso(now - 6 * L.DAY) })
  ];

  const listeners = {};
  const emit = (ch, data) => (listeners[ch] || []).forEach(cb => cb(data));
  const push = () => setTimeout(() => emit('state', JSON.parse(JSON.stringify(S))), 10);
  let live = { mode: 'auto', projectId: b.id, app: 'DaVinci Resolve', since: iso(now - 47 * 60000 - 12000), how: 'title' };
  const P = id => S.projects.find(p => p.id === id);

  setTimeout(() => emit('event', { type: 'unknownProject', name: 'Kanal intro v3', app: 'Premiere Pro', file: 'C:\\Edits\\Kanal\\Kanal intro v3.prproj', folder: 'C:\\Edits\\Kanal', focusId: null }), 1500);
  window.api = {
    getState: async () => ({ state: JSON.parse(JSON.stringify(S)), live, platform: 'win32', version: 'demo' }),
    on: (ch, cb) => { (listeners[ch] = listeners[ch] || []).push(cb); },
    action: async (type, p) => {
      p = p || {};
      switch (type) {
        case 'createProject': { const x = L.newProject(p.fields); S.projects.unshift(x); push(); return x.id; }
        case 'updateProject': { Object.assign(P(p.id), p.patch); push(); return true; }
        case 'setStatus': L.setStatus(P(p.id), p.status); push(); return true;
        case 'moveProject': {
          const i = S.projects.findIndex(x => x.id === p.id); const [x] = S.projects.splice(i, 1);
          const j = p.beforeId ? S.projects.findIndex(y => y.id === p.beforeId) : -1;
          if (j < 0) S.projects.push(x); else S.projects.splice(j, 0, x);
          L.setStatus(x, p.status); push(); return true;
        }
        case 'deleteProject': S.projects = S.projects.filter(x => x.id !== p.id); push(); return true;
        case 'addPayment': { const x = P(p.id); x.payments.push({ at: iso(Date.now()), amount: p.amount || L.owedOf(x) }); push(); return true; }
        case 'removePayment': P(p.id).payments.splice(p.index, 1); push(); return true;
        case 'setChecklist': P(p.id).checklist = p.checklist; push(); return true;
        case 'setFocus': S.focusProjectId = p.id; push(); return true;
        case 'startTimer': S.sessions.push({ id: L.uid(), projectId: p.id, app: 'Časovač', start: iso(Date.now()), end: null, manual: true }); live = { mode: 'manual', projectId: p.id, since: iso(Date.now()), app: 'Časovač' }; push(); emit('live', live); return true;
        case 'stopTimer': { const s = S.sessions.find(x => !x.end); if (s) s.end = iso(Date.now()); live = { mode: 'off' }; push(); emit('live', live); return true; }
        case 'assignSimilar': case 'assignSession': { const s = S.sessions.find(x => x.id === p.sessionId); s.projectId = p.projectId; push(); return 1; }
        case 'deleteSession': S.sessions = S.sessions.filter(x => x.id !== p.sessionId); push(); return true;
        case 'addManualSession': S.sessions.push({ id: L.uid(), projectId: p.projectId, app: 'Ručne', start: iso(Date.now() - p.minutes * 60000), end: iso(Date.now()), manual: true }); push(); return true;
        case 'updateSettings': Object.assign(S.settings, p.patch); push(); return true;
        case 'readClipboard': return '';
        case 'remoteInfo': return { enabled: true, running: true, port: 4747, addresses: [{ kind: 'lan', ip: '192.168.1.24', name: 'Wi-Fi', qr: '' }, { kind: 'tailscale', ip: '100.88.12.4', name: 'Tailscale', qr: '' }] };
        case 'ollamaModels': return null;
        case 'debugTracker': return { supported: true, live, last: { proc: 'Resolve' } };
        case 'createFolder': return 'C:\\demo';
        case 'markOnboarded': return true;
        case 'winIsMax': return false;
        case 'aiStatus': return Object.assign({ enabled: S.settings.ollamaEnabled, running: true, installed: true, version: '0.40.4', versionOk: true, models: [{ name: 'gemma4:12b-it-qat', size: 7.2e9 }], model: 'gemma4:12b-it-qat', loaded: [], gpu: { name: 'NVIDIA GeForce RTX 4070', vramGB: 12 }, recommended: 'gemma4:12b-it-qat', minVersion: '0.22.0', catalog: [
          { name: 'gemma4:12b-it-qat', title: 'Gemma 4 · 12B', size: '7,2 GB', note: 'Najlepší pomer slovenčiny a rýchlosti. Celý sa zmestí do grafiky s 10 GB a viac.' },
          { name: 'gemma4:26b-a4b-it-qat', title: 'Gemma 4 · 26B MoE', size: '16 GB', note: 'Ešte lepšie odpovede. Pri 16 GB grafiky sa časť presunie do RAM, takže odpovedá pomalšie.' },
          { name: 'gemma4:e4b-it-qat', title: 'Gemma 4 · E4B', size: '6,1 GB', note: 'Pre grafiky s 6–8 GB. Rýchly, slovenčina je o niečo slabšia.' },
          { name: 'gemma4:e2b-it-qat', title: 'Gemma 4 · E2B', size: '4,3 GB', note: 'Najmenší, pre notebooky a slabšie PC.' }] }, window.__aiMock || {});
        case 'aiStart': return { running: true, installed: true, started: true, version: '0.40.4', versionOk: true };
        case 'aiOpenDownload': case 'openExternal': case 'openLogs': case 'copyImage': return true;
        case 'detectEditors': return ['Resolve.exe', 'AfterFX.exe'];
        case 'listBackups': return [0, 1, 2, 3].map(k => ({ name: 'data-' + d(-k) + '.json', date: d(-k), size: 48000 + k * 900 }));
        case 'restoreBackup': return true;
        case 'appInfo': return { version: 'demo', data: 'C:\\Users\\Uzivatel\\AppData\\Roaming\\WorkingOnIt' };
        case 'resetOnboarding': S.seenOnboarding = false; push(); return true;
        case 'saveIdea': {
          S.ideas = S.ideas || [];
          const it = p.idea.id && S.ideas.find(x => x.id === p.idea.id);
          if (it) Object.assign(it, p.idea, { updatedAt: iso(Date.now()) }); else S.ideas.unshift(L.newIdea(Object.assign({}, p.idea, { id: p.idea.id || L.uid() })));
          const res = it || S.ideas[0];
          if (Array.isArray(res.frames)) res.frames = res.frames.map(fr => L.newFrame(fr));
          push(); return res.id;
        }
        case 'deleteIdea': S.ideas = (S.ideas || []).filter(x => x.id !== p.id); push(); return true;
        case 'captureIdea': { const x = L.newIdea({ title: String(p.text || '').slice(0, 60), text: p.text, html: '<p>' + String(p.text || '') + '</p>' }); S.ideas.unshift(x); push(); return x.id; }
        case 'readImageData': return /^data:/.test(p.url) ? p.url : null;
        case 'saveImageFile': return 'C:\\Users\\Uzivatel\\Desktop\\storyboard.png';
        case 'aiChat': {
          const text = 'Jasné! Pre **Turnaj highlights** by som skúsil:\n- 0–3 s: čierna, zvuk srdca, logo prebliká na beat\n- 3–12 s: rýchle strihy, speed ramp na každý kill\n- 12–20 s: názov turnaja v kinetic typografii\n\nDeadline máš o 2 dni, takže by som začal hneď 🎬';
          let i = 0;
          setTimeout(() => emit('ai', { id: p.id, model: 'gemma4:12b-it-qat' }), 10);
          setTimeout(() => emit('ai', { id: p.id, status: 'loading' }), 20);
          setTimeout(() => { const t = setInterval(() => { emit('ai', { id: p.id, delta: text.slice(i, i + 6) }); i += 6; if (i >= text.length) { clearInterval(t); emit('ai', { id: p.id, done: true }); } }, 30); }, 700);
          return { ok: true };
        }
        case 'writeClipboard': return true;
        case 'aliasProject': case 'ignoreName': case 'claimSessionsByName': return 0;
        case 'archiveProject': P(p.id).archived = !!p.value; push(); return true;
        case 'duplicateProject': { const o = P(p.id); const n = L.newProject({ title: o.title + ' (kópia)', client: o.client, type: o.type, reward: o.reward }); S.projects.push(n); push(); return n.id; }
        case 'updateClient': S.clients = S.clients || {}; S.clients[p.key] = Object.assign({}, S.clients[p.key], p.patch); push(); return true;
        case 'unlockAchievements': S.achievements = S.achievements || {}; p.ids.forEach(id => S.achievements[id] = new Date().toISOString()); push(); return p.ids.length;
        case 'boop': S.stats = S.stats || {}; S.stats.boops = (S.stats.boops || 0) + 1; return S.stats.boops;
        case 'saveImage': return 'data:image/' + p.ext + ';base64,' + p.data;
        case 'aiModels': return [{ name: 'llama3.1:8b', size: 4.9e9 }];
        case 'aiPull': setTimeout(() => emit('ai', { pull: p.name, status: 'pulling', total: 100, completed: 40 }), 200); return true;
        case 'captureRecap': return null;
        case 'claudeStatus': case 'connectClaude': case 'disconnectClaude': {
          if (p && type === 'connectClaude') window.__claudeOn = true;
          if (type === 'disconnectClaude') window.__claudeOn = false;
          return { installed: true, connected: !!window.__claudeOn, files: [{ file: 'C:\\Users\\Uzivatel\\AppData\\Roaming\\Claude\\claude_desktop_config.json', connected: !!window.__claudeOn, others: [] }] };
        }
        case 'aeDetect': return 'C:\\Program Files\\Adobe\\Adobe After Effects 2025\\Support Files\\AfterFX.exe';
        case 'pickAePath': return null;
        case 'listFolder': return { items: [
          { name: 'Logo reveal glitch.aep', path: p.path + '\\Logo reveal glitch.aep', dir: false, size: 4.2e6, mtime: Date.now() - 864e5 * 3, rel: 'Logo reveal glitch.aep', depth: 0 },
          { name: 'Lower thirds', path: p.path + '\\Lower thirds', dir: true, size: 0, mtime: Date.now() - 864e5 * 20, rel: 'Lower thirds', depth: 0 },
          { name: 'Pop text.ffx', path: p.path + '\\Lower thirds\\Pop text.ffx', dir: false, size: 3.1e4, mtime: Date.now() - 864e5 * 40, rel: 'Lower thirds\\Pop text.ffx', depth: 1 },
          { name: 'Whoosh 03.wav', path: p.path + '\\Whoosh 03.wav', dir: false, size: 8.8e5, mtime: Date.now() - 864e5 * 60, rel: 'Whoosh 03.wav', depth: 0 }
        ] };
        case 'addTemplateFolder': { const tf = Object.assign({}, S.settings.templateFolders); tf[p.program] = (tf[p.program] || []).concat(['D:\\Sablony\\' + p.program]); S.settings.templateFolders = tf; push(); return tf[p.program].slice(-1)[0]; }
        case 'removeTemplateFolder': { const tf = Object.assign({}, S.settings.templateFolders); tf[p.program] = (tf[p.program] || []).filter(x => x !== p.path); S.settings.templateFolders = tf; push(); return true; }
        case 'suggestTemplateFolders': return 0;
        case 'copyToProject': return 'C:\\demo\\03_Assets\\' + String(p.path).split('\\').pop();
        case 'saveSnippet': { S.snippets = S.snippets || []; const it = Object.assign({ id: L.uid(), createdAt: iso(Date.now()) }, p.snippet); const i = S.snippets.findIndex(x => x.id === it.id); if (i >= 0) S.snippets[i] = it; else S.snippets.unshift(it); push(); return it.id; }
        case 'deleteSnippet': S.snippets = (S.snippets || []).filter(x => x.id !== p.id); push(); return true;
        default: return null;
      }
    }
  };
})();
