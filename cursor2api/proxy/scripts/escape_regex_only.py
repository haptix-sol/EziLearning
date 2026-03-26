"""Escape CJK inside /regex/ literals only."""
from __future__ import annotations

import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("erf", ROOT / "escape_regex_literals_file.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)
process = mod.process

if __name__ == "__main__":
    path = pathlib.Path(sys.argv[1])
    path.write_text(process(path.read_text(encoding="utf-8")), encoding="utf-8")
    print("OK", path)
