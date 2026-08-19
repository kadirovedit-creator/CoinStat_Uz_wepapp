@echo off
chcp 65001 >nul
echo Starting CoinStat Uz Bot...
echo.

set "PY_BIN="
if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    set "PY_BIN=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
) else (
    where py >nul 2>nul && set "PY_BIN=py" || set "PY_BIN=python"
)

echo Using Python: %PY_BIN%
"%PY_BIN%" bot.py

pause
