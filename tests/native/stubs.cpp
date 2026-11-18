#include <3ds.h>
#include "patch.hpp"
#include "menu.hpp"
#include "music.hpp"
bool gInitError = false;
const PatchSymbols gPatchSymbols = {};
void GoToMenu(Menu*) {}
namespace Music {
void InitMusicRandomizer() {}
void ShuffleSequences(int) {}
}
