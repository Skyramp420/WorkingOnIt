/* plávajúce okno spotlightu */
  (async function () {
    const api = window.api;
    const boot = await api.getState();
    let S = boot.state;
    I18N.setLang(S.settings.language, navigator.language); I18N.setCurrency(S.settings.currency); I18N.apply(document);
    Look.apply(S.settings);
    const sp = Spotlight.mount(document.getElementById('root'), {
      getState: () => S,
      close: () => api.action('hideSpotlight'),
      run: async (act, q) => {
        const main = ev => api.action('showMain', { event: ev });
        switch (act.type) {
          case 'open': return main({ type: 'openProject', id: act.id });
          case 'quickAdd': return main({ type: 'quickAdd', text: act.text || '', fromClipboard: !act.text });
          case 'go': return main({ type: 'go', view: act.view, anchor: act.anchor });
          case 'ask': return main({ type: 'ask', q: act.q });
          case 'askProject': return main({ type: 'ask', q: '', projectId: act.id });
          case 'notion': return main({ type: 'go', view: 'settings', anchor: 'data' });
          case 'status': await api.action('setStatus', { id: act.id, status: act.status }); break;
          case 'pay': await api.action('addPayment', { id: act.id }); break;
          case 'folder': await api.action('openFolder', { id: act.id }).catch(() => main({ type: 'openProject', id: act.id })); break;
          case 'timer': await api.action('startTimer', { id: act.id || null }); break;
          case 'stopTimer': await api.action('stopTimer'); break;
          case 'theme': await api.action('updateSettings', { patch: { theme: act.theme } }); break;
          case 'recap': return main({ type: 'recap' });
          case 'client': return main({ type: 'go', view: 'clients', client: act.key });
          case 'idea': {
            if (!act.text) return main({ type: 'go', view: 'ideas' });
            await api.action('captureIdea', { text: act.text });
            break;
          }
        }
        api.action('hideSpotlight');
      }
    });
    api.on('state', s => {
      if (I18N.LANGS.some(l => l.id === s.settings.language) && s.settings.language !== I18N.lang) { location.reload(); return; }
      S = s; I18N.setCurrency(S.settings.currency); Look.apply(S.settings); sp.refresh();
    });
    api.on('event', ev => { if (ev && ev.type === 'spotlightOpen') sp.open(ev.clipboard); });
    document.addEventListener('mousedown', e => { if (!e.target.closest('.spot')) api.action('hideSpotlight'); });
  })();
