#!/bin/sh
# ============================================================
# backup.sh —— 备份站点数据
#
# 备份的是"改坏了就找不回来"的东西：
#   site.json      站点内容（文章、服务、链接）
#   visits.json    累计访问量
#   visits.state   访问量脚本的累计状态（丢了会从 0 重算）
#
# 用法：
#   sudo ./backup.sh
#   SRC=/var/www/example.com/assets/data DEST=/var/backups/site KEEP=30 ./backup.sh
#
# 建议 cron 每天跑一次：
#   30 4 * * * /opt/site/backup.sh >/dev/null 2>&1
# ============================================================

set -eu

SRC=${SRC:-/var/www/example.com/assets/data}
STATE=${STATE:-/var/lib/bhc/visits.state}
DEST=${DEST:-/var/backups/bhc}
KEEP=${KEEP:-14}

if [ ! -d "$SRC" ]; then
  echo "数据目录不存在：$SRC" >&2
  exit 1
fi

mkdir -p "$DEST"

stamp=$(date +%Y%m%d-%H%M%S)
out="$DEST/data-$stamp.tar.gz"

# 先归拢到临时目录，再一次性打包：
# gzip 压缩包不能追加文件，分两次 tar 会失败。
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
mkdir -p "$tmp/data"

count=0
for f in site.json visits.json; do
  if [ -f "$SRC/$f" ]; then
    cp "$SRC/$f" "$tmp/data/$f"
    count=$((count + 1))
  fi
done

if [ -f "$STATE" ]; then
  cp "$STATE" "$tmp/data/visits.state"
  count=$((count + 1))
fi

if [ "$count" -eq 0 ]; then
  echo "没有可备份的文件：$SRC" >&2
  exit 1
fi

tar -czf "$out" -C "$tmp" data

# 备份里有真实地址与联系方式，权限收紧
chmod 600 "$out"

# 只留最近 KEEP 份
if [ "$KEEP" -gt 0 ]; then
  ls -1t "$DEST"/data-*.tar.gz 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
    rm -f "$old"
  done
fi

echo "已备份 $count 个文件：$out"
