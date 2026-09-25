#!/usr/bin/env bash
# Boots the simulator the iOS config targets, and waits until it is usable.
# Mirrors scripts/start-emulator.sh, minus the Google-app preflight: the iOS
# simulator has no equivalent of the apps that ANR over the SUT.
set -euo pipefail

DEVICE="${IOS_DEVICE:-iPhone 16}"

if xcrun simctl list devices booted | grep -q "^    ${DEVICE} "; then
  echo "${DEVICE} is already booted."
else
  echo "Booting ${DEVICE}…"
  xcrun simctl boot "${DEVICE}"
fi

open -a Simulator
# Poll, never sleep: boot time varies with machine load.
until xcrun simctl list devices booted | grep -q "^    ${DEVICE} "; do
  sleep 1
done
echo "${DEVICE} is booted. The app under test is installed by the WDIO session."
