const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const HTML_ENTITIES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
});

export const parseTime = (value) => {
  if (typeof value !== 'string') throw new TypeError(`Invalid time value: ${String(value)}`);
  const match = value.match(TIME_PATTERN);
  if (!match) throw new RangeError(`Time must be in HH:MM format: "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new RangeError(`Time out of range: "${value}"`);
  return (hours * 60) + minutes;
};

export const formatTime = (totalMinutes) => {
  if (!Number.isFinite(totalMinutes)) throw new RangeError(`Invalid minute total: ${String(totalMinutes)}`);
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const durationLabel = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Invalid duration: ${String(minutes)}`);
  }
  const rounded = Math.round(minutes);
  const hours = String(Math.floor(rounded / 60)).padStart(2, '0');
  const mins = String(rounded % 60).padStart(2, '0');
  return `${hours}:${mins}`;
};

export const formatNumber = (value) => {
  if (!Number.isFinite(value)) throw new RangeError(`Invalid number: ${String(value)}`);
  return Number(value).toFixed(1).replace(/\.0$/, '');
};

export const escapeHtml = (value) => (
  String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character])
);

export const slugify = (value) => (
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
);

export const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;