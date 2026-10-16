const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state'),
  action: async (type, payload) => {
    const r = await ipcRenderer.invoke('action', { type, payload });
    if (!r.ok) throw new Error(r.error);
    return r.result;
  },
  on: (channel, cb) => {
    if (!['state', 'live', 'event', 'tick', 'ai', 'update', 'sync'].includes(channel)) return;
    ipcRenderer.on(channel, (e, data) => cb(data));
  },
  log: (level, msg) => ipcRenderer.send('log', { level: ['info', 'warn', 'error'].includes(level) ? level : 'info', msg: String(msg) })
});
