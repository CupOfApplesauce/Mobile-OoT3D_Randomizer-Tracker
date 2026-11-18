#!/usr/bin/env node
// Cross-checks the JS logic port against the real randomizer logic.
//
// Requires a native build of gamestabled/OoT3D_Randomizer with the test harness from
// tests/native/ (see tests/README.md). For a seed, the harness generates the spoiler log and
// then answers "which locations are reachable with exactly these items?" for each inventory we
// send it. We ask the JS engine the same question and diff the answers.
//
// Usage: node tests/compare_native.js <harness> <seed> [cases=200] ["Setting=Value" ...]
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const G = require("./load.js");
const { parseSpoilerXml } = require("./spoiler_node.js");

const [harness, seed, casesArg, ...settingArgs] = process.argv.slice(2);
const CASES = Number(casesArg || 200);

// Tracker item -> randomizer item names (repeated per level).
const NAMES = {
  kokiri_sword: ["Kokiri Sword"], master_sword: ["Master Sword"], biggoron: ["Progressive Goron Sword"],
  // Found shields have no logic effect upstream; logic only counts shields you can buy.
  deku_shield: ["Buy Deku Shield"], hylian_shield: ["Buy Hylian Shield"], mirror_shield: ["Mirror Shield"],
  goron_tunic: ["Goron Tunic"], zora_tunic: ["Zora Tunic"], iron_boots: ["Iron Boots"], hover_boots: ["Hover Boots"],
  slingshot: ["Progressive Slingshot"], bombs: ["Progressive Bomb Bag"], bombchus: ["Bombchus (10)"],
  boomerang: ["Boomerang"], bow: ["Progressive Bow"], fire_arrows: ["Fire Arrow"], ice_arrows: ["Ice Arrow"],
  light_arrows: ["Light Arrow"], hookshot: ["Progressive Hookshot"], hammer: ["Megaton Hammer"],
  lens: ["Lens of Truth"], beans: ["Magic Bean"], dins: ["Din's Fire"], farores: ["Farore's Wind"],
  nayrus: ["Nayru's Love"], ocarina: ["Progressive Ocarina"], bottles: ["Empty Bottle"],
  ruto: ["Bottle with Ruto's Letter"], strength: ["Progressive Strength Upgrade"], scale: ["Progressive Scale"],
  wallet: ["Progressive Wallet"], magic: ["Progressive Magic Meter"], double_defense: ["Double Defense"],
  agony: ["Shard of Agony"], gerudo_card: ["Gerudo Token"], zelda_letter: ["Zelda's Letter"],
  gs: ["Gold Skulltula Token"], heart_containers: ["Heart Container"], heart_pieces: ["Piece of Heart"],
  lullaby: ["Zelda's Lullaby"], eponas: ["Epona's Song"], sarias: ["Saria's Song"], suns: ["Sun's Song"],
  sot: ["Song of Time"], storms: ["Song of Storms"], minuet: ["Minuet of Forest"], bolero: ["Bolero of Fire"],
  serenade: ["Serenade of Water"], requiem: ["Requiem of Spirit"], nocturne: ["Nocturne of Shadow"],
  prelude: ["Prelude of Light"], emerald: ["Kokiri's Emerald"], ruby: ["Goron's Ruby"], sapphire: ["Zora's Sapphire"],
  forest_med: ["Forest Medallion"], fire_med: ["Fire Medallion"], water_med: ["Water Medallion"],
  spirit_med: ["Spirit Medallion"], shadow_med: ["Shadow Medallion"], light_med: ["Light Medallion"],
};
const MAX = {
  biggoron: 2, slingshot: 3, bombs: 3, bow: 3, hookshot: 2, ocarina: 2, bottles: 4, strength: 3, scale: 2,
  wallet: 3, magic: 2, gs: 50, heart_containers: 8, heart_pieces: 36,
};
const KEYS = {
  fot: ["Forest Temple Small Key", 6], fit: ["Fire Temple Small Key", 8], wt: ["Water Temple Small Key", 6],
  spt: ["Spirit Temple Small Key", 7], sht: ["Shadow Temple Small Key", 6], botw: ["Bottom of the Well Small Key", 3],
  gtg: ["Training Grounds Small Key", 9], gc_d: ["Ganon's Castle Small Key", 3], gf: ["Gerudo Fortress Small Key", 4],
};
const BKS = { fot: "Forest Temple Big Key", fit: "Fire Temple Big Key", wt: "Water Temple Big Key",
  spt: "Spirit Temple Big Key", sht: "Shadow Temple Big Key", gc_d: "Ganon's Castle Big Key" };
// Adult trade items by raw item key (POCKET_EGG = 30 ... CLAIM_CHECK = 40 in keys.hpp); most have
// no English name in the native item table. POCKET_CUCCO (31) isn't an item in OoT3DR.
const TRADE_IDS = ["trade_egg", "trade_cojiro", "trade_mushroom", "trade_poultice", "trade_saw", "trade_broken",
  "trade_prescription", "trade_frog", "trade_eyedrops", "trade_claim"];
const TRADE = ["#30", "#32", "#33", "#34", "#35", "#36", "#37", "#38", "#39", "#40"];

let rngState = 12345;
const rand = () => ((rngState = (rngState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function randomInventory(density) {
  const items = {};
  const dungeons = {};
  const names = [];
  for (const id of Object.keys(NAMES)) {
    if (rand() > density) continue;
    const max = MAX[id] || 1;
    const n = 1 + Math.floor(rand() * max);
    items[id] = n;
    for (let i = 0; i < n; i++) names.push(NAMES[id][0]);
  }
  TRADE.forEach((key, i) => {
    if (rand() < density / 4) {
      items[TRADE_IDS[i]] = 1;
      names.push(key);
    }
  });
  for (const [id, [name, max]] of Object.entries(KEYS)) {
    const keys = rand() < density ? Math.floor(rand() * (max + 1)) : 0;
    const bk = BKS[id] && rand() < density;
    dungeons[id] = { keys, bk };
    for (let i = 0; i < keys; i++) names.push(name);
    if (bk) names.push(BKS[id]);
  }
  return { items, dungeons, names };
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "oot3d-compare-"));
const cases = [{ items: {}, dungeons: {}, names: [] }];
for (let i = 1; i < CASES; i++) cases.push(randomInventory(0.15 + 0.85 * (i / CASES)));
const input = cases.map((c) => c.names.join("|")).join("\n") + "\n";
const out = execFileSync(harness, [seed, ...settingArgs], {
  input, env: Object.assign({}, process.env, { RANDO_REACH: "1", RANDO_LOG_DIR: work }), maxBuffer: 1 << 28,
}).toString();
const lines = out.slice(out.indexOf("BEGIN\n") + 6).split("\n");
const logFile = fs.readdirSync(work).find((f) => f.endsWith("-spoilerlog.xml"));
const spoiler = parseSpoilerXml(fs.readFileSync(path.join(work, logFile), "utf8"));

const { settings, tricks } = G.OOTLogic.settingsFromSpoiler(spoiler.settingsList, spoiler.tricks);
const mq = {};
const DUNGEON_NAMES = { "Deku Tree": "dt", "Dodongo's Cavern": "dc", "Jabu Jabu's Belly": "jb", "Forest Temple": "fot",
  "Fire Temple": "fit", "Water Temple": "wt", "Spirit Temple": "spt", "Shadow Temple": "sht",
  "Bottom of the Well": "botw", "Ice Cavern": "ic", "Gerudo Training Grounds": "gtg", "Ganon's Castle": "gc_d" };
for (const d of spoiler.mqDungeons) mq[DUNGEON_NAMES[d]] = true;
const prices = {};
for (const [name, v] of Object.entries(spoiler.locations)) if (v.price != null) prices[name] = v.price;
const known = new Set(G.OOT_LOCATIONS.map((l) => l.n));
const songButtons = G.OOTLogic.songButtonsFromSpoiler(spoiler.songNotes);

let mismatches = 0;
const missingCounts = {};
const extraCounts = {};
cases.forEach((c, i) => {
  const native = new Set(lines[i].split("|").filter((n) => known.has(n)));
  const js = G.OOTLogic.compute({ items: c.items, dungeons: c.dungeons, settings, tricks, mq, prices, noVanillaShop: true, applyShopItems: false,
    trials: spoiler.trials, songButtons }).reachable;
  const missing = [...native].filter((n) => !js.has(n));
  const extra = [...js].filter((n) => !native.has(n));
  if (missing.length || extra.length) {
    mismatches++;
    missing.forEach((n) => (missingCounts[n] = (missingCounts[n] || 0) + 1));
    extra.forEach((n) => (extraCounts[n] = (extraCounts[n] || 0) + 1));
    if (mismatches <= 3) {
      console.log(`case ${i}: native ${native.size}, js ${js.size}`);
      console.log("  items:", c.names.join(", "));
      if (missing.length) console.log("  JS misses:", missing.slice(0, 12).join(" | "));
      if (extra.length) console.log("  JS extra: ", extra.slice(0, 12).join(" | "));
    }
  }
});
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} (${v})`).join(" | ");
console.log(`seed ${seed}: ${cases.length - mismatches}/${cases.length} inventories identical` +
  ` (MQ: ${spoiler.mqDungeons.join(", ") || "none"})`);
if (mismatches) {
  console.log("most often missed by JS:", top(missingCounts));
  console.log("most often extra in JS: ", top(extraCounts));
}
fs.rmSync(work, { recursive: true, force: true });
process.exit(mismatches ? 1 : 0);
