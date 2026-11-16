#!/usr/bin/env sh
# ============================================================
# visits.sh —— 统计首页访问量，写出一个静态 json 给前端读
#
# 不常驻进程、不开接口：cron 定时读 nginx 访问日志，把累计数写进
# 站点目录下的 assets/data/visits.json，页面 fetch 它。抓不到就整行隐藏。
#
# 安装（服务器上，root）：
#   sudo install -m 755 tools/visits.sh /opt/bhc/visits.sh
#   sudo crontab -e
#   # 每 10 分钟跑一次
#   */10 * * * * /opt/bhc/visits.sh
#
# 可覆盖的环境变量：
#   LOG    访问日志（默认 /var/log/nginx/access.log，需 combined 格式）
#   OUT    输出文件（默认 /var/www/example.com/assets/data/visits.json）
#   STATE  计数状态（默认 /var/lib/bhc/visits.state）
#
# 注意：脚本按 combined 格式取字段（$7 = 请求路径，$9 = 状态码）。
# 如果 nginx 里自定义过 log_format，改下面 awk 的字段号。
# ============================================================
set -eu

LOG=${LOG:-/var/log/nginx/access.log}
OUT=${OUT:-/var/www/example.com/assets/data/visits.json}
STATE=${STATE:-/var/lib/bhc/visits.state}

# 当前日志文件中，首页 200 的请求数
cur=$(awk '$9 == 200 && ($7 == "/" || $7 == "/index.html")' "$LOG" 2>/dev/null | wc -l | tr -d ' ')
cur=${cur:-0}

total=0
prev=0
if [ -f "$STATE" ]; then
  read -r total prev < "$STATE" 2>/dev/null || true
fi
total=${total:-0}
prev=${prev:-0}

# 日志轮转后 cur 会突然变小：此时把新文件里的行数整体计入，避免出现负数
if [ "$cur" -ge "$prev" ]; then
  total=$((total + cur - prev))
else
  total=$((total + cur))
fi

mkdir -p "$(dirname "$STATE")" "$(dirname "$OUT")"
printf '%s %s\n' "$total" "$cur" > "$STATE"

# 先写临时文件再 mv，避免前端读到半个 json
tmp="$OUT.tmp.$$"
printf '{"count":%s,"updated":"%s"}\n' "$total" "$(date -Iseconds)" > "$tmp"
mv "$tmp" "$OUT"
