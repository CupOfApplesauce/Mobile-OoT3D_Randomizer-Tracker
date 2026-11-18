// Native test harness: generates a seed + XML spoiler log with the real randomizer code.
// Usage: harness <seed> ["Setting Name=Option Text" ...]
#include <3ds.h>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include "hint_list.hpp"
#include "item_list.hpp"
#include "item_location.hpp"
#include "location_access.hpp"
#include "enemizer.hpp"
#include "settings.hpp"
#include "playthrough.hpp"
#include "utils.hpp"
#include "fill.hpp"
#include "logic.hpp"
#include "item.hpp"
#include <map>
#include <sstream>

int main(int argc, char** argv) {
    HintTable_Init();
    ItemTable_Init();
    LocationTable_Init();
    Enemizer::InitEnemyTypes();
    Settings::InitSettings();
    for (int i = 2; i < argc; i++) {
        std::string arg = argv[i];
        auto eq = arg.find('=');
        std::string name = arg.substr(0, eq), value = arg.substr(eq + 1);
        bool found = false;
        for (Menu* menu : Settings::GetAllOptionMenus()) {
            if (menu->mode != OPTION_MENU) continue;
            for (Option* opt : *menu->settingsList) {
                if (SanitizedString(opt->GetName()) == name) {
                    opt->SetSelectedIndexByString(value);
                    found = true;
                }
            }
        }
        if (!found) { std::cerr << "unknown setting: " << name << "\n"; return 2; }
    }
    Settings::seed = argv[1];
    int ret = Playthrough::Playthrough_Init(std::hash<std::string>{}(Settings::seed));
    std::cout << "\nresult " << ret << "\n";
    if (ret < 0) return 1;
    if (!getenv("RANDO_REACH")) return 0;

    // Reach mode: clear every placed item (keeping shop prices), then for each stdin line of
    // '|'-separated item names, print the locations the logic considers reachable.
    for (LocationKey loc : allLocations) {
        u16 price = Location(loc)->GetPrice();
        Location(loc)->SetPlacedItem(NONE);
        Location(loc)->SetPrice(price);
    }
    std::map<std::string, ItemKey> byName;
    for (ItemKey k = 1; k < KEY_ENUM_MAX; k++) {
        std::string n = ItemTable(k).GetName().GetNAEnglish();
        if (!n.empty() && !byName.count(n)) byName[n] = k;
    }
    if (getenv("RANDO_LISTITEMS")) for (auto& kv : byName) std::cerr << "ITEM " << kv.first << " = " << kv.second << "\n";
    std::string line;
    std::cout << "BEGIN\n";
    while (std::getline(std::cin, line)) {
        Logic::LogicReset();
        std::stringstream ss(line);
        std::string name;
        while (std::getline(ss, name, '|')) {
            if (name.empty()) continue;
            if (name[0] == '#') {  // raw item key
                ItemTable((ItemKey)std::stoi(name.substr(1))).ApplyEffect();
                continue;
            }
            auto it = byName.find(name);
            if (it == byName.end()) { std::cerr << "UNKNOWN ITEM " << name << "\n"; continue; }
            ItemTable(it->second).ApplyEffect();
        }
        auto reached = GetAccessibleLocations(allLocations);
        bool first = true;
        for (LocationKey loc : reached) {
            std::cout << (first ? "" : "|") << Location(loc)->GetName();
            first = false;
        }
        std::cout << "\n";
    }
    return 0;
}
