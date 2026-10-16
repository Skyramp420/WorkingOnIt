/* Kde má appka dáta.
   Nainštalovaná appka (produkcia) používa %APPDATA%\WorkingOnIt, testovacia (Spustit.bat) %APPDATA%\WorkingOnIt Test.
   Čo vzniklo pred prvým spustením nainštalovanej appky, bolo skúšanie, a preto sa to presunie do testovacieho priečinka
   (nič sa nemaže). Značka .produkcia hovorí, že priečinok už patrí nainštalovanej appke. */
const fs = require('fs');
const path = require('path');

const MARK = '.produkcia';
const has = (dir, f) => { try { return fs.existsSync(path.join(dir, f)); } catch (e) { return false; } };

/* presun celého priečinka; keď sa nedá (otvorený súbor), presunú sa aspoň dáta appky */
function moveData(from, to) {
  try { fs.renameSync(from, to); return 'folder'; } catch (e) { }
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(from)) {
    if (name === MARK) continue;
    if (!/^(data\.json|data\.json\.bak|data\.poskodene-.*|data\.pred-obnovou-.*|zalohy|obrazky|sync.*|secrets.*|.*\.dpapi)$/i.test(name)) continue;
    try { fs.renameSync(path.join(from, name), path.join(to, name)); n++; } catch (e) { }
  }
  return 'files:' + n;
}

function freeName(base) {
  if (!fs.existsSync(base)) return base;
  for (let i = 2; ; i++) { const p = `${base} (${i})`; if (!fs.existsSync(p)) return p; }
}

/* vráti priečinok s dátami a čo sa pri tom stalo (na zápis do logu) */
function resolve({ appData, packaged }) {
  const prod = path.join(appData, 'WorkingOnIt');
  const test = path.join(appData, 'WorkingOnIt Test');
  const note = [];
  if (packaged) {
    if (!has(prod, MARK)) {
      if (has(prod, 'data.json')) {
        const to = freeName(test);
        note.push('testovacie dáta presunuté: ' + moveData(prod, to) + ' → ' + to);
      }
      try { fs.mkdirSync(prod, { recursive: true }); fs.writeFileSync(path.join(prod, MARK), new Date().toISOString()); } catch (e) { note.push('značka: ' + e.message); }
    }
    return { dir: prod, note };
  }
  // testovacia appka: staré dáta z čias pred produkciou si zoberie so sebou
  if (!fs.existsSync(test) && has(prod, 'data.json') && !has(prod, MARK)) {
    note.push('dáta presunuté do testovacej appky: ' + moveData(prod, test));
  }
  return { dir: test, note };
}

module.exports = { resolve, MARK };
