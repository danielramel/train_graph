import { fetchLine, fetchLines, saveLine } from './api.js';
import {
  addStation,
  addTrain,
  copyTrain,
  deleteStation,
  deleteTrain,
  renameTrain,
  reverseTrain,
  updateStation,
  updateTimetableRow,
  updateTrainDeparture,
} from './domain.js';
import { createId, slugify } from './utils.js';
import { renderApp } from './view.js';

const VALID_VIEWS = Object.freeze(['infrastructure', 'timetable', 'graph']);
const SAVE_DEBOUNCE_MS = 260;
const NEW_TRAIN_DEPARTURE = '06:40';

const parseRoute = (search) => {
  const params = new URLSearchParams(search);
  const lineId = params.get('line');
  if (!lineId) return { page: 'picker' };

  const view = params.get('view');
  if (!VALID_VIEWS.includes(view)) {
    return { page: 'error', error: `Invalid view "${String(view)}". Expected infrastructure, timetable, or graph.` };
  }
  return { page: 'workspace', lineId, view };
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const createApp = (root) => {
  let state = { page: 'picker', lines: [], loading: true };
  let saveTimer = null;

  const setState = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
    root.innerHTML = renderApp(state);
  };

  const persistNow = async () => {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (state.page !== 'workspace' || !state.project) return;

    const { lineId, project } = state;
    setState((current) => ({ ...current, saveStatus: 'Saving…', saveError: false }));

    try {
      await saveLine(lineId, project);
      setState((current) => (
        current.lineId === lineId
          ? { ...current, saveStatus: 'Saved', saveError: false }
          : current
      ));
    } catch (error) {
      setState((current) => (
        current.lineId === lineId
          ? { ...current, saveStatus: `Save failed: ${error.message}`, saveError: true }
          : current
      ));
    }
  };

  const scheduleSave = () => {
    clearTimeout(saveTimer);
    setState((current) => ({ ...current, saveStatus: 'Saving…', saveError: false }));
    saveTimer = setTimeout(persistNow, SAVE_DEBOUNCE_MS);
  };

  const updateProject = (transform, postUpdate) => {
    if (state.page !== 'workspace' || !state.project) return;
    const nextProject = transform(state.project);
    if (nextProject === state.project) {
      root.innerHTML = renderApp(state);
      return;
    }

    const nextSelectedTrainId = nextProject.trains.some((train) => train.id === state.selectedTrainId)
      ? state.selectedTrainId
      : nextProject.trains.length > 0
        ? nextProject.trains[0].id
        : null;

    setState((current) => ({
      ...current,
      project: nextProject,
      selectedTrainId: nextSelectedTrainId,
    }));

    if (postUpdate) postUpdate(nextProject);
    scheduleSave();
  };

  const loadRoute = async (search) => {
    clearTimeout(saveTimer);
    saveTimer = null;
    const route = parseRoute(search);

    if (route.page === 'error') {
      setState(route);
      return;
    }

    if (route.page === 'picker') {
      setState({ page: 'picker', lines: [], loading: true });
      try {
        const lines = await fetchLines();
        setState({ page: 'picker', lines, loading: false });
      } catch (error) {
        setState({ page: 'error', error: error.message });
      }
      return;
    }

    if (state.page === 'workspace' && state.lineId === route.lineId && state.project) {
      setState((current) => ({ ...current, view: route.view }));
      return;
    }

    setState({
      page: 'workspace',
      lineId: route.lineId,
      view: route.view,
      project: null,
      selectedTrainId: null,
      loading: true,
      saveStatus: 'Saved',
      saveError: false,
    });

    try {
      const project = await fetchLine(route.lineId);
      setState({
        page: 'workspace',
        lineId: route.lineId,
        view: route.view,
        project,
        selectedTrainId: project.trains.length > 0 ? project.trains[0].id : null,
        loading: false,
        saveStatus: 'Saved',
        saveError: false,
      });
    } catch (error) {
      setState({ page: 'error', error: error.message });
    }
  };

  const navigate = (href) => {
    const url = new URL(href, window.location.origin);
    window.history.pushState(null, '', `${url.pathname}${url.search}`);
    loadRoute(url.search);
  };

  const handleClick = (event) => {
    const navLink = event.target.closest('a[data-nav]');
    if (navLink) {
      event.preventDefault();
      navigate(navLink.getAttribute('href'));
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const { action } = actionEl.dataset;

    if (action === 'add-station') {
      const id = createId('station');
      updateProject(
        (project) => addStation(project, { id, name: 'New station' }),
        () => {
          const input = root.querySelector(`[data-station-id="${id}"] [data-station-field="name"]`);
          input?.focus();
          input?.select();
        },
      );
      return;
    }

    if (action === 'delete-station') {
      const stationId = actionEl.closest('[data-station-id]').dataset.stationId;
      updateProject((project) => deleteStation(project, stationId));
      return;
    }

    if (action === 'add-train') {
      const id = createId('train');
      updateProject(
        (project) => addTrain(project, {
          id,
          name: `Train ${project.trains.length + 1}`,
          startTime: NEW_TRAIN_DEPARTURE,
        }),
        () => {
          setState((current) => ({ ...current, selectedTrainId: id }));
          const input = root.querySelector('#train-name');
          input?.focus();
          input?.select();
        },
      );
      return;
    }

    if (action === 'select-train') {
      const trainId = actionEl.closest('[data-train-id]').dataset.trainId;
      setState((current) => ({ ...current, selectedTrainId: trainId }));
      return;
    }

    if (action === 'copy-train') {
      const sourceId = actionEl.closest('[data-train-id]').dataset.trainId;
      const newId = createId('train');
      updateProject(
        (project) => copyTrain(project, sourceId, newId),
        () => setState((current) => ({ ...current, selectedTrainId: newId })),
      );
      return;
    }

    if (action === 'delete-train') {
      const trainId = actionEl.closest('[data-train-id]').dataset.trainId;
      const train = state.project.trains.find((item) => item.id === trainId);
      if (!train || !window.confirm(`Delete train "${train.name}"?`)) return;
      updateProject((project) => deleteTrain(project, trainId));
      return;
    }

    if (action === 'reverse-train') {
      updateProject((project) => reverseTrain(project, state.selectedTrainId));
      return;
    }

    if (action === 'export-json') {
      const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${slugify(state.project.name)}-railgraph.json`);
      return;
    }

    if (action === 'download-svg') {
      const svg = root.querySelector('#train-chart');
      const source = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([source], { type: 'image/svg+xml' });
      downloadBlob(blob, `${slugify(state.project.name)}-graph.svg`);
    }
  };

  const handleChange = (event) => {
    const stationInput = event.target.closest('[data-station-field]');
    if (stationInput) {
      const stationId = stationInput.closest('[data-station-id]').dataset.stationId;
      const field = stationInput.dataset.stationField;
      const value = field === 'name' ? stationInput.value : Number(stationInput.value);
      updateProject((project) => updateStation(project, stationId, { [field]: value }));
      return;
    }

    const trainInput = event.target.closest('[data-train-field]');
    if (trainInput) {
      const field = trainInput.dataset.trainField;
      if (field === 'name') {
        updateProject((project) => renameTrain(project, state.selectedTrainId, trainInput.value));
      } else if (field === 'departure') {
        try {
          updateProject((project) => updateTrainDeparture(project, state.selectedTrainId, trainInput.value));
        } catch {
          root.innerHTML = renderApp(state);
        }
      }
      return;
    }

    const timetableInput = event.target.closest('[data-timetable-field]');
    if (timetableInput) {
      const rowIndex = Number(timetableInput.closest('[data-row-index]').dataset.rowIndex);
      const field = timetableInput.dataset.timetableField;
      const patch = field === 'stop'
        ? { stop: timetableInput.value === 'true' }
        : { [field]: Number(timetableInput.value) };
      updateProject((project) => updateTimetableRow(project, state.selectedTrainId, rowIndex, patch));
    }
  };

  const handleKeydown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      persistNow();
    }
  };

  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('popstate', () => loadRoute(window.location.search));

  loadRoute(window.location.search);
};

createApp(document.querySelector('#app'));