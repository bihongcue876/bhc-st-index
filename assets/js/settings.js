/* ============================================================
   settings.js —— 设置面板
   只做三件事：开关面板、列出小组件开关、恢复默认。
   配色按钮由 theme.js 的事件委托处理（data-theme-set），这里不重复实现。
   所有状态都在本机：localStorage 存配色，cookie 存小组件。
   ============================================================ */

(function () {
  'use strict';

  var overlay = document.getElementById('settings-overlay');
  var openBtn = document.getElementById('settings-open');
  if (!overlay || !openBtn) return;

  var closeBtn = overlay.querySelector('[data-settings-close]');
  var resetBtn = overlay.querySelector('[data-settings-reset]');
  var widgetHost = overlay.querySelector('[data-widget-options]');
  var lastFocus = null;

  var THEME_KEY = 'bhc_theme';
  var COOKIE_IDS = 'bhc_widgets';
  var COOKIE_NOTE = 'bhc_note';

  /* ---------------- 小组件开关 ---------------- */

  function buildWidgets() {
    if (!widgetHost) return;
    widgetHost.textContent = '';

    var api = window.SITE_WIDGETS;
    if (!api) {
      var hint = document.createElement('li');
      hint.className = 'check-empty';
      hint.textContent = '小组件只在首页显示。';
      widgetHost.appendChild(hint);
      return;
    }

    var list = api.available();
    if (!list.length) {
      var none = document.createElement('li');
      none.className = 'check-empty';
      none.textContent = '没有可添加的组件。';
      widgetHost.appendChild(none);
      return;
    }

    list.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'check-item';

      var label = document.createElement('label');
      label.className = 'check-label';

      var box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'check-box';
      box.checked = api.has(item.id);
      box.addEventListener('change', function () {
        if (box.checked) api.add(item.id);
        else api.remove(item.id);
      });

      var name = document.createElement('span');
      name.className = 'check-name';
      name.textContent = item.name;

      label.appendChild(box);
      label.appendChild(name);
      li.appendChild(label);
      widgetHost.appendChild(li);
    });
  }

  /* ---------------- 开合 ---------------- */

  function initTheme() {
    if (window.SITE_THEME && window.SITE_THEME.sync) window.SITE_THEME.sync();
  }

  function open() {
    if (!overlay.hidden) return;
    lastFocus = document.activeElement;
    buildWidgets();
    initTheme();
    overlay.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';

    var first = overlay.querySelector('button, input, a[href]');
    if (first) first.focus();
  }

  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  openBtn.addEventListener('click', function () {
    if (overlay.hidden) open();
    else close();
  });

  if (closeBtn) closeBtn.addEventListener('click', close);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) {
      e.preventDefault();
      close();
    }
  });

  /* ---------------- 恢复默认 ---------------- */

  function dropCookie(name) {
    document.cookie = name + '=; path=/; max-age=0; SameSite=Lax';
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      try {
        localStorage.removeItem(THEME_KEY);
      } catch (e) {}
      dropCookie(COOKIE_IDS);
      dropCookie(COOKIE_NOTE);
      close();
      window.location.reload();
    });
  }
})();
