import {
  createEstimatedTimetable as createEstimatedTimetablePure,
  durationLabel,
  estimateRunningTime as estimateRunningTimePure,
  formatTime,
  parseTime,
  recalculateTimetable as recalculateTimetablePure,
} from './src/timetable.js';
import { loadProject as loadStoredProject } from './src/project-store.js';

const defaultProject = {
  name: 'Morning regional',
  trains: [{
    id: 'rg-201',
    name: 'RG 201',
    timetable: [
      { arrival: '06:40', departure: '06:40', run: 0, dwell: 0 },
      { arrival: '06:49', run: 9, dwell: 1 },
      { arrival: '06:58', run: 8, dwell: 1 },
      { arrival: '07:08', run: 9, dwell: 2 },
      { arrival: '07:20', run: 10, dwell: 1 },
      { arrival: '07:30', run: 9, dwell: 0 },
    ],
  }],
  stations: [
    { id: 'northport', name: 'Northport', distance: 0, speed: 100, tracks: 2 },
    { id: 'pine-junction', name: 'Pine Junction', distance: 8.4, speed: 120, tracks: 2 },
    { id: 'riverside', name: 'Riverside', distance: 17.2, speed: 100, tracks: 2 },
    { id: 'old-mill', name: 'Old Mill', distance: 25.9, speed: 80, tracks: 2 },
    { id: 'hillcrest', name: 'Hillcrest', distance: 34.6, speed: 100, tracks: 2 },
    { id: 'eastvale', name: 'Eastvale', distance: 42.8, speed: 0, tracks: 2 },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

let project = clone(defaultProject);
let selectedTrainId = localStorage.getItem('railgraph-selected-train');
let activeTab = 'infrastructure';
let saveTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function loadProject() {
  const requestedLineId = new URLSearchParams(window.location.search).get('line');
  const lineId = requestedLineId || localStorage.getItem('railgraph-line-id');
  if (lineId || window.location.protocol.startsWith('http')) {
    try {
      const response = await fetch(lineId ? `/api/lines/${encodeURIComponent(lineId)}` : '/api/lines');
      if (!response.ok) throw new Error(`Could not load line (${response.status})`);
      const data = await response.json();
      const loaded = lineId ? data : data[Object.keys(data)[0]];
      if (loaded) {
        if (lineId) localStorage.setItem('railgraph-line-id', lineId);
        return normalizeLoadedProject(loaded);
      }
    } catch (error) {
      console.warn('Could not load the project from the lines folder.', error);
      if (lineId) return clone(defaultProject);
    }
  }
  return loadStoredProject(localStorage, 'railgraph-project', defaultProject, clone);
}

function normalizeLoadedProject(value) {
  return loadStoredProject(
    { getItem: () => JSON.stringify(value) },
    'project',
    defaultProject,
    clone,
  );
}

function activeTrain() {
  return project.trains.find((train) => train.id === selectedTrainId) || project.trains[0];
}

function selectTrain(id) {
  selectedTrainId = id;
  if (id) localStorage.setItem('railgraph-selected-train', id);
}

function createEstimatedTimetable(startTime = '06:40') {
  return createEstimatedTimetablePure(project.stations, estimateRunningTimePure, startTime);
}

function saveProject() {
  clearTimeout(saveTimer);
  $('#save-status').textContent = 'Saving…';
  saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem('railgraph-project', JSON.stringify(project));
      const lineId = localStorage.getItem('railgraph-line-id');
      if (lineId && window.location.protocol.startsWith('http')) {
        const response = await fetch(`/api/lines/${encodeURIComponent(lineId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(project),
        });
        if (!response.ok) throw new Error(`Could not save line (${response.status})`);
        $('#save-status').textContent = 'Saved to lines';
      } else {
        $('#save-status').textContent = 'Saved locally';
      }
      } catch (error) {
        $('#save-status').textContent = 'Could not save';
        console.warn('Could not save the project.', error);
      }
  }, 260);
}

function formatNumber(number) {
  return Number(number).toFixed(1).replace('.0', '');
}

function distanceLabel(number) {
  return `${formatNumber(number)} km`;
}

function recalculateTimetable(startIndex = 0) {
  const train = activeTrain();
  if (!train) return;
  recalculateTimetablePure(getTrainCalculationStations(train), train.timetable, startIndex, estimateRunningTimePure);
}

function estimateRunningTime(index) {
  return estimateRunningTimePure(getTrainCalculationStations(activeTrain()), index);
}

function getTrainStations(train) {
  if (!train || train.direction !== -1) return project.stations;
  return project.stations.slice().reverse();
}

function getTrainCalculationStations(train) {
  const stations = getTrainStations(train);
  if (!train || train.direction !== -1) return stations;
  const maxDistance = project.stations.at(-1)?.distance || 0;
  return stations.map((station, index) => ({
    ...station,
    distance: maxDistance - station.distance,
    speed: index === stations.length - 1 ? 0 : stations[index + 1].speed,
  }));
}

function renderShell() {
  const first = project.stations[0];
  const last = project.stations[project.stations.length - 1];
  const totalDistance = last ? last.distance : 0;
  if ($('#sidebar-project-name')) $('#sidebar-project-name').textContent = project.name;
  if ($('#sidebar-project-meta')) $('#sidebar-project-meta').textContent = `${project.stations.length} stations · ${formatNumber(totalDistance)} km`;
  if ($('#route-label')) $('#route-label').innerHTML = `${first?.name || 'Origin'} <b>→</b> ${last?.name || 'Destination'}`;
  if ($('#project-breadcrumb')) $('#project-breadcrumb').textContent = project.name;
  const train = activeTrain();
  if ($('#train-name')) $('#train-name').value = train?.name || '';
  if ($('#graph-train-name')) $('#graph-train-name').textContent = project.trains.length > 1 ? 'all trains' : train?.name || '—';
  if ($('#legend-train-name')) $('#legend-train-name').textContent = train?.name || '—';
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
          <div>
            <input class="station-name-input" data-field="name" value="${escapeAttribute(station.name)}" aria-label="Station ${index + 1} name" />
          </div>
        </div>
        <div class="field-with-unit station-distance">${index === 0
          ? '<span class="field-unit">—</span>'
          : `<input class="inline-input" data-field="distance" type="number" min="0" step="0.1" value="${station.distance}" aria-label="${station.name} distance" /><span class="field-unit">KM</span>`}</div>
        <div class="field-with-unit station-tracks"><input class="inline-input tracks-input" data-field="tracks" type="number" min="1" max="4" step="1" value="${station.tracks || 2}" aria-label="${station.name} number of platforms" /><span class="field-unit">PLATFORMS</span></div>
        <button class="delete-button" data-action="delete-station" aria-label="Delete ${station.name}" ${project.stations.length <= 2 ? 'disabled' : ''}>×</button>
      </div>
      ${!isLast ? `
        <div class="section-row" data-station-id="${station.id}">
          <div class="section-details">
            <span class="section-name">${escapeHtml(sectionName)}</span>
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
  return getTimetableRowsForTrain(activeTrain());
}

function getTimetableRowsForTrain(train) {
  if (!train) return [];
  const timetable = train.timetable || [];
  recalculateTimetablePure(getTrainCalculationStations(train), timetable, 0, estimateRunningTimePure);
  return getTrainStations(train).map((station, index) => {
    const row = timetable[index];
    const departure = formatTime(parseTime(row.arrival) + Number(row.dwell || 0));
    return { station, row, departure };
  });
}

function renderTrainList() {
  if (!$('#train-list')) return;
  $('#train-list').innerHTML = project.trains.map((train) => {
    const timetable = train.timetable || [];
    const departure = timetable[0]?.departure || timetable[0]?.arrival || '—';
    const arrival = timetable.at(-1)?.arrival || '—';
    const origin = train.direction === -1 ? project.stations.at(-1)?.name : project.stations[0]?.name;
    const destination = train.direction === -1 ? project.stations[0]?.name : project.stations.at(-1)?.name;
    const selected = train.id === selectedTrainId;
    return `
      <div class="train-card${selected ? ' selected' : ''}" data-train-id="${escapeAttribute(train.id)}">
        <button class="train-card-main" data-action="select-train" aria-pressed="${selected}">
          <span class="train-card-code">${escapeHtml(train.name)}</span>
          <span class="train-card-route">${escapeHtml(origin || 'Origin')} → ${escapeHtml(destination || 'Destination')}</span>
          <span class="train-card-meta">${departure} departure · ${arrival} arrival</span>
        </button>
        <button class="train-card-delete" data-action="delete-train" aria-label="Delete ${escapeAttribute(train.name)}">×</button>
      </div>
    `;
  }).join('');
  $('#train-count').textContent = `${project.trains.length} TRAINS`;
}

function renderTimetable() {
  if (!$('#timetable-list')) return;
  renderTrainList();
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
      <div class="stop-cell"><span class="stop-dot"></span><div><div class="stop-name">${escapeHtml(station.name)}</div></div></div>
      <span class="time-cell"><strong>${index === 0 ? '—' : row.arrival}</strong></span>
      <span class="time-cell"><strong class="${index === 0 ? 'teal' : ''}">${index === rows.length - 1 ? '—' : departure}</strong></span>
      <div class="field-with-unit">${index === 0 || index === rows.length - 1 ? '<span class="field-unit">—</span>' : `<input class="time-field" data-field="running" type="number" min="1" step="1" value="${runningTimeFor(index)}" aria-label="Running time to ${station.name}" /> <span class="field-unit">min</span>`}</div>
      <div class="field-with-unit">${index === 0 || index === rows.length - 1 ? '<span class="field-unit">—</span>' : `<input class="time-field" data-field="dwell" type="number" min="0" step="1" value="${row.dwell}" aria-label="Dwell at ${station.name}" /> <span class="field-unit">min</span>`}</div>
      <select class="time-field stop-input" data-field="stop" aria-label="${station.name} stop value">
        <option value="1" ${row.stop === 0 ? '' : 'selected'}>Yes</option>
        <option value="0" ${row.stop === 0 ? 'selected' : ''}>No</option>
      </select>
    </div>
  `).join('');
  $('#timetable-count').textContent = `${rows.length} STOPS`;
}

function runningTimeFor(index) {
  const timetable = activeTrain()?.timetable || [];
  if (index === 0 || !timetable[index]) return 0;
  return Math.max(1, Number(timetable[index].run) || estimateRunningTime(index));
}

function renderGraph() {
  if (!$('#train-chart')) return;
  const first = project.stations[0];
  const last = project.stations.at(-1);
  const trainRows = project.trains.map((train) => ({ train, rows: getTimetableRowsForTrain(train) }));
  const allRows = trainRows.flatMap(({ rows }) => rows);
  if ($('#graph-origin')) $('#graph-origin').textContent = first?.name || '—';
  if ($('#graph-destination')) $('#graph-destination').textContent = last?.name || '—';
  if ($('#graph-departure')) $('#graph-departure').textContent = project.trains.length > 1 ? 'MULTIPLE' : allRows[0]?.departure || '—';
  if ($('#graph-journey')) $('#graph-journey').textContent = project.trains.length > 1 ? 'MULTIPLE' : allRows.length > 1 ? durationLabel(parseTime(allRows.at(-1).row.arrival) - parseTime(allRows[0].departure)) : '—';
  if ($('#graph-legend')) {
    const colors = ['#ef865b', '#4d82c4', '#9b68b0', '#d49a32', '#2f9b78', '#d45c79'];
    $('#graph-legend').innerHTML = trainRows.map(({ train }, index) => `
      <span class="legend-train"><span class="legend-line" style="background:${colors[index % colors.length]}"></span>${escapeHtml(train.name)}</span>
    `).join('') + '<span class="legend-stations"><span class="legend-dot"></span>Stations</span>';
  }
  const svg = $('#train-chart');
  if (project.stations.length < 2) {
    svg.innerHTML = '';
    $('#chart-empty').hidden = false;
    return;
  }
  $('#chart-empty').hidden = true;
  const width = 1400;
  const height = 520;
  const margin = { top: 25, right: 30, bottom: 43, left: 116 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const earliestMinutes = Math.min(...trainRows.map(({ rows }) => parseTime(rows[0]?.departure || '06:40')));
  const latestMinutes = Math.max(...trainRows.map(({ rows }) => parseTime(rows.at(-1)?.row.arrival || '06:40')));
  const startMinutes = Math.floor(earliestMinutes / 60) * 60;
  const finishMinutes = Math.ceil(latestMinutes / 60) * 60;
  const totalMinutes = finishMinutes - startMinutes;
  const gridStep = 15;
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
    const platformCount = Math.min(4, Math.max(1, Math.round(Number(station.tracks) || 1))); // Limit to 4 platforms for visual clarity
    const platformSpacing = 4;
    for (let platformIndex = 0; platformIndex < platformCount; platformIndex += 1) {
      const platformOffset = (platformIndex - (platformCount - 1) / 2) * platformSpacing;
      parts.push(`<line x1="${margin.left}" y1="${yPosition + platformOffset}" x2="${width - margin.right}" y2="${yPosition + platformOffset}" stroke="#edf0f4" stroke-width="1"/>`);
    }
    parts.push(`<circle cx="${margin.left - 12}" cy="${yPosition}" r="4" fill="#fff" stroke="#0d9f91" stroke-width="2"/>`);
    parts.push(`<text x="${margin.left - 24}" y="${yPosition + 4}" text-anchor="end" fill="#667489" font-family="Manrope" font-size="11" font-weight="600">${escapeHtml(station.name)}</text>`);
  });
  const colors = ['#ef865b', '#4d82c4', '#9b68b0', '#d49a32', '#2f9b78', '#d45c79'];
  trainRows.forEach(({ rows }, trainIndex) => {
    const color = colors[trainIndex % colors.length];
    const trajectoryPoints = [];
    rows.forEach(({ station, row, departure }) => {
      trajectoryPoints.push(`${x(parseTime(station === project.stations[0] ? departure : row.arrival))},${y(station.distance)}`);
      trajectoryPoints.push(`${x(parseTime(departure))},${y(station.distance)}`);
    });
    parts.push(`<polyline points="${trajectoryPoints.join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
    rows.forEach(({ station, row, departure }) => {
      const arrivalX = x(parseTime(station === project.stations[0] ? departure : row.arrival));
      const departureX = x(parseTime(departure));
      const stationY = y(station.distance);
      if (departureX - arrivalX > 1) parts.push(`<line x1="${arrivalX}" y1="${stationY}" x2="${departureX}" y2="${stationY}" stroke="${color}" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`);
      if (row.stop !== 0) parts.push(`<circle cx="${arrivalX}" cy="${stationY}" r="4" fill="#fff" stroke="${color}" stroke-width="2"/>`);
    });
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
  const previousRows = activeTrain()?.timetable || [];
  const previousRow = previousRows[Math.max(0, terminalIndex - 1)];
  const distance = Number((project.stations.at(-1).distance - 7.5).toFixed(1));
  const run = 6;
  const newStation = { id: `station-${Date.now()}`, name: 'New station', distance: Math.max(previousStation.distance + 0.1, distance), speed: 100, tracks: previousStation.tracks || 2 };
  project.stations.splice(terminalIndex, 0, newStation);
  project.trains.forEach((train) => {
    const previousTrainRow = train.timetable[Math.max(0, terminalIndex - 1)] || previousRow;
    train.timetable.splice(terminalIndex, 0, {
      arrival: formatTime(parseTime(previousTrainRow.arrival) + Number(previousTrainRow.dwell || 0) + run),
      run,
      dwell: 1,
    });
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
  project.trains.forEach((train) => train.timetable.splice(index, 1));
  renderAll();
  saveProject();
}

function reverseTrainDirection() {
  const train = activeTrain();
  if (!train?.timetable?.length) return;
  const lastArrival = train.timetable.at(-1).arrival || '06:40';
  train.direction = train.direction === -1 ? 1 : -1;
  train.timetable = train.timetable.slice().reverse().map((row) => ({ ...row }));
  train.timetable[0].arrival = lastArrival;
  train.timetable[0].departure = lastArrival;
  recalculateTimetable();
  renderAll();
  saveProject();
}

function deleteTrain(id) {
  const index = project.trains.findIndex((train) => train.id === id);
  if (index < 0) return;
  const train = project.trains[index];
  if (!window.confirm(`Delete train "${train.name}"?`)) return;
  project.trains.splice(index, 1);
  if (!project.trains.length) {
    const replacement = {
      id: `train-${Date.now()}`,
      name: 'Train 1',
      direction: 1,
      timetable: createEstimatedTimetable(),
    };
    project.trains.push(replacement);
    selectTrain(replacement.id);
  } else if (selectedTrainId === id) {
    selectTrain(project.trains[index]?.id || project.trains.at(-1)?.id);
  }
  renderAll();
  saveProject();
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab-target]');
  if (tab) setTab(tab.dataset.tabTarget);
  const deleteButton = event.target.closest('[data-action="delete-station"]');
  if (deleteButton) deleteStation(deleteButton.closest('[data-station-id]').dataset.stationId);
  const trainButton = event.target.closest('[data-action="select-train"]');
  if (trainButton) {
    selectTrain(trainButton.closest('[data-train-id]').dataset.trainId);
    renderAll();
  }
  const deleteTrainButton = event.target.closest('[data-action="delete-train"]');
  if (deleteTrainButton) deleteTrain(deleteTrainButton.closest('[data-train-id]').dataset.trainId);
});

$('#add-station')?.addEventListener('click', addStation);
$('#reverse-route')?.addEventListener('click', reverseTrainDirection);
$('#add-train')?.addEventListener('click', () => {
  const id = `train-${Date.now()}`;
  const train = {
    id,
    name: `Train ${project.trains.length + 1}`,
    direction: 1,
    timetable: createEstimatedTimetable(),
  };
  project.trains.push(train);
  selectTrain(id);
  renderAll();
  saveProject();
  $('#train-name')?.focus();
  $('#train-name')?.select();
});

$('#station-list')?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-field]');
  if (!input) return;
  const row = input.closest('[data-station-id]');
  const station = project.stations.find((item) => item.id === row.dataset.stationId);
  const field = input.dataset.field;
  if (field === 'name') station.name = input.value.trim() || 'Unnamed station';
  else if (field === 'tracks') station[field] = Math.min(4, Math.max(1, Number(input.value) || 1));
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
  const timetable = activeTrain()?.timetable;
  if (!timetable) return;
  if (field === 'dwell') {
    timetable[index].dwell = Math.max(0, Number(input.value) || 0);
    recalculateTimetable(index);
  } else if (field === 'departure') {
    timetable[index].departure = input.value;
    recalculateTimetable(index);
  } else if (field === 'running') {
    const previous = timetable[index - 1];
    timetable[index].run = Math.max(1, Number(input.value) || 1);
    timetable[index].arrival = formatTime(parseTime(previous.arrival) + Number(previous.dwell || 0) + timetable[index].run);
    recalculateTimetable(index);
  } else if (field === 'stop') {
    timetable[index].stop = Number(input.value) === 0 ? 0 : 1;
  }
  renderAll();
  saveProject();
});

$('#timetable-summary')?.addEventListener('change', (event) => {
  const input = event.target.closest('[data-field="global-departure"]');
  const timetable = activeTrain()?.timetable;
  if (!input || !timetable?.length) return;
  
  timetable[0].departure = input.value;
  recalculateTimetable(0);
  renderAll();
  saveProject();
});

$('#train-name')?.addEventListener('change', (event) => {
  const train = activeTrain();
  if (!train) return;
  train.name = event.target.value.trim() || 'Unnamed train';
  renderAll();
  saveProject();
});

$('#reset-project')?.addEventListener('click', () => {
  if (!window.confirm('Reset this project to the sample route?')) return;
  project = clone(defaultProject);
  selectTrain(project.trains[0]?.id);
  renderAll();
  saveProject();
});

$('#export-project')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(activeTrain()?.name || 'railgraph').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-railgraph.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$('#download-svg')?.addEventListener('click', () => {
  const svg = $('#train-chart');
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(activeTrain()?.name || 'train').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-graph.svg`;
  link.click();
  URL.revokeObjectURL(url);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveProject();
  }
});

window.addEventListener('storage', async (event) => {
  if (event.key !== 'railgraph-project') return;
  project = await loadProject();
  selectTrain(project.trains.some((train) => train.id === selectedTrainId)
    ? selectedTrainId
    : project.trains[0]?.id);
  renderAll();
});

loadProject().then((loadedProject) => {
  project = loadedProject;
  if (!project.trains.some((train) => train.id === selectedTrainId)) selectedTrainId = project.trains[0]?.id;
  renderAll();
});
