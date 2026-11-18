# Tests

| Script | What it checks |
| --- | --- |
| `node tests/full.js` | With every item, every vanilla and every Master Quest location is reachable. Fast sanity check. |
| `node tests/compare_native.js <harness> <seed> [cases] ["Setting=Value" ...]` | Generates a seed with the **real randomizer code** (built natively). It then asks both the randomizer and `js/logic.js` "what's reachable with exactly these items?" for many random inventories, and diffs the answers. |
| `node tests/e2e_playthrough.js <url> <spoiler-log.xml> [screenshot-dir]` | In a phone-sized browser it loads a spoiler log, then keeps tapping every check shown "in logic" (auto-collect adds each item) until nothing new opens. Every location in the log's playthrough must have been reached. |

## Building the native harness

`compare_native.js` needs the randomizer's seed generator compiled for your computer. The 3DS-only
parts (menus, patch writing, music) are skipped, and `tests/native/stub/3ds.h` stands in for libctru.

```sh
git clone --depth 1 https://github.com/gamestabled/OoT3D_Randomizer.git /tmp/oot3dr
tests/native/build.sh /tmp/oot3dr            # builds tests/native/harness (needs g++)
node tests/compare_native.js tests/native/harness myseed 200
node tests/compare_native.js tests/native/harness mq 150 "MQ Dungeon Count=12" "Small Keys=Anywhere"
```

The harness also writes the seed's real `*-spoilerlog.xml` (into `RANDO_LOG_DIR`, default `.`). That file
is useful for `e2e_playthrough.js`:

```sh
RANDO_LOG_DIR=/tmp/logs tests/native/harness myseed "Forest=Closed"
python3 -m http.server 8000 &
node tests/e2e_playthrough.js http://localhost:8000/ "/tmp/logs/myseed (...)-spoilerlog.xml"
```

## Last results

- `compare_native.js`: 950 random inventories across 6 configurations, all identical to the randomizer. The configurations were default settings, all MQ with keysanity, mixed MQ with adult start, closed world with adult trade shuffle, and shop/token/scrub/cow/rupee/heart shuffle.
- `e2e_playthrough.js`: 4 generated seeds (default, all MQ, closed world, many shuffles) are each fully completed by following the tracker's logic.
