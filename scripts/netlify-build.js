const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'sw.js']) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, file));
}
const assets = path.join(root, 'assets');
if (fs.existsSync(assets)) {
  for (const file of fs.readdirSync(assets)) {
    const source = path.join(assets, file);
    if (fs.statSync(source).isFile()) fs.copyFileSync(source, path.join(out, 'assets', file));
  }
}
console.log('Netlify public assets prepared.');
