import { parseTime } from './utils.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const validateStation = (station, index, totalCount) => {
  assert(isPlainObject(station), `Station at index ${index} must be an object`);
  assert(isNonEmptyString(station.id), `Station at index ${index} requires a non-empty id`);
  assert(isNonEmptyString(station.name), `Station "${station.id}" requires a non-empty name`);
  assert(typeof station.distance === 'number' && Number.isFinite(station.distance) && station.distance >= 0,
    `Station "${station.id}" requires a non-negative finite distance`);
  assert(typeof station.speed === 'number' && Number.isFinite(station.speed),
    `Station "${station.id}" requires a finite speed`);
  assert(Number.isInteger(station.tracks) && station.tracks >= 1 && station.tracks <= 4,
    `Station "${station.id}" tracks must be an integer between 1 and 4`);

  if (index === 0) {
    assert(station.distance === 0, 'First station distance must be 0');
  }
  if (index === totalCount - 1) {
    assert(station.speed === 0, 'Final station speed must be 0');
  } else {
    assert(station.speed > 0, `Station "${station.id}" section speed must be greater than 0`);
  }

  return {
    id: station.id.trim(),
    name: station.name.trim(),
    distance: station.distance,
    speed: station.speed,
    tracks: station.tracks,
  };
};

const validateTimetableRow = (row, index, stationCount, trainId) => {
  assert(isPlainObject(row), `Timetable row ${index} on train "${trainId}" must be an object`);
  parseTime(row.arrival);
  assert(Number.isInteger(row.run), `Timetable row ${index} on train "${trainId}" run must be an integer`);
  assert(Number.isInteger(row.dwell), `Timetable row ${index} on train "${trainId}" dwell must be an integer`);
  assert(typeof row.stop === 'boolean', `Timetable row ${index} on train "${trainId}" stop must be a boolean`);

  const isFirst = index === 0;
  const isLast = index === stationCount - 1;
  assert(isFirst ? row.run === 0 : row.run >= 1,
    `Timetable row ${index} on train "${trainId}" has invalid running time`);
  assert(isFirst || isLast ? row.dwell === 0 : row.dwell >= 0,
    `Timetable row ${index} on train "${trainId}" has invalid dwell time`);

  return {
    arrival: row.arrival,
    run: row.run,
    dwell: row.dwell,
    stop: row.stop,
  };
};

const validateTrain = (train, index, stationCount) => {
  assert(isPlainObject(train), `Train at index ${index} must be an object`);
  assert(isNonEmptyString(train.id), `Train at index ${index} requires a non-empty id`);
  assert(isNonEmptyString(train.name), `Train "${train.id}" requires a non-empty name`);
  assert(train.direction === 1 || train.direction === -1,
    `Train "${train.id}" direction must be 1 or -1`);
  assert(Array.isArray(train.timetable) && train.timetable.length === stationCount,
    `Train "${train.id}" timetable length must match station count (${stationCount})`);

  return {
    id: train.id.trim(),
    name: train.name.trim(),
    direction: train.direction,
    timetable: train.timetable.map((row, rowIndex) => (
      validateTimetableRow(row, rowIndex, stationCount, train.id)
    )),
  };
};

export const validateProject = (value) => {
  assert(isPlainObject(value), 'Project must be an object');
  assert(isNonEmptyString(value.name), 'Project requires a non-empty name');
  assert(Array.isArray(value.stations) && value.stations.length >= 2,
    'Project must contain at least 2 stations');
  assert(Array.isArray(value.trains), 'Project trains must be an array');

  const stations = value.stations.map((station, index, list) => (
    validateStation(station, index, list.length)
  ));

  const stationIds = new Set(stations.map((station) => station.id));
  assert(stationIds.size === stations.length, 'Station IDs must be unique');

  const distancesOrdered = stations.every((station, index) => (
    index === 0 || station.distance >= stations[index - 1].distance
  ));
  assert(distancesOrdered, 'Stations must be ordered by non-decreasing distance');

  const trains = value.trains.map((train, index) => (
    validateTrain(train, index, stations.length)
  ));

  const trainIds = new Set(trains.map((train) => train.id));
  assert(trainIds.size === trains.length, 'Train IDs must be unique');

  return {
    name: value.name.trim(),
    stations,
    trains,
  };
};