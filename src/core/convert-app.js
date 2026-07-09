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

  var state = { format: 'sub2api', sessions: [], converted: [], skipped: [], outputText: '' };
  var dlMode = 'single';
  var FORMATS = { sub2api: 'sub2api', cpa: 'CPA', cockpit: 'Cockpit', '9router': '9router', codexAuth: 'Codex auth.json' };

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
  var worker = null, workerPending = null;

  function getWorker() {
    if (!worker) {
      try {
        worker = new Worker('./core/worker.js');
        worker._started = true;
        USE_WORKER = true;
        worker.onmessage = function (e) {
          var d = e.data;
          if (d.type === 'progress') { showProgress(d.pct, d.status); }
          else if (d.type === 'result-parse') { hideProgress(); if (workerPending) { workerPending.resolve(d.payload); workerPending = null; } }
          else { hideProgress(); if (workerPending) { workerPending.reject(new Error(d.error)); workerPending = null; } }
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
      workerPending = { resolve: resolve, reject: reject, text: text, sourceName: sourceName };
      getWorker();
      if (USE_WORKER && worker) {
        worker.postMessage({ type: 'parse-sessions', payload: { text: text, sourceName: sourceName } });
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
    var parsed = JSON.parse(text);
    showProgress(20, '搜索 session 对象...');
    var found = [];
    var visited = new WeakSet();
    var visitCount = 0;

    function visit(item, path) {
      if (!item || typeof item !== 'object') return;
      if (visited.has(item)) return;
      visited.add(item);
      /* Yield every 5000 visits to avoid freezing on huge JSON */
      visitCount++;
      if (visitCount % 5000 === 0) {
        showProgress(20, '搜索中...已扫描 ' + visitCount + ' 个节点');
      }
      if (Array.isArray(item)) { item.forEach(function (c, i) { visit(c, path + '[' + i + ']'); }); return; }

      var token = firstNonEmpty(item.accessToken, item.access_token, item.token && item.token.accessToken, item.token && item.token.access_token, item.credentials && item.credentials.accessToken, item.credentials && item.credentials.access_token);
      var hasIdentity = FlowPilotConverter.isPlainObject(item.user) || firstNonEmpty(item.email, item.name, item.providerSpecificData && item.providerSpecificData.chatgptAccountId, item.providerSpecificData && item.providerSpecificData.chatgpt_account_id, item.id);
      if (token && hasIdentity) { found.push({ value: item, sourceName: sourceName, path: path }); return; }

      for (var key in item) {
        if (item.hasOwnProperty(key) && key !== 'accessToken' && key !== 'access_token' && key !== 'sessionToken') {
          visit(item[key], path + '.' + key);
        }
      }
    }
    visit(parsed, '$');

    showProgress(40, '转换 ' + found.length + ' 个 session...');
    var converted = [], skipped = [];

    for (var i = 0; i < found.length; i++) {
      if (i % 50 === 0) showProgress(40 + Math.round(i / found.length * 50), '转换中 ' + i + '/' + found.length + '...');
      try {
        converted.push(convertSessionInline(found[i].value, { now: new Date(), sourceName: found[i].sourceName, sourcePath: found[i].path }));
      } catch (err) {
        skipped.push({ sourceName: found[i].sourceName, path: found[i].path, reason: err.message || '无法转换' });
      }
    }
    showProgress(95, '生成输出...');
    return { converted: converted, skipped: skipped, found: found };
  }

  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
    }
    return undefined;
  }

  function convertSessionInline(record, opts) {
    if (!FlowPilotConverter.isPlainObject(record)) throw new Error('session 不是 JSON 对象');
    var accessToken = firstNonEmpty(record.accessToken, record.access_token, record.token && record.token.accessToken, record.token && record.token.access_token, record.credentials && record.credentials.accessToken, record.credentials && record.credentials.access_token);
    if (!accessToken) throw new Error('缺少 accessToken');
    var sessionToken = firstNonEmpty(record.sessionToken, record.session_token, record.token && record.token.sessionToken, record.token && record.token.session_token, record.credentials && record.credentials.session_token);
    var refreshToken = firstNonEmpty(record.refreshToken, record.refresh_token, record.token && record.token.refreshToken, record.token && record.token.refresh_token, record.credentials && record.credentials.refresh_token);
    var inputIdToken = firstNonEmpty(record.idToken, record.id_token, record.token && record.token.idToken, record.token && record.token.id_token, record.credentials && record.credentials.id_token);
    var payload = FlowPilotConverter.parseJwtPayload(accessToken);
    var idPayload = FlowPilotConverter.parseJwtPayload(inputIdToken);
    var auth = FlowPilotConverter.getOpenAIAuthSection(payload);
    var idAuth = FlowPilotConverter.getOpenAIAuthSection(idPayload);
    var profile = FlowPilotConverter.getOpenAIProfileSection(payload);
    var expiresAt = firstNonEmpty(payload ? FlowPilotConverter.timestampFromUnixSeconds(payload.exp) : undefined, FlowPilotConverter.normalizeTimestamp(record.expires), FlowPilotConverter.normalizeTimestamp(record.expiresAt), FlowPilotConverter.normalizeTimestamp(record.expired), FlowPilotConverter.normalizeTimestamp(record.expires_at));
    var email = firstNonEmpty(record.user && record.user.email, record.email, record.credentials && record.credentials.email, record.providerSpecificData && record.providerSpecificData.email, profile.email, idPayload && idPayload.email, payload && payload.email);
    var accountId = firstNonEmpty(record.account && record.account.id, record.account_id, record.chatgptAccountId, record.providerSpecificData && record.providerSpecificData.chatgptAccountId, record.providerSpecificData && record.providerSpecificData.chatgpt_account_id, record.credentials && record.credentials.chatgpt_account_id, auth.chatgpt_account_id, idAuth.chatgpt_account_id, record.provider === 'codex' ? record.id : undefined);
    var userId = firstNonEmpty(record.user && record.user.id, record.user_id, record.chatgptUserId, record.providerSpecificData && record.providerSpecificData.chatgptUserId, record.providerSpecificData && record.providerSpecificData.chatgpt_user_id, auth.chatgpt_user_id, auth.user_id, idAuth.chatgpt_user_id, idAuth.user_id);
    var planType = firstNonEmpty(record.account && record.account.planType, record.account && record.account.plan_type, record.planType, record.plan_type, record.providerSpecificData && record.providerSpecificData.chatgptPlanType, record.providerSpecificData && record.providerSpecificData.chatgpt_plan_type, record.credentials && record.credentials.plan_type, auth.chatgpt_plan_type, idAuth.chatgpt_plan_type);
    var exportedAt = FlowPilotConverter.normalizeTimestamp(opts.now || new Date());
    var sourceName = firstNonEmpty(opts.sourceName, 'pasted-json');
    var sourceType = record.provider === 'codex' && record.authType === 'oauth' ? '9router' : 'chatgpt_web_session';
    var name = firstNonEmpty(email, sourceName, 'ChatGPT Account');
    var syntheticIdToken = !inputIdToken ? buildSynthIdToken(email, accountId, planType, userId, expiresAt) : undefined;
    var idToken = firstNonEmpty(inputIdToken, syntheticIdToken);
    var cpa = objFilter({ type: 'codex', account_id: accountId, chatgpt_account_id: accountId, email: email, name: name, plan_type: planType, chatgpt_plan_type: planType, id_token: idToken, id_token_synthetic: Boolean(syntheticIdToken) || undefined, access_token: accessToken, refresh_token: refreshToken || '', session_token: sessionToken, last_refresh: exportedAt, expired: expiresAt, disabled: Boolean(record.disabled) || undefined });
    var cockpit = { type: 'codex', id_token: idToken, access_token: accessToken, refresh_token: refreshToken || '', account_id: accountId, last_refresh: exportedAt, email: email, expired: expiresAt, account_note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark) };
    var codexTokens = objFilter({ id_token: accessToken, access_token: accessToken, refresh_token: refreshToken || '', account_id: accountId });
    var codexAuth = { OPENAI_API_KEY: null, tokens: codexTokens, last_refresh: exportedAt };
    var sub2apiAccount = { name: firstNonEmpty(name, email, sourceName, 'ChatGPT Account'), platform: 'openai', type: 'oauth', concurrency: 10, priority: 1, credentials: { access_token: accessToken, chatgpt_account_id: accountId, chatgpt_user_id: userId, email: email, expires_at: expiresAt, plan_type: planType }, extra: { email: email, name: name, auth_provider: firstNonEmpty(record.authProvider, record.auth_provider), source: sourceType, last_refresh: exportedAt } };
    return { name: name, email: email, expiresAt: expiresAt, planType: planType, accountId: accountId, userId: userId, sourceName: sourceName, sourceType: sourceType, accessToken: accessToken, sessionToken: sessionToken, refreshToken: refreshToken, idToken: idToken, syntheticIdToken: Boolean(syntheticIdToken), cpa: cpa, cockpit: cockpit, codexAuth: codexAuth, sub2apiAccount: sub2apiAccount, nineRouterAccount: sub2apiAccount };
  }

  function buildSynthIdToken(email, accountId, planType, userId, expiresAt) {
    if (!accountId) return undefined;
    var now = Math.trunc(Date.now() / 1000);
    var authInfo = { chatgpt_account_id: accountId };
    var expires = epochSec(expiresAt) || now + 90 * 24 * 60 * 60;
    if (planType) authInfo.chatgpt_plan_type = planType;
    if (userId) { authInfo.chatgpt_user_id = userId; authInfo.user_id = userId; }
    var payload = { iat: now, exp: expires, 'https://api.openai.com/auth': authInfo };
    if (email) payload.email = email;
    return FlowPilotConverter.encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true }) + '.' + FlowPilotConverter.encodeBase64UrlJson(payload) + '.';
  }

  function epochSec(v) {
    var n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n > 1e11 ? n / 1000 : n);
    var p = Date.parse(String(v));
    return Number.isFinite(p) ? Math.trunc(p / 1000) : 0;
  }

  function objFilter(obj) {
    var r = {};
    for (var k in obj) { if (obj.hasOwnProperty(k) && obj[k] !== undefined && obj[k] !== null) r[k] = obj[k]; }
    return r;
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
    E.notice.classList.toggle('show', state.format === 'cpa' || state.format === 'cockpit' || state.format === 'codexAuth');
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
    if (!state.skipped.length) { E.issues.classList.remove('show'); E.issues.textContent = ''; return; }
    E.issues.classList.add('show');
    E.issues.innerHTML = state.skipped.map(function (s) { return '<div>' + esc(s.sourceName||'input') + ' ' + esc(s.path||'') + ': ' + esc(s.reason) + '</div>'; }).join('');
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
    if (!text.trim()) { state.converted = []; state.skipped = []; state.sessions = []; updateOutput(); st(E.inputStatus, '等待输入。'); return; }
    st(E.inputStatus, '正在解析...');
    try {
      var r = await parseInWorker(text, 'pasted-json');
      state.converted = r.converted; state.skipped = r.skipped; state.sessions = r.found; updateOutput();
      st(E.inputStatus, r.converted.length ? '解析完成：' + r.converted.length + ' 个账号，跳过 ' + r.skipped.length + ' 项。' : '没有可转换账号。', r.converted.length ? 'ok' : 'error');
    } catch (err) { state.converted = []; state.skipped = [{ sourceName: 'pasted-json', path: '$', reason: err.message }]; state.outputText = ''; updateOutput(); st(E.inputStatus, err.message, 'error'); }
  }

  document.querySelector('#pick-files').addEventListener('click', function () { document.querySelector('#file-input').click(); });
  document.querySelector('#file-input').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });

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
