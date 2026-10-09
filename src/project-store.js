export function normalizeProject(parsed, defaultProject, clone) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return clone(defaultProject);

  const legacyTimetable = Array.isArray(parsed.timetable) && parsed.timetable.length > 0
    ? parsed.timetable
    : defaultProject.trains[0].timetable;
  const trains = Array.isArray(parsed.trains) && parsed.trains.length > 0
    ? parsed.trains.map((train, index) => ({
      id: train.id || `train-${index + 1}`,
      name: train.name || `Train ${index + 1}`,
      direction: train.direction === -1 ? -1 : 1,
      timetable: Array.isArray(train.timetable) && train.timetable.length > 0
        ? train.timetable
        : clone(defaultProject.trains[0].timetable),
    }))
    : [{
      id: 'train-1',
      name: parsed.trainName || defaultProject.trains[0].name,
      direction: 1,
      timetable: legacyTimetable,
    }];

  return {
    ...clone(defaultProject),
    ...parsed,
    stations: Array.isArray(parsed.stations) && parsed.stations.length > 0
      ? parsed.stations
      : clone(defaultProject.stations),
    trains: trains.map((train) => ({
      ...train,
      timetable: train.timetable.map(({ arrival, departure, run, dwell }) => ({
        arrival,
        ...(departure ? { departure } : {}),
        run,
        dwell,
      })),
    })),
  };
}

export function loadProject(storage, key, defaultProject, clone, warn = console.warn) {
  try {
    const saved = storage.getItem(key);
    return saved ? normalizeProject(JSON.parse(saved), defaultProject, clone) : clone(defaultProject);
  } catch (error) {
    warn('Could not load the saved project.', error);
    return clone(defaultProject);
  }
}
