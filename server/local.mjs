import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleRequest } from './recommend.mjs';
import health from '../api/health.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname === '/api/recommend' || url.pathname === '/api/health') {
      let body = '', size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8000) { res.writeHead(413); res.end('Request too large'); return; }
        body += chunk;
      }
      const request = new Request(url, { method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body } : {}) });
      const response = url.pathname === '/api/health' ? health.fetch(request) : await handleRequest(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/^dist\//, '');
    if (!relative || relative === 'dist') relative = 'index.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root) || !types[path.extname(target)]) { res.writeHead(404); res.end(); return; }
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('Mereke: http://localhost:' + server.address().port));
