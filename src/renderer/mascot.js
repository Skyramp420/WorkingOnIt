/* Kit – malá líška, ktorá ti robí spoločnosť pri strihaní 🦊
   Farby a doplnky sa dajú meniť v Profile → Šatník. */
window.Mascot = (function () {
  const DEFAULT = { fur: '#ff9f5a', cream: '#fff1e4', inner: '#3b2f55', eyes: '#231c36', hat: '', glasses: '', neck: '', extra: '' };

  const PALETTES = [
    { id: 'liska', name: 'Líška', fur: '#ff9f5a', cream: '#fff1e4', inner: '#3b2f55', eyes: '#231c36' },
    { id: 'arkticka', name: 'Arktická', fur: '#eef2fb', cream: '#ffffff', inner: '#9fb3d9', eyes: '#2f3d6e' },
    { id: 'strieborna', name: 'Strieborná', fur: '#aeb6c9', cream: '#eef1f7', inner: '#4a4f66', eyes: '#1d2236' },
    { id: 'polnocna', name: 'Polnočná', fur: '#2c3b7a', cream: '#f0a24a', inner: '#f0a24a', eyes: '#3ddc84' },
    { id: 'ruzova', name: 'Cukrová vata', fur: '#ff9ec7', cream: '#fff0f7', inner: '#8b3d6b', eyes: '#3a1630' },
    { id: 'aurora', name: 'Aurora', fur: '#5fd6bd', cream: '#e9fffa', inner: '#24527a', eyes: '#13263f' },
    { id: 'tiena', name: 'Tieňová', fur: '#34303f', cream: '#ff9f5a', inner: '#ff9f5a', eyes: '#ffd27a' },
    { id: 'zlata', name: 'Zlatá', fur: '#f2c14e', cream: '#fff6dc', inner: '#7a4b12', eyes: '#2b1a05' }
  ];

  /* doplnky; unlock = podmienka (id odznaku alebo level), inak voľné */
  const ITEMS = {
    hat: [
      { id: '', name: 'Nič' },
      { id: 'beanie', name: 'Čiapka' },
      { id: 'cap', name: 'Šiltovka' },
      { id: 'party', name: 'Párty klobúčik' },
      { id: 'flower', name: 'Kvietok' },
      { id: 'santa', name: 'Mikulášska', unlock: { level: 3 } },
      { id: 'wizard', name: 'Čarodejnícky klobúk', unlock: { badge: 'owl' } },
      { id: 'crown', name: 'Korunka', unlock: { level: 5 } }
    ],
    glasses: [
      { id: '', name: 'Nič' },
      { id: 'round', name: 'Okrúhle' },
      { id: 'sun', name: 'Slnečné' },
      { id: 'heart', name: 'Srdiečka' },
      { id: 'pixel', name: 'Pixel shades', unlock: { badge: 'speedrun' } },
      { id: 'monocle', name: 'Monokel', unlock: { badge: 'm500' } }
    ],
    neck: [
      { id: '', name: 'Nič' },
      { id: 'scarf', name: 'Šál' },
      { id: 'bandana', name: 'Šatka' },
      { id: 'bow', name: 'Motýlik' },
      { id: 'bell', name: 'Zvonček' }
    ],
    extra: [
      { id: '', name: 'Nič' },
      { id: 'phones', name: 'Slúchadlá stále' },
      { id: 'freckles', name: 'Pehy' },
      { id: 'sparkles', name: 'Iskričky', unlock: { badge: 'firstDone' } },
      { id: 'aura', name: 'Aura', unlock: { level: 4 } }
    ]
  };

  let cfg = Object.assign({}, DEFAULT);

  const HATS = {
    beanie: c => `<g class="acc"><path d="M29 32 C29 14 71 14 71 32 Z" fill="${c.accent || '#7c6cff'}"/><rect x="26" y="28" width="48" height="8" rx="4" fill="${c.accent2 || '#5a4bd6'}"/><circle cx="50" cy="12" r="5" fill="#fff"/></g>`,
    cap: () => `<g class="acc"><path d="M30 31 C30 15 70 15 70 31 Z" fill="#ff5d73"/><path d="M62 30 C74 28 86 30 90 33 C80 35 70 34 62 33 Z" fill="#d13a52"/><circle cx="50" cy="17" r="2.2" fill="#ffd2d8"/></g>`,
    party: () => `<g class="acc" transform="rotate(14 60 20)"><path d="M50 30 L60 2 L70 30 Z" fill="#ffd27a"/><path d="M53 22 L67 22 M55 15 L65 15" stroke="#ff6b8b" stroke-width="3"/><circle cx="60" cy="2" r="3.2" fill="#6ee7c8"/></g>`,
    flower: () => `<g class="acc" transform="translate(70 24)"><circle r="4" cx="0" cy="-5" fill="#ff9ec7"/><circle r="4" cx="5" cy="0" fill="#ff9ec7"/><circle r="4" cx="0" cy="5" fill="#ff9ec7"/><circle r="4" cx="-5" cy="0" fill="#ff9ec7"/><circle r="3" fill="#ffd27a"/></g>`,
    santa: () => `<g class="acc"><path d="M30 31 C34 10 60 4 74 14 C78 18 80 24 84 30 L70 30 Z" fill="#e5384f"/><rect x="27" y="27" width="48" height="8" rx="4" fill="#fff"/><circle cx="85" cy="31" r="5" fill="#fff"/></g>`,
    wizard: () => `<g class="acc"><ellipse cx="50" cy="31" rx="30" ry="5" fill="#4b2f8a"/><path d="M36 30 L52 -6 L66 30 Z" fill="#5b3aa8"/><path d="M45 18 l1.5 3 3 .4 -2.2 2 .6 3 -2.9 -1.5 -2.9 1.5 .6 -3 -2.2 -2 3 -.4z" fill="#ffd27a"/><circle cx="57" cy="9" r="1.6" fill="#ffd27a"/></g>`,
    crown: () => `<g class="acc"><path d="M34 30 L36 14 L43 22 L50 10 L57 22 L64 14 L66 30 Z" fill="#ffd27a" stroke="#c99a2e" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="24" r="2.4" fill="#ff6b8b"/><circle cx="41" cy="26" r="1.6" fill="#6ee7c8"/><circle cx="59" cy="26" r="1.6" fill="#7cc4ff"/></g>`
  };
  const GLASSES = {
    round: () => `<g class="acc glasses" fill="none" stroke="#2a2440" stroke-width="2"><circle cx="38" cy="55" r="8"/><circle cx="62" cy="55" r="8"/><path d="M46 54 Q50 51 54 54 M30 53 L22 50 M70 53 L78 50"/></g>`,
    sun: () => `<g class="acc glasses"><rect x="28" y="49" width="19" height="12" rx="5" fill="#1b1830"/><rect x="53" y="49" width="19" height="12" rx="5" fill="#1b1830"/><path d="M47 53 Q50 50 53 53" stroke="#1b1830" stroke-width="2.4" fill="none"/><path d="M31 52 L38 52" stroke="#fff" stroke-width="1.6" opacity=".55" stroke-linecap="round"/><path d="M56 52 L63 52" stroke="#fff" stroke-width="1.6" opacity=".55" stroke-linecap="round"/></g>`,
    heart: () => `<g class="acc glasses" fill="#ff6b9a" opacity=".92"><path d="M38 62 L29 53 A5 5 0 0 1 38 47 A5 5 0 0 1 47 53 Z"/><path d="M62 62 L53 53 A5 5 0 0 1 62 47 A5 5 0 0 1 71 53 Z"/><path d="M47 52 L53 52" stroke="#d13a7a" stroke-width="2"/></g>`,
    pixel: () => `<g class="acc glasses" fill="#111"><rect x="26" y="50" width="48" height="4"/><rect x="28" y="54" width="16" height="4"/><rect x="30" y="58" width="12" height="3"/><rect x="54" y="54" width="16" height="4"/><rect x="56" y="58" width="12" height="3"/><rect x="31" y="54" width="3" height="2" fill="#fff"/><rect x="57" y="54" width="3" height="2" fill="#fff"/></g>`,
    monocle: () => `<g class="acc glasses" fill="none" stroke="#c99a2e" stroke-width="2"><circle cx="62" cy="55" r="8.5"/><path d="M70 58 Q76 70 70 82" stroke-width="1.2"/></g>`
  };
  const NECKS = {
    scarf: () => `<g class="acc"><path d="M30 78 Q50 86 70 78 L70 84 Q50 92 30 84 Z" fill="#e5384f"/><path d="M60 84 L64 98 L72 96 L66 82 Z" fill="#c42b40"/><path d="M34 81 L34 85 M40 82 L40 87 M46 83 L46 88" stroke="#ffd2d8" stroke-width="1.4"/></g>`,
    bandana: () => `<g class="acc"><path d="M30 78 Q50 84 70 78 L50 96 Z" fill="#7cc4ff"/><circle cx="46" cy="84" r="1.3" fill="#fff"/><circle cx="54" cy="86" r="1.3" fill="#fff"/><circle cx="50" cy="90" r="1.3" fill="#fff"/></g>`,
    bow: () => `<g class="acc"><path d="M50 82 L38 76 L38 88 Z M50 82 L62 76 L62 88 Z" fill="#b9a4ff"/><circle cx="50" cy="82" r="3.2" fill="#8b6cf6"/></g>`,
    bell: () => `<g class="acc"><path d="M32 79 Q50 85 68 79" stroke="#e5384f" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="87" r="4.6" fill="#ffd27a" stroke="#c99a2e" stroke-width="1"/><path d="M47 87 H53" stroke="#c99a2e" stroke-width="1"/></g>`
  };

  function svg(c) {
    c = Object.assign({}, DEFAULT, c || {});
    const fur = c.fur, cream = c.cream, inner = c.inner, eyes = c.eyes;
    const extra = c.extra;
    return `
<svg class="kit${extra === 'phones' ? ' has-phones' : ''}" viewBox="0 0 100 100" aria-hidden="true">
  ${extra === 'aura' ? `<circle class="aura" cx="50" cy="58" r="44" fill="${fur}" opacity=".18"/>` : ''}
  <g class="tail">
    <path d="M70 86 C92 84 98 64 88 54 C86 66 78 72 66 76 Z" fill="${fur}"/>
    <path d="M88 54 C95 60 95 70 90 76 C88 70 88 62 88 54 Z" fill="${cream}"/>
  </g>
  <ellipse cx="50" cy="88" rx="22" ry="10" fill="${fur}"/>
  <ellipse cx="50" cy="90" rx="11" ry="6" fill="${cream}"/>
  ${c.neck && NECKS[c.neck] ? NECKS[c.neck](c) : ''}
  <g class="head">
    <g class="ear-l"><path d="M22 40 L26 10 L44 30 Z" fill="${fur}"/><path d="M27 32 L28 17 L38 28 Z" fill="${inner}"/></g>
    <g class="ear-r"><path d="M78 40 L74 10 L56 30 Z" fill="${fur}"/><path d="M73 32 L72 17 L62 28 Z" fill="${inner}"/></g>
    <path d="M50 26 C72 26 84 42 82 58 C80 72 66 80 50 80 C34 80 20 72 18 58 C16 42 28 26 50 26 Z" fill="${fur}"/>
    <path d="M50 52 C62 52 74 60 74 66 C70 76 60 80 50 80 C40 80 30 76 26 66 C26 60 38 52 50 52 Z" fill="${cream}"/>
    <path d="M20 58 C26 58 30 62 32 66 C26 66 22 64 20 58 Z M80 58 C74 58 70 62 68 66 C74 66 78 64 80 58 Z" fill="${cream}"/>
    <g class="eyes">
      <ellipse cx="38" cy="55" rx="4" ry="5" fill="${eyes}"/><circle cx="39.4" cy="53.2" r="1.4" fill="#fff"/>
      <ellipse cx="62" cy="55" rx="4" ry="5" fill="${eyes}"/><circle cx="63.4" cy="53.2" r="1.4" fill="#fff"/>
    </g>
    <g class="happy-eyes" fill="none" stroke="#231c36" stroke-width="2.8" stroke-linecap="round">
      <path d="M33.5 56 Q38 50 42.5 56"/><path d="M57.5 56 Q62 50 66.5 56"/>
    </g>
    <g class="sleep-eyes" fill="none" stroke="#231c36" stroke-width="2.6" stroke-linecap="round">
      <path d="M34 55 Q38 58 42 55"/><path d="M58 55 Q62 58 66 55"/>
    </g>
    <path d="M46.5 62 Q50 60 53.5 62 Q51.5 65.5 50 65.5 Q48.5 65.5 46.5 62 Z" fill="#231c36"/>
    <path d="M45.5 68 Q50 71.5 54.5 68" fill="none" stroke="#231c36" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="31" cy="64" rx="4" ry="2.4" fill="#ff7a8a" opacity=".45"/>
    <ellipse cx="69" cy="64" rx="4" ry="2.4" fill="#ff7a8a" opacity=".45"/>
    ${extra === 'freckles' ? '<g fill="#a0522d" opacity=".55"><circle cx="29" cy="61" r=".9"/><circle cx="32" cy="63" r=".9"/><circle cx="28" cy="65" r=".9"/><circle cx="71" cy="61" r=".9"/><circle cx="68" cy="63" r=".9"/><circle cx="72" cy="65" r=".9"/></g>' : ''}
    ${c.glasses && GLASSES[c.glasses] ? GLASSES[c.glasses](c) : ''}
    <path class="sweat" d="M78 40 Q82 47 78 50 Q74 47 78 40 Z" fill="#4cc9f0"/>
    <g class="phones">
      <path d="M17 54 C15 30 30 18 50 18 C70 18 85 30 83 54" fill="none" stroke="#2a2440" stroke-width="5" stroke-linecap="round"/>
      <rect x="11" y="48" width="11" height="17" rx="5" fill="#6ee7c8"/>
      <rect x="78" y="48" width="11" height="17" rx="5" fill="#6ee7c8"/>
    </g>
    ${c.hat && HATS[c.hat] ? HATS[c.hat](c) : ''}
  </g>
  ${extra === 'sparkles' ? '<g class="sparkle" fill="#ffd27a"><path d="M10 20 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z"/><path d="M90 40 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z"/><path d="M84 8 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8z"/></g>' : ''}
  <g class="zz" fill="#b49cff" font-family="Fredoka, sans-serif" font-weight="700"><text x="80" y="22" font-size="12">z</text><text x="88" y="12" font-size="9">z</text></g>
</svg>`;
  }

  function configure(c) { cfg = Object.assign({}, DEFAULT, c || {}); }
  function mount(el, override) {
    if (!el) return null;
    const mood = el.querySelector('.kit') ? Array.from(el.querySelector('.kit').classList).find(x => ['happy', 'sleepy', 'worried', 'focused'].includes(x)) : null;
    el.innerHTML = svg(override || cfg);
    if (!override) el.dataset.mascot = '1';
    if (mood) el.firstElementChild.classList.add(mood);
    return el.firstElementChild;
  }
  function refreshAll() { document.querySelectorAll('[data-mascot="1"]').forEach(el => mount(el)); }

  function setMood(el, mood) {
    const s = el && el.querySelector('.kit');
    if (!s) return;
    s.classList.remove('happy', 'sleepy', 'worried', 'focused');
    if (mood) s.classList.add(mood);
  }

  function isUnlocked(item, ctx) {
    if (!item.unlock) return true;
    if (item.unlock.level) return (ctx.level || 1) >= item.unlock.level;
    if (item.unlock.badge) return !!(ctx.badges || {})[item.unlock.badge];
    return true;
  }

  return { mount, setMood, configure, refreshAll, svg, DEFAULT, PALETTES, ITEMS, isUnlocked, get config() { return cfg; } };
})();
