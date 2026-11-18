#!/usr/bin/env python3
"""Generate data/locations.js from gamestabled/OoT3D_Randomizer's item_location.cpp.

Usage:
    git clone --depth 1 https://github.com/gamestabled/OoT3D_Randomizer.git /tmp/oot3dr
    python3 tools/extract_locations.py /tmp/oot3dr/source/item_location.cpp > data/locations.js

Re-run this whenever the randomizer adds or renames locations.
"""
import json
import os
import re
import sys

# Areas in display order: (id, display name, is_dungeon, name prefixes)
AREAS = [
    ("kf", "Kokiri Forest", False, ["KF "]),
    ("lw", "Lost Woods", False, ["LW ", "Deku Theater"]),
    ("sfm", "Sacred Forest Meadow", False, ["SFM "]),
    ("hf", "Hyrule Field", False, ["HF "]),
    ("llr", "Lon Lon Ranch", False, ["LLR "]),
    ("mk", "Market", False, ["MK ", "Market "]),
    ("tot", "Temple of Time", False, ["ToT ", "Link's Pocket"]),
    ("hc", "Hyrule Castle", False, ["HC "]),
    ("ogc", "Outside Ganon's Castle", False, ["OGC "]),
    ("kak", "Kakariko Village", False, ["Kak "]),
    ("gy", "Graveyard", False, ["GY ", "Graveyard "]),
    ("dmt", "Death Mountain Trail", False, ["DMT "]),
    ("gc", "Goron City", False, ["GC "]),
    ("dmc", "Death Mountain Crater", False, ["DMC "]),
    ("zr", "Zora's River", False, ["ZR "]),
    ("zd", "Zora's Domain", False, ["ZD "]),
    ("zf", "Zora's Fountain", False, ["ZF "]),
    ("lh", "Lake Hylia", False, ["LH "]),
    ("gv", "Gerudo Valley", False, ["GV "]),
    ("gf", "Gerudo's Fortress", False, ["GF "]),
    ("hw", "Haunted Wasteland", False, ["Wasteland "]),
    ("col", "Desert Colossus", False, ["Colossus "]),
    ("dt", "Deku Tree", True, ["Deku Tree ", "Queen Gohma"]),
    ("dc", "Dodongo's Cavern", True, ["Dodongos Cavern ", "Dodongo's Cavern ", "King Dodongo"]),
    ("jb", "Jabu Jabu's Belly", True, ["Jabu Jabus Belly ", "Barinade"]),
    ("fot", "Forest Temple", True, ["Forest Temple ", "Phantom Ganon"]),
    ("fit", "Fire Temple", True, ["Fire Temple ", "Volvagia"]),
    ("wt", "Water Temple", True, ["Water Temple ", "Morpha"]),
    ("spt", "Spirit Temple", True, ["Spirit Temple ", "Twinrova"]),
    ("sht", "Shadow Temple", True, ["Shadow Temple ", "Bongo Bongo"]),
    ("botw", "Bottom of the Well", True, ["Bottom of the Well "]),
    ("ic", "Ice Cavern", True, ["Ice Cavern "]),
    ("gtg", "Gerudo Training Grounds", True, ["Gerudo Training Grounds "]),
    ("gc_d", "Ganon's Castle", True, ["Ganon's Castle ", "Ganon's Tower "]),
]

# Song locations whose names don't carry an area prefix.
SPECIAL = {
    "Sheik in Forest": "sfm",
    "Sheik in Crater": "dmc",
    "Sheik in Ice Cavern": "ic",
    "Sheik at Colossus": "col",
    "Sheik in Kakariko": "kak",
    "Sheik at Temple": "tot",
    "Song from Impa": "hc",
    "Song from Malon": "llr",
    "Song from Saria": "sfm",
    "Song from Composers Grave": "gy",
    "Song from Ocarina of Time": "hf",
    "Song from Windmill": "kak",
}

# Category -> short type tag used by the tracker's filters.
TYPE_PRIORITY = [
    ("Skulltula", "gs"),
    ("Shop", "shop"),
    ("DekuScrub", "scrub"),
    ("Cow", "cow"),
    ("FreestandingRupee", "rupee"),
    ("RecoveryHeart", "heart"),
    ("DungeonReward", "reward"),
]


def area_for(name):
    if name in SPECIAL:
        return SPECIAL[name]
    for aid, _, _, prefixes in AREAS:
        if any(name.startswith(p) for p in prefixes):
            return aid
    raise SystemExit(f"No area for location: {name}")


def load_items(item_list_path):
    """Item key -> (English name, price) from item_list.cpp."""
    items = {}
    text = open(item_list_path, encoding="utf-8").read()
    for m in re.finditer(r"itemTable\[(\w+)\]\s*=\s*Item\((.*?)Text\{\"([^\"]*)\"", text):
        key, args, name = m.groups()
        parts = [a.strip() for a in args.split(",") if a.strip()]
        price = int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0
        items[key] = (name, price)
    return items


def main():
    src = open(sys.argv[1], encoding="utf-8").read()
    items = load_items(os.path.join(os.path.dirname(sys.argv[1]), "item_list.cpp"))
    body = src[src.index("void LocationTable_Init()"):]

    # Walk through the source keeping track of the current "// Section" comment.
    token = re.compile(
        r"^\s*//\s*(?P<section>[^\n]+)$|locationTable\[(?P<key>\w+)\]\s*=\s*ItemLocation::(?P<kind>\w+)\s*\((?P<args>.*?)\);",
        re.S | re.M,
    )
    section = ""
    locations = []
    for m in token.finditer(body):
        if m.group("section"):
            section = m.group("section").strip()
            continue
        key, kind, args = m.group("key"), m.group("kind"), m.group("args")
        if kind in ("HintStone", "OtherHint") or key in ("NONE", "TRIFORCE_HUNT_GOAL", "GANON"):
            continue
        name = re.search(r'"([^"]+)"', args).group(1)
        cats = re.findall(r"Category::c(\w+)", args)
        area = area_for(name)
        dungeon = next(a for a in AREAS if a[0] == area)[2]

        variant = None  # None = always present, "v" = vanilla only, "mq" = master quest only
        if dungeon:
            if " MQ " in f" {name} " or section.endswith(" MQ"):
                variant = "mq"
            elif not (section.endswith("Shared") or "BossHeart" in cats or "DungeonReward" in cats
                      or name == "Sheik in Ice Cavern"):
                variant = "v"

        ltype = "check"
        for cat, tag in TYPE_PRIORITY:
            if cat in cats:
                ltype = tag
                break
        if "Song" in cats or name.startswith(("Sheik ", "Song from")):
            ltype = "song"
        if "BossHeart" in cats:
            ltype = "check"

        entry = {"n": name, "k": key, "a": area, "t": ltype}
        if ltype == "shop":
            # vanilla shop item and its price, used when shops aren't shuffled
            vanilla = [a.strip() for a in args.split(",")][4]
            if vanilla in items:
                entry["vi"], entry["vp"] = items[vanilla]
        if variant:
            entry["v"] = variant
        locations.append(entry)

    areas = [{"id": a, "name": n, "dungeon": d} for a, n, d, _ in AREAS]
    print("// Generated by tools/extract_locations.py from gamestabled/OoT3D_Randomizer source/item_location.cpp.")
    print("// Do not edit by hand. Fields: n = name (matches the spoiler log), k = randomizer key, a = area id,")
    print("// t = type (check|gs|shop|scrub|cow|rupee|heart|song|reward), v = dungeon variant (v = vanilla, mq = Master Quest).")
    print("window.OOT_AREAS = " + json.dumps(areas, indent=1) + ";")
    print("window.OOT_LOCATIONS = [")
    for e in locations:
        print("  " + json.dumps(e, separators=(",", ":")) + ",")
    print("];")


if __name__ == "__main__":
    main()
