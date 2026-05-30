// ========================================
// BonNext Wiki v2 - Search Module
// Handles: debounced search, auto-expand matches, highlight
// ========================================

(function() {
  'use strict';

  var DEBOUNCE_MS = 150;
  var searchInput = null;
  var searchTimeout = null;
  var originalDisplay = new Map();

  function getAllNavItems() {
    return document.querySelectorAll('.nav-item');
  }

  function getAllGroups() {
    return document.querySelectorAll('.nav-group');
  }

  function saveOriginalDisplay() {
    if (originalDisplay.size > 0) return;
    getAllNavItems().forEach(function(item) {
      originalDisplay.set(item, item.style.display || '');
    });
    getAllGroups().forEach(function(group) {
      originalDisplay.set(group, group.style.display || '');
    });
  }

  function restoreOriginalDisplay() {
    originalDisplay.forEach(function(display, el) {
      el.style.display = display;
    });
  }

  function expandAllGroups() {
    document.querySelectorAll('.nav-group-children').forEach(function(children) {
      children.classList.remove('collapsed');
    });
    document.querySelectorAll('.chevron').forEach(function(chevron) {
      chevron.classList.remove('collapsed');
    });
  }

  function collapseAllGroups() {
    document.querySelectorAll('.nav-group-children').forEach(function(children) {
      children.classList.add('collapsed');
    });
    document.querySelectorAll('.chevron').forEach(function(chevron) {
      chevron.classList.add('collapsed');
    });
  }

  function highlightText(el, query) {
    // Remove existing highlights
    el.querySelectorAll('mark.search-highlight').forEach(function(mark) {
      var parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });

    if (!query) return;

    // Simple highlight: wrap matching text in <mark>
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    var node;
    while (node = walker.nextNode()) {
      if (node.parentElement && node.parentElement.tagName === 'MARK') continue;
      textNodes.push(node);
    }

    textNodes.forEach(function(textNode) {
      var text = textNode.textContent;
      var lowerText = text.toLowerCase();
      var lowerQuery = query.toLowerCase();
      var index = lowerText.indexOf(lowerQuery);
      if (index === -1) return;

      var parent = textNode.parentNode;
      var before = text.substring(0, index);
      var match = text.substring(index, index + query.length);
      var after = text.substring(index + query.length);

      var frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      var mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = match;
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, textNode);
    });
  }

  function clearHighlights() {
    document.querySelectorAll('mark.search-highlight').forEach(function(mark) {
      var parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }

  function performSearch(query) {
    saveOriginalDisplay();

    if (!query) {
      restoreOriginalDisplay();
      clearHighlights();
      // Restore collapsed state from localStorage
      if (window.BNWikiNav && window.BNWikiNav.restoreState) {
        window.BNWikiNav.restoreState();
      }
      return;
    }

    var lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      restoreOriginalDisplay();
      clearHighlights();
      return;
    }

    // Expand all groups so we can search everything
    expandAllGroups();

    var items = getAllNavItems();
    var groups = getAllGroups();
    var matchedItems = new Set();

    // First pass: mark matching items
    items.forEach(function(item) {
      var text = item.textContent.toLowerCase();
      if (text.indexOf(lowerQuery) !== -1) {
        item.style.display = '';
        matchedItems.add(item);
        highlightText(item, query);
      } else {
        item.style.display = 'none';
      }
    });

    // Second pass: show groups that have matching children
    groups.forEach(function(group) {
      var groupItems = group.querySelectorAll('.nav-item');
      var hasMatch = false;
      groupItems.forEach(function(item) {
        if (matchedItems.has(item)) hasMatch = true;
      });
      group.style.display = hasMatch ? '' : 'none';
    });
  }

  function initSearch() {
    searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', function(e) {
      clearTimeout(searchTimeout);
      var query = e.target.value;
      searchTimeout = setTimeout(function() {
        performSearch(query);
      }, DEBOUNCE_MS);
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        performSearch('');
        searchInput.blur();
      }
    });
  }

  // Expose for nav.js
  window.BNWikiSearch = {
    performSearch: performSearch,
    clearHighlights: clearHighlights
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
