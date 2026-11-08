#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
simulator_id=${1:-718ADE2F-9D16-4DF3-A037-DE00819FA657}
build_dir=${TMPDIR:-/tmp}/together-native-build
xcodebuild -project "$project_root/native-ios/TogetherNative.xcodeproj" -scheme TogetherNative -configuration Debug -destination "platform=iOS Simulator,id=$simulator_id" -derivedDataPath "$build_dir" CODE_SIGNING_ALLOWED=NO build
xcrun simctl boot "$simulator_id" 2>/dev/null || true
xcrun simctl bootstatus "$simulator_id" -b
xcrun simctl install "$simulator_id" "$build_dir/Build/Products/Debug-iphonesimulator/TogetherNative.app"
bundle_id=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$build_dir/Build/Products/Debug-iphonesimulator/TogetherNative.app/Info.plist")
xcrun simctl launch "$simulator_id" "$bundle_id"
open -a Simulator
