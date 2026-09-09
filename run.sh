#!/usr/bin/env bash
# 一键启动（macOS / Linux）
# 首次运行会自动安装 playwright 并下载 Chromium；之后直接运行。
# 用法：
#   ./run.sh                        # 无界面后台跑（默认 8 倍速）
#   HEADED=1 ./run.sh               # 打开浏览器窗口看进度（需要电脑有屏幕）
#   RATE=12 ./run.sh                # 更快
#   DRY=1 MODE=all ./run.sh         # 只列出课程，不实际播放
set -e
cd "$(dirname "$0")"

# 把浏览器和 npm 缓存放到项目内，避免系统目录只读/权限问题，也更便携
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.pw-browsers"
export npm_config_cache="$PWD/.npm-cache"
mkdir -p .pw-browsers .npm-cache

if [ ! -f config.local.json ] && { [ -z "${COURSE_USERNAME:-}" ] || [ -z "${COURSE_PASSWORD:-}" ]; }; then
  node setup.js
fi

# 去掉可能配置错/已失效的代理（这台机器就是死代理导致下载失败）
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY 2>/dev/null || true

# 首次：安装 playwright
if [ ! -d node_modules/playwright ]; then
  echo "[init] 首次运行，安装 playwright ..."
  npm install playwright
fi

# 首次：下载 Chromium 浏览器
if ! ls .pw-browsers/chromium*/chrome-linux*/chrome >/dev/null 2>&1 && \
   ! ls .pw-browsers/chromium*/chrome-mac*/Chromium.app >/dev/null 2>&1 && \
   ! ls .pw-browsers/chromium*/chrome-win*/chrome.exe >/dev/null 2>&1; then
  echo "[init] 下载 Chromium 浏览器 ..."
  npx playwright install chromium
fi

echo "[run] 开始自动学习  RATE=${RATE:-8}  HEADED=${HEADED:-0}  MODE=${MODE:-all}"
RATE="${RATE:-8}" HEADED="${HEADED:-0}" DRY="${DRY:-0}" MODE="${MODE:-all}" node run.js
