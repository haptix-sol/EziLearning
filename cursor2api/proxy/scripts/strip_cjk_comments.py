"""Remove CJK from // and /* */ comments only."""
from __future__ import annotations

import pathlib
import re
import sys

CJK = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]")


def strip_block(m: re.Match[str]) -> str:
    return CJK.sub("", m.group(0))


def run(text: str) -> str:
    lines = []
    for line in text.splitlines(keepends=True):
        if re.match(r"^\s*//", line):
            lines.append(CJK.sub("", line))
        else:
            lines.append(line)
    text = "".join(lines)
    return re.sub(r"/\*[\s\S]*?\*/", strip_block, text)


if __name__ == "__main__":
    path = pathlib.Path(sys.argv[1])
    path.write_text(run(path.read_text(encoding="utf-8")), encoding="utf-8")
    print("OK", path)
