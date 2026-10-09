const defaultProject = {
  name: 'Morning regional',
  trainName: 'RG 201',
  stations: [
    { id: 'northport', name: 'Northport', distance: 0, speed: 100 },
    { id: 'pine-junction', name: 'Pine Junction', distance: 8.4, speed: 120 },
    { id: 'riverside', name: 'Riverside', distance: 17.2, speed: 100 },
    { id: 'old-mill', name: 'Old Mill', distance: 25.9, speed: 80 },
    { id: 'hillcrest', name: 'Hillcrest', distance: 34.6, speed: 100 },
    { id: 'eastvale', name: 'Eastvale', distance: 42.8, speed: 0 },
  ],
  timetable: [
    { arrival: '06:40', departure: '06:40', run: 0, dwell: 0 },
    { arrival: '06:49', run: 9, dwell: 1 },
    { arrival: '06:58', run: 8, dwell: 1 },
    { arrival: '07:08', run: 9, dwell: 2 },
    { arrival: '07:20', run: 10, dwell: 1 },
    { arrival: '07:30', run: 9, dwell: 0 },
  ],
};

let project = loadProject();
let activeTab = 'infrastructure';
let graphScale = 60;
let saveTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadProject() {
  try {
    const saved = localStorage.getItem('railgraph-project');
    if (!saved) return clone(defaultProject);
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return clone(defaultProject);
    return {
      ...clone(defaultProject),
      ...parsed,
      stations: Array.isArray(parsed.stations) && parsed.stations.length > 0
        ? parsed.stations
        : clone(defaultProject.stations),
      timetable: Array.isArray(parsed.timetable) && parsed.timetable.length > 0
        ? parsed.timetable.map(({ arrival, departure, run, dwell }) => ({
          arrival,
          ...(departure ? { departure } : {}),
          run,
          dwell,
        }))
        : clone(defaultProject.timetable),
    };
  } catch (error) {
    console.warn('Could not load the saved project.', error);
  }
  return clone(defaultProject);
}

function saveProject() {
  clearTimeout(saveTimer);
  $('#save-status').textContent = 'Saving…';
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('railgraph-project', JSON.stringify(project));
      $('#save-status').textContent = 'Saved locally';
    } catch (error) {
      $('#save-status').textContent = 'Could not save';
      console.warn('Could not save the project.', error);
    }
  }, 260);
}

function formatNumber(number) {
  return Number(number).toFixed(1).replace('.0', '');
}

function parseTime(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function formatTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function durationLabel(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

function distanceLabel(number) {
  return `${formatNumber(number)} km`;
}

function recalculateTimetable(startIndex = 0) {
  if (!project.timetable.length) return;
  const safeStartIndex = Math.max(0, Math.min(startIndex, project.stations.length - 1));
  let current = parseTime(project.timetable[safeStartIndex]?.arrival || project.timetable[0]?.arrival || '06:40');
  for (let index = safeStartIndex; index < project.stations.length; index += 1) {
    const row = project.timetable[index] || { arrival: formatTime(current), run: estimateRunningTime(index), dwell: 0 };
    if (index === safeStartIndex) current = index === 0
      ? parseTime(row.departure || row.arrival || formatTime(current))
      : parseTime(row.arrival || formatTime(current));
    row.run = index === 0 ? 0 : Math.max(1, Number(row.run) || estimateRunningTime(index));
    row.dwell = index === 0 || index === project.stations.length - 1
      ? 0
      : Number.isFinite(Number(row.dwell)) ? Math.max(0, Number(row.dwell)) : 0;
    row.arrival = index === 0 && row.departure
      ? formatTime(parseTime(row.departure) - row.dwell)
      : formatTime(current);
    if (index === 0) row.departure = formatTime(parseTime(row.arrival) + row.dwell);
    project.timetable[index] = row;
    if (index < project.stations.length - 1) {
      const nextRow = project.timetable[index + 1] || { arrival: formatTime(current), run: estimateRunningTime(index + 1), dwell: 0 };
      project.timetable[index + 1] = nextRow;
      current += row.dwell + Math.max(1, Number(nextRow.run) || estimateRunningTime(index + 1));
    }
  }
  project.timetable.length = project.stations.length;
}

function estimateRunningTime(index) {
  if (index <= 0 || !project.stations[index] || !project.stations[index - 1]) return 1;
  const distance = Math.max(0, project.stations[index].distance - project.stations[index - 1].distance);
  const speed = project.stations[index - 1].speed || 80;
  return Math.max(1, Math.ceil((distance / Math.max(1, speed)) * 60));
}

function renderShell() {
  const first = project.stations[0];
  const last = project.stations[project.stations.length - 1];
  const totalDistance = last ? last.distance : 0;
  if ($('#sidebar-project-name')) $('#sidebar-project-name').textContent = project.name;
  if ($('#sidebar-project-meta')) $('#sidebar-project-meta').textContent = `${project.stations.length} stations · ${formatNumber(totalDistance)} km`;
  if ($('#route-label')) $('#route-label').innerHTML = `${first?.name || 'Origin'} <b>→</b> ${last?.name || 'Destination'}`;
  if ($('#project-breadcrumb')) $('#project-breadcrumb').textContent = project.name;
  if ($('#train-name')) $('#train-name').value = project.trainName;
  if ($('#graph-train-name')) $('#graph-train-name').textContent = project.trainName;
  if ($('#legend-train-name')) $('#legend-train-name').textContent = project.trainName;
}

function renderInfrastructure() {
  if (!$('#station-list')) return;
  const totalDistance = project.stations.at(-1)?.distance || 0;
  const speeds = project.stations.slice(0, -1).map((station) => station.speed).filter(Boolean);
  $('#infrastructure-stats').innerHTML = `
    <div class="stat-card"><span class="stat-label">TOTAL DISTANCE</span><span class="stat-value">${formatNumber(totalDistance)} <small class="field-unit">KM</small></span></div>
    <div class="stat-card"><span class="stat-label">SECTIONS</span><span class="stat-value">${Math.max(0, project.stations.length - 1)} <small class="field-unit">SECTIONS</small></span></div>
    <div class="stat-card"><span class="stat-label">HIGHEST LINE SPEED</span><span class="stat-value stat-accent">${speeds.length ? Math.max(...speeds) : 0} <small class="field-unit">KM/H</small></span></div>
  `;
  $('#station-list').innerHTML = project.stations.map((station, index) => {
    const isLast = index === project.stations.length - 1;
    const nextStation = project.stations[index + 1];
    const sectionLength = nextStation ? Math.max(0, nextStation.distance - station.distance) : 0;
    const sectionName = station.sectionName || `${station.name} — ${nextStation?.name || 'Section'}`;
    return `
      <div class="station-row" data-station-id="${station.id}">
        <span class="order-number">${String(index + 1).padStart(2, '0')}</span>
        <div class="station-main">
          <span class="station-marker"></span>
          <div>
            <input class="station-name-input" data-field="name" value="${escapeAttribute(station.name)}" aria-label="Station ${index + 1} name" />
            <div class="station-subtitle">${index === 0 ? 'Origin station' : isLast ? 'Terminal station' : `Station ${String(index).padStart(2, '0')}`}</div>
          </div>
        </div>
        <div class="field-with-unit station-distance">${index === 0
          ? '<span class="field-unit">—</span>'
          : `<input class="inline-input" data-field="distance" type="number" min="0" step="0.1" value="${station.distance}" aria-label="${station.name} distance" /><span class="field-unit">KM</span>`}</div>
        <button class="delete-button" data-action="delete-station" aria-label="Delete ${station.name}" ${project.stations.length <= 2 ? 'disabled' : ''}>×</button>
      </div>
      ${!isLast ? `
        <div class="section-row" data-station-id="${station.id}">
          <span class="section-connector"></span>
          <div class="section-details">
            <input class="section-name-input" data-field="sectionName" value="${escapeAttribute(sectionName)}" aria-label="Section between ${station.name} and ${nextStation.name}" />
            <div class="section-metrics">
              <span class="section-metric"><span class="metric-label">LENGTH</span><strong>${formatNumber(sectionLength)}</strong><span class="field-unit">KM</span></span>
              <span class="section-metric"><span class="metric-label">SPEED</span><input class="inline-input speed-input" data-field="speed" type="number" min="1" step="5" value="${station.speed || 0}" aria-label="${sectionName} speed" /><span class="field-unit">KM/H</span></span>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }).join('');
  $('#station-count').textContent = `${project.stations.length} STATIONS`;
}

function getTimetableRows() {
  recalculateTimetable();
  return project.stations.map((station, index) => {
    const row = project.timetable[index];
    const departure = formatTime(parseTime(row.arrival) + Number(row.dwell || 0));
    return { station, row, departure };
  });
}

function renderTimetable() {
  if (!$('#timetable-list')) return;
  const rows = getTimetableRows();
  const start = rows[0];
  const end = rows.at(-1);
  const journey = end && start ? parseTime(end.row.arrival) - parseTime(start.row.arrival) : 0;
  const dwellTotal = rows.slice(1, -1).reduce((sum, item) => sum + Number(item.row.dwell || 0), 0);
  
  $('#timetable-summary').innerHTML = `
    <div class="summary-item">
      <span class="summary-label">DEPARTURE</span>
      <input class="time-field teal" data-field="global-departure" type="time" value="${start?.departure || '06:40'}" aria-label="Origin departure time" style="font-weight: 600; font-size: 1rem; background: rgba(13, 159, 145, 0.1); border: 1px solid rgba(13, 159, 145, 0.3); border-radius: 6px; color: var(--teal, #0d9f91); padding: 4px 12px; text-align: center; outline: none; cursor: pointer; width: auto;" />
    </div>
    <span class="summary-divider"></span>
    <div class="summary-item"><span class="summary-label">ARRIVAL</span><span class="summary-value">${end?.row.arrival || '—'}</span></div>
    <span class="summary-divider"></span>
    <div class="summary-item"><span class="summary-label">JOURNEY TIME</span><span class="summary-value">${durationLabel(journey)}</span></div>
    <span class="summary-divider"></span>
    <div class="summary-item"><span class="summary-label">TOTAL DWELL</span><span class="summary-value">${dwellTotal} min</span></div>
  `;

  $('#timetable-list').innerHTML = rows.map(({ station, row, departure }, index) => `
    <div class="timetable-row" data-row-index="${index}">
      <div class="stop-cell"><span class="stop-dot"></span><div><div class="stop-name">${escapeHtml(station.name)}</div><div class="stop-role">${index === 0 ? 'ORIGIN' : index === rows.length - 1 ? 'TERMINAL' : `STOP ${String(index).padStart(2, '0')}`}</div></div></div>
      <span class="time-cell"><strong>${index === 0 ? '—' : row.arrival}</strong></span>
      <span class="time-cell"><strong class="${index === 0 ? 'teal' : ''}">${index === rows.length - 1 ? '—' : departure}</strong></span>
      <div class="field-with-unit">${index === 0 || index === rows.length - 1 ? '<span class="field-unit">—</span>' : `<input class="time-field" data-field="running" type="number" min="1" step="1" value="${runningTimeFor(index)}" aria-label="Running time to ${station.name}" /> <span class="field-unit">min</span>`}</div>
      <div class="field-with-unit">${index === 0 || index === rows.length - 1 ? '<span class="field-unit">—</span>' : `<input class="time-field" data-field="dwell" type="number" min="0" step="1" value="${row.dwell}" aria-label="Dwell at ${station.name}" /> <span class="field-unit">min</span>`}</div>
    </div>
  `).join('');
  $('#timetable-count').textContent = `${rows.length} STOPS`;
}

function runningTimeFor(index) {
  if (index === 0 || !project.timetable[index]) return 0;
  return Math.max(1, Number(project.timetable[index].run) || estimateRunningTime(index));
}

function renderGraph() {
  if (!$('#train-chart')) return;
  const rows = getTimetableRows();
  const first = project.stations[0];
  const last = project.stations.at(-1);
  $('#graph-origin').textContent = first?.name || '—';
  $('#graph-destination').textContent = last?.name || '—';
  $('#graph-departure').textContent = rows[0]?.departure || '—';
  $('#graph-journey').textContent = rows.length > 1 ? durationLabel(parseTime(rows.at(-1).row.arrival) - parseTime(rows[0].departure)) : '—';
  const svg = $('#train-chart');
  if (project.stations.length < 2) {
    svg.innerHTML = '';
    $('#chart-empty').hidden = false;
    return;
  }
  $('#chart-empty').hidden = true;
  const width = 1050;
  const height = 420;
  const margin = { top: 25, right: 30, bottom: 43, left: 116 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const startMinutes = parseTime(rows[0].departure);
  const finishMinutes = parseTime(rows.at(-1).row.arrival) + 10;
  const totalMinutes = finishMinutes - startMinutes;
  const gridStep = graphScale;
  const x = (time) => margin.left + ((time - startMinutes) / totalMinutes) * plotWidth;
  const y = (distance) => margin.top + plotHeight - (distance / Math.max(1, last.distance)) * plotHeight;
  const parts = [];

  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`);
  for (let minute = 0; minute <= totalMinutes; minute += gridStep) {
    const current = startMinutes + minute;
    const xPosition = x(current);
    parts.push(`<line x1="${xPosition}" y1="${margin.top}" x2="${xPosition}" y2="${margin.top + plotHeight}" stroke="#edf0f4" stroke-width="1"/>`);
    parts.push(`<text x="${xPosition}" y="${height - 16}" text-anchor="middle" fill="#a4afbc" font-family="DM Mono" font-size="10">${formatTime(current)}</text>`);
  }
  project.stations.forEach((station) => {
    const yPosition = y(station.distance);
    parts.push(`<line x1="${margin.left}" y1="${yPosition}" x2="${width - margin.right}" y2="${yPosition}" stroke="#edf0f4" stroke-width="1"/>`);
    parts.push(`<circle cx="${margin.left - 12}" cy="${yPosition}" r="4" fill="#fff" stroke="#0d9f91" stroke-width="2"/>`);
    parts.push(`<text x="${margin.left - 24}" y="${yPosition + 4}" text-anchor="end" fill="#667489" font-family="Manrope" font-size="11" font-weight="600">${escapeHtml(station.name)}</text>`);
    parts.push(`<text x="${width - margin.right + 10}" y="${yPosition + 4}" fill="#a6afbb" font-family="DM Mono" font-size="9">${formatNumber(station.distance)} km</text>`);
  });
  const trajectoryPoints = [];
  rows.forEach(({ station, row, departure }) => {
    trajectoryPoints.push(`${x(parseTime(station === project.stations[0] ? departure : row.arrival))},${y(station.distance)}`);
    trajectoryPoints.push(`${x(parseTime(departure))},${y(station.distance)}`);
  });
  const points = trajectoryPoints.join(' ');
  parts.push(`<polyline points="${points}" fill="none" stroke="#ef865b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
  rows.forEach(({ station, row, departure }) => {
    const arrivalX = x(parseTime(station === project.stations[0] ? departure : row.arrival));
    const departureX = x(parseTime(departure));
    const stationY = y(station.distance);
    if (departureX - arrivalX > 1) parts.push(`<line x1="${arrivalX}" y1="${stationY}" x2="${departureX}" y2="${stationY}" stroke="#efb19b" stroke-width="5" stroke-linecap="round"/>`);
    parts.push(`<circle cx="${arrivalX}" cy="${stationY}" r="5" fill="#fff" stroke="#ef865b" stroke-width="2.5"/>`);
  });
  parts.push(`<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#cfd6df" stroke-width="1"/>`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.innerHTML = parts.join('');
}

function renderAll() {
  renderShell();
  renderInfrastructure();
  renderTimetable();
  renderGraph();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function setTab(tabName) {
  activeTab = tabName;
  $$('.tab, .nav-item').forEach((button) => {
    const isActive = button.dataset.tabTarget === tabName;
    button.classList.toggle('active', isActive);
    if (button.classList.contains('tab')) button.setAttribute('aria-selected', String(isActive));
  });
  $$('.tab-panel').forEach((panel) => {
    const isActive = panel.id === `panel-${tabName}`;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
  if (tabName === 'graph') renderGraph();
}

function addStation() {
  const terminalIndex = project.stations.length - 1;
  const previousStation = project.stations[Math.max(0, terminalIndex - 1)];
  const previousRow = project.timetable[Math.max(0, terminalIndex - 1)];
  const distance = Number((project.stations.at(-1).distance - 7.5).toFixed(1));
  const run = 6;
  const newStation = { id: `station-${Date.now()}`, name: 'New station', distance: Math.max(previousStation.distance + 0.1, distance), speed: 100 };
  project.stations.splice(terminalIndex, 0, newStation);
  project.timetable.splice(terminalIndex, 0, {
    arrival: formatTime(parseTime(previousRow.arrival) + Number(previousRow.dwell || 0) + run),
    run,
    dwell: 1,
  });
  recalculateTimetable(terminalIndex);
  renderAll();
  saveProject();
  if ($('.tab-panel')) setTab('infrastructure');
  const newInput = $(`[data-station-id="${project.stations.at(-2).id}"] [data-field="name"]`);
  newInput?.focus();
  newInput?.select();
}

function deleteStation(id) {
  if (project.stations.length <= 2) return;
  const index = project.stations.findIndex((station) => station.id === id);
  if (index < 0) return;
  project.stations.splice(index, 1);
  project.timetable.splice(index, 1);
  renderAll();
  saveProject();
}

function reverseRoute() {
  const reversedStations = project.stations.slice().reverse();
  const oldRows = getTimetableRows().slice().reverse();
  project.stations = reversedStations.map((station, index) => ({
    ...station,
    distance: Number((reversedStations[0].distance - station.distance).toFixed(1)),
    speed: index === 0 || index === reversedStations.length - 1 ? 0 : station.speed,
    sectionName: index < reversedStations.length - 1 ? reversedStations[index + 1].sectionName : undefined,
  }));
  project.timetable = oldRows.map(({ row }) => ({ ...row, arrival: row.arrival })).reverse();
  project.timetable[0].arrival = oldRows.at(-1).row.arrival;
  recalculateTimetable();
  renderAll();
  saveProject();
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab-target]');
  if (tab) setTab(tab.dataset.tabTarget);
  const deleteButton = event.target.closest('[data-action="delete-station"]');
  if (deleteButton) deleteStation(deleteButton.closest('[data-station-id]').dataset.stationId);
});

$('#add-station')?.addEventListener('click', addStation);
$('#reverse-route')?.addEventListener('click', reverseRoute);

$('#station-list')?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-field]');
  if (!input) return;
  const row = input.closest('[data-station-id]');
  const station = project.stations.find((item) => item.id === row.dataset.stationId);
  const field = input.dataset.field;
  if (field === 'name') station.name = input.value.trim() || 'Unnamed station';
  else if (field === 'sectionName') station.sectionName = input.value.trim() || 'Unnamed section';
  else station[field] = Math.max(0, Number(input.value) || 0);
  project.stations = project.stations.map((item, index, stations) => index === 0 ? { ...item, distance: 0 } : index === stations.length - 1 ? { ...item, speed: 0 } : item);
  renderAll();
  saveProject();
});

$('#timetable-list')?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-field]');
  if (!input) return;
  const index = Number(input.closest('[data-row-index]').dataset.rowIndex);
  const field = input.dataset.field;
  if (field === 'dwell') {
    project.timetable[index].dwell = Math.max(0, Number(input.value) || 0);
    recalculateTimetable(index);
  } else if (field === 'departure') {
    project.timetable[index].departure = input.value;
    recalculateTimetable(index);
  } else if (field === 'running') {
    const previous = project.timetable[index - 1];
    project.timetable[index].run = Math.max(1, Number(input.value) || 1);
    project.timetable[index].arrival = formatTime(parseTime(previous.arrival) + Number(previous.dwell || 0) + project.timetable[index].run);
    recalculateTimetable(index);
  }
  renderAll();
  saveProject();
});

$('#timetable-summary')?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-field="global-departure"]');
  if (!input || !project.timetable.length) return;
  
  project.timetable[0].departure = input.value;
  recalculateTimetable(0);
  renderAll();
  saveProject();
});

$('#train-name')?.addEventListener('change', (event) => {
  project.trainName = event.target.value.trim() || 'RG 201';
  renderAll();
  saveProject();
});

$('#reset-project')?.addEventListener('click', () => {
  if (!window.confirm('Reset this project to the sample route?')) return;
  project = clone(defaultProject);
  renderAll();
  saveProject();
});

$('#export-project')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.trainName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-railgraph.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$$('.scale-button').forEach((button) => button.addEventListener('click', () => {
  graphScale = Number(button.dataset.scale);
  $$('.scale-button').forEach((item) => item.classList.toggle('active', item === button));
  renderGraph();
}));

$('#download-svg')?.addEventListener('click', () => {
  const svg = $('#train-chart');
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.trainName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-graph.svg`;
  link.click();
  URL.revokeObjectURL(url);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveProject();
  }
});

window.addEventListener('storage', (event) => {
  if (event.key !== 'railgraph-project') return;
  project = loadProject();
  renderAll();
});

renderAll();
