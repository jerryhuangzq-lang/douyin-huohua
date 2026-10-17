#!/bin/bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Override with HUOHUA_LABEL=com.example.douyin-huohua; default is per-user.
LABEL="${HUOHUA_LABEL:-com.$(id -un).douyin-huohua}"
# State/log dir; written into the plist so manual and scheduled runs share it.
HUOHUA_HOME="${HUOHUA_HOME:-$HOME/.douyin-huohua}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_BIN="$(command -v node || true)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Uninstalled $LABEL"
  exit 0
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "node not found in PATH" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HUOHUA_HOME"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$SKILL_DIR/scripts/huohua.js</string>
    <string>--run</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$SKILL_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HUOHUA_HOME</key>
    <string>$HUOHUA_HOME</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>12</integer>
    <key>Minute</key>
    <integer>37</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$HUOHUA_HOME/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$HUOHUA_HOME/launchd.err.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL (daily 12:37)"
echo "Run now: launchctl kickstart -k gui/$(id -u)/$LABEL"
