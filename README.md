# BHC-Tech 主页

手写静态页，nginx 托管。无构建、无外部依赖，字体用系统的。

## 文件

```
index.html            首页
articles.html         文章
resources.html        服务（地址沿用旧名）
guide.html            说明
about.html            关于
404.html              错误页

assets/css/base.css   结构
assets/css/theme.css  视觉
assets/css/pages.css  分页面
assets/js/site.js     站名、建站日期、配置读取、访问量
assets/js/content.js  文章/服务/日期渲染与校验
assets/js/theme.js    配色三态
assets/js/theme-boot.js  样式表之前定配色
assets/js/search.js   检索
assets/js/widgets.js  小组件
assets/js/settings.js 设置面板

assets/data/site.json          内容配置（不进仓库）
assets/data/site.example.json  模板
assets/data/visits.json        访问量（脚本生成）

nginx/site.conf                参考配置
nginx/security-headers.conf    CSP 等响应头
tools/visits.sh                访问量统计
tools/check-site.mjs           配置校验
tools/backup.sh                数据备份
preview.cmd / preview.sh       本地预览
```

## 本地预览

```bash
cd pages
python -m http.server 8123 --bind 127.0.0.1
```

页面用 `/assets/...` 根路径，双击 html（`file://`）会丢样式，必须起服务。

## 配置

改 `assets/data/site.json`，字段：`tagline`、`motto`、`figures`、`articles`、`services`、`links`。改完跑一次：

```bash
node tools/check-site.mjs
```

它按页面同一套规则查协议、图片、长度与条数，报错直接指到字段。

## 安全

- 一律 `textContent` 渲染，没有 `innerHTML`、没有 `eval`。
- 链接只认 `http(s)`、`mailto` 与站内 `/path`；图片只认站内路径。
- 安全策略不放 JSON：配置公开且可写，安全固定在 nginx 与代码里。
- `security-headers.conf` 提供 CSP（禁内联脚本与样式）、COOP/CORP、Permissions-Policy、nosniff。
- `site.json`、`visits.json` 不缓存；`/assets/data/` 其余请求 404；`/tools/`、`/nginx/`、文档 404。

## 上线

```bash
node tools/check-site.mjs
# --exclude 必须写：site.json 与 visits.json 只在服务器上，别让 --delete 删掉
rsync -avz --delete \
  --exclude='assets/data/site.json' \
  --exclude='assets/data/visits.json' \
  ./ user@server:/var/www/site/
sudo cp nginx/site.conf /etc/nginx/sites-available/site
sudo cp nginx/security-headers.conf /etc/nginx/snippets/site-security.conf
sudo ln -s /etc/nginx/sites-available/site /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d 你的域名
```

改 `server_name`、`root`、证书路径与 `include` 路径。

## 定时任务

```bash
*/10 * * * * /opt/bhc/visits.sh    # 访问量，写 assets/data/visits.json
30 4  * * * /opt/bhc/backup.sh     # 备份配置与访问量，留最近 14 份
```

`visits.sh` 默认写 `/var/www/bhc-st-index/assets/data/visits.json`，
日志按 `bhc-st.site.access.log` → `access.log` → `*.access.log` 顺序找。
发布目录或日志名不同，就在 crontab 里加 `OUT=` 或 `LOG=`。
改过脚本要重新 `install` 到 `/opt`，只改仓库不生效。

