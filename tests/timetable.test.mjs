import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEstimatedTimetable,
  durationLabel,
  formatTime,
  parseTime,
  recalculateTimetable,
} from '../src/timetable.js';

const stations = [
  { distance: 0, speed: 60 },
  { distance: 10, speed: 60 },
  { distance: 20, speed: 60 },
];

test('formats and parses timetable times', () => {
  assert.equal(parseTime('06:40'), 400);
  assert.equal(formatTime(400), '06:40');
  assert.equal(formatTime(1445), '00:05');
  assert.equal(durationLabel(90), '01:30');
});

test('creates an estimated schedule from the route', () => {
  const timetable = createEstimatedTimetable(stations);
  assert.equal(timetable[0].departure, '06:40');
  assert.equal(timetable[1].arrival, '06:50');
  assert.equal(timetable[2].arrival, '07:01');
  assert.equal(timetable[2].dwell, 0);
});

test('recalculates following events after a running-time change', () => {
  const timetable = createEstimatedTimetable(stations);
  timetable[1].run = 15;
  recalculateTimetable(stations, timetable);
  assert.equal(timetable[1].arrival, '06:55');
  assert.equal(timetable[2].arrival, '07:06');
});
