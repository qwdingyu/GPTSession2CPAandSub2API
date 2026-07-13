var ContextPack;
(function (ContextPack) {
  'use strict';

  var DEFAULT_IGNORE_DIRS = ['.git', 'node_modules', 'dist', 'build', '.next', '.nuxt', '.cache', 'coverage', '.venv', 'venv', '__pycache__'];
  var DEFAULT_IGNORE_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', '.DS_Store'];
  var BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.7z', '.mp4', '.mov', '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.otf', '.wasm', '.db', '.sqlite'];
  var TEXT_EXTENSIONS = ['.md', '.txt', '.json', '.jsonc', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.svg', '.py', '.go', '.rs', '.java', '.cs', '.php', '.rb', '.sh', '.yml', '.yaml', '.toml', '.xml', '.sql', '.env.example'];

  function normalizePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function getBaseName(path) {
    var parts = normalizePath(path).split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function getExtension(path) {
    var name = getBaseName(path).toLowerCase();
    var index = name.lastIndexOf('.');
    return index >= 0 ? name.slice(index) : '';
  }

  function pathParts(path) {
    return normalizePath(path).split('/').filter(Boolean);
  }

  function shouldSkipPath(path, options) {
    var opts = options || {};
    var parts = pathParts(path);
    var ignoreDirs = opts.ignoreDirs || DEFAULT_IGNORE_DIRS;
    var ignoreFiles = opts.ignoreFiles || DEFAULT_IGNORE_FILES;
    var baseName = getBaseName(path);
    var ext = getExtension(path);
    if (!baseName) return true;
    if (ignoreFiles.indexOf(baseName) >= 0) return true;
    if (parts.some(function (part) { return ignoreDirs.indexOf(part) >= 0; })) return true;
    if (BINARY_EXTENSIONS.indexOf(ext) >= 0) return true;
    return false;
  }

  function isLikelyTextPath(path) {
    var ext = getExtension(path);
    if (TEXT_EXTENSIONS.indexOf(ext) >= 0) return true;
    var baseName = getBaseName(path);
    return ['Dockerfile', 'Makefile', 'README', 'LICENSE', 'AGENTS.md', 'CLAUDE.md'].indexOf(baseName) >= 0;
  }

  function compareEntries(a, b) {
    return normalizePath(a.path).localeCompare(normalizePath(b.path), 'zh');
  }

  function filterEntries(entries, options) {
    var opts = options || {};
    var maxFileBytes = opts.maxFileBytes || 200 * 1024;
    var maxTotalBytes = opts.maxTotalBytes || 1200 * 1024;
    var included = [];
    var skipped = [];
    var totalBytes = 0;

    (entries || []).slice().sort(compareEntries).forEach(function (entry) {
      var path = normalizePath(entry.path || entry.name);
      var size = Number(entry.size || (entry.text ? entry.text.length : 0));
      if (shouldSkipPath(path, opts)) {
        skipped.push({ path: path, reason: '忽略目录、锁文件或二进制文件' });
        return;
      }
      if (!isLikelyTextPath(path)) {
        skipped.push({ path: path, reason: '未知文本类型，避免误读二进制内容' });
        return;
      }
      if (size > maxFileBytes) {
        skipped.push({ path: path, reason: '单文件超过大小限制' });
        return;
      }
      if (totalBytes + size > maxTotalBytes) {
        skipped.push({ path: path, reason: '超过上下文包总大小限制' });
        return;
      }
      included.push({ path: path, text: entry.text || '', size: size });
      totalBytes += size;
    });

    return { included: included, skipped: skipped, totalBytes: totalBytes };
  }

  function buildTree(entries) {
    var paths = (entries || []).map(function (entry) { return normalizePath(entry.path); }).filter(Boolean).sort();
    var lines = [];
    var seenDirs = {};
    paths.forEach(function (path) {
      var parts = pathParts(path);
      parts.forEach(function (part, index) {
        var key = parts.slice(0, index + 1).join('/');
        var isFile = index === parts.length - 1;
        if (!isFile) {
          if (seenDirs[key]) return;
          seenDirs[key] = true;
        }
        lines.push('  '.repeat(index) + (isFile ? '- ' : '▸ ') + part);
      });
    });
    return lines.join('\n');
  }

  function languageForPath(path) {
    var ext = getExtension(path);
    var map = { '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx', '.json': 'json', '.jsonc': 'jsonc', '.css': 'css', '.html': 'html', '.md': 'markdown', '.py': 'python', '.go': 'go', '.rs': 'rust', '.sh': 'bash', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.sql': 'sql', '.xml': 'xml', '.svg': 'xml' };
    return map[ext] || '';
  }

  function estimateTokens(text) {
    var value = String(text || '');
    var cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length;
    var nonCjk = value.length - cjk;
    return Math.ceil(cjk * 0.9 + nonCjk / 4);
  }

  function buildContextMarkdown(entries, options) {
    var opts = options || {};
    var title = opts.title || 'AI Context Pack';
    var filtered = filterEntries(entries, opts);
    var tree = buildTree(filtered.included);
    var body = [
      '# ' + title,
      '',
      '> 本上下文包由浏览器本地生成。请在发送给 AI 前自行确认是否包含敏感信息。',
      '',
      '## 摘要',
      '',
      '- 包含文件：' + filtered.included.length,
      '- 跳过文件：' + filtered.skipped.length,
      '- 文本大小：' + filtered.totalBytes + ' bytes',
      '- 粗略 token：' + estimateTokens(filtered.included.map(function (entry) { return entry.text; }).join('\n')).toLocaleString('zh-CN'),
      '',
      '## 目录树',
      '',
      '```text',
      tree || '(空)',
      '```',
      '',
      '## 文件内容',
      ''
    ];

    filtered.included.forEach(function (entry) {
      body.push('### `' + entry.path + '`', '', '```' + languageForPath(entry.path), entry.text.replace(/```/g, '``\\`'), '```', '');
    });

    if (filtered.skipped.length) {
      body.push('## 跳过文件', '');
      filtered.skipped.forEach(function (item) { body.push('- `' + item.path + '`：' + item.reason); });
      body.push('');
    }

    return { markdown: body.join('\n'), included: filtered.included, skipped: filtered.skipped, totalBytes: filtered.totalBytes, estimatedTokens: estimateTokens(body.join('\n')) };
  }

  // 中文注释：导出纯函数，浏览器页面和 Node 测试共用，避免未来新增后端或联网依赖。
  ContextPack.normalizePath = normalizePath;
  ContextPack.shouldSkipPath = shouldSkipPath;
  ContextPack.isLikelyTextPath = isLikelyTextPath;
  ContextPack.filterEntries = filterEntries;
  ContextPack.buildTree = buildTree;
  ContextPack.estimateTokens = estimateTokens;
  ContextPack.buildContextMarkdown = buildContextMarkdown;
})(ContextPack || (ContextPack = {}));
