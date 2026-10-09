import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProject, normalizeProject } from '../src/project-store.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const defaultProject = {
  stations: [{ id: 'origin', name: 'Origin' }],
  trains: [{
    id: 'default',
    name: 'Default',
    timetable: [{ arrival: '06:40', departure: '06:40', run: 0, dwell: 0 }],
  }],
};

test('migrates a legacy single-train project', () => {
  const project = normalizeProject({
    name: 'Legacy',
    trainName: 'RG 201',
    timetable: [{ arrival: '07:00', departure: '07:00', run: 0, dwell: 0 }],
  }, defaultProject, clone);

  assert.equal(project.trains.length, 1);
  assert.equal(project.trains[0].name, 'RG 201');
  assert.equal(project.trains[0].timetable[0].arrival, '07:00');
});

test('falls back to defaults when saved data is invalid', () => {
  const storage = { getItem: () => '{invalid' };
  const project = loadProject(storage, 'project', defaultProject, clone, () => {});
  assert.deepEqual(project, defaultProject);
});
