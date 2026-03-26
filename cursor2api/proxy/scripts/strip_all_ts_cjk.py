"""escape regex CJK -> \\u, strip comment CJK, strip remaining BMP CJK from listed .ts files."""
from __future__ import annotations

import importlib.util
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"
SCR = pathlib.Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location("erf", SCR / "escape_regex_literals_file.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)
process_regex = mod.process

spec2 = importlib.util.spec_from_file_location("sc", SCR / "strip_cjk_comments.py")
mod2 = importlib.util.module_from_spec(spec2)
assert spec2.loader
spec2.loader.exec_module(mod2)
strip_comments = mod2.run

CJK = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")

SKIP = {"constants.ts", "handler.ts", "converter.ts"}


def strip_remaining(text: str) -> str:
    return CJK.sub("", text)


def main() -> None:
    for path in sorted(ROOT.glob("*.ts")):
        if path.name in SKIP:
            continue
        text = path.read_text(encoding="utf-8")
        text = process_regex(text)
        text = strip_comments(text)
        text = strip_remaining(text)
        path.write_text(text, encoding="utf-8")
        print("OK", path.name)


if __name__ == "__main__":
    main()
