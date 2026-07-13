(function () {
  'use strict';

  var state = { result: null };
  var E = {
    folder: document.querySelector('#folder-input'),
    pick: document.querySelector('#pick-folder'),
    clear: document.querySelector('#clear-pack'),
    title: document.querySelector('#pack-title'),
    status: document.querySelector('#pack-status'),
    files: document.querySelector('#stat-files'),
    skipped: document.querySelector('#stat-skipped'),
    size: document.querySelector('#stat-size'),
    tokens: document.querySelector('#stat-tokens'),
    copy: document.querySelector('#copy-pack'),
    download: document.querySelector('#download-pack'),
    preview: document.querySelector('#pack-preview'),
  };

  function setStatus(text, tone) {
    E.status.textContent = text;
    E.status.classList.toggle('ok', tone === 'ok');
    E.status.classList.toggle('err', tone === 'error');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function refresh(result) {
    state.result = result;
    E.files.textContent = String(result ? result.included.length : 0);
    E.skipped.textContent = String(result ? result.skipped.length : 0);
    E.size.textContent = result ? formatSize(result.totalBytes) : '0 KB';
    E.tokens.textContent = result ? result.estimatedTokens.toLocaleString('zh-CN') : '0';
    E.copy.disabled = !result || !result.markdown;
    E.download.disabled = !result || !result.markdown;
    E.preview.textContent = result && result.markdown ? (result.markdown.length > 8000 ? result.markdown.slice(0, 8000) + '\n\n...（预览截断，下载文件包含完整内容）' : result.markdown) : '选择文件夹后会生成上下文包。';
  }

  async function readFiles(fileList) {
    var files = Array.from(fileList || []);
    if (!files.length) { setStatus('没有选择文件。', 'error'); return; }
    setStatus('正在读取本地文件...', '');
    var entries = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var path = file.webkitRelativePath || file.name;
      if (ContextPack.shouldSkipPath(path)) continue;
      try {
        entries.push({ path: path, size: file.size, text: await file.text() });
      } catch (err) {
        entries.push({ path: path, size: file.size, text: '' });
      }
    }
    var result = ContextPack.buildContextMarkdown(entries, { title: E.title.value || 'AI Context Pack' });
    refresh(result);
    setStatus(result.included.length ? '已生成上下文包：' + result.included.length + ' 个文件。' : '没有找到可打包文本文件。', result.included.length ? 'ok' : 'error');
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

  E.pick.addEventListener('click', function () { E.folder.click(); });
  E.folder.addEventListener('change', function (event) { readFiles(event.target.files); event.target.value = ''; });
  E.clear.addEventListener('click', function () { refresh(null); setStatus('等待选择文件夹。'); });
  E.copy.addEventListener('click', async function () {
    if (!state.result) return;
    try { await navigator.clipboard.writeText(state.result.markdown); setStatus('已复制 Markdown。', 'ok'); }
    catch { setStatus('复制失败，请改用下载。', 'error'); }
  });
  E.download.addEventListener('click', function () {
    if (!state.result) return;
    downloadText(state.result.markdown, 'ai-context-pack.md');
  });
})();
