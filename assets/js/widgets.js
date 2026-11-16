/* ============================================================
   widgets.js —— 小组件（时钟 / 便签）
   状态全部在本机 cookie：
     bhc_widgets = 组件 id 列表（逗号分隔，"~" 表示空）
     bhc_note    = 便签内容
   首页没有"添加小组件"按钮，开关在「设置」面板里，
   所以这里把能力挂到 window.SITE_WIDGETS 上，由 settings.js 调用。
   ============================================================ */

(function () {
  'use strict';

  var band = document.getElementById('widgets-band');
  var host = document.getElementById('widgets');
  if (!band || !host) return;

  var COOKIE_IDS = 'bhc_widgets';
  var COOKIE_NOTE = 'bhc_note';
  var EMPTY = '~';
  var MAX_NOTE = 600;
  var YEAR = 365;

  /* 设置面板里露出的组件；"运行天数"已经进了首页数字条，不再重复提供 */
  var OFFERED = ['clock', 'note'];

  /* ---------- cookie ---------- */

  function readCookie(name) {
    var hit = document.cookie.split('; ').filter(function (row) {
      return row.indexOf(name + '=') === 0;
    })[0];
    if (!hit) return '';
    try {
      return decodeURIComponent(hit.slice(name.length + 1));
    } catch (err) {
      return '';
    }
  }

  function writeCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; path=/; max-age=' + YEAR * 86400 + '; SameSite=Lax';
  }

  /* ---------- 组件清单 ----------
     build(body) 拿到组件内容容器，返回可选的清理函数。
     ------------------------------------ */

  var REGISTRY = {

    clock: {
      name: '时钟',
      build: function (body) {
        var time = document.createElement('div');
        time.className = 'widget-big';
        var date = document.createElement('div');
        date.className = 'widget-label';
        body.append(time, date);

        var fTime = new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        var fDate = new Intl.DateTimeFormat('zh-CN', {
          month: 'long', day: 'numeric', weekday: 'short'
        });

        function tick() {
          var d = new Date();
          time.textContent = fTime.format(d);
          date.textContent = fDate.format(d);
        }
        tick();
        var id = setInterval(tick, 1000);
        return function () { clearInterval(id); };
      }
    },

    since: {
      name: '运行天数',
      build: function (body) {
        var num = document.createElement('div');
        num.className = 'widget-big';
        var label = document.createElement('div');
        label.className = 'widget-label';
        label.textContent = '已运行天数';
        body.append(num, label);

        var since = window.SITE && window.SITE.since;
        var t0 = since ? new Date(since + 'T00:00:00').getTime() : Date.now();
        num.textContent = String(Math.max(0, Math.floor((Date.now() - t0) / 86400000)));
      }
    },

    note: {
      name: '便签',
      build: function (body) {
        var ta = document.createElement('textarea');
        ta.rows = 3;
        ta.maxLength = MAX_NOTE;
        ta.placeholder = '写点什么…（存在本机 cookie）';
        ta.setAttribute('aria-label', '便签');
        ta.value = readCookie(COOKIE_NOTE);

        var timer = null;
        ta.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            writeCookie(COOKIE_NOTE, ta.value.slice(0, MAX_NOTE));
          }, 400);
        });
        body.append(ta);
        return function () { clearTimeout(timer); };
      }
    }

  };

  /* ---------- 状态 ---------- */

  var ids = (function () {
    var raw = readCookie(COOKIE_IDS);
    if (!raw || raw === EMPTY) return [];
    return raw.split(',').filter(function (id, i, arr) {
      return REGISTRY[id] && arr.indexOf(id) === i;
    }).filter(function (id) {
      /* 旧版可能存过 since，与数字条重复，静默迁移掉 */
      return id !== 'since';
    });
  })();

  function save() {
    writeCookie(COOKIE_IDS, ids.length ? ids.join(',') : EMPTY);
  }

  /* ---------- 渲染 ---------- */

  function makeWidget(id) {
    var def = REGISTRY[id];
    if (!def) return null;

    var el = document.createElement('div');
    el.className = 'widget' + (id === 'note' ? ' widget-note' : '');
    el.dataset.id = id;

    var head = document.createElement('div');
    head.className = 'widget-head';

    var name = document.createElement('span');
    name.className = 'widget-name';
    name.textContent = def.name;

    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'widget-remove';
    rm.textContent = '×';
    rm.title = '移除';
    rm.setAttribute('aria-label', '移除' + def.name);
    rm.addEventListener('click', function () { remove(id); });

    head.append(name, rm);

    var body = document.createElement('div');
    body.className = 'widget-body';

    el.append(head, body);
    host.appendChild(el);

    var cleanup = def.build(body);
    if (typeof cleanup === 'function') el._cleanup = cleanup;
    return el;
  }

  function refreshBand() {
    band.hidden = ids.length === 0;
  }

  function add(id) {
    if (!REGISTRY[id] || ids.indexOf(id) > -1) return;
    ids.push(id);
    save();
    makeWidget(id);
    refreshBand();
  }

  function remove(id) {
    var el = host.querySelector('.widget[data-id="' + id + '"]');
    if (el) {
      if (typeof el._cleanup === 'function') el._cleanup();
      el.remove();
    }
    ids = ids.filter(function (x) { return x !== id; });
    save();
    refreshBand();
  }

  /* ---------- 对外接口（设置面板用） ---------- */

  window.SITE_WIDGETS = {
    has: function (id) { return ids.indexOf(id) > -1; },
    list: function () { return ids.slice(); },
    add: add,
    remove: remove,
    available: function () {
      return OFFERED.filter(function (id) { return REGISTRY[id]; })
        .map(function (id) { return { id: id, name: REGISTRY[id].name }; });
    }
  };

  /* ---------- 启动 ---------- */

  save();
  ids.forEach(function (id) { makeWidget(id); });
  refreshBand();
})();
