// ========================================
// BonNext Wiki v2 - Keyboard Navigation Module
// Tab/Arrow/Enter/Escape support for accessibility
// ========================================

(function() {
  'use strict';

  var sidebar = null;
  var sidebarContent = null;
  var focusableItems = [];
  var currentFocusIndex = -1;

  function updateFocusableItems() {
    if (!sidebarContent) return;
    focusableItems = Array.from(sidebarContent.querySelectorAll(
      '.nav-group-header, .nav-item:not([style*="display: none"])'
    ));
  }

  function focusItem(index) {
    if (index < 0 || index >= focusableItems.length) return;
    focusableItems[index].focus();
    currentFocusIndex = index;
  }

  function isNavFocused() {
    var active = document.activeElement;
    return active && sidebarContent && sidebarContent.contains(active);
  }

  function initKeyboardNav() {
    sidebar = document.getElementById('sidebar');
    sidebarContent = document.getElementById('sidebar-content');
    if (!sidebar || !sidebarContent) return;

    // Make nav items focusable
    sidebarContent.querySelectorAll('.nav-group-header, .nav-item').forEach(function(el) {
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }
    });

    updateFocusableItems();

    sidebarContent.addEventListener('keydown', function(e) {
      updateFocusableItems();

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          focusItem(currentFocusIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          focusItem(currentFocusIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          var current = focusableItems[currentFocusIndex];
          if (current && current.classList.contains('nav-group-header')) {
            var group = current.parentElement;
            var children = group.querySelector(':scope > .nav-group-children');
            if (children && children.classList.contains('collapsed')) {
              current.click();
              // Move focus to first child
              setTimeout(function() {
                updateFocusableItems();
                focusItem(currentFocusIndex + 1);
              }, 50);
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          var current2 = focusableItems[currentFocusIndex];
          if (current2 && current2.classList.contains('nav-group-header')) {
            var group2 = current2.parentElement;
            var children2 = group2.querySelector(':scope > .nav-group-children');
            if (children2 && !children2.classList.contains('collapsed')) {
              current2.click();
            }
          }
          break;
        case 'Enter':
          var current3 = focusableItems[currentFocusIndex];
          if (current3) {
            if (current3.tagName === 'A') {
              // Let default link behavior happen
            } else {
              current3.click();
            }
          }
          break;
      }
    });

    // Track focus
    sidebarContent.addEventListener('focusin', function(e) {
      var idx = focusableItems.indexOf(e.target);
      if (idx !== -1) currentFocusIndex = idx;
    });
  }

  function initGlobalShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Escape: close mobile sidebar or clear search
      if (e.key === 'Escape') {
        var sidebarEl = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebar-overlay');
        var searchInput = document.getElementById('search-input');

        if (sidebarEl && sidebarEl.classList.contains('open')) {
          sidebarEl.classList.remove('open');
          if (overlay) overlay.style.display = 'none';
        } else if (searchInput && searchInput.value) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
        }
      }

      // / to focus search
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        var searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
    });
  }

  function init() {
    initKeyboardNav();
    initGlobalShortcuts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
