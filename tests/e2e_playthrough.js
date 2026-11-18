#!/usr/bin/env node
// End-to-end test in a phone-sized browser: load a real spoiler log, then keep tapping every check
// shown "in logic" (auto-collect adds each item) until nothing new opens up. Every location in the
// log's playthrough must have been reached, i.e. the tracker's logic can beat the seed.
//
// Usage: node tests/e2e_playthrough.js <url> <spoiler-log.xml> [screenshot-dir]
const { chromium, devices } = require("playwright");
const fs = require("fs");
const { parseSpoilerXml } = require("./spoiler_node.js");

(async () => {
  const [url, logPath, shots] = process.argv.slice(2);
  const spoiler = parseSpoilerXml(fs.readFileSync(logPath, "utf8"));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(url);
  await page.click(".tabbar [data-view=spoiler]");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#view-spoiler .btn.primary")]);
  await chooser.setFiles(logPath);
  await page.waitForSelector(".kv");
  await page.waitForTimeout(500); // state is saved with a short debounce
  // Show every location type and open every area so rows are in the DOM.
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("oot3d-tracker-v1"));
    for (const k of Object.keys(st.filters)) st.filters[k] = true;
    for (const a of window.OOT_AREAS) st.openAreas[a.id] = true;
    localStorage.setItem("oot3d-tracker-v1", JSON.stringify(st));
  });
  await page.waitForTimeout(300);
  await page.reload();
  await page.click(".tabbar [data-view=checks]");
  if (shots) await page.screenshot({ path: shots + "/logic-start.png" });

  // Sweep: tap every check that is in logic (auto-collect adds its item) until nothing new opens up.
  // The playthrough only lists required items, but the randomizer computes spheres with everything
  // collected so far, so a sweep is the fair comparison.
  let rounds = 0;
  for (;;) {
    const open = await page.$$eval("li.loc.in-logic", (els) => els.map((e) => e.dataset.loc));
    if (!open.length) break;
    rounds++;
    for (const name of open) {
      const row = page.locator(`li.loc[data-loc="${name.replace(/"/g, '\\"')}"]`);
      if (/in-logic/.test((await row.getAttribute("class")) || "")) await row.locator(".loc-main").click();
    }
  }
  const checked = new Set(await page.$$eval("li.loc.checked", (els) => els.map((e) => e.dataset.loc)));
  let failures = 0;
  spoiler.playthrough.forEach((sphere, i) => {
    for (const loc of sphere) {
      if (loc.name === "Ganon") continue; // the goal, not a check
      if (!checked.has(loc.name)) {
        console.log(`sphere ${i + 1}: never reached in logic: ${loc.name} (${loc.item})`);
        failures++;
      }
    }
  });
  console.log(`sweep finished after ${rounds} rounds, ${checked.size} checks collected`);
  const outOfLogic = await page.$$eval("li.loc.out-logic", (els) => els.map((e) => e.dataset.loc));
  if (outOfLogic.length) console.log("still out of logic:", outOfLogic.join(" | "));
  const summary = await page.textContent(".logic-summary");
  if (shots) await page.screenshot({ path: shots + "/logic-end.png" });
  console.log(`${spoiler.playthrough.length} spheres checked, ${failures} failures, errors: ${errors.length ? errors.join("; ") : "none"}`);
  console.log("final:", summary.trim());
  await browser.close();
  process.exit(failures || errors.length ? 1 : 0);
})();
