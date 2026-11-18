// Logic engine: decides which locations are reachable with the tracked items.
//
// This is a port of gamestabled/OoT3D_Randomizer's glitchless logic:
//   * data/world.js     – the region graph, machine-translated from source/location_access/*.cpp
//   * data/enemies.js   – vanilla enemy placements + per-enemy rules (enemizer_list.cpp / enemizer_logic.cpp)
//   * data/settings.js  – settings, tricks and logic variable names (settings.cpp / logic.cpp)
//   * this file         – hand port of logic.cpp helpers (UpdateHelpers, CanUse, ...) and of the
//                         reachability search in fill.cpp (GetAccessibleLocations).
//
// Usage:
//   const result = OOTLogic.compute({ items, dungeons, settings, tricks, mq, trials, prices, placed, songButtons });
//     items/dungeons: tracker state; settings/tricks: from settingsFromSpoiler(); mq: { dungeonId: true };
//     trials: required trial names; prices/placed: shop prices and items from the spoiler log.
//   result.reachable  -> Set of location names that are in logic
(function () {
  "use strict";

  const SETTINGS = window.OOT_SETTINGS;
  const TRICKS = window.OOT_TRICKS;
  const LOGIC_VARS = window.OOT_LOGIC_VARS;
  const KEY_TO_NAME = {};
  const NAME_TO_TYPE = {};
  const VANILLA_SHOP = {};
  for (const loc of window.OOT_LOCATIONS) {
    KEY_TO_NAME[loc.k] = loc.n;
    NAME_TO_TYPE[loc.n] = loc.t;
    if (loc.vi) VANILLA_SHOP[loc.n] = { item: loc.vi, price: loc.vp };
  }

  // Dungeon ids used by the tracker -> randomizer Dungeon objects / key variables.
  const DUNGEON_OBJ = {
    dt: "Dungeon_DekuTree", dc: "Dungeon_DodongosCavern", jb: "Dungeon_JabuJabusBelly",
    fot: "Dungeon_ForestTemple", fit: "Dungeon_FireTemple", wt: "Dungeon_WaterTemple",
    spt: "Dungeon_SpiritTemple", sht: "Dungeon_ShadowTemple", botw: "Dungeon_BottomOfTheWell",
    ic: "Dungeon_IceCavern", gtg: "Dungeon_GerudoTrainingGrounds", gc_d: "Dungeon_GanonsCastle",
  };
  const ENEMY_DUNGEON = {
    DekuTree: "dt", DodongosCavern: "dc", JabuJabusBelly: "jb", ForestTemple: "fot", FireTemple: "fit",
    WaterTemple: "wt", SpiritTemple: "spt", ShadowTemple: "sht", BottomOfTheWell: "botw", IceCavern: "ic",
    GerudoTrainingGrounds: "gtg", GanonsCastle: "gc_d",
  };
  const KEY_VARS = {
    fot: "ForestTempleKeys", fit: "FireTempleKeys", wt: "WaterTempleKeys", spt: "SpiritTempleKeys",
    sht: "ShadowTempleKeys", botw: "BottomOfTheWellKeys", gtg: "GerudoTrainingGroundsKeys",
    gc_d: "GanonsCastleKeys", gf: "GerudoFortressKeys",
  };
  const BOSS_KEY_VARS = {
    fot: "BossKeyForestTemple", fit: "BossKeyFireTemple", wt: "BossKeyWaterTemple",
    spt: "BossKeySpiritTemple", sht: "BossKeyShadowTemple", gc_d: "BossKeyGanonsCastle",
  };
  const SMALL_KEY_DUNGEON = {
    FOREST_TEMPLE: "ForestTempleKeys", FIRE_TEMPLE: "FireTempleKeys", WATER_TEMPLE: "WaterTempleKeys",
    SPIRIT_TEMPLE: "SpiritTempleKeys", SHADOW_TEMPLE: "ShadowTempleKeys", BOTTOM_OF_THE_WELL: "BottomOfTheWellKeys",
    GERUDO_TRAINING_GROUNDS: "GerudoTrainingGroundsKeys", GANONS_CASTLE: "GanonsCastleKeys",
    MARKET_TREASURE_CHEST_GAME: "TreasureGameKeys",
  };

  // Tracker item id -> logic variable (booleans), or [variable, "count"] for numbers.
  const ITEM_VARS = {
    kokiri_sword: "KokiriSword", master_sword: "MasterSword", biggoron: ["ProgressiveGiantKnife", "count"],
    deku_shield: "DekuShield", hylian_shield: "HylianShield", mirror_shield: "MirrorShield",
    goron_tunic: "GoronTunic", zora_tunic: "ZoraTunic", iron_boots: "IronBoots", hover_boots: "HoverBoots",
    slingshot: ["ProgressiveBulletBag", "count"], bombs: ["ProgressiveBombBag", "count"], bombchus: "Bombchus",
    boomerang: "Boomerang", bow: ["ProgressiveBow", "count"], fire_arrows: "FireArrows", ice_arrows: "IceArrows",
    light_arrows: "LightArrows", hookshot: ["ProgressiveHookshot", "count"], hammer: "Hammer",
    lens: "LensOfTruth", beans: "MagicBean", dins: "DinsFire", farores: "FaroresWind", nayrus: "NayrusLove",
    ocarina: ["ProgressiveOcarina", "count"], bottles: ["Bottles", "count"], ruto: "RutosLetter",
    strength: ["ProgressiveStrength", "count"], scale: ["ProgressiveScale", "count"],
    wallet: ["ProgressiveWallet", "count"], magic: ["ProgressiveMagic", "count"], double_defense: "DoubleDefense",
    agony: "ShardOfAgony", gerudo_card: "GerudoToken", zelda_letter: "ZeldasLetter", weird_egg: "WeirdEgg",
    gs: ["GoldSkulltulaTokens", "count"], triforce: ["TriforcePieces", "count"],
    heart_containers: ["HeartContainer", "count"], heart_pieces: ["PieceOfHeart", "count"],
    lullaby: "ZeldasLullaby_item", eponas: "EponasSong_item", sarias: "SariasSong_item", suns: "SunsSong_item",
    sot: "SongOfTime_item", storms: "SongOfStorms_item", minuet: "MinuetOfForest_item", bolero: "BoleroOfFire_item",
    serenade: "SerenadeOfWater_item", requiem: "RequiemOfSpirit_item", nocturne: "NocturneOfShadow_item",
    prelude: "PreludeOfLight_item",
    emerald: "KokiriEmerald", ruby: "GoronRuby", sapphire: "ZoraSapphire", forest_med: "ForestMedallion",
    fire_med: "FireMedallion", water_med: "WaterMedallion", spirit_med: "SpiritMedallion",
    shadow_med: "ShadowMedallion", light_med: "LightMedallion",
    oca_a: "OcarinaButtonA", oca_l: "OcarinaButtonL", oca_r: "OcarinaButtonR", oca_x: "OcarinaButtonX", oca_y: "OcarinaButtonY",
    trade_egg: "PocketEgg", trade_cojiro: "Cojiro", trade_mushroom: "OddMushroom", trade_poultice: "OddPoultice",
    trade_saw: "PoachersSaw", trade_broken: "BrokenSword", trade_prescription: "Prescription", trade_frog: "EyeballFrog",
    trade_eyedrops: "Eyedrops", trade_claim: "ClaimCheck",
  };
  // Logic effect of buying each shop item (item_list.cpp, ITEMTYPE_SHOP). When shops aren't shuffled the
  // randomizer assumes the player can buy these wherever the shop is reachable.
  const SHOP_EFFECTS = {
    "Buy Deku Nut (5)": "Nuts", "Buy Deku Nut (10)": "Nuts", "Buy Deku Stick (1)": "Sticks",
    "Buy Arrows (10)": "BuyArrow", "Buy Arrows (30)": "BuyArrow", "Buy Arrows (50)": "BuyArrow",
    "Buy Bombs (5) [25]": "BuyBomb", "Buy Bombs (5) [35]": "BuyBomb", "Buy Bombs (10)": "BuyBomb",
    "Buy Bombs (20)": "BuyBomb", "Buy Bombs (30)": "BuyBomb", "Buy Deku Seeds (30)": "BuySeed",
    "Buy Fish": "FishAccess", "Buy Green Potion": "BuyGPotion", "Buy Blue Potion": "BuyBPotion",
    "Buy Hylian Shield": "HylianShield", "Buy Deku Shield": "DekuShield", "Buy Goron Tunic": "GoronTunic",
    "Buy Zora Tunic": "ZoraTunic", "Buy Bombchu (5)": "BuyBombchus5", "Buy Bombchu (10)": "BuyBombchus10",
    "Buy Bombchu (20)": "BuyBombchus20", "Buy Blue Fire": "BlueFireAccess", "Buy Bottle Bug": "BugsAccess",
    "Buy Fairy's Spirit": "FairyAccess",
  };

  // Songs -> required ocarina buttons (bit per button), vanilla notes. Order: L R Y X A.
  const BTN = { L: 1, R: 2, Y: 4, X: 8, A: 16 };
  const VANILLA_SONG_BUTTONS = {
    MinuetOfForest: BTN.L | BTN.A | BTN.X | BTN.Y, BoleroOfFire: BTN.R | BTN.L | BTN.Y,
    SerenadeOfWater: BTN.L | BTN.R | BTN.Y | BTN.X, RequiemOfSpirit: BTN.L | BTN.R | BTN.Y,
    NocturneOfShadow: BTN.X | BTN.Y | BTN.L | BTN.R, PreludeOfLight: BTN.A | BTN.Y | BTN.X,
    SariasSong: BTN.R | BTN.Y | BTN.X, EponasSong: BTN.A | BTN.X | BTN.Y, ZeldasLullaby: BTN.X | BTN.A | BTN.Y,
    SunsSong: BTN.Y | BTN.R | BTN.A, SongOfTime: BTN.Y | BTN.L | BTN.R, SongOfStorms: BTN.L | BTN.R | BTN.A,
  };
  const SONG_SPOILER_NAMES = {
    "Minuet of Forest": "MinuetOfForest", "Bolero of Fire": "BoleroOfFire", "Serenade of Water": "SerenadeOfWater",
    "Requiem of Spirit": "RequiemOfSpirit", "Nocturne of Shadow": "NocturneOfShadow", "Prelude of Light": "PreludeOfLight",
    "Saria's Song": "SariasSong", "Epona's Song": "EponasSong", "Zelda's Lullaby": "ZeldasLullaby",
    "Sun's Song": "SunsSong", "Song of Time": "SongOfTime", "Song of Storms": "SongOfStorms",
  };

  // ------------------------------------------------------------------
  // Build the logic state object `L` for one configuration.
  // ------------------------------------------------------------------
  function createState(config) {
    const L = Object.assign({}, LOGIC_VARS);

    // Settings: the selected option index (booleans as true/false), like C++ Option::Value().
    for (const [v, def] of Object.entries(SETTINGS)) {
      const idx = config.settings && v in config.settings ? config.settings[v] : def.default;
      L[v] = def.bool ? idx === 1 : idx;
    }
    for (const t of TRICKS) L[t.var] = !!(config.tricks && config.tricks[t.var]);

    // Things settings.cpp derives at generation time.
    const sv = (name) => +L[name];
    const gbk = SETTINGS.GanonsBossKey.options[sv("GanonsBossKey")] || "";
    const lacs = { "LACS-Vanilla": 0, "LACS-Stones": 1, "LACS-Medallions": 2, "LACS-Rewards": 3, "LACS-Dungeons": 4, "LACS-Tokens": 5, "LACS-Hearts": 6 };
    L.LACSCondition = gbk in lacs ? lacs[gbk] : 0;
    L.HasNightStart = false;
    L.ResolvedStartingAge = sv("StartingAge") === 0 ? "adult" : "child";
    L.ShuffleInteriorEntrances = sv("ShuffleInteriorEntrances") > 0;
    L.ShuffleOverworldEntrances = !!L.ShuffleOverworldEntrances && sv("ShuffleOverworldEntrances") > 0;

    // Dungeons (vanilla / Master Quest) and Ganon's trials.
    for (const [id, obj] of Object.entries(DUNGEON_OBJ)) {
      const mq = !!(config.mq && config.mq[id]);
      L[obj] = { IsVanilla: () => !mq, IsMQ: () => mq };
      L[obj.slice("Dungeon_".length)] = L[obj]; // gold_skulltulas/*.cpp use `DekuTree.IsVanilla()`
    }
    const trials = config.trials; // array of required trial names, or null = none required
    for (const t of ["Forest", "Fire", "Water", "Spirit", "Shadow", "Light"]) {
      // spoiler names look like "The Light Trial"
      const required = trials ? trials.some((x) => x.toLowerCase().includes(t.toLowerCase() + " trial")) : false;
      L["Trial_" + t + "Trial"] = { IsSkipped: () => !required, IsRequired: () => required };
    }
    L.HasProjectileAge_Child = "Child";
    L.HasProjectileAge_Adult = "Adult";
    L.HasProjectileAge_Both = "Both";
    L.HasProjectileAge_Either = "Either";

    // Song note requirements (only matter when ocarina buttons are shuffled).
    L.SongButtons = Object.assign({}, VANILLA_SONG_BUTTONS, config.songButtons || {});

    // ---------------- LogicReset (settings-dependent part) ----------------
    const keysanity = sv("Keysanity");
    L.IsKeysanity = keysanity >= 3; // Any Dungeon, Overworld, Anywhere
    L.AmmoCanDrop = sv("AmmoDrops") !== 2;
    const shuffleButtons = !!L.ShuffleOcarinaButtons;
    for (const b of ["L", "R", "X", "Y", "A"]) L["OcarinaButton" + b] = !shuffleButtons;
    const soulsAll = sv("ShuffleEnemySouls") === 1;
    const soulsOff = sv("ShuffleEnemySouls") === 0;
    for (const v of Object.keys(LOGIC_VARS)) {
      if (!v.startsWith("Soul")) continue;
      const boss = ["SoulGohma", "SoulDodongo", "SoulBarinade", "SoulPhantomGanon", "SoulVolvagia", "SoulMorpha",
        "SoulBongoBongo", "SoulTwinrova", "SoulGanon"].includes(v);
      L[v] = boss ? soulsOff : !soulsAll;
    }
    L.BaseHearts = sv("StartingHearts");
    const dmg = sv("DamageMultiplier");
    L.Multiplier = dmg < 6 ? dmg : 10;
    L.IsGlitched = false;

    // ---------------- Tracked inventory ----------------
    const items = config.items || {};
    for (const [id, v] of Object.entries(ITEM_VARS)) {
      const n = items[id] || 0;
      if (Array.isArray(v)) L[v[0]] = n;
      else if (n > 0) L[v] = true;
    }
    L.BiggoronSword = (items.biggoron || 0) >= 2;
    if (items.beans) L.MagicBeanPack = true;
    for (const [id, ds] of Object.entries(config.dungeons || {})) {
      if (KEY_VARS[id]) L[KEY_VARS[id]] = ds.keys || 0;
      if (BOSS_KEY_VARS[id] && ds.bk) L[BOSS_KEY_VARS[id]] = true;
    }
    // Vanilla Fire Temple: the randomizer always grants the key behind the boss door.
    if (!L.IsKeysanity && !(config.mq && config.mq.fit)) L.FireTempleKeys = Math.min(8, L.FireTempleKeys + 1);
    if (keysanity === 0) {
      // "Start With" small keys
      for (const v of Object.values(KEY_VARS)) L[v] = 10;
    }
    if (sv("BossKeysanity") === 0) {
      for (const [id, v] of Object.entries(BOSS_KEY_VARS)) if (id !== "gc_d") L[v] = true;
    }
    if (gbk === "Start With") L.BossKeyGanonsCastle = true;
    if (sv("GerudoFortress") === 1) L.GerudoFortressKeys = Math.max(L.GerudoFortressKeys, 0);

    return L;
  }

  // ------------------------------------------------------------------
  // Helpers from logic.cpp
  // ------------------------------------------------------------------
  function installHelpers(L, enemyMap) {
    L.CanPlay = (song) => L.Ocarina && song;

    const MAGIC_ITEMS = new Set(["DINS_FIRE", "FARORES_WIND", "NAYRUS_LOVE", "LENS_OF_TRUTH"]);
    const MAGIC_ARROWS = new Set(["FIRE_ARROWS", "ICE_ARROWS", "LIGHT_ARROWS"]);
    const HAS = {
      DINS_FIRE: "DinsFire", FARORES_WIND: "FaroresWind", NAYRUS_LOVE: "NayrusLove", LENS_OF_TRUTH: "LensOfTruth",
      BOW: "Bow", MEGATON_HAMMER: "Hammer", IRON_BOOTS: "IronBoots", HOVER_BOOTS: "HoverBoots",
      HOOKSHOT: "Hookshot", LONGSHOT: "Longshot", SILVER_GAUNTLETS: "SilverGauntlets",
      GOLDEN_GAUNTLETS: "GoldenGauntlets", GORON_TUNIC: "GoronTunic", ZORA_TUNIC: "ZoraTunic",
      SCARECROW: "Scarecrow", DISTANT_SCARECROW: "DistantScarecrow", HYLIAN_SHIELD: "HylianShield",
      MIRROR_SHIELD: "MirrorShield", MASTER_SWORD: "MasterSword", BIGGORON_SWORD: "BiggoronSword",
      SLINGSHOT: "Slingshot", BOOMERANG: "Boomerang", KOKIRI_SWORD: "KokiriSword", STICKS: "Sticks",
      DEKU_SHIELD: "DekuShield", FIRE_ARROWS: "FireArrows", ICE_ARROWS: "IceArrows", LIGHT_ARROWS: "LightArrows",
    };
    L.HasItem = (item) => !!(HAS[item] && L[HAS[item]]);
    L.CanUse = function CanUse(item) {
      // A few upstream rules pass a bool (e.g. `CanUse(Boomerang)`); C++ converts it to item key 1 / 0.
      if (item === true) item = "KOKIRI_SWORD";
      if (!L.HasItem(item)) return false;
      const age = L.AgeItemsInLogic;
      switch (item) {
        case "BOW": return L.IsAdult || (age && L.BowAsChild);
        case "MEGATON_HAMMER": return L.IsAdult || (age && L.HammerAsChild);
        case "IRON_BOOTS": return L.IsAdult || (age && L.IronBootsAsChild);
        case "HOVER_BOOTS": return L.IsAdult || (age && L.HoverBootsAsChild);
        case "HOOKSHOT":
        case "LONGSHOT":
        case "SCARECROW":
        case "DISTANT_SCARECROW": return L.IsAdult || (age && L.HookshotAsChild);
        case "SILVER_GAUNTLETS":
        case "GOLDEN_GAUNTLETS":
        case "HYLIAN_SHIELD": return L.IsAdult;
        case "GORON_TUNIC": return L.IsAdult || (age && L.GoronTunicAsChild);
        case "ZORA_TUNIC": return L.IsAdult || (age && L.ZoraTunicAsChild);
        case "MIRROR_SHIELD": return L.IsAdult || (age && L.MirrorShieldAsChild);
        case "MASTER_SWORD": return L.IsAdult || (age && L.MasterSwordAsChild);
        case "BIGGORON_SWORD": return L.IsAdult || (age && L.BiggoronSwordAsChild);
        case "SLINGSHOT": return L.IsChild || (age && L.SlingshotAsAdult);
        case "BOOMERANG": return L.IsChild || (age && L.BoomerangAsAdult);
        case "KOKIRI_SWORD": return L.IsChild || (age && L.KokiriSwordAsAdult);
        case "STICKS": return L.IsChild || (age && L.StickAsAdult);
        case "DEKU_SHIELD": return L.IsChild || (age && L.DekuShieldAsAdult);
        default:
          return L.MagicMeter && (MAGIC_ITEMS.has(item) || (MAGIC_ARROWS.has(item) && L.CanUse("BOW")));
      }
    };
    L.HasProjectile = (age) =>
      L.HasExplosives || (age === "Child" && (L.Slingshot || L.Boomerang)) ||
      (age === "Adult" && (L.Hookshot || L.Bow)) ||
      (age === "Both" && (L.Slingshot || L.Boomerang) && (L.Hookshot || L.Bow)) ||
      (age === "Either" && (L.Slingshot || L.Boomerang || L.Hookshot || L.Bow));
    L.CanDoGlitch = () => false;
    L.GlitchEnabled = () => false;
    L.SmallKeys = (dungeon, amount) => (L[SMALL_KEY_DUNGEON[dungeon]] || 0) >= amount;
    const canSurviveHazardFor = (withFTR, withoutFTR) => {
      if (withoutFTR < 0) withoutFTR = Infinity;
      if (withFTR < 0) withFTR = withoutFTR;
      return L.Hearts * 8 >= (L.LogicFewerTunicRequirements ? withFTR : withoutFTR);
    };
    L.CanSurviveHeatFor = (a, b = -1) => L.CanUse("GORON_TUNIC") || canSurviveHazardFor(a, b);
    L.CanSurviveUnderwaterFor = (a, b = -1) => L.CanUse("ZORA_TUNIC") || canSurviveHazardFor(a, b);
    L.Gs_IsMoved = () => false;

    // ---- enemies (enemizer_logic.cpp) ----
    const defeatById = window.OOT_ENEMY_DEFEAT_INIT(L);
    const INVALID = { id: "ENEMY_INVALID", underwater: false, params: 0 };
    const roomOf = (s, l, r) => (enemyMap[s] && enemyMap[s][l] && enemyMap[s][l][r]) || {};
    const allSatisfy = (fn, s, l, r, entries) => {
      const room = roomOf(s, l, r);
      const list = entries && entries.length ? entries.map((e) => room[e] || INVALID) : Object.values(room);
      return list.every(fn);
    };
    const anySatisfies = (fn, s, l, r, entries) => !allSatisfy((x) => !fn(x), s, l, r, entries);
    const defeatLoc = (loc) => {
      if (loc.underwater) {
        if (loc.id === "ENEMY_HINT_DEKU_SCRUB") return L.CanUse("DEKU_SHIELD") || L.CanUse("HYLIAN_SHIELD");
        return L.CanUse("IRON_BOOTS") && L.CanUse("HOOKSHOT");
      }
      return defeatById(loc.id);
    };
    L.CanDefeatEnemy = function (a, b, c, d) {
      if (arguments.length === 1) return defeatById(a);
      return defeatLoc(roomOf(a, b, c)[d] || INVALID);
    };
    L.CanDefeatEnemies = (s, l, r, entries) => allSatisfy(defeatLoc, s, l, r, entries);
    const passLoc = (loc, space = "WIDE") => {
      const id = loc.id;
      if (space === "NONE") {
        if (["ENEMY_DEKU_BABA_SMALL", "ENEMY_DEKU_BABA_BIG", "ENEMY_BARI", "ENEMY_BEAMOS", "ENEMY_DEAD_HAND_HAND",
          "ENEMY_DEKU_BABA_WITHERED", "ENEMY_LIKE_LIKE"].includes(id)) return defeatLoc(loc);
        if (id === "ENEMY_FREEZARD") return loc.params === 1 || defeatLoc(loc);
      }
      if (space === "NONE" || space === "NARROW") {
        if (["ENEMY_PEAHAT", "ENEMY_MOBLIN_CLUB", "ENEMY_SKULLTULA"].includes(id)) return defeatLoc(loc);
      }
      if (id === "ENEMY_SKULLTULA") return loc.underwater ? L.CanTakeDamage : (L.SoulSkulltula && L.Nuts) || defeatLoc(loc);
      return true;
    };
    L.CanPassEnemy = (s, l, r, e, space) => passLoc(roomOf(s, l, r)[e] || INVALID, space);
    L.CanPassEnemies = (s, l, r, entries, space) => allSatisfy((x) => passLoc(x, space), s, l, r, entries);
    L.CanPassAnyEnemy = (s, l, r, entries, space) => anySatisfies((x) => passLoc(x, space), s, l, r, entries);
    L.CanCrawlNearEnemies = (s, l, r, entries) =>
      allSatisfy((x) => x.id !== "ENEMY_DEAD_HAND_HAND" || defeatById("ENEMY_DEAD_HAND_HAND"), s, l, r, entries);
    L.IsWallmaster = (s, l, r, e) => (roomOf(s, l, r)[e] || INVALID).id === "ENEMY_WALLMASTER";
    L.CanDeadHandGrab = (s, l, r) => anySatisfies((x) => x.id === "ENEMY_DEAD_HAND_HAND", s, l, r, []);
    L.CanHookEnemy = (s, l, r, e, onLedge = false) => {
      const loc = roomOf(s, l, r)[e] || INVALID;
      switch (loc.id) {
        case "ENEMY_LIKE_LIKE": case "ENEMY_REDEAD": case "ENEMY_GIBDO": return true;
        case "ENEMY_FREEZARD": return loc.params === 0;
        case "ENEMY_IRON_KNUCKLE": case "ENEMY_FLOORMASTER": return !onLedge;
      }
      return false;
    };
    const detonate = (loc, needLowHeight = false) => {
      switch (loc.id) {
        case "ENEMY_DODONGO": case "ENEMY_DODONGO_BABY": case "ENEMY_ARMOS": case "ENEMY_FLARE_DANCER":
          return defeatById(loc.id);
        case "ENEMY_PEAHAT": return !needLowHeight && defeatById(loc.id);
      }
      return false;
    };
    L.CanDetonateEnemy = (s, l, r, e, low) => detonate(roomOf(s, l, r)[e] || INVALID, low);
    L.CanDetonateAnyEnemy = (s, l, r, entries, low) => anySatisfies((x) => detonate(x, low), s, l, r, entries);
    const swords = () => L.CanUse("KOKIRI_SWORD") || L.CanUse("MASTER_SWORD") || L.CanUse("BIGGORON_SWORD");
    L.CanGetDekuBabaSticks = (s, l, r, entries) => anySatisfies((loc) => {
      if (loc.underwater) return false;
      if (loc.id === "ENEMY_DEKU_BABA_BIG" || loc.id === "ENEMY_DEKU_BABA_SMALL") return L.SoulDekuBaba && (swords() || L.CanUse("BOOMERANG"));
      if (loc.id === "ENEMY_DEKU_BABA_WITHERED") return defeatById(loc.id);
      return false;
    }, s, l, r, entries);
    L.CanGetDekuBabaNuts = (s, l, r, entries) => anySatisfies((loc) => {
      const common = () => swords() || L.CanUse("STICKS") || L.CanUse("MEGATON_HAMMER") || L.CanUse("BOW") ||
        L.CanUse("SLINGSHOT") || L.CanUse("DINS_FIRE") || L.HasExplosives;
      if (loc.id === "ENEMY_DEKU_BABA_BIG") return !loc.underwater && L.SoulDekuBaba && common();
      if (loc.id === "ENEMY_DEKU_BABA_SMALL") {
        return L.SoulDekuBaba && (loc.underwater ? L.CanUse("IRON_BOOTS") && L.CanUse("HOOKSHOT") : common() || L.CanUse("HOOKSHOT"));
      }
      return false;
    }, s, l, r, entries);
  }

  // UpdateHelpers() from logic.cpp. Called before every condition, as in the randomizer.
  function updateHelpers(L) {
    L.NumBottles = L.NoBottles ? 0 : L.Bottles + (L.DeliverLetter ? 1 : 0);
    L.HasBottle = L.NumBottles >= 1;
    L.Slingshot = L.ProgressiveBulletBag >= 1 && (L.BuySeed || L.AmmoCanDrop);
    L.Ocarina = L.ProgressiveOcarina >= 1;
    L.OcarinaOfTime = L.ProgressiveOcarina >= 2;
    L.MagicMeter = L.ProgressiveMagic >= 1 && (L.AmmoCanDrop || (L.HasBottle && (L.BuyGPotion || L.BuyBPotion)));
    L.BombBag = L.ProgressiveBombBag >= 1 && (L.BuyBomb || L.AmmoCanDrop);
    L.Hookshot = L.ProgressiveHookshot >= 1;
    L.Longshot = L.ProgressiveHookshot >= 2;
    L.Bow = L.ProgressiveBow >= 1 && (L.BuyArrow || L.AmmoCanDrop);
    L.GoronBracelet = L.ProgressiveStrength >= 1;
    L.SilverGauntlets = L.ProgressiveStrength >= 2;
    L.GoldenGauntlets = L.ProgressiveStrength >= 3;
    L.SilverScale = L.ProgressiveScale >= 1;
    L.GoldScale = L.ProgressiveScale >= 2;
    L.AdultsWallet = L.ProgressiveWallet >= 1;
    L.BiggoronSword = L.BiggoronSword || L.ProgressiveGiantKnife >= 2;
    L.OcarinaButtonsCount = +L.OcarinaButtonL + +L.OcarinaButtonR + +L.OcarinaButtonX + +L.OcarinaButtonY + +L.OcarinaButtonA;
    const owned = (L.OcarinaButtonL ? 1 : 0) | (L.OcarinaButtonR ? 2 : 0) | (L.OcarinaButtonY ? 4 : 0) |
      (L.OcarinaButtonX ? 8 : 0) | (L.OcarinaButtonA ? 16 : 0);
    const playable = (song) => L[song + "_item"] && !(L.SongButtons[song] & ~owned);
    L.ZeldasLullaby = playable("ZeldasLullaby");
    L.SariasSong = playable("SariasSong");
    L.SunsSong = playable("SunsSong");
    L.SongOfStorms = playable("SongOfStorms");
    L.EponasSong = playable("EponasSong");
    L.SongOfTime = playable("SongOfTime");
    L.MinuetOfForest = playable("MinuetOfForest");
    L.BoleroOfFire = playable("BoleroOfFire");
    L.SerenadeOfWater = playable("SerenadeOfWater");
    L.RequiemOfSpirit = playable("RequiemOfSpirit");
    L.NocturneOfShadow = playable("NocturneOfShadow");
    L.PreludeOfLight = playable("PreludeOfLight");
    L.ScarecrowSong = L.ScarecrowSong || L.FreeScarecrow || (L.ChildScarecrow && L.AdultScarecrow);
    L.Scarecrow = L.Hookshot && L.CanPlay(L.ScarecrowSong);
    L.DistantScarecrow = L.Longshot && L.CanPlay(L.ScarecrowSong);
    L.DekuStickDrop = L.StickPot || L.DekuBabaSticks;
    L.DekuNutDrop = (L.NutPot || L.NutCrate || L.DekuBabaNuts) && L.AmmoCanDrop;
    L.BugsAccess = L.BugShrub || L.WanderingBugs || L.BugRock;
    L.FishAccess = L.LoneFish || L.FishGroup;
    L.FairyAccess = L.FairyPot || L.GossipStoneFairy || L.BeanPlantFairy || L.ButterflyFairy || L.FreeFairies || L.FairyPond;
    L.Bombs = L.BombBag;
    L.Nuts = L.DekuNutDrop || L.Nuts;
    L.Sticks = L.DekuStickDrop || L.Sticks;
    L.Bugs = L.HasBottle && L.BugsAccess;
    L.BlueFire = (L.HasBottle && L.BlueFireAccess) || (L.ExtraArrowEffects && L.CanUse("ICE_ARROWS"));
    L.Fish = L.HasBottle && L.FishAccess;
    L.Fairy = L.HasBottle && L.FairyAccess && L.Hearts > 0;
    L.FoundBombchus = L.BombchuDrop || L.Bombchus || L.Bombchus5 || L.Bombchus10 || L.Bombchus20;
    L.CanPlayBowling = (L.BombchusInLogic && L.FoundBombchus) || (!L.BombchusInLogic && L.BombBag);
    L.HasBombchus = L.BuyBombchus5 || L.BuyBombchus10 || L.BuyBombchus20 || (L.AmmoDrops === 1 && L.FoundBombchus);
    L.HasExplosives = L.Bombs || (L.BombchusInLogic && L.HasBombchus);
    L.HasBoots = L.IronBoots || L.HoverBoots;
    const t = !L.ShuffleAdultTradeQuest;
    L.Eyedrops = L.Eyedrops || (t && L.ClaimCheck);
    L.EyeballFrog = L.EyeballFrog || (t && L.Eyedrops);
    L.Prescription = L.Prescription || (t && L.EyeballFrog);
    L.BrokenSword = L.BrokenSword || (t && L.Prescription);
    L.PoachersSaw = L.PoachersSaw || (t && L.BrokenSword);
    L.OddPoultice = L.OddPoultice || (t && L.PoachersSaw);
    L.OddMushroom = L.OddMushroom || (t && L.OddPoultice);
    L.Cojiro = L.Cojiro || (t && L.OddMushroom);
    L.PocketEgg = L.PocketEgg || (t && L.Cojiro);
    const C = L.CanUse;
    L.CanBlastOrSmash = L.HasExplosives || C("MEGATON_HAMMER");
    L.CanChildAttack = L.IsChild && (L.Slingshot || L.Boomerang || L.Sticks || L.KokiriSword || L.HasExplosives ||
      C("DINS_FIRE") || C("MASTER_SWORD") || C("MEGATON_HAMMER") || C("BIGGORON_SWORD") || C("HOOKSHOT"));
    L.CanChildDamage = L.IsChild && (L.Slingshot || L.Sticks || L.KokiriSword || L.HasExplosives || C("DINS_FIRE") ||
      C("MASTER_SWORD") || C("MEGATON_HAMMER") || C("BIGGORON_SWORD"));
    L.CanAdultAttack = L.IsAdult && (C("SLINGSHOT") || C("BOOMERANG") || C("STICKS") || C("KOKIRI_SWORD") ||
      L.HasExplosives || C("DINS_FIRE") || L.MasterSword || L.Hammer || L.BiggoronSword || L.Hookshot);
    L.CanAdultDamage = L.IsAdult && (C("SLINGSHOT") || C("STICKS") || C("KOKIRI_SWORD") || L.HasExplosives ||
      C("DINS_FIRE") || L.MasterSword || L.Hammer || L.BiggoronSword);
    L.CanStunDeku = L.CanAdultAttack || L.CanChildAttack || L.Nuts || L.HasShield;
    L.CanCutShrubs = C("KOKIRI_SWORD") || C("BOOMERANG") || L.HasExplosives || C("MASTER_SWORD") ||
      C("MEGATON_HAMMER") || C("BIGGORON_SWORD");
    L.CanDive = L.ProgressiveScale >= 1;
    L.CanLeaveForest = L.OpenForest !== 0 || L.IsAdult || L.DekuTreeClear || L.ShuffleInteriorEntrances ||
      L.ShuffleOverworldEntrances;
    L.CanPlantBugs = L.IsChild && L.Bugs;
    L.CanRideEpona = L.IsAdult && L.Epona && L.CanPlay(L.EponasSong);
    L.CanSummonGossipFairy = L.Ocarina && (L.ZeldasLullaby || L.EponasSong || L.SongOfTime || L.SunsSong);
    L.CanSummonGossipFairyWithoutSuns = L.Ocarina && (L.ZeldasLullaby || L.EponasSong || L.SongOfTime);
    L.Hearts = L.GloomMode === 0 ? L.BaseHearts + L.HeartContainer + (L.PieceOfHeart >> 2) : 0;
    const shift = 2 + (L.DoubleDefense ? 1 : 0);
    const hp = L.Hearts << shift;
    L.EffectiveHealth = (hp >> L.Multiplier) + (hp % (1 << L.Multiplier) > 0 ? 1 : 0);
    L.NeedNayrusLove = L.EffectiveHealth <= 1;
    L.CanSurviveDamage = !L.NeedNayrusLove || C("NAYRUS_LOVE");
    L.CanTakeDamage = L.Fairy || L.CanSurviveDamage;
    L.CanTakeDamageTwice = (L.Fairy && L.NumBottles >= 2) || (L.EffectiveHealth === 2 && (C("NAYRUS_LOVE") || L.Fairy)) ||
      L.EffectiveHealth > 2;
    let bonk = [0, 1, 1, 2, 3, 5, 1000][L.BonkDamage] || 0;
    if (L.DoubleDefense) bonk = Math.floor((bonk + 1) / 2);
    L.CanBonk = L.Hearts > bonk || (L.Fairy && L.Hearts > 0) || C("NAYRUS_LOVE");
    L.CanBreakCrate = L.CanBonk || L.CanBlastOrSmash;
    L.CanOpenBombGrotto = L.CanBlastOrSmash && (L.ShardOfAgony || L.LogicGrottosWithoutAgony);
    L.CanOpenStormGrotto = L.CanPlay(L.SongOfStorms) && (L.ShardOfAgony || L.LogicGrottosWithoutAgony);
    L.HookshotOrBoomerang = C("HOOKSHOT") || C("BOOMERANG");
    L.CanGetNightTimeGS = L.AtNight && (L.CanPlay(L.SunsSong) || !L.NightGSExpectSuns);
    L.GuaranteeTradePath = L.ShuffleInteriorEntrances || L.ShuffleOverworldEntrances || L.LogicBiggoronBolero ||
      L.CanBlastOrSmash || L.StopGCRollingGoronAsAdult;
    L.HasFireSource = C("DINS_FIRE") || C("FIRE_ARROWS");
    L.HasFireSourceWithTorch = L.HasFireSource || C("STICKS");
    L.CanFinishGerudoFortress =
      (L.GerudoFortress === 0 && L.GerudoFortressKeys >= 4 && L.CanDefeatEnemy(12, 0, 1, 1) &&
        L.CanDefeatEnemy(12, 0, 2, 1) && L.CanDefeatEnemy(12, 0, 4, 1) && L.CanDefeatEnemy(12, 0, 5, 1) &&
        (L.GerudoToken || C("BOW") || C("HOOKSHOT") || C("HOVER_BOOTS") || L.LogicGerudoKitchen)) ||
      (L.GerudoFortress === 1 && L.GerudoFortressKeys >= 1 && L.CanDefeatEnemy(12, 0, 2, 1)) ||
      (L.GerudoFortress !== 0 && L.GerudoFortress !== 1);
    L.HasShield = C("HYLIAN_SHIELD") || C("DEKU_SHIELD");
    L.CanShield = C("MIRROR_SHIELD") || L.HasShield;
    L.CanJumpslash = C("STICKS") || C("KOKIRI_SWORD") || C("MASTER_SWORD") || C("BIGGORON_SWORD");
    L.CanUseProjectile = L.HasExplosives || C("BOW") || C("HOOKSHOT") || C("SLINGSHOT") || C("BOOMERANG");
    L.CanUseMagicArrow = C("FIRE_ARROWS") || C("ICE_ARROWS") || C("LIGHT_ARROWS");
    L.MedallionCount = +L.ForestMedallion + +L.FireMedallion + +L.WaterMedallion + +L.SpiritMedallion +
      +L.ShadowMedallion + +L.LightMedallion;
    L.StoneCount = +L.KokiriEmerald + +L.GoronRuby + +L.ZoraSapphire;
    L.DungeonCount = +L.DekuTreeClear + +L.DodongosCavernClear + +L.JabuJabusBellyClear + +L.ForestTempleClear +
      +L.FireTempleClear + +L.WaterTempleClear + +L.SpiritTempleClear + +L.ShadowTempleClear;
    L.HasAllStones = L.StoneCount === 3;
    L.HasAllMedallions = L.MedallionCount === 6;
    const B = L.Bridge;
    const is = (v) => B === v;
    L.CanBuildRainbowBridge = is(0) ||
      (is(1) && L.ShadowMedallion && L.SpiritMedallion && L.LightArrows) ||
      (is(2) && L.StoneCount >= L.BridgeStoneCount) ||
      (is(3) && L.MedallionCount >= L.BridgeMedallionCount) ||
      (is(4) && L.StoneCount + L.MedallionCount >= L.BridgeRewardCount) ||
      (is(5) && L.DungeonCount >= L.BridgeDungeonCount) ||
      (is(6) && L.GoldSkulltulaTokens >= L.BridgeTokenCount) ||
      (is(7) && L.Hearts >= L.BridgeHeartCount);
    const lc = L.LACSCondition;
    L.CanTriggerLACS =
      (lc === 0 && L.ShadowMedallion && L.SpiritMedallion) ||
      (lc === 1 && L.StoneCount >= L.LACSStoneCount) ||
      (lc === 2 && L.MedallionCount >= L.LACSMedallionCount) ||
      (lc === 3 && L.StoneCount + L.MedallionCount >= L.LACSRewardCount) ||
      (lc === 4 && L.DungeonCount >= L.LACSDungeonCount) ||
      (lc === 5 && L.GoldSkulltulaTokens >= L.LACSTokenCount) ||
      (lc === 6 && L.Hearts >= L.LACSHeartCount);
    if (L.TriforceHunt) L.BossKeyGanonsCastle = L.TriforcePieces >= L.TriforcePiecesTotal + 1;
  }

  // ------------------------------------------------------------------
  // World construction (location_access.cpp)
  // ------------------------------------------------------------------
  function buildWorld(L) {
    const areaTable = {};
    const gsTable = {};
    const blankArea = (key) => ({
      key, name: "Invalid Area", timePass: false, events: [], locations: [], exits: [],
      childDay: false, childNight: false, adultDay: false, adultNight: false, addedToPool: false,
      Child() { return this.childDay || this.childNight; },
      Adult() { return this.adultDay || this.adultNight; },
      BothAgesCheck() { return this.Child() && this.Adult(); },
      HasAccess() { return this.Child() || this.Adult(); },
    });
    const getArea = (key) => areaTable[key] || (areaTable[key] = blankArea(key));

    L.areaTable = new Proxy(areaTable, {
      set(target, key, value) {
        value.key = key;
        target[key] = value;
        return true;
      },
    });
    L.gsTable = gsTable;
    L.Area = (name, scene, hint, timePass, events, locations, exits) =>
      Object.assign(blankArea(null), { name, timePass, events, locations, exits });
    L.EventAccess = (variable, fns) => ({ variable, fn: fns[0] });
    L.LocationAccess = (key, fns) => ({ key, fn: fns[0] });
    L.Entrance = (to, fns) => ({ to, fn: fns[0] });
    L.GoldSkulltulaData = function (key, arrayIndex, bitFlag, age, relevancy, original) {
      return { key, relevancy, original };
    };
    L.AreaTable = getArea;
    L.Here = (areaKey, fn) => {
      if (Array.isArray(fn)) fn = fn[0]; // `Here(X, { [] { ... } })`
      const area = getArea(areaKey);
      const pastAdult = L.IsAdult;
      const pastChild = L.IsChild;
      L.IsChild = area.Child();
      L.IsAdult = area.Adult();
      updateHelpers(L);
      const v = fn() && (L.IsAdult || L.IsChild);
      L.IsChild = pastChild;
      L.IsAdult = pastAdult;
      return v;
    };
    L.CanPlantBean = (areaKey) => (L.MagicBean || L.MagicBeanPack) && getArea(areaKey).BothAgesCheck();
    L.BothAges = (areaKey) => getArea(areaKey).BothAgesCheck();
    L.ChildCanAccess = (areaKey) => getArea(areaKey).Child();
    L.AdultCanAccess = (areaKey) => getArea(areaKey).Adult();
    L.HasAccessTo = (areaKey) => getArea(areaKey).HasAccess();

    window.OOT_WORLD_INIT(L);

    // Gs_AssignLocations: gold skulltulas at their original spots (random GS locations aren't modelled).
    for (const gs of Object.values(gsTable)) {
      if (gs.relevancy && !gs.relevancy()) continue;
      const orig = gs.original;
      const areaKey = orig[0];
      const fns = orig.slice().reverse().find((x) => Array.isArray(x) && typeof x[0] === "function");
      getArea(areaKey).locations.push({ key: gs.key, fn: fns[0] });
    }
    for (const area of Object.values(areaTable)) {
      for (const exit of area.exits) exit.parent = area;
    }
    return areaTable;
  }

  function buildEnemyMap(mq) {
    const map = {};
    for (const [cond, s, l, r, e, id, underwater] of window.OOT_ENEMY_LOCATIONS) {
      if (cond) {
        const [d, variant] = cond.split(":");
        const isMQ = !!mq[ENEMY_DUNGEON[d]];
        if ((variant === "mq") !== isMQ) continue;
      }
      ((((map[s] = map[s] || {})[l] = map[s][l] || {})[r] = map[s][l][r] || {}))[e] = { id, underwater, params: 0 };
    }
    return map;
  }

  // ------------------------------------------------------------------
  // Reachability search (fill.cpp GetAccessibleLocations, ReachabilitySearch mode)
  // ------------------------------------------------------------------
  function checkAt(L, age, time, fn) {
    L.IsChild = age === "child";
    L.IsAdult = age === "adult";
    L.AtDay = time === "day";
    L.AtNight = time === "night";
    updateHelpers(L);
    return !!fn();
  }
  const AGE_TIMES = [["childDay", "child", "day"], ["childNight", "child", "night"], ["adultDay", "adult", "day"], ["adultNight", "adult", "night"]];

  function compute(config) {
    const L = createState(config);
    const enemyMap = buildEnemyMap(config.mq || {});
    installHelpers(L, enemyMap);
    const areas = buildWorld(L);
    const root = areas.ROOT;
    const tot = areas.TOT_BEYOND_DOOR_OF_TIME;
    if (L.ResolvedStartingAge === "adult") root.adultDay = true;
    else root.childDay = true;

    // Shop prices/items come from the spoiler log when shuffled, otherwise from the vanilla shop table.
    const prices = config.prices || {};
    const shopItem = (name) => {
      if (config.placed && name in config.placed) return config.placed[name];
      return config.noVanillaShop ? "" : (VANILLA_SHOP[name] || {}).item || "";
    };
    const canBuy = (name) => {
      if (NAME_TO_TYPE[name] !== "shop") return true;
      const vanilla = VANILLA_SHOP[name] || {};
      const price = name in prices ? prices[name] : vanilla.price;
      let ok = true;
      if (price > 500) ok = L.ProgressiveWallet >= 3;
      else if (price > 200) ok = L.ProgressiveWallet >= 2;
      else if (price > 99) ok = L.ProgressiveWallet >= 1;
      const item = shopItem(name);
      if (/^Buy (Blue Fire|Bottle Bug|Fish|Fairy's Spirit)/.test(item)) ok = ok && L.HasBottle;
      else if (/^Buy Bombchu/.test(item)) ok = ok && ((!L.BombchusInLogic && L.Bombs) || (L.BombchusInLogic && L.FoundBombchus));
      return ok;
    };

    const reached = new Set();
    const pool = [root];
    root.addedToPool = true;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 500) {
      changed = false;
      for (let i = 0; i < pool.length; i++) {
        const area = pool[i];
        // UpdateEvents
        if (area.timePass) {
          if (area.Child()) {
            if (!area.childDay || !area.childNight || !root.childDay || !root.childNight) changed = true;
            area.childDay = area.childNight = root.childDay = root.childNight = true;
          }
          if (area.Adult()) {
            if (!area.adultDay || !area.adultNight || !root.adultDay || !root.adultNight) changed = true;
            area.adultDay = area.adultNight = root.adultDay = root.adultNight = true;
          }
        }
        for (const ev of area.events) {
          if (L[ev.variable]) continue;
          if (AGE_TIMES.some(([flag, age, time]) => area[flag] && checkAt(L, age, time, ev.fn))) {
            L[ev.variable] = true;
            changed = true;
          }
        }
        // Exits
        for (const exit of area.exits) {
          const conn = areas[exit.to];
          if (!conn) continue;
          for (const [flag, age, time] of AGE_TIMES) {
            if (!conn[flag] && area[flag] && checkAt(L, age, time, exit.fn)) {
              conn[flag] = true;
              changed = true;
            }
          }
          if (tot) {
            if (!root.Adult() && tot.Child()) {
              root.adultDay = tot.childDay;
              root.adultNight = tot.childNight;
            } else if (!root.Child() && tot.Adult()) {
              root.childDay = tot.adultDay;
              root.childNight = tot.adultNight;
            }
          }
          if (!conn.addedToPool && AGE_TIMES.some(([flag, age, time]) => area[flag] && checkAt(L, age, time, exit.fn))) {
            conn.addedToPool = true;
            pool.push(conn);
            changed = true;
          }
        }
        // Locations
        for (const loc of area.locations) {
          const name = KEY_TO_NAME[loc.key];
          if (!name || reached.has(name)) continue;
          if (AGE_TIMES.some(([flag, age, time]) => area[flag] && checkAt(L, age, time, loc.fn)) && canBuy(name)) {
            reached.add(name);
            // Renewable shop purchases count as collected, like in the randomizer's search.
            if (config.applyShopItems !== false && NAME_TO_TYPE[name] === "shop") {
              const effect = SHOP_EFFECTS[shopItem(name)];
              if (effect && !L[effect]) {
                L[effect] = true;
                changed = true;
              }
            }
          }
        }
      }
    }

    const access = {};
    for (const [key, a] of Object.entries(areas)) {
      if (a.HasAccess()) access[key] = { child: a.Child(), adult: a.Adult() };
    }
    return { reachable: reached, areas: access, L };
  }

  // Map spoiler-log settings (<setting name="...">text</setting>) to setting indices.
  function settingsFromSpoiler(spoilerSettings, enabledTricks) {
    const byName = {};
    for (const [v, def] of Object.entries(SETTINGS)) (byName[def.name] = byName[def.name] || []).push(v);
    const settings = {};
    let context = "";
    for (const [name, text] of spoilerSettings) {
      if (name === "Rainbow Bridge") context = "Bridge";
      else if (name === "Ganon's Boss Key") context = "LACS";
      const candidates = byName[name] || [];
      let v = candidates[0];
      if (candidates.length > 1) v = candidates.find((c) => c.startsWith(context)) || candidates[0];
      if (!v) continue;
      const opts = SETTINGS[v].options;
      if (!opts) continue;
      const idx = opts.indexOf(text);
      if (idx >= 0) settings[v] = idx;
    }
    const tricks = {};
    const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const enabled = new Set((enabledTricks || []).map(norm));
    for (const t of TRICKS) if (enabled.has(norm(t.name))) tricks[t.var] = true;
    return { settings, tricks };
  }

  function songButtonsFromSpoiler(songNotes) {
    const out = {};
    for (const [name, notes] of songNotes || []) {
      const key = SONG_SPOILER_NAMES[name];
      if (!key) continue;
      let mask = 0;
      for (const n of notes.split(/\s+/)) if (BTN[n]) mask |= BTN[n];
      if (mask) out[key] = mask;
    }
    return out;
  }

  window.OOTLogic = { compute, settingsFromSpoiler, songButtonsFromSpoiler, SETTINGS, TRICKS };
})();
