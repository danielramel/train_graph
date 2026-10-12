import http from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const linesDirectory = path.join(root, 'lines');
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function readLines() {
  const files = (await readdir(linesDirectory)).filter((file) => file.endsWith('.js')).sort();
  const entries = await Promise.all(files.map(async (file) => {
    const context = { window: { railGraphLines: {} } };
    vm.runInNewContext(await readFile(path.join(linesDirectory, file), 'utf8'), context, { timeout: 1000 });
    const id = path.basename(file, '.js');
    const project = context.window.railGraphLines[id];
    return project ? [id, { ...project, id }] : null;
  }));
  return Object.fromEntries(entries.filter(Boolean));
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
  return true;
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/lines') return json(response, 200, await readLines());
  const match = pathname.match(/^\/api\/lines\/([a-z0-9-]+)$/);
  if (!match) return false;
  const id = match[1];
  if (request.method === 'GET') {
    const lines = await readLines();
    return lines[id] ? json(response, 200, lines[id]) : json(response, 404, { error: 'Line not found' });
  }
  if (request.method !== 'PUT') return false;
  let body = '';
  for await (const chunk of request) body += chunk;
  const project = JSON.parse(body);
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    return json(response, 400, { error: 'Project must be an object' });
  }
  project.name ||= id;
  await writeFile(
    path.join(linesDirectory, `${id}.js`),
    `window.railGraphLines = window.railGraphLines || {};\nwindow.railGraphLines[${JSON.stringify(id)}] = ${JSON.stringify(project, null, 2)};\n`,
    'utf8',
  );
  return json(response, 200, { ...project, id });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname.startsWith('/api/')) {
      if (await handleApi(request, response, requestUrl.pathname)) return;
      return json(response, 404, { error: 'Not found' });
    }
    const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const filePath = path.resolve(root, `.${requestedPath}`);
    if (!filePath.startsWith(`${root}${path.sep}`)) return response.writeHead(403).end();
    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return response.writeHead(404).end('Not found');
    console.error(error);
    json(response, 500, { error: 'Server error' });
  }
});

server.listen(port, () => console.log(`RailGraph running at http://localhost:${port}`));
