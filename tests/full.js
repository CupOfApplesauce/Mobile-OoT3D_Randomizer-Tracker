const G = require("./load.js");
const items = {};
for (const s of G.OOT_ITEM_SECTIONS) for (const it of s.items) items[it.id] = it.max != null ? it.max : it.levels.length;
items.heart_containers = 8; items.heart_pieces = 36; items.weird_egg = 1;
const dungeons = {};
for (const d of G.OOT_DUNGEONS) dungeons[d.id] = { keys: 10, bk: true };
dungeons.gf = { keys: 4 };
for (const mqAll of [false, true]) {
  const mq = {};
  for (const d of G.OOT_DUNGEONS) mq[d.id] = mqAll;
  const t = Date.now();
  const r = G.OOTLogic.compute({ items, dungeons, mq });
  const all = G.OOT_LOCATIONS.filter((l) => !l.v || (l.v === "mq") === mqAll);
  const missing = all.filter((l) => !r.reachable.has(l.n));
  console.log(mqAll ? "MQ" : "Vanilla", "reachable", r.reachable.size, "/", all.length, "ms", Date.now() - t);
  console.log("  missing:", missing.map((l) => l.n).join(" | "));
}
