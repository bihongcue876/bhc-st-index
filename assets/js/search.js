/* ============================================================
   search.js —— 全局检索（弹出面板）
   索引两块：
     1. 当前页面里带 data-search 的元素（标题、摘要、链接自动取）
     2. 下面的 PAGES（其他页面的固定条目）
   首页的文章与服务是脚本渲染的，比本文件跑得晚，
   所以监听 site:content 事件重建索引。

   全程本地匹配，不发请求；结果用 DOM 节点拼，不拼 HTML 字符串。
   ============================================================ */

(function () {
  'use strict';

  var overlay = document.getElementById('search-overlay');
  var trigger = document.getElementById('search-open');
  var form = document.getElementById('search');
  var input = document.getElementById('search-input');
  var panel = document.getElementById('search-results');
  if (!overlay || !trigger || !form || !input || !panel) return;

  /* 站内固定页面。加新页面在这里补一条。 */
  var PAGES = [
    { title: '文章', desc: '部署记录、配置备忘与零散想法', url: '/articles.html', kw: 'article post blog 博客 记录 笔记' },
    { title: '服务', desc: '已部署的服务入口，状态为人工标注', url: '/resources.html', kw: 'service resource tool 服务 资源 工具 下载' },
    { title: '说明', desc: '本站用途、数据与小组件处理方式', url: '/guide.html', kw: 'guide 说明 用途 数据 隐私 小组件 cookie' },
    { title: '关于', desc: '归属、开始服务日期、联系与声明', url: '/about.html', kw: 'about contact 联系 邮箱 站长 日期 声明 仓库' },
    { title: '首页', desc: '文章、服务与站点状态', url: '/', kw: 'home index 主页 首页' }
  ];

  var MAX = 8;
  var index = [];

  /* ---------- 索引 ---------- */

  function fromDom() {
    var out = [];
    document.querySelectorAll('[data-search]').forEach(function (el) {
      var link = el.querySelector('a[href]') || (el.matches('a[href]') ? el : null);
      if (!link) return;
      var titleEl = el.querySelector('.card-link, .link-title, .entry-title, .res-name, .service-name, h3') || link;
      var descEl = el.querySelector('.card-desc, .link-meta, .entry-desc, .res-desc, .service-desc');
      out.push({
        title: (titleEl.textContent || '').trim(),
        desc: descEl ? (descEl.textContent || '').trim() : '',
        url: link.getAttribute('href'),
        kw: el.getAttribute('data-search') || ''
      });
    });
    return out;
  }

  function merge(base, extra) {
    var seen = Object.create(null);
    var out = [];
    base.concat(extra).forEach(function (item) {
      if (!item || !item.title || !item.url) return;
      if (seen[item.url] !== undefined) {
        var prev = out[seen[item.url]];
        prev.kw += ' ' + item.kw;
        if (!prev.desc) prev.desc = item.desc;
        return;
      }
      seen[item.url] = out.length;
      out.push({ title: item.title, desc: item.desc, url: item.url, kw: item.kw });
    });
    return out;
  }

  function rebuild() {
    index = merge(fromDom(), PAGES);
    if (input.value.trim()) render(input.value);
  }

  /* ---------- 匹配 ---------- */

  function score(item, q) {
    var t = item.title.toLowerCase();
    var d = item.desc.toLowerCase();
    var k = item.kw.toLowerCase();
    var s = 0;
    if (t === q) s += 12;
    if (t.indexOf(q) === 0) s += 6;
    else if (t.indexOf(q) > -1) s += 4;
    if (k.indexOf(q) > -1) s += 3;
    if (d.indexOf(q) > -1) s += 2;
    if (item.url.toLowerCase().indexOf(q) > -1) s += 1;
    return s;
  }

  function search(q) {
    return index.map(function (item) {
      return { item: item, s: score(item, q) };
    }).filter(function (r) {
      return r.s > 0;
    }).sort(function (a, b) {
      return b.s - a.s;
    }).slice(0, MAX).map(function (r) {
      return r.item;
    });
  }

  /* ---------- 渲染 ---------- */

  /* 把命中片段包进 <mark>，全程用文本节点，不碰 innerHTML */
  function marked(text, q) {
    var frag = document.createDocumentFragment();
    var lower = text.toLowerCase();
    var at = q ? lower.indexOf(q) : -1;
    if (at < 0) {
      frag.appendChild(document.createTextNode(text));
      return frag;
    }
    frag.appendChild(document.createTextNode(text.slice(0, at)));
    var mark = document.createElement('mark');
    mark.textContent = text.slice(at, at + q.length);
    frag.appendChild(mark);
    frag.appendChild(document.createTextNode(text.slice(at + q.length)));
    return frag;
  }

  var results = [];
  var active = -1;

  function render(query) {
    var q = query.trim().toLowerCase();
    active = -1;
    results = q ? search(q) : [];

    if (!q) {
      panel.hidden = true;
      panel.textContent = '';
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    panel.textContent = '';

    if (!results.length) {
      var empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = '没有匹配的结果。试试「文章」「服务」「关于」。';
      panel.appendChild(empty);
      return;
    }

    results.forEach(function (item, i) {
      var a = document.createElement('a');
      a.className = 'search-result';
      a.setAttribute('role', 'option');
      a.setAttribute('tabindex', '-1');
      a.setAttribute('aria-selected', 'false');
      a.setAttribute('data-i', String(i));
      a.href = item.url;

      var title = document.createElement('span');
      title.className = 'search-result-title';
      title.appendChild(marked(item.title, q));

      a.appendChild(title);

      if (item.desc) {
        var desc = document.createElement('span');
        desc.className = 'search-result-desc';
        desc.textContent = item.desc;
        a.appendChild(desc);
      }

      panel.appendChild(a);
    });
  }

  function options() {
    return Array.prototype.slice.call(panel.querySelectorAll('.search-result'));
  }

  function select(i) {
    var opts = options();
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach(function (el, k) {
      el.setAttribute('aria-selected', k === active ? 'true' : 'false');
    });
    opts[active].scrollIntoView({ block: 'nearest' });
  }

  function go(i) {
    var target = results[i] || results[0];
    if (!target) return;
    window.location.href = target.url;
  }

  /* ---------- 开关 ---------- */

  var lastFocus = null;

  function open() {
    if (!overlay.hidden) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    input.focus();
    input.select();
  }

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    active = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- 事件 ---------- */

  trigger.addEventListener('click', open);

  input.addEventListener('input', function () {
    render(input.value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      go(active < 0 ? 0 : active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  /* 结果区点击（用事件委托，避免给每条结果挂监听） */
  panel.addEventListener('click', function (e) {
    var hit = e.target.closest ? e.target.closest('.search-result') : null;
    if (!hit) return;
    e.preventDefault();
    go(parseInt(hit.getAttribute('data-i'), 10) || 0);
  });

  /* 鼠标移到结果上就选中，键盘与鼠标互不打架 */
  panel.addEventListener('mousemove', function (e) {
    var hit = e.target.closest ? e.target.closest('.search-result') : null;
    if (!hit) return;
    var i = parseInt(hit.getAttribute('data-i'), 10);
    if (isFinite(i) && i !== active) select(i);
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    var key = (e.key || '').toLowerCase();
    var typing = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '') || e.target.isContentEditable;

    if (key === 'escape' && !overlay.hidden) {
      e.preventDefault();
      close();
      return;
    }
    if (typing) return;

    if (key === '/' || ((e.ctrlKey || e.metaKey) && key === 'k')) {
      e.preventDefault();
      open();
    }
  });

  /* 首页内容后到：文章与服务渲染完再重建一次索引 */
  document.addEventListener('site:content', rebuild);

  rebuild();
})();
