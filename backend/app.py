import ast
import difflib
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from backend.execution.runner import run_python_code

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIR),
    static_url_path="/static",
)


def make_diagnosis(
    category,
    title,
    message,
    line=None,
    problematic_code=None,
    suggested_code=None,
    explanation=None,
    confidence="high",
    corrected_code=None,
):
    return {
        "category": category,
        "title": title,
        "message": message,
        "line": line,
        "problematic_code": problematic_code,
        "suggested_code": suggested_code,
        "explanation": explanation,
        "confidence": confidence,
        "corrected_code": corrected_code,
    }


def replace_line(code, line_number, replacement):
    lines = code.splitlines()

    if not line_number or line_number < 1 or line_number > len(lines):
        return None

    lines[line_number - 1] = replacement
    return "\n".join(lines)


def diagnose_execution_error(code, error):
    error_type = error.get("type", "Error")
    message = error.get("message", "The program encountered an error.")
    line = error.get("line")

    lines = code.splitlines()
    source_line = (
        lines[line - 1]
        if line and 1 <= line <= len(lines)
        else None
    )

    if error_type == "SyntaxError":
        if source_line:
            stripped = source_line.strip()

            if (
                stripped.startswith(
                    ("for ", "if ", "elif ", "while ", "def ",
                     "class ", "else", "try", "except", "finally",
                     "with ")
                )
                and "expected ':'" in message
                and not stripped.endswith(":")
            ):
                fixed_line = source_line.rstrip() + ":"

                return make_diagnosis(
                    "syntax",
                    "Missing colon",
                    "Python expected a colon at the end of this statement.",
                    line,
                    source_line,
                    fixed_line,
                    "Statements such as for, if, while and def need a colon "
                    "before their indented block.",
                    corrected_code=replace_line(code, line, fixed_line),
                )

        return make_diagnosis(
            "syntax",
            "Syntax error detected",
            message,
            line,
            source_line,
            None,
            "Python could not understand this part of the program. "
            "Check the indicated line and the line immediately before it.",
        )

    if error_type == "NameError":
        import re

        match = re.search(r"name '([^']+)' is not defined", message)

        if match:
            missing_name = match.group(1)

            try:
                tree = ast.parse(code)
                known_names = {
                    node.id
                    for node in ast.walk(tree)
                    if isinstance(node, ast.Name)
                }
                known_names.discard(missing_name)

                suggestions = difflib.get_close_matches(
                    missing_name,
                    list(known_names),
                    n=1,
                    cutoff=0.75,
                )
            except SyntaxError:
                suggestions = []

            if suggestions:
                return make_diagnosis(
                    "runtime",
                    "Undefined variable",
                    f"'{missing_name}' is used before Python can find a "
                    f"definition for it. A similar name, "
                    f"'{suggestions[0]}', appears elsewhere in your code.",
                    line,
                    source_line,
                    source_line.replace(missing_name, suggestions[0]),
                    "Check whether you meant to use the similarly named "
                    "variable. If not, define the missing variable first.",
                    confidence="medium",
                )

        return make_diagnosis(
            "runtime",
            "Undefined variable",
            message,
            line,
            source_line,
            None,
            "The program is trying to use a name that has not been defined. "
            "Check its spelling and make sure it is assigned before use.",
        )

    return make_diagnosis(
        "runtime",
        f"{error_type} detected",
        message,
        line,
        source_line,
        None,
        "The program stopped while executing this line. Check the error "
        "message and the variable values immediately before the failure.",
    )


def diagnose_logic(code):
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None

    lines = code.splitlines()

    # Look for a common loop mistake:
    # total = number instead of total += number.
    defined_before_loop = set()

    for statement in tree.body:
        if isinstance(statement, (ast.Assign, ast.AnnAssign)):
            targets = (
                statement.targets
                if isinstance(statement, ast.Assign)
                else [statement.target]
            )

            for target in targets:
                if isinstance(target, ast.Name):
                    defined_before_loop.add(target.id)

        if isinstance(statement, ast.For):
            loop_variable = (
                statement.target.id
                if isinstance(statement.target, ast.Name)
                else None
            )

            if loop_variable:
                for node in ast.walk(statement):
                    if not isinstance(node, ast.Assign):
                        continue

                    if len(node.targets) != 1:
                        continue

                    target = node.targets[0]

                    if not isinstance(target, ast.Name):
                        continue

                    if (
                        target.id != loop_variable
                        and target.id in defined_before_loop
                        and isinstance(node.value, ast.Name)
                        and node.value.id == loop_variable
                    ):
                        line = node.lineno
                        original = lines[line - 1]
                        indentation = original[:len(original) - len(original.lstrip())]

                        fixed_line = (
                            indentation
                            + f"{target.id} += {loop_variable}"
                        )

                        return make_diagnosis(
                            "logic",
                            "Possible accumulation mistake",
                            f"'{target.id}' is assigned the current loop "
                            f"value on every iteration. This replaces its "
                            f"previous value instead of building a total.",
                            line,
                            original,
                            fixed_line,
                            "If your intention is to add every loop value, "
                            "use +=. This keeps the existing value and adds "
                            "the current number to it.",
                            confidence="medium",
                            corrected_code=replace_line(
                                code, line, fixed_line
                            ),
                        )

    # Detect a suspicious subtraction after calculating an average.
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue

        value = node.value
        if not (
            isinstance(value, ast.BinOp)
            and isinstance(value.op, ast.Sub)
            and isinstance(value.left, ast.BinOp)
            and isinstance(value.left.op, ast.Div)
            and isinstance(value.right, ast.Constant)
            and isinstance(value.right.value, (int, float))
        ):
            continue

        line = node.lineno
        original = lines[line - 1]
        fixed_line = original.rsplit("-", 1)[0].rstrip()

        return make_diagnosis(
            "logic",
            "Possible incorrect average",
            "This calculation subtracts an extra value after dividing "
            "the total. If you intended to calculate the ordinary "
            "average, that subtraction changes the answer.",
            line,
            original,
            fixed_line,
            "An average is calculated by dividing the total by the "
            "number of values. Remove the extra subtraction if it "
            "was not intentional.",
            confidence="medium",
            corrected_code=replace_line(code, line, fixed_line),
        )

    # Detect a likely discount calculation mistake.
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue

        target = next(
            (item for item in node.targets
             if isinstance(item, ast.Name) and "final" in item.id.lower()),
            None,
        )
        value = node.value

        if (
            target
            and isinstance(value, ast.BinOp)
            and isinstance(value.op, ast.Div)
            and isinstance(value.right, ast.Constant)
            and value.right.value == 100
            and isinstance(value.left, ast.BinOp)
            and isinstance(value.left.op, ast.Mult)
            and isinstance(value.left.left, ast.Name)
            and isinstance(value.left.right, ast.Name)
        ):
            price = value.left.left.id
            discount = value.left.right.id
            line = node.lineno
            original = lines[line - 1]
            fixed_line = (
                f"{target.id} = {price} - "
                f"({price} * {discount} / 100)"
            )

            return make_diagnosis(
                "logic",
                "Possible discount calculation mistake",
                "This calculates the discount amount, not the final price. "
                "Subtract the discount from the original price.",
                line,
                original,
                fixed_line,
                "The final price is the original price minus the discount amount.",
                confidence="medium",
                corrected_code=replace_line(code, line, fixed_line),
            )

    # Detect a likely age eligibility boundary mistake.
    for node in ast.walk(tree):
        if not isinstance(node, ast.If):
            continue

        comparison = node.test
        mentions_eligibility = any(
            isinstance(item, ast.Constant)
            and isinstance(item.value, str)
            and any(word in item.value.lower()
                    for word in ("eligible", "vote"))
            for item in ast.walk(node)
        )

        if (
            isinstance(comparison, ast.Compare)
            and isinstance(comparison.left, ast.Name)
            and comparison.left.id == "age"
            and len(comparison.ops) == 1
            and isinstance(comparison.ops[0], ast.Gt)
            and len(comparison.comparators) == 1
            and isinstance(comparison.comparators[0], ast.Constant)
            and comparison.comparators[0].value == 18
            and mentions_eligibility
        ):
            line = node.lineno
            original = lines[line - 1]
            fixed_line = original.replace(">", ">=", 1)

            return make_diagnosis(
                "logic",
                "Possible age boundary mistake",
                "The condition excludes people who are exactly 18. "
                "If eligibility starts at 18, use >= instead of >.",
                line,
                original,
                fixed_line,
                "The >= operator includes 18 as well as every age above 18.",
                confidence="medium",
                corrected_code=replace_line(code, line, fixed_line),
            )

    # Detect an explicit division by zero.
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.BinOp)
            and isinstance(node.op, ast.Div)
            and isinstance(node.right, ast.Constant)
            and node.right.value == 0
        ):
            line = node.lineno
            source_line = lines[line - 1] if line <= len(lines) else None

            return make_diagnosis(
                "logic",
                "Division by zero",
                "This expression divides a value by zero.",
                line,
                source_line,
                None,
                "Check that the denominator is not zero before performing "
                "the division.",
            )

    return None


def debug_insights(code, result):
    error = result.get("error")

    if error:
        return diagnose_execution_error(code, error)

    logic_issue = diagnose_logic(code)

    if logic_issue:
        return logic_issue

    return make_diagnosis(
        "none",
        "No specific issue identified",
        "The program completed without a syntax or runtime error. "
        "That does not necessarily mean its logic is correct.",
        explanation=(
            "Check the output against what you expected. VPD has not "
            "identified a specific logical mistake in this program."
        ),
        confidence="low",
    )


@app.get("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/execute")
def execute():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON request."}), 400

    if data.get("language") != "python":
        return jsonify({"error": "Only Python is supported currently."}), 400

    code = data.get("code")

    if not isinstance(code, str):
        return jsonify({"error": "Code must be a string."}), 400

    result = run_python_code(code)
    result["analysis"] = debug_insights(code, result)

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=False)
