@echo off
REM 一键启动（Windows）。首次运行自动装 playwright 并下载 Chromium。
REM 用法：
REM   run.bat                      无界面后台跑（默认 8 倍速）
REM   set HEADED=1 && run.bat      打开浏览器窗口看进度
REM   set RATE=12 && run.bat       更快
REM   set DRY=1 && run.bat         只列出课程，不实际播放
cd /d "%~dp0"

set PLAYWRIGHT_BROWSERS_PATH=%CD%\.pw-browsers
set npm_config_cache=%CD%\.npm-cache
if not exist .pw-browsers mkdir .pw-browsers
if not exist .npm-cache mkdir .npm-cache

if not exist config.local.json (
  if not defined COURSE_USERNAME (
    node setup.js
    if errorlevel 1 (
      pause
      exit /b 1
    )
  )
)

REM 去掉可能失效的代理
set http_proxy=
set https_proxy=
set HTTP_PROXY=
set HTTPS_PROXY=
set all_proxy=
set ALL_PROXY=

if not exist node_modules\playwright (
  echo [init] 安装 playwright ...
  call npm install playwright
)

if not exist .pw-browsers\chromium-1243 (
  echo [init] 下载 Chromium ...
  call npx playwright install chromium
)

if not defined RATE set RATE=8
if not defined HEADED set HEADED=0
if not defined MODE set MODE=all
if not defined DRY set DRY=0

echo [run] 开始自动学习  RATE=%RATE%  HEADED=%HEADED%  MODE=%MODE%
set RATE=%RATE% & set HEADED=%HEADED% & set DRY=%DRY% & set MODE=%MODE%
node run.js
