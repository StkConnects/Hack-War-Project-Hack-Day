# API Contract — AI-Powered Visual Programming Debugger

**Status:** Initial prototype specification  
**Backend language:** Python

## 1. Purpose

This document defines how the frontend, Flask backend, execution engine and AI analyzer exchange information.

All components must follow the same data structure.

## 2. Execution request

The frontend sends submitted code to the backend.

```json
{
  "language": "python",
  "code": "total = 0\nfor i in range(5):\n    total += i\nprint(total)"
}
```

| Field | Type | Description |
|---|---|---|
| language | string | Programming language |
| code | string | Submitted source code |

## 3. Execution response

The execution engine returns:

```json
{
  "status": "completed",
  "stdout": "10\n",
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 15,
  "error": null,
  "trace": [],
  "trace_truncated": false
}
```

| Field | Type | Description |
|---|---|---|
| status | string | Execution outcome |
| stdout | string | Program output |
| stderr | string | Error output |
| exit_code | integer or null | Process exit status |
| duration_ms | number | Execution duration |
| error | object or null | Structured error information |
| trace | array | Recorded execution events |
| trace_truncated | boolean | Whether the trace was shortened due to limits |

Possible execution statuses:

- `completed`
- `syntax_error`
- `runtime_error`
- `timeout`
- `failed`

## 4. Trace event structure

Each trace entry represents one recorded execution step.

```json
{
  "step": 1,
  "event": "line",
  "line": 2,
  "variables": {
    "total": {
      "type": "int",
      "value": 0
    },
    "i": {
      "type": "int",
      "value": 0
    }
  }
}
```

| Field | Type | Description |
|---|---|---|
| step | integer | Sequential execution step |
| event | string | Type of recorded event |
| line | integer | Source code line number |
| variables | object | Variable snapshots at that step |

For the initial prototype, the main event type is `line`.

A line event represents the state immediately before that line executes. The next recorded event will show the subsequent state.

## 5. Variable representation

Every variable uses a typed representation.

Example:

```json
{
  "name": {
    "type": "str",
    "value": "Hello"
  },
  "numbers": {
    "type": "list",
    "value": [1, 2, 3]
  },
  "student": {
    "type": "dict",
    "value": {
      "age": 20
    }
  }
}
```

Initial supported types:

- int
- float
- str
- bool
- NoneType
- list
- dict

Nested collections should be supported where practical. Large or deeply nested values must be limited to avoid excessive trace size.

## 6. Error representation

When execution fails, the error object should contain:

```json
{
  "type": "ZeroDivisionError",
  "message": "division by zero",
  "line": 4
}
```

The error object is null when execution completes successfully.

## 7. AI analysis separation

The AI analyzer receives:

1. Original source code.
2. Execution result.
3. Execution trace.

It returns debugging analysis separately from the execution data.

The AI must not invent line numbers, variable values, execution steps or program output.

The final response format will include an `analysis` field, which may be null when analysis is unavailable.

## 8. Important integration rules

- The execution engine owns execution and trace generation.
- The AI analyzer owns explanations and debugging suggestions.
- Flask coordinates both components.
- The frontend displays the returned information.
- Components must not independently change this contract.
- Any proposed contract change must be discussed with the project lead first.
