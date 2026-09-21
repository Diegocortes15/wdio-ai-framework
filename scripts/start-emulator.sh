#!/bin/bash
# Boots the AVD and waits for boot_completed. Measured 2026-09-18: ~8 s on Apple Silicon.
set -e
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
AVD="${1:-Medium_Phone_API_35}"
if adb devices | grep -q "emulator-.*device"; then echo "emulator already running"; exit 0; fi
nohup emulator -avd "$AVD" -no-snapshot-load -no-boot-anim >/dev/null 2>&1 &
adb wait-for-device shell 'while [ -z "$(getprop sys.boot_completed)" ]; do sleep 1; done'
# Preflight: the google_apis_playstore system image ships Google apps that ANR,
# and their dialog steals the foreground, hiding the tree of the app under test
# (seen 2026-09-18: "Messages isn't responding" during a login run).
for pkg in com.google.android.apps.messaging com.google.android.apps.maps com.google.android.apps.photos; do
  adb shell pm disable-user --user 0 "$pkg" >/dev/null 2>&1 || true
done
echo "emulator ready"
