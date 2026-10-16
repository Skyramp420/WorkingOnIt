/* Jednoduchý log do súboru: %APPDATA%\WorkingOnIt\logs\main.log (max ~1 MB, 3 staré kópie).
   Pomáha, keď niečo zlyhá a treba zistiť prečo. */
const fs = require('fs');
const path = require('path');

let file = null;
const MAX = 1024 * 1024;

function init(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, 'main.log');
    rotate();
  } catch (e) { file = null; }
}

function rotate() {
  try {
    if (!file || !fs.existsSync(file) || fs.statSync(file).size < MAX) return;
    const nth = i => file.replace(/\.log$/, '.' + i + '.log');
    if (fs.existsSync(nth(3))) fs.unlinkSync(nth(3));
    for (let i = 2; i >= 1; i--) if (fs.existsSync(nth(i))) fs.renameSync(nth(i), nth(i + 1));
    fs.renameSync(file, nth(1));
  } catch (e) { /* log nesmie zhodiť appku */ }
}

function fmt(a) {
  if (a instanceof Error) return a.stack || a.message;
  if (a && typeof a === 'object') { try { return JSON.stringify(a).slice(0, 2000); } catch (e) { return String(a); } }
  return String(a);
}

let writes = 0;
function write(level, args) {
  const line = new Date().toISOString() + ' ' + level.padEnd(5) + ' ' + args.map(fmt).join(' ') + '\n';
  if (!file) return;
  try {
    fs.appendFileSync(file, line);
    if (++writes % 200 === 0) rotate();
  } catch (e) { /* ticho */ }
}

module.exports = {
  init,
  file: () => file,
  dir: () => (file ? path.dirname(file) : null),
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a)
};
