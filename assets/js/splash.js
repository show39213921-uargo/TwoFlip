// 처음 진입 스플래시 — 검은 화면 가운데 TWOFLIP(twoflip-splash.svg)을 잠깐 보이고,
// 같은 자리에 워드마크(twoflip-logo-white.svg)를 겹친 뒤 헤더 로고 자리로 옮겨 붙인다.
//
// 켜는 조건은 index.html 머리의 한 줄 스크립트가 정한다(html.splash-on: 이 탭 첫 진입 · 움직임 줄이기 아님).
// 클릭·키 입력이면 바로 끝낸다. JS 가 안 돌거나 여기서 실패해도 CSS 가 3초 뒤 스플래시를 걷고 헤더 로고를 보인다.

const SEEN_KEY = 'twoflip.splash.seen';
const HOLD_MS = 650;   // 가운데 TWOFLIP 을 보여 주는 시간
const FLY_MS = 650;    // 헤더로 옮겨 가는 시간(app.css .splash-fly 와 같게)

// 두 SVG 의 글자 자리 — 스플래시: 945×2048 중 가운데(472.5) · 기준선 950 / 로고: 500×80 중 가운데(250) · 기준선 52
const ART = { w: 945, h: 2048, cx: 472.5, base: 950 };
const LOGO = { w: 500, h: 80, cx: 250, base: 52 };

const root = document.documentElement;
const splash = document.getElementById('splash');
const target = document.querySelector('.site-header .logo-word');

let done = false;
function finish() {
  if (done) return;
  done = true;
  root.classList.remove('splash-on'); // 헤더 로고가 보이고 스플래시는 사라진다
  splash.remove();
  document.querySelector('.splash-fly')?.remove();
  removeEventListener('keydown', finish);
}

function fly() {
  if (done) return;
  const W = innerWidth;
  const H = innerHeight;
  const s = Math.min(W / ART.w, H / ART.h); // object-fit: contain 배율
  const left = (W - ART.w * s) / 2 + (ART.cx - LOGO.cx) * s;
  const top = (H - ART.h * s) / 2 + (ART.base - LOGO.base) * s;

  const el = target.cloneNode();
  el.className = 'splash-fly';
  el.alt = '';
  Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${LOGO.w * s}px`, height: `${LOGO.h * s}px`, margin: '0', opacity: '0' });
  document.body.append(el);
  void el.offsetWidth; // 시작 상태를 확정해야 전환이 걸린다(requestAnimationFrame 은 화면이 안 그려지는 탭에서 멈춰서 안 쓴다)

  // 1) 같은 자리에서 스플래시 글자 → 워드마크로 바꿔 끼우기
  el.style.opacity = '1';
  splash.querySelector('.splash-art').style.opacity = '0';
  // 2) 헤더 로고 자리로
  setTimeout(() => {
    if (done) return;
    const r = target.getBoundingClientRect();
    el.style.transform = `translate(${r.left - left}px, ${r.top - top}px) scale(${r.height / (LOGO.h * s)})`;
    splash.classList.add('leaving');
    setTimeout(finish, FLY_MS + 50);
  }, 180);
}

if (root.classList.contains('splash-on') && splash && target) {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* 저장 못 하면 다음에도 보인다 */ }
  splash.addEventListener('click', finish);
  addEventListener('keydown', finish);
  const art = splash.querySelector('.splash-art');
  const start = () => setTimeout(fly, HOLD_MS);
  if (art.complete && art.naturalWidth) start();
  else {
    art.addEventListener('load', start, { once: true });
    art.addEventListener('error', finish, { once: true });
  }
} else if (splash) {
  splash.remove();
}
