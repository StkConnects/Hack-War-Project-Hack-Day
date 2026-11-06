def analyze_code(code, execution):
    """
    Prototype analysis interface.

    This is not an AI model. It provides basic diagnostics from
    the execution result until a real AI provider is connected.
    """

    error = execution.get("error")
    issues = []

    if error:
        issues.append({
            "line": error.get("line"),
            "type": error.get("type", "runtime_error"),
            "title": error.get("type", "Execution error"),
            "explanation": error.get("message", "The program failed."),
            "suggestion": (
                "Review the reported line and check the values "
                "and operations used there."
            )
        })

        return {
            "status": "prototype_fallback",
            "provider": None,
            "issues": issues,
            "corrected_code": None,
            "message": (
                "Basic diagnostics are available. "
                "Connect an AI provider for deeper logical analysis."
            )
        }

    return {
        "status": "not_configured",
        "provider": None,
        "issues": [],
        "corrected_code": None,
        "message": (
            "AI analysis is not connected yet. "
            "The execution trace and output are available."
        )
    }
