"""Sandboxed code execution for Python."""
import ast
import io
import time
from contextlib import redirect_stdout, redirect_stderr

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
