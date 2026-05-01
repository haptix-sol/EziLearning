"""Sandboxed execution for Python; subprocess runners for JS / C / C++ / Java when toolchains exist."""
from __future__ import annotations

import ast
import io
import json
import shutil
import subprocess
import sys
import tempfile
import time
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

from core.code_languages import normalize_language

# Shared restricted builtins for sandboxed execution (used by both run_python_code and run_tests)
_SAFE_BUILTINS = {
    "print": print,
    "len": len,
    "range": range,
    "str": str,
    "int": int,
    "float": float,
    "list": list,
    "dict": dict,
    "set": set,
    "tuple": tuple,
    "bool": bool,
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "sorted": sorted,
    "map": map,
    "filter": filter,
    "zip": zip,
    "enumerate": enumerate,
    "isinstance": isinstance,
    "True": True,
    "False": False,
    "None": None,
}


def run_python_code(code: str, timeout_seconds: int = 30) -> dict:
    """
    Execute Python code in a restricted environment.
    Returns {status, stdout, stderr, execution_time_ms, error}.
    """
    start = time.perf_counter()
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    # Basic safety: block dangerous operations
    blocked = ["open(", "exec(", "eval(", "__import__", "compile(", "globals(", "locals("]
    for b in blocked:
        if b in code:
            return {
                "status": "failed",
                "stdout": "",
                "stderr": f"Blocked: {b} is not allowed for security.",
                "execution_time_ms": int((time.perf_counter() - start) * 1000),
            }

    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec_globals = {"__builtins__": _SAFE_BUILTINS}
            exec(code, exec_globals)
    except Exception as e:
        stderr_capture.write(str(e))

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return {
        "status": "completed",
        "stdout": stdout_capture.getvalue(),
        "stderr": stderr_capture.getvalue(),
        "execution_time_ms": elapsed_ms,
    }


def run_tests(code: str, test_cases: list[dict]) -> list[dict]:
    """
    Run user code against test cases in a restricted sandbox.
    test_cases: [{input, expected_output, is_hidden}]
    Returns list of {passed, input, expected, actual}.
    """
    # Block dangerous operations (same as run_python_code)
    blocked = ["open(", "exec(", "eval(", "__import__", "compile(", "globals(", "locals("]
    for b in blocked:
        if b in code:
            return [
                {"passed": False, "input": "", "expected": "", "actual": f"Blocked: {b} is not allowed for security."}
                for _ in test_cases
            ]

    results = []
    for tc in test_cases:
        inp = tc.get("input", "")
        expected = tc.get("expected_output", "").strip()
        try:
            local = {}
            exec(code, {"__builtins__": _SAFE_BUILTINS}, local)
            # Get first callable that's not a builtin
            func = None
            for v in local.values():
                if callable(v) and v.__name__ != "print":
                    func = v
                    break
            if not func:
                results.append({"passed": False, "input": inp, "expected": expected, "actual": "No callable found"})
                continue
            # Parse input: "[2,7,11,15], 9" or "15"
            inp = inp.strip()
            if "], " in inp:
                parts = inp.split("], ", 1)
                args = [ast.literal_eval(parts[0] + "]"), ast.literal_eval(parts[1].strip())]
            else:
                args = [ast.literal_eval(inp)]
            actual = str(func(*args))
            passed = actual.strip() == expected.strip()
            results.append({"passed": passed, "input": inp, "expected": expected, "actual": actual})
        except Exception as e:
            results.append({"passed": False, "input": inp, "expected": expected, "actual": str(e)})
    return results


def _elapsed_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def run_node_script(code: str, timeout_seconds: int = 15) -> dict:
    """Run JavaScript with Node (whole script). Requires ``node`` on PATH."""
    start = time.perf_counter()
    node = shutil.which("node")
    if not node:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": "Node.js was not found on PATH. Install Node to run JavaScript challenges.",
            "execution_time_ms": _elapsed_ms(start),
        }
    try:
        with tempfile.TemporaryDirectory(prefix="ezjs_") as d:
            p = Path(d) / "user.mjs"
            p.write_text(code, encoding="utf-8")
            r = subprocess.run(
                [node, str(p)],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                cwd=d,
            )
            return {
                "status": "completed",
                "stdout": (r.stdout or "") + (r.stderr or "" if r.returncode != 0 else ""),
                "stderr": "" if r.returncode == 0 else (r.stderr or r.stdout or f"exit {r.returncode}"),
                "execution_time_ms": _elapsed_ms(start),
            }
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": f"Timed out after {timeout_seconds}s",
            "execution_time_ms": _elapsed_ms(start),
        }
    except Exception as e:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(e),
            "execution_time_ms": _elapsed_ms(start),
        }


def run_javascript_tests(code: str, test_cases: list[dict]) -> list[dict]:
    """
    Run JS tests via Node. Expects ``function twoSum(...)`` in sloppy global scope, or ``globalThis.twoSum``.
    Test ``input`` must be JSON: ``[[1,2],3]`` (array args) or ``[15]`` (single arg).
    ``expected_output`` is compared as string to ``JSON.stringify`` of result (or String(result)).
    """
    node = shutil.which("node")
    if not node:
        return [
            {
                "passed": False,
                "input": tc.get("input", ""),
                "expected": tc.get("expected_output", ""),
                "actual": "Node.js not found on PATH.",
            }
            for tc in test_cases
        ]

    harness = r"""
const fs = require('fs');
const vm = require('vm');
const user = fs.readFileSync('user.js','utf8');
const mod = { exports: {} };
const ctx = { console, require, module: mod, exports: mod.exports };
vm.createContext(ctx);
try {
  vm.runInContext(user + '\n', ctx, { timeout: 8000 });
} catch (e) {
  process.stdout.write(JSON.stringify({ error: String(e) }));
  process.exit(0);
}
const fn = typeof ctx.twoSum === 'function' ? ctx.twoSum
  : (typeof mod.exports.twoSum === 'function' ? mod.exports.twoSum
  : (typeof mod.exports.default === 'function' ? mod.exports.default : null));
if (!fn) {
  process.stdout.write(JSON.stringify({ error: 'No twoSum function found (define function twoSum or module.exports.twoSum)' }));
  process.exit(0);
}
const cases = JSON.parse(fs.readFileSync('cases.json','utf8'));
const out = [];
for (const tc of cases) {
  try {
    const args = JSON.parse(tc.input);
    const arr = Array.isArray(args) ? args : [args];
    const res = fn.apply(null, arr);
    const actual = typeof res === 'string' ? res : JSON.stringify(res);
    const passed = actual.trim() === String(tc.expected).trim();
    out.push({ passed, input: tc.input, expected: tc.expected, actual });
  } catch (e) {
    out.push({ passed: false, input: tc.input, expected: tc.expected, actual: String(e) });
  }
}
process.stdout.write(JSON.stringify(out));
"""
    results: list[dict] = []
    try:
        with tempfile.TemporaryDirectory(prefix="ezjst_") as d:
            Path(d, "user.js").write_text(code, encoding="utf-8")
            Path(d, "harness.js").write_text(harness, encoding="utf-8")
            serializable = [
                {"input": tc.get("input", ""), "expected": (tc.get("expected_output") or "").strip()}
                for tc in test_cases
            ]
            Path(d, "cases.json").write_text(json.dumps(serializable), encoding="utf-8")
            r = subprocess.run(
                [node, "harness.js"],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=d,
            )
            raw = (r.stdout or "").strip()
            if not raw:
                return [
                    {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": r.stderr or "empty harness output"}
                    for tc in test_cases
                ]
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "error" in parsed:
                return [
                    {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": parsed["error"]}
                    for tc in test_cases
                ]
            if isinstance(parsed, list):
                for i, row in enumerate(parsed):
                    if i < len(test_cases):
                        results.append(
                            {
                                "passed": bool(row.get("passed")),
                                "input": row.get("input", test_cases[i].get("input", "")),
                                "expected": row.get("expected", test_cases[i].get("expected_output", "")),
                                "actual": row.get("actual", ""),
                            }
                        )
                while len(results) < len(test_cases):
                    results.append({"passed": False, "input": "", "expected": "", "actual": "missing result"})
                return results[: len(test_cases)]
            return [
                {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": "unexpected harness output"}
                for tc in test_cases
            ]
    except Exception as e:
        return [
            {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": str(e)}
            for tc in test_cases
        ]


def _compile_native(code: str, lang: str, work: Path, timeout: int) -> tuple[str | None, str]:
    """Returns (None, '') on success or (None, err) on compile failure."""
    src = work / ("main.c" if lang == "c" else "main.cpp")
    src.write_text(code, encoding="utf-8")
    exe = work / ("main.exe" if sys.platform == "win32" else "main")
    if lang == "c":
        cc = shutil.which("gcc") or shutil.which("clang")
        if not cc:
            return None, "C compiler (gcc/clang) not found on PATH."
        cmd = [cc, "-O2", "-std=c11", "-o", str(exe), str(src)]
    else:
        cxx = shutil.which("g++") or shutil.which("clang++")
        if not cxx:
            return None, "C++ compiler (g++/clang++) not found on PATH."
        cmd = [cxx, "-O2", "-std=c++17", "-o", str(exe), str(src)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=str(work))
    if r.returncode != 0:
        return None, (r.stderr or r.stdout or "compile failed").strip()
    return str(exe), ""


def run_native_stdin_tests(code: str, lang: str, test_cases: list[dict]) -> list[dict]:
    """Compile C/C++ once; each test runs binary with stdin = input, compares stdout."""
    results: list[dict] = []
    try:
        with tempfile.TemporaryDirectory(prefix=f"ez{lang}_") as d:
            work = Path(d)
            exe_or_err, cerr = _compile_native(code, lang, work, timeout=20)
            if exe_or_err is None:
                return [
                    {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": cerr}
                    for tc in test_cases
                ]
            exe = exe_or_err
            for tc in test_cases:
                inp = (tc.get("input") or "").strip()
                exp = (tc.get("expected_output") or "").strip()
                try:
                    r = subprocess.run(
                        [exe],
                        input=inp + ("\n" if inp and not inp.endswith("\n") else ""),
                        capture_output=True,
                        text=True,
                        timeout=10,
                        cwd=str(work),
                    )
                    actual = (r.stdout or "").strip()
                    passed = actual == exp
                    results.append({"passed": passed, "input": inp, "expected": exp, "actual": actual or (r.stderr or "").strip()})
                except Exception as e:
                    results.append({"passed": False, "input": inp, "expected": exp, "actual": str(e)})
            return results
    except Exception as e:
        return [
            {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": str(e)}
            for tc in test_cases
        ]


def run_java_stdin_tests(code: str, test_cases: list[dict]) -> list[dict]:
    """Compile and run ``public class Main`` reading stdin (two ints per line)."""
    javac = shutil.which("javac")
    java = shutil.which("java")
    if not javac or not java:
        return [
            {
                "passed": False,
                "input": tc.get("input", ""),
                "expected": tc.get("expected_output", ""),
                "actual": "JDK (javac/java) not found on PATH.",
            }
            for tc in test_cases
        ]
    results: list[dict] = []
    try:
        with tempfile.TemporaryDirectory(prefix="ezjava_") as d:
            work = Path(d)
            (work / "Main.java").write_text(code, encoding="utf-8")
            r = subprocess.run(
                [javac, "Main.java"],
                capture_output=True,
                text=True,
                timeout=25,
                cwd=str(work),
            )
            if r.returncode != 0:
                err = (r.stderr or r.stdout or "javac failed").strip()
                return [
                    {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": err}
                    for tc in test_cases
                ]
            for tc in test_cases:
                inp = (tc.get("input") or "").strip()
                exp = (tc.get("expected_output") or "").strip()
                try:
                    r2 = subprocess.run(
                        [java, "Main"],
                        input=inp + ("\n" if inp and not inp.endswith("\n") else ""),
                        capture_output=True,
                        text=True,
                        timeout=10,
                        cwd=str(work),
                    )
                    actual = (r2.stdout or "").strip()
                    passed = actual == exp
                    results.append({"passed": passed, "input": inp, "expected": exp, "actual": actual or (r2.stderr or "").strip()})
                except Exception as e:
                    results.append({"passed": False, "input": inp, "expected": exp, "actual": str(e)})
            return results
    except Exception as e:
        return [
            {"passed": False, "input": tc.get("input", ""), "expected": tc.get("expected_output", ""), "actual": str(e)}
            for tc in test_cases
        ]


def run_native_snippet(code: str, lang: str, timeout_seconds: int = 20) -> dict:
    """Compile-and-run for C/C++ (stdin empty); Java compile-only or run if Main has main."""
    start = time.perf_counter()
    lang = normalize_language(lang)
    try:
        if lang in ("c", "cpp"):
            with tempfile.TemporaryDirectory(prefix=f"ezrun_{lang}_") as d:
                work = Path(d)
                exe_or_err, cerr = _compile_native(code, lang, work, timeout=timeout_seconds)
                if exe_or_err is None:
                    return {
                        "status": "completed",
                        "stdout": "",
                        "stderr": cerr,
                        "execution_time_ms": _elapsed_ms(start),
                    }
                r = subprocess.run([exe_or_err], capture_output=True, text=True, timeout=timeout_seconds, cwd=str(work))
                return {
                    "status": "completed",
                    "stdout": (r.stdout or "") + ("" if r.returncode == 0 else (r.stderr or "")),
                    "stderr": "" if r.returncode == 0 else (r.stderr or ""),
                    "execution_time_ms": _elapsed_ms(start),
                }
        if lang == "java":
            javac = shutil.which("javac")
            java = shutil.which("java")
            if not javac or not java:
                return {
                    "status": "failed",
                    "stdout": "",
                    "stderr": "JDK (javac/java) not found on PATH.",
                    "execution_time_ms": _elapsed_ms(start),
                }
            with tempfile.TemporaryDirectory(prefix="ezrun_java_") as d:
                work = Path(d)
                (work / "Main.java").write_text(code, encoding="utf-8")
                r = subprocess.run([javac, "Main.java"], capture_output=True, text=True, timeout=timeout_seconds, cwd=str(work))
                if r.returncode != 0:
                    return {
                        "status": "completed",
                        "stdout": "",
                        "stderr": (r.stderr or r.stdout or "javac failed").strip(),
                        "execution_time_ms": _elapsed_ms(start),
                    }
                r2 = subprocess.run([java, "Main"], capture_output=True, text=True, timeout=timeout_seconds, cwd=str(work))
                return {
                    "status": "completed",
                    "stdout": (r2.stdout or "") + (r2.stderr or ""),
                    "stderr": "" if r2.returncode == 0 else (r2.stderr or ""),
                    "execution_time_ms": _elapsed_ms(start),
                }
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": f"Timed out after {timeout_seconds}s",
            "execution_time_ms": _elapsed_ms(start),
        }
    except Exception as e:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(e),
            "execution_time_ms": _elapsed_ms(start),
        }
    return {
        "status": "failed",
        "stdout": "",
        "stderr": f"Unsupported native run for {lang!r}",
        "execution_time_ms": _elapsed_ms(start),
    }


def run_code(code: str, language: str | None, timeout_seconds: int = 30) -> dict:
    """Dispatch execution by normalized language."""
    lang = normalize_language(language)
    if lang == "python":
        return run_python_code(code, timeout_seconds)
    if lang == "javascript":
        return run_node_script(code, timeout_seconds)
    if lang in ("c", "cpp", "java"):
        return run_native_snippet(code, lang, timeout_seconds)
    return {
        "status": "failed",
        "stdout": "",
        "stderr": f"Unsupported language {language!r}. Allowed: python, javascript, java, cpp, c.",
        "execution_time_ms": 0,
    }


def run_tests_for_language(code: str, language: str | None, test_cases: list[dict] | None) -> list[dict] | None:
    if not test_cases:
        return None
    lang = normalize_language(language)
    if lang == "python":
        return run_tests(code, test_cases)
    if lang == "javascript":
        return run_javascript_tests(code, test_cases)
    if lang == "c":
        return run_native_stdin_tests(code, "c", test_cases)
    if lang == "cpp":
        return run_native_stdin_tests(code, "cpp", test_cases)
    if lang == "java":
        return run_java_stdin_tests(code, test_cases)
    return None
