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
const formShell = document.querySelector('.form-shell');

const today = new Date();
today.setHours(0, 0, 0, 0);
const MAX_AGE_YEARS = 123;
const minAllowedYear = today.getFullYear() - MAX_AGE_YEARS;
const minAllowedDate = new Date(`${minAllowedYear}-01-01T00:00:00`);
dobInput.removeAttribute('min'); // Use custom validation to avoid native browser copy.
dobInput.max = today.toISOString().split('T')[0];
form.setAttribute('novalidate', 'true');

let lifeExpectancyYears = 100;
const EXPECTANCY_SOURCE = 'World Bank (global)';
let lifeExpectancyLastUpdate = null;
const MAX_YEARS_DISPLAYED = 123;
const WEEKS_PER_YEAR = 52;
let currentYearsDisplayed = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function possessiveName() {
  if (!nameInput) return null;
  const trimmed = nameInput.value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('s') ? `${trimmed}'` : `${trimmed}'s`;
}

function gradientForHour(hour) {
  if (hour >= 6 && hour <= 10) {
    return ['#fff3d9', '#ffe3bf', '#ffd3c4', '#f4c1d8', '#c7c6f5']; // sunrise hues
  }
  if (hour >= 11 && hour <= 16) {
    return ['#fff7d6', '#eef7ff', '#dbf0ff', '#c7e7ff', '#b6ddff']; // midday bright
  }
  if (hour >= 17 && hour <= 21) {
    return ['#fde2c8', '#f9c2b7', '#f4a6c6', '#d9a0d9', '#9e9be0']; // dusk tones
  }
  return ['#0b1026', '#111a38', '#132143', '#0d2b50', '#0b3058']; // night
}

function applyGradient(colors) {
  const body = document.body;
  const stops = [
    `${colors[0]} 0`,
    `${colors[1]} 25%`,
    `${colors[2]} 50%`,
    `${colors[3]} 75%`,
    `${colors[4]} 100%`,
  ];
  body.style.backgroundImage = `radial-gradient(circle at 20% 20%, ${stops.join(', ')})`;
}

function parseDob(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept native date input value (yyyy-mm-dd), yyyy/mm/dd, and mm/dd/yyyy fallback for browsers
  // that render type=date as text.
  const normalized = trimmed.replace(/\//g, '-');
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  }

  const mdyMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      date.setHours(0, 0, 0, 0);
      return date;
    }
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

function updateClock(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const totalMinutes = clamped * 24 * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;

  hourHand.style.transform = `translate(-50%, 0) rotate(${hourAngle}deg)`;
  minuteHand.style.transform = `translate(-50%, 0) rotate(${minuteAngle}deg)`;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  clockReadout.textContent = `${hh}:${mm}`;
  const updateNote = lifeExpectancyLastUpdate ? `, last update: ${lifeExpectancyLastUpdate}` : '';
  clockCaption.textContent = `Clock based on an average life expectancy of ${lifeExpectancyYears} years (${EXPECTANCY_SOURCE}${updateNote}).`;
  clockPanel.hidden = false;
  clockPanel.classList.add('is-visible');

  applyGradient(gradientForHour(hours));
}

function flipFormShell(enableResults) {
  if (!formShell) return;
  const currentlyHasResults = document.body.classList.contains('has-results');
  if (enableResults === currentlyHasResults) return;

  const firstRect = formShell.getBoundingClientRect();
  document.body.classList.toggle('has-results', enableResults);
  const lastRect = formShell.getBoundingClientRect();
  const deltaY = firstRect.top - lastRect.top;

  formShell.style.transition = 'none';
  formShell.style.transform = `translateY(${deltaY}px)`;
  requestAnimationFrame(() => {
    formShell.style.transition = '';
    formShell.style.transform = 'translateY(0)';
  });
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
    weeksLivedHeading.textContent = `${weeksLived.toLocaleString()} weeks lived`;
  }
  updateNameHeadings();
}

function hideTooltip() {
  if (weekTooltip) {
    weekTooltip.hidden = true;
  }
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
  renderFromDob(dobInput.value);
});

function renderFromDob(value) {
  const nameValue = nameInput.value.trim();
  if (!nameValue) {
    nameInput.setCustomValidity('Please enter your name.');
    nameInput.reportValidity();
    return;
  }
  nameInput.setCustomValidity('');
  if (!value) {
    dobInput.focus();
    hideVisuals();
    return;
  }
  dobInput.setCustomValidity('');
  const parsed = parseDob(value);
  if (!parsed) {
    dobInput.setCustomValidity('Please enter your date as yyyy/mm/dd (or mm/dd/yyyy on unsupported browsers) or pick from the calendar.');
    dobInput.reportValidity();
    return;
  }
  if (parsed > today) {
    dobInput.setCustomValidity('Date of birth cannot be in the future.');
    dobInput.reportValidity();
    return;
  }
  if (parsed < minAllowedDate) {
    dobInput.setCustomValidity(`Please enter a birth year of ${minAllowedYear} or later (123-year limit, based on the longest verified lifespan).`);
    dobInput.reportValidity();
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

dobInput.addEventListener('input', () => {
  if (!dobInput.value) {
    hideVisuals();
  }
});

if (nameInput) {
  nameInput.addEventListener('input', () => {
    nameInput.setCustomValidity('');
    updateNameHeadings();
  });
}

if (printBtn) {
  printBtn.addEventListener('click', () => {
    window.print();
  });
}

window.addEventListener('resize', () => {
  if (document.body.classList.contains('has-results')) {
    flipFormShell(true);
  }
});

updateNameHeadings();

fetchLifeExpectancy();
