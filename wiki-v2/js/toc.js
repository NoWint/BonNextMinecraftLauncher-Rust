// ========================================
// BonNext Wiki v2 - Table of Contents Module
// Auto-generates TOC from H2/H3, highlights on scroll
// ========================================

(function() {
  'use strict';

  function generateTOC() {
    var article = document.querySelector('.article-content');
    if (!article) return;

    var headings = article.querySelectorAll('h2, h3');
    if (headings.length < 2) return; // Don't show TOC for short articles

    var toc = document.createElement('nav');
    toc.className = 'toc';
    toc.innerHTML = '<div class="toc-title">目录</div>';

    var list = document.createElement('ul');
    list.className = 'toc-list';

    headings.forEach(function(heading, index) {
      // Assign ID if not present
      if (!heading.id) {
        heading.id = 'heading-' + index;
      }

      var li = document.createElement('li');
      li.className = 'toc-item toc-' + heading.tagName.toLowerCase();

      var a = document.createElement('a');
      a.href = '#' + heading.id;
      a.textContent = heading.textContent;
      a.dataset.target = heading.id;

      a.addEventListener('click', function(e) {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, null, '#' + heading.id);
      });

      li.appendChild(a);
      list.appendChild(li);
    });

    toc.appendChild(list);

    // Insert TOC before article
    var content = document.getElementById('content');
    if (content) {
      var articleEl = content.querySelector('.article-content');
      if (articleEl) {
        content.insertBefore(toc, articleEl);
      }
    }

    return toc;
  }

  function initScrollSpy() {
    var tocItems = document.querySelectorAll('.toc-item a');
    if (tocItems.length === 0) return;

    var headings = [];
    tocItems.forEach(function(item) {
      var target = document.getElementById(item.dataset.target);
      if (target) headings.push({ el: target, link: item });
    });

    var activeLink = null;

    function onScroll() {
      var scrollPos = window.scrollY + 120;
      var current = null;

      for (var i = headings.length - 1; i >= 0; i--) {
        if (headings[i].el.offsetTop <= scrollPos) {
          current = headings[i].link;
          break;
        }
      }

      if (current !== activeLink) {
        if (activeLink) activeLink.parentElement.classList.remove('active');
        if (current) current.parentElement.classList.add('active');
        activeLink = current;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // Initial check
  }

  function init() {
    generateTOC();
    initScrollSpy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
