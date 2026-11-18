#!/usr/bin/env python3
"""Translate gamestabled/OoT3D_Randomizer's region logic (C++) into JavaScript.

The randomizer describes the world as "areas" (regions) with events, item
locations and exits, each guarded by a C++ lambda. Those lambdas are plain
boolean expressions over logic variables (IsChild, CanUse(HOOKSHOT), ...), so a
token-level translation produces working JavaScript:

  * `[] { ... }` / `[](auto& f) { ... }`  -> arrow functions
  * `{ a, b }` initializer lists           -> `[a, b]`
  * ALL_CAPS identifiers (area/location/item keys, enum values) -> "STRINGS"
  * `Settings::X` / `Logic::X`             -> X
  * `Dungeon::DekuTree`                    -> Dungeon_DekuTree (runtime object)
  * `&Variable` (event pointers)           -> "Variable"
  * `->` -> `.`, `.Value<u8>()` -> `.Value()`, nullptr -> null

The output defines `window.OOT_WORLD_INIT(L)`, which builds the area table.
It runs inside `with (L)`, so every remaining identifier resolves against the
logic state object `L` defined in js/logic.js.

Usage:
    python3 tools/transpile_logic.py /path/to/OoT3D_Randomizer/source > data/world.js
"""
import os
import re
import sys

SRC = sys.argv[1]

TOKEN_RE = re.compile(
    r"""
    (?P<ws>\s+)
  | (?P<str>"(?:\\.|[^"\\])*")
  | (?P<chr>'(?:\\.|[^'\\])*')
  | (?P<num>0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?[uUfF]?)
  | (?P<id>[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)
  | (?P<op>->|::|&&|\|\||==|!=|<=|>=|<<|>>|[-+*/%<>=!&|^~?:;,.(){}\[\]])
    """,
    re.X,
)

ALL_CAPS = re.compile(r"^[A-Z][A-Z0-9_]*$")
BOOL_CONSTS = {"NO_DAY_NIGHT_CYCLE": "false", "DAY_NIGHT_CYCLE": "true", "NO_TIMEPASS": "false", "TIMEPASS": "true",
               "ENEMY_ON_LEDGE": "true"}
ENUMS = {}


def load_enums(src_dir):
    """Settings enum constants (shared/s_settings.h) become integers, as in C++."""
    path = os.path.join(src_dir, "..", "shared", "s_settings.h")
    text = strip_comments(open(path, encoding="utf-8").read())
    for body in re.findall(r"enum\s+\w*\s*\{(.*?)\}", text, re.S):
        value = 0
        for item in body.split(","):
            item = item.strip()
            if not item:
                continue
            if "=" in item:
                name, expr = [x.strip() for x in item.split("=", 1)]
                try:
                    value = int(expr, 0)
                except ValueError:
                    continue
            else:
                name = item
            if re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
                ENUMS[name] = value
            value += 1
STRIP_NS = ("Settings::", "Logic::", "Enemizer::", "OcarinaNotes::", "GoldSkulltulas::")


def strip_comments(text):
    out = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == '"' or c == "'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            out.append(text[i : j + 1])
            i = j + 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif c == "#":  # preprocessor line
            j = text.find("\n", i)
            i = n if j < 0 else j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def tokenize(text):
    toks = []
    pos = 0
    for m in TOKEN_RE.finditer(text):
        if m.start() != pos:
            raise SystemExit(f"Tokenizer stuck at: {text[pos:pos+60]!r}")
        pos = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        toks.append((kind, m.group()))
    if pos != len(text):
        raise SystemExit(f"Tokenizer stopped at: {text[pos:pos+60]!r}")
    return toks


def translate(text):
    toks = tokenize(strip_comments(text))
    out = []
    stack = []  # 'block' or 'list' for each open brace
    i = 0
    n = len(toks)

    def prev_sig():
        return out[-1] if out else ""

    while i < n:
        kind, t = toks[i]

        # --- declarations ------------------------------------------------
        if t == "void" and i + 2 < n and toks[i + 2][1] == "(":
            out.append("function")
            i += 1
            continue
        if t == "static" and toks[i + 1][1] == "constexpr" and toks[i + 2][1] == "auto":
            out.append("const")
            i += 3
            continue
        if t == "std::vector" and toks[i + 1][1] == "<":
            # std::vector<EventAccess> name = {...}
            j = i
            while toks[j][1] != ">":
                j += 1
            out.append("var")
            i = j + 1
            continue
        if t == "using" or t == "namespace":
            # `using namespace X;`
            while toks[i][1] != ";":
                i += 1
            i += 1
            continue

        # --- lambdas -----------------------------------------------------
        if t == "[" and toks[i + 1][1] == "]":
            i += 2
            if toks[i][1] == "(":
                # parameter list: keep only the parameter names
                depth, j, params, cur = 1, i + 1, [], []
                while depth:
                    tt = toks[j][1]
                    if tt == "(":
                        depth += 1
                    elif tt == ")":
                        depth -= 1
                        if depth == 0:
                            break
                    if tt == "," and depth == 1:
                        params.append(cur)
                        cur = []
                    else:
                        cur.append(toks[j])
                    j += 1
                if cur:
                    params.append(cur)
                names = [[x[1] for x in p if x[0] == "id"][-1] for p in params]
                out.append("(" + ", ".join(names) + ") =>")
                i = j + 1
            else:
                out.append("() =>")
            continue

        # --- braces ------------------------------------------------------
        if t == "{":
            p = prev_sig()
            if p.endswith("=>") or p in (")", "else", ";", "}", "]") and not (stack and stack[-1] == "list" and p in ("}", "]")):
                stack.append("block")
                out.append("{")
            else:
                # Initializer list. Drop a preceding type name like `GsScene{`.
                if kind == "op" and out and re.fullmatch(r"[A-Z]\w*", out[-1]) and toks[i - 1][0] == "id":
                    out.pop()
                stack.append("list")
                out.append("[")
            i += 1
            continue
        if t == "}":
            kind_open = stack.pop()
            out.append("}" if kind_open == "block" else "]")
            i += 1
            continue

        # --- operators ---------------------------------------------------
        if t == "->":
            out.append(".")
            i += 1
            continue
        if t == "&" and toks[i + 1][0] == "id" and prev_sig() in ("(", ",", "[", "return", "="):
            out.append('"' + toks[i + 1][1].split("::")[-1] + '"')
            i += 2
            continue
        if t == "." and toks[i + 1][1] == "Value" and toks[i + 2][1] == "<":
            out.append(".Value")
            i += 5  # . Value < type >
            continue
        if t == "nullptr":
            out.append("null")
            i += 1
            continue

        # --- identifiers -------------------------------------------------
        if kind == "id":
            name = t
            for ns in STRIP_NS:
                if name.startswith(ns):
                    name = name[len(ns):]
            if "::" in name:
                head, last = name.rsplit("::", 1)
                if ALL_CAPS.match(last):
                    name = last
                else:
                    name = name.replace("::", "_")
            if name in BOOL_CONSTS:
                out.append(BOOL_CONSTS[name])
            elif name in ENUMS:
                out.append(str(ENUMS[name]))
            elif ALL_CAPS.match(name) and len(name) > 1:
                out.append('"' + name + '"')
            else:
                out.append(name)
            i += 1
            continue

        if kind == "num":
            out.append(t if t.lower().startswith("0x") else t.rstrip("uUfF"))
            i += 1
            continue

        out.append(t)
        i += 1

    js = " ".join(out).replace(" ; ", " ;\n")
    js = js.replace(" . ", ".").replace(" ( ", "(").replace(" )", ")").replace("( ", "(")
    # Settings are plain numbers at runtime so that `!Setting` behaves like C++'s Option::operator bool.
    js = re.sub(r"\b(\w+) ?\.Is\(([^()]*)\)", r"(\1 === \2)", js)
    js = re.sub(r"\b(\w+) ?\.IsNot\(([^()]*)\)", r"(\1 !== \2)", js)
    js = re.sub(r"\b(\w+) ?\.Value\(\)", r"\1", js)
    # vector::insert(end, other.begin(), other.end()) -> push(...)
    js = re.sub(r"(\w+)\.insert\(\1\.end\(\) , (\w+)\.begin\(\) , \2\.end\(\)\)", r"\1.push(...\2)", js)
    return js


def function_body(text, signature):
    """Return the text of a top-level C++ function (including braces)."""
    start = text.index(signature)
    i = text.index("{", start)
    depth = 0
    clean = text  # comments may contain braces, so strip first
    j = i
    while True:
        c = clean[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return clean[start : j + 1]
        j += 1


def main():
    load_enums(SRC)
    parts = []

    la = strip_comments(open(os.path.join(SRC, "location_access.cpp"), encoding="utf-8").read())
    # The generic grotto events and the root areas live in location_access.cpp.
    m = re.search(r"std::vector<EventAccess> grottoEvents = \{.*?\};", la, re.S)
    parts.append(m.group())
    init = function_body(la, "void AreaTable_Init()")
    root_part = init[init.index("areaTable[ROOT] ="): init.index("AreaTable_Init_LostWoods();")]
    parts.append("void AreaTable_Init_Root() {" + root_part + "}")

    for fname in sorted(os.listdir(os.path.join(SRC, "location_access"))):
        if fname.endswith(".cpp"):
            parts.append(open(os.path.join(SRC, "location_access", fname), encoding="utf-8").read())
    for fname in sorted(os.listdir(os.path.join(SRC, "gold_skulltulas"))):
        if fname.endswith(".cpp"):
            parts.append(open(os.path.join(SRC, "gold_skulltulas", fname), encoding="utf-8").read())

    body = "\n".join(translate(p) for p in parts)
    inits = re.findall(r"function (AreaTable_Init_\w+|GsTable_Init_\w+)\(\)", body)

    print("// Generated by tools/transpile_logic.py from gamestabled/OoT3D_Randomizer source.")
    print("// Do not edit by hand: re-run the script when the randomizer's logic changes.")
    print("/* eslint-disable */")
    print("window.OOT_WORLD_INIT = function (L) {")
    print("  with (L) {")
    print(body)
    for f in inits:
        print(f"    {f}();")
    print("  }")
    print("};")


if __name__ == "__main__":
    main()
