const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'src', 'core', 'context-pack.js'), 'utf8');
global.ContextPack = {};
eval(code);

let passCount = 0;
let failCount = 0;
function assert(condition, message) {
  if (condition) { console.log(`  PASS: ${message}`); passCount++; }
  else { console.log(`  FAIL: ${message}`); failCount++; }
}

console.log('Testing ContextPack...\n');

const entries = [
  { path: 'demo/README.md', text: '# Demo', size: 6 },
  { path: 'demo/src/app.js', text: 'console.log("ok")', size: 17 },
  { path: 'demo/node_modules/pkg/index.js', text: 'skip', size: 4 },
  { path: 'demo/image.png', text: '', size: 100 },
  { path: 'demo/package-lock.json', text: '{}', size: 2 },
];

const filtered = ContextPack.filterEntries(entries);
assert(filtered.included.length === 2, 'filters to two useful text files');
assert(filtered.skipped.length === 3, 'skips ignored/binary/lock files');

const tree = ContextPack.buildTree(filtered.included);
assert(tree.includes('README.md'), 'tree includes README');
assert(tree.includes('src'), 'tree includes src directory');

const result = ContextPack.buildContextMarkdown(entries, { title: 'Demo Context' });
assert(result.markdown.startsWith('# Demo Context'), 'markdown title generated');
assert(result.markdown.includes('## 目录树'), 'markdown includes tree section');
assert(result.markdown.includes('console.log'), 'markdown includes file content');
assert(result.markdown.includes('## 跳过文件'), 'markdown includes skipped section');
assert(result.estimatedTokens > 0, 'token estimate generated');

console.log(`\nContextPack Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
