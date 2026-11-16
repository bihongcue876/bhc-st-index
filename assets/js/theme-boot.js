/* ============================================================
   theme-boot.js —— 在样式表之前把配色定下来
   为什么要单独一个文件：
     以前这段是 <head> 里的内联脚本，虽然省一次请求，
     但只要上 CSP（script-src 'self'）就会被拦掉。
     改成本文件、用同步方式放在 <link rel="stylesheet"> 之前，
     执行时机不变（仍然阻塞渲染），也不需要放开内联脚本。
   只做一件事：算出 data-theme（light / dark），
   按钮状态与"跟随系统"的实时响应交给 theme.js。
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'bhc_theme';
  var root = document.documentElement;

  var pref = 'auto';
  try {
    var stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') pref = stored;
  } catch (e) {
    /* 隐私模式读不到 localStorage，按跟随系统处理 */
  }

  var dark = false;
  try {
    dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) {}

  root.setAttribute('data-theme-pref', pref);
  root.setAttribute('data-theme', pref === 'auto' ? (dark ? 'dark' : 'light') : pref);
})();
