const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      if (f === 'node_modules' || f === 'coverage' || f === '.git') continue;
      walk(fp, cb);
    } else {
      cb(fp);
    }
  }
}

function isTsx(file) {
  return file.endsWith('.tsx');
}

function report(file, items) {
  if (items.length === 0) return;
  console.log('\nFILE: ' + file);
  for (const it of items) {
    console.log(`  L${it.line}: "${it.text.trim()}"`);
  }
}

function findJsxText(sourceFile, sourceText) {
  const results = [];
  function visit(node) {
    if (ts.isJsxText(node)) {
      const txt = node.getText(sourceFile);
      if (txt && txt.replace(/\s+/g, '').length > 0) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        results.push({ line: line + 1, text: txt.replace(/\n/g, ' ').trim() });
      }
    }
    if (ts.isJsxAttribute(node)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        const txt = node.initializer.text;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.initializer.getStart());
        if (txt && txt.trim().length > 0) results.push({ line: line + 1, text: txt.trim() });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return results;
}

const root = process.cwd();
const skipPattern = path.join('app', 'test');
const skipIconPattern = path.join('components', 'icons');
const files = [];
walk(root, (fp) => {
  if (!isTsx(fp)) return;
  if (fp.includes(skipPattern)) return;
  files.push(fp);
});

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  // scan all files (including those that already use translations)
  try {
    const sourceFile = ts.createSourceFile(
      file,
      txt,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const items = findJsxText(sourceFile, txt).filter((i) => {
      // Filter out lone punctuation or numbers
      const s = i.text.replace(/\s+/g, ' ').trim();
      if (!s) return false;
      if (/^[-–—\u2026]+$/.test(s)) return false;
      if (/^[0-9:]+$/.test(s)) return false;
      // ignore single characters like \u00A0
      if (s.length <= 1) return false;
      // ignore tailwind/class-like strings (mostly lowercase tokens with - and :)
      const classLike = /^[A-Za-z0-9_\-:\/\[\].#%]+(\s+[A-Za-z0-9_\-:\/\[\].#%]+)*$/;
      if (classLike.test(s)) return false;
      // ignore long svg/path or color strings
      if (/^#[0-9A-Fa-f]+$/.test(s)) return false;
      if (file.includes(skipIconPattern)) return false;
      return true;
    });
    if (items.length > 0) report(file, items);
  } catch (err) {
    console.error('ERR parsing', file, err && err.message);
  }
}
