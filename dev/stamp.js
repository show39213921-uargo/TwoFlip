// 배포 때 CSS·JS 주소에 버전(?v=커밋)을 붙인다 — GitHub Pages 는 파일을 10분(max-age=600) 캐시해서,
// 배포 직후 새 HTML 과 옛 CSS·JS 가 섞일 수 있다(7차 QA U-3). 모듈끼리의 import 도 같은 버전으로 붙여야
// 옛 모듈이 섞이지 않는다. 레포 파일은 그대로 두고, 배포용 복사본(_site)에만 적용한다.
//   node dev/stamp.js _site <버전>

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// <link href="assets/css/app.css"> · <script src="/assets/js/app.js"> → …?v=버전 (이미 ?가 있으면 그대로)
export function stampHtml(html, v) {
  return html.replace(/((?:href|src)=")(\/?assets\/[^"?#]+\.(?:css|js))(")/g, `$1$2?v=${v}$3`);
}

// import … from './api.js' · import './x.js' → './api.js?v=버전'
export function stampJs(js, v) {
  return js.replace(/((?:\bfrom|\bimport)\s*')(\.{1,2}\/[^'?#]+\.js)(')/g, `$1$2?v=${v}$3`);
}

async function main() {
  const [dir, version] = process.argv.slice(2);
  if (!dir || !version) { console.error('사용법: node dev/stamp.js <배포 폴더> <버전>'); process.exit(2); }
  const v = encodeURIComponent(version.slice(0, 12));
  let n = 0;
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.html'))) {
    const p = path.join(dir, f);
    await writeFile(p, stampHtml(await readFile(p, 'utf8'), v));
    n++;
  }
  const jsDir = path.join(dir, 'assets', 'js');
  for (const f of (await readdir(jsDir)).filter((x) => x.endsWith('.js'))) {
    const p = path.join(jsDir, f);
    await writeFile(p, stampJs(await readFile(p, 'utf8'), v));
    n++;
  }
  console.log(`버전 ${v} — 파일 ${n}개`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) main();
