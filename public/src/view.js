import { durationLabel, escapeHtml, formatNumber } from './utils.js';
import {
  calculateInfrastructureStats,
  calculateTimetableSummary,
  getTrainStations,
  projectTimetableRows,
} from './domain.js';
import { TRAIN_COLORS, buildTrainGraph } from './graph.js';

const WORKSPACE_VIEWS = Object.freeze([
  { id: 'infrastructure', icon: '▥', label: 'Infrastructure' },
  { id: 'timetable', icon: '◷', label: 'Timetable' },
  { id: 'graph', icon: '⌁', label: 'Train graph' },
]);

const renderErrorView = (message) => `
  <main class="error-view">
    <div class="brand">
      <div class="brand-mark"><span></span><span></span><span></span></div>
      <div><strong>RailGraph</strong><small>TRAIN GRAPH CREATOR</small></div>
    </div>
    <div class="eyebrow"><span class="eyebrow-line"></span> ERROR</div>
    <h1>Unable to load view</h1>
    <p>${escapeHtml(message)}</p>
    <a class="button button-primary" href="/" data-nav>Back to projects</a>
  </main>
`;

const renderLinePicker = (lines, loading) => `
  <main class="line-picker">
    <div class="brand">
      <div class="brand-mark"><span></span><span></span><span></span></div>
      <div><strong>RailGraph</strong><small>TRAIN GRAPH CREATOR</small></div>
    </div>
    <div class="line-picker-header">
      <div class="eyebrow"><span class="eyebrow-line"></span> PROJECTS</div>
      <h1>Choose a line</h1>
      <p>Select a line to open it in the workspace.</p>
    </div>
    ${loading
      ? '<div class="empty-state">Loading lines…</div>'
      : lines.length === 0
        ? '<div class="empty-state">No line files found in the lines directory.</div>'
        : `<div class="line-grid">${lines.map(({ id, project }) => {
          const distance = project.stations[project.stations.length - 1].distance;
          const href = `/?line=${encodeURIComponent(id)}&view=infrastructure`;
          return `
            <article class="line-card">
              <h2>${escapeHtml(project.name)}</h2>
              <p>Edit line infrastructure, train timetables, and the time–distance graph.</p>
              <div class="line-meta">
                <span>${project.stations.length} STATIONS</span>
                <span>${formatNumber(distance)} KM</span>
              </div>
              <a class="button button-primary" href="${href}" data-nav>Open line</a>
            </article>
          `;
        }).join('')}</div>`}
  </main>
`;

const renderInfrastructurePanel = (project) => {
  const stats = calculateInfrastructureStats(project.stations);
  const canDelete = project.stations.length > 2;

  const rowsMarkup = project.stations.map((station, index) => {
    const isFirst = index === 0;
    const isLast = index === project.stations.length - 1;
    const nextStation = project.stations[index + 1];
    const sectionLength = isLast ? 0 : Math.max(0, nextStation.distance - station.distance);
    const sectionName = isLast ? '' : `${station.name} — ${nextStation.name}`;

    return `
      <div class="station-row" data-station-id="${escapeHtml(station.id)}">
        <span class="order-number">${String(index + 1).padStart(2, '0')}</span>
        <input
          class="station-name-input"
          data-station-field="name"
          value="${escapeHtml(station.name)}"
          aria-label="Station ${index + 1} name"
        />
        <div class="field-with-unit">
          ${isFirst
            ? '<span class="field-unit">—</span>'
            : `<input
                class="inline-input"
                data-station-field="distance"
                type="number"
                min="0"
                step="0.1"
                value="${station.distance}"
                aria-label="${escapeHtml(station.name)} distance"
              /><span class="field-unit">KM</span>`}
        </div>
        <div class="field-with-unit">
          <input
            class="inline-input tracks-input"
            data-station-field="tracks"
            type="number"
            min="1"
            max="4"
            step="1"
            value="${station.tracks}"
            aria-label="${escapeHtml(station.name)} number of platforms"
          />
          <span class="field-unit">PLATFORMS</span>
        </div>
        <button
          class="delete-button"
          data-action="delete-station"
          aria-label="Delete ${escapeHtml(station.name)}"
          ${canDelete ? '' : 'disabled'}
        >×</button>
      </div>
      ${isLast ? '' : `
        <div class="section-row" data-station-id="${escapeHtml(station.id)}">
          <div class="section-details">
            <span class="section-name">${escapeHtml(sectionName)}</span>
            <div class="section-metrics">
              <span class="section-metric">
                <span class="metric-label">LENGTH</span>
                <strong>${formatNumber(sectionLength)}</strong>
                <span class="field-unit">KM</span>
              </span>
              <span class="section-metric">
                <span class="metric-label">SPEED</span>
                <input
                  class="inline-input speed-input"
                  data-station-field="speed"
                  type="number"
                  min="1"
                  step="5"
                  value="${station.speed}"
                  aria-label="${escapeHtml(sectionName)} speed"
                />
                <span class="field-unit">KM/H</span>
              </span>
            </div>
          </div>
        </div>
      `}
    `;
  }).join('');

  return `
    <section class="view-panel">
      <div class="section-intro">
        <div>
          <h2>Line infrastructure</h2>
          <p>Define the stations and operating limits along your route.</p>
        </div>
        <div class="section-actions">
          <span class="unit-hint">DISTANCE IN KM · SPEED IN KM/H</span>
          <button class="button button-secondary" data-action="add-station"><span>＋</span> Add station</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">TOTAL DISTANCE</span>
          <span class="stat-value">${formatNumber(stats.totalDistance)} <small class="field-unit">KM</small></span>
        </div>
        <div class="stat-card">
          <span class="stat-label">SECTIONS</span>
          <span class="stat-value">${stats.sectionCount} <small class="field-unit">SECTIONS</small></span>
        </div>
        <div class="stat-card">
          <span class="stat-label">HIGHEST LINE SPEED</span>
          <span class="stat-value stat-accent">${stats.maxSpeed} <small class="field-unit">KM/H</small></span>
        </div>
      </div>
      <div class="table-card infrastructure-card">
        <div class="table-header infrastructure-grid">
          <span>ORDER</span><span>ROUTE</span><span>KM FROM ORIGIN</span><span>PLATFORMS</span><span></span>
        </div>
        <div>${rowsMarkup}</div>
        <div class="table-footer">
          <span class="table-footer-note"><span class="info-icon">i</span> Distances are measured from the first station on the line.</span>
          <span class="station-count">${project.stations.length} STATIONS</span>
        </div>
      </div>
    </section>
  `;
};

const renderTimetablePanel = (project, selectedTrainId) => {
  const trainCards = project.trains.map((train) => {
    const route = getTrainStations(project.stations, train.direction);
    const departure = train.timetable[0].arrival;
    const arrival = train.timetable[train.timetable.length - 1].arrival;
    const selected = train.id === selectedTrainId;

    return `
      <div class="train-card${selected ? ' selected' : ''}" data-train-id="${escapeHtml(train.id)}">
        <button class="train-card-main" data-action="select-train" aria-pressed="${selected}">
          <span class="train-card-code">${escapeHtml(train.name)}</span>
          <span class="train-card-route">${escapeHtml(route[0].name)} → ${escapeHtml(route[route.length - 1].name)}</span>
          <span class="train-card-meta">${departure} departure · ${arrival} arrival</span>
        </button>
        <button class="train-card-copy" data-action="copy-train" aria-label="Copy ${escapeHtml(train.name)}">Copy</button>
        <button class="train-card-delete" data-action="delete-train" aria-label="Delete ${escapeHtml(train.name)}">×</button>
      </div>
    `;
  }).join('');

  const activeTrain = project.trains.find((train) => train.id === selectedTrainId);

  const editorMarkup = !activeTrain
    ? '<div class="empty-state">No trains scheduled on this line. Click "Add train" to create one.</div>'
    : (() => {
      const rows = projectTimetableRows(project.stations, activeTrain);
      const summary = calculateTimetableSummary(rows);

      const timetableRowsMarkup = rows.map(({ station, row, departure }, index) => {
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        return `
          <div class="timetable-row" data-row-index="${index}">
            <div class="stop-cell">
              <span class="stop-dot ${row.stop ? 'stop-yes' : 'stop-no'}"></span>
              <div class="stop-name">${escapeHtml(station.name)}</div>
            </div>
            <span class="time-cell"><strong>${isFirst ? '—' : row.arrival}</strong></span>
            <span class="time-cell"><strong class="${isFirst ? 'teal' : ''}">${isLast ? '—' : departure}</strong></span>
            <div class="field-with-unit">
              ${isFirst
                ? '<span class="field-unit">—</span>'
                : `<input
                    class="time-field"
                    data-timetable-field="run"
                    type="number"
                    min="1"
                    step="1"
                    value="${row.run}"
                    aria-label="Running time to ${escapeHtml(station.name)}"
                  /><span class="field-unit">min</span>`}
            </div>
            <div class="field-with-unit">
              ${isFirst || isLast
                ? '<span class="field-unit">—</span>'
                : `<input
                    class="time-field"
                    data-timetable-field="dwell"
                    type="number"
                    min="0"
                    step="1"
                    value="${row.dwell}"
                    aria-label="Dwell at ${escapeHtml(station.name)}"
                  /><span class="field-unit">min</span>`}
            </div>
            <select
              class="time-field stop-input ${row.stop ? 'stop-yes' : 'stop-no'}"
              data-timetable-field="stop"
              aria-label="${escapeHtml(station.name)} stop value"
            >
              <option value="true" ${row.stop ? 'selected' : ''}>Yes</option>
              <option value="false" ${row.stop ? '' : 'selected'}>No</option>
            </select>
          </div>
        `;
      }).join('');

      return `
        <div class="section-intro">
          <div>
            <h2>Train timetable</h2>
            <p>Set the departure, running times, and dwell for each stop.</p>
          </div>
          <div class="section-actions">
            <label class="train-name-input">
              <span>TRAIN</span>
              <input id="train-name" data-train-field="name" value="${escapeHtml(activeTrain.name)}" aria-label="Train name" />
            </label>
            <button class="button button-secondary" data-action="reverse-train">⇄ Reverse direction</button>
          </div>
        </div>
        <div class="timetable-summary">
          <div class="summary-item">
            <span class="summary-label">DEPARTURE</span>
            <input
              class="global-departure-input"
              data-train-field="departure"
              type="time"
              value="${summary.departure}"
              aria-label="Origin departure time"
            />
          </div>
          <span class="summary-divider"></span>
          <div class="summary-item">
            <span class="summary-label">ARRIVAL</span>
            <span class="summary-value">${summary.arrival}</span>
          </div>
          <span class="summary-divider"></span>
          <div class="summary-item">
            <span class="summary-label">JOURNEY TIME</span>
            <span class="summary-value">${durationLabel(summary.journeyMinutes)}</span>
          </div>
          <span class="summary-divider"></span>
          <div class="summary-item">
            <span class="summary-label">TOTAL DWELL</span>
            <span class="summary-value">${summary.totalDwell} min</span>
          </div>
        </div>
        <div class="table-card timetable-card">
          <div class="table-header timetable-grid">
            <span>STATION</span><span>ARRIVAL</span><span>DEPARTURE</span><span>RUNNING TIME</span><span>DWELL</span><span>STOPS?</span>
          </div>
          <div>${timetableRowsMarkup}</div>
          <div class="table-footer">
            <span class="table-footer-note"><span class="info-icon">i</span> Edit a running time or dwell to update all following events.</span>
            <span class="station-count">${rows.length} STOPS</span>
          </div>
        </div>
      `;
    })();

  return `
    <section class="view-panel">
      <div class="section-intro">
        <div>
          <h2>Trains</h2>
          <p>Select a train to edit its timetable, or add another service on this route.</p>
        </div>
        <button class="button button-primary" data-action="add-train"><span>＋</span> Add train</button>
      </div>
      ${project.trains.length > 0 ? `<div class="train-list">${trainCards}</div>` : ''}
      <div class="train-list-footer">
        <span class="table-footer-note">Each train shares the project route but has its own schedule.</span>
        <span class="station-count">${project.trains.length} TRAINS</span>
      </div>
      ${editorMarkup}
    </section>
  `;
};

const renderGraphPanel = (project) => {
  const legendMarkup = project.trains.map((train, index) => `
    <span class="legend-train">
      <span class="legend-line" style="background:${TRAIN_COLORS[index % TRAIN_COLORS.length]}"></span>
      ${escapeHtml(train.name)}
    </span>
  `).join('') + '<span class="legend-stations"><span class="legend-dot"></span>Stations</span>';

  const hasTrains = project.trains.length > 0;
  const graph = hasTrains ? buildTrainGraph(project.stations, project.trains) : null;

  return `
    <section class="view-panel">
      <div class="section-intro graph-intro">
        <div>
          <h2>Train graph</h2>
          <p>Time–distance diagram across all scheduled trains.</p>
        </div>
        <div class="graph-actions">
          <div class="legend">${legendMarkup}</div>
          ${hasTrains ? '<button class="button button-secondary" data-action="download-svg"><span>↓</span> Download SVG</button>' : ''}
        </div>
      </div>
      ${hasTrains
        ? `
          <div class="graph-card">
            <div class="chart-wrap">
              <svg id="train-chart" viewBox="${graph.viewBox}" role="img" aria-label="Train time-distance graph">${graph.markup}</svg>
            </div>
          </div>
        `
        : '<div class="empty-state">Add at least one train to render the time–distance graph.</div>'}
    </section>
  `;
};

const renderWorkspace = (state) => {
  const { lineId, view, project, selectedTrainId, saveStatus, saveError } = state;
  const totalDistance = project.stations[project.stations.length - 1].distance;

  const navMarkup = WORKSPACE_VIEWS.map((item) => {
    const href = `/?line=${encodeURIComponent(lineId)}&view=${item.id}`;
    return `
      <a
        class="nav-item${item.id === view ? ' active' : ''}"
        href="${href}"
        title="${item.label}"
        aria-label="${item.label}"
        data-nav
      >
        <span class="nav-icon">${item.icon}</span>
      </a>
    `;
  }).join('');

  const panelMarkup = view === 'infrastructure'
    ? renderInfrastructurePanel(project)
    : view === 'timetable'
      ? renderTimetablePanel(project, selectedTrainId)
      : renderGraphPanel(project);

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <a class="brand-mark" href="/" aria-label="Go to projects" title="Projects" data-nav>
            <span></span><span></span><span></span>
          </a>
        </div>
        <nav class="main-nav" aria-label="Workspace">${navMarkup}</nav>
      </aside>
      <main class="main-content">
        <header class="topbar">
          <div class="breadcrumb">
            <a href="/" data-nav>Projects</a>
            <b>/</b>
            <strong>${escapeHtml(project.name)}</strong>
            <span class="topbar-meta">${project.stations.length} stations · ${formatNumber(totalDistance)} km</span>
          </div>
          <div class="topbar-actions">
            <span class="saved-state${saveError ? ' is-error' : ''}">
              <span class="saved-dot"></span>
              <span>${escapeHtml(saveStatus)}</span>
            </span>
            <button class="button button-primary" data-action="export-json"><span>↓</span> Export JSON</button>
          </div>
        </header>
        ${panelMarkup}
        <footer class="app-footer">
          <span><span class="keyboard-key">⌘</span><span class="keyboard-key">S</span> Changes are saved automatically</span>
          <span>RailGraph v2.0 <span class="footer-separator">·</span> Built for clear operations</span>
        </footer>
      </main>
    </div>
  `;
};

export const renderApp = (state) => {
  if (state.page === 'error') return renderErrorView(state.error);
  if (state.page === 'picker') return renderLinePicker(state.lines, state.loading);
  if (state.loading) return '<main class="line-picker"><div class="empty-state">Loading line…</div></main>';
  return renderWorkspace(state);
};