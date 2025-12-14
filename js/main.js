const dobInput = document.getElementById('dob');
const nameInput = document.getElementById('name');
const form = document.getElementById('dob-form');
const clockPanel = document.getElementById('clock-panel');
const hourHand = document.getElementById('hour-hand');
const minuteHand = document.getElementById('minute-hand');
const clockReadout = document.getElementById('clock-readout');
const clockCaption = document.getElementById('clock-caption');
const weeksLivedHeading = document.getElementById('weeks-lived-heading');
const lifeClockHeading = document.getElementById('life-clock-heading');
const lifeCalendarHeading = document.getElementById('life-calendar-heading');
const defaultGradient = 'radial-gradient(circle at 20% 20%, #f6f7fb 0, #e4ecf3 25%, #d7e7f0 50%, #c5dfea 75%, #b7d3e3 100%)';
const lifeGrid = document.getElementById('life-grid');
const lifeBoxes = document.getElementById('life-boxes');
const weekTooltip = document.getElementById('week-tooltip');
const printBtn = document.getElementById('print-btn');
const shareClockBtn = document.getElementById('share-clock-btn');
const shareGridBtn = document.getElementById('share-grid-btn');
const previewClockBtn = document.getElementById('preview-clock-btn');
const previewGridBtn = document.getElementById('preview-grid-btn');
const clockPreviewHolder = document.getElementById('clock-preview');
const gridPreviewHolder = document.getElementById('grid-preview');
const formShell = document.querySelector('.form-shell');

const today = new Date();
today.setHours(0, 0, 0, 0);
const MAX_AGE_YEARS = 123;
const minAllowedYear = today.getFullYear() - MAX_AGE_YEARS;
const minAllowedDate = new Date(`${minAllowedYear}-01-01T00:00:00`);
dobInput.max = today.toISOString().split('T')[0];
dobInput.min = minAllowedDate.toISOString().split('T')[0];

let lifeExpectancyYears = 100;
const EXPECTANCY_SOURCE = 'World Bank global average';
let lifeExpectancyLastUpdate = null;
const MAX_YEARS_DISPLAYED = 123;
const WEEKS_PER_YEAR = 52;
let currentYearsDisplayed = 0;
const DAY_MS = 24 * 60 * 60 * 1000;
let lastGridStats = null;
let lastClockState = null;
let clockFaceImagePromise = null;
// QA toggle: set to false to restore normal behavior
const QA_MODE = true;
const QA_FAKE_DOB = '1990-01-01';
const QA_FAKE_NAME = 'QA User';

if (QA_MODE && form) {
  // Disable native validation gating so submit still fires during QA.
  form.noValidate = true;
}

async function fetchLifeExpectancy() {
  try {
    const res = await fetch('https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.LE00.IN?format=json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const series = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    const firstValid = series.find((entry) => entry && entry.value !== null);
    if (firstValid && typeof firstValid.value === 'number') {
      lifeExpectancyYears = Number(firstValid.value.toFixed(1));
      lifeExpectancyLastUpdate = firstValid.date || null;
    }
  } catch (err) {
    console.warn('Falling back to default life expectancy:', err);
  } finally {
    if (document.body.classList.contains('has-results') && dobInput.value) {
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
  return trimmed.endsWith('s') ? `${trimmed}'` : `${trimmed}'s`;
}

function parseDob(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
    date.setHours(0, 0, 0, 0);
    return date;
  }
  return null;
}

function updateNameHeadings() {
  const possessive = possessiveName();
  if (lifeClockHeading) {
    lifeClockHeading.textContent = possessive ? `${possessive} life in hours` : 'My life in hours';
  }
  if (lifeCalendarHeading) {
    lifeCalendarHeading.textContent = possessive ? `${possessive} life in weeks` : 'My life in weeks';
  }
}

function getCssVar(name, fallback) {
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(name);
  return value ? value.trim() : fallback;
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

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const dayLabel = dayOffset > 0 ? `Day ${dayOffset + 1}, ` : '';
  clockReadout.textContent = `${dayLabel}${hh}:${mm}`;
  const beyondNote = dayOffset > 0 ? 'Beyond average life expectancy. ' : '';
  const updateNote = lifeExpectancyLastUpdate ? `, last update: ${lifeExpectancyLastUpdate}` : '';
  clockCaption.innerHTML = `${beyondNote}Clock based on an average life expectancy of ${lifeExpectancyYears} years.<br>(${EXPECTANCY_SOURCE}${updateNote})`;
  clockPanel.hidden = false;
  clockPanel.classList.add('is-visible');

  document.body.style.backgroundImage = defaultGradient;

  lastClockState = {
    heading: lifeClockHeading ? lifeClockHeading.textContent : 'My life in hours',
    readout: clockReadout ? clockReadout.textContent : '',
    hourAngle,
    minuteAngle,
  };
}

function flipFormShell(enableResults) {
  if (!formShell) return;
  const currentlyHasResults = document.body.classList.contains('has-results');
  if (enableResults === currentlyHasResults) return;

  const firstRect = formShell.getBoundingClientRect();
  document.body.classList.toggle('has-results', enableResults);
  const lastRect = formShell.getBoundingClientRect();
  const deltaY = firstRect.top - lastRect.top;

  if (deltaY !== 0 && formShell.animate) {
    formShell.animate(
      [
        { transform: `translateY(${deltaY}px)` },
        { transform: 'translateY(0)' },
      ],
      {
        duration: 550,
        easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
      },
    );
  }
}

function buildLifeBoxes(totalYears) {
  if (totalYears === currentYearsDisplayed) return;
  lifeBoxes.innerHTML = '';
  const container = document.createDocumentFragment();
  for (let year = 1; year <= totalYears; year++) {
    const row = document.createElement('div');
    row.className = 'life-row';
    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
      const box = document.createElement('div');
      box.className = 'life-box upcoming';
      box.dataset.year = String(year);
      const weekNumber = week + 1;
      box.dataset.week = String(weekNumber);
      const bandIndex = Math.floor((weekNumber - 1) / 10);
      if (bandIndex % 2 === 1) {
        box.classList.add('band-alt');
      }
      if (weekNumber % 10 === 0) {
        box.classList.add('ten-mark');
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
  const expectancyYearsCapped = Math.min(lifeExpectancyYears, MAX_YEARS_DISPLAYED);
  const expectancyWeeks = Math.floor(expectancyYearsCapped * WEEKS_PER_YEAR);
  const desiredYears = Math.min(
    Math.max(Math.ceil(expectancyYearsCapped), Math.ceil(weeksLived / WEEKS_PER_YEAR)),
    MAX_YEARS_DISPLAYED,
  );
  buildLifeBoxes(desiredYears);
  const showBeyond = weeksLived > expectancyWeeks;

  Array.from(lifeBoxes.children).forEach((row, rowIndex) => {
    const boxes = Array.from(row.children);
    boxes.forEach((box, weekIndex) => {
      const globalWeekIndex = rowIndex * WEEKS_PER_YEAR + weekIndex + 1;
      box.hidden = false;
      box.classList.remove('filled', 'beyond');
      box.classList.add('upcoming');
      if (globalWeekIndex <= weeksLived) {
        box.classList.remove('upcoming');
        box.classList.add('filled');
      } else if (globalWeekIndex > expectancyWeeks) {
        if (!showBeyond) {
          box.hidden = true;
          return;
        }
        box.classList.remove('upcoming');
        box.classList.add('beyond');
      }
    });
  });
  lifeGrid.hidden = false;
  lifeGrid.classList.add('is-visible');
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
    title: lifeCalendarHeading ? lifeCalendarHeading.textContent : 'My life in weeks',
  };
}

function hideTooltip() {
  if (weekTooltip) {
    weekTooltip.hidden = true;
  }
}

function createBaseCanvas() {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d'), width, height };
}

function loadClockFaceImage() {
  if (!clockFaceImagePromise) {
    clockFaceImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'assets/clockbase.svg';
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

function drawClockHand(ctx, cx, cy, angleDeg, length, width, color) {
  const headInset = 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.translate(-width / 2, 0);

  const topY = -length;
  ctx.beginPath();
  ctx.moveTo(width * 0.42, topY);
  ctx.lineTo(width * 0.58, topY);
  ctx.lineTo(width * 0.9, topY + headInset);
  ctx.lineTo(width * 0.9, 0);
  ctx.lineTo(width * 0.1, 0);
  ctx.lineTo(width * 0.1, topY + headInset);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

async function buildClockShareCanvas(state) {
  if (!state) return null;
  const { canvas, ctx, width, height } = createBaseCanvas();
  const accent = getCssVar('--accent', '#33cc99');
  const accent2 = getCssVar('--accent-2', '#f97316');
  const text = getCssVar('--text', '#0f172a');
  const softBg = '#fff';
  ctx.fillStyle = softBg;
  ctx.fillRect(0, 0, width, height);

  const headingX = 120;
  const headingY = 140;
  const headingText = state.heading || 'My Life Clock';
  const headingToken = ' in hours';
  let headingLine1 = headingText;
  let headingLine2 = '';
  const headingTokenIndex = headingText.toLowerCase().lastIndexOf(headingToken);
  if (headingTokenIndex !== -1) {
    headingLine1 = headingText.slice(0, headingTokenIndex);
    headingLine2 = headingText.slice(headingTokenIndex + 1);
  }

  ctx.fillStyle = text;
  ctx.font = '600 64px "Zalando Sans", "Helvetica Neue", sans-serif';
  ctx.fillText(headingLine1.trim(), headingX, headingY);
  let readoutY = headingY + 70;
  if (headingLine2) {
    ctx.fillText(headingLine2.trim(), headingX, headingY + 70);
    readoutY = headingY + 140;
  }

  ctx.fillStyle = text;
  ctx.font = '500 60px "Zalando Sans", "Helvetica Neue", sans-serif';
  ctx.fillText(state.readout || '--:--', headingX, readoutY);

  const cx = width / 2;
  const cy = height / 2 + 80;
  const radius = 320;

  try {
    const faceImg = await loadClockFaceImage();
    const faceSize = radius * 2;
    ctx.drawImage(faceImg, cx - faceSize / 2, cy - faceSize / 2, faceSize, faceSize);
  } catch (err) {
    console.warn('Clock face image failed to load, using fallback:', err);
  }

  // Redraw hands on top of face
  const hourLength = radius * 0.5;
  const minuteLength = radius * 0.8;
  const handWidth = 8;
  drawClockHand(ctx, cx, cy, state.hourAngle, hourLength, handWidth, text);
  drawClockHand(ctx, cx, cy, state.minuteAngle, minuteLength, handWidth, text);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = text;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

function buildGridShareCanvas(stats) {
  if (!stats) return null;
  const { canvas, ctx, width, height } = createBaseCanvas();
  const accent = getCssVar('--accent', '#33cc99');
  const accent2 = getCssVar('--btn-hover', '#2cb386');
  const text = getCssVar('--text', '#0f172a');
  const muted = getCssVar('--muted', '#a4acb6');
  const softBg = '#ecececff';
  const upcoming = '#eef1f4ff';
  const beyond = '#e2e8f0';
  ctx.fillStyle = softBg;
  ctx.fillRect(0, 0, width, height);

  const cardX = 60;
  const cardY = 120;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'rgba(15,23,42,0.2)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const gridTop = cardY + 320;
  const baseSize = 14;
  const baseGap = 2;
  const availableHeight = cardY + cardH - gridTop - 100;
  const rowHeight = baseSize + baseGap;
  const scale = Math.min(1, availableHeight / (stats.totalYears * rowHeight));
  const box = Math.max(8, baseSize * scale);
  const gap = baseGap * scale;
  const gridWidth = WEEKS_PER_YEAR * (box + gap) - gap;
  const startX = (width - gridWidth) / 2;
  const startY = gridTop;

  const titleText = stats.title || 'My life in weeks';
  const token = ' in weeks';
  let titleLine1 = titleText;
  let titleLine2 = '';
  const tokenIndex = titleText.toLowerCase().lastIndexOf(token);
  if (tokenIndex !== -1) {
    titleLine1 = titleText.slice(0, tokenIndex);
    titleLine2 = titleText.slice(tokenIndex + 1);
  }

  ctx.fillStyle = text;
  ctx.font = '600 90px "Zalando Sans", "Helvetica Neue", sans-serif';
  ctx.fillText(titleLine1.trim(), startX, cardY + 140);
  if (titleLine2) {
    ctx.font = '600 90px "Zalando Sans", "Helvetica Neue", sans-serif';
    ctx.fillText(titleLine2.trim(), startX, cardY + 230);
  }

  ctx.fillStyle = text;
  ctx.font = '500 24px "Zalando Sans", "Helvetica Neue", sans-serif';
  const statsY = titleLine2 ? cardY + 270 : cardY + 300;
  ctx.fillText(
    `${stats.weeksLived.toLocaleString()} weeks lived (${stats.daysLived.toLocaleString()} days)`,
    startX,
    statsY,
  );

  for (let year = 0; year < stats.totalYears; year++) {
    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
      const globalWeek = year * WEEKS_PER_YEAR + week + 1;
      if (!stats.showBeyond && globalWeek > stats.expectancyWeeks) continue;
      let fill = upcoming;
      if (globalWeek <= stats.weeksLived) {
        fill = accent;
      } else if (globalWeek > stats.expectancyWeeks) {
        fill = beyond;
      }
      const y = startY + year * (box + gap);
      const x = startX + week * (box + gap);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, box, box);
    }
  }

  ctx.fillStyle = muted;
  ctx.font = '400 24px "Zalando Sans", "Helvetica Neue", sans-serif';
  ctx.fillText(`Based on ${stats.expectancyYears} year avg expectancy`, cardX + 60, height - 100);
  ctx.fillStyle = text;
  ctx.font = '400 24px "Zalando Sans", "Helvetica Neue", sans-serif';
  const signature = 'startnow.life';
  const signatureWidth = ctx.measureText(signature).width;
  ctx.fillText(signature, width - 60 - signatureWidth, height - 100);

  return canvas;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
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
        reject(new Error('Failed to create image'));
        return;
      }
      const file = new File([blob], filename, { type: 'image/png' });
      const payload = { files: [file], title: 'Life snapshot', text: 'My life snapshot' };

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
          button.classList.remove('loading');
        }
      }
    });
  });
}

function previewCanvas(canvas, target) {
  if (!canvas) return;
  const holder = target || document.body;
  const existing = holder.querySelector('.share-preview');
  if (existing) existing.remove();
  const img = document.createElement('img');
  img.className = 'share-preview';
  img.src = canvas.toDataURL('image/png');
  img.alt = 'Share preview';
  img.style.maxWidth = '100%';
  img.style.marginTop = '16px';
  holder.appendChild(img);
  if (holder.scrollIntoView) holder.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


if (weekTooltip && lifeBoxes) {
  lifeBoxes.addEventListener('pointermove', (event) => {
    const target = event.target.closest('.life-box');
    if (!target || !target.dataset.week || !target.dataset.year) {
      hideTooltip();
      return;
    }
    weekTooltip.textContent = `Year ${target.dataset.year}, Week ${target.dataset.week}`;
    weekTooltip.hidden = false;
    weekTooltip.style.left = `${event.clientX + 12}px`;
    weekTooltip.style.top = `${event.clientY - 12}px`;
  });

  lifeBoxes.addEventListener('pointerleave', hideTooltip);
}

form.addEventListener('submit', (event) => {
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
  const ratio = ageYears / lifeExpectancyYears;
  updateClock(ratio);
  updateLifeGrid(ageYears, dobDate);
  flipFormShell(true);
}

function hideVisuals() {
  clockPanel.hidden = true;
  clockPanel.classList.remove('is-visible');
  lifeGrid.hidden = true;
  lifeGrid.classList.remove('is-visible');
  flipFormShell(false);
  document.body.style.backgroundImage = defaultGradient;
  hideTooltip();
  updateNameHeadings();
}

dobInput.addEventListener('input', (event) => {
  if (!dobInput.value) {
    hideVisuals();
  }
});

function reRenderIfHasResults() {
  if (!document.body.classList.contains('has-results')) return;
  if (!dobInput.value.trim() || !nameInput.value.trim()) return;
  renderFromDob(dobInput.value);
}

function applyQaDefaults() {
  if (!QA_MODE) return;
  if (!nameInput.value.trim()) nameInput.value = QA_FAKE_NAME;
  if (!dobInput.value.trim()) dobInput.value = QA_FAKE_DOB;
}

if (nameInput) {
  nameInput.addEventListener('input', () => {
    updateNameHeadings();
  });
  nameInput.addEventListener('change', reRenderIfHasResults);
}

dobInput.addEventListener('change', reRenderIfHasResults);

if (printBtn) {
  printBtn.addEventListener('click', () => {
    window.print();
  });
}

function guardShare(button) {
  if (!document.body.classList.contains('has-results')) {
    alert('Submit your info first to generate a share image.');
    return false;
  }
  if (button) {
    button.disabled = true;
    button.classList.add('loading');
  }
  return true;
}

if (shareClockBtn) {
  shareClockBtn.addEventListener('click', async () => {
    applyQaDefaults();
    if (!guardShare(shareClockBtn)) return;
    if (!lastClockState) {
      alert('Nothing to share yet—try submitting first.');
      shareClockBtn.disabled = false;
      shareClockBtn.classList.remove('loading');
      return;
    }
    const canvas = await buildClockShareCanvas(lastClockState);
    await shareCanvas(canvas, 'life-clock.png', shareClockBtn);
  });
}

if (shareGridBtn) {
  shareGridBtn.addEventListener('click', async () => {
    applyQaDefaults();
    if (!guardShare(shareGridBtn)) return;
    if (!lastGridStats) {
      alert('Nothing to share yet—try submitting first.');
      shareGridBtn.disabled = false;
      shareGridBtn.classList.remove('loading');
      return;
    }
    const canvas = buildGridShareCanvas(lastGridStats);
    await shareCanvas(canvas, 'life-calendar.png', shareGridBtn);
  });
}

if (previewClockBtn) {
  previewClockBtn.addEventListener('click', async () => {
    applyQaDefaults();
    if (!document.body.classList.contains('has-results')) {
      renderFromDob(dobInput.value);
    }
    if (!lastClockState) {
      alert('Nothing to preview yet—submit first.');
      return;
    }
    const canvas = await buildClockShareCanvas(lastClockState);
    previewCanvas(canvas, clockPreviewHolder);
  });
}

if (previewGridBtn) {
  previewGridBtn.addEventListener('click', () => {
    applyQaDefaults();
    if (!document.body.classList.contains('has-results')) {
      renderFromDob(dobInput.value);
    }
    if (!lastGridStats) {
      alert('Nothing to preview yet—submit first.');
      return;
    }
    const canvas = buildGridShareCanvas(lastGridStats);
    previewCanvas(canvas, gridPreviewHolder);
  });
}

window.addEventListener('resize', () => {
  if (document.body.classList.contains('has-results')) {
    flipFormShell(true);
  }
});

updateNameHeadings();

if (QA_MODE) {
  applyQaDefaults();
  renderFromDob(dobInput.value);
}

fetchLifeExpectancy();
