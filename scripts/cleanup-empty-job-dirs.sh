#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
JOBS_DIR="${1:-$ROOT_DIR/downloads/jobs}"
MODE="${MODE:-list}"

if [[ ! -d "$JOBS_DIR" ]]; then
  echo "jobs 目录不存在: $JOBS_DIR" >&2
  exit 1
fi

mapfile -t EMPTY_DIRS < <(find "$JOBS_DIR" -mindepth 1 -maxdepth 1 -type d -empty | sort)

if [[ ${#EMPTY_DIRS[@]} -eq 0 ]]; then
  echo "没有空任务目录: $JOBS_DIR"
  exit 0
fi

case "$MODE" in
  list)
    printf '%s\n' "${EMPTY_DIRS[@]}"
    ;;
  delete)
    printf '%s\n' "${EMPTY_DIRS[@]}"
    for dir in "${EMPTY_DIRS[@]}"; do
      rm -rf "$dir"
    done
    echo "已删除 ${#EMPTY_DIRS[@]} 个空任务目录"
    ;;
  *)
    echo "未知 MODE: $MODE (支持: list / delete)" >&2
    exit 1
    ;;
esac
