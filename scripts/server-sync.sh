#!/usr/bin/env bash
# server-sync.sh — 在 Gitea 服务器上定时同步考试数据
#
# 前置准备(在服务器上执行一次):
#   1) echo -n '<Gitea token>' > /root/.gitea-sync-token && chmod 600 /root/.gitea-sync-token
#   2) 可选,如需同时更新 GitHub(触发 GitHub Pages 重新部署):
#      echo -n '<GitHub token>' > /root/.github-sync-token && chmod 600 /root/.github-sync-token
#   3) 确保 python3-venv 可用(Ubuntu: apt install -y python3-venv)
#   4) crontab -e 添加定时任务(每天 08:00):
#      0 8 * * * /opt/exam-sync/scripts/server-sync.sh >> /var/log/exam-sync.log 2>&1
set -euo pipefail

GITEA_HOST="${GITEA_HOST:-http://8.135.45.182:3000}"
GITEA_OWNER="${GITEA_OWNER:-Lawrence}"
GITEA_REPO="${GITEA_REPO:-Lawrence1305.github.io}"
GITEA_TOKEN_FILE="${GITEA_TOKEN_FILE:-/root/.gitea-sync-token}"
GITHUB_TOKEN_FILE="${GITHUB_TOKEN_FILE:-/root/.github-sync-token}"
VENV_DIR="${EXAM_SYNC_VENV:-/opt/exam-sync/.venv}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  WORK_DIR="${EXAM_SYNC_DIR:-$SCRIPT_DIR}"
else
  WORK_DIR="${EXAM_SYNC_DIR:-/opt/exam-sync/repo}"
fi

if [ ! -s "$GITEA_TOKEN_FILE" ]; then
  echo "error: token file $GITEA_TOKEN_FILE missing" >&2
  exit 1
fi
GITEA_TOKEN="$(tr -d '\r\n' < "$GITEA_TOKEN_FILE")"
GITEA_AUTH_URL="http://${GITEA_OWNER}:${GITEA_TOKEN}@${GITEA_HOST#http://}/${GITEA_OWNER}/${GITEA_REPO}.git"

# 拉取最新代码
mkdir -p "$(dirname "$WORK_DIR")"
if [ ! -d "$WORK_DIR/.git" ]; then
  git clone "$GITEA_AUTH_URL" "$WORK_DIR"
else
  git -C "$WORK_DIR" pull --ff-only origin main
fi
cd "$WORK_DIR"

# Python 虚拟环境(首次自动创建)
if [ ! -x "$VENV_DIR/bin/python" ]; then
  python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/pip" install -q -r scripts/requirements.txt

# 同步(抓不到的考局会保留上次数据并在日志中告警)
"$VENV_DIR/bin/python" scripts/sync_exams.py || echo "sync finished with warnings"

git add src/data/exams.json src/data/meta.json
if git diff --cached --quiet; then
  echo "no data changes"
else
  git -c user.name="sync-bot" -c user.email="sync-bot@local" \
      commit -m "chore: update exam timetable data"
  git push "$GITEA_AUTH_URL" main
  echo "pushed to Gitea"
fi

# 可选:同时推送 GitHub,触发 GitHub Pages 重新部署
if [ -s "$GITHUB_TOKEN_FILE" ]; then
  GITHUB_TOKEN="$(tr -d '\r\n' < "$GITHUB_TOKEN_FILE")"
  GITHUB_AUTH_URL="https://Lawrence1305:${GITHUB_TOKEN}@github.com/Lawrence1305/${GITEA_REPO}.git"
  git push "$GITHUB_AUTH_URL" main
  echo "pushed to GitHub"
fi

echo "sync done: $(date '+%Y-%m-%d %H:%M:%S %Z')"
