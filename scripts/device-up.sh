#!/usr/bin/env bash
# Brings up what is needed to LOOK at the app — a device and the exploration
# Appium — and nothing else. Idempotent: whatever is already running is left
# exactly as it is, because restarting it is how sessions get killed.
#
# Usage: scripts/device-up.sh [android|ios|both]   (default: both)
#
# It exists so a skill does not have to know this machine's AVD name, simulator
# name, ports or preflight steps: it runs one command and reads one line per
# component. Booting a device by hand is still fine — this does the same thing.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-both}"
EXPLORE_PORT="${APPIUM_EXPLORE_PORT:-4725}"
STATUS=0

appium_ready() {
  curl -s -m 2 "http://127.0.0.1:${EXPLORE_PORT}/status" 2>/dev/null | grep -q '"ready":true'
}

# Ask the device, do not read a list. Measured 2026-09-28: for several seconds
# after `adb emu kill`, `adb devices` still prints the dead emulator, and a
# preflight that trusts that list reports "already up" for a device that is
# gone. It is the same trap as the repo's other one — a device that is listed
# is not necessarily a device that is usable, which is also true while it boots.
android_ready() {
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')" = "1" ]
}

case "$TARGET" in
  android | ios | both) ;;
  *)
    echo "usage: $0 [android|ios|both]" >&2
    exit 64
    ;;
esac

if [ "$TARGET" = "android" ] || [ "$TARGET" = "both" ]; then
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
  if android_ready; then
    echo "android: already up"
  elif bash scripts/start-emulator.sh >/dev/null 2>&1; then
    # start-emulator.sh also disables the Google apps that ANR over the SUT —
    # the reason this is not a bare `emulator -avd`.
    echo "android: started"
  else
    echo "android: FAILED to start (run scripts/start-emulator.sh to see why)" >&2
    STATUS=1
  fi
fi

if [ "$TARGET" = "ios" ] || [ "$TARGET" = "both" ]; then
  DEVICE="${IOS_DEVICE:-iPhone 16}"
  if xcrun simctl list devices booted 2>/dev/null | grep -q "^    ${DEVICE} "; then
    echo "ios: already up (${DEVICE})"
  elif bash scripts/start-simulator.sh >/dev/null 2>&1; then
    echo "ios: started (${DEVICE})"
  else
    echo "ios: FAILED to start ${DEVICE} (run scripts/start-simulator.sh to see why)" >&2
    STATUS=1
  fi
fi

if appium_ready; then
  echo "appium: already up on ${EXPLORE_PORT}"
else
  mkdir -p logs
  # From the project root, through npx: Appium 3 resolves its drivers against
  # the package.json of the working directory, and a bare `appium` may find none.
  nohup npx appium --address 127.0.0.1 --port "${EXPLORE_PORT}" --relaxed-security \
    >logs/appium-explore.log 2>&1 &
  for _ in $(seq 1 60); do
    appium_ready && break
    sleep 1
  done
  if appium_ready; then
    echo "appium: started on ${EXPLORE_PORT} (log: logs/appium-explore.log)"
  else
    echo "appium: FAILED to start on ${EXPLORE_PORT} — see logs/appium-explore.log" >&2
    STATUS=1
  fi
fi

exit "$STATUS"
