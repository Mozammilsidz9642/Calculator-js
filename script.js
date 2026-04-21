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
const downloadPdfButton = document.querySelector("#download-pdf-button");
const pdfExportSheet = document.querySelector("#pdf-export-sheet");
const pdfExportLogo = document.querySelector("#pdf-export-logo");
const pdfExportSummary = document.querySelector("#pdf-export-summary");
const pdfExportDatetime = document.querySelector("#pdf-export-datetime");
const pdfExportList = document.querySelector("#pdf-export-list");

let expression = "";
let resultValue = "0";
let isDegreeMode = true;
let isHistoryOpen = false;
let isScientificMobileOpen = false;
let isResultVisible = false;
let lastPreviewKey = "";
let lastPreviewValue = "";
let isGeneratingPdf = false;

const scientificTokens = ["sqrt(", "sin(", "cos(", "tan(", "log(", "ln(", "sqr(", "inv("];
const HISTORY_STORAGE_KEY = "scientificCalculatorHistory";
const HISTORY_LIMIT = 1000;
const HISTORY_SEPARATOR = " = ";
const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
const PDF_FILE_NAME = "calculator-history.pdf";
const PDF_BUTTON_DEFAULT_LABEL = "Dwn";
const PDF_BUTTON_LOADING_LABEL = "Generating PDF...";
const PDF_EXPORT_ACTIVE_CLASS = "is-exporting";
const PDF_EXPORT_MARGIN_MM = 10;
const PDF_EXPORT_SCALE = 3;
const PDF_LOGO_CANDIDATES = ["logo.png", "icons/icon-192.png"];

const createHistoryEntry = (expressionText, resultText, dateText = new Date().toLocaleString()) => ({
  expression: String(expressionText),
  result: String(resultText),
  date: String(dateText)
});

const normalizeHistoryEntry = (entry) => {
  if (entry && typeof entry === "object") {
    const { expression: entryExpression, result: entryResult, date } = entry;

    if (typeof entryExpression === "string" && typeof entryResult === "string" && typeof date === "string") {
      return createHistoryEntry(entryExpression, entryResult, date);
    }
  }

  if (typeof entry === "string") {
    const separatorIndex = entry.lastIndexOf(HISTORY_SEPARATOR);
    const entryExpression = separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
    const entryResult = separatorIndex >= 0 ? entry.slice(separatorIndex + HISTORY_SEPARATOR.length) : "";
    return createHistoryEntry(entryExpression, entryResult);
  }

  return null;
};

const readHistory = () => {
  try {
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");

    if (!Array.isArray(savedHistory)) {
      return [];
    }

    return savedHistory
      .map(normalizeHistoryEntry)
      .filter(Boolean);
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

const canPreviewExpression = () => {
  if (!expression || isResultVisible || expression === "Error") {
    return false;
  }

  if (/[+\-*/^(.]$/.test(expression)) {
    return false;
  }

  const openingCount = (expression.match(/\(/g) || []).length;
  const closingCount = (expression.match(/\)/g) || []).length;
  return openingCount === closingCount;
};

const getPreviewResult = () => {
  if (!canPreviewExpression()) {
    return "";
  }

  const previewKey = `${expression}__${isDegreeMode ? "deg" : "rad"}`;

  if (previewKey === lastPreviewKey) {
    return lastPreviewValue;
  }

  try {
    const preview = evaluateExpression(expression);
    lastPreviewKey = previewKey;
    lastPreviewValue = preview;
    return preview;
  } catch {
    lastPreviewKey = previewKey;
    lastPreviewValue = "";
    return "";
  }
};

const resetPreviewCache = () => {
  lastPreviewKey = "";
  lastPreviewValue = "";
};

const updateDisplay = () => {
  expressionView.textContent = isResultVisible ? "" : expression;
  display.value = isResultVisible ? resultValue || "0" : getPreviewResult() || "0";
};

const appendValue = (value) => {
  if (expression === "Error") {
    expression = "";
  }

  if (isResultVisible) {
    if (/[+\-*/^%]/.test(value)) {
      expression = resultValue === "0" ? "" : resultValue;
    } else {
      expression = "";
    }

    resultValue = "0";
    isResultVisible = false;
  }

  expression += value;
  resetPreviewCache();
  updateDisplay();
};

const insertParenthesis = () => {
  if (isResultVisible) {
    expression = resultValue === "0" ? "" : resultValue;
    resultValue = "0";
    isResultVisible = false;
  }

  const openingCount = (expression.match(/\(/g) || []).length;
  const closingCount = (expression.match(/\)/g) || []).length;
  const lastCharacter = expression.slice(-1);
  const shouldOpen = !expression || /[+\-*/^(]$/.test(lastCharacter);

  expression += shouldOpen || openingCount === closingCount ? "(" : ")";
  resetPreviewCache();
  updateDisplay();
};

const toggleSign = () => {
  if (isResultVisible) {
    expression = resultValue === "0" ? "" : resultValue;
    resultValue = "0";
    isResultVisible = false;
  }

  if (!expression || expression === "Error") {
    expression = "-";
    resetPreviewCache();
    updateDisplay();
    return;
  }

  const match = expression.match(/(-?\d*\.?\d+)(?!.*\d)/);

  if (!match || typeof match.index !== "number") {
    expression = expression.startsWith("-") ? expression.slice(1) : `-${expression}`;
    resetPreviewCache();
    updateDisplay();
    return;
  }

  const { index } = match;
  const value = match[0];
  const toggledValue = value.startsWith("-") ? value.slice(1) : `-${value}`;
  expression = `${expression.slice(0, index)}${toggledValue}${expression.slice(index + value.length)}`;
  resetPreviewCache();
  updateDisplay();
};

const swapLastTwoCharacters = () => {
  if (isResultVisible) {
    expression = resultValue === "0" ? "" : resultValue;
    resultValue = "0";
    isResultVisible = false;
  }

  if (expression === "Error" || expression.length < 2) {
    return;
  }

  expression = `${expression.slice(0, -2)}${expression.at(-1)}${expression.at(-2)}`;
  resetPreviewCache();
  updateDisplay();
};

const wrapAbsoluteValue = () => {
  if (isResultVisible) {
    expression = resultValue === "0" ? "" : resultValue;
    resultValue = "0";
    isResultVisible = false;
  }

  if (!expression || expression === "Error") {
    expression = "abs(";
  } else {
    expression = `abs(${expression})`;
  }

  resetPreviewCache();
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
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(calculationHistory));
  } catch {
    // Ignore storage failures so the calculator keeps working in restricted contexts.
  }
};

const formatExportDateTime = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);

const parseEntryDate = (dateText) => {
  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatHistoryDateLabel = (dateText) => {
  const parsedDate = parseEntryDate(dateText);

  if (!parsedDate) {
    return dateText;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(parsedDate);
};

const isSameCalendarDay = (leftDate, rightDate) =>
  leftDate.getFullYear() === rightDate.getFullYear()
  && leftDate.getMonth() === rightDate.getMonth()
  && leftDate.getDate() === rightDate.getDate();

const getRelativeDateGroup = (dateText) => {
  const parsedDate = parseEntryDate(dateText);

  if (!parsedDate) {
    return "Earlier";
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(parsedDate, now)) {
    return "Today";
  }

  if (isSameCalendarDay(parsedDate, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsedDate);
};

const groupHistoryEntriesByDate = (entries) => {
  const groupedEntries = [];

  entries.forEach((entry) => {
    const label = getRelativeDateGroup(entry.date);
    const existingGroup = groupedEntries.find((group) => group.label === label);

    if (existingGroup) {
      existingGroup.entries.push(entry);
      return;
    }

    groupedEntries.push({
      label,
      entries: [entry]
    });
  });

  return groupedEntries;
};

const setPdfButtonState = (isLoading) => {
  if (!downloadPdfButton) {
    return;
  }

  downloadPdfButton.disabled = isLoading;
  downloadPdfButton.textContent = isLoading ? PDF_BUTTON_LOADING_LABEL : PDF_BUTTON_DEFAULT_LABEL;
  downloadPdfButton.setAttribute("aria-busy", String(isLoading));
};

const setPdfExportVisibility = (isVisible) => {
  if (!pdfExportSheet) {
    return;
  }

  pdfExportSheet.classList.toggle(PDF_EXPORT_ACTIVE_CLASS, isVisible);
};

const waitForNextFrame = () =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

const loadPdfLogo = async () => {
  for (const logoPath of PDF_LOGO_CANDIDATES) {
    try {
      const response = await fetch(logoPath);

      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return typeof dataUrl === "string" ? dataUrl : "";
    } catch {
      // Try the next available logo candidate.
    }
  }

  return "";
};

const openPrintFallback = () => {
  window.print();
};

const renderPdfExportContent = async () => {
  if (!pdfExportList || !pdfExportDatetime || !pdfExportSummary || !pdfExportLogo) {
    return;
  }

  const logoSource = await loadPdfLogo();
  pdfExportLogo.src = logoSource;
  pdfExportLogo.hidden = !logoSource;
  pdfExportLogo.style.display = logoSource ? "block" : "none";
  pdfExportDatetime.textContent = `Generated on: ${formatExportDateTime(new Date())}`;
  pdfExportSummary.textContent = `Total calculations: ${calculationHistory.length}`;
  pdfExportList.innerHTML = "";

  if (!calculationHistory.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "pdf-export-empty";
    emptyState.textContent = "No calculations available in history.";
    pdfExportList.append(emptyState);
    return;
  }

  let exportIndex = 1;

  groupHistoryEntriesByDate([...calculationHistory].reverse()).forEach((group) => {
    const section = document.createElement("section");
    section.className = "pdf-export-group";

    const groupTitle = document.createElement("h2");
    groupTitle.className = "pdf-export-group-title";
    groupTitle.textContent = group.label;

    const groupItems = document.createElement("div");
    groupItems.className = "pdf-export-group-items";

    group.entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "pdf-export-item";

      const indexLabel = document.createElement("span");
      indexLabel.className = "pdf-export-index";
      indexLabel.textContent = String(exportIndex).padStart(2, "0");

      const content = document.createElement("div");
      content.className = "pdf-export-item-content";

      const dateLabel = document.createElement("p");
      dateLabel.className = "pdf-export-item-date";
      dateLabel.textContent = formatHistoryDateLabel(entry.date);

      const expressionLabel = document.createElement("p");
      expressionLabel.className = "pdf-export-expression";
      expressionLabel.textContent = entry.expression;

      const resultLabel = document.createElement("p");
      resultLabel.className = "pdf-export-result";
      resultLabel.textContent = `= ${entry.result}`;

      content.append(dateLabel, expressionLabel, resultLabel);
      row.append(indexLabel, content);
      groupItems.append(row);
      exportIndex += 1;
    });

    section.append(groupTitle, groupItems);
    pdfExportList.append(section);
  });
};

const exportCanvasToPdf = (canvas) => {
  const jsPdfLibrary = window.jspdf?.jsPDF;

  if (!jsPdfLibrary) {
    throw new Error("jsPDF not available");
  }

  const pdf = new jsPdfLibrary("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_EXPORT_MARGIN_MM * 2;
  const contentHeight = pageHeight - PDF_EXPORT_MARGIN_MM * 2;
  const pxPerMm = canvas.width / contentWidth;
  const pageHeightPx = Math.floor(contentHeight * pxPerMm);
  let renderedHeight = 0;
  let pageNumber = 0;

  while (renderedHeight < canvas.height) {
    const pageCanvas = document.createElement("canvas");
    const pageSliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);
    const pageContext = pageCanvas.getContext("2d");

    if (!pageContext) {
      throw new Error("Canvas context unavailable");
    }

    pageCanvas.width = canvas.width;
    pageCanvas.height = pageSliceHeight;
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      pageSliceHeight,
      0,
      0,
      pageCanvas.width,
      pageCanvas.height
    );

    const pageImage = pageCanvas.toDataURL("image/png");
    const renderedHeightMm = pageSliceHeight / pxPerMm;

    if (pageNumber > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      pageImage,
      "PNG",
      PDF_EXPORT_MARGIN_MM,
      PDF_EXPORT_MARGIN_MM,
      contentWidth,
      renderedHeightMm
    );

    renderedHeight += pageSliceHeight;
    pageNumber += 1;
  }

  pdf.save(PDF_FILE_NAME);
};

const exportHistoryAsPdf = async () => {
  if (isGeneratingPdf || !pdfExportSheet) {
    return;
  }

  isGeneratingPdf = true;
  setPdfButtonState(true);
  renderPdfExportContent();
  setPdfExportVisibility(true);

  try {
    await renderPdfExportContent();
    await waitForNextFrame();

    const exportSource = pdfExportSheet.querySelector(".pdf-export-card") || pdfExportSheet;

    if (typeof window.html2canvas !== "function") {
      throw new Error("html2canvas not available");
    }

    const canvas = await window.html2canvas(exportSource, {
      scale: PDF_EXPORT_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    exportCanvasToPdf(canvas);
  } catch {
    openPrintFallback();
  } finally {
    setPdfExportVisibility(false);
    isGeneratingPdf = false;
    setPdfButtonState(false);
  }
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
      const entryExpression = entry.expression;
      const entryResult = entry.result;

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

  renderPdfExportContent();
};

const addToHistory = (entryExpression, result) => {
  calculationHistory.push(createHistoryEntry(entryExpression, result));

  if (calculationHistory.length > HISTORY_LIMIT) {
    calculationHistory = calculationHistory.slice(calculationHistory.length - HISTORY_LIMIT);
  }

  saveHistory();
  renderHistory();
};

const clearAll = () => {
  expression = "";
  resultValue = "0";
  isResultVisible = false;
  resetPreviewCache();
  updateDisplay();
};

const deleteLast = () => {
  if (expression === "Error" || isResultVisible) {
    clearAll();
    return;
  }

  const matchedToken = scientificTokens.find((token) => expression.endsWith(token));
  expression = matchedToken
    ? expression.slice(0, -matchedToken.length)
    : expression.slice(0, -1);

  resetPreviewCache();
  updateDisplay();
};

const calculate = () => {
  if (!expression) {
    return;
  }

  try {
    const currentExpression = expression;
    const result = evaluateExpression(currentExpression);
    resultValue = result;
    isResultVisible = true;
    expression = result;
    resetPreviewCache();
    updateDisplay();
    addToHistory(currentExpression, result);
  } catch {
    expression = "Error";
    resultValue = "Error";
    isResultVisible = true;
    resetPreviewCache();
    updateDisplay();
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
      resetPreviewCache();
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
  resetPreviewCache();
  syncAngleLabels();
});

const handleHistorySelection = (event) => {
  const historyItem = event.target.closest(".history-item");

  if (!historyItem) {
    return;
  }

  expression = historyItem.dataset.expression || "";
  resultValue = "0";
  isResultVisible = false;
  resetPreviewCache();
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

if (downloadPdfButton) {
  downloadPdfButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    exportHistoryAsPdf();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Ignore registration failures so calculator usage stays unaffected.
    });
  });
}

calculationHistory = calculationHistory.slice(-HISTORY_LIMIT);
saveHistory();
renderHistory();
setPdfButtonState(false);
syncAngleLabels();
syncHistoryPanelState();
updateDisplay();
