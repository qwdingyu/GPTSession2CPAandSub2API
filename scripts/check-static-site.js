const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

function read(file) {
  return readFileSync(file, 'utf8');
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const headers = read('src/_headers');
const index = read('src/index.html');
const contextPack = read('src/context-pack.html');
const agentBrief = read('src/agent-brief.html');
const wrangler = read('wrangler.jsonc');
const sourceFiles = walk('src').filter((file) => /\.(html|js|css|svg)$/.test(file));
const allSource = sourceFiles.map((file) => read(file)).join('\n');

const checks = [
  [wrangler.includes('"name": "gptsession2cpaandsub2api"'), 'wrangler Worker name must remain gptsession2cpaandsub2api'],
  [wrangler.includes('"directory": "./src"'), 'wrangler assets directory must remain ./src'],
  [headers.includes("connect-src 'none'"), 'CSP must keep connect-src none'],
  [headers.includes("script-src 'self'"), 'CSP must keep script-src self'],
  [headers.includes("font-src 'self'"), 'CSP must keep font-src self'],
  [!allSource.includes('fonts.googleapis') && !allSource.includes('fonts.gstatic'), 'site must not load Google Fonts'],
  [index.includes('https://ai.eforge.xyz/'), 'index metadata must use production domain https://ai.eforge.xyz/'],
  [index.includes('AI Forge'), 'index page must contain AI Forge branding'],
  [contextPack.includes('Context Pack Builder'), 'context-pack page must contain Context Pack Builder branding'],
  [contextPack.includes('./core/context-pack.js'), 'context-pack page must load core context-pack module'],
  [agentBrief.includes('Agent Brief Generator'), 'agent-brief page must contain Agent Brief Generator branding'],
  [agentBrief.includes('./core/agent-brief.js'), 'agent-brief page must load core agent-brief module'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length > 0) {
  for (const [, message] of failed) console.error(message);
  process.exit(1);
}

console.log('static site checks passed.');
