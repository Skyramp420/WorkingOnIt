/* Šablóny: programy, typy súborov, vstavané snippety a exportné predvoľby */
window.TPL = (function () {
  const t = (s, v) => (window.I18N ? I18N.t(s, v) : s);
  /* texty v dátach sa prekladajú až pri čítaní (jazyk sa nastaví po načítaní súboru) */
  const tr = (o, keys) => {
    const out = {};
    for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
      if (keys.includes(k) && typeof d.value === 'string') { const v = d.value; Object.defineProperty(out, k, { get: () => t(v), enumerable: true }); }
      else Object.defineProperty(out, k, d);
    }
    return out;
  };
  const PROGRAMS = [
    { id: 'resolve', name: 'DaVinci Resolve', short: 'DaVinci', color: '#ff6b8b' },
    { id: 'ae', name: 'After Effects', short: 'AE', color: '#b9a4ff' },
    { id: 'premiere', name: 'Premiere Pro', short: 'Premiere', color: '#7cc4ff' },
    tr({ id: 'other', name: 'Ostatné', short: 'Ostatné', color: '#6ee7c8' }, ['name', 'short'])
  ];

  /* prípona → typ (a pre ktorý program je typická) */
  const KINDS = {
    drp: ['Projekt', 'resolve'], drt: ['Timeline', 'resolve'], setting: ['Fusion makro', 'resolve'], drfx: ['Fusion balík', 'resolve'], dctl: ['DCTL', 'resolve'], drx: ['Grade', 'resolve'], dra: ['Archív', 'resolve'],
    aep: ['Projekt', 'ae'], aet: ['Šablóna', 'ae'], ffx: ['Preset', 'ae'], jsx: ['Skript', 'ae'], jsxbin: ['Skript', 'ae'],
    prproj: ['Projekt', 'premiere'], prfpset: ['Preset efektov', 'premiere'], epr: ['Export preset', 'premiere'], sqpreset: ['Sekvencia', 'premiere'],
    mogrt: ['MOGRT', 'premiere'], cube: ['LUT', 'other'], '3dl': ['LUT', 'other'],
    wav: ['Zvuk', 'other'], mp3: ['Zvuk', 'other'], ogg: ['Zvuk', 'other'], flac: ['Zvuk', 'other'],
    mov: ['Video', 'other'], mp4: ['Video', 'other'], webm: ['Video', 'other'],
    png: ['Obrázok', 'other'], jpg: ['Obrázok', 'other'], jpeg: ['Obrázok', 'other'], gif: ['Obrázok', 'other'], webp: ['Obrázok', 'other'],
    psd: ['Photoshop', 'other'], ai: ['Illustrator', 'other'], blend: ['Blender', 'other'],
    ttf: ['Font', 'other'], otf: ['Font', 'other'], zip: ['Archív', 'other'], rar: ['Archív', 'other']
  };
  function kindOf(name, isDir) {
    if (isDir) return t('Priečinok');
    const ext = String(name).split('.').pop().toLowerCase();
    return t((KINDS[ext] || ['Súbor'])[0]);
  }

  /* čo si môžeš dať do priečinkov – pomôcka, keď nevieš */
  const IDEAS_SK = {
    resolve: ['Fusion makrá a titulky (.setting)', 'Hotové timeline pre shorts alebo intro (.drt)', 'Tvoje LUTy a grade (.cube, .drx)', 'Power Bins s logami klientov'],
    ae: ['Šablóny intier a logo revealov (.aep / .aet)', 'Presety animácií textu (.ffx)', 'Skripty (.jsx) a expressions', 'Lower thirds pre klientov'],
    premiere: ['Motion Graphics šablóny (.mogrt)', 'Presety efektov (.prfpset)', 'Export presety (.epr)', 'Sekvencie pre 9:16 a 16:9 (.sqpreset)'],
    other: ['Zvukové efekty (whoosh, hit, riser)', 'Fonty, ktoré často používaš', 'Overlaye, particles, light leaky', 'PSD šablóny thumbnailov']
  };
  const IDEAS = {};
  for (const k of Object.keys(IDEAS_SK)) Object.defineProperty(IDEAS, k, { get: () => IDEAS_SK[k].map(x => t(x)), enumerable: true });

  const SNIPPETS = [
    { id: 'b-wiggle', program: 'ae', title: 'Wiggle (trasenie)', note: 'Na Position alebo Rotation. 3× za sekundu, rozsah 25.', code: 'wiggle(3, 25)' },
    { id: 'b-loop', program: 'ae', title: 'Nekonečná slučka', note: 'Opakuje kľúčové snímky. Namiesto "cycle" skús "pingpong".', code: 'loopOut("cycle")' },
    { id: 'b-rot', program: 'ae', title: 'Stála rotácia', note: 'Na Rotation: 90° za sekundu.', code: 'time * 90' },
    { id: 'b-bounce', program: 'ae', title: 'Inertial bounce', note: 'Pružný dokmit po poslednom kľúči. Uprav amp, freq, decay.', code: 'amp = .06; freq = 3; decay = 7;\nn = 0;\nif (numKeys > 0) {\n  n = nearestKey(time).index;\n  if (key(n).time > time) n--;\n}\nt = (n == 0) ? 0 : time - key(n).time;\nif (n > 0 && t < 1) {\n  v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\n  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);\n} else {\n  value;\n}' },
    { id: 'b-poster', program: 'ae', title: 'Stop-motion pocit', note: 'Zníži framerate animácie na 8 fps a pridá jemné trasenie.', code: 'posterizeTime(8);\nwiggle(2, 6)' },
    { id: 'b-fade', program: 'ae', title: 'Fade-in od začiatku vrstvy', note: 'Na Opacity: za 0,5 s z 0 na 100.', code: 'linear(time - inPoint, 0, 0.5, 0, 100)' },
    { id: 'b-type', program: 'ae', title: 'Písací stroj', note: 'Na Source Text. 20 znakov za sekundu.', get code() { return 't = "' + t('Tvoj text') + '";\nn = Math.floor((time - inPoint) * 20);\nt.substr(0, n)'; } },
    { id: 'b-count', program: 'ae', title: 'Odpočítavanie', note: 'Na Source Text: 10, 9, 8… od začiatku vrstvy.', code: 'Math.max(0, Math.ceil(10 - (time - inPoint))) + ""' },
    { id: 'b-fshake', program: 'resolve', title: 'Fusion: jemné trasenie', note: 'Expression na Center v Transform node. time = číslo snímky.', code: 'Point(0.5 + sin(time * 0.7) * 0.01, 0.5 + cos(time * 0.9) * 0.01)' },
    { id: 'b-frot', program: 'resolve', title: 'Fusion: stála rotácia', note: 'Expression na Angle: 2° za snímku.', code: 'time * 2' },
    { id: 'b-lua-clips', program: 'resolve', title: 'Konzola: zoznam klipov', note: 'Workspace → Console → Lua. Vypíše klipy na V1 aktuálnej timeline.', code: 'local tl = resolve:GetProjectManager():GetCurrentProject():GetCurrentTimeline()\nfor _, item in ipairs(tl:GetItemListInTrack("video", 1)) do\n  print(item:GetName(), item:GetStart(), item:GetEnd())\nend' },
    { id: 'b-lua-marker', program: 'resolve', title: 'Konzola: marker na začiatok', note: 'Pridá modrý marker na prvú snímku timeline.', get code() { return 'local tl = resolve:GetProjectManager():GetCurrentProject():GetCurrentTimeline()\ntl:AddMarker(0, "Blue", "' + t('Štart') + '", "", 1)'; } }
  ].map(x => tr(x, ['title', 'note']));

  /* exportné predvoľby; bitráty YouTube sú z oficiálnej nápovedy YouTube */
  const EXPORTS = [
    { id: 'yt1080', name: 'YouTube 1080p', size: '1920 × 1080', fps: 'ako nahrávka (24/25/30 alebo 50/60)', bitrate: '8 Mbps pri 24–30 fps, 12 Mbps pri 50–60 fps', audio: 'AAC, 48 kHz, stereo 384 kbps', note: 'Odporúčania YouTube pre SDR.' },
    { id: 'yt4k', name: 'YouTube 4K', size: '3840 × 2160', fps: 'ako nahrávka', bitrate: '35–45 Mbps pri 24–30 fps, 53–68 Mbps pri 50–60 fps', audio: 'AAC, 48 kHz, stereo 384 kbps', note: 'Často spomínaný trik: aj 1080p obsah exportovaný ako 4K dostane na YouTube vyšší bitrate, takže vyzerá ostrejšie.' },
    { id: 'vertical', name: 'Shorts / TikTok / Reels', size: '1080 × 1920 (9:16)', fps: '30 alebo 60', bitrate: 'okolo 12–20 Mbps', audio: 'AAC, 48 kHz', note: 'Dôležitý text drž mimo spodnej ~ štvrtiny a pravého okraja, tam sú tlačidlá appiek.' },
    { id: 'discord', name: 'Discord preview', size: '1280 × 720 alebo 1920 × 1080', fps: '30', bitrate: 'vypočítaj nižšie podľa dĺžky', audio: 'AAC 128 kbps', note: 'Limit súboru: 20 MB bez Nitra, 50 MB Nitro Basic, 500 MB Nitro.', calc: true }
  ].map(x => tr(x, ['size', 'fps', 'bitrate', 'note']));
  const WHERE = tr({
    resolve: 'Deliver → Custom Export → Format MP4, Codec H.264 (alebo H.265). Resolution a Frame rate podľa karty, Quality → Restrict to … Kb/s. Audio: AAC.',
    ae: 'Composition → Add to Render Queue → Output Module → Format H.264. Pre jemné nastavenie bitrate pošli do Media Encoder (Ctrl+Alt+M).',
    premiere: 'Export (Ctrl+M) → Format H.264 → Video: Bitrate Encoding VBR, 1 pass, Target bitrate podľa karty. Audio: AAC 48 kHz.',
    other: 'Ak to musíš len zmenšiť, HandBrake alebo ffmpeg zvládnu aj Discord limit.'
  }, ['resolve', 'ae', 'premiere', 'other']);

  /* bitrate tak, aby sa súbor zmestil do limitu (s rezervou 5 %) */
  function bitrateFor(limitMB, seconds, audioKbps) {
    if (!seconds || seconds <= 0) return null;
    const totalKbps = (limitMB * 1000 * 8 * 0.95) / seconds;
    return Math.max(0, Math.floor(totalKbps - (audioKbps || 128)));
  }

  return { PROGRAMS, KINDS, kindOf, IDEAS, SNIPPETS, EXPORTS, WHERE, bitrateFor };
})();
