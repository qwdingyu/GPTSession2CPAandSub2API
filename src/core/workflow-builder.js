var WorkflowBuilder;
(function (WorkflowBuilder) {
  'use strict';

  var DOMAIN_PRESETS = {
    code: { label: '代码 / 工程任务', gates: ['需求覆盖检查', '测试或构建通过', '变更文件清单完整', '剩余风险已说明'], outputs: ['执行计划', '验收清单', '验证命令', '交接说明'] },
    docs: { label: '文档 / PRD 任务', gates: ['术语一致', '结论可追溯', '验收标准明确', '维护边界清楚'], outputs: ['结构化大纲', '决策记录', '验收标准', '后续维护说明'] },
    ops: { label: '部署 / 运维任务', gates: ['凭据不落库不入日志', '自动化脚本可重复执行', '生产域名或健康检查通过', '回滚路径明确'], outputs: ['部署步骤', '预检清单', '验证命令', '回滚说明'] },
    research: { label: '调研 / 选型任务', gates: ['来源可核验', '候选项可比较', '结论与约束对应', '不确定性已标注'], outputs: ['候选列表', '对比矩阵', '推荐结论', '风险与假设'] },
  };

  function text(value) { return String(value || '').trim(); }
  function lines(value) { return text(value).split('\n').map(function (line) { return line.replace(/^[-*\d.、)）\s]+/, '').trim(); }).filter(Boolean); }
  function bullet(items) { return items.map(function (item) { return '- ' + item; }).join('\n'); }
  function numbered(items) { return items.map(function (item, index) { return (index + 1) + '. ' + item; }).join('\n'); }
  function unique(items) { return items.filter(function (item, index) { return item && items.indexOf(item) === index; }); }

  function normalizeInput(rawInput) {
    var source = rawInput || {};
    return {
      title: text(source.title) || '未命名工作流',
      request: text(source.request),
      domain: DOMAIN_PRESETS[source.domain] ? source.domain : 'code',
      trigger: text(source.trigger),
      inputs: lines(source.inputs),
      constraints: lines(source.constraints),
      outputs: lines(source.outputs),
      gates: lines(source.gates),
      reuseTarget: text(source.reuseTarget) || 'Codex / Claude Code / Cursor / Cline 等 Agent',
    };
  }

  function inferTrigger(input) {
    if (input.trigger) return input.trigger;
    return '当用户给出“' + input.title + '”相关需求，且需要可重复执行流程而不是一次性回答时触发。';
  }

  function inferInputs(input) {
    var defaults = ['原始需求或问题描述', '相关上下文、文件路径、约束和验收标准'];
    if (input.domain === 'ops') defaults.push('目标环境、部署入口、生产域名或健康检查地址');
    if (input.domain === 'research') defaults.push('候选项目、评价维度、时间范围和可靠来源要求');
    return unique(input.inputs.concat(defaults));
  }

  function inferSteps(input) {
    var base = ['澄清目标、边界和不可做事项', '读取或整理现有上下文，列出已知事实与假设', '把需求拆成可验证的阶段和交付物', '逐步执行最小可行改动或分析', '运行质量门禁并记录证据', '输出结论、文件清单、验证结果和剩余风险'];
    if (input.domain === 'research') base.splice(3, 1, '按统一维度收集候选项证据并做对比');
    if (input.domain === 'ops') base.splice(3, 1, '先做预检，再执行部署或配置变更，失败时走回滚路径');
    if (input.domain === 'docs') base.splice(3, 1, '先形成信息架构，再写正文和维护说明');
    return base;
  }

  function inferOutputs(input, preset) {
    return unique(input.outputs.concat(preset.outputs));
  }

  function inferGates(input, preset) {
    var defaults = ['不得凭空编造外部状态', '最终输出必须区分已验证事实、推断和未验证风险'];
    return unique(input.gates.concat(preset.gates).concat(defaults));
  }

  function buildWorkflow(rawInput) {
    var input = normalizeInput(rawInput);
    var preset = DOMAIN_PRESETS[input.domain];
    var trigger = inferTrigger(input);
    var workflowInputs = inferInputs(input);
    var steps = inferSteps(input);
    var outputs = inferOutputs(input, preset);
    var gates = inferGates(input, preset);
    var constraints = input.constraints.length ? input.constraints : ['优先本地处理和最小依赖', '保持过程可复核、结果可验证', '不要扩大到未要求的系统或平台'];

    var workflow = [
      '# Workflow: ' + input.title,
      '',
      '## 适用场景',
      preset.label + ' / 复用目标：' + input.reuseTarget,
      '',
      '## 原始需求',
      input.request || '请填写原始需求。',
      '',
      '## 触发条件',
      trigger,
      '',
      '## 输入',
      bullet(workflowInputs),
      '',
      '## 约束',
      bullet(constraints),
      '',
      '## 执行流程',
      numbered(steps),
      '',
      '## 输出物',
      bullet(outputs),
      '',
      '## 质量门禁',
      bullet(gates),
      ''
    ].join('\n');

    var checklist = [
      '# Workflow Checklist: ' + input.title,
      '',
      '## 执行前',
      '- [ ] 原始需求、边界和验收标准已记录',
      '- [ ] 必要上下文已读取或打包',
      '- [ ] 风险、权限和不可做事项已明确',
      '',
      '## 执行中',
      steps.map(function (step) { return '- [ ] ' + step; }).join('\n'),
      '',
      '## 交付前',
      gates.map(function (gate) { return '- [ ] ' + gate; }).join('\n'),
      ''
    ].join('\n');

    var skillDraft = [
      '# Skill Draft: ' + input.title,
      '',
      '## When to use',
      trigger,
      '',
      '## Instructions',
      numbered(steps),
      '',
      '## Required outputs',
      bullet(outputs),
      '',
      '## Verification',
      bullet(gates),
      ''
    ].join('\n');

    var combined = [workflow, '---', checklist, '---', skillDraft].join('\n\n');

    // 中文注释：该工具只把自然语言需求抽象为可复用工作流资产，不调用模型、不联网，避免把敏感项目上下文外发。
    // 中文注释：输出刻意包含质量门禁和事实/推断边界，防止 workflow 退化成普通 prompt 美化。
    return { workflow: workflow, checklist: checklist, skillDraft: skillDraft, combined: combined, trigger: trigger, inputs: workflowInputs, outputs: outputs, gates: gates };
  }

  WorkflowBuilder.normalizeInput = normalizeInput;
  WorkflowBuilder.buildWorkflow = buildWorkflow;
})(WorkflowBuilder || (WorkflowBuilder = {}));
