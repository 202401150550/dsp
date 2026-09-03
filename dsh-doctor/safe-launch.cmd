@echo off
setlocal
REM Safe launch: clear hot mounts, drop ELECTRON_RUN_AS_NODE, start DSH Desktop.
call "%~dp0dsh-doctor.cmd" safe-launch
exit /b %ERRORLEVEL%
