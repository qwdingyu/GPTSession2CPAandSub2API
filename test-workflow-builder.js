const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'src', 'core', 'workflow-builder.js'), 'utf8');
global.WorkflowBuilder = {};
eval(code);

let passCount = 0;
let failCount = 0;
function assert(condition, message) {
  if (condition) { console.log(`  PASS: ${message}`); passCount++; }
  else { console.log(`  FAIL: ${message}`); failCount++; }
}

console.log('Testing WorkflowBuilder...\n');

const result = WorkflowBuilder.buildWorkflow({
  title: 'Cloudflare 自动部署排查',
  domain: 'ops',
  request: '检查 GitHub Actions 到 Cloudflare 的自动部署链路，并确保生产域名可访问。',
  constraints: '保持 connect-src none\n不要使用临时本地命令替代 CI',
  gates: 'GitHub Actions 成功\n生产域名返回 200',
});

assert(result.workflow.includes('# Workflow: Cloudflare 自动部署排查'), 'workflow title generated');
assert(result.workflow.includes('部署 / 运维任务'), 'domain preset label included');
assert(result.workflow.includes('保持 connect-src none'), 'custom constraint included');
assert(result.workflow.includes('预检'), 'ops-specific step included');
assert(result.checklist.includes('## 交付前'), 'checklist generated');
assert(result.skillDraft.includes('## When to use'), 'skill draft generated');
assert(result.combined.includes('---'), 'combined output separates sections');
assert(result.gates.includes('GitHub Actions 成功'), 'custom gate preserved');
assert(result.gates.some((gate) => gate.includes('不得凭空编造')), 'default anti-hallucination gate included');

const normalized = WorkflowBuilder.normalizeInput({ domain: 'unknown', request: 'x' });
assert(normalized.domain === 'code', 'unknown domain falls back to code');

console.log(`\nWorkflowBuilder Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
