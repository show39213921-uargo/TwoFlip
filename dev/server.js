// 로컬 개발 서버 — 정적 페이지만 서빙한다. 의존성 없음. 배포되지 않는다.
//
// 신청·미리보기 API 는 백엔드 레포(twoflip_backend)가 맡는다. 로컬에서는 둘을 같이 띄운다:
//   TwoFlip          npm run dev   → http://localhost:4400
//   twoflip_backend  npm start     → http://localhost:4410  (CORS 에 localhost:4400 허용)
// assets/js/config.js 가 localhost 에서는 자동으로 4410 을 부른다.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 4400;

// 배포되는 것과 같은 범위만 서빙한다(.github/workflows/pages.yml 의 복사 목록과 맞춘다).
const PUBLIC = [/^\/(index|about|shop|admin|404)\.html$/, /^\/assets\/[\w./-]+$/];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// 없는 주소 — GitHub Pages 처럼 404.html 을 보여 준다
async function notFound(res) {
  try { send(res, 404, await readFile(path.join(ROOT, '404.html')), TYPES['.html']); } catch { send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return send(res, 400, 'Bad request', 'text/plain'); }
  if (p === '/') p = '/index.html';
  if (p.includes('..') || !PUBLIC.some((re) => re.test(p))) return notFound(res);
  try {
    send(res, 200, await readFile(path.join(ROOT, p)), TYPES[path.extname(p)] || 'application/octet-stream');
  } catch {
    notFound(res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TwoFlip front → http://localhost:${PORT}  (API: http://localhost:4410 — twoflip_backend 를 같이 띄울 것)`);
});
