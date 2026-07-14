(function () {
  'use strict';

  var state = { result: null, view: 'combined' };
  var E = {
    title: document.querySelector('#brief-title'),
    projectType: document.querySelector('#project-type'),
    targetAgent: document.querySelector('#target-agent'),
    goal: document.querySelector('#goal'),
    context: document.querySelector('#context'),
    constraints: document.querySelector('#constraints'),
    deliverables: document.querySelector('#deliverables'),
    doneCriteria: document.querySelector('#done-criteria'),
    testCommands: document.querySelector('#test-commands'),
    outOfScope: document.querySelector('#out-of-scope'),
    generate: document.querySelector('#generate-brief'),
    clear: document.querySelector('#clear-brief'),
    status: document.querySelector('#brief-status'),
    copy: document.querySelector('#copy-output'),
    download: document.querySelector('#download-output'),
    output: document.querySelector('#brief-output'),
    tabs: document.querySelectorAll('[data-view]'),
  };

  function setStatus(text, tone) {
    E.status.textContent = text;
    E.status.classList.toggle('ok', tone === 'ok');
    E.status.classList.toggle('err', tone === 'error');
  }

  function collectInput() {
    return {
      title: E.title.value,
      projectType: E.projectType.value,
      targetAgent: E.targetAgent.value,
      goal: E.goal.value,
      context: E.context.value,
      constraints: E.constraints.value,
      deliverables: E.deliverables.value,
      doneCriteria: E.doneCriteria.value,
      testCommands: E.testCommands.value,
      outOfScope: E.outOfScope.value,
    };
  }

  function currentText() {
    if (!state.result) return '';
    return state.result[state.view] || state.result.combined;
  }

  function downloadName() {
    var names = { agentsMd: 'AGENTS.md', claudeMd: 'CLAUDE.md', cursorRules: 'cursor-rules.md', issue: 'agent-issue.md', rules: 'agent-rules.md', brief: 'agent-brief.md', combined: 'agent-task-pack.md' };
    return names[state.view] || 'agent-brief.md';
  }

  function render() {
    var text = currentText();
    E.output.textContent = text || '生成后会显示 Agent 可执行任务包。';
    E.copy.disabled = !text;
    E.download.disabled = !text;
  }

  function downloadText(text, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  E.generate.addEventListener('click', function () {
    var input = collectInput();
    if (!input.goal.trim()) { setStatus('请先填写任务目标。', 'error'); return; }
    state.result = AgentBrief.buildAgentBrief(input);
    state.view = 'combined';
    E.tabs.forEach(function (tab) { tab.classList.toggle('active', tab.dataset.view === state.view); });
    render();
    setStatus('已生成 Agent 任务包。', 'ok');
  });

  E.clear.addEventListener('click', function () {
    E.goal.value = ''; E.context.value = ''; E.constraints.value = ''; E.deliverables.value = ''; E.doneCriteria.value = ''; E.testCommands.value = ''; E.outOfScope.value = '';
    state.result = null;
    render();
    setStatus('等待输入任务。');
  });

  E.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.view = tab.dataset.view;
      E.tabs.forEach(function (item) { item.classList.toggle('active', item === tab); });
      render();
    });
  });

  E.copy.addEventListener('click', async function () {
    var text = currentText();
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setStatus('已复制当前内容。', 'ok'); }
    catch { setStatus('复制失败，请改用下载。', 'error'); }
  });

  E.download.addEventListener('click', function () {
    var text = currentText();
    if (!text) return;
    downloadText(text, downloadName());
  });
})();
