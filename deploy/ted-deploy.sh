#!/usr/bin/env bash
set -Eeuo pipefail

# EC2上のGitリポジトリ
REPO="/home/ec2-user/japanese-lesson-site"

# Nginxの公開ディレクトリ
WEBROOT="/usr/share/nginx/html"

# バックアップの保存先
BACKUPS="/home/ec2-user/nginx-backups"

# GitHub Actionsから受け取るコミットSHA
SHA="${1:-}"

# 今回公開する4ファイル
FILES=(
  "index.html"
  "videos.html"
  "css/videos.css"
  "js/videos.js"
)

# SHAが40桁の16進数であることを検証
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: Invalid commit SHA"
  exit 1
fi

echo "Target commit: $SHA"
echo "Files to deploy: ${FILES[*]}"