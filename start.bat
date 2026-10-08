@echo off
REM Starts the Mari Avatar Viewer. Double-click this file.
REM
REM It only serves this folder and opens a browser: a file:// page cannot load
REM the kind of scripts the viewer uses, so it needs a little web server. A port
REM can be forced if you need one:  start.bat 9000
setlocal
cd /d "%~dp0"
title Mari Avatar Viewer

where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py %*
  goto done
)

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py %*
  goto done
)

where npx >nul 2>nul
if %errorlevel%==0 (
  echo Python was not found, using Node instead.
  npx --yes serve -l 8080 .
  goto done
)

echo.
echo   Python is not installed on this computer yet.
echo.
echo   Open the Start menu, type:   python
echo   and press Enter. The Microsoft Store will offer to install it.
echo   Install it, then double-click start.bat again.
echo.
echo   Step 2 of README.md walks through it.
echo.

:done
echo.
echo   The viewer has stopped. You can close this window.
pause >nul
