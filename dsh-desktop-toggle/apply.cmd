@echo off
setlocal
REM Apply plugins.yml to the desktop profile (out-of-band; does not need DSH UI).
cd /d "%~dp0"
node apply.mjs %*
exit /b %ERRORLEVEL%
