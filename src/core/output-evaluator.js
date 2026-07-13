var OutputEvaluator;
(function (OutputEvaluator) {
  'use strict';

  function text(value) { return String(value || '').trim(); }
  function splitRequirements(value) {
    return text(value).split(/\n|；|;/).map(function (line) { return line.replace(/^[-*\d.、)）\s]+/, '').trim(); }).filter(Boolean);
  }
  function normalizeForMatch(value) {
    return text(value).toLowerCase().replace(/[\s`*_#>\-—–,，.。:：;；!！?？()[\]（）【】{}]/g, '');
  }
  function requirementTerms(value) {
    var raw = text(value).toLowerCase();
    var terms = raw.split(/[\s,，.。:：;；!！?？()[\]（）【】{}\/\\|]+/).filter(function (part) { return part.length >= 2; });
    var compact = normalizeForMatch(raw);
    if (/[^\x00-\xff]/.test(compact) && compact.length >= 4) {
      for (var i = 0; i <= compact.length - 4; i += 2) terms.push(compact.slice(i, i + 4));
    }
    return terms.filter(function (term, index) { return terms.indexOf(term) === index; });
  }
  function includesAny(value, keywords) {
    var lower = text(value).toLowerCase();
    return keywords.some(function (keyword) { return lower.indexOf(keyword.toLowerCase()) >= 0; });
  }
  function scoreItem(ok, weight) { return ok ? weight : 0; }

  function evaluateOutput(input) {
    var task = text(input && input.task);
    var output = text(input && input.output);
    var requirements = splitRequirements(input && input.requirements);
    var evidenceKeywords = ['test', '测试', '验证', 'passed', 'success', '通过', '部署', 'build', 'lint', 'typecheck', 'check:static', 'verify:domain'];
    var riskKeywords = ['风险', '未测试', 'not tested', '限制', '注意', '剩余', 'blocker', 'known gap', '未覆盖'];
    var actionKeywords = ['修改', '新增', '实现', '更新', '修复', '创建', '删除', '优化', '部署', 'refactor', 'add', 'update', 'fix'];

    var hasTask = Boolean(task);
    var hasOutput = Boolean(output);
    var mentionsEvidence = includesAny(output, evidenceKeywords);
    var mentionsRisk = includesAny(output, riskKeywords);
    var mentionsAction = includesAny(output, actionKeywords);
    var mentionsFiles = /[`\w./-]+\.(js|ts|tsx|jsx|html|css|md|json|yml|yaml|toml|py|go|rs)/i.test(output);
    var tooShort = output.length < 120;

    var normalizedOutput = normalizeForMatch(output);
    var covered = requirements.map(function (req) {
      var normalizedRequirement = normalizeForMatch(req);
      var terms = requirementTerms(req);
      var hitCount = terms.filter(function (token) { return normalizedOutput.indexOf(normalizeForMatch(token)) >= 0; }).length;
      var ok = normalizedRequirement.length > 0 && (
        normalizedOutput.indexOf(normalizedRequirement) >= 0 ||
        hitCount >= Math.max(1, Math.ceil(Math.min(terms.length, 4) * 0.5))
      );
      return { requirement: req, covered: ok, matchedTerms: hitCount };
    });
    var coveredCount = covered.filter(function (item) { return item.covered; }).length;
    var requirementScore = requirements.length ? Math.round((coveredCount / requirements.length) * 30) : 20;

    var score = 0;
    score += scoreItem(hasTask && hasOutput, 10);
    score += requirementScore;
    score += scoreItem(mentionsAction, 15);
    score += scoreItem(mentionsEvidence, 20);
    score += scoreItem(mentionsFiles, 10);
    score += scoreItem(mentionsRisk, 10);
    score += scoreItem(!tooShort, 5);
    score = Math.max(0, Math.min(100, score));

    var findings = [];
    if (!hasTask) findings.push({ severity: 'warn', title: '缺少原始任务', detail: '没有原始任务时，只能做弱评估。' });
    if (!hasOutput) findings.push({ severity: 'fail', title: '缺少 AI 输出', detail: '请粘贴需要评估的 AI 输出。' });
    if (requirements.length && coveredCount < requirements.length) findings.push({ severity: 'warn', title: '需求覆盖不完整', detail: '有 ' + (requirements.length - coveredCount) + ' 条需求未明显覆盖。' });
    if (!mentionsEvidence) findings.push({ severity: 'fail', title: '缺少验证证据', detail: '输出中没有明显测试、构建、部署或验证结果。' });
    if (!mentionsRisk) findings.push({ severity: 'warn', title: '缺少风险说明', detail: '建议说明未测试项、限制或剩余风险。' });
    if (!mentionsFiles) findings.push({ severity: 'info', title: '缺少文件引用', detail: '如果是代码/文档任务，建议列出关键文件路径。' });
    if (tooShort) findings.push({ severity: 'warn', title: '输出过短', detail: '输出可能缺少关键上下文、证据或后续步骤。' });
    if (!findings.length) findings.push({ severity: 'pass', title: '结构较完整', detail: '输出包含任务动作、验证证据、风险说明和文件线索。' });

    var verdict = score >= 80 ? 'pass' : score >= 55 ? 'review' : 'fail';
    var summary = verdict === 'pass' ? '基本可接受' : verdict === 'review' ? '建议复核后再采纳' : '不建议直接采纳';

    // 中文注释：这是本地启发式评估，不声明事实真假；它只提示输出是否具备可执行与可验证结构。
    // 中文注释：中文需求通常没有空格分词，因此用归一化文本 + 短片段命中做保守匹配，避免“一行中文需求”全部误判未覆盖。
    return { score: score, verdict: verdict, summary: summary, requirements: covered, findings: findings };
  }

  function formatReport(result) {
    var lines = ['# AI Output Evaluation', '', '- 评分：' + result.score + '/100', '- 结论：' + result.summary, '- 说明：本报告为本地启发式结构评估，不替代人工事实核验。', ''];
    lines.push('## 发现', '');
    result.findings.forEach(function (item) { lines.push('- **' + item.title + '**（' + item.severity + '）：' + item.detail); });
    if (result.requirements.length) {
      lines.push('', '## 需求覆盖', '');
      result.requirements.forEach(function (item) { lines.push('- [' + (item.covered ? 'x' : ' ') + '] ' + item.requirement); });
    }
    return lines.join('\n');
  }

  OutputEvaluator.evaluateOutput = evaluateOutput;
  OutputEvaluator.formatReport = formatReport;
})(OutputEvaluator || (OutputEvaluator = {}));
