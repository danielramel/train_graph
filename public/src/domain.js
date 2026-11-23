import { formatTime, parseTime } from './utils.js';

export const getTrainStations = (stations, direction) => (
  direction === -1 ? [...stations].reverse() : stations
);

export const getCalculationStations = (stations, direction) => {
  if (direction === 1) return stations;
  const reversed = [...stations].reverse();
  const maxDistance = stations[stations.length - 1].distance;
  return reversed.map((station, index) => ({
    ...station,
    distance: Number((maxDistance - station.distance).toFixed(4)),
    speed: index === reversed.length - 1 ? 0 : reversed[index + 1].speed,
  }));
};

export const estimateRunningTime = (calcStations, index) => {
  if (index === 0) return 0;
  const distance = Math.max(0, calcStations[index].distance - calcStations[index - 1].distance);
  const speed = calcStations[index - 1].speed;
  if (speed <= 0) throw new RangeError(`Invalid section speed at index ${index - 1}`);
  return Math.max(1, Math.ceil((distance / speed) * 60));
};

export const recalculateTimetable = (timetable, startIndex = 0) => (
  timetable.reduce((acc, row, index) => {
    const isFirst = index === 0;
    const isLast = index === timetable.length - 1;
    if (index < startIndex) return [...acc, row];

    const dwell = isFirst || isLast ? 0 : Math.max(0, Math.round(row.dwell));
    const run = isFirst ? 0 : Math.max(1, Math.round(row.run));
    const arrival = index === startIndex
      ? row.arrival
      : formatTime(parseTime(acc[index - 1].arrival) + acc[index - 1].dwell + run);

    return [...acc, { arrival, run, dwell, stop: row.stop }];
  }, [])
);

export const createEstimatedTimetable = (stations, direction, startTime) => {
  const calcStations = getCalculationStations(stations, direction);
  const initial = calcStations.map((_, index) => ({
    arrival: startTime,
    run: estimateRunningTime(calcStations, index),
    dwell: index === 0 || index === calcStations.length - 1 ? 0 : 1,
    stop: true,
  }));
  return recalculateTimetable(initial, 0);
};

export const projectTimetableRows = (stations, train) => (
  getTrainStations(stations, train.direction).map((station, index) => {
    const row = train.timetable[index];
    const departure = formatTime(parseTime(row.arrival) + row.dwell);
    return { station, row, departure };
  })
);

export const calculateInfrastructureStats = (stations) => {
  const totalDistance = stations[stations.length - 1].distance;
  const sectionCount = stations.length - 1;
  const maxSpeed = Math.max(...stations.slice(0, -1).map((station) => station.speed));
  return { totalDistance, sectionCount, maxSpeed };
};

export const calculateTimetableSummary = (rows) => {
  const totalDwell = rows.slice(1, -1).reduce((sum, { row }) => sum + row.dwell, 0);
  const totalRun = rows.slice(1).reduce((sum, { row }) => sum + row.run, 0);
  return {
    departure: rows[0].departure,
    arrival: rows[rows.length - 1].row.arrival,
    journeyMinutes: totalRun + totalDwell,
    totalDwell,
  };
};

const insertAt = (list, index, item) => [
  ...list.slice(0, index),
  item,
  ...list.slice(index),
];

const removeAt = (list, index) => [
  ...list.slice(0, index),
  ...list.slice(index + 1),
];

const normalizeStationBoundaries = (stations, previousLastId) => {
  const originOffset = stations[0].distance;
  const lastIndex = stations.length - 1;
  const newLastStation = stations[lastIndex];
  const recoveredSpeed = newLastStation.speed;

  return stations.map((station, index) => {
    const shiftedDistance = index === 0
      ? 0
      : Number((station.distance - originOffset).toFixed(1));
    const speed = index === lastIndex
      ? 0
      : station.id === previousLastId
        ? recoveredSpeed
        : station.speed;
    return { ...station, distance: shiftedDistance, speed };
  });
};

export const addStation = (project, { id, name }) => {
  const terminalIndex = project.stations.length - 1;
  const previousStation = project.stations[terminalIndex - 1];
  const terminalStation = project.stations[terminalIndex];
  const distance = Number(((previousStation.distance + terminalStation.distance) / 2).toFixed(1));

  const newStation = {
    id,
    name,
    distance,
    speed: previousStation.speed,
    tracks: previousStation.tracks,
  };

  const nextStations = insertAt(project.stations, terminalIndex, newStation);

  const nextTrains = project.trains.map((train) => {
    const calcStations = getCalculationStations(nextStations, train.direction);
    const insertIndex = train.direction === 1 ? terminalIndex : 1;
    const insertedRow = {
      arrival: train.timetable[insertIndex - 1].arrival,
      run: estimateRunningTime(calcStations, insertIndex),
      dwell: 0,
      stop: true,
    };
    const withInserted = insertAt(train.timetable, insertIndex, insertedRow).map((row, index) => (
      index === insertIndex + 1
        ? { ...row, run: estimateRunningTime(calcStations, index) }
        : row
    ));
    return {
      ...train,
      timetable: recalculateTimetable(withInserted, 0),
    };
  });

  return { ...project, stations: nextStations, trains: nextTrains };
};

export const deleteStation = (project, stationId) => {
  if (project.stations.length <= 2) return project;
  const stationIndex = project.stations.findIndex((station) => station.id === stationId);
  if (stationIndex < 0) return project;

  const previousLastId = project.stations[project.stations.length - 1].id;
  const nextStations = normalizeStationBoundaries(removeAt(project.stations, stationIndex), previousLastId);

  const nextTrains = project.trains.map((train) => {
    const route = getTrainStations(project.stations, train.direction);
    const routeIndex = route.findIndex((station) => station.id === stationId);
    const remaining = removeAt(train.timetable, routeIndex);
    const calcStations = getCalculationStations(nextStations, train.direction);
    const normalized = remaining.map((row, index) => ({
      ...row,
      run: index === 0 ? 0 : Math.max(1, row.run || estimateRunningTime(calcStations, index)),
      dwell: index === 0 || index === remaining.length - 1 ? 0 : row.dwell,
    }));
    return {
      ...train,
      timetable: recalculateTimetable(normalized, 0),
    };
  });

  return { ...project, stations: nextStations, trains: nextTrains };
};

export const updateStation = (project, stationId, patch) => {
  const targetIndex = project.stations.findIndex((station) => station.id === stationId);
  if (targetIndex < 0) return project;

  const current = project.stations[targetIndex];
  const isFirst = targetIndex === 0;
  const isLast = targetIndex === project.stations.length - 1;

  if ('name' in patch && (typeof patch.name !== 'string' || patch.name.trim().length === 0)) {
    return project;
  }
  if ('tracks' in patch && (!Number.isInteger(patch.tracks) || patch.tracks < 1 || patch.tracks > 4)) {
    return project;
  }
  if ('speed' in patch && (isLast || !Number.isFinite(patch.speed) || patch.speed < 1)) {
    return project;
  }
  if ('distance' in patch && (isFirst || !Number.isFinite(patch.distance) || patch.distance < 0)) {
    return project;
  }

  const updatedStations = project.stations.map((station) => (
    station.id !== stationId
      ? station
      : {
        ...station,
        ...('name' in patch ? { name: patch.name.trim() } : {}),
        ...('tracks' in patch ? { tracks: patch.tracks } : {}),
        ...('speed' in patch ? { speed: Math.round(patch.speed) } : {}),
        ...('distance' in patch ? { distance: Number(patch.distance.toFixed(1)) } : {}),
      }
  ));

  if (!('distance' in patch)) {
    return { ...project, stations: updatedStations };
  }

  const previousLastId = project.stations[project.stations.length - 1].id;
  const sorted = updatedStations
    .map((station, index) => ({ station, index }))
    .sort((left, right) => (left.station.distance - right.station.distance) || (left.index - right.index))
    .map(({ station }) => station);

  const nextStations = normalizeStationBoundaries(sorted, previousLastId);

  const nextTrains = project.trains.map((train) => {
    const previousRoute = getTrainStations(project.stations, train.direction);
    const rowByStationId = new Map(
      previousRoute.map((station, index) => [station.id, train.timetable[index]]),
    );
    const nextRoute = getTrainStations(nextStations, train.direction);
    const calcStations = getCalculationStations(nextStations, train.direction);
    const remapped = nextRoute.map((station, index) => {
      const row = rowByStationId.get(station.id);
      return {
        ...row,
        run: index === 0 ? 0 : Math.max(1, row.run === 0 ? estimateRunningTime(calcStations, index) : row.run),
        dwell: index === 0 || index === nextRoute.length - 1 ? 0 : row.dwell,
      };
    });
    return {
      ...train,
      timetable: recalculateTimetable(remapped, 0),
    };
  });

  return { ...project, stations: nextStations, trains: nextTrains };
};

export const addTrain = (project, { id, name, startTime }) => ({
  ...project,
  trains: [
    ...project.trains,
    {
      id,
      name,
      direction: 1,
      timetable: createEstimatedTimetable(project.stations, 1, startTime),
    },
  ],
});

export const copyTrain = (project, trainId, newId) => {
  const source = project.trains.find((train) => train.id === trainId);
  if (!source) return project;
  const copy = {
    ...source,
    id: newId,
    name: `${source.name} copy`,
    timetable: source.timetable.map((row) => ({ ...row })),
  };
  return { ...project, trains: [...project.trains, copy] };
};

export const deleteTrain = (project, trainId) => ({
  ...project,
  trains: project.trains.filter((train) => train.id !== trainId),
});

export const renameTrain = (project, trainId, name) => {
  const trimmed = name.trim();
  if (!trimmed) return project;
  return {
    ...project,
    trains: project.trains.map((train) => (
      train.id === trainId ? { ...train, name: trimmed } : train
    )),
  };
};

export const reverseTrain = (project, trainId) => ({
  ...project,
  trains: project.trains.map((train) => {
    if (train.id !== trainId) return train;
    const nextDirection = train.direction === 1 ? -1 : 1;
    const count = train.timetable.length;
    const startArrival = train.timetable[count - 1].arrival;

    const reversedRows = train.timetable
      .slice()
      .reverse()
      .map((row, index) => ({
        arrival: index === 0 ? startArrival : row.arrival,
        run: index === 0 ? 0 : train.timetable[count - index].run,
        dwell: index === 0 || index === count - 1 ? 0 : row.dwell,
        stop: row.stop,
      }));

    return {
      ...train,
      direction: nextDirection,
      timetable: recalculateTimetable(reversedRows, 0),
    };
  }),
});

export const updateTrainDeparture = (project, trainId, departureTime) => {
  parseTime(departureTime);
  return {
    ...project,
    trains: project.trains.map((train) => {
      if (train.id !== trainId) return train;
      const updated = train.timetable.map((row, index) => (
        index === 0 ? { ...row, arrival: departureTime } : row
      ));
      return { ...train, timetable: recalculateTimetable(updated, 0) };
    }),
  };
};

export const updateTimetableRow = (project, trainId, rowIndex, patch) => ({
  ...project,
  trains: project.trains.map((train) => {
    if (train.id !== trainId) return train;
    if (rowIndex < 0 || rowIndex >= train.timetable.length) return train;

    const isFirst = rowIndex === 0;
    const isLast = rowIndex === train.timetable.length - 1;

    if ('dwell' in patch && (isFirst || isLast || !Number.isInteger(patch.dwell) || patch.dwell < 0)) {
      return train;
    }
    if ('run' in patch && (isFirst || !Number.isInteger(patch.run) || patch.run < 1)) {
      return train;
    }
    if ('stop' in patch && typeof patch.stop !== 'boolean') {
      return train;
    }

    const updated = train.timetable.map((row, index) => {
      if (index !== rowIndex) return row;
      if ('run' in patch) {
        const prev = train.timetable[index - 1];
        const arrival = formatTime(parseTime(prev.arrival) + prev.dwell + patch.run);
        return { ...row, run: patch.run, arrival };
      }
      return { ...row, ...patch };
    });

    const needsRecalc = 'run' in patch || 'dwell' in patch;
    return {
      ...train,
      timetable: needsRecalc ? recalculateTimetable(updated, rowIndex) : updated,
    };
  }),
});