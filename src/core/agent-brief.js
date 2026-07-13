var AgentBrief;
(function (AgentBrief) {
  'use strict';

  var PROJECT_PRESETS = {
    web: { label: 'Web / 前端', tests: ['运行静态检查或构建命令', '检查关键页面可访问', '验证移动端基础布局'], risks: ['不要引入无必要依赖', '不要削弱 CSP 或隐私边界'] },
    worker: { label: 'Cloudflare Worker', tests: ['运行 npm test', '运行 npm run check:static', '运行 npm run verify:domain'], risks: ['不要硬编码 secret', '不要在 Worker 中保存请求级全局状态'] },
    docs: { label: '文档 / PRD', tests: ['检查术语一致性', '检查是否有验收标准', '检查是否包含维护说明'], risks: ['不要把过时结论当成当前决策', '不要写无法验证的承诺'] },
    code: { label: '通用代码库', tests: ['运行单元测试', '运行 lint/typecheck（如存在）', '检查核心路径回归'], risks: ['不要修 unrelated bug', '不要大范围重构无关代码'] },
  };

  function text(value) { return String(value || '').trim(); }
  function lines(value) { return text(value).split('\n').map(function (line) { return line.trim(); }).filter(Boolean); }
  function bullet(items) { return items.map(function (item) { return '- ' + item; }).join('\n'); }
  function numbered(items) { return items.map(function (item, index) { return (index + 1) + '. ' + item; }).join('\n'); }

  function normalizeInput(input) {
    var source = input || {};
    return {
      title: text(source.title) || '未命名 Agent 任务',
      goal: text(source.goal),
      projectType: PROJECT_PRESETS[source.projectType] ? source.projectType : 'code',
      context: text(source.context),
      constraints: lines(source.constraints),
      deliverables: lines(source.deliverables),
      doneCriteria: lines(source.doneCriteria),
      testCommands: lines(source.testCommands),
      outOfScope: lines(source.outOfScope),
      targetAgent: text(source.targetAgent) || '通用 Agent',
    };
  }

  function inferDeliverables(input) {
    if (input.deliverables.length) return input.deliverables;
    return ['完成必要代码或文档改动', '更新相关说明或使用文档', '提供验证结果和剩余风险'];
  }

  function inferDoneCriteria(input, preset) {
    if (input.doneCriteria.length) return input.doneCriteria;
    return ['目标需求已完整覆盖', '核心路径有明确验证证据', '没有引入与任务无关的行为变化', '最终说明包含变更文件、验证命令和风险'];
  }

  function inferTestCommands(input, preset) {
    if (input.testCommands.length) return input.testCommands;
    return preset.tests;
  }

  function inferConstraints(input, preset) {
    var defaults = ['优先小步、可回滚改动', '先读现有代码和文档，再修改', '不凭空假设外部状态'];
    return defaults.concat(input.constraints).concat(preset.risks);
  }

  function buildAgentBrief(rawInput) {
    var input = normalizeInput(rawInput);
    var preset = PROJECT_PRESETS[input.projectType];
    var deliverables = inferDeliverables(input);
    var doneCriteria = inferDoneCriteria(input, preset);
    var testCommands = inferTestCommands(input, preset);
    var constraints = inferConstraints(input, preset);
    var outOfScope = input.outOfScope.length ? input.outOfScope : ['不要扩展到未要求的平台或后端能力', '不要引入需要用户额外配置的依赖'];

    var brief = [
      '# Agent Brief: ' + input.title,
      '',
      '## 目标',
      input.goal || '请先根据上下文确认目标，并在缺信息时列出假设。',
      '',
      '## 项目类型',
      preset.label + ' / 目标 Agent：' + input.targetAgent,
      '',
      '## 上下文',
      input.context || '暂无额外上下文。执行前应先阅读当前仓库相关文件。',
      '',
      '## 约束',
      bullet(constraints),
      '',
      '## 交付物',
      bullet(deliverables),
      '',
      '## 执行步骤建议',
      numbered(['审计当前文件和文档，确认真实状态', '定位最小可行改动范围', '实现改动并保持核心逻辑可测试', '运行验证命令并读取结果', '整理最终说明和剩余风险']),
      '',
      '## 验收标准',
      bullet(doneCriteria),
      '',
      '## 建议验证命令',
      bullet(testCommands.map(function (cmd) { return '`' + cmd + '`'; })),
      '',
      '## 不做事项',
      bullet(outOfScope),
      ''
    ].join('\n');

    var rules = [
      '# Agent Rules Snippet',
      '',
      '- Work from current repository evidence, not memory.',
      '- Keep changes minimal, reversible, and aligned with the stated goal.',
      '- Do not introduce new dependencies unless explicitly justified.',
      '- Verify with the listed commands before claiming completion.',
      '- Report changed files, validation evidence, and known risks.',
      ''
    ].join('\n');

    var issue = [
      '## Issue: ' + input.title,
      '',
      '### Problem',
      input.goal || '待补充目标。',
      '',
      '### Acceptance Criteria',
      bullet(doneCriteria),
      '',
      '### Validation',
      bullet(testCommands.map(function (cmd) { return '`' + cmd + '`'; })),
      ''
    ].join('\n');

    // 中文注释：这里生成的是可执行任务资产，而不是普通 prompt，避免回到同质化 Prompt 模板库。
    return { input: input, brief: brief, rules: rules, issue: issue, combined: brief + '\n---\n\n' + rules + '\n---\n\n' + issue };
  }

  AgentBrief.normalizeInput = normalizeInput;
  AgentBrief.buildAgentBrief = buildAgentBrief;
})(AgentBrief || (AgentBrief = {}));
