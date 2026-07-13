(function () {
  'use strict';
  var state = { result: null, report: '' };
  var E = { task: document.querySelector('#task'), requirements: document.querySelector('#requirements'), output: document.querySelector('#output'), run: document.querySelector('#run-eval'), clear: document.querySelector('#clear-eval'), status: document.querySelector('#eval-status'), score: document.querySelector('#score'), verdict: document.querySelector('#verdict'), findings: document.querySelector('#findings'), report: document.querySelector('#report'), copy: document.querySelector('#copy-report'), download: document.querySelector('#download-report') };
  function setStatus(text, tone) { E.status.textContent = text; E.status.classList.toggle('ok', tone === 'ok'); E.status.classList.toggle('err', tone === 'error'); }
  function esc(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function render(result) {
    state.result = result;
    state.report = result ? OutputEvaluator.formatReport(result) : '';
    E.score.textContent = result ? result.score : '0';
    E.verdict.textContent = result ? result.summary : '未评估';
    E.findings.innerHTML = result ? result.findings.map(function (item) { return '<div class="finding finding-' + esc(item.severity) + '"><strong>' + esc(item.title) + '</strong><div>' + esc(item.detail) + '</div></div>'; }).join('') : '评估后显示发现项。';
    E.report.textContent = state.report || '暂无报告。';
    E.copy.disabled = !state.report;
    E.download.disabled = !state.report;
  }
  function downloadText(text, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); }
  E.run.addEventListener('click', function () { if (!E.output.value.trim()) { setStatus('请先粘贴 AI 输出。', 'error'); return; } var result = OutputEvaluator.evaluateOutput({ task: E.task.value, requirements: E.requirements.value, output: E.output.value }); render(result); setStatus('已完成本地结构评估。', result.verdict === 'fail' ? 'error' : 'ok'); });
  E.clear.addEventListener('click', function () { E.task.value = ''; E.requirements.value = ''; E.output.value = ''; render(null); setStatus('等待输入。'); });
  E.copy.addEventListener('click', async function () { try { await navigator.clipboard.writeText(state.report); setStatus('已复制报告。', 'ok'); } catch { setStatus('复制失败，请改用下载。', 'error'); } });
  E.download.addEventListener('click', function () { if (state.report) downloadText(state.report, 'ai-output-evaluation.md'); });
})();
