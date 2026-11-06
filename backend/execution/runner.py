import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path


MAX_EXECUTION_TIME = 3
MAX_TRACE_EVENTS = 1000
MAX_OUTPUT_LENGTH = 100_000


def run_python_code(code):
    """Execute Python code in a subprocess and collect its execution trace."""

    if not isinstance(code, str) or not code.strip():
        return {
            "status": "failed",
            "stdout": "",
            "stderr": "",
            "exit_code": None,
            "duration_ms": 0,
            "error": {
                "type": "ValueError",
                "message": "No Python code was provided.",
                "line": None
            },
            "trace": [],
            "trace_truncated": False
        }

    with tempfile.TemporaryDirectory(prefix="visual_debugger_") as temp:
        temp_path = Path(temp)
        source_path = temp_path / "user_code.py"
        harness_path = temp_path / "trace_runner.py"
        trace_path = temp_path / "trace.json"

        source_path.write_text(code, encoding="utf-8")

        harness = r'''
import json
import sys
import traceback
from pathlib import Path

source_path = str(Path(sys.argv[1]).resolve())
trace_path = Path(sys.argv[2])
source = Path(source_path).read_text(encoding="utf-8")

events = []
truncated = False
error = None


def safe_value(value, depth=0, seen=None):
    if seen is None:
        seen = set()

    if depth > 3:
        return "<maximum depth reached>"

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return value[:500]

    if isinstance(value, (list, tuple, dict)):
        object_id = id(value)

        if object_id in seen:
            return "<circular reference>"

        seen.add(object_id)

        if isinstance(value, (list, tuple)):
            result = [
                safe_value(item, depth + 1, seen)
                for item in value[:20]
            ]

            if len(value) > 20:
                result.append("<more items>")
        else:
            result = {}

            for index, (key, item) in enumerate(value.items()):
                if index >= 20:
                    result["..."] = "<more items>"
                    break

                result[str(key)[:100]] = safe_value(
                    item, depth + 1, seen
                )

        seen.remove(object_id)
        return result

    return f"<{type(value).__name__}>"


def trace_execution(frame, event, arg):
    global truncated

    if frame.f_code.co_filename != source_path:
        return trace_execution

    if event == "line":
        if len(events) >= 1000:
            truncated = True
            return trace_execution

        variables = {}

        for name, value in frame.f_locals.items():
            if name.startswith("__"):
                continue

            variables[name] = {
                "type": type(value).__name__,
                "value": safe_value(value)
            }

        events.append({
            "step": len(events) + 1,
            "event": "line",
            "line": frame.f_lineno,
            "variables": variables
        })

    return trace_execution


try:
    compiled_code = compile(source, source_path, "exec")
    namespace = {"__name__": "__main__"}

    sys.settrace(trace_execution)
    exec(compiled_code, namespace)

except BaseException as exception:
    error_line = None

    for frame in traceback.extract_tb(exception.__traceback__):
        if frame.filename == source_path:
            error_line = frame.lineno

    if isinstance(exception, SyntaxError):
        error_line = exception.lineno

    error = {
        "type": type(exception).__name__,
        "message": str(exception),
        "line": error_line
    }

finally:
    sys.settrace(None)

    trace_path.write_text(
        json.dumps({
            "events": events,
            "truncated": truncated,
            "error": error
        }),
        encoding="utf-8"
    )

if error is not None:
    sys.exit(1)
'''

        harness_path.write_text(harness, encoding="utf-8")

        environment = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUNBUFFERED": "1"
        }

        start_time = time.perf_counter()

        try:
            process = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    str(harness_path),
                    str(source_path),
                    str(trace_path)
                ],
                cwd=temp,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=MAX_EXECUTION_TIME,
                env=environment
            )

            duration_ms = round(
                (time.perf_counter() - start_time) * 1000, 2
            )

            trace_data = {
                "events": [],
                "truncated": False,
                "error": None
            }

            if trace_path.exists():
                try:
                    trace_data = json.loads(
                        trace_path.read_text(encoding="utf-8")
                    )
                except (json.JSONDecodeError, OSError):
                    pass

            error = trace_data.get("error")

            status = "completed"

            if error:
                status = (
                    "syntax_error"
                    if error["type"] == "SyntaxError"
                    else "runtime_error"
                )
            elif process.returncode != 0:
                status = "failed"

            return {
                "status": status,
                "stdout": process.stdout[:MAX_OUTPUT_LENGTH],
                "stderr": process.stderr[:MAX_OUTPUT_LENGTH],
                "exit_code": process.returncode,
                "duration_ms": duration_ms,
                "error": error,
                "trace": trace_data.get("events", []),
                "trace_truncated": trace_data.get("truncated", False)
            }

        except subprocess.TimeoutExpired:
            duration_ms = round(
                (time.perf_counter() - start_time) * 1000, 2
            )

            return {
                "status": "timeout",
                "stdout": "",
                "stderr": "Execution exceeded the time limit.",
                "exit_code": None,
                "duration_ms": duration_ms,
                "error": {
                    "type": "TimeoutError",
                    "message": (
                        f"Execution exceeded {MAX_EXECUTION_TIME} seconds."
                    ),
                    "line": None
                },
                "trace": [],
                "trace_truncated": False
            }

        except OSError as exception:
            return {
                "status": "failed",
                "stdout": "",
                "stderr": str(exception),
                "exit_code": None,
                "duration_ms": 0,
                "error": {
                    "type": type(exception).__name__,
                    "message": str(exception),
                    "line": None
                },
                "trace": [],
                "trace_truncated": False
            }
