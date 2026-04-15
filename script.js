const display = document.querySelector("#display");
const expressionView = document.querySelector("#expression");
const buttons = document.querySelectorAll(".button");
const modeToggle = document.querySelector("#mode-toggle");

let expression = "";
let isDegreeMode = true;

const scientificTokens = ["sqrt(", "sin(", "cos(", "tan(", "log(", "ln(", "sqr(", "inv("];

const formatResult = (value) => {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid calculation");
  }

  const rounded = Math.abs(value) < 1e12 ? Number(value.toFixed(10)) : value;
  return String(rounded);
};

const sanitizeExpression = (input) => {
  const parsed = input
    .replace(/\^/g, "**")
    .replace(/\bpi\b/g, "PI")
    .replace(/\be\b/g, "E")
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

  if (/[^0-9+\-*/().,%A-Za-z\s]/.test(parsed)) {
    throw new Error("Unsupported input");
  }

  return parsed;
};

const evaluateExpression = (input) => {
  const parsed = sanitizeExpression(input);
  const angle = (value) => (isDegreeMode ? (value * Math.PI) / 180 : value);

  const result = Function(
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
    "sqrt",
    "sqr",
    "inv",
    "PI",
    "E",
    `"use strict"; return (${parsed});`
  )(
    (value) => Math.sin(angle(value)),
    (value) => Math.cos(angle(value)),
    (value) => Math.tan(angle(value)),
    (value) => Math.log10(value),
    (value) => Math.log(value),
    (value) => Math.sqrt(value),
    (value) => value ** 2,
    (value) => 1 / value,
    Math.PI,
    Math.E
  );

  return formatResult(result);
};

const updateDisplay = () => {
  expressionView.textContent = expression || "Ready for calculation";
  display.value = expression || "0";
};

const clearAll = () => {
  expression = "";
  updateDisplay();
};

const deleteLast = () => {
  if (expression === "Error") {
    clearAll();
    return;
  }

  const matchedToken = scientificTokens.find((token) => expression.endsWith(token));
  expression = matchedToken
    ? expression.slice(0, -matchedToken.length)
    : expression.slice(0, -1);

  updateDisplay();
};

const calculate = () => {
  if (!expression) {
    return;
  }

  try {
    const result = evaluateExpression(expression);
    expressionView.textContent = `${expression} =`;
    expression = result;
    display.value = result;
  } catch {
    expression = "Error";
    display.value = "Error";
    expressionView.textContent = "Check the expression";
  }
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const { value, action } = button.dataset;

    if (action === "clear") {
      clearAll();
      return;
    }

    if (action === "delete") {
      deleteLast();
      return;
    }

    if (action === "calculate") {
      calculate();
      return;
    }

    if (expression === "Error") {
      expression = "";
    }

    expression += value;
    updateDisplay();
  });
});

modeToggle.addEventListener("click", () => {
  isDegreeMode = !isDegreeMode;
  modeToggle.textContent = isDegreeMode ? "DEG" : "RAD";
  modeToggle.classList.toggle("mode-rad", !isDegreeMode);
});

updateDisplay();
