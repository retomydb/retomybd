#!/usr/bin/env bash
# Append timestamped snapshots of mass_import.log every 5 minutes
LOG_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$LOG_DIR" || exit 1
OUT="mass_import_recent.log"
while true; do
  echo "=== $(date -u) ===" >> "$OUT"
  tail -n 200 mass_import.log >> "$OUT" 2>/dev/null || echo "(no mass_import.log yet)" >> "$OUT"
  echo "\n" >> "$OUT"
  sleep 300
done
