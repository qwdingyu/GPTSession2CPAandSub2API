const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'src', 'core', 'agent-brief.js'), 'utf8');
global.AgentBrief = {};
eval(code);

let passCount = 0;
let failCount = 0;
function assert(condition, message) {
  if (condition) { console.log(`  PASS: ${message}`); passCount++; }
  else { console.log(`  FAIL: ${message}`); failCount++; }
}

console.log('Testing AgentBrief...\n');

const result = AgentBrief.buildAgentBrief({
  title: '新增本地工具',
  projectType: 'worker',
  targetAgent: 'Codex',
  goal: '新增一个纯前端工具并部署到 Cloudflare。',
  constraints: '不新增依赖\n保持 connect-src none',
  deliverables: '页面\n测试\n文档',
  testCommands: 'npm test\nnpm run deploy:ci',
});

assert(result.brief.includes('# Agent Brief: 新增本地工具'), 'brief title generated');
assert(result.brief.includes('Cloudflare Worker'), 'project preset label included');
assert(result.brief.includes('保持 connect-src none'), 'custom constraint included');
assert(result.brief.includes('`npm test`'), 'test command included');
assert(result.rules.includes('Agent Rules Snippet'), 'rules snippet generated');
assert(result.issue.includes('Acceptance Criteria'), 'issue draft generated');
assert(result.combined.includes('---'), 'combined output separates sections');

const normalized = AgentBrief.normalizeInput({ projectType: 'unknown', goal: 'x' });
assert(normalized.projectType === 'code', 'unknown project type falls back to code');

console.log(`\nAgentBrief Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
