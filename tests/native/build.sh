#!/bin/bash
# Builds gamestabled/OoT3D_Randomizer's seed generator natively (Linux/macOS, g++) with a small test
# harness, for tests/compare_native.js. The 3DS-only parts (menus, patching, music) are left out.
#
# Usage: tests/native/build.sh /path/to/OoT3D_Randomizer [output-binary]
set -euo pipefail
RANDO="$(cd "$1" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${2:-$HERE/harness}"
OBJ="$(mktemp -d)"
FLAGS="-std=c++20 -O1 -w -I$HERE/stub -I$RANDO/source -I$RANDO/shared -I$RANDO/code/include"

[ -f "$RANDO/source/version.hpp" ] || printf '#pragma once\n#define RANDOMIZER_VERSION "native-test"\n#define COMMIT_NUMBER "0"\n' > "$RANDO/source/version.hpp"
# Write spoiler logs to $RANDO_LOG_DIR instead of the 3DS SD card path.
sed -i.bak 's|return "/OoT3DR/Logs/" + Settings::seed|return std::string(getenv("RANDO_LOG_DIR") ? getenv("RANDO_LOG_DIR") : ".") + "/" + Settings::seed|' "$RANDO/source/spoiler_log.cpp"

for f in "$RANDO"/source/*.cpp "$RANDO"/source/location_access/*.cpp "$RANDO"/source/gold_skulltulas/*.cpp "$RANDO"/source/hint_list/*.cpp; do
  case "$(basename "$f" .cpp)" in main|menu|patch|music|preset) continue ;; esac
  g++ $FLAGS -c "$f" -o "$OBJ/$(basename "$f" .cpp).o" &
done
wait
gcc -O1 -w -I"$HERE/stub" -I"$RANDO/source" -I"$RANDO/shared" -c "$RANDO/shared/shared_data.c" -o "$OBJ/shared_data.o"
g++ $FLAGS -c "$HERE/stubs.cpp" -o "$OBJ/stubs_.o"
g++ $FLAGS -c "$HERE/harness.cpp" -o "$OBJ/harness_.o"
g++ -o "$OUT" "$OBJ"/*.o
echo "built $OUT"
