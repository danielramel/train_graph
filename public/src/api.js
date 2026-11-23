import { validateProject } from './schema.js';

const parseJsonResponse = async (response) => {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error);
  }
  return payload;
};

export const fetchLines = async () => {
  const response = await fetch('/api/lines');
  const data = await parseJsonResponse(response);
  return Object.entries(data).map(([id, project]) => ({
    id,
    project: validateProject(project),
  }));
};

export const fetchLine = async (lineId) => {
  const response = await fetch(`/api/lines/${encodeURIComponent(lineId)}`);
  const data = await parseJsonResponse(response);
  return validateProject(data);
};

export const saveLine = async (lineId, project) => {
  const validated = validateProject(project);
  const response = await fetch(`/api/lines/${encodeURIComponent(lineId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated),
  });
  const data = await parseJsonResponse(response);
  return validateProject(data);
};