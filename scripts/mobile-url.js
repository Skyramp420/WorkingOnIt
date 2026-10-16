/* Doplní adresu verejnej mobilnej verzie (GitHub Pages) do package.json, ak tam ešte nie je.
   Spúšťa sa pri vydaní na GitHube; appka podľa nej robí QR kód na prihlásenie z mobilu. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.woi = pkg.woi || {};
const repo = process.env.GITHUB_REPOSITORY || process.argv[2] || '';
if (!pkg.woi.mobileUrl && repo.includes('/')) {
  const [owner, name] = repo.split('/');
  const host = owner.toLowerCase() + '.github.io';
  pkg.woi.mobileUrl = name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
console.log('Mobilná verzia: ' + (pkg.woi.mobileUrl || '(nenastavené)'));
