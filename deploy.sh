#!/bin/bash
# Деплой на VPS: синхронизирует локальную папку с /var/www/sales_trainer

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'client/dist' \
  --exclude '.DS_Store' \
  "/Users/mikhail_kuznetsov/Library/Mobile Documents/com~apple~CloudDocs/hello/claude code/004_sales_trainer/" \
  root@161.35.68.238:/var/www/sales_trainer/

echo "✓ Деплой завершён"
