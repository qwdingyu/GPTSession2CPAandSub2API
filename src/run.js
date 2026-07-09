/* run.js — Dynamic tool loader: run.html?tool=xxx */
/* For simple tools that don't need a standalone HTML page */
(function () {
  'use strict';

  var tool = (new URLSearchParams(window.location.search)).get('tool');

  if (!tool) {
    /* No tool specified — redirect to convert by default */
    window.location.replace('convert.html');
    return;
  }

  /* Simple tools registered in __TOOLS__ */
  var TOOL_MAP = {
    /* ── Add future simple tools here ── */
    /* clipt:  { title:'...', scripts:['./tools/clipt.js'] }, */
  };

  var cfg = TOOL_MAP[tool];
  if (!cfg) {
    /* Unknown tool — show error with link back */
    var container = document.getElementById('tool-container');
    if (container) {
      container.innerHTML = ''
        + '<div style="text-align:center;padding:60px 20px">'
        + '<p style="color:#d45c5c;font-size:1rem">未知工具</p>'
        + '<p style="color:var(--text-dim);margin:4px 0 16px">' + tool + '</p>'
        + '<a href="index.html" style="display:inline-block;padding:8px 18px;border-radius:6px;background:#4fb5c4;color:#0e1a1e;font-weight:700;text-decoration:none">← 返回首页</a>'
        + '</div>';
    }
    return;
  }

  document.title = cfg.title + ' — AI Forge';
  var loading = document.getElementById('tool-loading');
  if (loading) loading.textContent = '加载 ' + cfg.title + '...';

  var idx = 0;
  function loadNext() {
    if (idx >= cfg.scripts.length) {
      var toolObj = window.__TOOLS__ && window.__TOOLS__[tool];
      if (toolObj && typeof toolObj.init === 'function') {
        toolObj.init(document.getElementById('tool-container'));
      } else {
        var el = document.getElementById('tool-loading');
        if (el) el.remove();
      }
      return;
    }
    var s = document.createElement('script');
    s.src = cfg.scripts[idx++];
    s.onload = loadNext;
    s.onerror = function () {
      var el = document.getElementById('tool-loading');
      if (el) el.innerHTML = '<p style="color:#d45c5c">加载失败</p>';
    };
    document.body.appendChild(s);
  }
  loadNext();

})();
