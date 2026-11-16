/* ============================================================
   content.js —— 条目的数据侧：文章、服务、日期、页脚链接
   首页、文章页、服务页共用一份配置与同一套校验。

   数据来自 /assets/data/site.json（服务器上维护，不进版本库）。

   三条硬规矩（配置是"可写文件"，不能当代码看）：
     1. 一律 textContent 写入，绝不拼 HTML；
     2. 链接先过白名单：只认 http(s)、mailto 和站内路径，
        其余（javascript:、data:、vbscript: 等）直接丢弃；
     3. 字段按白名单逐个取，类型不对就当没有，长度与条数都设上限。

   失败时页面保留骨架，只把列表换成一句"暂无内容"，不抛错、不空白。
   ============================================================ */

(function () {
  'use strict';

  var MAX_ITEMS = 50;
  var MAX_TITLE = 120;
  var MAX_DESC = 240;
  var MAX_TAG = 16;
  var MAX_NAME = 40;
  var MAX_STATUS = 12;
  var PAGE_SIZE_MAX = 20;

  /* ---------------- 取值与校验 ---------------- */

  function text(value, max) {
    if (typeof value !== 'string') return '';
    // 去掉控制字符，避免把换行/退格塞进标题
    var s = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return s.length > max ? s.slice(0, max) : s;
  }

  function integer(value, fallback, min, max) {
    var n = typeof value === 'number' ? value : Number(value);
    if (!isFinite(n)) return fallback;
    n = Math.floor(n);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /* 站内路径：以单个 / 开头；不允许 //host、/../ 与反斜杠 */
  function localPath(value) {
    var s = text(value, 400);
    if (!s || s.charAt(0) !== '/') return '';
    if (s.charAt(1) === '/' || s.charAt(1) === '\\') return '';
    if (s.indexOf('..') > -1 || s.indexOf('\\') > -1) return '';
    return s;
  }

  /* 站外链接：只认 http/https/mailto，且不允许内嵌空白与引号 */
  function externalUrl(value) {
    var s = text(value, 400);
    if (!s || /[\s"'<>]/.test(s)) return '';
    if (!/^(https?:|mailto:)/i.test(s)) return '';
    return s;
  }

  function anyUrl(value) {
    return localPath(value) || externalUrl(value);
  }

  function isExternal(url) {
    return /^https?:/i.test(url);
  }

  /* 图片只允许站内路径，扩展名白名单 */
  function localImage(value) {
    var s = localPath(value);
    if (!s) return '';
    if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(s)) return '';
    return s;
  }

  function dateText(value) {
    var s = text(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  /* ---------------- 农历与日期 ----------------
     农历用浏览器内置的中国历（Intl），不引字典也不查表；
     不支持时只显示公历，不影响页面。
     -------------------------------------------- */

  var CN_DAY = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

  function lunarText(date) {
    try {
      var fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      var parts = fmt.formatToParts(date);
      var out = { year: '', month: '', day: '' };
      parts.forEach(function (p) {
        if (p.type === 'yearName') out.year = p.value;
        else if (p.type === 'month') out.month = p.value;
        else if (p.type === 'day') out.day = p.value;
      });
      var d = parseInt(out.day, 10);
      var dayCn = (d >= 1 && d <= 30) ? CN_DAY[d - 1] : out.day;
      if (!out.year || !out.month) return '';
      return out.year + '年 ' + out.month + dayCn;
    } catch (e) {
      return '';
    }
  }

  var WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function renderDate() {
    var now = new Date();
    var main = document.querySelector('[data-date]');
    if (main) {
      main.textContent = now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日';
    }
    var lunar = document.querySelector('[data-lunar]');
    if (lunar) {
      var t = lunarText(now);
      if (t) {
        lunar.textContent = t;
        lunar.hidden = false;
      }
    }
    var week = document.querySelector('[data-week]');
    if (week) {
      week.textContent = WEEK[now.getDay()];
      week.hidden = false;
    }
  }

  /* ---------------- 文章 ---------------- */

  var articleState = { items: [], pageSize: 5, page: 0 };

  function articleNode(item) {
    var li = document.createElement('li');
    li.className = 'entry';
    li.setAttribute('data-search', [item.title, item.tag, '文章'].join(' '));

    var a = document.createElement('a');
    a.href = item.url;

    var time = document.createElement('time');
    time.className = 'entry-date';
    if (item.date) {
      time.dateTime = item.date;
      time.textContent = item.date;
    }

    var main = document.createElement('span');
    main.className = 'entry-main';

    var title = document.createElement('span');
    title.className = 'entry-title';
    title.textContent = item.title;

    main.appendChild(title);

    if (item.desc) {
      var desc = document.createElement('span');
      desc.className = 'entry-desc';
      desc.textContent = item.desc;
      main.appendChild(desc);
    }

    a.appendChild(time);
    a.appendChild(main);

    if (item.tag) {
      var tag = document.createElement('span');
      tag.className = 'entry-tag';
      tag.textContent = item.tag;
      a.appendChild(tag);
    }

    li.appendChild(a);
    return li;
  }

  function renderArticles() {
    var host = document.querySelector('[data-articles]');
    if (!host) return;

    host.textContent = '';

    if (!articleState.items.length) {
      var empty = document.createElement('li');
      empty.className = 'entry-placeholder';
      empty.textContent = '还没有文章。';
      host.appendChild(empty);
      updatePager();
      return;
    }

    var size = articleState.pageSize;
    var start = articleState.page * size;
    articleState.items.slice(start, start + size).forEach(function (item) {
      host.appendChild(articleNode(item));
    });

    updatePager();
  }

  function updatePager() {
    var pager = document.querySelector('[data-pager]');
    if (!pager) return;

    var total = Math.max(1, Math.ceil(articleState.items.length / articleState.pageSize));
    pager.hidden = total < 2;

    var now = pager.querySelector('[data-page-now]');
    var tot = pager.querySelector('[data-page-total]');
    if (now) now.textContent = String(articleState.page + 1);
    if (tot) tot.textContent = String(total);

    var prev = pager.querySelector('[data-page-prev]');
    var next = pager.querySelector('[data-page-next]');
    if (prev) prev.disabled = articleState.page <= 0;
    if (next) next.disabled = articleState.page >= total - 1;
  }

  function bindPager() {
    var pager = document.querySelector('[data-pager]');
    if (!pager) return;
    var prev = pager.querySelector('[data-page-prev]');
    var next = pager.querySelector('[data-page-next]');

    if (prev) {
      prev.addEventListener('click', function () {
        if (articleState.page > 0) {
          articleState.page -= 1;
          renderArticles();
          announce();
        }
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        var total = Math.ceil(articleState.items.length / articleState.pageSize);
        if (articleState.page < total - 1) {
          articleState.page += 1;
          renderArticles();
          announce();
        }
      });
    }
  }

  /* 翻页后让标题获得焦点，读屏与键盘用户不会丢位置 */
  function announce() {
    var head = document.querySelector('#articles .section-title, .page-title');
    if (!head) return;
    head.setAttribute('tabindex', '-1');
    head.focus();
  }

  /* ---------------- 服务 ---------------- */

  function serviceNode(item) {
    var li = document.createElement('li');
    li.className = 'service';
    li.setAttribute('data-search', [item.name, item.desc, '服务'].join(' '));

    var a = document.createElement('a');
    a.className = 'service-card';
    a.href = item.url;
    if (isExternal(item.url)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }

    var shot = document.createElement('span');
    shot.className = 'service-shot';

    if (item.snapshot) {
      var img = document.createElement('img');
      img.src = item.snapshot;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 320;
      img.height = 200;
      img.addEventListener('error', function () {
        img.remove();
        shot.classList.add('service-shot-fallback');
        shot.textContent = item.initial;
      });
      shot.appendChild(img);
    } else {
      shot.classList.add('service-shot-fallback');
      shot.textContent = item.initial;
    }

    var main = document.createElement('span');
    main.className = 'service-main';

    var name = document.createElement('span');
    name.className = 'service-name';
    name.textContent = item.name;

    main.appendChild(name);

    if (item.desc) {
      var desc = document.createElement('span');
      desc.className = 'service-desc';
      desc.textContent = item.desc;
      main.appendChild(desc);
    }

    var status = document.createElement('span');
    status.className = 'service-status';
    status.textContent = item.status;
    status.setAttribute('data-state', item.state);

    a.appendChild(shot);
    a.appendChild(main);
    a.appendChild(status);
    li.appendChild(a);
    return li;
  }

  function renderServices(items) {
    var host = document.querySelector('[data-services]');
    if (!host) return;
    host.textContent = '';

    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'service-placeholder';
      empty.textContent = '还没有挂上服务。';
      host.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      host.appendChild(serviceNode(item));
    });
  }

  /* ---------------- 文案（可被配置覆盖） ---------------- */

  function applyCopy(data) {
    var tagline = document.querySelector('[data-tagline]');
    var taglineText = text(data.tagline, 40);
    if (tagline && taglineText) tagline.textContent = taglineText;

    var motto = document.querySelector('[data-motto]');
    var mottoText = text(data.motto, 120);
    if (motto && mottoText) motto.textContent = mottoText;

    var figures = (data.figures && typeof data.figures === 'object') ? data.figures : {};
    /* widget* 是新字段名；tech* 是旧配置，继续认，避免老文件失效 */
    var widgetLabel = text(figures.widgetLabel || figures.techLabel, 20);
    var widgetText = text(figures.widgetText || figures.techText, 200);

    var labelEl = document.querySelector('[data-widget-label]');
    if (labelEl && widgetLabel) labelEl.textContent = widgetLabel;

    var textEl = document.querySelector('[data-widget-text]');
    if (textEl && widgetText) textEl.textContent = widgetText;

    var configInfo = document.querySelector('[data-config-info]');
    if (configInfo) {
      var updated = text(data.updated, 40);
      var when = Date.parse(updated);
      if (isFinite(when)) {
        var d = new Date(when);
        configInfo.textContent = '内容更新于 ' + d.getFullYear() + ' 年 ' +
          (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日。';
      }
    }
  }

  /* ---------------- 解析配置 ---------------- */

  function parseArticles(raw) {
    var group = (raw && typeof raw === 'object') ? raw : {};
    var list = Array.isArray(group.items) ? group.items.slice(0, MAX_ITEMS) : [];
    var out = [];

    list.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var title = text(item.title, MAX_TITLE);
      var url = anyUrl(item.url);
      if (!title || !url) return;
      out.push({
        date: dateText(item.date),
        title: title,
        desc: text(item.desc, MAX_DESC),
        tag: text(item.tag, MAX_TAG),
        url: url
      });
    });

    return {
      items: out,
      pageSize: integer(group.pageSize, 5, 1, PAGE_SIZE_MAX)
    };
  }

  function parseServices(raw) {
    var list = Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : [];
    var out = [];

    list.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      var name = text(item.name, MAX_NAME);
      var url = anyUrl(item.url);
      if (!name || !url) return;

      var status = text(item.status, MAX_STATUS);
      var state = 'idle';
      if (status === '在线') state = 'up';
      else if (status === '维护中' || status === '维护') state = 'warn';
      else if (status === '离线') state = 'down';

      out.push({
        name: name,
        desc: text(item.desc, MAX_DESC),
        url: url,
        status: status,
        state: state,
        snapshot: localImage(item.snapshot),
        initial: name.charAt(0)
      });
    });

    return out;
  }

  /* ---------------- 启动 ---------------- */

  function notify() {
    /* 让检索重建索引：内容比检索脚本先生成的索引晚到 */
    try {
      document.dispatchEvent(new CustomEvent('site:content'));
    } catch (e) {}
  }

  function boot(data) {
    applyCopy(data);

    articleState = Object.assign(articleState, parseArticles(data.articles));
    articleState.page = 0;

    /* 页面自己可以覆盖每页条数：文章页给 data-page-size="10" 就是 10 条 */
    var listHost = document.querySelector('[data-articles]');
    if (listHost) {
      var sizeAttr = listHost.getAttribute('data-page-size');
      if (sizeAttr) {
        articleState.pageSize = integer(sizeAttr, articleState.pageSize, 1, PAGE_SIZE_MAX);
      }
    }

    renderArticles();
    renderServices(parseServices(data.services));
    notify();
  }

  function fail(why) {
    if (window.console && window.console.warn) {
      window.console.warn('[content] 配置读取失败：' + why);
    }
    var articles = document.querySelector('[data-articles]');
    if (articles) {
      articles.textContent = '';
      var li = document.createElement('li');
      li.className = 'entry-placeholder';
      li.textContent = '内容暂时不可用。';
      articles.appendChild(li);
    }
    var services = document.querySelector('[data-services]');
    if (services) {
      services.textContent = '';
      var li2 = document.createElement('li');
      li2.className = 'service-placeholder';
      li2.textContent = '内容暂时不可用。';
      services.appendChild(li2);
    }
    notify();
  }

  function load() {
    var ready = window.SITE_CONFIG;
    if (!ready || typeof ready.then !== 'function') {
      fail('配置入口缺失');
      return;
    }
    ready.then(function (data) {
      if (!data) {
        fail('配置读取失败');
        return;
      }
      boot(data);
    });
  }

  renderDate();
  bindPager();
  load();
})();
