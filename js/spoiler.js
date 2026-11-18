// Parses the XML spoiler log written by gamestabled's OoT3D Randomizer
// (`<seed>-spoilerlog.xml`). See source/spoiler_log.cpp upstream.
(function () {
  function text(el) {
    return (el && el.textContent ? el.textContent : "").trim();
  }

  function locationList(root, tag) {
    const parent = root.getElementsByTagName(tag)[0];
    if (!parent) return [];
    return Array.from(parent.getElementsByTagName("location")).map((el) => ({
      name: el.getAttribute("name"),
      item: text(el),
      price: el.getAttribute("price") ? Number(el.getAttribute("price")) : null,
    }));
  }

  function parseSpoilerLog(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const err = doc.getElementsByTagName("parsererror")[0];
    if (err) throw new Error("This file isn't valid XML. Make sure you picked the *-spoilerlog.xml file.");
    const root = doc.documentElement;
    if (!root || root.nodeName !== "spoiler-log") {
      throw new Error("This doesn't look like an OoT3D Randomizer spoiler log (expected <spoiler-log>).");
    }

    // Settings in document order: a few names repeat (e.g. "Stone Count" for the bridge and for LACS),
    // so the logic engine needs the order to tell them apart.
    const settings = {};
    const settingsList = [];
    const settingsEl = root.getElementsByTagName("settings")[0];
    if (settingsEl) {
      for (const s of settingsEl.getElementsByTagName("setting")) {
        settings[s.getAttribute("name")] = text(s);
        settingsList.push([s.getAttribute("name"), text(s)]);
      }
    }

    const tricks = [];
    const tricksEl = root.getElementsByTagName("enabled-tricks")[0];
    if (tricksEl) {
      for (const t of tricksEl.getElementsByTagName("trick")) tricks.push(t.getAttribute("name"));
    }

    const songNotes = [];
    const songsEl = root.getElementsByTagName("song-notes")[0];
    if (songsEl) {
      for (const s of songsEl.getElementsByTagName("song")) songNotes.push([s.getAttribute("name"), text(s)]);
    }

    const startingInventory = [];
    const startEl = root.getElementsByTagName("starting-inventory")[0];
    if (startEl) {
      for (const s of startEl.getElementsByTagName("item")) {
        startingInventory.push({ name: s.getAttribute("name"), value: text(s) });
      }
    }

    const mqDungeons = [];
    const mqEl = root.getElementsByTagName("master-quest-dungeons")[0];
    if (mqEl) {
      for (const d of mqEl.getElementsByTagName("dungeon")) mqDungeons.push(d.getAttribute("name"));
    }

    const trials = [];
    const trialEl = root.getElementsByTagName("required-trials")[0];
    if (trialEl) {
      for (const t of trialEl.getElementsByTagName("trial")) trials.push(t.getAttribute("name"));
    }

    const hints = [];
    const hintEl = root.getElementsByTagName("hints")[0];
    if (hintEl) {
      for (const h of hintEl.getElementsByTagName("hint")) {
        hints.push({ stone: h.getAttribute("location"), text: text(h) });
      }
    }

    const playthrough = [];
    const ptEl = root.getElementsByTagName("playthrough")[0];
    if (ptEl) {
      for (const sphere of ptEl.getElementsByTagName("sphere")) {
        playthrough.push({
          level: Number(sphere.getAttribute("level")),
          locations: Array.from(sphere.getElementsByTagName("location")).map((el) => ({
            name: el.getAttribute("name"),
            item: text(el),
          })),
        });
      }
    }

    const locations = {};
    for (const loc of locationList(root, "all-locations")) {
      locations[loc.name] = { item: loc.item, price: loc.price };
    }

    return {
      version: root.getAttribute("version") || "",
      seed: root.getAttribute("seed") || "",
      hash: root.getAttribute("hash") || "",
      settings,
      settingsList,
      tricks,
      songNotes,
      startingInventory,
      mqDungeons,
      trials,
      hints,
      playthrough,
      woth: locationList(root, "way-of-the-hero-locations"),
      locations,
    };
  }

  window.parseSpoilerLog = parseSpoilerLog;
})();
