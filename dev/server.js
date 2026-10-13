// 로컬 개발 서버 — 정적 페이지 + 목업 신청 API. 의존성 없음.
//
// 실제 API(테스트 엔드포인트)가 오기 전까지 페이지를 끝까지 돌려 보기 위한 것이다. 배포되지 않는다.
// 목업은 docs/api-contract.md 의 응답 모양을 그대로 따른다 — 실제 API 와 어긋나면 이 파일을 계약에 맞춘다.
// 저장은 dev/data/applications.json (git 제외). 127.0.0.1 에만 붙는다.
//
//   npm run dev            → http://localhost:4400
//   PORT=4401 npm run dev

import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateApplication } from '../assets/js/validate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'dev', 'data', 'applications.json');
const PORT = Number(process.env.PORT) || 4400;
const MAX_BODY = 16 * 1024;

// 배포되는 것과 같은 범위만 서빙한다(.github/workflows/pages.yml 의 복사 목록과 맞춘다).
const PUBLIC = [/^\/index\.html$/, /^\/assets\/[\w./-]+$/];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const apiError = (code, message, extra) => ({ error: { code, message, ...extra } });

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function loadApplications() {
  try { return JSON.parse(await readFile(DATA_FILE, 'utf8')); } catch { return []; }
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, mock: true });

  if (pathname === '/api/applications' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (e) {
      if (e.status === 413) return send(res, 413, apiError('too_large', '요청이 너무 큽니다.'));
      return send(res, 400, apiError('bad_json', 'JSON 본문이 필요합니다.'));
    }
    // 서버는 페이지 검증을 믿지 않고 다시 검증한다.
    const v = validateApplication(body);
    if (!v.ok) return send(res, 422, apiError('invalid', Object.values(v.errors)[0] || '입력값을 확인해 주세요.', { fields: v.errors }));

    const record = { id: randomUUID().slice(0, 8), status: 'received', receivedAt: new Date().toISOString(), ...v.payload };
    const all = await loadApplications();
    all.push(record);
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(all, null, 2));
    console.log(`[mock] 신청 저장 ${record.id} · product ${record.kreamProductId} · size ${record.size}`);
    return send(res, 201, { id: record.id, status: record.status, receivedAt: record.receivedAt });
  }

  return send(res, 404, apiError('not_found', '없는 API 입니다.'));
}

async function handleStatic(res, pathname) {
  const p = pathname === '/' ? '/index.html' : pathname;
  if (p.includes('..') || !PUBLIC.some((re) => re.test(p))) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  try {
    const buf = await readFile(path.join(ROOT, p));
    send(res, 200, buf, TYPES[path.extname(p)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) await handleApi(req, res, pathname);
    else await handleStatic(res, decodeURIComponent(pathname));
  } catch (e) {
    console.error('[dev]', e);
    send(res, 500, apiError('internal', '서버 오류'));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TwoFlip dev → http://localhost:${PORT}  (목업 API: /api/health, POST /api/applications)`);
});
