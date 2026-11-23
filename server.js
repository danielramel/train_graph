import http from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject } from './public/src/schema.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const LINES_DIR = path.join(ROOT_DIR, 'lines');
const PORT = 3000;

const LINE_ID_PATTERN = /^[a-z0-9-]+$/;
const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
});

const sendJson = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
};

const sendText = (response, status, text) => {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(text);
};

const readRequestBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const lineFilePath = (id) => path.join(LINES_DIR, `${id}.json`);

const readLine = async (id) => {
  const raw = await readFile(lineFilePath(id), 'utf8');
  return { id, ...validateProject(JSON.parse(raw)) };
};

const readAllLines = async () => {
  const entries = await readdir(LINES_DIR);
  const ids = entries
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'))
    .filter((id) => LINE_ID_PATTERN.test(id))
    .sort();
  const loaded = await Promise.all(ids.map(async (id) => [id, await readLine(id)]));
  return Object.fromEntries(loaded);
};

const handleApiRequest = async (request, response, pathname) => {
  if (request.method === 'GET' && pathname === '/api/lines') {
    return sendJson(response, 200, await readAllLines());
  }

  const match = pathname.match(/^\/api\/lines\/([a-z0-9-]+)$/);
  if (!match) return sendJson(response, 404, { error: 'Endpoint not found' });

  const id = match[1];

  if (request.method === 'GET') {
    try {
      return sendJson(response, 200, await readLine(id));
    } catch (error) {
      if (error.code === 'ENOENT') return sendJson(response, 404, { error: `Line "${id}" not found` });
      throw error;
    }
  }

  if (request.method === 'PUT') {
    let parsed;
    try {
      parsed = JSON.parse(await readRequestBody(request));
    } catch {
      return sendJson(response, 400, { error: 'Request body must be valid JSON' });
    }

    let validated;
    try {
      validated = validateProject(parsed);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }

    await writeFile(lineFilePath(id), `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
    return sendJson(response, 200, { id, ...validated });
  }

  return sendJson(response, 405, { error: `Method ${request.method} not allowed` });
};

const handleStaticRequest = async (request, response, pathname) => {
  if (request.method !== 'GET') return sendText(response, 405, 'Method not allowed');

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(PUBLIC_DIR, relativePath);

  if (!resolvedPath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    return sendText(response, 403, 'Forbidden');
  }

  const contentType = MIME_TYPES[path.extname(resolvedPath)];
  if (!contentType) return sendText(response, 415, 'Unsupported media type');

  try {
    const content = await readFile(resolvedPath);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return sendText(response, 404, 'Not found');
    throw error;
  }
};

const handleRequest = async (request, response) => {
  try {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, pathname);
      return;
    }
    await handleStaticRequest(request, response, pathname);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message });
  }
};

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`RailGraph running at http://localhost:${PORT}`);
});