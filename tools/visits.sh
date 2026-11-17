#!/usr/bin/env sh
# ============================================================
# visits.sh —— 统计首页访问量，写出一个静态 json 给前端读
#
# 不常驻进程、不开接口：cron 定时读 nginx 访问日志，把累计数写进
# 站点目录下的 assets/data/visits.json，页面 fetch 它。读不到显示短横线。
#
# 安装（服务器上，root）：
#   install -m 755 tools/visits.sh /opt/bhc/visits.sh
#   crontab -e
#   */10 * * * * /opt/bhc/visits.sh
# 改过本脚本要重新 install，只改仓库不生效。
#
# 可覆盖的环境变量：
#   LOG     访问日志。不填就按顺序找：
#             /var/log/nginx/bhc-st.site.access.log
#             /var/log/nginx/access.log
#             /var/log/nginx/*.access.log
#   OUT     输出文件（默认 /var/www/bhc-st-index/assets/data/visits.json）
#   STATE   累计状态（默认 /var/lib/bhc/visits.state）
#   VERBOSE 非空时把实际用的日志打到 stderr
#
# 注意：按 combined 格式取字段（$7 请求路径，$9 状态码）。
# nginx 里自定义过 log_format，要改下面 awk 的字段号。
# ============================================================
set -eu

OUT=${OUT:-/var/www/bhc-st-index/assets/data/visits.json}
STATE=${STATE:-/var/lib/bhc/visits.state}

# ---- 找日志：路径对不上，计数永远是 0 ----
LOG=${LOG:-}
if [ -z "$LOG" ]; then
  for f in "/var/log/nginx/bhc-st.site.access.log" \
           "/var/log/nginx/access.log" \
           /var/log/nginx/*.access.log; do
    if [ -r "$f" ]; then LOG=$f; break; fi
  done
fi

if [ -z "$LOG" ] || [ ! -r "$LOG" ]; then
  echo "visits.sh: 读不到 nginx 访问日志" >&2
  echo "  已试：/var/log/nginx/bhc-st.site.access.log、access.log、*.access.log" >&2
  echo "  用 LOG=/var/log/nginx/xxx.access.log 指定" >&2
  exit 1
fi

if [ -n "${VERBOSE:-}" ]; then
  echo "visits.sh: log=$LOG out=$OUT" >&2
fi

# 当前日志文件里首页 200 的条数（单进程 awk，不用 wc 与 tr）
cur=$(awk '$9 == 200 && ($7 == "/" || $7 == "/index.html") { n++ } END { print n + 0 }' "$LOG")

total=0
prev=0
if [ -f "$STATE" ]; then
  read -r total prev < "$STATE" || true
fi
total=${total:-0}
prev=${prev:-0}

# 日志轮转后 cur 会变小：按整份计入，避免出现负数
if [ "$cur" -ge "$prev" ]; then
  total=$((total + cur - prev))
else
  total=$((total + cur))
fi

mkdir -p "$(dirname "$STATE")" "$(dirname "$OUT")"
printf '%s %s\n' "$total" "$cur" > "$STATE"

# 先写临时文件再 mv，前端不会读到半个 json
tmp="$OUT.tmp.$$"
printf '{"count":%s,"updated":"%s"}\n' "$total" "$(date -Iseconds)" > "$tmp"
mv "$tmp" "$OUT"
