/* ============================================================
   site.js —— 全站常量 + 日期 + 配置读取 + 首页访问量
   配置只在这里读一次，页面其它脚本共用 window.SITE_CONFIG，
   避免首页反复请求同一个文件。
   ============================================================ */

window.SITE = {
  name: 'BHC-Tech',
  // 开始服务日期（YYYY-MM-DD）。数字条的“建站已 N 日”和关于页的日期都读这里。
  since: '2026-11-16',
  // 访问量数据文件。由服务器上的 tools/visits.sh 定时生成；
  // 没有这个文件时数字条保持短横线，不会出现 0。
  visitsUrl: '/assets/data/visits.json',
  // 页面内容的配置文件（服务器上维护，不进版本库）
  configUrl: '/assets/data/site.json'
};

(function () {
  'use strict';

  /* ---------- 建站日期 / 运行天数 ---------- */

  var since = new Date(window.SITE.since + 'T00:00:00');
  if (!isNaN(since.getTime())) {
    var days = Math.max(0, Math.floor((Date.now() - since.getTime()) / 86400000));
    var text =
      since.getFullYear() + ' 年 ' + (since.getMonth() + 1) + ' 月 ' + since.getDate() + ' 日';

    document.querySelectorAll('[data-since-text]').forEach(function (el) {
      el.textContent = text;
    });

    document.querySelectorAll('[data-days-since]').forEach(function (el) {
      el.textContent = String(days);
    });
  }

  /* ---------- 配置读取 ----------
     一次请求、一次校验，结果通过 window.SITE_CONFIG 交给页面脚本。
     读不到就是 null，页面各自降级，不抛错。
     --------------------------------- */

  var MAX_BYTES = 256 * 1024;

  window.SITE_CONFIG = fetch(window.SITE.configUrl, { cache: 'no-store', credentials: 'same-origin' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (raw) {
      if (raw.length > MAX_BYTES) throw new Error('配置文件过大');
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('顶层结构不对');
      return data;
    })
    .catch(function (err) {
      if (window.console && window.console.warn) {
        window.console.warn('[site] 配置读取失败：' + (err && err.message ? err.message : '未知错误'));
      }
      return null;
    });

  /* ---------- 页脚 GitHub 链接 ----------
     地址来自配置的 links.github；只认 https 外链，
     其它协议（javascript: 之类）一律不放进 href。 */
  var gh = document.querySelector('[data-github]');
  if (gh) {
    window.SITE_CONFIG.then(function (data) {
      var links = (data && data.links && typeof data.links === 'object') ? data.links : {};
      var url = typeof links.github === 'string' ? links.github.trim() : '';
      if (!url || !/^https:\/\//i.test(url) || /[\s"'<>]/.test(url)) return;
      gh.href = url;
      gh.target = '_blank';
      gh.rel = 'noopener noreferrer';
      gh.hidden = false;
    });
  }

  /* ---------- 首页访问量 ----------
     只是一个静态 json，读不到就保持短横线 —— 不猜、不显示 0。
     --------------------------------- */

  var holders = document.querySelectorAll('[data-visits]');
  if (!holders.length) return;

  fetch(window.SITE.visitsUrl, { cache: 'no-store', credentials: 'same-origin' })
    .then(function (res) {
      if (!res.ok) throw new Error('no visits data');
      return res.json();
    })
    .then(function (data) {
      var n = Number(data && data.count);
      if (!isFinite(n) || n < 0) return;
      holders.forEach(function (el) {
        el.textContent = n.toLocaleString('zh-CN');
        el.removeAttribute('title');
      });
      document.querySelectorAll('[data-visits-wrap]').forEach(function (wrap) {
        wrap.hidden = false;
      });
    })
    .catch(function () {
      /* 没有数据就保持“—”，不留空档 */
    });
})();
