const display = document.querySelector("#display");
const expressionView = document.querySelector("#expression");
const buttons = document.querySelectorAll(".button");
const mobileToolButtons = document.querySelectorAll(".mobile-tool-button[data-action]");
const modeToggle = document.querySelector("#mode-toggle");
const historyList = document.querySelector("#history-list");
const mobileHistoryList = document.querySelector("#mobile-history-list");
const clearHistoryButton = document.querySelector("#clear-history");
const mobileClearHistoryButton = document.querySelector("#mobile-clear-history");
const historyToggleButton = document.querySelector("#history-toggle");
const mobileHistoryToggleButton = document.querySelector("#mobile-history-toggle");
const mobileScientificToggleButton = document.querySelector("#mobile-scientific-toggle");
const historyPanel = document.querySelector("#history-panel");

let expression = "";
let isDegreeMode = true;
let isHistoryOpen = false;
let isScientificMobileOpen = false;

const scientificTokens = ["sqrt(", "sin(", "cos(", "tan(", "log(", "ln(", "sqr(", "inv("];
const HISTORY_STORAGE_KEY = "scientificCalculatorHistory";
const HISTORY_LIMIT = 1000;
const HISTORY_SEPARATOR = " = ";
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";

const readHistory = () => {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(savedHistory) ? savedHistory.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
};

let calculationHistory = readHistory();

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
    "abs",
    "exp",
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
    (value) => Math.abs(value),
    (value) => Math.exp(value),
    Math.PI,
    Math.E
  );

  return formatResult(result);
};

const updateDisplay = () => {
  expressionView.textContent = expression;
  display.value = expression || "0";
};

const appendValue = (value) => {
  if (expression === "Error") {
    expression = "";
  }

  expression += value;
  updateDisplay();
};

const insertParenthesis = () => {
  const openingCount = (expression.match(/\(/g) || []).length;
  const closingCount = (expression.match(/\)/g) || []).length;
  const lastCharacter = expression.slice(-1);
  const shouldOpen = !expression || /[+\-*/^(]$/.test(lastCharacter);

  expression += shouldOpen || openingCount === closingCount ? "(" : ")";
  updateDisplay();
};

const toggleSign = () => {
  if (!expression || expression === "Error") {
    expression = "-";
    updateDisplay();
    return;
  }

  const match = expression.match(/(-?\d*\.?\d+)(?!.*\d)/);

  if (!match || typeof match.index !== "number") {
    expression = expression.startsWith("-") ? expression.slice(1) : `-${expression}`;
    updateDisplay();
    return;
  }

  const { index } = match;
  const value = match[0];
  const toggledValue = value.startsWith("-") ? value.slice(1) : `-${value}`;
  expression = `${expression.slice(0, index)}${toggledValue}${expression.slice(index + value.length)}`;
  updateDisplay();
};

const swapLastTwoCharacters = () => {
  if (expression === "Error" || expression.length < 2) {
    return;
  }

  expression = `${expression.slice(0, -2)}${expression.at(-1)}${expression.at(-2)}`;
  updateDisplay();
};

const wrapAbsoluteValue = () => {
  if (!expression || expression === "Error") {
    expression = "abs(";
  } else {
    expression = `abs(${expression})`;
  }

  updateDisplay();
};

const syncAngleLabels = () => {
  modeToggle.textContent = isDegreeMode ? "DEG" : "RAD";
  modeToggle.classList.toggle("mode-rad", !isDegreeMode);

  const mobileAngleButton = document.querySelector('[data-action="toggle-angle"]');

  if (mobileAngleButton) {
    mobileAngleButton.textContent = isDegreeMode ? "Rad" : "Deg";
  }
};

const syncHistoryPanelState = () => {
  const isMobileView = window.matchMedia(MOBILE_MEDIA_QUERY).matches;

  historyToggleButton.setAttribute("aria-expanded", String(isHistoryOpen));
  mobileHistoryToggleButton.setAttribute("aria-expanded", String(isHistoryOpen));
  mobileHistoryToggleButton.textContent = isHistoryOpen ? "Keypad" : "History";
  historyToggleButton.textContent = isHistoryOpen ? "Keypad" : "History";
  mobileScientificToggleButton.setAttribute("aria-pressed", String(isScientificMobileOpen));
  mobileScientificToggleButton.textContent = isScientificMobileOpen ? "Basic" : "Scientific";
  historyPanel.setAttribute("aria-hidden", String(isMobileView));
  document.body.classList.toggle("mobile-history-open", isMobileView && isHistoryOpen);
  document.body.classList.toggle("mobile-scientific-open", isMobileView && isScientificMobileOpen);
};

const closeHistoryPanel = () => {
  isHistoryOpen = false;
  syncHistoryPanelState();
};

const toggleHistoryPanel = () => {
  isHistoryOpen = !isHistoryOpen;
  syncHistoryPanelState();
};

const toggleScientificMobilePanel = () => {
  isScientificMobileOpen = !isScientificMobileOpen;
  syncHistoryPanelState();
};

const syncScientificOrientation = async () => {
  const isMobileView = window.matchMedia(MOBILE_MEDIA_QUERY).matches;

  if (!isMobileView || !window.screen?.orientation?.lock) {
    return;
  }

  try {
    if (isScientificMobileOpen) {
      await window.screen.orientation.lock("landscape");
      return;
    }

    await window.screen.orientation.lock("portrait");
  } catch {
    // Orientation lock is browser/device dependent and may fail silently.
  }
};

const saveHistory = () => {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(calculationHistory));
};

const renderHistory = () => {
  const historyTargets = [historyList, mobileHistoryList];

  historyTargets.forEach((target) => {
    target.innerHTML = "";

    if (!calculationHistory.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "history-empty";
      emptyState.textContent = "No calculations yet. Your recent answers will appear here.";
      target.append(emptyState);
      return;
    }

    [...calculationHistory].reverse().forEach((entry) => {
      const separatorIndex = entry.lastIndexOf(HISTORY_SEPARATOR);
      const entryExpression = separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
      const entryResult = separatorIndex >= 0 ? entry.slice(separatorIndex + HISTORY_SEPARATOR.length) : "";

      const item = document.createElement("button");
      item.type = "button";
      item.className = "history-item";
      item.setAttribute("role", "listitem");
      item.dataset.expression = entryExpression;

      const expressionLabel = document.createElement("span");
      expressionLabel.className = "history-item-expression";
      expressionLabel.textContent = entryExpression;

      const resultLabel = document.createElement("span");
      resultLabel.className = "history-item-result";
      resultLabel.textContent = `= ${entryResult}`;

      item.append(expressionLabel, resultLabel);
      target.append(item);
    });
  });
};

const addToHistory = (entryExpression, result) => {
  calculationHistory.push(`${entryExpression}${HISTORY_SEPARATOR}${result}`);

  if (calculationHistory.length > HISTORY_LIMIT) {
    calculationHistory = calculationHistory.slice(calculationHistory.length - HISTORY_LIMIT);
  }

  saveHistory();
  renderHistory();
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
    const currentExpression = expression;
    const result = evaluateExpression(currentExpression);
    expressionView.textContent = `${currentExpression} =`;
    expression = result;
    display.value = result;
    addToHistory(currentExpression, result);
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

    if (action === "paren") {
      insertParenthesis();
      return;
    }

    if (action === "toggle-sign") {
      toggleSign();
      return;
    }

    if (action === "swap-last-two") {
      swapLastTwoCharacters();
      return;
    }

    if (action === "toggle-angle") {
      isDegreeMode = !isDegreeMode;
      syncAngleLabels();
      return;
    }

    if (action === "absolute") {
      wrapAbsoluteValue();
      return;
    }

    appendValue(value);
  });
});

mobileToolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { action } = button.dataset;

    if (action === "clear") {
      clearAll();
      return;
    }

    if (action === "delete") {
      deleteLast();
    }
  });
});

modeToggle.addEventListener("click", () => {
  isDegreeMode = !isDegreeMode;
  syncAngleLabels();
});

const handleHistorySelection = (event) => {
  const historyItem = event.target.closest(".history-item");

  if (!historyItem) {
    return;
  }

  expression = historyItem.dataset.expression || "";
  updateDisplay();

  if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
    closeHistoryPanel();
  }
};

historyList.addEventListener("click", handleHistorySelection);
mobileHistoryList.addEventListener("click", handleHistorySelection);

const clearStoredHistory = () => {
  calculationHistory = [];
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
};

clearHistoryButton.addEventListener("click", clearStoredHistory);
mobileClearHistoryButton.addEventListener("click", clearStoredHistory);

historyToggleButton.addEventListener("click", () => {
  toggleHistoryPanel();
});

mobileHistoryToggleButton.addEventListener("click", () => {
  toggleHistoryPanel();
});

mobileScientificToggleButton.addEventListener("click", () => {
  toggleScientificMobilePanel();
  syncScientificOrientation();
});

window.addEventListener("resize", () => {
  if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
    isHistoryOpen = false;
    isScientificMobileOpen = false;
  }

  syncHistoryPanelState();
  syncScientificOrientation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHistoryPanel();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Ignore registration failures so calculator usage stays unaffected.
    });
  });
}

calculationHistory = calculationHistory.slice(-HISTORY_LIMIT);
saveHistory();
renderHistory();
syncAngleLabels();
syncHistoryPanelState();
updateDisplay();
