import { escapeHtml, formatTime, parseTime } from './utils.js';
import { projectTimetableRows } from './domain.js';

export const TRAIN_COLORS = Object.freeze([
  '#ef865b',
  '#4d82c4',
  '#9b68b0',
  '#d49a32',
  '#2f9b78',
  '#d45c79',
]);

const DIMENSIONS = Object.freeze({
  width: 1400,
  height: 520,
  margin: Object.freeze({ top: 25, right: 30, bottom: 43, left: 116 }),
  gridStepMinutes: 10,
  platformSpacing: 4,
});

const toTimelinePoints = (rows) => (
  rows.reduce((acc, item, index) => {
    const arrivalMinute = index === 0
      ? parseTime(item.row.arrival)
      : acc[index - 1].departureMinute + item.row.run;
    const departureMinute = arrivalMinute + item.row.dwell;
    return [...acc, { ...item, arrivalMinute, departureMinute }];
  }, [])
);

export const buildTrainGraph = (stations, trains) => {
  const { width, height, margin, gridStepMinutes, platformSpacing } = DIMENSIONS;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totalDistance = stations[stations.length - 1].distance;

  const series = trains.map((train, index) => ({
    train,
    color: TRAIN_COLORS[index % TRAIN_COLORS.length],
    points: toTimelinePoints(projectTimetableRows(stations, train)),
  }));

  const earliest = Math.min(...series.map(({ points }) => points[0].arrivalMinute));
  const latest = Math.max(...series.map(({ points }) => points[points.length - 1].departureMinute));
  const startMinutes = Math.floor(earliest / 60) * 60;
  const finishMinutes = Math.max(startMinutes + 60, Math.ceil(latest / 60) * 60);
  const totalMinutes = finishMinutes - startMinutes;

  const scaleX = (minute) => margin.left + ((minute - startMinutes) / totalMinutes) * plotWidth;
  const scaleY = (distance) => (
    margin.top + plotHeight - (totalDistance === 0 ? 0 : (distance / totalDistance) * plotHeight)
  );

  const gridCount = Math.floor(totalMinutes / gridStepMinutes) + 1;
  const gridMarkup = Array.from({ length: gridCount }, (_, step) => {
    const minute = startMinutes + (step * gridStepMinutes);
    const xPos = scaleX(minute);
    return [
      `<line x1="${xPos}" y1="${margin.top}" x2="${xPos}" y2="${margin.top + plotHeight}" stroke="#edf0f4" stroke-width="1"/>`,
      `<text x="${xPos}" y="${height - 16}" text-anchor="middle" fill="#a4afbc" font-family="DM Mono" font-size="10">${formatTime(minute)}</text>`,
    ].join('');
  });

  const stationMarkup = stations.map((station) => {
    const yPos = scaleY(station.distance);
    const platformLines = Array.from({ length: station.tracks }, (_, platformIndex) => {
      const offset = (platformIndex - (station.tracks - 1) / 2) * platformSpacing;
      return `<line x1="${margin.left}" y1="${yPos + offset}" x2="${width - margin.right}" y2="${yPos + offset}" stroke="#edf0f4" stroke-width="1"/>`;
    }).join('');
    return [
      platformLines,
      `<circle cx="${margin.left - 12}" cy="${yPos}" r="4" fill="#fff" stroke="#0d9f91" stroke-width="2"/>`,
      `<text x="${margin.left - 24}" y="${yPos + 4}" text-anchor="end" fill="#667489" font-family="Manrope" font-size="11" font-weight="600">${escapeHtml(station.name)}</text>`,
    ].join('');
  });

  const trainMarkup = series.map(({ color, points }) => {
    const polylineCoords = points
      .flatMap(({ station, arrivalMinute, departureMinute }) => {
        const yPos = scaleY(station.distance);
        return [`${scaleX(arrivalMinute)},${yPos}`, `${scaleX(departureMinute)},${yPos}`];
      })
      .join(' ');

    const markers = points.map(({ station, row, arrivalMinute, departureMinute }) => {
      const xStart = scaleX(arrivalMinute);
      const xEnd = scaleX(departureMinute);
      const yPos = scaleY(station.distance);
      const dwellBar = xEnd - xStart > 1
        ? `<line x1="${xStart}" y1="${yPos}" x2="${xEnd}" y2="${yPos}" stroke="${color}" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`
        : '';
      const stopDot = row.stop
        ? `<circle cx="${xStart}" cy="${yPos}" r="4" fill="#fff" stroke="${color}" stroke-width="2"/>`
        : '';
      return `${dwellBar}${stopDot}`;
    }).join('');

    return [
      `<polyline points="${polylineCoords}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
      markers,
    ].join('');
  });

  const baseline = `<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" stroke="#cfd6df" stroke-width="1"/>`;

  return {
    viewBox: `0 0 ${width} ${height}`,
    markup: [
      `<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`,
      ...gridMarkup,
      ...stationMarkup,
      ...trainMarkup,
      baseline,
    ].join(''),
  };
};