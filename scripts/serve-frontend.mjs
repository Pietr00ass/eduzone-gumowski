import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4173);
const ROOT_DIR = normalize(join(process.cwd(), 'frontend'));

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolveRequestPath(urlPath) {
  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  const decodedPath = decodeURIComponent(cleanPath);
  const absolutePath = normalize(join(ROOT_DIR, decodedPath));

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
    return join(absolutePath, 'index.html');
  }

  return absolutePath;
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);
  const filePath = resolveRequestPath(requestUrl.pathname);

  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  if (extname(filePath) === '.html') {
    response.end(await readFile(filePath));
    return;
  }

  createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend HTTP server running at http://${HOST}:${PORT}`);
  console.log(`Serving files from ${ROOT_DIR}`);
});
