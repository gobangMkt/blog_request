@echo off
setlocal
title GAS deploy - trend update
cd /d "%~dp0gas-code"
echo.
echo ===== Blog add-on tool: GAS deploy (one click) =====
echo.
echo [1/4] Checking Google login...
call clasp deployments >nul 2>nul
if not errorlevel 1 goto pushcode
echo.
echo Login expired. A browser window will open.
echo Choose your Google account and click Allow, then come back to this window.
echo.
call clasp login
if errorlevel 1 goto fail
:pushcode
echo.
echo [2/4] Uploading code...
call clasp push --force
if errorlevel 1 goto fail
echo.
echo [3/4] Deploying to the live web app (same URL)...
call clasp deploy -i AKfycbysJEvbkNX8PU7C5zcdfGqtw5xbfejQmDOIONr9PwssxwPyv2-HIQPI6uZtV2AChYS7 -d "trend: price, legacy rows, build marker"
if errorlevel 1 goto fail
echo.
echo [4/4] Verifying the live version...
curl.exe -s -L -m 60 -H "Content-Type: text/plain" -d "{\"action\":\"listStatus\",\"token\":\"x\"}" "https://script.google.com/macros/s/AKfycbysJEvbkNX8PU7C5zcdfGqtw5xbfejQmDOIONr9PwssxwPyv2-HIQPI6uZtV2AChYS7/exec" > "%TEMP%\gas_verify.txt"
findstr /c:"2026-11-15-trend2" "%TEMP%\gas_verify.txt" >nul
if errorlevel 1 goto notlive
echo.
echo ===== DONE: new version is live. Opening the page... =====
start "" "https://gobangmkt.github.io/blog_request/addon-direct-pay/paste.html"
echo.
pause
exit /b 0
:notlive
echo.
echo Deployed, but the live version did not answer with the new build marker yet.
echo Wait 1 minute and run this file again. If it still fails, send a screenshot of this window to Claude.
pause
exit /b 1
:fail
echo.
echo FAILED. Send a screenshot of this window to Claude.
pause
exit /b 1
