#!/usr/bin/env bash
# Simple alert script for DB failures. Appends a timestamped line to log.
LOGFILE=/tmp/retomy_worker_alerts.log
echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') DB failure alert: $*" >> "$LOGFILE"
# If 'mail' is configured, send an email (optional)
if command -v mail >/dev/null 2>&1; then
  echo "DB failure: $*" | mail -s "retomY worker DB failure" ops@example.com
fi
