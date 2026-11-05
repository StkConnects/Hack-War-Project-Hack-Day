# Project Architecture

## 1. Overview

The application combines deterministic Python execution tracing with AI-powered debugging analysis.

The system is divided into three primary components connected through an application backend.

## 2. System Components

### Frontend
Location: `frontend/`

Responsibilities:
- Accept Python source code.
- Send code to the backend.
- Display execution results.
- Visualise execution steps and variable changes.
- Display debugging explanations and corrections.

Technologies: HTML, CSS and JavaScript.

### Application Backend
Location: `backend/app.py`

Responsibilities:
- Receive frontend requests.
- Validate incoming data.
- Coordinate code execution.
- Pass execution information to AI analysis.
- Return structured results to the frontend.

Proposed framework: Flask.

### Execution Engine
Location: `backend/execution/`

Responsibilities:
- Execute submitted Python code through a restricted subprocess.
- Capture actual execution steps.
- Track variable changes.
- Capture standard output and errors.
- Enforce execution time and resource restrictions.

Execution must not run directly inside the Flask server process.

### AI Analysis
Location: `backend/analysis/`

Responsibilities:
- Analyse submitted source code.
- Examine execution traces.
- Identify potential logical mistakes.
- Explain detected problems.
- Suggest corrections and corrected code.

AI must not fabricate execution data.

## 3. Application Flow

1. User submits Python code through the frontend.
2. Flask receives the submitted source code.
3. The backend requests execution from the execution engine.
4. The execution engine returns structured trace data and program output.
5. The AI analysis component examines the source code and trace.
6. Flask combines the results.
7. The frontend displays the execution and debugging information.

## 4. Core Design Principles

- Deterministic execution information.
- Separation of execution and AI analysis.
- Minimal user interface.
- Clear communication between components.
- Controlled execution of untrusted source code.
- Independent development of individual components.

## 5. Initial Scope

The first prototype targets Python only.

Initial features:
- Source code submission.
- Python execution.
- Execution trace generation.
- Variable tracking.
- Execution visualisation.

AI analysis will be integrated as a separate component.

## 6. Future Considerations

- Additional programming languages.
- More advanced execution visualisation.
- Improved sandbox isolation.
- Manual step-by-step execution controls.
- More advanced debugging analysis.
