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

assert.match(source, /@version\s+1\.0\.9/);
assert.match(source, /@inject-into\s+auto/);
assert.doesNotMatch(source, /@weight/);
assert.doesNotMatch(source, /vsp-launcher/);

console.log('VetSync 자동실행 복구 테스트 통과');
