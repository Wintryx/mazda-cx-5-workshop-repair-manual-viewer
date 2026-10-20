@echo off
setlocal enabledelayedexpansion
title Mazda CX-5 Service Manual Viewer

echo ========================================================
echo   Mazda CX-5 (2.2 Skyactiv-D) Interaktiver PDF-Viewer
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

for /f "tokens=*" %%v in ('node --version') do set "NODEVER=%%v"
echo Node.js !NODEVER! gefunden.
echo Starte Server mit automatischem Port-Fallback ...
echo.

node server.js --open
set "EXITCODE=%errorlevel%"

if exist ".active_port" (
    set /p "PORT="<.active_port
    echo.
    echo Server beendet. Zuletzt genutzter Port: !PORT!
)

if not "%EXITCODE%"=="0" (
    echo Hinweis: Beendet mit Code %EXITCODE% - bei Strg+C ist das normal.
    echo Bei einer Fehlermeldung oben: Datenverzeichnis data\ pruefen.
)

echo.
pause
exit /b %EXITCODE%

:nonode
echo.
echo FEHLER: Node.js wurde nicht gefunden.
echo Bitte von https://nodejs.org installieren (LTS, mindestens v18)
echo und danach dieses Fenster erneut starten.
echo.
pause
exit /b 1
