#!/usr/bin/env node
/* Çeviri denetimi: kaynaklardaki tüm Türkçe arayüz metinlerini toplar, İngilizce sözlükte eksik olanları listeler.
 *   node scripts/i18n-check.js          → eksikleri yazdırır (eksik varsa çıkış kodu 1)
 *   node scripts/i18n-check.js --json   → eksikleri JSON olarak yazdırır */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const keys = new Map(); // anahtar → ilk görüldüğü yer
const add = (k, where) => { if (k && /[A-Za-zçğıöşüÇĞİÖŞÜ]/.test(k) && !keys.has(k)) keys.set(k, where); };
const unq = (s) => s.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

// 1) SE.t( … ) çağrılarındaki metinler (koşullu ifadeler dahil)
const jsFiles = [];
for (const dir of ['js/runtime', 'js/editor', 'js/platform']) {
  for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js') && f !== 'lang-en.js') jsFiles.push(dir + '/' + f);
}
for (const f of jsFiles) {
  const src = read(f);
  let i = 0;
  while ((i = src.indexOf('SE.t(', i)) >= 0) {
    let j = i + 5, depth = 1, q = null, buf = '', lits = [];
    for (; j < src.length && depth > 0; j++) {
      const c = src[j];
      if (q) {
        buf += c;
        if (c === '\\') { buf += src[++j]; continue; }
        if (c === q) { lits.push(buf); q = null; buf = ''; }
        continue;
      }
      if (c === "'" || c === '"') { q = c; buf = c; continue; }
      if (c === '(' || c === '[' || c === '{') { if (depth === 1 && c === '{') break; depth++; }
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 1) break;
    }
    const line = src.slice(0, i).split('\n').length;
    lits.forEach((l) => add(unq(l), f + ':' + line));
    i = j;
  }
}

// 2) Bloklar: metinler, kategori adları, menü etiketleri (çevirileri gösterim anında yapılır)
const blocks = read('js/runtime/blocks.js');
for (const m of blocks.matchAll(/\btext2?: '((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"), 'blocks.js (blok metni)');
for (const m of blocks.matchAll(/\{ id: '[a-z]+', name: '([^']+)'/g)) add(m[1], 'blocks.js (kategori)');
for (const m of blocks.matchAll(/\btxt\('((?:[^'\\]|\\.)*)'\)/g)) add(m[1], 'blocks.js (varsayılan metin)');
for (const m of blocks.matchAll(/\[\s*'((?:[^'\\]|\\.)+)'\s*,\s*'[^']*'\s*\]/g)) add(m[1].replace(/\\'/g, "'"), 'blocks.js (menü)');

// 3) HTML: metin düğümleri ve title / placeholder / aria-label
const html = read('index.html').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
for (const m of html.matchAll(/>([^<>]+)</g)) { const t = m[1].trim(); if (t && !/^[\s&;#\w.,:/()-]*$/.test(t) || /^[A-ZÇĞİÖŞÜ]/.test(t)) add(t.replace(/&amp;/g, '&'), 'index.html'); }
for (const m of html.matchAll(/\b(?:title|placeholder|aria-label)="([^"]+)"/g)) add(m[1].replace(/&amp;/g, '&'), 'index.html (nitelik)');

// Sözlükleri yükle
const sandbox = { SE: { modules: [], module(n, f) { f(sandbox.SE); } }, localStorage: { getItem() { return null; } }, navigator: { language: 'en' }, document: {}, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/runtime/i18n.js'), sandbox);
if (fs.existsSync(path.join(root, 'js/editor/lang-en.js'))) vm.runInContext(read('js/editor/lang-en.js'), sandbox);
const en = sandbox.SE.i18n.dict.en;

// Çevirisi gerekmeyenler: dile göre değişmeyen özel adlar / semboller
const SAME = new Set(['Stackit', 'Engine', 'Stackit Engine', 'Robo', 'Platform', 'platform', 'Türkçe', 'English', 'Dil / Language', 'Tempo', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'ln', 'log', 'e ^', '10 ^', 'mod', 'enter', 'shift', '{A} ', '{VAR}', '{LIST}', '{FN} ( {A} )', '{A} > {B}', '{A} < {B}', '{A} = {B}']);
const missing = [...keys.entries()].filter(([k]) => en[k] == null && !SAME.has(k));
const unused = Object.keys(en).filter((k) => !keys.has(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(missing), null, 1));
} else {
  console.log(`anahtar: ${keys.size} · sözlükte: ${Object.keys(en).length} · eksik: ${missing.length} · kullanılmayan: ${unused.length}`);
  missing.forEach(([k, w]) => console.log('  EKSİK  ' + JSON.stringify(k) + '   ← ' + w));
  if (process.argv.includes('--unused')) unused.forEach((k) => console.log('  FAZLA  ' + JSON.stringify(k)));
}
process.exit(missing.length ? 1 : 0);
