import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// 레포 맨 위 페이지(*.html)는 배포 복사 목록(pages.yml)과 로컬 서버 공개 목록(dev/server.js)에 모두 있어야 한다.
// 새 페이지를 만들고 한쪽만 고치면 로컬에선 되는데 배포에선 404 가 난다(about.html 추가 때 — 개편 A-2).
const pages = readdirSync('.').filter((f) => f.endsWith('.html')).sort();
const yml = readFileSync('.github/workflows/pages.yml', 'utf8');
const server = readFileSync('dev/server.js', 'utf8');

test('맨 위 페이지 목록에 소개 페이지가 있다', () => {
  assert.ok(pages.includes('about.html'));
  assert.ok(pages.includes('index.html'));
});

test('모든 맨 위 페이지가 배포 복사 목록에 있다', () => {
  const line = yml.split('\n').find((l) => /\bcp\s+index\.html\b/.test(l)) || '';
  const copied = line.trim().split(/\s+/);
  for (const p of pages) assert.ok(copied.includes(p), `pages.yml 에 ${p} 없음`);
});

test('모든 맨 위 페이지를 로컬 서버가 보여 준다', () => {
  const m = server.match(/const PUBLIC = \[\/\^\\\/\(([a-z0-9|]+)\)\\\.html\$\//);
  assert.ok(m, 'dev/server.js 의 PUBLIC 페이지 목록을 못 찾음');
  const names = m[1].split('|');
  for (const p of pages) assert.ok(names.includes(p.replace(/\.html$/, '')), `dev/server.js 에 ${p} 없음`);
});
