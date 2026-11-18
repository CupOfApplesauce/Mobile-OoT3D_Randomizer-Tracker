(function () {
  "use strict";

  const STORAGE_KEY = "oot3d-tracker-v1";
  const AREAS = window.OOT_AREAS;
  const LOCATIONS = window.OOT_LOCATIONS;
  const SECTIONS = window.OOT_ITEM_SECTIONS;
  const DUNGEONS = window.OOT_DUNGEONS;
  const REWARDS = window.OOT_REWARDS;
  const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);
  const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
  const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

  const TYPE_LABELS = {
    check: "Chests & standard checks",
    song: "Song locations",
    reward: "Boss rewards",
    gs: "Gold Skulltulas",
    scrub: "Deku Scrubs",
    shop: "Shop items",
    cow: "Cows",
    rupee: "Freestanding rupees",
    heart: "Freestanding hearts",
  };

  const DEFAULT_STATE = () => ({
    items: {},
    dungeons: {},
    checked: {},
    peeked: {},
    openAreas: {},
    filters: { check: true, song: true, reward: true, gs: false, scrub: false, shop: false, cow: false, rupee: false, heart: false },
    hideChecked: false,
    autoCollect: true,
    showAllSpoilers: false,
    limitToSeed: true,
    collected: {}, // location name -> {item id or dungeon key} applied by auto-collect, so un-checking can undo it
    spoiler: null,
  });

  let state = load();
  let currentView = "items";
  let checksQuery = "";
  let spoilerQuery = "";

  // ---------- persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const base = DEFAULT_STATE();
        return Object.assign(base, parsed, { filters: Object.assign(base.filters, parsed.filters || {}) });
      }
    } catch (e) {
      /* storage unavailable: run in-memory */
    }
    return DEFAULT_STATE();
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        /* ignore */
      }
    }, 150);
  }

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k === "html") el.innerHTML = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // Tap = forward, long-press / right-click = back.
  function pressable(el, onTap, onLong) {
    let timer = null;
    let longFired = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      longFired = false;
      timer = setTimeout(() => {
        longFired = true;
        if (navigator.vibrate) navigator.vibrate(15);
        onLong();
      }, 450);
    });
    const cancel = () => clearTimeout(timer);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("click", (e) => {
      if (longFired) {
        e.preventDefault();
        longFired = false;
        return;
      }
      onTap();
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!longFired) onLong();
      longFired = true;
      clearTimeout(timer);
    });
  }

  function itemMax(item) {
    return item.max != null ? item.max : item.levels.length;
  }
  function getItem(id) {
    return state.items[id] || 0;
  }
  function setItem(id, value) {
    const item = ITEM_BY_ID[id];
    state.items[id] = Math.max(0, Math.min(itemMax(item), value));
    save();
  }

  function dungeonState(id) {
    if (!state.dungeons[id]) state.dungeons[id] = { keys: 0, bk: false, map: false, compass: false, mq: false, reward: "" };
    return state.dungeons[id];
  }
  function dungeonKeyMax(d) {
    return d.keys[dungeonState(d.id).mq ? 1 : 0];
  }

  // ---------- location visibility ----------
  function seedLimited() {
    return state.spoiler && state.limitToSeed && Object.keys(state.spoiler.locations).length > 0;
  }

  function locationVisible(loc) {
    if (!state.filters[loc.t]) return false;
    if (loc.v) {
      const mq = dungeonState(loc.a).mq;
      if (loc.v === "mq" && !mq) return false;
      if (loc.v === "v" && mq) return false;
    }
    if (seedLimited() && !(loc.n in state.spoiler.locations)) return false;
    return true;
  }

  function spoilerItem(name) {
    if (!state.spoiler) return null;
    const entry = state.spoiler.locations[name];
    return entry ? entry.item : null;
  }

  // ---------- auto-collect ----------
  function matchItem(itemName) {
    // Dungeon items
    for (const [did, prefixes] of Object.entries(window.OOT_DUNGEON_ITEM_PREFIX)) {
      for (const p of prefixes) {
        if (!itemName.startsWith(p + " ")) continue;
        const rest = itemName.slice(p.length + 1);
        if (rest === "Small Key") return { dungeon: did, field: "keys", amount: 1 };
        if (rest === "Key Ring") return { dungeon: did, field: "keys", amount: "ring" };
        if (rest === "Big Key" || rest === "Boss Key") return { dungeon: did, field: "bk" };
        if (rest === "Map") return { dungeon: did, field: "map" };
        if (rest === "Compass") return { dungeon: did, field: "compass" };
      }
    }
    for (const item of ALL_ITEMS) {
      if (item.fromExact) {
        const idx = item.from.indexOf(itemName);
        if (idx >= 0) return { item: item.id, setTo: idx + 1 };
        continue;
      }
      if (item.from && item.from.includes(itemName)) return { item: item.id };
      if (item.fromPrefix && itemName.startsWith(item.fromPrefix) && itemName !== "Bottle with Ruto's Letter") return { item: item.id };
    }
    return null;
  }

  function applyCollect(locName) {
    if (!state.autoCollect || !state.spoiler) return;
    const itemName = spoilerItem(locName);
    if (!itemName) return;
    const m = matchItem(itemName);
    if (!m) return;
    if (m.item) {
      const before = getItem(m.item);
      if (m.setTo != null) setItem(m.item, Math.max(before, m.setTo));
      else setItem(m.item, before + 1);
      if (itemName === "Bottle with Ruto's Letter") setItem("bottles", getItem("bottles") + 1);
      state.collected[locName] = { item: m.item, before };
    } else {
      const d = DUNGEON_BY_ID[m.dungeon];
      const ds = dungeonState(m.dungeon);
      const before = ds[m.field];
      if (m.field === "keys") ds.keys = m.amount === "ring" ? dungeonKeyMax(d) : Math.min(dungeonKeyMax(d), ds.keys + 1);
      else ds[m.field] = true;
      state.collected[locName] = { dungeon: m.dungeon, field: m.field, before, ring: m.amount === "ring" };
    }
    toast("Got: " + itemName);
  }

  function undoCollect(locName) {
    const c = state.collected[locName];
    if (!c) return;
    if (c.item) {
      const item = ITEM_BY_ID[c.item];
      if (item.fromExact) setItem(c.item, c.before);
      else setItem(c.item, getItem(c.item) - 1);
      if (spoilerItem(locName) === "Bottle with Ruto's Letter") setItem("bottles", getItem("bottles") - 1);
    } else {
      const ds = dungeonState(c.dungeon);
      if (c.field === "keys") ds.keys = c.ring ? c.before : Math.max(0, ds.keys - 1);
      else ds[c.field] = c.before;
    }
    delete state.collected[locName];
  }

  function toggleCheck(locName) {
    if (state.checked[locName]) {
      delete state.checked[locName];
      undoCollect(locName);
    } else {
      state.checked[locName] = true;
      applyCollect(locName);
    }
    save();
  }

  // ---------- Items view ----------
  function renderItems() {
    const root = $("#view-items");
    root.replaceChildren();
    root.append(
      h("p", { class: "hint" }, "Tap to add · long-press (or right-click) to remove")
    );

    for (const section of SECTIONS) {
      const grid = h("div", { class: "item-grid" });
      for (const item of section.items) {
        if (item.hideWhenZero && !getItem(item.id)) continue;
        grid.append(itemTile(item));
      }
      const details = h("details", { class: "card", open: !section.collapsed || null },
        h("summary", null, section.title),
        grid
      );
      root.append(details);
    }

    root.append(renderDungeons());
  }

  function itemTile(item) {
    const n = getItem(item.id);
    const max = itemMax(item);
    let sub;
    if (item.max != null) sub = item.label;
    else sub = n > 0 ? item.levels[n - 1] : item.levels[0];
    const cls = ["tile", n > 0 ? "on" : "", item.song ? "song" : "", item.reward ? "reward rw-" + item.reward : ""].join(" ");
    const tile = h("button", { class: cls, "aria-label": `${sub}${item.max != null ? ": " + n : ""}` },
      h("span", { class: "abbr" }, item.abbr),
      h("span", { class: "sub" }, sub),
      item.max != null ? h("span", { class: "badge" }, String(n)) :
        max > 1 && n > 0 ? h("span", { class: "badge" }, n + "/" + max) : null
    );
    pressable(tile, () => {
      // single-level and multi-level items cycle back to 0 after the top tier
      if (item.max == null && n >= max) setItem(item.id, 0);
      else setItem(item.id, n + 1);
      renderItems();
    }, () => {
      setItem(item.id, n - 1);
      renderItems();
    });
    return tile;
  }

  function renderDungeons() {
    const list = h("div", { class: "dungeon-list" });
    for (const d of DUNGEONS) {
      const ds = dungeonState(d.id);
      const keyMax = dungeonKeyMax(d);
      const row = h("div", { class: "dungeon-row" });
      row.append(h("div", { class: "dname" }, d.name));

      const chips = h("div", { class: "chips" });

      const mq = h("button", { class: "chip " + (ds.mq ? "on mq" : ""), title: "Master Quest" }, "MQ");
      mq.addEventListener("click", () => {
        ds.mq = !ds.mq;
        ds.keys = Math.min(ds.keys, dungeonKeyMax(d));
        save();
        renderItems();
      });
      chips.append(mq);

      if (d.boss) {
        const idx = Math.max(0, REWARDS.findIndex((r) => r.id === ds.reward));
        const rw = REWARDS[idx];
        const rchip = h("button", { class: "chip reward-chip " + (rw.id ? "on rw-" + ITEM_BY_ID[rw.id].reward : ""), title: "Dungeon reward" }, rw.label);
        pressable(rchip, () => {
          ds.reward = REWARDS[(idx + 1) % REWARDS.length].id;
          save();
          renderItems();
        }, () => {
          ds.reward = REWARDS[(idx - 1 + REWARDS.length) % REWARDS.length].id;
          save();
          renderItems();
        });
        chips.append(rchip);
      }

      if (keyMax > 0) {
        const k = h("button", { class: "chip " + (ds.keys > 0 ? "on" : "") + (ds.keys >= keyMax ? " full" : ""), title: "Small keys" }, `🗝 ${ds.keys}/${keyMax}`);
        pressable(k, () => {
          ds.keys = ds.keys >= keyMax ? 0 : ds.keys + 1;
          save();
          renderItems();
        }, () => {
          ds.keys = Math.max(0, ds.keys - 1);
          save();
          renderItems();
        });
        chips.append(k);
      }
      if (d.bk) chips.append(toggleChip("BK", ds, "bk", "Boss key"));
      if (d.mc) {
        chips.append(toggleChip("M", ds, "map", "Map"));
        chips.append(toggleChip("C", ds, "compass", "Compass"));
      }
      row.append(chips);
      list.append(row);
    }
    return h("details", { class: "card", open: true }, h("summary", null, "Dungeons"), list);
  }

  function toggleChip(label, obj, field, title) {
    const c = h("button", { class: "chip " + (obj[field] ? "on" : ""), title }, label);
    c.addEventListener("click", () => {
      obj[field] = !obj[field];
      save();
      renderItems();
    });
    return c;
  }

  // ---------- Checks view ----------
  function renderChecks() {
    const root = $("#view-checks");
    const scrollY = window.scrollY;
    root.replaceChildren();

    let total = 0;
    let done = 0;
    const byArea = {};
    for (const loc of LOCATIONS) {
      if (!locationVisible(loc)) continue;
      (byArea[loc.a] = byArea[loc.a] || []).push(loc);
      total++;
      if (state.checked[loc.n]) done++;
    }

    const pct = total ? Math.round((done / total) * 100) : 0;
    root.append(
      h("div", { class: "card progress-card" },
        h("div", { class: "progress-head" },
          h("strong", null, `${done} / ${total} checks`),
          h("span", null, `${pct}%`)
        ),
        h("div", { class: "bar" }, h("div", { class: "fill", style: `width:${pct}%` })),
        seedLimited() ? h("p", { class: "hint" }, "Showing only locations in your loaded seed.") : null
      )
    );

    const search = h("input", {
      type: "search", class: "search", placeholder: "Search checks…", value: checksQuery,
      "aria-label": "Search checks",
    });
    search.addEventListener("input", () => {
      checksQuery = search.value;
      renderChecks();
      const s = $("#view-checks .search");
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    });

    const hideBtn = h("button", { class: "chip " + (state.hideChecked ? "on" : "") }, state.hideChecked ? "Showing remaining" : "Hide checked");
    hideBtn.addEventListener("click", () => {
      state.hideChecked = !state.hideChecked;
      save();
      renderChecks();
    });
    root.append(h("div", { class: "toolbar" }, search, hideBtn));

    const q = checksQuery.trim().toLowerCase();
    let sectionLabel = null;
    for (const area of AREAS) {
      const locs = byArea[area.id];
      if (!locs) continue;
      const areaDone = locs.filter((l) => state.checked[l.n]).length;
      const shown = locs.filter((l) =>
        (!state.hideChecked || !state.checked[l.n]) &&
        (!q || l.n.toLowerCase().includes(q) || area.name.toLowerCase().includes(q) ||
          (state.showAllSpoilers && (spoilerItem(l.n) || "").toLowerCase().includes(q)))
      );
      if (q && shown.length === 0) continue;
      if (state.hideChecked && areaDone === locs.length && !q) continue;

      const label = area.dungeon ? "Dungeons" : "Overworld";
      if (label !== sectionLabel) {
        sectionLabel = label;
        root.append(h("h2", { class: "section-label" }, label));
      }

      const open = !!state.openAreas[area.id] || !!q;
      const complete = areaDone === locs.length;
      const mqTag = area.dungeon && dungeonState(area.id).mq ? h("span", { class: "tag mq" }, "MQ") : null;
      const header = h("button", { class: "area-head" + (complete ? " complete" : ""), "aria-expanded": String(open) },
        h("span", { class: "caret" }, open ? "▾" : "▸"),
        h("span", { class: "aname" }, area.name, mqTag),
        h("span", { class: "acount" }, `${areaDone}/${locs.length}`)
      );
      header.addEventListener("click", () => {
        state.openAreas[area.id] = !open;
        save();
        renderChecks();
      });

      const card = h("div", { class: "card area" + (complete ? " complete" : "") }, header,
        h("div", { class: "bar thin" }, h("div", { class: "fill", style: `width:${(areaDone / locs.length) * 100}%` }))
      );

      if (open) {
        const ul = h("ul", { class: "loc-list" });
        for (const loc of shown) ul.append(locationRow(loc, area));
        card.append(ul);
        const allBtn = h("button", { class: "link-btn" }, complete ? "Uncheck all" : "Check all in " + area.name);
        allBtn.addEventListener("click", () => {
          for (const l of locs) {
            if (complete ? state.checked[l.n] : !state.checked[l.n]) toggleCheck(l.n);
          }
          renderChecks();
        });
        card.append(allBtn);
      }
      root.append(card);
    }

    if (total === 0) {
      root.append(h("p", { class: "empty" }, "No checks match your filters. Turn some location types on in Settings."));
    }
    window.scrollTo(0, scrollY);
  }

  function shortName(loc, area) {
    // Drop the area prefix ("KF ", "Forest Temple ") to save space on phones.
    const prefixes = [area.name + " ", "KF ", "LW ", "SFM ", "HF ", "LLR ", "MK ", "ToT ", "HC ", "OGC ", "Kak ", "GY ", "DMT ", "GC ", "DMC ", "ZR ", "ZD ", "ZF ", "LH ", "GV ", "GF ", "Wasteland ", "Colossus ",
      "Dodongos Cavern ", "Jabu Jabus Belly ", "Gerudo Training Grounds ", "Ganon's Castle "];
    for (const p of prefixes) if (loc.n.startsWith(p) && loc.n.length > p.length + 3) return loc.n.slice(p.length);
    return loc.n;
  }

  function locationRow(loc, area) {
    const checked = !!state.checked[loc.n];
    const item = spoilerItem(loc.n);
    const revealed = item && (state.showAllSpoilers || state.peeked[loc.n] || checked);
    const price = state.spoiler && state.spoiler.locations[loc.n] && state.spoiler.locations[loc.n].price;

    const li = h("li", { class: "loc" + (checked ? " checked" : "") });
    const main = h("button", { class: "loc-main", "aria-pressed": String(checked) },
      h("span", { class: "box" }, checked ? "✓" : ""),
      h("span", { class: "loc-text" },
        h("span", { class: "lname" }, shortName(loc, area)),
        loc.t !== "check" ? h("span", { class: "tag t-" + loc.t }, loc.t === "gs" ? "GS" : loc.t) : null,
        revealed ? h("span", { class: "litem" }, "→ " + item + (price != null ? ` (${price}₨)` : "")) : null
      )
    );
    main.addEventListener("click", () => {
      toggleCheck(loc.n);
      renderChecks();
    });
    li.append(main);

    if (item && !revealed) {
      const peek = h("button", { class: "peek", "aria-label": "Reveal item at " + loc.n, title: "Peek" }, "👁");
      peek.addEventListener("click", () => {
        state.peeked[loc.n] = true;
        save();
        renderChecks();
      });
      li.append(peek);
    }
    return li;
  }

  // ---------- Spoiler view ----------
  function renderSpoiler() {
    const root = $("#view-spoiler");
    root.replaceChildren();

    const fileInput = h("input", { type: "file", accept: ".xml,text/xml,application/xml", hidden: true });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const parsed = window.parseSpoilerLog(await file.text());
        loadSpoiler(parsed);
        toast("Spoiler log loaded");
      } catch (e) {
        toast(e.message);
      }
      fileInput.value = "";
    });
    const importBtn = h("button", { class: "btn primary" }, state.spoiler ? "Load a different spoiler log" : "Load spoiler log (.xml)");
    importBtn.addEventListener("click", () => fileInput.click());

    if (!state.spoiler) {
      root.append(
        h("div", { class: "card" },
          h("h2", null, "Spoiler log"),
          h("p", null, "Load the ", h("code", null, "*-spoilerlog.xml"), " file the randomizer writes next to your patch (in ", h("code", null, "/3ds/"), " on your SD card)."),
          h("p", null, "The tracker will then:"),
          h("ul", { class: "bullets" },
            h("li", null, "show only the locations that exist in your seed"),
            h("li", null, "set Master Quest dungeons automatically"),
            h("li", null, "let you peek at single locations, or show everything"),
            h("li", null, "add items to your inventory as you check locations (optional)")
          ),
          importBtn, fileInput
        )
      );
      return;
    }

    const sp = state.spoiler;
    root.append(
      h("div", { class: "card" },
        h("h2", null, "Seed"),
        h("dl", { class: "kv" },
          h("dt", null, "Hash"), h("dd", null, sp.hash || "—"),
          h("dt", null, "Seed"), h("dd", null, sp.seed || "—"),
          h("dt", null, "Version"), h("dd", null, sp.version || "—"),
          h("dt", null, "Locations"), h("dd", null, String(Object.keys(sp.locations).length)),
          sp.mqDungeons.length ? [h("dt", null, "MQ dungeons"), h("dd", null, sp.mqDungeons.join(", "))] : null,
          sp.trials.length ? [h("dt", null, "Trials"), h("dd", null, sp.trials.join(", "))] : null
        ),
        h("div", { class: "row-btns" }, importBtn, fileInput, (() => {
          const b = h("button", { class: "btn danger" }, "Remove spoiler");
          b.addEventListener("click", () => {
            if (!confirm("Remove the loaded spoiler log? Your checked locations stay.")) return;
            state.spoiler = null;
            state.peeked = {};
            save();
            renderAll();
          });
          return b;
        })())
      )
    );

    // Item / location search
    const search = h("input", { type: "search", class: "search", placeholder: "Where is… (item or location)", value: spoilerQuery, "aria-label": "Search spoiler" });
    const results = h("ul", { class: "result-list" });
    const runSearch = () => {
      results.replaceChildren();
      const q = spoilerQuery.trim().toLowerCase();
      if (q.length < 2) return;
      const hits = Object.entries(sp.locations)
        .filter(([name, v]) => name.toLowerCase().includes(q) || v.item.toLowerCase().includes(q))
        .slice(0, 60);
      if (!hits.length) results.append(h("li", { class: "empty" }, "No matches"));
      for (const [name, v] of hits) {
        results.append(h("li", { class: state.checked[name] ? "checked" : "" },
          h("span", { class: "rloc" }, name), h("span", { class: "ritem" }, v.item)));
      }
    };
    search.addEventListener("input", () => {
      spoilerQuery = search.value;
      runSearch();
    });
    runSearch();
    root.append(h("div", { class: "card" }, h("h2", null, "Search"), search, results));

    if (sp.woth.length) {
      root.append(spoilerList("Way of the Hero", sp.woth.map((l) => [l.name, l.item])));
    }
    if (sp.hints.length) {
      root.append(spoilerList("Gossip Stone hints", sp.hints.map((x) => [x.stone, x.text]), true));
    }
    if (sp.playthrough.length) {
      const body = h("div");
      for (const sphere of sp.playthrough) {
        body.append(h("h3", null, "Sphere " + sphere.level));
        const ul = h("ul", { class: "result-list" });
        for (const l of sphere.locations) ul.append(h("li", null, h("span", { class: "rloc" }, l.name), h("span", { class: "ritem" }, l.item)));
        body.append(ul);
      }
      root.append(h("details", { class: "card" }, h("summary", null, "Playthrough (full spoiler)"), body));
    }
    if (Object.keys(sp.settings).length) {
      const dl = h("dl", { class: "kv small" });
      for (const [k, v] of Object.entries(sp.settings)) dl.append(h("dt", null, k), h("dd", null, v));
      root.append(h("details", { class: "card" }, h("summary", null, "Seed settings"), dl));
    }
  }

  function spoilerList(title, rows, stacked) {
    const ul = h("ul", { class: "result-list" + (stacked ? " stacked" : "") });
    for (const [a, b] of rows) ul.append(h("li", null, h("span", { class: "rloc" }, a), h("span", { class: "ritem" }, b)));
    return h("details", { class: "card" }, h("summary", null, title), ul);
  }

  function loadSpoiler(parsed) {
    state.spoiler = parsed;
    state.peeked = {};
    // Master Quest dungeons
    for (const d of DUNGEONS) {
      dungeonState(d.id).mq = parsed.mqDungeons.includes(d.spoilerName);
    }
    // Turn on location-type filters for anything present in the seed.
    const present = new Set();
    for (const loc of LOCATIONS) if (loc.n in parsed.locations) present.add(loc.t);
    for (const t of Object.keys(state.filters)) state.filters[t] = present.has(t);
    // Dungeon rewards are known from the spoiler, but only fill them if the player wants spoilers.
    save();
    renderAll();
  }

  // ---------- Settings view ----------
  function renderSettings() {
    const root = $("#view-settings");
    root.replaceChildren();

    const filterList = h("div", { class: "toggles" });
    for (const [t, label] of Object.entries(TYPE_LABELS)) {
      filterList.append(toggleRow(label, state.filters[t], (v) => (state.filters[t] = v)));
    }
    root.append(h("div", { class: "card" }, h("h2", null, "Location types"),
      h("p", { class: "hint" }, "Match these to your seed's shuffle settings. Loading a spoiler log sets them automatically."),
      filterList));

    root.append(h("div", { class: "card" }, h("h2", null, "Spoiler options"),
      h("div", { class: "toggles" },
        toggleRow("Only show locations in the loaded seed", state.limitToSeed, (v) => (state.limitToSeed = v)),
        toggleRow("Show every item in the checks list", state.showAllSpoilers, (v) => (state.showAllSpoilers = v)),
        toggleRow("Auto-add items when I check a location", state.autoCollect, (v) => (state.autoCollect = v)),
        (() => {
          const b = h("button", { class: "btn" }, "Fill dungeon rewards from spoiler");
          b.addEventListener("click", () => {
            if (!state.spoiler) return toast("Load a spoiler log first");
            const nameToId = Object.fromEntries(ALL_ITEMS.filter((i) => i.reward).map((i) => [i.from[0], i.id]));
            for (const [boss, did] of Object.entries(window.OOT_BOSS_LOCATIONS)) {
              const item = spoilerItem(boss);
              if (item && nameToId[item]) dungeonState(did).reward = nameToId[item];
            }
            save();
            toast("Dungeon rewards filled in");
          });
          return b;
        })()
      )));

    const exportBtn = h("button", { class: "btn" }, "Export progress");
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const a = h("a", { href: URL.createObjectURL(blob), download: "oot3d-tracker-save.json" });
      document.body.append(a);
      a.click();
      a.remove();
    });
    const importInput = h("input", { type: "file", accept: ".json,application/json", hidden: true });
    importInput.addEventListener("change", async () => {
      try {
        const parsed = JSON.parse(await importInput.files[0].text());
        state = Object.assign(DEFAULT_STATE(), parsed);
        save();
        renderAll();
        toast("Progress imported");
      } catch (e) {
        toast("Couldn't read that save file");
      }
    });
    const importBtn = h("button", { class: "btn" }, "Import progress");
    importBtn.addEventListener("click", () => importInput.click());

    const resetBtn = h("button", { class: "btn danger" }, "Reset tracker");
    resetBtn.addEventListener("click", () => {
      if (!confirm("Clear all items and checks? (Your loaded spoiler log and settings are kept.)")) return;
      const keep = { spoiler: state.spoiler, filters: state.filters, autoCollect: state.autoCollect, limitToSeed: state.limitToSeed, showAllSpoilers: state.showAllSpoilers };
      const mq = Object.fromEntries(DUNGEONS.map((d) => [d.id, dungeonState(d.id).mq]));
      state = Object.assign(DEFAULT_STATE(), keep);
      for (const [id, v] of Object.entries(mq)) dungeonState(id).mq = v;
      save();
      renderAll();
      toast("Tracker reset");
    });

    root.append(h("div", { class: "card" }, h("h2", null, "Data"),
      h("p", { class: "hint" }, "Progress is saved on this device automatically."),
      h("div", { class: "row-btns" }, exportBtn, importBtn, importInput, resetBtn)));

    root.append(h("div", { class: "card about" }, h("h2", null, "About"),
      h("p", null, "An unofficial, fan-made tracker for gamestabled's Ocarina of Time 3D Randomizer. Location names come straight from the randomizer's source so they match your spoiler log."),
      h("p", null, `${LOCATIONS.length} locations · ${AREAS.length} areas`)));
  }

  function toggleRow(label, value, onChange) {
    const input = h("input", { type: "checkbox", checked: value || null });
    input.addEventListener("change", () => {
      onChange(input.checked);
      save();
      renderAll(true);
    });
    return h("label", { class: "toggle" }, h("span", null, label), input, h("span", { class: "switch", "aria-hidden": "true" }));
  }

  // ---------- shell ----------
  function renderSeedChip() {
    const chip = $("#seedChip");
    if (state.spoiler) {
      chip.hidden = false;
      chip.textContent = state.spoiler.hash || "Seed loaded";
    } else chip.hidden = true;
  }

  function renderAll(skipSettings) {
    renderSeedChip();
    renderItems();
    renderChecks();
    renderSpoiler();
    if (!skipSettings) renderSettings();
  }

  function showView(name) {
    currentView = name;
    // Re-render on entry so changes made from other tabs (e.g. auto-collect) show up.
    ({ items: renderItems, checks: renderChecks, spoiler: renderSpoiler, settings: renderSettings })[name]();
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    window.scrollTo(0, 0);
  }

  document.querySelectorAll(".tabbar button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

  renderAll();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
