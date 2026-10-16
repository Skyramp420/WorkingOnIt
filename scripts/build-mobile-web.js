/* Postaví verejnú mobilnú verziu do priečinka web/ (pre GitHub Pages).
   Stránka nemá žiadne dáta: každý sa v nej prihlási do svojej vlastnej databázy.
   Použitie: node scripts/build-mobile-web.js [cieľový priečinok] */
const fs = require('fs');
const path = require('path');
const { MOBILE_FILES, MOBILE_FONTS, manifest } = require('../src/main/remote.js');

const root = path.join(__dirname, '..');
const out = path.resolve(root, process.argv[2] || 'web');
const pkg = require('../package.json');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const put = (rel, data) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };

// stránka: rovnaká ako cez wifi, len v online režime
let html = fs.readFileSync(path.join(root, 'src', 'mobile', 'mobile.html'), 'utf8');
const first = html.indexOf('<script src=');
if (first < 0) throw new Error('mobile.html: nenašiel som skripty');
html = html.slice(0, first) + '<script>window.WOI_CLOUD = true;</script>\n' + html.slice(first);
html = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="robots" content="noindex">\n<meta name="woi-version" content="${pkg.version}">`);
put('index.html', html);

for (const f of MOBILE_FILES) put(f.slice(1), fs.readFileSync(path.join(root, 'src', f)));

let fonts = 0;
for (const [to, from] of Object.entries(MOBILE_FONTS)) {
  const src = path.join(root, 'node_modules', '@fontsource-variable', ...from.split('/'));
  if (fs.existsSync(src)) { put(to.slice(1), fs.readFileSync(src)); fonts++; }
}
if (!fonts) console.warn('Pozor: chýba písmo (najprv npm ci). Stránka pôjde so systémovým písmom.');

put('icon.png', fs.readFileSync(path.join(root, 'assets', 'icon.png')));
put('manifest.json', JSON.stringify(manifest(), null, 2));
put('.nojekyll', '');

console.log('Mobilná verzia ' + pkg.version + ' je v ' + path.relative(root, out) + path.sep);
