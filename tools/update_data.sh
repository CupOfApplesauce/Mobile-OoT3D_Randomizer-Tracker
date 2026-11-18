#!/bin/bash
# Regenerates every data/*.js file from a checkout of gamestabled/OoT3D_Randomizer.
# Usage: tools/update_data.sh /path/to/OoT3D_Randomizer
set -euo pipefail
SRC="$(cd "$1" && pwd)/source"
cd "$(dirname "$0")/.."
python3 tools/extract_locations.py "$SRC/item_location.cpp" > data/locations.js
python3 tools/extract_settings.py "$SRC" > data/settings.js
python3 tools/transpile_logic.py "$SRC" > data/world.js
python3 tools/transpile_enemies.py "$SRC" > data/enemies.js
node tests/full.js
echo "Data updated. Bump CACHE in sw.js before shipping."
