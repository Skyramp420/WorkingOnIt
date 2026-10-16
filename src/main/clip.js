/* Schránka: Electron 44+ má asynchrónne API podľa W3C (read/write/ClipboardItem),
   staršie verzie synchrónne (readText/writeImage). Tu to zjednotíme. */
const electron = require('electron');
const { clipboard } = electron;

async function readText() {
  const r = clipboard.readText();
  return String((r && typeof r.then === 'function' ? await r : r) || '');
}
async function writeText(text) {
  await clipboard.writeText(String(text == null ? '' : text));
}
/* img = nativeImage */
async function writeImage(img) {
  if (typeof clipboard.writeImage === 'function') return clipboard.writeImage(img);
  const Item = electron.ClipboardItem || globalThis.ClipboardItem;
  await clipboard.write([new Item({ 'image/png': new Blob([img.toPNG()], { type: 'image/png' }) })]);
}

module.exports = { readText, writeText, writeImage };
