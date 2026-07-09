/* core/convert-app.js — Converter UI orchestrator */
(function () {
  'use strict';

  var tabs = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
      panels.forEach(function (p) { p.setAttribute('aria-hidden', 'true'); });
      btn.setAttribute('aria-selected', 'true');
      var target = document.getElementById(btn.getAttribute('aria-controls'));
      if (target) target.setAttribute('aria-hidden', 'false');
    });
  });

  var state = { format: 'sub2api', sessions: [], converted: [], skipped: [], report: null, outputText: '' };
  var dlMode = 'single';
  var FORMATS = { sub2api: 'sub2api', cpa: 'CPA', cockpit: 'Cockpit', '9router': '9router', codexAuth: 'Codex auth.json', axonHub: 'AxonHub', codexManager: 'Codex-Manager' };

  var E = {
    downloadOptions: document.querySelector('#download-options'),
    dlCount: document.querySelector('#dl-count'),
    dlPills: document.querySelectorAll('[data-dl]'),
    dlSingle: document.querySelector('[data-dl="single"]'),
    dlMulti: document.querySelector('[data-dl="multi"]'),

    input: document.querySelector('#session-input'),
    inputStatus: document.querySelector('#input-status'),
    output: document.querySelector('#output'),
    outputStatus: document.querySelector('#output-status'),
    outputSubtitle: document.querySelector('#output-subtitle'),
    statCount: document.querySelector('#stat-count'),
    statErrors: document.querySelector('#stat-errors'),
    statFormat: document.querySelector('#stat-format'),
    accountBody: document.querySelector('#account-body'),
    accountWrap: document.querySelector('#account-table-wrap'),
    issues: document.querySelector('#issues'),
    notice: document.querySelector('#cpa-notice'),
    copy: document.querySelector('#copy-output'),
    download: document.querySelector('#download-output'),
    progressWrap: document.querySelector('#progress-wrap'),
    progressFill: document.querySelector('#progress-fill'),
    progressText: document.querySelector('#progress-text'),
    outputPreview: document.querySelector('#output-preview'),
    outputToggle: document.querySelector('#output-toggle'),
  };

  function showProgress(pct, status) { E.progressWrap.classList.add('show'); E.progressFill.style.width = pct + '%'; E.progressText.textContent = status || ''; }
  function hideProgress() { E.progressWrap.classList.remove('show'); E.progressFill.style.width = '0%'; E.progressText.textContent = ''; }

  /* ── Parser: Worker preferred, inline fallback for file:// ── */
  var USE_WORKER = true;
  var worker = null, workerPending = null, workerSeq = 0;

  function getWorker() {
    if (!worker) {
      try {
        worker = new Worker('./core/worker.js');
        worker._started = true;
        USE_WORKER = true;
        worker.onmessage = function (e) {
          var d = e.data;
          if (!workerPending || d.requestId !== workerPending.requestId) return;
          if (d.type === 'progress') { showProgress(d.pct, d.status); }
          else if (d.type === 'result-parse') { hideProgress(); workerPending.resolve(d.payload); workerPending = null; }
          else { hideProgress(); workerPending.reject(new Error(d.error)); workerPending = null; }
        };
        worker.onerror = function () {
          /* Worker failed (e.g. file://) — retry inline */
          USE_WORKER = false;
          worker = null;
          hideProgress();
          var p = workerPending;
          workerPending = null;
          if (p) runInline(p.text, p.sourceName, p.resolve, p.reject);
        };
      } catch (e) {
        /* file:// protocol — Worker not supported, use inline parsing */
        USE_WORKER = false;
      }
    }
    return worker;
  }

  function parseInWorker(text, sourceName) {
    return new Promise(function (resolve, reject) {
      var requestId = ++workerSeq;
      workerPending = { requestId: requestId, resolve: resolve, reject: reject, text: text, sourceName: sourceName };
      getWorker();
      if (USE_WORKER && worker) {
        worker.postMessage({ type: 'parse-sessions', requestId: requestId, payload: { text: text, sourceName: sourceName } });
      } else {
        runInline(text, sourceName, resolve, reject);
      }
    });
  }

  function runInline(text, sourceName, resolve, reject) {
    showProgress(0, '解析 JSON...');
    setTimeout(function () {
      try {
        var result = parseSessionsInline(text, sourceName);
        hideProgress();
        resolve(result);
      } catch (err) {
        hideProgress();
        reject(err);
      }
    }, 50);
  }

  function parseSessionsInline(text, sourceName) {
    return FlowPilotConverter.parseSessionPayload(text, {
      sourceName: sourceName,
      now: new Date(),
      onProgress: showProgress,
    });
  }

  /* ── Download mode toggle ── */
  ;(function initDlMode() {
    if (!E.dlPills || !E.dlPills.length) return;
    Array.from(E.dlPills).forEach(function (btn) {
      btn.addEventListener("click", function () {
        Array.from(E.dlPills).forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        dlMode = btn.getAttribute("data-dl");
      });
    });
  })();


  /* ── Format switching ── */
  document.querySelectorAll('[data-format]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-format]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      state.format = btn.getAttribute('data-format');
      updateOutput();
    });
  });

  function buildOutput() {
    var c = state.converted, f = state.format;
    switch (f) {
      case 'cpa':       { var r = c.map(function (x) { return x.cpa; }); return r.length === 1 ? r[0] : { accounts: r, generatedAt: new Date().toISOString() }; }
      case 'cockpit':   { var r = c.map(function (x) { return x.cockpit; }); return r.length === 1 ? r[0] : { accounts: r, generatedAt: new Date().toISOString() }; }
      case 'codexAuth': return c.length === 1 ? c[0].codexAuth : { tokens: c.map(function (x) { return x.codexAuth.tokens; }), generatedAt: new Date().toISOString() };
      case 'axonHub':   return c.length === 1 ? c[0].axonHubAuth : { accounts: c.map(function (x) { return x.axonHubAuth; }), generatedAt: new Date().toISOString() };
      case 'codexManager': return { accounts: c.map(function (x) { return x.codexManagerAccount; }), generatedAt: new Date().toISOString() };
      case '9router':   { var r = c.map(function (x) { return x.nineRouterAccount || x.sub2apiAccount; }); return r.length === 1 ? r[0] : r; }
      default:          { var r = c.map(function (x) { return x.sub2apiAccount; }); return r.length === 1 ? r[0] : r; }
    }
  }

  var esc = function (v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var fmt = function (v) { if (!v) return ''; var d = new Date(v); if (Number.isNaN(d.getTime())) return v; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  var st = function (el, text, tone) { if (!el) return; el.textContent = text; el.classList.toggle('ok', tone==='ok'); el.classList.toggle('err', tone==='error'); };
  var dl = function (text, name) { if (!text) return; var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); };

  function updateOutput() {
    var has = state.converted.length > 0;
    state.outputText = has ? JSON.stringify(buildOutput(), null, 2) : '';
    E.output.value = state.outputText;
    E.copy.disabled = !has; E.download.disabled = !has;
    E.statCount.textContent = String(state.converted.length);
    E.statErrors.textContent = String(state.skipped.length);
    var label = FORMATS[state.format] || state.format;
    E.statFormat.textContent = label;
        if (E.downloadOptions) {
          var showDl = has && state.converted.length > 1;
          E.downloadOptions.classList.toggle("hidden", !showDl);
          if (E.dlCount && showDl) E.dlCount.textContent = state.converted.length + ' 个账号';
        }
    if (E.outputSubtitle) E.outputSubtitle.textContent = '当前输出为 ' + label + ' 导入 JSON。';
    E.notice.classList.toggle('show', state.format === 'cpa' || state.format === 'cockpit' || state.format === 'codexAuth' || state.format === 'axonHub' || state.format === 'codexManager');
    renderAccounts(); renderIssues(); renderPreview(state.outputText);
    st(E.outputStatus, has ? '已生成 ' + state.converted.length + ' 个账号。' : '暂无输出。', has ? 'ok' : (state.skipped.length ? 'error' : ''));
  }

  function renderAccounts() {
    var items = state.converted;
    if (!items.length) { E.accountBody.innerHTML = '<tr><td colspan="4" class="empty-msg">暂无可转换账号。</td></tr>'; E.accountWrap.style.maxHeight = ''; E.accountWrap.style.overflowY = ''; return; }
    E.accountBody.innerHTML = items.map(function (item) { return '<tr><td><div class="cell-ell" title="' + esc(item.name) + '">' + esc(item.name||'-') + '</div></td><td><div class="cell-ell" title="' + esc(item.email) + '">' + esc(item.email||'-') + '</div></td><td><div class="cell-ell" title="' + esc(item.expiresAt) + '">' + esc(fmt(item.expiresAt)||'-') + '</div></td><td><div class="cell-ell" title="' + esc(item.sourceType) + '">' + esc(item.sourceType||'-') + '</div></td></tr>'; }).join('');
    E.accountWrap.style.maxHeight = Math.min(items.length * 38, 360) + 'px';
    E.accountWrap.style.overflowY = 'auto';
  }

  function renderIssues() {
    var report = state.report;
    var messages = [];
    if (report && report.total) {
      if (report.missingRefreshToken) messages.push('缺少 refresh_token：' + report.missingRefreshToken + ' 个（部分目标格式会保留空值或占位值）');
      if (report.syntheticIdToken) messages.push('合成 id_token：' + report.syntheticIdToken + ' 个');
      if (report.missingExpiresAt) messages.push('缺少 expiresAt：' + report.missingExpiresAt + ' 个');
      if (report.missingAccountId) messages.push('缺少 accountId：' + report.missingAccountId + ' 个');
    }
    state.skipped.forEach(function (s) { messages.push(esc(s.sourceName||'input') + ' ' + esc(s.path||'') + ': ' + esc(s.reason)); });
    if (!messages.length) { E.issues.classList.remove('show'); E.issues.textContent = ''; return; }
    E.issues.classList.add('show');
    E.issues.innerHTML = messages.map(function (message) { return '<div>' + message + '</div>'; }).join('');
  }

  function renderPreview(text) {
    if (!text) { E.outputPreview.textContent = '转换后会显示 JSON。'; E.outputToggle.classList.add('hidden'); return; }
    E.outputPreview.textContent = text.length > 2000 ? text.slice(0, 2000) + '\n... (截断)' : text;
    E.outputPreview.classList.add('collapsed');
    E.outputToggle.classList.remove('hidden');
  }
  E.outputToggle.addEventListener('click', function () { var c = E.outputPreview.classList.toggle('collapsed'); E.outputToggle.textContent = c ? '展开完整 JSON' : '收起'; });

  var ct = null;
  E.input.addEventListener('input', function () { clearTimeout(ct); ct = setTimeout(convert, 400); });
  E.input.addEventListener('dragover', function (e) { e.preventDefault(); });
  E.input.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer.files.length) { readFiles(e.dataTransfer.files); }
    else { var t = e.dataTransfer.getData('text'); if (t) { E.input.value = t; convert(); } }
  });

  async function convert() {
    var text = E.input.value;
    if (!text.trim()) { state.converted = []; state.skipped = []; state.sessions = []; state.report = null; updateOutput(); st(E.inputStatus, '等待输入。'); return; }
    st(E.inputStatus, '正在解析...');
    try {
      var r = await parseInWorker(text, 'pasted-json');
      state.converted = r.converted; state.skipped = r.skipped; state.sessions = r.found; state.report = r.report || FlowPilotConverter.buildSessionCompatibilityReport(r.converted, r.skipped); updateOutput();
      st(E.inputStatus, r.converted.length ? '解析完成：' + r.converted.length + ' 个账号，跳过 ' + r.skipped.length + ' 项。' : '没有可转换账号。', r.converted.length ? 'ok' : 'error');
    } catch (err) { state.converted = []; state.skipped = [{ sourceName: 'pasted-json', path: '$', reason: err.message }]; state.report = null; state.outputText = ''; updateOutput(); st(E.inputStatus, err.message, 'error'); }
  }

  document.querySelector('#pick-files').addEventListener('click', function () { document.querySelector('#file-input').click(); });
  document.querySelector('#file-input').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });
  document.querySelector('#pick-folder').addEventListener('click', function () { document.querySelector('#folder-input').click(); });
  document.querySelector('#folder-input').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });

  async function readFiles(files) {
    var jf = Array.from(files).filter(function (f) { return f.name.toLowerCase().endsWith('.json'); });
    if (!jf.length) { st(E.inputStatus, '没有选择 JSON 文件。', 'error'); return; }
    showProgress(5, '读取文件...');
    state.skipped = []; var all = [];
    for (var i = 0; i < jf.length; i++) {
      var file = jf[i];
      showProgress(5 + Math.round(i / jf.length * 25), '读取 ' + file.name + '...');
      try { var r = await parseInWorker(await file.text(), file.name); all.push.apply(all, r.converted); state.skipped.push.apply(state.skipped, r.skipped.map(function (s) { return Object.assign({}, s, { sourceName: file.name }); })); }
      catch (err) { state.skipped.push({ sourceName: file.name, path: '$', reason: err.message }); }
    }
    state.converted = all; state.sessions = all; updateOutput(); hideProgress();
    st(E.inputStatus, all.length ? '文件解析完成：' + all.length + ' 个账号，跳过 ' + state.skipped.length + ' 项。' : '文件未找到可转换账号。', all.length ? 'ok' : 'error');
  }

  document.querySelector('#clear-input').addEventListener('click', function () { E.input.value = ''; state.converted = []; state.skipped = []; state.sessions = []; updateOutput(); st(E.inputStatus, '等待输入。'); });

  document.querySelector('#load-example').addEventListener('click', function () {
    E.input.value = JSON.stringify({ user: { id: 'user-example', email: 'mark@example.com' }, expires: '2026-08-06T14:29:36.155Z', account: { id: '00000000-0000-4000-9000-000000000000', planType: 'plus' }, accessToken: 'paste-real-access-token-here', sessionToken: 'paste-real-session-token-here', authProvider: 'openai' }, null, 2);
    convert();
  });

  document.querySelector('#copy-output').addEventListener('click', async function () {
    try { await navigator.clipboard.writeText(state.outputText); st(E.outputStatus, '已复制到剪贴板。', 'ok'); }
    catch { st(E.outputStatus, '复制失败。', 'error'); }
  });
  function buildSingle(item) {
    var f = state.format;
    switch (f) {
      case "cpa": return item.cpa;
      case "cockpit": return item.cockpit;
      case "codexAuth": return item.codexAuth;
      case "axonHub": return item.axonHubAuth;
      case "codexManager": return item.codexManagerAccount;
      case "9router": return item.nineRouterAccount || item.sub2apiAccount;
      default: return item.sub2apiAccount;
    }
  }

  document.querySelector("#download-output").addEventListener("click", function () {
    if (dlMode === "multi" && state.converted.length > 1) {
      /* per-file download */
      state.converted.forEach(function (item, idx) {
        var single = JSON.stringify(buildSingle(item), null, 2);
        var safe = "account_" + String(idx + 1).padStart(2, "0");
        setTimeout(function () { dl(single, safe + "_" + state.format + ".json"); }, idx * 300);
      });
    } else {
      /* single file download (default) */
      dl(state.outputText, "chatgpt_session" + (state.format === "codexAuth" ? "_auth" : "_" + state.format) + ".json");
    }
  });

  var conv = { records: [], skipped: [] };
  var C = {
    pick: document.querySelector('#pick-converter-files'), input: document.querySelector('#converter-file-input'),
    clear: document.querySelector('#clear-converter'), download: document.querySelector('#download-converted'),
    preview: document.querySelector('#converter-preview'), status: document.querySelector('#converter-status'),
  };
  C.pick.addEventListener('click', function () { C.input.click(); });
  C.input.addEventListener('change', function (e) { readConvFiles(e.target.files); e.target.value = ''; });
  C.clear.addEventListener('click', function () { conv.records = []; conv.skipped = []; C.input.value = ''; C.preview.innerHTML = ''; st(C.status, '等待选择文件。'); });
  C.download.addEventListener('click', function () {
    if (!conv.records.length) return;
    conv.records.forEach(function (item) { dl(FlowPilotConverter.formatJson(item.payload), (item.sourceName.replace(/\.\w+$/, '') || 'converted').replace(/[^a-zA-Z0-9_.\-]/g, '_') + '_' + item.format + '.json'); });
  });

  async function readConvFiles(files) {
    var jf = Array.from(files).filter(function (f) { return f.name.toLowerCase().endsWith('.json'); });
    if (!jf.length) { st(C.status, '没有选择 JSON 文件。', 'error'); return; }
    conv.records = []; conv.skipped = [];
    for (var i = 0; i < jf.length; i++) {
      var file = jf[i];
      try {
        var p = JSON.parse(await file.text());
        var d = FlowPilotConverter.detectFormat(p);
        if (d === 'cpa') conv.records.push({ sourceName: file.name, format: 'sub', payload: FlowPilotConverter.convertCpaPayload(p, { mode: 'lossless', sourceName: file.name, now: new Date() }) });
        else if (d === 'sub') conv.records.push({ sourceName: file.name, format: 'cpa', payload: FlowPilotConverter.convertSubPayload(p, { mode: 'lossless', sourceName: file.name, now: new Date() }) });
        else conv.skipped.push({ sourceName: file.name, reason: '未识别的格式（仅支持 CPA / sub2api）' });
      } catch (err) { conv.skipped.push({ sourceName: file.name, reason: err.message || '无法读取文件' }); }
    }
    var totalAccounts = 0;
    conv.records.forEach(function(r) { totalAccounts += FlowPilotConverter.countAccountsInResult(r.payload) || 1; });
    C.preview.innerHTML = '<div><strong>已选文件：</strong>' + (conv.records.length + conv.skipped.length) + ' 个</div><div><strong>转换成功：</strong>' + totalAccounts + ' 个账号（' + conv.records.length + ' 个文件）</div><div><strong>跳过：</strong>' + conv.skipped.length + ' 条</div>';
    if (conv.skipped.length) {
      C.preview.innerHTML += '<details style="margin-top:8px;background:#fff8e1;border:1px solid #f2c94c;border-radius:6px;padding:8px 10px;color:#5a3a00;font-size:13px"><summary>跳过详情</summary><ul>' + conv.skipped.map(function (s) { return '<li><strong>' + esc(s.sourceName) + '</strong>: ' + esc(s.reason) + '</li>'; }).join('') + '</ul></details>';
    }
    st(C.status, conv.records.length ? '已完成转换：' + totalAccounts + ' 个账号。' : '没有可转换账号。', conv.records.length ? 'ok' : 'error');
  }


  /* ── QQ Group copy (delegated) ── */
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.banner-qq-copy');
    if (!btn) return;
    navigator.clipboard.writeText('1079544259').then(function() {
      btn.textContent = '已复制!';
      setTimeout(function() { btn.textContent = '复制群号'; }, 2000);
    }).catch(function() {
      btn.textContent = '复制失败';
      setTimeout(function() { btn.textContent = '复制群号'; }, 2000);
    });
  });

})();
