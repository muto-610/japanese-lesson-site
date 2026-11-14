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

# GitHubからmainブランチの情報を取得
runuser -u ec2-user -- git -C "$REPO" fetch origin main

# 指定されたSHAがmainの履歴に含まれるか確認
runuser -u ec2-user -- git -C "$REPO" \
  merge-base --is-ancestor "$SHA" origin/main

# 一時的な作業ディレクトリを作成
umask 077
STAGING=$(mktemp -d)

# 処理終了時に一時ファイルを削除
trap 'rm -rf -- "$STAGING"' EXIT

# 指定コミットから4ファイルを取得
for FILE in "${FILES[@]}"; do

  mkdir -p "$STAGING/$(dirname "$FILE")"

  runuser -u ec2-user -- git -C "$REPO" \
    show "${SHA}:${FILE}" > "$STAGING/$FILE"

  # 空ファイルでないことを確認
  test -s "$STAGING/$FILE"

  echo "Validated: $FILE"

done

# HTMLファイルの簡易検証
for HTML in index.html videos.html; do
  grep -qi '<!DOCTYPE html' "$STAGING/$HTML"
  grep -qi '</html>' "$STAGING/$HTML"
done

echo "All 4 files staged and validated successfully."

# バックアップ保存先の作成
mkdir -p "$BACKUPS"

# デプロイ単位で専用のバックアップディレクトリを作成
BACKUP_DIR=$(mktemp -d "$BACKUPS/site.XXXXXXXX")

# 初めから存在しなかったファイルを記録
MISSING="$BACKUP_DIR/.missing"
touch "$MISSING"

# 既存の公開ファイルをバックアップ
for FILE in "${FILES[@]}"; do

  if [[ -f "$WEBROOT/$FILE" ]]; then

    mkdir -p "$BACKUP_DIR/$(dirname "$FILE")"

    cp -p \
      "$WEBROOT/$FILE" \
      "$BACKUP_DIR/$FILE"

    echo "Backed up: $FILE"

  else

    echo "$FILE" >> "$MISSING"
    echo "Not previously deployed: $FILE"

  fi

done

echo "Backup completed: $BACKUP_DIR"


# デプロイ開始前は0、ファイル配置開始後は1
DEPLOY_STARTED=0

# 正常終了・異常終了のどちらでも実行される終了処理
cleanup() {
  RESULT=$?
  trap - EXIT
  set +e

  # デプロイ開始後に失敗した場合はロールバック
  if [[ "$RESULT" -ne 0 && "$DEPLOY_STARTED" -eq 1 ]]; then

    echo "Deployment failed. Starting rollback."
    ROLLBACK_FAILED=0

    for FILE in "${FILES[@]}"; do

      if [[ -f "$BACKUP_DIR/$FILE" ]]; then

        # 元から存在したファイルを復元
        if cp -p "$BACKUP_DIR/$FILE" "$WEBROOT/$FILE"; then
          echo "Restored: $FILE"
        else
          echo "ERROR: Restore failed: $FILE" >&2
          ROLLBACK_FAILED=1
        fi

      elif grep -Fxq -- "$FILE" "$MISSING"; then

        # 元から存在しなかったファイルは削除
        if rm -f "$WEBROOT/$FILE"; then
          echo "Removed new file: $FILE"
        else
          echo "ERROR: Remove failed: $FILE" >&2
          ROLLBACK_FAILED=1
        fi

      else
        echo "ERROR: No backup record for $FILE" >&2
        ROLLBACK_FAILED=1
      fi

    done

    if [[ "$ROLLBACK_FAILED" -eq 0 ]]; then
      echo "Rollback completed."
    else
      echo "CRITICAL: Rollback incomplete!" >&2
    fi

  fi

  # 一時ディレクトリを削除
  rm -rf -- "$STAGING"

  if [[ "${ROLLBACK_FAILED:-0}" -ne 0 ]]; then
    exit 1
  fi

  exit "$RESULT"
}

# 先ほど設定したEXITトラップを置き換える
trap cleanup EXIT


# ここから本番ファイルの配置を開始
DEPLOY_STARTED=1

for FILE in "${FILES[@]}"; do

  # 配置先のディレクトリも必要に応じて作成
  TARGET="$WEBROOT/$FILE"

  # 取得・検証済みのファイルを配置
  install -D -m 0644 "$STAGING/$FILE" "$TARGET"

  echo "Deployed: $FILE"

done

# Nginxが各ファイルを正常に返すか確認
ROUTES=(
  "/"
  "/videos.html"
  "/css/videos.css"
  "/js/videos.js"
)

for ROUTE in "${ROUTES[@]}"; do

  CODE=$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time 5 "http://127.0.0.1$ROUTE" || true)

  if [[ "$CODE" != "200" ]]; then
    echo "ERROR: HTTP $CODE at $ROUTE" >&2
    exit 1
  fi

  echo "HTTP 200 OK: $ROUTE"

done

# すべて成功したのでロールバック不要
DEPLOY_STARTED=0

echo "Deploy OK: SHA=$SHA"
