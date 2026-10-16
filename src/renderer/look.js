/* Vzhľad: téma, akcentová farba, pohyb, kompaktný režim */
window.Look = (function () {
  // farby zvýraznenia ako v macOS; staršie (Líščia, Aurora…) sa dajú stále zadať ako vlastná farba
  const ACCENTS = [
    { id: '#ff9f0a', name: 'Oranžová' },
    { id: '#0a84ff', name: 'Modrá' },
    { id: '#bf5af2', name: 'Fialová' },
    { id: '#ff375f', name: 'Ružová' },
    { id: '#ff453a', name: 'Červená' },
    { id: '#ffd60a', name: 'Žltá' },
    { id: '#30d158', name: 'Zelená' },
    { id: '#40c8e0', name: 'Tyrkysová' },
    { id: '#8e8e93', name: 'Grafitová' },
    { id: '#f07f2c', name: 'Líščia' }
  ];

  function lum(hex) {
    const m = String(hex).replace('#', '').match(/.{2}/g);
    if (!m) return 0.5;
    const [r, g, b] = m.map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /* svetlý alebo tmavý režim: podľa nastavenia, inak podľa Windowsu */
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  let lastSt = null;
  function scheme(st) {
    const a = st.appearance || 'auto';
    if (st.theme === 'papier') return 'light';
    if ((st.theme || 'clean') !== 'clean') return 'dark';
    return a === 'light' || a === 'dark' ? a : (mq && !mq.matches ? 'light' : 'dark');
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (lastSt) apply(lastSt); });

  function apply(st) {
    lastSt = st;
    const root = document.documentElement;
    const theme = st.theme || 'clean';
    root.dataset.theme = theme;
    root.dataset.scheme = scheme(st);
    root.dataset.motion = st.motion || 'full';
    const base = /^#[0-9a-f]{6}$/i.test(st.accent || '') ? st.accent : '#ff9f0a';
    // text na akcente: biely alebo tmavý, podľa toho, čo má väčší kontrast (Čistá ako Apple: biely, kým sa dá)
    const dark = theme === 'lampa' ? '#1f1610' : theme === 'clean' ? '#1d1d1f' : '#0d0b16';
    const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    let accent = base, ink = theme === 'clean' ? (lum(base) > 0.5 ? dark : '#ffffff') : cr(lum(base), 1) >= cr(lum(base), lum(dark)) ? '#ffffff' : dark;
    // na svetlej téme príliš svetlý akcent stmavíme, aby bol čitateľný, a text na ňom bude biely
    if (st.theme === 'papier' && lum(base) > 0.3) { accent = `color-mix(in srgb, ${base} 62%, #000)`; ink = '#ffffff'; }
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-ink', ink);
    const b = document.body;
    if (!b) return;
    b.classList.toggle('compact', !!st.compact);
    b.classList.toggle('nokit', st.showKit === false);
    b.classList.toggle('calm', st.motion === 'calm');
    b.classList.toggle('still', st.motion === 'off');
    window.__sounds = st.sounds;
    window.__volume = st.soundVolume == null ? 0.7 : Number(st.soundVolume);
    window.__motion = st.motion || 'full';
  }

  return { apply, ACCENTS };
})();
