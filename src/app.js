/* app.js — AI Forge navigation hub */
(function () {
  'use strict';

  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function cardHTML(t) {
    return `<a class="tool-card" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" data-id="${esc(t.id)}">
      <div class="card-icon" aria-hidden="true">${esc(t.icon||'🔧')}</div>
      <div class="card-body">
        <div class="card-name">${esc(t.name)}${t.featured?'<span class="card-badge">推荐</span>':''}</div>
        <div class="card-desc">${esc(t.description)}</div>
        ${t.recommendReason?`<div class="card-reason">推荐依据：${esc(t.recommendReason)}</div>`:''}
        ${t.tags?'<div class="card-tags">'+t.tags.map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')+'</div>':''}
        ${t.lastCheckedAt?`<div class="card-checked">核验：${esc(t.lastCheckedAt)}</div>`:''}
      </div>
    </a>`;
  }

  /* ── State ── */
  const state = {
    category: 'all',
    search: '',
    tools: window.TOOLS || [],
    cats: window.CATEGORIES || [],
  };

  const $ = (sel, ctx) => (ctx||document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx||document).querySelectorAll(sel));

  /* ── DOM refs ── */
  const el = {
    search: $('#search-input'),
    searchKbd: $('#search-kbd'),
    searchClear: $('#search-clear'),
    catBar: $('#category-bar'),
    featuredGrid: $('#featured-grid'),
    featuredSection: $('#featured-section'),
    featuredCount: $('#featured-count'),
    localTools: $('#local-tools'),
    toolGrid: $('#tool-grid'),
    toolCount: $('#tool-count'),
    emptyState: $('#empty-state'),
    catalogMeta: $('#catalog-meta'),
  };

  /* ── Categories ── */
  function renderCats() {
    el.catBar.innerHTML = state.cats.map(c => `
      <button class="cat-pill${c.id==='all'?' active':''}" data-cat="${c.id}">
        <span class="cat-icon">${esc(c.icon)}</span>
        <span class="cat-label">${esc(c.label)}</span>
      </button>
    `).join('');

    el.catBar.addEventListener('click', e => {
      const btn = e.target.closest('.cat-pill');
      if (!btn) return;
      $$('.cat-pill', el.catBar).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.cat;
      renderTools();
    });
  }

  /* ── Local tools ── */
  function renderLocal() {
    el.localTools.innerHTML = `
      <a class="local-card" href="./convert.html" target="_self">
        <div class="local-card-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M9 11l2 2-2 2m6-4l-2 2 2 2"/></svg>
        </div>
        <div class="local-card-body">
          <div class="local-card-name">ChatGPT Session Converter</div>
          <div class="local-card-desc">将 ChatGPT 登录 session JSON 转换为 CPA、sub2api、Cockpit、9router、Codex auth 格式。纯浏览器端解析，不上传服务器。</div>
          <span class="local-card-action">打开工具</span>
        </div>
      </a>`;
  }

  /* ── Render tools ── */
  function renderTools() {
    const { category, search, tools } = state;
    const q = search.toLowerCase().trim();

    let filtered = tools;
    if (category !== 'all') filtered = filtered.filter(t => t.category === category);
    if (q) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags||[]).some(tag => tag.toLowerCase().includes(q)) ||
        t.category.toLowerCase().includes(q)
      );
    }

    // All tools grid
    el.toolGrid.innerHTML = filtered.map(cardHTML).join('');
    el.toolCount.textContent = `(${filtered.length})`;
    el.emptyState.classList.toggle('hidden', filtered.length > 0);

    // Featured
    if (!q && category === 'all') {
      const featured = tools.filter(t => t.featured);
      el.featuredGrid.innerHTML = featured.map(cardHTML).join('');
      el.featuredCount.textContent = `(${featured.length})`;
      el.featuredSection.classList.remove('hidden');
    } else {
      el.featuredSection.classList.add('hidden');
    }

    // Stagger animation
    requestAnimationFrame(() => {
      $$('.tool-card', el.toolGrid).forEach((card, i) => {
        card.style.animationDelay = `${i * 30}ms`;
        card.style.animation = 'none';
        card.offsetHeight; // force reflow
        card.style.animation = `fadeUp .35s cubic-bezier(.22,1,.36,1) ${i*30}ms both`;
      });
    });
  }

  /* ── Search ── */
  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = el.search.value;
      el.searchClear.classList.toggle('is-active', !!state.search);
      renderTools();
    }, 150);
  });

  el.searchClear.addEventListener('click', () => {
    el.search.value = '';
    state.search = '';
    el.searchClear.classList.remove('is-active');
    el.search.focus();
    renderTools();
  });

  /* ── Keyboard shortcuts ── */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      el.search.focus();
    }
    if (e.key === 'Escape' && document.activeElement === el.search) {
      el.search.value = '';
      state.search = '';
      el.searchClear.classList.remove('is-active');
      el.search.blur();
      renderTools();
    }
  });


  /* ── QQ Group copy handler ── */
  document.addEventListener('click', function(e) {
    var qq = '1079544259';

    /* Banner copy button */
    var btn = e.target.closest('.qq-banner-copy');
    if (btn) {
      navigator.clipboard.writeText(qq).then(function() {
        btn.textContent = '已复制 ✓';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = '复制群号';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(function() {
        btn.textContent = '复制失败';
        setTimeout(function() { btn.textContent = '复制群号'; }, 2000);
      });
      return;
    }

    /* Header QQ click */
    var headerQq = e.target.closest('.header-qq');
    if (headerQq) {
      var textEl = document.getElementById('header-qq-text');
      var orig = textEl.textContent;
      navigator.clipboard.writeText(qq).then(function() {
        textEl.textContent = '已复制 ✓';
        headerQq.style.color = 'var(--accent)';
        setTimeout(function() {
          textEl.textContent = orig;
          headerQq.style.color = '';
        }, 2000);
      }).catch(function() {
        textEl.textContent = '失败';
        setTimeout(function() { textEl.textContent = orig; }, 1500);
      });
    }
  });

  /* ── Init ── */
  if (el.catalogMeta && window.CATALOG_META) {
    el.catalogMeta.textContent = `${window.CATALOG_META.note || '精选 AI 工具目录。'} 最后核验：${window.CATALOG_META.lastCheckedAt || '未标注'}。`;
  }
  renderCats();
  renderLocal();
  renderTools();

})();
