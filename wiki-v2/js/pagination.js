// ========================================
// BonNext Wiki v2 - Pagination Module
// Previous / Next navigation based on doc tree order
// ========================================

(function() {
  'use strict';

  function getFlatDocList() {
    var items = [];
    document.querySelectorAll('.nav-item').forEach(function(el) {
      items.push({
        title: el.textContent.trim(),
        href: el.getAttribute('href'),
        el: el
      });
    });
    return items;
  }

  function getCurrentIndex(docs) {
    var currentHref = window.location.pathname.split('/').pop() || 'index.html';
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].href && docs[i].href.indexOf(currentHref) !== -1) {
        return i;
      }
    }
    return -1;
  }

  function generatePagination() {
    var docs = getFlatDocList();
    if (docs.length < 2) return;

    var currentIndex = getCurrentIndex(docs);
    if (currentIndex === -1) return;

    var prev = currentIndex > 0 ? docs[currentIndex - 1] : null;
    var next = currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null;

    if (!prev && !next) return;

    var nav = document.createElement('nav');
    nav.className = 'pagination';

    var html = '';
    if (prev) {
      html += '<a href="' + prev.href + '" class="pagination-prev">';
      html += '<span class="pagination-label">上一页</span>';
      html += '<span class="pagination-title">← ' + escapeHtml(prev.title) + '</span>';
      html += '</a>';
    } else {
      html += '<span class="pagination-prev pagination-disabled">';
      html += '<span class="pagination-label">上一页</span>';
      html += '<span class="pagination-title">—</span>';
      html += '</span>';
    }

    if (next) {
      html += '<a href="' + next.href + '" class="pagination-next">';
      html += '<span class="pagination-label">下一页</span>';
      html += '<span class="pagination-title">' + escapeHtml(next.title) + ' →</span>';
      html += '</a>';
    } else {
      html += '<span class="pagination-next pagination-disabled">';
      html += '<span class="pagination-label">下一页</span>';
      html += '<span class="pagination-title">—</span>';
      html += '</span>';
    }

    nav.innerHTML = html;

    // Insert before footer
    var footer = document.querySelector('.page-footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(nav, footer);
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function init() {
    generatePagination();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
