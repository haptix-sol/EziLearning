"""Run the FastAPI app from the backend folder.

Usage::

    uv run python main.py 8000

Port defaults to 8000 when omitted."""
from __future__ import annotations

import sys

import uvicorn


def main() -> None:
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Usage: uv run python main.py [PORT]", file=sys.stderr)
            sys.exit(2)
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, reload=True)


if __name__ == "__main__":
    main()
