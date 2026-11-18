// Item tracker definitions.
// Each item has `levels`: the names shown for each tier (tier 0 = not obtained).
// `max` makes it a counter instead. `from` lists spoiler-log item names that
// advance this item when a checked location reveals them (auto-collect).
window.OOT_ITEM_SECTIONS = [
  {
    title: "Equipment",
    items: [
      { id: "kokiri_sword", abbr: "KS", levels: ["Kokiri Sword"], from: ["Kokiri Sword"] },
      { id: "master_sword", abbr: "MS", levels: ["Master Sword"], from: ["Master Sword"] },
      { id: "biggoron", abbr: "BGS", levels: ["Giant's Knife", "Biggoron's Sword"], from: ["Giant's Knife", "Biggoron's Sword", "Progressive Goron Sword"] },
      { id: "deku_shield", abbr: "DS", levels: ["Deku Shield"], from: ["Deku Shield", "Buy Deku Shield"] },
      { id: "hylian_shield", abbr: "HS", levels: ["Hylian Shield"], from: ["Hylian Shield", "Buy Hylian Shield"] },
      { id: "mirror_shield", abbr: "MrS", levels: ["Mirror Shield"], from: ["Mirror Shield"] },
      { id: "goron_tunic", abbr: "GT", levels: ["Goron Tunic"], from: ["Goron Tunic", "Buy Goron Tunic"] },
      { id: "zora_tunic", abbr: "ZT", levels: ["Zora Tunic"], from: ["Zora Tunic", "Buy Zora Tunic"] },
      { id: "iron_boots", abbr: "Iron", levels: ["Iron Boots"], from: ["Iron Boots"] },
      { id: "hover_boots", abbr: "Hover", levels: ["Hover Boots"], from: ["Hover Boots"] },
    ],
  },
  {
    title: "Items",
    items: [
      { id: "slingshot", abbr: "Sling", levels: ["Slingshot", "Bullet Bag 40", "Bullet Bag 50"], from: ["Progressive Slingshot", "Fairy Slingshot", "Big Deku Seed Bullet Bag", "Biggest Deku Seed Bullet Bag"] },
      { id: "bombs", abbr: "Bomb", levels: ["Bomb Bag", "Bomb Bag 30", "Bomb Bag 40"], from: ["Progressive Bomb Bag", "Bomb Bag", "Big Bomb Bag", "Biggest Bomb Bag"] },
      { id: "bombchus", abbr: "Chu", levels: ["Bombchus"], from: ["Progressive Bombchu", "Bombchus (5)", "Bombchus (10)", "Bombchus (20)"] },
      { id: "boomerang", abbr: "Boom", levels: ["Boomerang"], from: ["Boomerang"] },
      { id: "bow", abbr: "Bow", levels: ["Bow", "Quiver 40", "Quiver 50"], from: ["Progressive Bow", "Fairy Bow", "Big Quiver", "Biggest Quiver"] },
      { id: "fire_arrows", abbr: "FA", levels: ["Fire Arrows"], from: ["Fire Arrow"] },
      { id: "ice_arrows", abbr: "IA", levels: ["Ice Arrows"], from: ["Ice Arrow"] },
      { id: "light_arrows", abbr: "LA", levels: ["Light Arrows"], from: ["Light Arrow"] },
      { id: "hookshot", abbr: "Hook", levels: ["Hookshot", "Longshot"], from: ["Progressive Hookshot", "Hookshot", "Longshot"] },
      { id: "hammer", abbr: "Hamr", levels: ["Megaton Hammer"], from: ["Megaton Hammer"] },
      { id: "lens", abbr: "Lens", levels: ["Lens of Truth"], from: ["Lens of Truth"] },
      { id: "beans", abbr: "Bean", levels: ["Magic Beans"], from: ["Magic Bean", "Magic Bean Pack"] },
      { id: "dins", abbr: "Din", levels: ["Din's Fire"], from: ["Din's Fire"] },
      { id: "farores", abbr: "FW", levels: ["Farore's Wind"], from: ["Farore's Wind"] },
      { id: "nayrus", abbr: "NL", levels: ["Nayru's Love"], from: ["Nayru's Love"] },
      { id: "ocarina", abbr: "Oca", levels: ["Fairy Ocarina", "Ocarina of Time"], from: ["Progressive Ocarina", "Fairy Ocarina", "Ocarina of Time"] },
      { id: "bottles", abbr: "Btl", max: 4, label: "Bottles", fromPrefix: "Bottle with ", from: ["Empty Bottle"] },
      { id: "ruto", abbr: "Ruto", levels: ["Ruto's Letter"], from: ["Bottle with Ruto's Letter"] },
    ],
  },
  {
    title: "Upgrades & Quest",
    items: [
      { id: "strength", abbr: "Str", levels: ["Goron's Bracelet", "Silver Gauntlets", "Golden Gauntlets"], from: ["Progressive Strength Upgrade", "Goron's Bracelet", "Silver Gauntlets", "Golden Gauntlets"] },
      { id: "scale", abbr: "Scale", levels: ["Silver Scale", "Golden Scale"], from: ["Progressive Scale", "Silver Scale", "Golden Scale"] },
      { id: "wallet", abbr: "Wal", levels: ["Adult Wallet", "Giant Wallet", "Tycoon Wallet"], from: ["Progressive Wallet", "Adult Wallet", "Giant Wallet", "Tycoon Wallet"] },
      { id: "magic", abbr: "MP", levels: ["Magic", "Double Magic"], from: ["Progressive Magic Meter", "Magic Meter", "Enhanced Magic Meter"] },
      { id: "double_defense", abbr: "DD", levels: ["Double Defense"], from: ["Double Defense"] },
      { id: "agony", abbr: "Agny", levels: ["Shard of Agony"], from: ["Shard of Agony"] },
      { id: "gerudo_card", abbr: "Card", levels: ["Gerudo Token"], from: ["Gerudo Token"] },
      { id: "zelda_letter", abbr: "Ltr", levels: ["Zelda's Letter"], from: ["Zelda's Letter"] },
      { id: "adult_trade", abbr: "Trade", levels: ["Pocket Egg", "Pocket Cucco", "Cojiro", "Odd Mushroom", "Odd Poultice", "Poacher's Saw", "Broken Goron's Sword", "Prescription", "Eyeball Frog", "World's Finest Eyedrops", "Claim Check"], fromExact: true, from: ["Pocket Egg", "Pocket Cucco", "Cojiro", "Odd Mushroom", "Odd Poultice", "Poacher's Saw", "Broken Goron's Sword", "Prescription", "Eyeball Frog", "World's Finest Eyedrops", "Claim Check"] },
      { id: "gs", abbr: "GS", max: 100, label: "Gold Skulltulas", from: ["Gold Skulltula Token"] },
      { id: "triforce", abbr: "Tri", max: 100, label: "Triforce Pieces", from: ["Triforce Piece"], hideWhenZero: true },
    ],
  },
  {
    title: "Songs",
    items: [
      { id: "lullaby", abbr: "ZL", levels: ["Zelda's Lullaby"], from: ["Zelda's Lullaby"], song: true },
      { id: "eponas", abbr: "Epona", levels: ["Epona's Song"], from: ["Epona's Song"], song: true },
      { id: "sarias", abbr: "Saria", levels: ["Saria's Song"], from: ["Saria's Song"], song: true },
      { id: "suns", abbr: "Sun", levels: ["Sun's Song"], from: ["Sun's Song"], song: true },
      { id: "sot", abbr: "SoT", levels: ["Song of Time"], from: ["Song of Time"], song: true },
      { id: "storms", abbr: "SoS", levels: ["Song of Storms"], from: ["Song of Storms"], song: true },
      { id: "minuet", abbr: "Min", levels: ["Minuet of Forest"], from: ["Minuet of Forest"], song: true, warp: "forest" },
      { id: "bolero", abbr: "Bol", levels: ["Bolero of Fire"], from: ["Bolero of Fire"], song: true, warp: "fire" },
      { id: "serenade", abbr: "Ser", levels: ["Serenade of Water"], from: ["Serenade of Water"], song: true, warp: "water" },
      { id: "requiem", abbr: "Req", levels: ["Requiem of Spirit"], from: ["Requiem of Spirit"], song: true, warp: "spirit" },
      { id: "nocturne", abbr: "Noc", levels: ["Nocturne of Shadow"], from: ["Nocturne of Shadow"], song: true, warp: "shadow" },
      { id: "prelude", abbr: "Pre", levels: ["Prelude of Light"], from: ["Prelude of Light"], song: true, warp: "light" },
    ],
  },
  {
    title: "Spiritual Stones & Medallions",
    items: [
      { id: "emerald", abbr: "Emer", levels: ["Kokiri's Emerald"], from: ["Kokiri's Emerald"], reward: "forest" },
      { id: "ruby", abbr: "Ruby", levels: ["Goron's Ruby"], from: ["Goron's Ruby"], reward: "fire" },
      { id: "sapphire", abbr: "Saph", levels: ["Zora's Sapphire"], from: ["Zora's Sapphire"], reward: "water" },
      { id: "forest_med", abbr: "Frst", levels: ["Forest Medallion"], from: ["Forest Medallion"], reward: "forest" },
      { id: "fire_med", abbr: "Fire", levels: ["Fire Medallion"], from: ["Fire Medallion"], reward: "fire" },
      { id: "water_med", abbr: "Watr", levels: ["Water Medallion"], from: ["Water Medallion"], reward: "water" },
      { id: "spirit_med", abbr: "Sprt", levels: ["Spirit Medallion"], from: ["Spirit Medallion"], reward: "spirit" },
      { id: "shadow_med", abbr: "Shdw", levels: ["Shadow Medallion"], from: ["Shadow Medallion"], reward: "shadow" },
      { id: "light_med", abbr: "Lght", levels: ["Light Medallion"], from: ["Light Medallion"], reward: "light" },
    ],
  },
  {
    title: "Ocarina Buttons (if shuffled)",
    collapsed: true,
    items: [
      { id: "oca_a", abbr: "A", levels: ["Ocarina A Button"], from: ["Ocarina A Button"] },
      { id: "oca_l", abbr: "L", levels: ["Ocarina L Button"], from: ["Ocarina L Button"] },
      { id: "oca_r", abbr: "R", levels: ["Ocarina R Button"], from: ["Ocarina R Button"] },
      { id: "oca_x", abbr: "X", levels: ["Ocarina X Button"], from: ["Ocarina X Button"] },
      { id: "oca_y", abbr: "Y", levels: ["Ocarina Y Button"], from: ["Ocarina Y Button"] },
    ],
  },
];

// Dungeon trackers. `area` links to the area id in locations.js; `spoilerName`
// matches the <master-quest-dungeons> entries in the spoiler log.
window.OOT_DUNGEONS = [
  { id: "dt", name: "Deku Tree", spoilerName: "Deku Tree", keys: [0, 0], bk: false, mc: true, boss: true },
  { id: "dc", name: "Dodongo's Cavern", spoilerName: "Dodongo's Cavern", keys: [0, 0], bk: false, mc: true, boss: true },
  { id: "jb", name: "Jabu Jabu's Belly", spoilerName: "Jabu Jabu's Belly", keys: [0, 0], bk: false, mc: true, boss: true },
  { id: "fot", name: "Forest Temple", spoilerName: "Forest Temple", keys: [5, 6], bk: true, mc: true, boss: true },
  { id: "fit", name: "Fire Temple", spoilerName: "Fire Temple", keys: [8, 5], bk: true, mc: true, boss: true },
  { id: "wt", name: "Water Temple", spoilerName: "Water Temple", keys: [6, 2], bk: true, mc: true, boss: true },
  { id: "spt", name: "Spirit Temple", spoilerName: "Spirit Temple", keys: [5, 7], bk: true, mc: true, boss: true },
  { id: "sht", name: "Shadow Temple", spoilerName: "Shadow Temple", keys: [5, 6], bk: true, mc: true, boss: true },
  { id: "botw", name: "Bottom of the Well", spoilerName: "Bottom of the Well", keys: [3, 2], bk: false, mc: true, boss: false },
  { id: "ic", name: "Ice Cavern", spoilerName: "Ice Cavern", keys: [0, 0], bk: false, mc: true, boss: false },
  { id: "gtg", name: "Gerudo Training Grounds", spoilerName: "Gerudo Training Grounds", keys: [9, 3], bk: false, mc: false, boss: false },
  { id: "gc_d", name: "Ganon's Castle", spoilerName: "Ganon's Castle", keys: [2, 3], bk: true, mc: false, boss: false },
];

// Spoiler-log item-name prefixes for dungeon items, keyed by dungeon id.
window.OOT_DUNGEON_ITEM_PREFIX = {
  dt: ["Great Deku Tree", "Deku Tree"],
  dc: ["Dodongo's Cavern"],
  jb: ["Jabu-Jabu's Belly", "Jabu Jabu's Belly"],
  fot: ["Forest Temple"],
  fit: ["Fire Temple"],
  wt: ["Water Temple"],
  spt: ["Spirit Temple"],
  sht: ["Shadow Temple"],
  botw: ["Bottom of the Well"],
  ic: ["Ice Cavern"],
  gtg: ["Gerudo Training Grounds"],
  gc_d: ["Ganon's Castle"],
};

// Dungeon reward choices (what the boss of a dungeon gives), for the reward selector.
window.OOT_REWARDS = [
  { id: "", label: "?" },
  { id: "emerald", label: "Emerald" },
  { id: "ruby", label: "Ruby" },
  { id: "sapphire", label: "Sapphire" },
  { id: "forest_med", label: "Forest" },
  { id: "fire_med", label: "Fire" },
  { id: "water_med", label: "Water" },
  { id: "spirit_med", label: "Spirit" },
  { id: "shadow_med", label: "Shadow" },
  { id: "light_med", label: "Light" },
];

// Boss location name in the spoiler log -> dungeon id (for reading dungeon rewards).
window.OOT_BOSS_LOCATIONS = {
  "Queen Gohma": "dt",
  "King Dodongo": "dc",
  "Barinade": "jb",
  "Phantom Ganon": "fot",
  "Volvagia": "fit",
  "Morpha": "wt",
  "Twinrova": "spt",
  "Bongo Bongo": "sht",
};
