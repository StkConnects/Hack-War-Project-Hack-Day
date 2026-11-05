# AI-Powered Visual Programming Debugger

A programming utility that combines visual execution tracing and AI-powered debugging to help programmers understand how their code behaves and why mistakes occur.

## Project Goals

- Execute submitted Python code.
- Visualise execution flow and variable changes.
- Identify potential programming mistakes.
- Explain why mistakes occur.
- Suggest corrections and provide corrected code.

## Core Components

| Component | Responsibility |
|---|---|
| Frontend | Code input, results and execution visualisation |
| Execution Engine | Code execution and deterministic trace generation |
| AI Analysis | Code analysis, debugging explanations and corrections |
| Application Backend | Coordinates communication between components |

## Project Structure

```text
frontend/                 User interface
backend/app.py            Application entry point
backend/execution/        Execution and tracing
backend/analysis/         AI debugging and explanations
samples/                  Example programs
docs/                     Project documentation
tests/                    Test cases
```

## Development Principles

1. Actual execution information must come from the execution engine.
2. AI must not invent execution steps or variable values.
3. Execution and AI analysis must remain separate components.
4. Keep the interface minimal and practical.
5. Prioritise understanding code behaviour over simply providing corrected code.
6. Submitted code must execute in a controlled environment.

## Initial Prototype Scope

The first prototype will support Python and demonstrate:

- Code submission.
- Program execution.
- Execution tracing.
- Variable tracking.
- Visual representation of execution.

AI integration and additional features will be developed separately.

## Development

Each team member should work on their assigned feature branch and submit changes through a Pull Request.

Do not commit directly to `main`.# Hack-War-Project-Hack-Day
Hackathon
