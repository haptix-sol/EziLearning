"""
Walk a .ts file and escape CJK inside /regex/ literals (same rules as JS).
Skips strings and // comments when detecting regex start (heuristic).
"""
from __future__ import annotations

import pathlib
import re
import sys

CJK = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")


def esc_cjk(s: str) -> str:
    out: list[str] = []
    for ch in s:
        o = ord(ch)
        if 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF:
            out.append("\\u%04x" % o)
        else:
            out.append(ch)
    return "".join(out)


def process(text: str) -> str:
    i = 0
    n = len(text)
    out: list[str] = []
    state = "code"  # code | squote | dquote | template | linecom | blockcom | regex
    regex_start_pred = True  # loose: / likely regex after these
    template_depth = 0

    def prev_non_ws(j: int) -> str:
        k = j - 1
        while k >= 0 and text[k] in " \t":
            k -= 1
        return text[k] if k >= 0 else ""

    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if state == "code":
            if c == "/" and nxt == "/":
                state = "linecom"
                out.append(c)
                i += 1
                continue
            if c == "/" and nxt == "*":
                state = "blockcom"
                out.append(c)
                i += 1
                continue
            if c == "'" and (i == 0 or text[i - 1] != "\\"):
                state = "squote"
                regex_start_pred = False
                out.append(c)
                i += 1
                continue
            if c == '"' and (i == 0 or text[i - 1] != "\\"):
                state = "dquote"
                regex_start_pred = False
                out.append(c)
                i += 1
                continue
            if c == "`":
                state = "template"
                template_depth = 1
                regex_start_pred = False
                out.append(c)
                i += 1
                continue
            if c == "/" and regex_start_pred:
                # start regex literal — collect until closing /flags
                j = i + 1
                depth_bracket = 0
                while j < n:
                    if text[j] == "\\" and j + 1 < n:
                        j += 2
                        continue
                    if text[j] == "[":
                        depth_bracket += 1
                    elif text[j] == "]" and depth_bracket > 0:
                        depth_bracket -= 1
                    elif text[j] == "/" and depth_bracket == 0:
                        k = j + 1
                        while k < n and text[k] in "gimsuy":
                            k += 1
                        body = text[i + 1 : j]
                        if CJK.search(body):
                            body = esc_cjk(body)
                        out.append("/" + body + "/" + text[j + 1 : k])
                        i = k
                        regex_start_pred = False
                        break
                    j += 1
                else:
                    out.append(c)
                    i += 1
                continue
            out.append(c)
            if c in "([{=,:;!&|?+\n":
                regex_start_pred = True
            elif c not in " \t":
                if c.isalnum() or c in "_$)]}":
                    regex_start_pred = False
            i += 1
            continue

        if state == "linecom":
            out.append(c)
            if c == "\n":
                state = "code"
                regex_start_pred = True
            i += 1
            continue

        if state == "blockcom":
            out.append(c)
            if c == "*" and nxt == "/":
                out.append("/")
                i += 2
                state = "code"
                regex_start_pred = True
                continue
            i += 1
            continue

        if state == "squote":
            out.append(c)
            if c == "'" and (i == 0 or text[i - 1] != "\\"):
                state = "code"
                regex_start_pred = False
            i += 1
            continue

        if state == "dquote":
            out.append(c)
            if c == '"' and (i == 0 or text[i - 1] != "\\"):
                state = "code"
                regex_start_pred = False
            i += 1
            continue

        if state == "template":
            out.append(c)
            if c == "`" and (i == 0 or text[i - 1] != "\\"):
                state = "code"
                regex_start_pred = True
            i += 1
            continue

    return "".join(out)


def strip_cjk_comments(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    for line in lines:
        if line.lstrip().startswith("//"):
            out.append(CJK.sub("", line))
            continue
        if "://" in line:
            out.append(line)
            continue
        if "//" in line:
            a, b = line.split("//", 1)
            b = CJK.sub("", b)
            out.append(a + "//" + b)
        else:
            out.append(line)
    return "".join(out)


def main() -> None:
    path = pathlib.Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    text = process(text)
    text = strip_cjk_comments(text)
    path.write_text(text, encoding="utf-8")
    print("OK", path)


if __name__ == "__main__":
    main()
