#!/usr/bin/env sh
# Запуск claude-server для курса «Градиентный бустинг по косточкам».
# Разрешает запросы со страниц курса на GitHub Pages (и с localhost / file:// — всегда).
# Нужны Node.js 18+ и выполненный вход: claude login
cd "$(dirname "$0")"
export CLAUDE_SERVER_ALLOWED_ORIGINS="${CLAUDE_SERVER_ALLOWED_ORIGINS:-https://jakharbek.github.io}"
echo "claude-server: http://127.0.0.1:8137  (разрешённые страницы: $CLAUDE_SERVER_ALLOWED_ORIGINS, localhost, file://)"
exec node server.js
