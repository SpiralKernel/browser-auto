@echo off
setlocal
chcp 65001 >nul
title CAU 实验室安全课程自动学习工具
cd /d "%~dp0"

echo ========================================
echo   CAU 实验室安全课程自动学习工具
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js。
  echo 请先安装 Node.js LTS：https://nodejs.org/
  echo 安装完成后关闭此窗口，再双击 run.bat。
  goto failed
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 找不到 npm，请重新安装 Node.js LTS。
  goto failed
)

set "PLAYWRIGHT_BROWSERS_PATH=%CD%\.pw-browsers"
set "npm_config_cache=%CD%\.npm-cache"
if not exist ".pw-browsers" mkdir ".pw-browsers"
if not exist ".npm-cache" mkdir ".npm-cache"

if not exist "config.local.json" if not defined COURSE_USERNAME goto setup_config
if not exist "config.local.json" if not defined COURSE_PASSWORD goto setup_config
goto config_done

:setup_config
node setup.js
if errorlevel 1 (
  echo [错误] 账号密码配置失败。
  goto failed
)

:config_done
REM 校内课程站点在部分代理环境下无法访问，默认清除终端代理变量。
set http_proxy=
set https_proxy=
set HTTP_PROXY=
set HTTPS_PROXY=
set all_proxy=
set ALL_PROXY=

if not exist "node_modules\playwright\package.json" (
  echo.
  echo [安装 1/2] 正在安装 Playwright，请不要关闭窗口……
  call npm install
  if errorlevel 1 (
    echo [错误] Playwright 安装失败，请检查网络后重试。
    goto failed
  )
) else (
  echo [安装 1/2] Playwright 已安装。
)

echo [安装 2/2] 正在检查 Chromium，首次运行需要下载数百 MB……
call npx playwright install chromium
if errorlevel 1 (
  echo [错误] Chromium 下载失败，请检查网络后重试。
  goto failed
)

if not defined RATE set RATE=8
if not defined HEADED set HEADED=0
if not defined MODE set MODE=all
if not defined DRY set DRY=0

echo.
echo [运行] RATE=%RATE%  HEADED=%HEADED%  MODE=%MODE%
echo 运行期间请不要关闭此窗口。
echo.
node run.js
if errorlevel 1 (
  echo.
  echo [错误] 程序运行失败，请保留上方错误信息以便排查。
  goto failed
)

echo.
echo [完成] 程序已正常结束。
echo 按任意键关闭窗口……
pause >nul
exit /b 0

:failed
echo.
echo 按任意键关闭窗口……
pause >nul
exit /b 1
