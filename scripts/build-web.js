#!/usr/bin/env node
/* Web dosyalarını dist/web klasörüne kopyalar (Capacitor bu klasörü uygulamaya gömer).
 * --android: Capacitor çekirdeğini ve Android uyarlamalarını (geri tuşu, paylaşım) sayfaya ekler. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist', 'web');
const android = process.argv.includes('--android');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const dir of ['css', 'js']) fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (android) {
  const core = path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');
  fs.mkdirSync(path.join(out, 'js', 'vendor'), { recursive: true });
  fs.copyFileSync(core, path.join(out, 'js', 'vendor', 'capacitor.js'));
  html = html.replace(
    '</body>',
    '  <!-- Android (Capacitor) -->\n  <script src="js/vendor/capacitor.js"></script>\n  <script src="js/platform/android.js"></script>\n</body>'
  );
} else {
  fs.rmSync(path.join(out, 'js', 'platform'), { recursive: true, force: true });
}
fs.writeFileSync(path.join(out, 'index.html'), html);

let files = 0;
(function count(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? count(path.join(d, f.name)) : files++;
})(out);
console.log('dist/web hazır (' + files + ' dosya' + (android ? ', Android köprüsüyle' : '') + ')');
