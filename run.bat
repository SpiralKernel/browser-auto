@echo off
setlocal EnableExtensions
chcp 65001 >nul
title CAU Course Automation
cd /d "%~dp0"

echo ========================================
echo   CAU Course Automation
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node
where npm >nul 2>nul
if errorlevel 1 goto no_npm

set "PLAYWRIGHT_BROWSERS_PATH=%CD%\.pw-browsers"
set "npm_config_cache=%CD%\.npm-cache"
if not exist ".pw-browsers" mkdir ".pw-browsers"
if not exist ".npm-cache" mkdir ".npm-cache"

if not exist "config.local.json" if not defined COURSE_USERNAME goto setup_config
if not exist "config.local.json" if not defined COURSE_PASSWORD goto setup_config
goto config_done

:setup_config
node setup.js
if errorlevel 1 goto setup_failed

:config_done
set http_proxy=
set https_proxy=
set HTTP_PROXY=
set HTTPS_PROXY=
set all_proxy=
set ALL_PROXY=

if exist "node_modules\playwright\package.json" goto dependencies_ready
echo.
echo [Setup 1/2] Installing Playwright. Do not close this window...
call npm install
if errorlevel 1 goto npm_failed

:dependencies_ready
echo [Setup 1/2] Playwright is ready.
echo [Setup 2/2] Checking Chromium. The first download is several hundred MB...
call npx playwright install chromium
if errorlevel 1 goto chromium_failed

if not defined RATE set RATE=8
if not defined HEADED set HEADED=0
if not defined MODE set MODE=all
if not defined DRY set DRY=0

echo.
echo [Run] RATE=%RATE%  HEADED=%HEADED%  MODE=%MODE%
echo Keep this window open while the script is running.
echo.
node run.js
if errorlevel 1 goto run_failed

echo.
echo [Done] The program finished normally.
goto success

:no_node
echo [Error] Node.js was not found.
echo Install the Node.js LTS release from https://nodejs.org/
echo Then close this window and run run.bat again.
goto failed

:no_npm
echo [Error] npm was not found. Reinstall Node.js LTS.
goto failed

:setup_failed
echo [Error] Account setup failed.
goto failed

:npm_failed
echo [Error] npm install failed. Check the network and try again.
goto failed

:chromium_failed
echo [Error] Chromium download failed. Check the network and try again.
goto failed

:run_failed
echo.
echo [Error] The program failed. Keep the error text above for troubleshooting.
goto failed

:success
echo.
echo Press any key to close this window...
pause >nul
exit /b 0

:failed
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
