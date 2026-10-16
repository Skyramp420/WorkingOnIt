/* Efekty: iskry a svetielka, +XP, mäkké prémiové zvuky (syntéza cez Web Audio, žiadne súbory) */
window.FX = (function () {
  const canvas = document.getElementById('fx');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let parts = [], raf = null;
  const COLORS = ['#6ee7c8', '#b9a4ff', '#ffd27a', '#7cc4ff', '#f9a8d4', '#ffffff'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    if (!canvas) return;
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  /* iskry: svietiace bodky a hviezdičky, ktoré vyletia, spomalia a pomaly zhasnú */
  function confetti(x, y, n) {
    if (!ctx || reduced || (window.__motion && window.__motion !== 'full')) return;
    n = Math.round((n || 90) * 0.8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 6.5;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5,
        r: 1.2 + Math.random() * 2.6,
        c: COLORS[i % COLORS.length], life: 0, max: 70 + Math.random() * 80,
        star: Math.random() < 0.3, tw: Math.random() * 6.28, spin: Math.random() * 6.28
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }

  function star(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.28 : r;
      const a = i * Math.PI / 4;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function step() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter(p => p.life < p.max);
    for (const p of parts) {
      p.life++;
      p.vx *= 0.955; p.vy = p.vy * 0.955 - 0.03; // vznášajú sa ako svetlušky
      p.x += p.vx + Math.sin((p.life + p.tw * 10) / 14) * 0.25; p.y += p.vy;
      const fade = 1 - p.life / p.max;
      const twinkle = 0.65 + 0.35 * Math.sin(p.life / 4 + p.tw);
      const alpha = Math.max(0, fade * twinkle);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, p.c); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
      ctx.globalAlpha = alpha; ctx.fillStyle = p.c;
      if (p.star) star(p.x, p.y, p.r * 2.2); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.8, 0, 6.283); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (parts.length) raf = requestAnimationFrame(step);
    else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function xp(x, y, text) {
    if (window.__motion === 'off') return;
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = text;
    el.style.left = (x - 30) + 'px'; el.style.top = (y - 20) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  /* ---------- zvuky: mäkké a jemné ---------- */
  let A = null, master = null, verb = null;
  function audio() {
    if (A) return A;
    A = new AudioContext();
    const comp = A.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = A.createGain();
    master.connect(comp).connect(A.destination);
    // krátky „izbový“ dozvuk z vygenerovanej odozvy
    verb = A.createConvolver();
    const len = A.sampleRate * 1.6, ir = A.createBuffer(2, len, A.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const wet = A.createGain(); wet.gain.value = 0.22;
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    verb.connect(lp).connect(wet).connect(master);
    return A;
  }
  function out(gain, toVerb) {
    const g = A.createGain(); g.gain.value = gain;
    g.connect(master);
    if (toVerb) g.connect(verb);
    return g;
  }
  function ready() {
    if (!window.__sounds) return false;
    try { audio(); if (A.state === 'suspended') A.resume(); master.gain.value = (window.__volume == null ? 0.7 : window.__volume) * 0.9; return true; } catch (e) { return false; }
  }

  /* jemný elektrický klavír (FM): teplý tón s mäkkým útokom */
  function epiano(freq, t, dur, vel) {
    const o = out(0.11 * (vel || 1), true);
    const car = A.createOscillator(), mod = A.createOscillator(), mg = A.createGain(), env = A.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * 1.0008;
    mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(freq * 0.15, t + dur * 0.6);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(1, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mod.connect(mg).connect(car.frequency);
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
    car.connect(env).connect(lp).connect(o);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  /* sklenený zvonček */
  function bell(freq, t, dur, vel) {
    const o = out(0.06 * (vel || 1), true);
    [[1, 1], [2.76, 0.32], [5.4, 0.12]].forEach(([r, a]) => {
      const osc = A.createOscillator(), e = A.createGain();
      osc.type = 'sine'; osc.frequency.value = freq * r;
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(a, t + 0.006);
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur / r);
      osc.connect(e).connect(o); osc.start(t); osc.stop(t + dur + 0.05);
    });
  }
  /* mäkké „pop“ s klesajúcou výškou */
  function pop(f1, f2, t, dur, vel) {
    const o = out(0.09 * (vel || 1), false);
    const osc = A.createOscillator(), e = A.createGain();
    osc.frequency.setValueAtTime(f1, t); osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(1, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(e).connect(o); osc.start(t); osc.stop(t + dur + 0.02);
  }
  /* ťuknutie: filtrovaný šum */
  function tap(t, freq, vel) {
    const o = out(0.05 * (vel || 1), false);
    const len = Math.floor(A.sampleRate * 0.03), b = A.createBuffer(1, len, A.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    const src = A.createBufferSource(); src.buffer = b;
    const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 2400; bp.Q.value = 1.4;
    src.connect(bp).connect(o); src.start(t);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

  const sound = {
    pop: () => { if (!ready()) return; const t = A.currentTime; tap(t, 2800, 0.6); pop(880, 520, t, 0.09, 0.8); },
    drop: () => { if (!ready()) return; const t = A.currentTime; pop(260, 120, t, 0.12, 1); tap(t, 1200, 0.5); },
    boop: () => { if (!ready()) return; const t = A.currentTime; pop(620, 980, t, 0.11, 0.9); bell(N(88), t + 0.05, 0.5, 0.5); },
    rec: () => { if (!ready()) return; const t = A.currentTime; bell(N(81), t, 0.7, 0.8); bell(N(76), t + 0.09, 0.8, 0.6); },
    render: () => { if (!ready()) return; const t = A.currentTime; [79, 86, 91].forEach((n, i) => bell(N(n), t + i * 0.08, 1.4, 0.8)); },
    pay: () => { if (!ready()) return; const t = A.currentTime; bell(N(88), t, 0.6, 0.8); bell(N(95), t + 0.07, 0.9, 0.7); },
    done: () => { if (!ready()) return; const t = A.currentTime; [60, 64, 67, 71, 74].forEach((n, i) => epiano(N(n + 12), t + i * 0.055, 1.8 - i * 0.1, 1 - i * 0.08)); bell(N(96), t + 0.3, 1.6, 0.35); },
    level: () => { if (!ready()) return; const t = A.currentTime; [62, 66, 69, 73, 76, 78].forEach((n, i) => epiano(N(n + 12), t + i * 0.07, 2, 0.9)); [90, 93, 97].forEach((n, i) => bell(N(n), t + 0.45 + i * 0.06, 1.8, 0.4)); },
    badge: () => { if (!ready()) return; const t = A.currentTime; [84, 88, 91, 96].forEach((n, i) => bell(N(n), t + i * 0.06, 1.6, 0.7)); epiano(N(72), t, 1.6, 0.6); epiano(N(79), t, 1.6, 0.4); },
    open: () => { if (!ready()) return; const t = A.currentTime; tap(t, 1800, 0.5); pop(420, 640, t, 0.08, 0.5); },
    close: () => { if (!ready()) return; const t = A.currentTime; tap(t, 1500, 0.4); pop(560, 380, t, 0.08, 0.45); }
  };

  return { confetti, xp, sound };
})();
