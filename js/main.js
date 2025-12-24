const dobInput = document.getElementById("dob");
const nameInput = document.getElementById("name");
const form = document.getElementById("dob-form");
const clockPanel = document.getElementById("clock-panel");
const hourHand = document.getElementById("hour-hand");
const minuteHand = document.getElementById("minute-hand");
const dayNightDisk = document.getElementById("day-night-disk");
const clockReadout = document.getElementById("clock-readout");
const clockCaption = document.getElementById("clock-caption");
const weeksLivedHeading = document.getElementById("weeks-lived-heading");
const lifeClockHeading = document.getElementById("life-clock-heading");
const lifeCalendarHeading = document.getElementById("life-calendar-heading");
const defaultGradient =
  "radial-gradient(circle at 20% 20%, #f6f7fb 0, #e4ecf3 25%, #d7e7f0 50%, #c5dfea 75%, #b7d3e3 100%)";
const lifeGrid = document.getElementById("life-grid");
const lifeBoxes = document.getElementById("life-boxes");
const weekTooltip = document.getElementById("week-tooltip");
const printBtn = document.getElementById("print-btn");
const clockSharePanel = document.getElementById("clock-share-panel");
const gridSharePanel = document.getElementById("grid-share-panel");
const resultsSharePanel = document.getElementById("results-share-panel");
const formShell = document.querySelector(".form-shell");

const today = new Date();
today.setHours(0, 0, 0, 0);
const MAX_AGE_YEARS = 123;
const minAllowedYear = today.getFullYear() - MAX_AGE_YEARS;
const minAllowedDate = new Date(`${minAllowedYear}-01-01T00:00:00`);
dobInput.max = today.toISOString().split("T")[0];
dobInput.min = minAllowedDate.toISOString().split("T")[0];

let lifeExpectancyYears = 100;
const EXPECTANCY_SOURCE = "World Bank global average";
let lifeExpectancyLastUpdate = null;
const MAX_YEARS_DISPLAYED = 123;
const WEEKS_PER_YEAR = 52;
let currentYearsDisplayed = 0;
const DAY_MS = 24 * 60 * 60 * 1000;
let lastGridStats = null;
let lastClockState = null;
let clockFaceImagePromise = null;
let lastDobDate = null;
const BASE_LIFE_BOX_SIZE = 15;
const BASE_LIFE_BOX_GAP = 2;
const SHOW_SHARE_PREVIEW = true;
let lastShareSource = "clock";
// QA toggle: set to false to restore normal behavior
const QA_MODE = true;
const QA_FAKE_DOB = "1985-04-24";
const QA_FAKE_NAME = "David";

if (QA_MODE && form) {
  // Disable native validation gating so submit still fires during QA.
  form.noValidate = true;
}

async function fetchLifeExpectancy() {
  try {
    const res = await fetch(
      "https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.LE00.IN?format=json"
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const series = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    const firstValid = series.find((entry) => entry && entry.value !== null);
    if (firstValid && typeof firstValid.value === "number") {
      lifeExpectancyYears = Number(firstValid.value.toFixed(1));
      lifeExpectancyLastUpdate = firstValid.date || null;
    }
  } catch (err) {
    console.warn("Falling back to default life expectancy:", err);
  } finally {
    if (document.body.classList.contains("has-results") && dobInput.value) {
      renderFromDob(dobInput.value);
    }
  }
}

function calculateAgeYears(dateValue) {
  const birth = new Date(dateValue);
  const diffMs = today - birth;
  const diffDays = diffMs / DAY_MS;
  return diffDays / 365.2425;
}

function weeksLivedFromDob(dobDate) {
  return Math.floor((today - dobDate) / (7 * DAY_MS));
}

function daysLivedFromDob(dobDate) {
  return Math.floor((today - dobDate) / DAY_MS);
}

function possessiveName() {
  if (!nameInput) return null;
  const trimmed = nameInput.value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("s") ? `${trimmed}'` : `${trimmed}'s`;
}

function parseDob(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    date.setHours(0, 0, 0, 0);
    return date;
  }
  return null;
}

function updateNameHeadings() {
  const possessive = possessiveName();
  if (lifeClockHeading) {
    lifeClockHeading.textContent = possessive
      ? `${possessive} life in hours`
      : "My life in hours";
  }
  if (lifeCalendarHeading) {
    lifeCalendarHeading.textContent = possessive
      ? `${possessive} life in weeks`
      : "My life in weeks";
  }
}

function getCssVar(name, fallback) {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(name);
  return value ? value.trim() : fallback;
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCanvasBackground(ctx, width, height, strength = 1) {
  const a1 = getCssVar("--bg-a1", "#f3f7ff");
  const a2 = getCssVar("--bg-a2", "#d8e7f6");
  const b1 = getCssVar("--bg-b1", "#eef8ff");
  const b2 = getCssVar("--bg-b2", "#cfe8f6");
  const c1 = getCssVar("--bg-c1", "#e2f1fb");
  const c2 = getCssVar("--bg-c2", "#c4e0f2");
  const d1 = getCssVar("--bg-d1", "#d7ecf7");
  const d2 = getCssVar("--bg-d2", "#b9d6ea");
  const d3 = getCssVar("--bg-d3", "#a9c8dc");
  const accent = getCssVar("--accent", "#33cc99");
  const accent2 = getCssVar("--accent-2", "#f97316");

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const radius = Math.max(width, height) * 0.9;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(strength, 1));
  const gradA = ctx.createRadialGradient(
    width * 0.15,
    height * 0.1,
    0,
    width * 0.15,
    height * 0.1,
    radius
  );
  gradA.addColorStop(0, a1);
  gradA.addColorStop(0.3, a2);
  gradA.addColorStop(0.62, hexToRgba(a2, 0));
  ctx.fillStyle = gradA;
  ctx.fillRect(0, 0, width, height);

  const gradB = ctx.createRadialGradient(
    width * 0.85,
    height * 0.15,
    0,
    width * 0.85,
    height * 0.15,
    radius
  );
  gradB.addColorStop(0, b1);
  gradB.addColorStop(0.32, b2);
  gradB.addColorStop(0.64, hexToRgba(b2, 0));
  ctx.fillStyle = gradB;
  ctx.fillRect(0, 0, width, height);

  const gradC = ctx.createRadialGradient(
    width * 0.2,
    height * 0.85,
    0,
    width * 0.2,
    height * 0.85,
    radius
  );
  gradC.addColorStop(0, c1);
  gradC.addColorStop(0.34, c2);
  gradC.addColorStop(0.66, hexToRgba(c2, 0));
  ctx.fillStyle = gradC;
  ctx.fillRect(0, 0, width, height);

  const gradD = ctx.createRadialGradient(
    width * 0.8,
    height * 0.8,
    0,
    width * 0.8,
    height * 0.8,
    radius
  );
  gradD.addColorStop(0, d1);
  gradD.addColorStop(0.36, d2);
  gradD.addColorStop(0.72, d3);
  ctx.fillStyle = gradD;
  ctx.fillRect(0, 0, width, height);

  const glowRadius = Math.max(width, height) * 0.75;
  const glowLeft = ctx.createRadialGradient(
    width * 0.1,
    height * 0.1,
    0,
    width * 0.1,
    height * 0.1,
    glowRadius
  );
  glowLeft.addColorStop(0, hexToRgba(accent, 0.35));
  glowLeft.addColorStop(0.6, hexToRgba(accent, 0));
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, width, height);

  const glowRight = ctx.createRadialGradient(
    width * 0.9,
    height * 0.9,
    0,
    width * 0.9,
    height * 0.9,
    glowRadius
  );
  glowRight.addColorStop(0, hexToRgba(accent2, 0.35));
  glowRight.addColorStop(0.6, hexToRgba(accent2, 0));
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function setShareSource(source) {
  lastShareSource = source;
  if (resultsSharePanel) {
    resultsSharePanel.dataset.shareSource = source;
  }
}

function updateClock(ratio) {
  const nonNegativeRatio = Math.max(0, ratio);
  const totalMinutes = nonNegativeRatio * 24 * 60;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const minutesInCurrentDay = totalMinutes - dayOffset * 24 * 60;
  const hours = Math.floor(minutesInCurrentDay / 60);
  const minutes = Math.floor(minutesInCurrentDay % 60);

  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;

  hourHand.style.transform = `translate(-50%, 0) rotate(${hourAngle}deg)`;
  minuteHand.style.transform = `translate(-50%, 0) rotate(${minuteAngle}deg)`;
  if (dayNightDisk) {
    const dayAngle = ((hours + minutes / 60) / 24) * 360 - 90;
    dayNightDisk.style.setProperty("--day-night-rotation", `${dayAngle}deg`);
  }

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const dayLabel = dayOffset > 0 ? `Day ${dayOffset + 1}, ` : "";
  clockReadout.textContent = `${dayLabel}${hh}:${mm}`;
  const beyondNote = dayOffset > 0 ? "Beyond average life expectancy. " : "";
  const updateNote = lifeExpectancyLastUpdate
    ? `, last update: ${lifeExpectancyLastUpdate}`
    : "";
  clockCaption.innerHTML = `${beyondNote}Clock based on an average life expectancy of ${lifeExpectancyYears} years.<br>(${EXPECTANCY_SOURCE}${updateNote})`;
  clockPanel.hidden = false;
  clockPanel.classList.add("is-visible");

  document.body.style.backgroundImage = defaultGradient;

  lastClockState = {
    heading: lifeClockHeading
      ? lifeClockHeading.textContent
      : "My life in hours",
    readout: clockReadout ? clockReadout.textContent : "",
    hourAngle,
    minuteAngle,
    hours,
    minutes,
  };
}

function flipFormShell(enableResults) {
  if (!formShell) return;
  const currentlyHasResults = document.body.classList.contains("has-results");
  if (enableResults === currentlyHasResults) return;

  const firstRect = formShell.getBoundingClientRect();
  document.body.classList.toggle("has-results", enableResults);
  const lastRect = formShell.getBoundingClientRect();
  const deltaY = firstRect.top - lastRect.top;

  if (deltaY !== 0 && formShell.animate) {
    formShell.animate(
      [
        { transform: `translateY(${deltaY}px)` },
        { transform: "translateY(0)" },
      ],
      {
        duration: 550,
        easing: "cubic-bezier(0.33, 1, 0.68, 1)",
      }
    );
  }
}

function buildLifeBoxes(totalYears) {
  if (totalYears === currentYearsDisplayed) return;
  lifeBoxes.innerHTML = "";
  const container = document.createDocumentFragment();
  for (let year = 1; year <= totalYears; year++) {
    const row = document.createElement("div");
    row.className = "life-row";
    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
      const box = document.createElement("div");
      box.className = "life-box upcoming";
      box.dataset.year = String(year);
      const weekNumber = week + 1;
      box.dataset.week = String(weekNumber);
      const bandIndex = Math.floor((weekNumber - 1) / 10);
      if (bandIndex % 2 === 1) {
        box.classList.add("band-alt");
      }
      if (weekNumber % 10 === 0) {
        box.classList.add("ten-mark");
      }
      row.appendChild(box);
    }
    container.appendChild(row);
  }
  lifeBoxes.appendChild(container);
  currentYearsDisplayed = totalYears;
}

function updateLifeGrid(ageYears, dobDate) {
  const weeksLived = weeksLivedFromDob(dobDate);
  const daysLived = daysLivedFromDob(dobDate);
  const expectancyYearsCapped = Math.min(
    lifeExpectancyYears,
    MAX_YEARS_DISPLAYED
  );
  const expectancyWeeks = Math.floor(expectancyYearsCapped * WEEKS_PER_YEAR);
  const desiredYears = Math.min(
    Math.max(
      Math.ceil(expectancyYearsCapped),
      Math.ceil(weeksLived / WEEKS_PER_YEAR)
    ),
    MAX_YEARS_DISPLAYED
  );
  buildLifeBoxes(desiredYears);
  const showBeyond = weeksLived > expectancyWeeks;
  const { boxSize, boxGap } = updateLifeBoxScale();
  const cellSize = boxSize + boxGap;
  const filledRows = Math.max(1, Math.ceil(weeksLived / WEEKS_PER_YEAR));
  const gradientHeight = filledRows * cellSize - boxGap;

  Array.from(lifeBoxes.children).forEach((row, rowIndex) => {
    const boxes = Array.from(row.children);
    boxes.forEach((box, weekIndex) => {
      const globalWeekIndex = rowIndex * WEEKS_PER_YEAR + weekIndex + 1;
      box.hidden = false;
      box.style.removeProperty("--filled-grad-height");
      box.style.removeProperty("--filled-grad-offset");
      box.classList.remove("filled", "beyond");
      box.classList.add("upcoming");
      if (globalWeekIndex <= weeksLived) {
        box.classList.remove("upcoming");
        box.classList.add("filled");
        box.style.setProperty("--filled-grad-height", `${gradientHeight}px`);
        box.style.setProperty(
          "--filled-grad-offset",
          `${-rowIndex * cellSize}px`
        );
      } else if (globalWeekIndex > expectancyWeeks) {
        if (!showBeyond) {
          box.hidden = true;
          return;
        }
        box.classList.remove("upcoming");
        box.classList.add("beyond");
      }
    });
  });
  lifeGrid.hidden = false;
  lifeGrid.classList.add("is-visible");
  if (weeksLivedHeading) {
    weeksLivedHeading.textContent = `${weeksLived.toLocaleString()} weeks lived (${daysLived.toLocaleString()} days)`;
  }
  updateNameHeadings();
  lastGridStats = {
    weeksLived,
    daysLived,
    expectancyWeeks,
    expectancyYears: expectancyYearsCapped,
    showBeyond,
    totalYears: desiredYears,
    name: nameInput.value.trim(),
    title: lifeCalendarHeading
      ? lifeCalendarHeading.textContent
      : "My life in weeks",
  };
}

function updateLifeBoxScale() {
  if (!lifeBoxes) {
    return { boxSize: BASE_LIFE_BOX_SIZE, boxGap: BASE_LIFE_BOX_GAP };
  }
  const container =
    lifeBoxes.closest(".life-grid-inner") || lifeBoxes.parentElement;
  if (!container) {
    return { boxSize: BASE_LIFE_BOX_SIZE, boxGap: BASE_LIFE_BOX_GAP };
  }
  const availableWidth = container.clientWidth;
  const baseGridWidth =
    WEEKS_PER_YEAR * (BASE_LIFE_BOX_SIZE + BASE_LIFE_BOX_GAP) -
    BASE_LIFE_BOX_GAP;
  const ratio = availableWidth / baseGridWidth;
  const scale = ratio >= 0.995 ? 1 : Math.min(1, ratio);
  const boxSize = Number((BASE_LIFE_BOX_SIZE * scale).toFixed(2));
  const boxGap = Number((BASE_LIFE_BOX_GAP * scale).toFixed(2));
  lifeBoxes.style.setProperty("--life-box-size", `${boxSize}px`);
  lifeBoxes.style.setProperty("--life-box-gap", `${boxGap}px`);
  return { boxSize, boxGap };
}

function hideTooltip() {
  if (weekTooltip) {
    weekTooltip.hidden = true;
  }
}

function createBaseCanvas() {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d"), width, height };
}

function loadClockFaceImage() {
  if (!clockFaceImagePromise) {
    clockFaceImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "assets/clockbase.svg";
    });
  }
  return clockFaceImagePromise;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTextWithSpacing(
  ctx,
  text,
  x,
  y,
  letterSpacingEm,
  fontSize,
  align = "left"
) {
  if (!text) return;
  const spacing = letterSpacingEm * fontSize;
  const glyphs = Array.from(text);
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, glyphs.length - 1) * spacing;

  let startX = x;
  if (align === "center") {
    startX = x - totalWidth / 2;
  } else if (align === "right") {
    startX = x - totalWidth;
  }

  ctx.save();
  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let cursorX = startX;
  glyphs.forEach((glyph, index) => {
    ctx.fillText(glyph, cursorX, y);
    cursorX += widths[index] + spacing;
  });
  ctx.textAlign = previousAlign;
  ctx.restore();
}

function measureTextWithSpacing(ctx, text, letterSpacingEm, fontSize) {
  if (!text) return 0;
  const spacing = letterSpacingEm * fontSize;
  const glyphs = Array.from(text);
  const widths = glyphs.map((glyph) => ctx.measureText(glyph).width);
  return (
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, glyphs.length - 1) * spacing
  );
}

function drawClockHand(ctx, cx, cy, angleDeg, length, width, color, fillColor) {
  const headInset = Math.max(10, Math.round(width * 0.8));
  const tipWidth = Math.max(4, Math.round(width * 0.22));
  const shoulderWidth = Math.max(6, Math.round(width * 0.9));
  const shoulderInset = width - shoulderWidth;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.translate(-width / 2, 0);

  const topY = -length;
  ctx.beginPath();
  ctx.moveTo((width - tipWidth) / 2, topY);
  ctx.lineTo((width + tipWidth) / 2, topY);
  ctx.lineTo(shoulderWidth, topY + headInset);
  ctx.lineTo(shoulderWidth, 0);
  ctx.lineTo(shoulderInset, 0);
  ctx.lineTo(shoulderInset, topY + headInset);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  if (fillColor) {
    const inset = Math.max(2, Math.round(width * 0.34));
    const topStart = Math.min(length - 6, Math.max(8, Math.round(width)));
    const topEnd = Math.min(length - 2, Math.max(24, Math.round(width * 3)));

    ctx.beginPath();
    ctx.moveTo(inset, -length + topStart);
    ctx.lineTo(width - inset, -length + topStart);
    ctx.lineTo(width - inset, -length + topEnd);
    ctx.lineTo(inset, -length + topEnd);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.restore();
}

function drawDayNightIndicator(ctx, cx, cy, faceSize, hours, minutes) {
  if (typeof hours !== "number" || typeof minutes !== "number") return;
  const indicatorSize = faceSize * (130 / 400);
  const offsetY = faceSize * (100 / 400);
  const centerX = cx;
  const centerY = cy + offsetY;
  const radius = indicatorSize / 2;

  const angle = ((hours + minutes / 60) / 24) * 360 - 180;
  const segments = 120;
  const colors = [
    "#0b1426",
    "#143057",
    "#50bdec",
    "#8bdcff",
    "#50bdec",
    "#143057",
    "#0b1426",
  ];
  const colorStops = [0, 60, 150, 180, 210, 300, 360];

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((angle * Math.PI) / 180);

  const sweepRad = (150 * Math.PI) / 180;
  const arcInset = (Math.PI - sweepRad) / 2;
  const startAngle = Math.PI - arcInset;
  const endAngle = arcInset;
  ctx.beginPath();
  ctx.arc(0, 0, radius, startAngle, endAngle, false);
  ctx.closePath();
  ctx.clip();

  for (let i = 0; i < segments; i++) {
    const startDeg = (i / segments) * 360;
    const endDeg = ((i + 1) / segments) * 360;
    let color = colors[colors.length - 1];
    for (let j = 0; j < colorStops.length - 1; j++) {
      if (startDeg >= colorStops[j] && startDeg < colorStops[j + 1]) {
        color = colors[j];
        break;
      }
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.fillStyle = color;
    ctx.arc(
      0,
      0,
      radius,
      (startDeg * Math.PI) / 180,
      (endDeg * Math.PI) / 180,
      false
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255, 199, 0, 0.7)";
  const stars = [
    { x: -radius * 0.42, y: -radius * 0.28, r: 1.6 },
    { x: -radius * 0.22, y: -radius * 0.42, r: 1.2 },
    { x: -radius * 0.12, y: -radius * 0.18, r: 1 },
    { x: -radius * 0.3, y: -radius * 0.12, r: 0.8 },
  ];
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const emojiFont = `${Math.round(
    radius * 0.38
  )}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.font = emojiFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.save();
  ctx.rotate((90 * Math.PI) / 180);
  ctx.fillText("🌞", radius * 0.45, 0);
  ctx.restore();

  ctx.save();
  ctx.rotate((-90 * Math.PI) / 180);
  ctx.fillText("🌜", -radius * 0.45, 0);
  ctx.restore();

  ctx.font = `${Math.round(
    radius * 0.26
  )}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText("☁️", 0, -radius * 0.42);
  ctx.fillText("☁️", 0, -radius * 0.1);

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

async function buildClockShareCanvas(state) {
  if (!state) return null;
  const { canvas, ctx, width, height } = createBaseCanvas();
  const accent = getCssVar("--accent", "#33cc99");
  const accent2 = getCssVar("--accent-2", "#f97316");
  const text = getCssVar("--text", "#0f172a");
  drawCanvasBackground(ctx, width, height, 0.5);

  const headingX = width / 2;
  const headingY = 320;
  const headingText = "My life in hours";
  const headingToken = " in hours";
  let headingLine1 = headingText;
  let headingLine2 = "";
  const headingTokenIndex = headingText.toLowerCase().lastIndexOf(headingToken);
  if (headingTokenIndex !== -1) {
    headingLine1 = headingText.slice(0, headingTokenIndex);
    headingLine2 = headingText.slice(headingTokenIndex + 1);
  }

  ctx.fillStyle = text;
  ctx.textAlign = "center";
  const headingFontSize = 200;
  const headingLetterSpacing = -0.02;
  const lineHeight = 200;
  ctx.font = `600 ${headingFontSize}px "Zalando Sans", "Helvetica Neue", sans-serif`;
  drawTextWithSpacing(
    ctx,
    headingLine1.trim(),
    headingX,
    headingY,
    headingLetterSpacing,
    headingFontSize,
    "center"
  );
  let readoutY = headingY + lineHeight;
  if (headingLine2) {
    drawTextWithSpacing(
      ctx,
      headingLine2.trim(),
      headingX,
      headingY + lineHeight,
      headingLetterSpacing,
      headingFontSize,
      "center"
    );
    readoutY = headingY + lineHeight * 2;
  }
  readoutY += 10;

  const readoutFontSize = 140;
  const readoutText = state.readout || "--:--";
  const readoutPaddingX = 0;
  const readoutPaddingTop = 10;
  const readoutPaddingBottom = 50;
  const readoutMetrics = ctx.measureText(readoutText);
  const readoutAscent =
    readoutMetrics.actualBoundingBoxAscent || readoutFontSize * 0.8;
  const readoutDescent =
    readoutMetrics.actualBoundingBoxDescent || readoutFontSize * 0.2;
  const readoutHeight = readoutAscent + readoutDescent;
  const readoutWidth = readoutMetrics.width;
  const readoutPillX = headingX - readoutWidth / 2 - readoutPaddingX;
  const readoutPillY = readoutY - readoutAscent - readoutPaddingTop;
  const readoutPillW = readoutWidth + readoutPaddingX * 2;
  const readoutPillH = readoutHeight + readoutPaddingTop + readoutPaddingBottom;

  ctx.fillStyle = text;
  drawRoundedRect(
    ctx,
    readoutPillX,
    readoutPillY,
    readoutPillW,
    readoutPillH,
    28
  );
  ctx.fill();

  ctx.fillStyle = getCssVar("--white", "#ffffff");
  ctx.font = `500 ${readoutFontSize}px "Zalando Sans", "Helvetica Neue", sans-serif`;
  ctx.fillText(readoutText, headingX, readoutY);
  ctx.textAlign = "start";

  const cx = width / 2;
  const cy = height / 2 + 340;
  const radius = 420;

  const faceSize = radius * 2;
  try {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    const faceImg = await loadClockFaceImage();
    ctx.drawImage(
      faceImg,
      cx - faceSize / 2,
      cy - faceSize / 2,
      faceSize,
      faceSize
    );
  } catch (err) {
    console.warn("Clock face image failed to load, using fallback:", err);
  }
  // drawDayNightIndicator(ctx, cx, cy, faceSize, state.hours, state.minutes);

  // Redraw hands on top of face
  const hourLength = radius * 0.5;
  const minuteLength = radius * 0.8;
  const handWidth = 24;
  const handFill = getCssVar("--accent-4", "#f26d7d");
  drawClockHand(
    ctx,
    cx,
    cy,
    state.hourAngle,
    hourLength,
    handWidth,
    text,
    handFill
  );
  drawClockHand(
    ctx,
    cx,
    cy,
    state.minuteAngle,
    minuteLength,
    handWidth,
    text,
    handFill
  );

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = text;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = text;
  ctx.textAlign = "center";
  ctx.font = '500 55px "Zalando Sans", "Helvetica Neue", sans-serif';
  ctx.fillText("loremipsum.com", width / 2, height - 80);
  ctx.textAlign = "start";

  return canvas;
}

function buildGridShareCanvas(stats) {
  if (!stats) return null;
  const { canvas, ctx, width, height } = createBaseCanvas();
  const text = getCssVar("--text", "#0f172a");
  const mutedRgb = getCssVar("--muted-rgb", "164, 172, 182");
  const textRgb = getCssVar("--text-rgb", "15, 23, 42");
  const filledStart = getCssVar("--filled-grad-start", "#ffc8c8");
  const filledEnd = getCssVar("--filled-grad-end", "#0c59c4");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const titleText = "My life in weeks";

  ctx.fillStyle = text;
  const titleFontSize = 130;
  const titleLetterSpacing = -0.02;
  ctx.font = `600 ${titleFontSize}px "Zalando Sans", "Helvetica Neue", sans-serif`;
  const titleWidth = measureTextWithSpacing(
    ctx,
    titleText,
    titleLetterSpacing,
    titleFontSize
  );
  const contentTop = 20;
  const targetGridWidth = Math.min(width - 120, titleWidth);
  const gridTop = contentTop + 300;
  const baseSize = 14;
  const baseGap = 2;
  const availableHeight = height - gridTop - 100;
  const rowHeight = baseSize + baseGap;
  const baseGridWidth = WEEKS_PER_YEAR * (baseSize + baseGap) - baseGap;
  const decadeGap = 4;
  const decadeCount = Math.floor((stats.totalYears - 1) / 10);
  const availableHeightForRows = availableHeight - decadeCount * decadeGap;
  const scaleFromHeight =
    availableHeightForRows / (stats.totalYears * rowHeight);
  const scaleFromWidth = targetGridWidth / baseGridWidth;
  const scale = Math.min(1.4, scaleFromHeight, scaleFromWidth);
  const box = Math.max(8, baseSize * scale);
  const gap = baseGap * scale;
  const gridWidth = WEEKS_PER_YEAR * (box + gap) - gap;
  const startX = (width - gridWidth) / 2;
  const startY = gridTop;
  const gridHeight =
    stats.totalYears * (box + gap) - gap + decadeCount * decadeGap;
  const filledGradient = ctx.createLinearGradient(
    0,
    startY,
    0,
    startY + gridHeight
  );
  filledGradient.addColorStop(0, filledStart);
  filledGradient.addColorStop(1, filledEnd);
  const upcomingStroke = `rgba(${mutedRgb}, 0.5)`;
  const beyondStroke = `rgba(${textRgb}, 0.15)`;
  ctx.lineWidth = 1;
  drawTextWithSpacing(
    ctx,
    titleText,
    width / 2,
    contentTop + 160,
    titleLetterSpacing,
    titleFontSize,
    "center"
  );

  ctx.fillStyle = text;
  const statsFontSize = 55;
  const statsLetterSpacing = -0.02;
  ctx.font = `500 ${statsFontSize}px "Zalando Sans", "Helvetica Neue", sans-serif`;
  const statsY = contentTop + 240;
  drawTextWithSpacing(
    ctx,
    `${stats.weeksLived.toLocaleString()} weeks lived (${stats.daysLived.toLocaleString()} days)`,
    startX,
    statsY,
    statsLetterSpacing,
    statsFontSize,
    "left"
  );

  for (let year = 0; year < stats.totalYears; year++) {
    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
      const globalWeek = year * WEEKS_PER_YEAR + week + 1;
      if (!stats.showBeyond && globalWeek > stats.expectancyWeeks) continue;
      const decadeOffset = Math.floor(year / 10) * decadeGap;
      const y = startY + year * (box + gap) + decadeOffset;
      const x = startX + week * (box + gap);
      if (globalWeek <= stats.weeksLived) {
        ctx.fillStyle = filledGradient;
        ctx.fillRect(x, y, box, box);
      } else if (globalWeek > stats.expectancyWeeks) {
        ctx.strokeStyle = beyondStroke;
        ctx.strokeRect(x, y, box, box);
      } else {
        ctx.strokeStyle = upcomingStroke;
        ctx.strokeRect(x, y, box, box);
      }
    }
  }

  ctx.fillStyle = text;
  ctx.font = '500 55px "Zalando Sans", "Helvetica Neue", sans-serif';
  const signature = "loremipsum.com";
  const signatureWidth = ctx.measureText(signature).width;
  ctx.fillText(signature, width - 60 - signatureWidth, height - 80);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}

async function shareCanvas(canvas, filename, button) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to create image"));
        return;
      }
      const file = new File([blob], filename, { type: "image/png" });
      const payload = {
        files: [file],
        title: "Life snapshot",
        text: "My life snapshot",
      };

      try {
        if (navigator.canShare && navigator.canShare(payload)) {
          await navigator.share(payload);
          resolve();
          return;
        }
        downloadCanvas(canvas, filename);
        resolve();
      } catch (err) {
        downloadCanvas(canvas, filename);
        reject(err);
      } finally {
        if (button) {
          button.disabled = false;
          button.classList.remove("loading");
        }
      }
    });
  });
}

function previewCanvas(canvas, target) {
  if (!canvas) return false;
  const holder = target || document.body;
  const existing = holder.querySelector(".share-preview");
  if (existing) {
    existing.remove();
    return false;
  }
  const img = document.createElement("img");
  img.className = "share-preview";
  img.src = canvas.toDataURL("image/png");
  img.alt = "Share preview";
  img.style.maxWidth = "100%";
  img.style.marginTop = "16px";
  holder.appendChild(img);
  if (holder.scrollIntoView)
    holder.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

if (weekTooltip && lifeBoxes) {
  lifeBoxes.addEventListener("pointermove", (event) => {
    const target = event.target.closest(".life-box");
    if (!target || !target.dataset.week || !target.dataset.year) {
      hideTooltip();
      return;
    }
    weekTooltip.textContent = `Year ${target.dataset.year}, Week ${target.dataset.week}`;
    weekTooltip.hidden = false;
    weekTooltip.style.left = `${event.clientX + 12}px`;
    weekTooltip.style.top = `${event.clientY - 12}px`;
  });

  lifeBoxes.addEventListener("pointerleave", hideTooltip);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  applyQaDefaults();
  renderFromDob(dobInput.value);
});

function renderFromDob(value) {
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const parsed = parseDob(value);
  if (!parsed || parsed > today || parsed < minAllowedDate) {
    form.reportValidity();
    return;
  }
  const ageYears = calculateAgeYears(parsed);
  const dobDate = parsed;
  lastDobDate = dobDate;
  const ratio = ageYears / lifeExpectancyYears;
  updateClock(ratio);
  updateLifeGrid(ageYears, dobDate);
  flipFormShell(true);
  updateSharePreviewOverlay();
}

function hideVisuals() {
  clockPanel.hidden = true;
  clockPanel.classList.remove("is-visible");
  lifeGrid.hidden = true;
  lifeGrid.classList.remove("is-visible");
  flipFormShell(false);
  document.body.style.backgroundImage = defaultGradient;
  hideTooltip();
  updateNameHeadings();
}

dobInput.addEventListener("input", (event) => {
  if (!dobInput.value) {
    hideVisuals();
  }
});

function reRenderIfHasResults() {
  if (!document.body.classList.contains("has-results")) return;
  if (!dobInput.value.trim() || !nameInput.value.trim()) return;
  renderFromDob(dobInput.value);
}

function applyQaDefaults() {
  if (!QA_MODE) return;
  if (!nameInput.value.trim()) nameInput.value = QA_FAKE_NAME;
  if (!dobInput.value.trim()) dobInput.value = QA_FAKE_DOB;
}

if (nameInput) {
  nameInput.addEventListener("input", () => {
    updateNameHeadings();
  });
  nameInput.addEventListener("change", reRenderIfHasResults);
}

dobInput.addEventListener("change", reRenderIfHasResults);

if (printBtn) {
  printBtn.addEventListener("click", () => {
    window.print();
  });
}

function guardShare(button) {
  if (!document.body.classList.contains("has-results")) {
    alert("Submit your info first to generate a share image.");
    return false;
  }
  if (button) {
    button.disabled = true;
    button.classList.add("loading");
  }
  return true;
}

function buildClockShareText(includeEmoji = false) {
  return buildSocialShareText(includeEmoji);
}

function buildGridShareText(includeEmoji = false) {
  return buildSocialShareText(includeEmoji);
}

function buildSocialShareText(includeEmoji = false) {
  const name = possessiveName();
  const label = name || "My";
  const readout = lastClockState ? lastClockState.readout : "xx:xx";
  const weeks = lastGridStats ? lastGridStats.weeksLived.toLocaleString() : "—";
  const host = window.location.host || "startnow.life";
  const timeEmoji = includeEmoji ? "⏰ " : "";
  const weekEmoji = includeEmoji ? "📅 " : "";
  return `${label} life stats right now:\n${timeEmoji}${readout} · ${weekEmoji}Week ${weeks}\nSee yours: ${host}`;
}

function ensureSharePreviewOverlay() {
  const existing = document.querySelector(".share-preview-overlay");
  if (existing) return existing;
  const overlay = document.createElement("div");
  overlay.className = "share-preview-overlay";
  overlay.innerHTML = `
    <h4>Share Preview</h4>
    <img alt="Clock share preview" data-share-preview="clock">
    <img alt="Life grid share preview" data-share-preview="grid">
  `;
  document.body.appendChild(overlay);
  return overlay;
}

async function updateSharePreviewOverlay() {
  if (!SHOW_SHARE_PREVIEW || !document.body.classList.contains("has-results"))
    return;
  const overlay = ensureSharePreviewOverlay();
  const clockImg = overlay.querySelector('[data-share-preview="clock"]');
  const gridImg = overlay.querySelector('[data-share-preview="grid"]');
  if (clockImg && lastClockState) {
    const clockCanvas = await buildClockShareCanvas(lastClockState);
    if (clockCanvas) clockImg.src = clockCanvas.toDataURL("image/png");
  }
  if (gridImg && lastGridStats) {
    const gridCanvas = buildGridShareCanvas(lastGridStats);
    if (gridCanvas) gridImg.src = gridCanvas.toDataURL("image/png");
  }
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard write failed, falling back.", err);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

function openShareUrl(url) {
  window.open(url, "_blank", "noopener");
}

function toggleShareMenu(panel, forceOpen) {
  if (!panel) return;
  if (panel.dataset.static === "true") return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
  panel.hidden = !shouldOpen;
}

function handleShareMenuClick(event) {
  const button = event.target.closest(".share-menu-item");
  if (!button) return;
  const panel = button.closest(".share-menu-list");
  if (!panel) return;
  const source = panel.dataset.shareSource;
  const target = button.dataset.shareTarget;
  const shareUrl = encodeURIComponent(window.location.href);

  if (source === "clock") {
    if (!lastClockState) {
      alert("Nothing to share yet—try submitting first.");
      toggleShareMenu(panel, false);
      return;
    }
    buildClockShareCanvas(lastClockState).then((canvas) => {
      const shareText = encodeURIComponent(buildClockShareText(target === "x"));
      if (target === "download") {
        downloadCanvas(canvas, "life-clock-9x16.png");
      } else if (target === "instagram") {
        if (target === "instagram") {
          const caption = buildClockShareText(true);
          copyTextToClipboard(caption).then((copied) => {
            if (copied) {
              alert("Caption copied!");
            }
          });
        }
      } else if (target === "x") {
        openShareUrl(
          `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`
        );
      } else if (target === "threads") {
        openShareUrl(
          `https://www.threads.net/intent/post?text=${shareText}%20${shareUrl}`
        );
      }
    });
  } else if (source === "grid") {
    if (!lastGridStats) {
      alert("Nothing to share yet—try submitting first.");
      toggleShareMenu(panel, false);
      return;
    }
    const canvas = buildGridShareCanvas(lastGridStats);
    const shareText = encodeURIComponent(buildGridShareText(target === "x"));
    if (target === "download") {
      downloadCanvas(canvas, "life-grid-9x16.png");
    } else if (target === "instagram") {
      if (target === "instagram") {
        const caption = buildGridShareText(true);
        copyTextToClipboard(caption).then((copied) => {
          if (copied) {
            alert("Caption copied!");
          }
        });
      }
    } else if (target === "x") {
      openShareUrl(
        `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`
      );
    } else if (target === "threads") {
      openShareUrl(
        `https://www.threads.net/intent/post?text=${shareText}%20${shareUrl}`
      );
    }
  }
  toggleShareMenu(panel, false);
}

if (clockSharePanel) {
  clockSharePanel.addEventListener("click", handleShareMenuClick);
}

if (gridSharePanel) {
  gridSharePanel.addEventListener("click", handleShareMenuClick);
}

if (resultsSharePanel) {
  resultsSharePanel.addEventListener("click", handleShareMenuClick);
  setShareSource(lastShareSource);
}

if (clockPanel) {
  clockPanel.addEventListener("click", () => setShareSource("clock"));
  clockPanel.addEventListener("focusin", () => setShareSource("clock"));
}

if (lifeGrid) {
  lifeGrid.addEventListener("click", () => setShareSource("grid"));
  lifeGrid.addEventListener("focusin", () => setShareSource("grid"));
}

window.addEventListener("click", (event) => {
  if (
    gridSharePanel &&
    !gridSharePanel.hidden &&
    !gridSharePanel.contains(event.target)
  ) {
    toggleShareMenu(gridSharePanel, false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    toggleShareMenu(gridSharePanel, false);
  }
});

function initBlobWiggle() {
  const blobs = Array.from(document.querySelectorAll(".bg-blobs .blob"));
  if (!blobs.length) return;

  const randomBetween = (min, max) => Math.random() * (max - min) + min;
  const update = () => {
    blobs.forEach((blob) => {
      const x = randomBetween(-160, 160);
      const y = randomBetween(-120, 120);
      const scale = randomBetween(0.9, 1.6);
      const duration = randomBetween(1200, 2200);

      blob.style.setProperty("--blob-x", `${x}px`);
      blob.style.setProperty("--blob-y", `${y}px`);
      blob.style.setProperty("--blob-scale", scale.toFixed(3));
      blob.style.transitionDuration = `${Math.round(duration)}ms`;
    });
  };

  update();
  setInterval(update, 1800);
}

window.addEventListener("resize", () => {
  if (document.body.classList.contains("has-results")) {
    flipFormShell(true);
    if (lastDobDate) {
      updateLifeGrid(calculateAgeYears(lastDobDate), lastDobDate);
    }
  }
});

updateNameHeadings();
initBlobWiggle();

if (QA_MODE) {
  applyQaDefaults();
  renderFromDob(dobInput.value);
}

fetchLifeExpectancy();
