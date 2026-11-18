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
    limitToSeed: false, // hide locations the spoiler log doesn't list (it omits some unshuffled ones)
    collected: {}, // location name -> {item id or dungeon key} applied by auto-collect, so un-checking can undo it
    spoiler: null,
    // Logic: randomizer setting indices (by setting variable), enabled tricks, required trials.
    logic: { settings: {}, tricks: {}, trials: [], songButtons: {} },
    showLogic: true,
    logicOnly: false,
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
        return Object.assign(base, parsed, {
          filters: Object.assign(base.filters, parsed.filters || {}),
          logic: Object.assign(base.logic, parsed.logic || {}),
        });
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

  // ---------- logic ----------
  // Runs the randomizer's logic (js/logic.js) on the tracked state. Memoized: it only reruns when
  // something that affects logic changes.
  let logicCache = { key: null, result: null };
  function logicConfig() {
    const mq = {};
    for (const d of DUNGEONS) if (dungeonState(d.id).mq) mq[d.id] = true;
    const prices = {};
    const placed = {};
    if (state.spoiler) {
      for (const [name, v] of Object.entries(state.spoiler.locations)) {
        if (v.price != null) prices[name] = v.price;
        if (/ Shop Item | Bazaar Item /.test(name) || name.startsWith("Kak Potion Shop") || name.startsWith("MK Potion Shop")) placed[name] = v.item;
      }
    }
    return {
      items: state.items,
      dungeons: state.dungeons,
      settings: state.logic.settings,
      tricks: state.logic.tricks,
      trials: state.logic.trials,
      songButtons: state.logic.songButtons,
      mq,
      prices,
      placed,
    };
  }
  function getLogic() {
    if (!window.OOTLogic || !state.showLogic) return null;
    const config = logicConfig();
    const key = JSON.stringify(config);
    if (logicCache.key !== key) {
      try {
        logicCache = { key, result: window.OOTLogic.compute(config) };
      } catch (e) {
        console.error("Logic error", e);
        logicCache = { key, result: null };
      }
    }
    return logicCache.result;
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
      if (item.from && item.from.includes(itemName)) return { item: item.id };
      if (item.fromPrefix && itemName.startsWith(item.fromPrefix) && itemName !== "Bottle with Ruto's Letter") return { item: item.id };
    }
    return null;
  }

  // Item at a location that the spoiler log doesn't list (unshuffled): its vanilla item, if we know it.
  const LOC_BY_NAME = Object.fromEntries(LOCATIONS.map((l) => [l.n, l]));
  function vanillaItem(locName) {
    const loc = LOC_BY_NAME[locName];
    if (!loc) return null;
    if (loc.t === "gs") return "Gold Skulltula Token";
    return loc.vi || null;
  }

  function applyCollect(locName) {
    if (!state.autoCollect || !state.spoiler) return;
    const itemName = spoilerItem(locName) || vanillaItem(locName);
    if (!itemName) return;
    const m = matchItem(itemName);
    if (!m) return;
    if (m.item) {
      const before = getItem(m.item);
      setItem(m.item, before + 1);
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
      setItem(c.item, getItem(c.item) - 1);
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

      if (!d.noMQ) {
        const mq = h("button", { class: "chip " + (ds.mq ? "on mq" : ""), title: "Master Quest" }, "MQ");
        mq.addEventListener("click", () => {
          ds.mq = !ds.mq;
          ds.keys = Math.min(ds.keys, dungeonKeyMax(d));
          save();
          renderItems();
        });
        chips.append(mq);
      }

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

    const logic = getLogic();
    const inLogic = (loc) => (logic ? logic.reachable.has(loc.n) : true);
    const available = (loc) => !state.checked[loc.n] && inLogic(loc);

    let total = 0;
    let done = 0;
    let availableCount = 0;
    const byArea = {};
    for (const loc of LOCATIONS) {
      if (!locationVisible(loc)) continue;
      (byArea[loc.a] = byArea[loc.a] || []).push(loc);
      total++;
      if (state.checked[loc.n]) done++;
      else if (logic && inLogic(loc)) availableCount++;
    }

    const pct = total ? Math.round((done / total) * 100) : 0;
    root.append(
      h("div", { class: "card progress-card" },
        h("div", { class: "progress-head" },
          h("strong", null, `${done} / ${total} checks`),
          h("span", null, `${pct}%`)
        ),
        h("div", { class: "bar" }, h("div", { class: "fill", style: `width:${pct}%` })),
        logic
          ? h("p", { class: "logic-summary" },
            h("span", { class: "dot in" }), ` ${availableCount} available in logic`,
            h("span", { class: "sep" }, "·"),
            h("span", { class: "dot out" }), ` ${total - done - availableCount} out of logic`)
          : null,
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

    const hideBtn = h("button", { class: "chip " + (state.hideChecked ? "on" : "") }, "Hide checked");
    hideBtn.addEventListener("click", () => {
      state.hideChecked = !state.hideChecked;
      save();
      renderChecks();
    });
    const logicBtn = logic ? h("button", { class: "chip " + (state.logicOnly ? "on in-logic-chip" : "") }, "In logic") : null;
    if (logicBtn) {
      logicBtn.addEventListener("click", () => {
        state.logicOnly = !state.logicOnly;
        save();
        renderChecks();
      });
    }
    root.append(h("div", { class: "toolbar" }, search), h("div", { class: "toolbar chips-row" }, logicBtn, hideBtn));

    const q = checksQuery.trim().toLowerCase();
    let sectionLabel = null;
    let shownAreas = 0;
    for (const area of AREAS) {
      const locs = byArea[area.id];
      if (!locs) continue;
      const areaDone = locs.filter((l) => state.checked[l.n]).length;
      const areaAvail = logic ? locs.filter(available).length : 0;
      const shown = locs.filter((l) =>
        (!state.hideChecked || !state.checked[l.n]) &&
        (!state.logicOnly || !logic || available(l)) &&
        (!q || l.n.toLowerCase().includes(q) || area.name.toLowerCase().includes(q) ||
          (state.showAllSpoilers && (spoilerItem(l.n) || "").toLowerCase().includes(q)))
      );
      if (q && shown.length === 0) continue;
      if (state.hideChecked && areaDone === locs.length && !q) continue;
      if (state.logicOnly && logic && areaAvail === 0) continue;
      shownAreas++;

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
        areaAvail ? h("span", { class: "avail", title: "Available in logic" }, String(areaAvail)) : null,
        h("span", { class: "acount" }, `${areaDone}/${locs.length}`)
      );
      header.addEventListener("click", () => {
        state.openAreas[area.id] = !open;
        save();
        renderChecks();
      });

      const cls = "card area" + (complete ? " complete" : "") + (logic && !complete && !areaAvail ? " no-logic" : "");
      const card = h("div", { class: cls }, header,
        h("div", { class: "bar thin" }, h("div", { class: "fill", style: `width:${(areaDone / locs.length) * 100}%` }))
      );

      if (open) {
        const ul = h("ul", { class: "loc-list" });
        for (const loc of shown) ul.append(locationRow(loc, area, logic ? inLogic(loc) : null));
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
    } else if (shownAreas === 0 && state.logicOnly) {
      root.append(h("p", { class: "empty" }, "Nothing left in logic. Add the items you've found on the Items tab."));
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

  function locationRow(loc, area, inLogic) {
    const checked = !!state.checked[loc.n];
    const item = spoilerItem(loc.n);
    const revealed = item && (state.showAllSpoilers || state.peeked[loc.n] || checked);
    const price = state.spoiler && state.spoiler.locations[loc.n] && state.spoiler.locations[loc.n].price;

    const logicCls = inLogic == null || checked ? "" : inLogic ? " in-logic" : " out-logic";
    const li = h("li", { class: "loc" + (checked ? " checked" : "") + logicCls, "data-loc": loc.n });
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
    // Logic settings, tricks, trials and song notes.
    if (window.OOTLogic) {
      const { settings, tricks } = window.OOTLogic.settingsFromSpoiler(parsed.settingsList || [], parsed.tricks || []);
      state.logic = {
        settings,
        tricks,
        trials: parsed.trials || [],
        songButtons: window.OOTLogic.songButtonsFromSpoiler(parsed.songNotes || []),
      };
    }
    applyStartingInventory(parsed.startingInventory || []);
    // Dungeon rewards are known from the spoiler, but only fill them if the player wants spoilers.
    save();
    renderAll();
  }

  // Starting items from the spoiler log (<starting-inventory>): "Hookshot" = "Longshot" -> level 2, etc.
  const STARTING_ITEMS = {
    "Slingshot": "slingshot", "Ocarina": "ocarina", "Bombs": "bombs", "Bombchus": "bombchus", "Boomerang": "boomerang",
    "Hookshot": "hookshot", "Bow": "bow", "Fire Arrow": "fire_arrows", "Ice Arrow": "ice_arrows",
    "Light Arrow": "light_arrows", "Megaton Hammer": "hammer", "Iron Boots": "iron_boots", "Hover Boots": "hover_boots",
    "Lens of Truth": "lens", "Din's Fire": "dins", "Farore's Wind": "farores", "Nayru's Love": "nayrus",
    "Magic Beans": "beans", "Ruto's Letter": "ruto", "Kokiri Sword": "kokiri_sword", "Master Sword": "master_sword",
    "Biggoron Sword": "biggoron", "Deku Shield": "deku_shield", "Hylian Shield": "hylian_shield",
    "Mirror Shield": "mirror_shield", "Goron Tunic": "goron_tunic", "Zora Tunic": "zora_tunic",
    "Strength Upgrade": "strength", "Scale Upgrade": "scale", "Wallet Upgrade": "wallet", "Shard of Agony": "agony",
    "Magic Meter": "magic", "Double Defense": "double_defense", "Zelda's Lullaby": "lullaby", "Epona's Song": "eponas",
    "Saria's Song": "sarias", "Sun's Song": "suns", "Song of Time": "sot", "Song of Storms": "storms",
    "Minuet of Forest": "minuet", "Bolero of Fire": "bolero", "Serenade of Water": "serenade",
    "Requiem of Spirit": "requiem", "Nocturne of Shadow": "nocturne", "Prelude of Light": "prelude",
    "Kokiri's Emerald": "emerald", "Goron's Ruby": "ruby", "Zora's Sapphire": "sapphire",
    "Light Medallion": "light_med", "Forest Medallion": "forest_med", "Fire Medallion": "fire_med",
    "Water Medallion": "water_med", "Spirit Medallion": "spirit_med", "Shadow Medallion": "shadow_med",
    "Ocarina Button L": "oca_l", "Ocarina Button R": "oca_r", "Ocarina Button X": "oca_x", "Ocarina Button Y": "oca_y",
    "Ocarina Button A": "oca_a",
  };
  function applyStartingInventory(list) {
    const S = window.OOT_SETTINGS || {};
    const optionsByName = {};
    for (const [v, def] of Object.entries(S)) if (v.startsWith("Starting") && def.options) optionsByName[def.name] = def.options;
    let bottles = 0;
    for (const { name, value } of list) {
      if (/^Bottle \d$/.test(name)) {
        if (value !== "None" && value !== "Off") bottles++;
        continue;
      }
      const id = STARTING_ITEMS[name];
      if (!id || value === "Off") continue;
      const opts = optionsByName[name];
      const level = opts ? Math.max(1, opts.indexOf(value)) : 1;
      if (getItem(id) < level) setItem(id, level);
    }
    if (bottles > getItem("bottles")) setItem("bottles", bottles);
  }

  // ---------- Settings view ----------
  function renderSettings() {
    const root = $("#view-settings");
    root.replaceChildren();

    root.append(renderPresets());
    root.append(renderLogicSettings());

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
      const startList = state.spoiler ? state.spoiler.startingInventory || [] : [];
      const keep = { spoiler: state.spoiler, filters: state.filters, autoCollect: state.autoCollect, limitToSeed: state.limitToSeed,
        showAllSpoilers: state.showAllSpoilers, logic: state.logic, showLogic: state.showLogic };
      const mq = Object.fromEntries(DUNGEONS.map((d) => [d.id, dungeonState(d.id).mq]));
      state = Object.assign(DEFAULT_STATE(), keep);
      for (const [id, v] of Object.entries(mq)) dungeonState(id).mq = v;
      applyStartingInventory(startList);
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

  // Randomizer settings that change logic. Loading a spoiler log fills these in.
  const LOGIC_SETTING_ROWS = [
    "OpenForest", "OpenKakariko", "OpenDoorOfTime", "ZorasFountain", "GerudoFortress", "Bridge", "GanonsBossKey",
    "StartingAge", "Keysanity", "BossKeysanity", "ShuffleAdultTradeQuest", "BombchusInLogic", "AmmoDrops",
    "ShuffleOcarinaButtons", "StartingHearts", "DamageMultiplier",
  ];
  const BRIDGE_COUNTS = { 2: "BridgeStoneCount", 3: "BridgeMedallionCount", 4: "BridgeRewardCount", 5: "BridgeDungeonCount", 6: "BridgeTokenCount", 7: "BridgeHeartCount" };
  const LACS_COUNTS = { "LACS-Stones": "LACSStoneCount", "LACS-Medallions": "LACSMedallionCount", "LACS-Rewards": "LACSRewardCount",
    "LACS-Dungeons": "LACSDungeonCount", "LACS-Tokens": "LACSTokenCount", "LACS-Hearts": "LACSHeartCount" };
  const TRIALS = ["Forest", "Fire", "Water", "Spirit", "Shadow", "Light"];

  function settingValue(v) {
    const S = window.OOTLogic.SETTINGS;
    return v in state.logic.settings ? state.logic.settings[v] : S[v].default;
  }

  function selectRow(v, labelOverride) {
    const def = window.OOTLogic.SETTINGS[v];
    if (!def || !def.options) return null;
    const select = h("select", { class: "select", "aria-label": def.name });
    def.options.forEach((opt, i) => {
      const o = h("option", { value: String(i) }, opt);
      if (i === settingValue(v)) o.selected = true;
      select.append(o);
    });
    select.addEventListener("change", () => {
      state.logic.settings[v] = Number(select.value);
      save();
      renderSettings();
    });
    return h("label", { class: "toggle select-row" }, h("span", null, labelOverride || def.name), select);
  }

  // ---------- presets ----------
  // Named snapshots of the seed settings (logic settings, tricks, location types). Kept apart from the
  // run itself, so resetting the tracker or loading a spoiler log never deletes them.
  const PRESET_KEY = "oot3d-tracker-presets-v1";
  let presets = loadPresets();
  let selectedPreset = presets.length ? presets[0].name : "";

  function loadPresets() {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((p) => p && typeof p.name === "string") : [];
    } catch (e) {
      return [];
    }
  }
  function savePresets() {
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
    } catch (e) {
      toast("Couldn't save presets on this device");
    }
  }
  function presetSnapshot(name) {
    return {
      name,
      settings: Object.assign({}, state.logic.settings),
      tricks: Object.assign({}, state.logic.tricks),
      filters: Object.assign({}, state.filters),
      savedAt: new Date().toISOString(),
    };
  }
  const sameSetup = (a, b) =>
    JSON.stringify([a.settings, a.tricks, a.filters]) === JSON.stringify([b.settings, b.tricks, b.filters]);
  function normalized(obj) {
    // sort keys so equal setups compare equal regardless of insertion order
    return Object.fromEntries(Object.entries(obj || {}).sort(([x], [y]) => (x < y ? -1 : 1)));
  }
  function applyPreset(p) {
    state.logic.settings = Object.assign({}, p.settings);
    state.logic.tricks = Object.assign({}, p.tricks);
    if (p.filters) state.filters = Object.assign({}, state.filters, p.filters);
  }
  function upsertPreset(p) {
    const i = presets.findIndex((x) => x.name === p.name);
    if (i >= 0) presets[i] = p;
    else presets.push(p);
    presets.sort((a, b) => a.name.localeCompare(b.name));
    selectedPreset = p.name;
    savePresets();
  }

  // Share links carry a preset in the URL fragment (never sent to a server): #preset=<base64 JSON>
  function presetLink(p) {
    const json = JSON.stringify({ name: p.name, settings: p.settings, tricks: p.tricks, filters: p.filters });
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.origin + location.pathname + "#preset=" + b64;
  }
  function importPresetFromUrl() {
    const m = location.hash.match(/^#preset=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      const p = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!p || typeof p.settings !== "object") throw new Error("bad preset");
      let name = prompt("Save the shared preset as:", p.name || "Shared preset");
      if (!name) return;
      name = name.trim().slice(0, 60);
      if (presets.some((x) => x.name === name) && !confirm(`Replace your preset "${name}"?`)) return;
      upsertPreset({ name, settings: p.settings || {}, tricks: p.tricks || {}, filters: p.filters || {}, savedAt: new Date().toISOString() });
      if (confirm(`Saved "${name}". Use it now?`)) {
        applyPreset(presets.find((x) => x.name === name));
        save();
      }
      toast(`Preset "${name}" saved`);
    } catch (e) {
      toast("That preset link looks broken");
    }
  }

  function renderPresets() {
    const card = h("div", { class: "card" }, h("h2", null, "Presets"));
    card.append(h("p", { class: "hint" },
      "Save your seed settings (logic, tricks and location types) under a name, then load them for your next run."));

    const current = presetSnapshot("");
    const sel = presets.find((p) => p.name === selectedPreset);

    if (presets.length) {
      const select = h("select", { class: "select wide", "aria-label": "Preset" });
      for (const p of presets) {
        const o = h("option", { value: p.name }, p.name);
        if (p.name === selectedPreset) o.selected = true;
        select.append(o);
      }
      select.addEventListener("change", () => {
        selectedPreset = select.value;
        renderSettings();
      });
      card.append(select);
      if (sel) {
        const matches = sameSetup(
          { settings: normalized(sel.settings), tricks: normalized(sel.tricks), filters: normalized(sel.filters) },
          { settings: normalized(current.settings), tricks: normalized(current.tricks), filters: normalized(current.filters) });
        card.append(h("p", { class: "preset-status " + (matches ? "ok" : "") },
          matches ? "✓ Current settings match this preset" : "Current settings differ from this preset"));
      }
    } else {
      card.append(h("p", { class: "empty small" }, "No presets yet. Set up the Logic section below, then save it here."));
    }

    const btn = (label, cls, fn) => {
      const b = h("button", { class: "btn " + (cls || "") }, label);
      b.addEventListener("click", fn);
      return b;
    };
    const row = h("div", { class: "row-btns" });
    if (sel) {
      row.append(btn("Load", "primary", () => {
        applyPreset(sel);
        save();
        renderAll();
        toast(`Loaded "${sel.name}"`);
      }));
      row.append(btn("New run with this preset", "", () => {
        if (!confirm(`Start a new run with "${sel.name}"? This clears your items, checks and spoiler log.`)) return;
        const keep = { autoCollect: state.autoCollect, showAllSpoilers: state.showAllSpoilers, showLogic: state.showLogic,
          limitToSeed: state.limitToSeed, filters: state.filters };
        state = Object.assign(DEFAULT_STATE(), keep);
        applyPreset(sel);
        save();
        renderAll();
        showView("items");
        toast(`New run: ${sel.name}`);
      }));
    }
    row.append(btn("Save as new…", "", () => {
      let name = prompt("Name this preset (e.g. \"Weekly league\" or \"Closed forest + MQ\"):", "");
      if (!name) return;
      name = name.trim().slice(0, 60);
      if (!name) return;
      if (presets.some((p) => p.name === name) && !confirm(`Replace the existing preset "${name}"?`)) return;
      upsertPreset(presetSnapshot(name));
      renderSettings();
      toast(`Saved "${name}"`);
    }));
    if (sel) {
      row.append(btn("Update", "", () => {
        if (!confirm(`Overwrite "${sel.name}" with the current settings?`)) return;
        upsertPreset(presetSnapshot(sel.name));
        renderSettings();
        toast(`Updated "${sel.name}"`);
      }));
      row.append(btn("Share link", "", async () => {
        const link = presetLink(sel);
        try {
          if (navigator.share) await navigator.share({ title: `OoT3D preset: ${sel.name}`, url: link });
          else {
            await navigator.clipboard.writeText(link);
            toast("Link copied");
          }
        } catch (e) {
          if (e && e.name === "AbortError") return;
          prompt("Copy this link:", link);
        }
      }));
      row.append(btn("Delete", "danger", () => {
        if (!confirm(`Delete the preset "${sel.name}"?`)) return;
        presets = presets.filter((p) => p !== sel);
        selectedPreset = presets.length ? presets[0].name : "";
        savePresets();
        renderSettings();
      }));
    }
    card.append(row);
    return card;
  }

  function renderLogicSettings() {
    const S = window.OOTLogic && window.OOTLogic.SETTINGS;
    const card = h("div", { class: "card" }, h("h2", null, "Logic"));
    card.append(h("div", { class: "toggles" },
      toggleRow("Show which checks are in logic", state.showLogic, (v) => (state.showLogic = v))));
    if (!S || !state.showLogic) return card;

    card.append(h("p", { class: "hint" }, state.spoiler
      ? "These were read from your spoiler log. Change them only if something looks off."
      : "Set these to match your seed (or load its spoiler log to fill them in)."),
      h("p", { class: "hint" }, "The tracker uses glitchless logic. Glitched logic isn't supported yet."));
    const rows = h("div", { class: "toggles" });
    for (const v of LOGIC_SETTING_ROWS) {
      rows.append(selectRow(v));
      if (v === "Bridge" && BRIDGE_COUNTS[settingValue("Bridge")]) rows.append(selectRow(BRIDGE_COUNTS[settingValue("Bridge")], "↳ Bridge requirement"));
      if (v === "GanonsBossKey") {
        const lacs = LACS_COUNTS[S.GanonsBossKey.options[settingValue("GanonsBossKey")]];
        if (lacs) rows.append(selectRow(lacs, "↳ Light Arrow Cutscene requirement"));
      }
    }
    card.append(rows);

    const trials = h("div", { class: "toggles" });
    for (const t of TRIALS) {
      const name = `The ${t} Trial`;
      trials.append(toggleRow(`${t} Trial`, state.logic.trials.includes(name), (on) => {
        state.logic.trials = state.logic.trials.filter((x) => x !== name);
        if (on) state.logic.trials.push(name);
      }));
    }
    card.append(h("details", { class: "sub" }, h("summary", null, `Required Ganon's Castle trials (${state.logic.trials.length})`), trials));

    const tricks = h("div", { class: "toggles" });
    for (const t of window.OOTLogic.TRICKS) {
      tricks.append(toggleRow(t.name, !!state.logic.tricks[t.var], (on) => {
        if (on) state.logic.tricks[t.var] = true;
        else delete state.logic.tricks[t.var];
      }));
    }
    const enabled = Object.keys(state.logic.tricks).length;
    card.append(h("details", { class: "sub" }, h("summary", null, `Logic tricks (${enabled} enabled)`), tricks));
    return card;
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
  importPresetFromUrl();
  window.addEventListener("hashchange", importPresetFromUrl);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
