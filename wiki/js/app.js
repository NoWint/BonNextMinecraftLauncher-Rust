(function () {
  'use strict';

  var STORAGE_KEY = 'bonnext_wiki_articles';

  var state = {
    articles: [],
    currentId: null,
    editingId: null,
    searchQuery: ''
  };

  function loadArticles() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      state.articles = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.articles = [];
    }
    if (state.articles.length === 0) {
      seedDefaultArticles();
    }
  }

  function saveArticles() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.articles));
  }

  function seedDefaultArticles() {
    var now = Date.now();
    state.articles = [
      {
        id: generateId(),
        title: 'BonNext 项目简介',
        category: '概述',
        content: '## BonNext 是什么？\n\nBonNext 是一款基于 **Tauri v2** 构建的跨平台 Minecraft Java Edition 启动器，采用 **ZZZ 风格的 Neo-Tokyo 赛博朋克美学**设计。\n\n### 技术栈\n\n- **后端**: Rust\n- **前端**: React 18 + TypeScript\n- **桌面框架**: Tauri v2\n\n### 核心特性\n\n1. Microsoft OAuth 2.0 设备流认证 + 离线模式\n2. 并行下载队列，支持重试与 SHA1 校验\n3. Fabric + Forge 模组加载器安装\n4. 多实例管理，独立 `.minecraft` 目录\n5. Modrinth / CurseForge 内容平台集成\n6. Steam 风格浮动下载管理器\n\n> BonNext 的设计理念是高效、美观、安全。',
        createdAt: now - 86400000,
        updatedAt: now - 86400000
      },
      {
        id: generateId(),
        title: '快速开始指南',
        category: '指南',
        content: '## 快速开始\n\n### 安装\n\n```bash\ngit clone <repo-url>\ncd BonNext\npnpm install\n```\n\n### 开发模式\n\n```bash\n# 前端开发\npnpm dev\n\n# 完整桌面应用\npnpm tauri dev\n```\n\n### 构建生产版本\n\n```bash\npnpm tauri build\n```\n\n### 项目结构\n\n| 目录 | 说明 |\n|------|------|\n| `src/` | React 前端代码 |\n| `src-tauri/` | Rust 后端代码 |\n| `src/components/` | UI 组件 |\n| `src/stores/` | 状态管理 |\n| `src/pages/` | 页面组件 |',
        createdAt: now - 43200000,
        updatedAt: now - 43200000
      },
      {
        id: generateId(),
        title: '架构设计文档',
        category: '开发',
        content: '## 架构概览\n\nBonNext 采用 **前后端分离** 架构，通过 Tauri IPC 通信。\n\n### 数据流\n\n```\n用户操作 → React 组件 → api.ts invoke() → Tauri IPC → Rust 命令\n                                                            ↓\nUI 更新 ← React 状态 ← listen() 事件 ← app.emit() ← Rust 后台任务\n```\n\n### 后端模块\n\n- `auth/` — 微软 OAuth 认证\n- `download/` — 并行下载引擎\n- `launch/` — 启动状态机\n- `loader/` — 模组加载器\n- `instance/` — 实例管理\n- `version/` — 版本解析\n\n### 前端状态管理\n\n使用 React Context + `useReducer` 模式：\n\n- `authStore` — 用户认证\n- `configStore` — 应用配置\n- `instanceStore` — 实例管理\n- `downloadStore` — 下载队列\n- `themeStore` — 主题切换',
        createdAt: now - 3600000,
        updatedAt: now - 3600000
      }
    ];
    saveArticles();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min;
  }

  function getFilteredArticles() {
    var q = state.searchQuery.toLowerCase().trim();
    if (!q) return state.articles;
    return state.articles.filter(function (a) {
      return a.title.toLowerCase().indexOf(q) !== -1 ||
        a.category.toLowerCase().indexOf(q) !== -1 ||
        a.content.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderArticleList() {
    var list = document.getElementById('article-list');
    var articles = getFilteredArticles();

    if (articles.length === 0) {
      list.innerHTML = '<div class="list-empty">' +
        (state.searchQuery ? '未找到匹配文章' : '暂无文章') + '</div>';
      return;
    }

    var html = '';
    articles.forEach(function (a) {
      var isActive = a.id === state.currentId;
      html += '<div class="article-item' + (isActive ? ' active' : '') + '" data-id="' + a.id + '">' +
        '<div class="item-title">' + escapeHtml(a.title) + '</div>' +
        '<div class="item-meta">' +
        (a.category ? '<span class="item-category">' + escapeHtml(a.category) + '</span>' : '') +
        '<span>' + formatDate(a.updatedAt) + '</span>' +
        '</div></div>';
    });
    list.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showView(viewId) {
    ['view-empty', 'view-article', 'view-editor'].forEach(function (id) {
      document.getElementById(id).classList.toggle('hidden', id !== viewId);
    });
  }

  function showArticle(id) {
    var article = state.articles.find(function (a) { return a.id === id; });
    if (!article) return;

    state.currentId = id;
    state.editingId = null;

    document.getElementById('article-category').textContent = article.category || '';
    document.getElementById('article-category').style.display = article.category ? 'inline-block' : 'none';
    document.getElementById('article-date').textContent = '更新于 ' + formatDate(article.updatedAt);

    var body = document.getElementById('article-body');
    try {
      body.innerHTML = marked.parse(article.content);
    } catch (e) {
      body.innerHTML = '<p>' + escapeHtml(article.content).replace(/\n/g, '<br>') + '</p>';
    }

    showView('view-article');
    renderArticleList();
  }

  function showEditor(id) {
    var article = id ? state.articles.find(function (a) { return a.id === id; }) : null;
    state.editingId = id || null;

    document.getElementById('editor-title').value = article ? article.title : '';
    document.getElementById('editor-category').value = article ? article.category : '';
    document.getElementById('editor-content').value = article ? article.content : '';
    updatePreview();

    showView('view-editor');
    document.getElementById('editor-title').focus();
  }

  function updatePreview() {
    var content = document.getElementById('editor-content').value;
    var preview = document.getElementById('editor-preview');
    try {
      preview.innerHTML = marked.parse(content || '*预览区域 — 在左侧输入 Markdown 内容*');
    } catch (e) {
      preview.innerHTML = '<p>' + escapeHtml(content || '').replace(/\n/g, '<br>') + '</p>';
    }
  }

  function saveArticle() {
    var title = document.getElementById('editor-title').value.trim();
    var category = document.getElementById('editor-category').value.trim();
    var content = document.getElementById('editor-content').value.trim();

    if (!title) {
      document.getElementById('editor-title').focus();
      return;
    }

    var now = Date.now();

    if (state.editingId) {
      var article = state.articles.find(function (a) { return a.id === state.editingId; });
      if (article) {
        article.title = title;
        article.category = category;
        article.content = content;
        article.updatedAt = now;
      }
    } else {
      var newArticle = {
        id: generateId(),
        title: title,
        category: category,
        content: content,
        createdAt: now,
        updatedAt: now
      };
      state.articles.unshift(newArticle);
      state.currentId = newArticle.id;
    }

    saveArticles();
    state.editingId = null;

    if (state.currentId) {
      showArticle(state.currentId);
    } else {
      showView('view-empty');
    }
    renderArticleList();
  }

  function deleteArticle(id) {
    showModal(
      '删除文章',
      '确定要删除这篇文章吗？此操作不可撤销。',
      function () {
        state.articles = state.articles.filter(function (a) { return a.id !== id; });
        if (state.currentId === id) {
          state.currentId = null;
          showView('view-empty');
        }
        saveArticles();
        renderArticleList();
      }
    );
  }

  function showModal(title, message, onConfirm) {
    var overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    overlay.classList.remove('hidden');

    var confirmBtn = document.getElementById('modal-confirm');
    var cancelBtn = document.getElementById('modal-cancel');

    function cleanup() {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      overlay.removeEventListener('click', handleOverlayClick);
    }

    function handleConfirm() {
      cleanup();
      onConfirm();
    }

    function handleCancel() {
      cleanup();
    }

    function handleOverlayClick(e) {
      if (e.target === overlay) cleanup();
    }

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
  }

  function bindEvents() {
    document.getElementById('btn-new-article').addEventListener('click', function () {
      state.currentId = null;
      state.editingId = null;
      showEditor(null);
      renderArticleList();
    });

    document.getElementById('article-list').addEventListener('click', function (e) {
      var item = e.target.closest('.article-item');
      if (!item) return;
      var id = item.dataset.id;
      if (id) showArticle(id);
    });

    document.getElementById('search-input').addEventListener('input', function (e) {
      state.searchQuery = e.target.value;
      renderArticleList();
    });

    document.getElementById('btn-edit').addEventListener('click', function () {
      if (state.currentId) showEditor(state.currentId);
    });

    document.getElementById('btn-delete').addEventListener('click', function () {
      if (state.currentId) deleteArticle(state.currentId);
    });

    document.getElementById('btn-save').addEventListener('click', saveArticle);

    document.getElementById('btn-cancel').addEventListener('click', function () {
      if (state.editingId) {
        showArticle(state.editingId);
      } else if (state.currentId) {
        showArticle(state.currentId);
      } else {
        showView('view-empty');
      }
    });

    document.getElementById('editor-content').addEventListener('input', updatePreview);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var overlay = document.getElementById('modal-overlay');
        if (!overlay.classList.contains('hidden')) {
          overlay.classList.add('hidden');
          return;
        }
        if (!document.getElementById('view-editor').classList.contains('hidden')) {
          document.getElementById('btn-cancel').click();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!document.getElementById('view-editor').classList.contains('hidden')) {
          saveArticle();
        }
      }
    });
  }

  function init() {
    loadArticles();
    renderArticleList();
    bindEvents();
    showView('view-empty');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
