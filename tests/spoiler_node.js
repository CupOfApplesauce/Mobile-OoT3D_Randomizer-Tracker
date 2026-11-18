// Minimal spoiler-log reader for Node tests (the app itself uses DOMParser in js/spoiler.js).
function decode(s) {
  return s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function section(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : "";
}
function parseSpoilerXml(xml) {
  const settingsList = [...section(xml, "settings").matchAll(/<setting name="([^"]*)">([^<]*)<\/setting>/g)]
    .map((m) => [decode(m[1]), decode(m[2])]);
  const tricks = [...section(xml, "enabled-tricks").matchAll(/<trick name="([^"]*)"/g)].map((m) => decode(m[1]));
  const mqDungeons = [...section(xml, "master-quest-dungeons").matchAll(/<dungeon name="([^"]*)"/g)].map((m) => decode(m[1]));
  const trials = [...section(xml, "required-trials").matchAll(/<trial name="([^"]*)"/g)].map((m) => decode(m[1]));
  const songNotes = [...section(xml, "song-notes").matchAll(/<song name="([^"]*)"[^>]*>([^<]*)<\/song>/g)]
    .map((m) => [decode(m[1]), decode(m[2])]);
  const locations = {};
  for (const m of section(xml, "all-locations").matchAll(/<location name="([^"]*)"([^>]*)>([^<]*)<\/location>/g)) {
    const price = m[2].match(/price="(\d+)"/);
    locations[decode(m[1])] = { item: decode(m[3]), price: price ? Number(price[1]) : null };
  }
  const playthrough = [];
  for (const m of section(xml, "playthrough").matchAll(/<sphere level="(\d+)">([\s\S]*?)<\/sphere>/g)) {
    playthrough.push([...m[2].matchAll(/<location name="([^"]*)"[^>]*>([^<]*)<\/location>/g)]
      .map((x) => ({ name: decode(x[1]), item: decode(x[2]) })));
  }
  return { settingsList, tricks, mqDungeons, trials, songNotes, locations, playthrough };
}
module.exports = { parseSpoilerXml };
