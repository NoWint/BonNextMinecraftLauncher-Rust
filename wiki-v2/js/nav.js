// ========================================
// BonNext Wiki v2 - Navigation Tree Module
// Handles: fold/unfold, state persistence, auto-expand current path
// ========================================

(function() {
  'use strict';

  var STORAGE_KEY = 'bnwiki_nav_state';
  var SCROLL_KEY = 'bnwiki_scroll_pos';

  // ---- State Persistence ----

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getGroupPath(el) {
    var path = [];
    var current = el;
    while (current && current.id !== 'sidebar-content') {
      if (current.classList && current.classList.contains('nav-group')) {
        var header = current.querySelector('.nav-group-header');
        if (header) {
          var title = header.querySelector('span:last-child');
          if (title) path.unshift(title.textContent.trim());
        }
      }
      current = current.parentElement;
    }
    return path.join(' / ');
  }

  // ---- Fold / Unfold ----

  function toggleGroup(groupEl, forceState) {
    var children = groupEl.querySelector(':scope > .nav-group-children');
    var header = groupEl.querySelector(':scope > .nav-group-header');
    var chevron = header ? header.querySelector('.chevron') : null;
    if (!children) return;

    var isCollapsed = children.classList.contains('collapsed');
    var shouldCollapse = forceState !== undefined ? !forceState : !isCollapsed;

    if (shouldCollapse) {
      children.classList.add('collapsed');
      if (chevron) chevron.classList.add('collapsed');
    } else {
      children.classList.remove('collapsed');
      if (chevron) chevron.classList.remove('collapsed');
    }

    // Save state
    var state = loadState();
    var path = getGroupPath(groupEl);
    state[path] = !shouldCollapse;
    saveState(state);
  }

  function initFoldUnfold() {
    document.querySelectorAll('.nav-group-header').forEach(function(header) {
      header.addEventListener('click', function(e) {
        // Don't toggle if clicking a link inside header
        if (e.target.tagName === 'A') return;
        var group = header.parentElement;
        toggleGroup(group);
      });
    });
  }

  // ---- Auto-expand Current Path ----

  function expandCurrentPath() {
    var activeItem = document.querySelector('.nav-item.active');
    if (!activeItem) return;

    var current = activeItem.parentElement;
    while (current && current.id !== 'sidebar-content') {
      if (current.classList && current.classList.contains('nav-group-children')) {
        current.classList.remove('collapsed');
        var group = current.parentElement;
        var header = group.querySelector(':scope > .nav-group-header');
        var chevron = header ? header.querySelector('.chevron') : null;
        if (chevron) chevron.classList.remove('collapsed');
      }
      current = current.parentElement;
    }
  }

  // ---- Restore State ----

  function restoreState() {
    var state = loadState();
    document.querySelectorAll('.nav-group').forEach(function(group) {
      var path = getGroupPath(group);
      if (state.hasOwnProperty(path)) {
        toggleGroup(group, state[path]);
      }
    });
  }

  // ---- Scroll Position ----

  function saveScroll() {
    var sidebar = document.getElementById('sidebar-content');
    if (sidebar) {
      try {
        localStorage.setItem(SCROLL_KEY, sidebar.scrollTop.toString());
      } catch (e) {}
    }
  }

  function restoreScroll() {
    var sidebar = document.getElementById('sidebar-content');
    if (sidebar) {
      try {
        var pos = localStorage.getItem(SCROLL_KEY);
        if (pos) sidebar.scrollTop = parseInt(pos, 10);
      } catch (e) {}
    }
  }

  // ---- Mobile Sidebar ----

  function initMobileSidebar() {
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    // Create overlay if not exists
    var overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:150;';
      document.body.appendChild(overlay);
    }

    toggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });

    overlay.addEventListener('click', function() {
      sidebar.classList.remove('open');
      overlay.style.display = 'none';
    });

    // Close on resize to desktop
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
      }
    });
  }

  // ---- Init ----

  function init() {
    initFoldUnfold();
    expandCurrentPath();
    restoreState();
    restoreScroll();
    initMobileSidebar();

    // Save scroll before leaving
    window.addEventListener('beforeunload', saveScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
