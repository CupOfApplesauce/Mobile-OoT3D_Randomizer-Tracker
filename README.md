# Mobile-OoT3D_Randomizer-Tracker
A mobile randomizer tracker for the Ocarina of Time 3D Remake for Nintendo 3DS developed by gamestabled. Able to read the seeds given to it from the randomizer generator to properly track what is and isn't available and have spoilers if needed. Potential for live updating being a far off goal.

## What it does today

The tracker is an installable web app (PWA). You open it in your phone's browser, add it to your home screen, and it then works like an app, offline too. There's no app store and nothing to compile.

- **Items**: tap to add, long-press (or right-click) to remove. It covers equipment, items with progressive upgrades, songs, stones and medallions, Gold Skulltula count and the adult trade sequence. Ocarina buttons are there too, for seeds that shuffle them.
- **Dungeons**: MQ toggle, dungeon reward, small keys (the max changes with MQ), boss key, map and compass.
- **Checks**: all 866 locations from the randomizer, grouped into 34 areas, with progress bars, search and "hide checked". You can turn location types on or off: Skulltulas, scrubs, shops, cows, freestanding rupees and hearts.
- **Spoiler log**: load the `*-spoilerlog.xml` file that the randomizer writes. Then it:
  - shows only the locations that exist in your seed
  - sets Master Quest dungeons automatically
  - lets you peek at one location (👁) or reveal everything
  - can add items to your inventory automatically when you check a location
  - offers "where is…" search, Way of the Hero, Gossip Stone hints, the playthrough and the seed's settings
- Progress is saved on the device. You can export and import it as JSON.

**Not done yet:** logic, meaning showing which checks you can reach with your current items. This is the next big step (see the roadmap).

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
| `data/locations.js` | **Generated** list of every location: name, area, type, vanilla/MQ |
| `data/items.js` | Item tracker, dungeon and reward definitions |
| `tools/extract_locations.py` | Regenerates `data/locations.js` from the randomizer source |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and install metadata |

### Updating locations when the randomizer changes
Location names have to match the spoiler log exactly, so they're pulled from the randomizer's own source:

```sh
git clone --depth 1 https://github.com/gamestabled/OoT3D_Randomizer.git /tmp/oot3dr
python3 tools/extract_locations.py /tmp/oot3dr/source/item_location.cpp > data/locations.js
```

When you ship changes, bump `CACHE` in `sw.js` so installed copies update.

## Roadmap
1. **Logic**: port the randomizer's access rules (`source/location_access/*.cpp`) so checks show as in logic or out of logic.
2. Item icons, using original artwork rather than ripped game sprites.
3. Entrance randomizer tracking.
4. Live updating from the 3DS (far off).

*Unofficial fan project, not affiliated with Nintendo or the randomizer developers.*
