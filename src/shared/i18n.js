/* WorkingOnIt — preklady (appka, mobil, hlavný proces aj testy).
   Zdrojový jazyk je slovenčina: t('Slovenský text') vráti text v zvolenom jazyku,
   a keď preklad chýba, ostane pôvodný. Premenné: t('Máš {n} zákaziek', { n: 3 }).
   Množné číslo: tp(n, 'zákazka', 'zákazky', 'zákaziek'), preklad má tvar [jednotné, množné].
   Rovnaké slovo s iným významom: t('Späť#undo') ukáže „Späť“, v angličtine „Undo“. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; api.register('en', require('./lang-en.js')); }
  else root.I18N = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LANGS = [{ id: 'sk', name: 'Slovenčina' }, { id: 'en', name: 'English' }];
  const CURRENCIES = ['EUR', 'USD', 'GBP', 'CZK', 'PLN', 'HUF', 'CHF', 'CAD', 'AUD'];
  const dicts = { sk: {} };
  let lang = 'sk', dict = dicts.sk, sys = '', currency = 'EUR';

  /* jazyk systému → náš jazyk (čeština dostane slovenčinu, ostatní angličtinu) */
  function guess(system) { return /^(sk|cs)\b/i.test(String(system || '')) ? 'sk' : 'en'; }
  /* mena podľa regiónu systému (en-US → USD); inak euro */
  const REGION_CURRENCY = { US: 'USD', GB: 'GBP', CZ: 'CZK', PL: 'PLN', HU: 'HUF', CH: 'CHF', LI: 'CHF', CA: 'CAD', AU: 'AUD' };
  function guessCurrency(system) { const m = String(system || '').match(/[-_]([A-Za-z]{2})(?![A-Za-z])/); return (m && REGION_CURRENCY[m[1].toUpperCase()]) || 'EUR'; }
  /* „en_US.UTF-8“, „en-US@posix“ → „en-US“; neplatný tvar sa zahodí, aby Intl nespadol */
  function cleanTag(x) {
    const v = String(x || '').split(/[@.]/)[0].replace(/_/g, '-');
    try { return Intl.getCanonicalLocales(v)[0] || ''; } catch (e) { return ''; }
  }
  function setLang(l, system) {
    if (system) sys = cleanTag(system);
    lang = l === 'en' || l === 'sk' ? l : guess(sys);
    dict = dicts[lang] || {};
    return lang;
  }
  function register(code, d) { dicts[code] = Object.assign(dicts[code] || {}, d); if (code === lang) dict = dicts[code]; }
  function setCurrency(c) { currency = CURRENCIES.includes(String(c || '').toUpperCase()) ? String(c).toUpperCase() : 'EUR'; return currency; }

  function fill(s, v) {
    if (v == null) return s;
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? v[k] : m));
  }
  /* kľúč môže mať na konci kontext, ak to isté slovo znamená v angličtine niečo iné: 'Späť#undo' */
  const CTX = /#[a-z]+$/;
  function t(sk, v) {
    const tr = lang === 'sk' ? null : dict[sk];
    return fill(tr == null || typeof tr !== 'string' ? String(sk).replace(CTX, '') : tr, v);
  }
  function plural(n, one, few, many) {
    const a = Math.abs(Number(n) || 0);
    if (lang === 'sk') return a === 1 ? one : a >= 2 && a <= 4 ? few : many;
    const e = dict[one + '|' + few + '|' + many];
    if (Array.isArray(e)) return a === 1 ? e[0] : e[1];
    return a === 1 ? one : many;
  }
  function tp(n, one, few, many, v) { return fill(plural(n, one, few, many), Object.assign({ n }, v || {})); }

  /* formát dátumov a čísel podľa jazyka (angličtina podľa systému, inak britská) */
  function locale() { return lang === 'en' ? (/^en-[a-z]{2}/i.test(sys) ? sys : 'en-GB') : 'sk-SK'; }
  function currencySymbol() {
    try {
      const p = new Intl.NumberFormat(locale(), { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find(x => x.type === 'currency');
      return p ? p.value : currency;
    } catch (e) { return currency === 'EUR' ? '€' : currency; }
  }

  /* statický text v HTML: <b data-t>Uložiť</b>, atribúty cez data-t-attrs="title,placeholder" */
  function apply(scope) {
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-t]').forEach(el => {
      if (el.dataset.tKey === undefined) el.dataset.tKey = el.innerHTML.trim();
      el.innerHTML = t(el.dataset.tKey);
    });
    scope.querySelectorAll('[data-t-attrs]').forEach(el => {
      for (const a of el.dataset.tAttrs.split(',').map(x => x.trim()).filter(Boolean)) {
        const k = 'tOrig' + a.replace(/(^|-)(\w)/g, (m, d, c) => c.toUpperCase());
        if (el.dataset[k] === undefined) el.dataset[k] = el.getAttribute(a) || '';
        el.setAttribute(a, t(el.dataset[k]));
      }
    });
    if (scope.documentElement) scope.documentElement.lang = lang;
  }

  return {
    t, tp, plural, fill, setLang, register, guess, guessCurrency, locale, apply, setCurrency, currencySymbol, LANGS, CURRENCIES,
    get lang() { return lang; }, get currency() { return currency; },
    has: k => lang === 'sk' || Object.prototype.hasOwnProperty.call(dict, k),
    dict: code => dicts[code] || {}
  };
});
