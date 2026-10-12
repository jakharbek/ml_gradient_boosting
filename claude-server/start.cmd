@echo off
rem Запуск claude-server для курса «Градиентный бустинг по косточкам».
rem Разрешает запросы со страниц курса на GitHub Pages (и с localhost / file:// — всегда).
rem Нужны Node.js 18+ и выполненный вход: claude login
cd /d "%~dp0"
if "%CLAUDE_SERVER_ALLOWED_ORIGINS%"=="" set CLAUDE_SERVER_ALLOWED_ORIGINS=https://jakharbek.github.io
echo claude-server: http://127.0.0.1:8137  (разрешённые страницы: %CLAUDE_SERVER_ALLOWED_ORIGINS%, localhost, file://)
node server.js
pause
