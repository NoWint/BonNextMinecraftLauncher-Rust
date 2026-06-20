const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CONTENT_DIR = path.join(__dirname, 'content');
const DIST_DIR = path.join(__dirname, 'dist');
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const CSS_SRC = path.join(__dirname, 'css', 'style.css');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyAssets() {
  const cssDist = path.join(DIST_DIR, 'css');
  ensureDir(cssDist);
  fs.copyFileSync(CSS_SRC, path.join(cssDist, 'style.css'));

  const jsSrc = path.join(__dirname, 'js');
  const jsDist = path.join(DIST_DIR, 'js');
  if (fs.existsSync(jsSrc)) {
    ensureDir(jsDist);
    fs.readdirSync(jsSrc).forEach(function(file) {
      if (file.endsWith('.js')) {
        fs.copyFileSync(path.join(jsSrc, file), path.join(jsDist, file));
      }
    });
  }
}

function scanContent(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = scanContent(fullPath, relativePath);
      items.push({
        type: 'folder',
        name: entry.name,
        displayName: extractDisplayName(entry.name),
        path: relativePath,
        children: children
      });
    } else if (entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const title = extractTitle(content) || extractDisplayName(entry.name);
      items.push({
        type: 'file',
        name: entry.name,
        displayName: title,
        path: relativePath,
        content: content,
        slug: generateSlug(relativePath)
      });
    }
  }

  items.sort((a, b) => {
    const numA = extractNumber(a.name);
    const numB = extractNumber(b.name);
    if (numA !== null && numB !== null) return numA - numB;
    if (numA !== null) return -1;
    if (numB !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

function extractDisplayName(filename) {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '');
}

function extractNumber(filename) {
  const match = filename.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function generateSlug(relativePath) {
  return relativePath
    .replace(/\.md$/, '.html')
    .replace(/\\/g, '/');
}

function getBasePath(slug) {
  const depth = slug.split('/').length - 1;
  return depth > 0 ? '../'.repeat(depth) : './';
}

function buildNavigation(tree, currentSlug, level = 0) {
  let html = '';

  for (const item of tree) {
    if (item.type === 'folder') {
      const hasActiveChild = hasActiveDescendant(item, currentSlug);
      const collapsed = level > 0 && !hasActiveChild ? 'collapsed' : '';
      const chevronCollapsed = collapsed ? 'collapsed' : '';

      html += `<div class="nav-group">`;
      html += `<div class="nav-group-header">`;
      html += `<span class="chevron ${chevronCollapsed}">▼</span>`;
      html += `<span>${escapeHtml(item.displayName)}</span>`;
      html += `</div>`;
      html += `<div class="nav-group-children ${collapsed}">`;
      html += buildNavigation(item.children, currentSlug, level + 1);
      html += `</div></div>`;
    } else {
      const isActive = item.slug === currentSlug;
      const basePath = getBasePath(currentSlug);
      html += `<a href="${basePath}${item.slug}" class="nav-item${isActive ? ' active' : ''}">${escapeHtml(item.displayName)}</a>`;
    }
  }

  return html;
}

function hasActiveDescendant(item, currentSlug) {
  if (item.type === 'file') return item.slug === currentSlug;
  return item.children.some(child => hasActiveDescendant(child, currentSlug));
}

function buildBreadcrumb(tree, currentSlug) {
  const path = findPath(tree, currentSlug);
  if (!path || path.length === 0) return '';

  let html = '<a href="./index.html">首页</a>';
  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    html += ' <span class="sep">/</span> ';
    if (i === path.length - 1) {
      html += `<span>${escapeHtml(item.displayName)}</span>`;
    } else {
      const basePath = getBasePath(currentSlug);
      html += `<a href="${basePath}${item.slug}">${escapeHtml(item.displayName)}</a>`;
    }
  }
  return html;
}

function findPath(tree, currentSlug) {
  for (const item of tree) {
    if (item.type === 'file' && item.slug === currentSlug) {
      return [item];
    }
    if (item.type === 'folder') {
      const childPath = findPath(item.children, currentSlug);
      if (childPath) {
        return [item, ...childPath];
      }
    }
  }
  return null;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generatePage(template, item, tree) {
  const htmlContent = marked.parse(item.content);
  const navigation = buildNavigation(tree, item.slug);
  const breadcrumb = buildBreadcrumb(tree, item.slug);
  const basePath = getBasePath(item.slug);
  const lastUpdated = new Date().toLocaleDateString('zh-CN');

  return template
    .replace(/\{\{title\}\}/g, item.displayName)
    .replace(/\{\{content\}\}/g, htmlContent)
    .replace(/\{\{navigation\}\}/g, navigation)
    .replace(/\{\{breadcrumb\}\}/g, breadcrumb)
    .replace(/\{\{basePath\}\}/g, basePath)
    .replace(/\{\{lastUpdated\}\}/g, lastUpdated);
}

function generateIndex(template, tree) {
  const firstFile = findFirstFile(tree);
  if (firstFile) {
    return generatePage(template, firstFile, tree);
  }

  const navigation = buildNavigation(tree, '');
  return template
    .replace(/\{\{title\}\}/g, '首页')
    .replace(/\{\{content\}\}/g, '<h1>BonNext Wiki</h1><p>欢迎来到 BonNext 项目文档。</p>')
    .replace(/\{\{navigation\}\}/g, navigation)
    .replace(/\{\{breadcrumb\}\}/g, '<span>首页</span>')
    .replace(/\{\{basePath\}\}/g, './')
    .replace(/\{\{lastUpdated\}\}/g, new Date().toLocaleDateString('zh-CN'));
}

function findFirstFile(tree) {
  for (const item of tree) {
    if (item.type === 'file') return item;
    if (item.type === 'folder') {
      const found = findFirstFile(item.children);
      if (found) return found;
    }
  }
  return null;
}

function writePages(tree, template) {
  for (const item of tree) {
    if (item.type === 'folder') {
      writePages(item.children, template);
    } else {
      const pageHtml = generatePage(template, item, tree);
      const outputPath = path.join(DIST_DIR, item.slug);
      ensureDir(path.dirname(outputPath));
      fs.writeFileSync(outputPath, pageHtml, 'utf-8');
      console.log('Generated:', item.slug);
    }
  }
}

function build() {
  console.log('Building BonNext Wiki...');

  cleanDist();
  copyAssets();

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const tree = scanContent(CONTENT_DIR);

  writePages(tree, template);

  const indexHtml = generateIndex(template, tree);
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), indexHtml, 'utf-8');
  console.log('Generated: index.html');

  console.log('\nBuild complete! Output in dist/');
}

function watch() {
  build();
  console.log('\nWatching for changes...');

  const watcher = fs.watch(CONTENT_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      console.log(`\n[${new Date().toLocaleTimeString()}] ${eventType}: ${filename}`);
      try {
        build();
      } catch (err) {
        console.error('Build error:', err.message);
      }
    }
  });

  process.on('SIGINT', () => {
    console.log('\nStopping watcher...');
    watcher.close();
    process.exit(0);
  });
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  watch();
} else {
  build();
}
