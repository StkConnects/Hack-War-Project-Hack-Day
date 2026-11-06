const $ = (id) => document.getElementById(id);

const codeInput = $("code");
const runButton = $("run");
const output = $("output");
const runStatus = $("run-status");
const executionMeta = $("execution-meta");
const traceList = $("trace-list");
const variablesContent = $("variables-content");
const analysisContent = $("analysis-content");
const explanation = $("line-explanation");
const traceCount = $("trace-count");
const stepCounter = $("step-counter");
const currentLine = $("current-line");
const prevButton = $("prev");
const nextButton = $("next");
const visualToggle = $("visual-toggle");
const visualizer = $("visualizer");

const samples = {
  sum: {
    title: "Sum of numbers",
    description: "A correct program. It visits each number in a list, adds it to a running total, and prints the result.",
    code: `numbers = [2, 4, 6, 8]

total = 0

for number in numbers:
    total += number

average = total / len(numbers)

print("Numbers:", numbers)
print("Total:", total)
print("Average:", average)`
  },
  grade: {
    title: "Grade checker",
    description: "A correct program. It checks a student's marks and chooses a grade using if, elif and else.",
    code: `marks = 82

if marks >= 90:
    grade = "A"
elif marks >= 75:
    grade = "B"
elif marks >= 50:
    grade = "C"
else:
    grade = "Needs improvement"

print("Marks:", marks)
print("Grade:", grade)`
  },
  logic: {
    title: "Incorrect average",
    description: "This program runs without crashing, but its answer is wrong. The extra subtraction makes the average 4 instead of 5.",
    code: `numbers = [2, 4, 6, 8]

total = 0

for number in numbers:
    total += number

average = total / len(numbers) - 1

print("Correct average should be 5")
print("Program average:", average)`
  },
  runtime: {
    title: "Missing variable",
    description: "This program tries to print a variable named total before that variable has been created. Python raises a NameError.",
    code: `numbers = [2, 4, 6, 8]

print("The total is:", total)`
  },
  syntax: {
    title: "Missing colon",
    description: "The for statement is missing its colon. Python cannot understand the instruction, so execution stops with a syntax error.",
    code: `numbers = [2, 4, 6, 8]

for number in numbers
    print(number)`
  }
};

let trace = [];
let sourceLines = [];
let selectedStep = 0;
let initialSample = codeInput.value;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function updateLineCount() {
  $("line-count").textContent = `${codeInput.value.split("\n").length} LINES`;
}
codeInput.addEventListener("input", updateLineCount);
updateLineCount();

function clearResults() {
  trace = [];
  selectedStep = 0;
  traceList.innerHTML = "";
  traceList.append(element("div", "empty-state", "Run the program to see its execution steps."));
  variablesContent.innerHTML = "";
  variablesContent.append(element("div", "empty-state", "No variable logs yet."));
  explanation.innerHTML = "";
  explanation.append(element("div", "empty-state", "Select an execution step to see an explanation."));
  analysisContent.innerHTML = "";
  analysisContent.append(
    element("strong", "", "Ready to run"),
    element("p", "", "Your next run will appear here.")
  );
  traceCount.textContent = "0";
  stepCounter.textContent = "— / —";
  currentLine.textContent = "LINE —";
  prevButton.disabled = true;
  nextButton.disabled = true;
  visualToggle.disabled = true;
  visualizer.hidden = true;
}

function setStatus(text, isError = false) {
  runStatus.textContent = `● ${text}`;
  runStatus.className = isError ? "run-status error" : "run-status";
}

function loadSample(key) {
  const sample = samples[key];
  if (!sample) return;

  codeInput.value = sample.code;
  initialSample = sample.code;
  updateLineCount();
  clearResults();

  $("sample-description").textContent = sample.description;
  document.querySelectorAll(".sample-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.sample === key);
  });

  output.textContent = `Loaded: ${sample.title}\nPress "Run program" to execute this example.`;
  setStatus("READY");
  executionMeta.textContent = "Waiting for execution";
}

document.querySelectorAll(".sample-button").forEach((button) => {
  button.addEventListener("click", () => loadSample(button.dataset.sample));
});

$("reset").addEventListener("click", () => {
  codeInput.value = initialSample;
  updateLineCount();
  clearResults();
  output.textContent = "Sample restored. Press Run program when ready.";
  setStatus("READY");
  executionMeta.textContent = "Waiting for execution";
});

function prettyValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  try { return JSON.stringify(value); }
  catch { return String(value); }
}

function renderAnalysis(result) {
  analysisContent.innerHTML = "";

  const diagnosis = result.analysis || {};
  const error = result.error;
  const succeeded = result.status === "completed";

  const heading = diagnosis.title ||
    (error?.type ? `${error.type} detected` :
      succeeded ? "Program finished running" : "The program could not finish");

  const message = diagnosis.message ||
    error?.message ||
    (succeeded
      ? "Python ran the program without reporting an execution error."
      : "Python stopped before the program could finish.");

  const category = diagnosis.category || "unknown";
  const card = element("section", `diagnosis-card diagnosis-${category}`);

  const top = element("div", "diagnosis-top");
  top.append(
    element("span", "diagnosis-label",
      category === "logic" ? "POSSIBLE LOGIC ERROR" :
      category === "syntax" ? "SYNTAX ERROR" :
      category === "runtime" ? "RUNTIME ERROR" :
      "EXECUTION CHECK"),
    element("strong", "diagnosis-title", heading)
  );

  card.append(top, element("p", "diagnosis-message", message));

  if (diagnosis.line) {
    card.append(element("p", "diagnosis-line", `Problem found near line ${diagnosis.line}.`));
  }

  if (diagnosis.problematic_code) {
    card.append(element("h3", "diagnosis-subheading", "Your code"));
    const original = element("pre", "diagnosis-code");
    original.textContent = diagnosis.problematic_code;
    card.append(original);
  }

  if (diagnosis.suggested_code) {
    card.append(element("h3", "diagnosis-subheading", "Suggested correction"));
    const suggestion = element("pre", "diagnosis-code diagnosis-corrected");
    suggestion.textContent = diagnosis.suggested_code;
    card.append(suggestion);
  }

  if (diagnosis.explanation) {
    card.append(
      element("h3", "diagnosis-subheading", "Why this change?"),
      element("p", "diagnosis-explanation", diagnosis.explanation)
    );
  }

  if (diagnosis.corrected_code) {
    const actions = element("div", "diagnosis-actions");
    const copyButton = element("button", "classic-button", "Copy corrected program");

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(diagnosis.corrected_code);
        copyButton.textContent = "Copied!";
      } catch {
        copyButton.textContent = "Copy unavailable";
      }
    });

    actions.append(copyButton);
    card.append(actions);

    const fullCode = element("details", "corrected-program");
    const summary = element("summary", "", "View complete corrected program");
    const fullCodeBlock = element("pre", "diagnosis-code");
    fullCodeBlock.textContent = diagnosis.corrected_code;
    fullCode.append(summary, fullCodeBlock);
    card.append(fullCode);
  }

  if (diagnosis.confidence === "medium" || diagnosis.confidence === "low") {
    card.append(
      element("p", "diagnosis-confidence",
        "This is a possible issue based on the code pattern. Check that the suggested change matches your intention.")
    );
  }

  analysisContent.append(card);

  analysisContent.append(
    element("p", "analysis-followup",
      succeeded
        ? "You can select an execution step below to inspect what happened."
        : "You can inspect the last recorded step and the error details above."),
    element("div", "analysis-disclaimer",
      "LOCAL DIAGNOSIS RULES — AI NOT CONNECTED")
  );
}

function renderVariables(variables) {
  variablesContent.innerHTML = "";
  const entries = Object.entries(variables || {});

  if (!entries.length) {
    variablesContent.append(element("div", "empty-state", "No variable values have been recorded at this step."));
    return;
  }

  entries.forEach(([name, data]) => {
    const row = element("div", "variable-row");
    const left = element("div");
    left.append(
      element("span", "variable-name", name),
      element("span", "variable-type", data.type || typeof data.value)
    );
    row.append(left, element("span", "variable-value", prettyValue(data.value)));
    variablesContent.append(row);
  });
}

function makeExplanationCard(title, message, wide = false) {
  const card = element("section", `explain-card${wide ? " wide" : ""}`);
  card.append(element("h3", "", title), element("p", "", message));
  return card;
}

function explainLine(event, previous) {
  const lineNumber = event.line;
  const source = sourceLines[lineNumber - 1] ?? "";
  const clean = source.trim();
  const before = previous?.variables || {};
  const after = event.variables || {};
  const changes = [];

  for (const [name, data] of Object.entries(after)) {
    if (JSON.stringify(before[name]?.value) !== JSON.stringify(data.value)) {
      changes.push(`${name} is now ${prettyValue(data.value)}`);
    }
  }

  let meaning = "Python is carrying out this instruction. Its exact effect depends on the values the program is using.";
  let reason = "The program reached this line as it followed its instructions.";

  if (!clean) {
    meaning = "This is an empty line. It makes the code easier to read, but it does not do any work.";
    reason = "Python simply moves on to the next instruction.";
  } else if (clean.startsWith("#")) {
    meaning = "This is a comment. It is a note for the person reading the code; Python ignores it.";
    reason = "Comments help explain code but do not change what the program does.";
  } else if (/^for\s+/.test(clean)) {
    meaning = "This loop takes the next item from a group of items. The indented instructions can then work with that item.";
    reason = "A loop repeats its instructions until there are no more items to process.";
  } else if (/^while\s+/.test(clean)) {
    meaning = "Python checks a condition. It repeats the indented instructions while that condition is true.";
    reason = "The condition tells Python whether it should keep repeating.";
  } else if (/^if\s+/.test(clean)) {
    meaning = "This is a decision. Python checks whether the condition is true before entering the indented block.";
    reason = "Programs use decisions to choose what to do in different situations.";
  } else if (/^elif\s+/.test(clean)) {
    meaning = "Python checks this alternative condition if the earlier condition was not true.";
    reason = "The program is checking another possible path.";
  } else if (/^else\s*:/.test(clean)) {
    meaning = "This is the fallback choice. Its instructions run when the earlier conditions were not true.";
    reason = "The program needs a path for all the other cases.";
  } else if (/^def\s+/.test(clean)) {
    meaning = "This creates a function: a named group of instructions that can be used later.";
    reason = "The function is being defined here. Its instructions run when the function is called.";
  } else if (/^return\b/.test(clean)) {
    meaning = "This sends a result back from the function and finishes that function call.";
    reason = "The function has reached the point where it gives its result back.";
  } else if (/^print\s*\(/.test(clean)) {
    meaning = "This displays information so the person running the program can see it.";
    reason = "The program is showing a result or message.";
  } else if (/^import\s+|^from\s+/.test(clean)) {
    meaning = "This brings in code from another Python module so the program can use it.";
    reason = "The program needs that extra code for something it does later.";
  } else if (/^break\b/.test(clean)) {
    meaning = "This tells Python to leave the current loop immediately.";
    reason = "The program has reached an instruction to stop repeating.";
  } else if (/^continue\b/.test(clean)) {
    meaning = "This skips the rest of this round of the loop and moves to the next item.";
    reason = "The program is moving on to the next round.";
  } else if (/^[\w.]+\s*([+\-*/]?=)/.test(clean)) {
    meaning = "This creates or updates a variable. Python works out the value on the right and stores it under the name on the left.";
    reason = "The program is saving a value so it can use it in another instruction.";
  }

  const body = element("div", "explanation-body");
  body.append(element("div", "explanation-source", `LINE ${lineNumber}\n${source || "(empty line)"}`));

  const grid = element("div", "explanation-grid");
  grid.append(
    makeExplanationCard("WHAT IS HAPPENING?", meaning),
    makeExplanationCard("WHY IS IT HAPPENING?", reason),
    makeExplanationCard(
      "WHAT CHANGED?",
      changes.length ? changes.join(". ") + "." : "No variable value changed at this step.",
      true
    )
  );
  body.append(grid);
  explanation.innerHTML = "";
  explanation.append(body);
}

function selectStep(index) {
  if (!trace.length) return;
  selectedStep = Math.max(0, Math.min(index, trace.length - 1));
  const event = trace[selectedStep];

  traceList.querySelectorAll(".trace-event").forEach((node, i) => {
    node.classList.toggle("active", i === selectedStep);
  });

  stepCounter.textContent = `${selectedStep + 1} / ${trace.length}`;
  currentLine.textContent = `LINE ${event.line ?? "—"}`;
  prevButton.disabled = selectedStep === 0;
  nextButton.disabled = selectedStep === trace.length - 1;

  renderVariables(event.variables);
  explainLine(event, trace[selectedStep - 1]);
}

function renderTrace(events) {
  trace = events || [];
  selectedStep = 0;
  traceList.innerHTML = "";
  traceCount.textContent = trace.length;
  visualToggle.disabled = !trace.length;

  if (!trace.length) {
    traceList.append(element("div", "empty-state", "No execution steps were recorded. This can happen when Python finds a syntax error before running the program."));
    stepCounter.textContent = "— / —";
    currentLine.textContent = "LINE —";
    variablesContent.innerHTML = "";
    variablesContent.append(element("div", "empty-state", "No variable logs are available."));
    explanation.innerHTML = "";
    explanation.append(element("div", "empty-state", "There are no execution steps to explain."));
    return;
  }

  trace.forEach((event, index) => {
    const button = element("button", "trace-event");
    button.type = "button";
    button.append(
      element("span", "event-step", `#${event.step ?? index + 1}`),
      element("span", "event-line", `LINE ${event.line ?? "—"}`),
      element("span", "event-label", String(event.event || "execution").replaceAll("_", " "))
    );
    button.addEventListener("click", () => selectStep(index));
    traceList.append(button);
  });

  selectStep(0);
}

function addStory(number, title, description, dataText) {
  const card = element("article", "story-card");
  card.append(
    element("div", "story-number", number),
    element("h3", "", title),
    element("p", "", description)
  );
  if (dataText) card.append(element("div", "story-data", dataText));
  $("analogy-story").append(card);
  return card;
}

function buildProgramAnalogy() {
  const intro = $("analogy-intro");
  const story = $("analogy-story");
  const summary = $("analogy-summary");
  intro.textContent = "";
  story.innerHTML = "";
  summary.textContent = "";

  const firstState = trace.find(event => Object.keys(event.variables || {}).length)?.variables || {};
  const lastState = trace[trace.length - 1]?.variables || {};
  const loopMatch = codeInput.value.match(/for\s+([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*)/);
  const loopVariable = loopMatch?.[1];
  const collectionName = loopMatch?.[2];

  const collectionData = lastState[collectionName]?.value ?? firstState[collectionName]?.value;
  const loopValues = [];
  if (loopVariable) {
    trace.forEach(event => {
      const value = event.variables?.[loopVariable]?.value;
      if (value !== undefined && !loopValues.some(item => JSON.stringify(item) === JSON.stringify(value))) {
        loopValues.push(value);
      }
    });
  }

  const changingNumbers = Object.keys(lastState).filter(name => {
    const values = trace.map(event => event.variables?.[name]?.value)
      .filter(value => typeof value === "number");
    return values.length > 1 && new Set(values).size > 1;
  });
  const accumulator = changingNumbers.find(name => name !== loopVariable);
  const outputText = output.textContent;

  intro.textContent = "Think of your program as a small workshop. It receives information, follows a set of instructions, and produces a result. These stages use the values recorded during the actual run.";

  const inputText = collectionData !== undefined
    ? `${collectionName} = ${prettyValue(collectionData)}`
    : `Starting values: ${Object.entries(firstState).map(([name, data]) => `${name} = ${prettyValue(data.value)}`).join(", ") || "No starting variables were recorded."}`;

  addStory(
    "STAGE 01 · INPUT",
    "Information arrives",
    "Every program starts with information to work with. These values are the materials the program receives.",
    inputText
  );

  const processCard = addStory(
    "STAGE 02 · PROCESS",
    loopMatch ? "Work happens one item at a time" : "Instructions do their work",
    loopMatch
      ? `The program takes each item from ${collectionName} and places it in ${loopVariable}. The instructions inside the loop then work with that item.`
      : "Python follows the instructions in order. Each step can use values created by earlier steps."
  );

  if (loopMatch && loopValues.length) {
    const table = element("table", "iteration-table");
    const thead = element("thead");
    const header = element("tr");
    header.append(
      element("th", "", "ROUND"),
      element("th", "", loopVariable),
      element("th", "", accumulator || "STEP")
    );
    thead.append(header);
    const tbody = element("tbody");

    loopValues.forEach((value, index) => {
      const row = element("tr");
      row.append(element("td", "", String(index + 1)), element("td", "", prettyValue(value)));

      let resultValue = "—";
      if (accumulator) {
        const matchingIndex = trace.findIndex(event =>
          JSON.stringify(event.variables?.[loopVariable]?.value) === JSON.stringify(value)
        );
        const afterUpdate = trace.slice(Math.max(0, matchingIndex)).find(event =>
          typeof event.variables?.[accumulator]?.value === "number"
        );
        resultValue = afterUpdate?.variables?.[accumulator]?.value ?? "—";
      }
      row.append(element("td", "", String(resultValue)));
      tbody.append(row);
    });
    table.append(thead, tbody);
    processCard.append(table);
  } else {
    processCard.append(element("div", "story-data", `Recorded steps: ${trace.length}`));
  }

  const finalValues = Object.entries(lastState)
    .filter(([name]) => name !== loopVariable)
    .map(([name, data]) => `${name} = ${prettyValue(data.value)}`);

  addStory(
    "STAGE 03 · RESULT",
    "The result is ready",
    "After following its instructions, the program reaches its final state. This is what it has calculated or produced.",
    finalValues.length ? finalValues.join("\n") : outputText
  );

  summary.textContent = `In short: the program receives information, processes it through its instructions, and produces the output shown in Program Output. The variable values in this explanation come from the recorded execution.`;
}

prevButton.addEventListener("click", () => selectStep(selectedStep - 1));
nextButton.addEventListener("click", () => selectStep(selectedStep + 1));

visualToggle.addEventListener("click", () => {
  visualizer.hidden = !visualizer.hidden;
  visualToggle.textContent = visualizer.hidden ? "Show full explanation" : "Hide explanation";
  if (!visualizer.hidden) buildProgramAnalogy();
});

runButton.addEventListener("click", async () => {
  const source = codeInput.value;
  if (!source.trim()) {
    output.textContent = "There is no code to run. Write a program or choose a sample first.";
    return;
  }

  runButton.disabled = true;
  runButton.textContent = "Running...";
  setStatus("RUNNING");
  output.textContent = "Running your program...";
  executionMeta.textContent = "Please wait";
  visualizer.hidden = true;
  visualToggle.textContent = "Show full explanation";

  try {
    const response = await fetch("/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "python", code: source })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || result.error || "The request failed.");

    output.textContent = result.stdout || "(The program did not print anything.)";
    if (result.stderr) output.textContent += `\n\n${result.stderr}`;
    if (result.error) {
      const errorText = typeof result.error === "string"
        ? result.error
        : `${result.error.type || "Error"}: ${result.error.message || ""}`;
      output.textContent += `\n\n${errorText}`;
    }

    const success = result.status === "completed";
    setStatus(String(result.status || "finished").toUpperCase(), !success);
    executionMeta.textContent = `EXIT ${result.exit_code ?? "—"}  |  ${result.duration_ms ?? "—"} MS`;

    sourceLines = source.split("\n");
    renderTrace(result.trace || []);
    renderAnalysis(result);
  } catch (error) {
    setStatus("FAILED", true);
    output.textContent = `Could not connect to the debugger.\n\n${error.message}`;
    executionMeta.textContent = "BACKEND CONNECTION FAILED";
    renderTrace([]);
    renderAnalysis({ status: "failed", error: { message: error.message } });
  } finally {
    runButton.disabled = false;
    runButton.textContent = "▶ Run program";
  }
});

// Make Tab insert indentation instead of moving focus away from the editor.
codeInput.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  codeInput.setRangeText("    ", start, end, "end");
  updateLineCount();
});

// Load the default working example into the sample selector.
$("sample-description").textContent = samples.sum.description;
document.querySelector('[data-sample="sum"]').classList.add("active");
clearResults();
