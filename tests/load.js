// Loads the browser data/logic scripts into Node for testing.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.window = global;
const root = path.join(__dirname, "..");
for (const f of ["data/locations.js", "data/items.js", "data/settings.js", "data/enemies.js", "data/world.js", "js/logic.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
}
module.exports = global;
