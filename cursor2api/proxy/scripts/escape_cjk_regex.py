"""Rewrite lines: CJK inside /.../regex literals -> \\uXXXX."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "src" / "constants.ts"


def esc_cjk(s: str) -> str:
    out: list[str] = []
    for ch in s:
        o = ord(ch)
        if 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF:
            out.append("\\u%04x" % o)
        else:
            out.append(ch)
    return "".join(out)


def process_line(line: str) -> str:
    if not re.search(r"[\u4e00-\u9fff\u3400-\u4dbf]", line):
        return line
    stripped = line.rstrip("\r\n")
    ending = line[len(stripped) :]
    m = re.match(r"^(\s*)/(.*)/([gimsuy]*)\s*(,?)\s*$", stripped)
    if not m:
        return line
    indent_slash, inner, flags, comma = m.group(1), m.group(2), m.group(3), m.group(4)
    if not re.search(r"[\u4e00-\u9fff\u3400-\u4dbf]", inner):
        return line
    new_inner = esc_cjk(inner)
    return f"{indent_slash}/{new_inner}/{flags}{comma}{ending}"


def main() -> None:
    text = PATH.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    out = [process_line(ln) for ln in lines]
    PATH.write_text("".join(out), encoding="utf-8")
    print("Wrote", PATH)


if __name__ == "__main__":
    main()
