@echo off
setlocal
REM Out-of-band DSH doctor — does not need the Desktop UI.
set "SCRIPT=%~dp0dsh-doctor.mjs"
where node >nul 2>&1
if errorlevel 1 (
  echo [dsh-doctor] node not found in PATH
  exit /b 1
)
node "%SCRIPT%" %*
exit /b %ERRORLEVEL%
