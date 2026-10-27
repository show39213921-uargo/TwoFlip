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

// 26차 U-3 — 고객 페이지 5개의 푸터 메뉴는 같은 넷 · 같은 순서. 지금 페이지만 aria-current="page", 404 는 경로가 / 로 시작하고 현재 표시 없음.
const FOOTER = [['./', '신청하기'], ['about.html', '소개'], ['shop.html', '바로 구매'], ['status.html', '신청한 상품 확인하기']];
const FOOTER_PAGES = { 'index.html': './', 'about.html': 'about.html', 'shop.html': 'shop.html', 'status.html': 'status.html', '404.html': null };

function footerLinks(html) {
  const nav = html.match(/<nav class="footer-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, '푸터 메뉴(.footer-nav)가 없음');
  return [...nav[1].matchAll(/<a\s+([^>]*)>([^<]*)<\/a>/g)].map(([, attrs, text]) => ({
    href: (attrs.match(/href="([^"]*)"/) || [])[1],
    current: /aria-current="page"/.test(attrs),
    text: text.trim(),
  }));
}

test('푸터 메뉴를 가진 페이지는 고객 페이지 5개다', () => {
  const withFooter = pages.filter((p) => /class="footer-nav"/.test(readFileSync(p, 'utf8'))).sort();
  assert.deepEqual(withFooter, Object.keys(FOOTER_PAGES).sort());
});

for (const [page, self] of Object.entries(FOOTER_PAGES)) {
  test(`${page} 푸터 메뉴 넷이 같은 순서 · 지금 페이지만 aria-current`, () => {
    const links = footerLinks(readFileSync(page, 'utf8'));
    const toHref = (h) => (page === '404.html' ? (h === './' ? '/' : `/${h}`) : h);
    assert.deepEqual(links.map((l) => l.text), FOOTER.map(([, t]) => t));
    assert.deepEqual(links.map((l) => l.href), FOOTER.map(([h]) => toHref(h)));
    assert.deepEqual(links.filter((l) => l.current).map((l) => l.href), self ? [self] : []);
  });
}
