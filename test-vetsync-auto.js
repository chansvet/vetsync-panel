const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('vetsync-auto.user.js', 'utf8');

const storage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

const sessionA = storage();
const timers = [];
vm.runInNewContext(source, {
  URL,
  Date,
  location: {
    href: 'https://vetsync4.vetu1.com/login?vetsync-panel=1#vetsync-panel',
    hash: '#vetsync-panel',
    hostname: 'vetsync4.vetu1.com',
    pathname: '/login',
  },
  localStorage: storage(),
  sessionStorage: sessionA,
  document: { body: null, getElementById: () => null },
  setInterval: (callback) => { timers.push(callback); return timers.length; },
  clearInterval: () => {},
});
assert.strictEqual(sessionA.getItem('vetsync-panel-auto-open'), '1');
assert.ok(Number(sessionA.getItem('vetsync-panel-auto-open-at')) > 0);
assert.strictEqual(timers.length, 1);

assert.match(source, /@version\s+1\.0\.19/);
assert.match(source, /@inject-into\s+auto/);
assert.doesNotMatch(source, /@weight/);
assert.doesNotMatch(source, /vsp-launcher/);
assert.doesNotMatch(source, /MONITOR_INTERVAL|Notification|pollChanges/);
assert.match(source, /새로 확인/);
assert.match(source, /처치 업데이트/);
assert.match(source, /오늘 첫 확인 · 기준 목록 저장됨/);
assert.match(source, /이전 확인/);
assert.match(source, /제외:/);
assert.doesNotMatch(source, /마지막 시간 취소/);

console.log('VetSync 자동실행 복구 테스트 통과');
