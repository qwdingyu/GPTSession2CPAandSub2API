const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, 'src', 'core', 'output-evaluator.js'), 'utf8');
global.OutputEvaluator = {};
eval(code);

let passCount = 0;
let failCount = 0;
function assert(condition, message) {
  if (condition) { console.log(`  PASS: ${message}`); passCount++; }
  else { console.log(`  FAIL: ${message}`); failCount++; }
}

console.log('Testing OutputEvaluator...\n');

const strong = OutputEvaluator.evaluateOutput({
  task: '实现 AI Output Evaluator 并部署。',
  requirements: 'npm test 通过\n生产域名可访问\n文档已更新\n保持 connect-src none',
  output: '已新增 `src/evaluate.html`、`src/core/output-evaluator.js`，文档已更新：docs/16_AIOutputEvaluator实现说明_20260714.md。验证：npm test passed，npm run check:static success，npm run verify:domain 通过，部署到生产域名可访问。风险：未测试超大报告粘贴场景；CSP 保持 connect-src none。',
});

assert(strong.verdict === 'pass', 'strong output passes');
assert(strong.score >= 80, 'strong output score is high');
assert(strong.requirements.every((item) => item.covered), 'Chinese and command requirements are covered');
assert(strong.findings.some((item) => item.title === '结构较完整'), 'complete structure finding generated');

const weak = OutputEvaluator.evaluateOutput({
  task: '修复部署。',
  requirements: 'GitHub Actions 成功\n域名可访问',
  output: '搞定了。',
});

assert(weak.verdict === 'fail', 'weak output fails');
assert(weak.findings.some((item) => item.title === '缺少验证证据'), 'missing evidence is flagged');
assert(weak.findings.some((item) => item.title === '需求覆盖不完整'), 'missing requirements are flagged');

const report = OutputEvaluator.formatReport(strong);
assert(report.includes('# AI Output Evaluation'), 'markdown report has title');
assert(report.includes('本地启发式结构评估'), 'report includes heuristic disclaimer');
assert(report.includes('## 需求覆盖'), 'report includes requirement coverage');

console.log(`\nOutputEvaluator Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
