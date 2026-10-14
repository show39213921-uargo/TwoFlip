import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stampHtml, stampJs } from '../dev/stamp.js';

test('배포 버전 붙이기 — HTML 의 CSS·JS 주소(상대 · / 시작), 이미 ? 가 있거나 외부 주소면 그대로', () => {
  const html = '<link rel="stylesheet" href="assets/css/app.css"><script type="module" src="assets/js/app.js"></script>'
    + '<link rel="stylesheet" href="/assets/css/app.css"><img src="assets/img/a.svg"><link href="https://cdn.x/y.css"><script src="assets/js/z.js?v=1"></script>';
  assert.equal(stampHtml(html, 'abc'),
    '<link rel="stylesheet" href="assets/css/app.css?v=abc"><script type="module" src="assets/js/app.js?v=abc"></script>'
    + '<link rel="stylesheet" href="/assets/css/app.css?v=abc"><img src="assets/img/a.svg"><link href="https://cdn.x/y.css"><script src="assets/js/z.js?v=1"></script>');
});

test('배포 버전 붙이기 — 모듈 import(./ · ../), 다른 문자열은 그대로', () => {
  const js = "import { a } from './api.js';\nimport './side.js';\nimport { b } from '../x/y.js';\nconst u = 'assets/demo/s.json';\nfetch('./not-import.js');";
  assert.equal(stampJs(js, 'abc'), "import { a } from './api.js?v=abc';\nimport './side.js?v=abc';\nimport { b } from '../x/y.js?v=abc';\nconst u = 'assets/demo/s.json';\nfetch('./not-import.js');");
});
