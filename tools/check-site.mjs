#!/usr/bin/env node
/* ============================================================
   check-site.mjs —— 部署前校验 site.json
   用法：
     node tools/check-site.mjs                     # 校验 assets/data/site.json
     node tools/check-site.mjs path/to/site.json   # 校验指定文件
     node tools/check-site.mjs --json               # 机器可读结果

   规则与 assets/js/content.js 保持一致：
     · 链接只认 http(s)、mailto 与站内 /path
     · 图片只认站内路径与常见扩展名
     · 标题、摘要、条数、页大小都有上限
   改动一处的规则，记得同步另一处。
   ============================================================ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = resolve(HERE, '..', 'assets', 'data', 'site.json');

const LIMIT = {
  title: 120,
  desc: 240,
  tag: 16,
  name: 40,
  status: 12,
  items: 50,
  pageSize: 20,
  fileBytes: 256 * 1024
};

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--')) || DEFAULT_FILE;

const errors = [];
const notes = [];

function fail(path, message, value) {
  errors.push({ path, message, value });
}

/* ---------------- 基础判定 ---------------- */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function textOf(v) {
  return typeof v === 'string' ? v : '';
}

function checkText(path, v, max, required) {
  if (v === undefined) {
    if (required) fail(path, '缺少必填字段');
    return;
  }
  if (typeof v !== 'string') {
    fail(path, '应为字符串', typeof v);
    return;
  }
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (required && !s) fail(path, '不能为空');
  if (s.length > max) fail(path, `超过 ${max} 字（当前 ${s.length}）`);
}

function localPath(v) {
  const s = textOf(v).trim();
  if (!s || s.charAt(0) !== '/') return '';
  if (s.charAt(1) === '/' || s.charAt(1) === '\\') return '';
  if (s.includes('..') || s.includes('\\')) return '';
  return s;
}

function externalUrl(v) {
  const s = textOf(v).trim();
  if (!s || /[\s"'<>]/.test(s)) return '';
  if (!/^(https?:|mailto:)/i.test(s)) return '';
  return s;
}

function checkUrl(path, v, required) {
  if (v === undefined) {
    if (required) fail(path, '缺少必填字段');
    return '';
  }
  if (typeof v !== 'string') {
    fail(path, '应为字符串');
    return '';
  }
  const local = localPath(v);
  if (local) return local;
  const ext = externalUrl(v);
  if (ext) return ext;
  fail(path, '不是允许的地址（只认 http(s)、mailto、站内 /path）', v);
  return '';
}

function checkImage(path, v) {
  if (v === undefined || v === null || v === '') return;
  if (typeof v !== 'string') {
    fail(path, '应为字符串');
    return;
  }
  const s = localPath(v);
  if (!s) {
    fail(path, '图片必须是站内路径', v);
    return;
  }
  if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(s)) {
    fail(path, '图片扩展名不在白名单内', v);
  }
}

/* ---------------- 主流程 ---------------- */

let raw;
try {
  raw = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`读不到文件：${file}`);
  process.exit(2);
}

if (Buffer.byteLength(raw, 'utf8') > LIMIT.fileBytes) {
  console.error(`文件过大：超过 ${LIMIT.fileBytes / 1024} KB`);
  process.exit(2);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`JSON 语法错误：${e.message}`);
  process.exit(1);
}

if (!isPlainObject(data)) {
  console.error('顶层必须是对象');
  process.exit(1);
}

/* version / updated */
if (data.version !== undefined && !Number.isInteger(data.version)) {
  fail('version', '应为整数', data.version);
}
if (data.updated !== undefined) {
  if (typeof data.updated !== 'string' || Number.isNaN(Date.parse(data.updated))) {
    fail('updated', '应为可解析的时间字符串，例如 2026-11-16T18:00:00+08:00', data.updated);
  }
}

/* 文案 */
checkText('tagline', data.tagline, 40, false);
checkText('motto', data.motto, 120, false);

/* figures */
if (data.figures !== undefined) {
  if (!isPlainObject(data.figures)) {
    fail('figures', '应为对象');
  } else {
    checkText('figures.widgetLabel', data.figures.widgetLabel ?? data.figures.techLabel, 20, false);
    checkText('figures.widgetText', data.figures.widgetText ?? data.figures.techText, 200, false);
  }
}

/* articles */
let articleCount = 0;
if (data.articles !== undefined) {
  if (!isPlainObject(data.articles)) {
    fail('articles', '应为对象');
  } else {
    const ps = data.articles.pageSize;
    if (ps !== undefined && (!Number.isInteger(ps) || ps < 1 || ps > LIMIT.pageSize)) {
      fail('articles.pageSize', `应为 1–${LIMIT.pageSize} 的整数`, ps);
    }
    const items = data.articles.items;
    if (items === undefined) {
      fail('articles.items', '缺少字段，没有内容时请写 []');
    } else if (!Array.isArray(items)) {
      fail('articles.items', '应为数组');
    } else {
      if (items.length > LIMIT.items) {
        fail('articles.items', `最多 ${LIMIT.items} 条（当前 ${items.length}）`);
      }
      items.forEach((item, i) => {
        const at = `articles.items[${i}]`;
        if (!isPlainObject(item)) {
          fail(at, '应为对象');
          return;
        }
        checkText(`${at}.title`, item.title, LIMIT.title, true);
        checkUrl(`${at}.url`, item.url, true);
        checkText(`${at}.desc`, item.desc, LIMIT.desc, false);
        checkText(`${at}.tag`, item.tag, LIMIT.tag, false);
        if (item.date !== undefined && item.date !== '') {
          if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
            fail(`${at}.date`, '应为 YYYY-MM-DD', item.date);
          } else if (Number.isNaN(Date.parse(item.date + 'T00:00:00'))) {
            fail(`${at}.date`, '不是有效日期', item.date);
          }
        }
        articleCount += 1;
      });
    }
  }
}

/* services */
let serviceCount = 0;
if (data.services !== undefined) {
  if (!Array.isArray(data.services)) {
    fail('services', '应为数组');
  } else {
    if (data.services.length > LIMIT.items) {
      fail('services', `最多 ${LIMIT.items} 项（当前 ${data.services.length}）`);
    }
    data.services.forEach((item, i) => {
      const at = `services[${i}]`;
      if (!isPlainObject(item)) {
        fail(at, '应为对象');
        return;
      }
      checkText(`${at}.name`, item.name, LIMIT.name, true);
      checkUrl(`${at}.url`, item.url, true);
      checkText(`${at}.desc`, item.desc, LIMIT.desc, false);
      checkText(`${at}.status`, item.status, LIMIT.status, false);
      checkImage(`${at}.snapshot`, item.snapshot);
      serviceCount += 1;
    });
  }
}

/* links */
if (data.links !== undefined) {
  if (!isPlainObject(data.links)) {
    fail('links', '应为对象');
  } else if (data.links.github !== undefined && data.links.github !== '') {
    const v = data.links.github;
    if (typeof v !== 'string' || !/^https:\/\//i.test(v) || /[\s"'<>]/.test(v)) {
      fail('links.github', '只接受 https 地址', v);
    }
  }
}

/* ---------------- 输出 ---------------- */

const result = {
  file,
  ok: errors.length === 0,
  counts: { articles: articleCount, services: serviceCount },
  errors,
  notes
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`检查 ${file}`);
  errors.forEach((e) => {
    console.log(`  ✗ ${e.path}：${e.message}${e.value === undefined ? '' : `（当前值 ${JSON.stringify(e.value)}）`}`);
  });
  notes.forEach((n) => console.log(`  · ${n}`));
  if (errors.length) {
    console.log(`\n未通过：${errors.length} 处需要修正。改完再跑一次。`);
  } else {
    console.log(`  ✓ 文章 ${articleCount} 条，服务 ${serviceCount} 项`);
    console.log('\n通过：可以部署。');
  }
}

process.exit(errors.length ? 1 : 0);
