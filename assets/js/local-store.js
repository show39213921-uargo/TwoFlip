// 브라우저 저장소(localStorage)에 신청 목록을 둔다 — 서버 없이 화면만으로 흐름을 확인하는 테스트 모드용.
// 이 브라우저에만 남는다. 다른 사람·다른 기기에는 보이지 않는다.
//
// · 저장값이 깨져 있으면 덮어쓰지 않는다(쓰기는 오류). 지우는 건 관리자 화면에서 사람이 고른다.
// · 사생활 모드 등으로 저장소를 못 쓰면 읽기는 빈 목록, 쓰기는 이유를 담은 오류.

export const STORAGE_KEY = 'twoflip.demo.applications.v1';

export function createLocalStore(storage, key = STORAGE_KEY) {
  let corrupt = false;

  function read() {
    let raw;
    try { raw = storage.getItem(key); } catch { return { ok: false, rows: [] }; }
    if (raw == null) { corrupt = false; return { ok: true, rows: [] }; }
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error('not array');
      corrupt = false;
      return { ok: true, rows: data };
    } catch {
      corrupt = true;
      return { ok: true, rows: [] };
    }
  }

  function write(rows) {
    try {
      storage.setItem(key, JSON.stringify(rows));
    } catch {
      throw new Error('브라우저 저장소를 쓸 수 없습니다(사생활 보호 모드이거나 저장 공간이 꽉 찼을 수 있습니다).');
    }
  }

  function mutate(fn) {
    const r = read();
    if (!r.ok) throw new Error('브라우저 저장소를 읽을 수 없습니다(사생활 보호 모드일 수 있습니다).');
    if (corrupt) throw new Error('저장된 테스트 데이터가 깨져 있습니다. 관리자 화면에서 「이 브라우저 데이터 비우기」로 초기화해 주세요.');
    const next = fn(r.rows.slice());
    write(next);
    return next;
  }

  return {
    list: () => read().rows,
    isCorrupt: () => { read(); return corrupt; },
    create: (record) => { mutate((rows) => [...rows, record]); return record; },
    update: (id, patch) => mutate((rows) => rows.map((r) => (r && r.id === id ? { ...r, ...patch } : r))).find((r) => r && r.id === id),
    remove: (id) => { mutate((rows) => rows.filter((r) => r && r.id !== id)); },
    replaceAll: (records) => { mutate(() => (Array.isArray(records) ? records : []).filter((r) => r && r.id)); },
    clear: () => {
      try { storage.removeItem(key); } catch { /* 지울 수 없으면 그대로 */ }
      corrupt = false;
    },
  };
}

// 브라우저의 localStorage — 접근 자체가 막힌 환경에서도 죽지 않게 감싼다.
export function browserStorage() {
  try {
    const s = globalThis.localStorage;
    if (s) return s;
  } catch { /* 접근 거부 */ }
  return { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); }, removeItem() {} };
}
