/* ============================================================
   theme.js —— 配色三态：浅色 / 深色 / 跟随系统
   选择存在 localStorage 的 bhc_theme 里；
   <html data-theme> 由 theme-boot.js 在样式表之前先设一次，
   这里负责：页头那枚循环按钮、设置面板里的三选项、跟随系统的实时响应。
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'bhc_theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var VALID = { light: 1, dark: 1, auto: 1 };
  var NAME = { light: '浅色', dark: '深色', auto: '跟随系统' };
  var ORDER = ['auto', 'light', 'dark'];

  var cycleBtn = document.getElementById('theme-cycle');

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return VALID[v] ? v : 'auto';
    } catch (err) {
      return 'auto';
    }
  }

  function resolve(pref) {
    if (pref === 'auto') return media && media.matches ? 'dark' : 'light';
    return pref;
  }

  function sync(pref) {
    root.setAttribute('data-theme-pref', pref);
    root.setAttribute('data-theme', resolve(pref));

    document.querySelectorAll('[data-theme-set]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme-set') === pref ? 'true' : 'false');
    });

    if (cycleBtn) {
      var name = NAME[pref] || NAME.auto;
      cycleBtn.setAttribute('data-theme-pref-name', name);
      cycleBtn.setAttribute('title', '配色：' + name + '（点击切换）');
      cycleBtn.setAttribute('aria-label', '配色：' + name + '，点击切换');
    }
  }

  function set(pref) {
    if (!VALID[pref]) pref = 'auto';
    try {
      localStorage.setItem(KEY, pref);
    } catch (err) {
      /* 隐私模式下写不进去也不影响本次显示 */
    }
    sync(pref);
  }

  /* 页头循环按钮：跟随系统 → 浅色 → 深色 */
  if (cycleBtn) {
    cycleBtn.addEventListener('click', function () {
      var now = stored();
      var i = ORDER.indexOf(now);
      set(ORDER[(i + 1) % ORDER.length]);
    });
  }

  /* 设置面板里的三选项：事件委托，页面上没有按钮时什么也不做 */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-theme-set]') : null;
    if (!btn) return;
    set(btn.getAttribute('data-theme-set'));
  });

  /* 跟随系统时，系统配色变了要跟着变 */
  if (media && media.addEventListener) {
    media.addEventListener('change', function () {
      if (stored() === 'auto') sync('auto');
    });
  }

  /* 其他标签页改了选择，这边同步 */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) sync(stored());
  });

  /* 供设置面板打开时刷新按钮状态 */
  window.SITE_THEME = {
    get: function () { return stored(); },
    set: set,
    sync: function () { sync(stored()); }
  };

  sync(stored());
})();
