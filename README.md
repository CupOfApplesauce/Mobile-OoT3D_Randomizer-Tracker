# Mobile-OoT3D_Randomizer-Tracker
A mobile randomizer tracker for the Ocarina of Time 3D Remake for Nintendo 3DS developed by gamestabled. Able to read the seeds given to it from the randomizer generator to properly track what is and isn't available and have spoilers if needed. Potential for live updating being a far off goal.

## What it does today

The tracker is an installable web app (PWA). You open it in your phone's browser, add it to your home screen, and it then works like an app, offline too. There's no app store and nothing to compile.

- **Items**: tap to add, long-press (or right-click) to remove. It covers equipment, items with progressive upgrades, songs, stones and medallions, Gold Skulltula count and the adult trade sequence. Ocarina buttons are there too, for seeds that shuffle them.
- **Dungeons**: MQ toggle, dungeon reward, small keys (the max changes with MQ), boss key, map and compass.
- **Checks**: all 866 locations from the randomizer, grouped into 34 areas, with progress bars, search and "hide checked". You can turn location types on or off: Skulltulas, scrubs, shops, cows, freestanding rupees and hearts.
- **Spoiler log**: load the `*-spoilerlog.xml` file that the randomizer writes. Then it:
  - shows the location types your seed shuffles (Skulltulas, scrubs, shops, …)
  - sets Master Quest dungeons automatically
  - lets you peek at one location (👁) or reveal everything
  - can add items to your inventory automatically when you check a location
  - offers "where is…" search, Way of the Hero, Gossip Stone hints, the playthrough and the seed's settings
- **Logic**: every check shows whether it's reachable with the items you've marked, using the randomizer's own logic (see below). Areas show a green count of checks available right now, and the **In logic** filter shows only those. Loading a spoiler log sets the world settings, tricks, Master Quest dungeons, Ganon's trials and starting items. Without a log, you can set them by hand under Settings → Logic.
- Progress is saved on the device. You can export and import it as JSON.

## How the logic works

The tracker doesn't use a hand-written approximation. It runs the randomizer's actual glitchless logic:

- `tools/transpile_logic.py` machine-translates the randomizer's region graph (`source/location_access/*.cpp`, about 11,000 lines of C++ rules) into JavaScript (`data/world.js`).
- `tools/transpile_enemies.py` does the same for the vanilla enemy placements and the "can you beat this enemy" rules.
- `js/logic.js` is a hand port of `logic.cpp` (item helpers like `CanUse`, `HasExplosives`, …) and of the randomizer's reachability search, including day/night and child/adult propagation.

It's checked against the real thing. The randomizer's generator, compiled natively, produced exactly the same reachable locations as the tracker for 950 random inventories across many settings. That covered all Master Quest and mixed MQ dungeons, closed world, keysanity, and shop/token/scrub shuffle. Real spoiler logs can also be fully completed by following the tracker. Details are in [`tests/README.md`](tests/README.md).

What it models:
- **Tracked items only.** The tracker can't see what you've bought from shops, but when shops aren't shuffled it assumes you can buy what's on the shelf, as the randomizer does.
- Glitchless logic only (glitched logic isn't supported).
- Not supported yet: entrance randomizer, enemy randomizer, shuffled enemy souls, randomized Gold Skulltula positions.

## Running it

It's plain HTML, CSS and JS with no build step.

```sh
python3 -m http.server 8000
# then open http://localhost:8000 (or http://<your-computer-ip>:8000 from your phone on the same Wi-Fi)
```

### Putting it on your phone (GitHub Pages)
1. In the repo, go to **Settings → Pages**, set **Source: Deploy from a branch**, and pick your branch with the `/ (root)` folder.
2. Open `https://<your-username>.github.io/Mobile-OoT3D_Randomizer-Tracker/` on your phone.
3. Add it to your home screen. On iOS Safari that's Share → Add to Home Screen. On Android Chrome it's ⋮ → Install app.

## Project layout

| Path | What |
| --- | --- |
| `index.html`, `styles.css` | App shell and styling (dark and light themes) |
| `js/app.js` | Tracker UI and state |
| `js/spoiler.js` | Spoiler log XML parser |
| `js/logic.js` | Logic engine (port of the randomizer's `logic.cpp` and reachability search) |
| `data/locations.js` | **Generated** list of every location: name, area, type, vanilla/MQ, vanilla shop items |
| `data/world.js` | **Generated** region graph, translated from the randomizer's C++ logic |
| `data/enemies.js` | **Generated** vanilla enemy placements and per-enemy rules |
| `data/settings.js` | **Generated** settings, tricks and logic variables |
| `data/items.js` | Item tracker, dungeon and reward definitions |
| `tools/` | Generators for the files above (`tools/update_data.sh` runs them all) |
| `tests/` | Logic tests, including a comparison against the natively built randomizer |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and install metadata |

### Updating when the randomizer changes
Locations, settings and logic are all generated from the randomizer's own source, so they match your spoiler log:

```sh
git clone --depth 1 https://github.com/gamestabled/OoT3D_Randomizer.git /tmp/oot3dr
tools/update_data.sh /tmp/oot3dr
```

When you ship changes, bump `CACHE` in `sw.js` so installed copies update.

## Roadmap
1. ~~Logic~~ ✔ (glitchless, verified against the randomizer)
2. Item icons, using original artwork rather than ripped game sprites.
3. Entrance randomizer, enemy souls and randomized Gold Skulltula positions in logic.
4. Live updating from the 3DS (far off).

*Unofficial fan project, not affiliated with Nintendo or the randomizer developers.*
