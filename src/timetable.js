export function parseTime(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours * 60) + minutes;
}

export function formatTime(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function durationLabel(minutes) {
  const rounded = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function estimateRunningTime(stations, index) {
  if (index <= 0 || !stations[index] || !stations[index - 1]) return 1;
  const distance = Math.max(0, stations[index].distance - stations[index - 1].distance);
  const speed = stations[index - 1].speed || 80;
  return Math.max(1, Math.ceil((distance / Math.max(1, speed)) * 60));
}

export function createEstimatedTimetable(stations, estimate = estimateRunningTime, startTime = '06:40') {
  let current = parseTime(startTime);
  return stations.map((station, index) => {
    const row = {
      arrival: formatTime(current),
      run: index === 0 ? 0 : estimate(stations, index),
      dwell: index === 0 || index === stations.length - 1 ? 0 : 1,
      stop: 1,
    };
    if (index === 0) row.departure = row.arrival;
    current += row.dwell + (index < stations.length - 1 ? estimate(stations, index + 1) : 0);
    return row;
  });
}

export function recalculateTimetable(stations, timetable, startIndex = 0, estimate = estimateRunningTime) {
  if (!timetable?.length) return;
  const safeStartIndex = Math.max(0, Math.min(startIndex, stations.length - 1));
  let current = parseTime(timetable[safeStartIndex]?.arrival || timetable[0]?.arrival || '06:40');
  for (let index = safeStartIndex; index < stations.length; index += 1) {
    const row = timetable[index] || {
      arrival: formatTime(current),
      run: estimate(stations, index),
      dwell: 0,
      stop: 1,
    };
    if (index === safeStartIndex) {
      current = index === 0
        ? parseTime(row.departure || row.arrival || formatTime(current))
        : parseTime(row.arrival || formatTime(current));
    }
    row.run = index === 0 ? 0 : Math.max(1, Number(row.run) || estimate(stations, index));
    row.dwell = index === 0 || index === stations.length - 1
      ? 0
      : Number.isFinite(Number(row.dwell)) ? Math.max(0, Number(row.dwell)) : 0;
    row.arrival = index === 0 && row.departure
      ? formatTime(parseTime(row.departure) - row.dwell)
      : formatTime(current);
    if (index === 0) row.departure = formatTime(parseTime(row.arrival) + row.dwell);
    timetable[index] = row;
    if (index < stations.length - 1) {
      const nextRow = timetable[index + 1] || {
        arrival: formatTime(current),
        run: estimate(stations, index + 1),
        dwell: 0,
      };
      timetable[index + 1] = nextRow;
      current += row.dwell + Math.max(1, Number(nextRow.run) || estimate(stations, index + 1));
    }
  }
  timetable.length = stations.length;
}
