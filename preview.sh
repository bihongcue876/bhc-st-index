#!/usr/bin/env sh
# 起本地预览服务并打开浏览器（macOS / Linux）。
# 页面用的是 /assets/... 绝对路径，必须经 http 打开；file:// 会加载不到 CSS。
cd "$(dirname "$0")" || exit 1

PORT=8123
URL="http://localhost:$PORT/"

( sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1
  fi ) &

echo "服务地址 $URL   按 Ctrl+C 停止"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
