@echo off
setlocal
cd /d "%~dp0"
node adopt.mjs %*
exit /b %ERRORLEVEL%
