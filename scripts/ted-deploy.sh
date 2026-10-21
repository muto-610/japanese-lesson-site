#!/usr/bin/env bash
set -Eeuo pipefail

REPO="/home/ec2-user/japanese-lesson-site"
WEBROOT="/usr/share/nginx/html"
TARGET="$WEBROOT/index.html"
BACKUPS="/home/ec2-user/nginx-backups"

SHA="${1:-}"

# GitコミットIDを検証
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: Invalid commit SHA"
  exit 1
fi

# GitHubから情報を取得
runuser -u ec2-user -- git -C "$REPO" fetch origin main

# 指定コミットがmainの履歴に存在することを確認
runuser -u ec2-user -- git -C "$REPO" \
  merge-base --is-ancestor "$SHA" origin/main

# 新HTMLを一時ファイルに保存
TEMP=$(mktemp "$WEBROOT/.index.new.XXXXXX")
BACKUP=""
DEPLOYED=0

# 失敗時の自動復元処理
cleanup() {
  RESULT=$?
  trap - EXIT

  if [ "$RESULT" -ne 0 ] && [ "$DEPLOYED" -eq 1 ]; then
    echo "Deployment failed. Restoring previous HTML."

    if cp -p "$BACKUP" "$TEMP" && mv -f "$TEMP" "$TARGET"; then
      echo "ROLLBACK OK"
    else
      echo "ROLLBACK FAILED" >&2
    fi
  fi

  rm -f "$TEMP"
  exit "$RESULT"
}
trap cleanup EXIT

# 指定コミットのHTMLだけを取り出す
runuser -u ec2-user -- git -C "$REPO" \
  show "${SHA}:index.html" > "$TEMP"

# 最低限の事前チェック
test -s "$TEMP"
grep -qi '<!DOCTYPE html' "$TEMP"
grep -qi '</html>' "$TEMP"

# 日時付きバックアップ
mkdir -p "$BACKUPS"
BACKUP="$BACKUPS/index.html.deploy-$(date -u +%Y%m%dT%H%M%S%N).bak"
cp -p "$TARGET" "$BACKUP"

echo "Backup created: $BACKUP"

# HTMLを切り替える
chmod 644 "$TEMP"
mv -f "$TEMP" "$TARGET"
DEPLOYED=1

# HTTP応答確認
CODE=$(curl -sS -o /dev/null -w '%{http_code}' \
  --max-time 5 http://localhost/ || true)

if [ "$CODE" != "200" ]; then
  echo "ERROR: HTTP $CODE"
  exit 1
fi

DEPLOYED=0
echo "Deploy OK: SHA=$SHA HTTP $CODE"

# 古いバックアップを削除（最新10世代を保持）
find "$BACKUPS" -maxdepth 1 -type f \
  -name 'index.html.deploy-*.bak' -printf '%f\n' \
  | sort -r | tail -n +11 \
  | while IFS= read -r OLD; do
      rm -f "$BACKUPS/$OLD"
    done

echo "Backup retention completed"