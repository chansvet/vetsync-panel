/*
 * vetsync-panel.src.js 를 북마클릿과 Safari 자동실행 스크립트로 바꾸고,
 * 설치용 HTML 페이지를 만든다.
 *
 *   node build-bookmarklet.js
 */
const fs = require('fs');

const src = fs.readFileSync('vetsync-panel.src.js', 'utf8').replace('/* DOSE_ENGINE */',
  fs.readFileSync('dose-engine.js', 'utf8') + '\nconst doseEngine = createDoseEngine(' + fs.readFileSync('drug-defaults.json', 'utf8') + ');');

// 블록 주석과 줄 전체가 주석인 줄만 걷어낸다. 문자열이나 정규식 안의 // 는 건드리지 않는다.
const stripped = src
  .replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//'))
  .join('\n');

// 한글을 통째로 %XX 로 바꾸면 주소가 세 배로 길어진다. 꼭 필요한 글자만 escape 한다.
const minimalEncode = (s) =>
  s.replace(/[%#"'`?&<>\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase());
const url = 'javascript:' + minimalEncode(stripped + '\nvoid 0;');
fs.writeFileSync('vetsync-panel.bookmarklet.txt', url);

const USERSCRIPT_BASE = 'https://chansvet.github.io/vetsync-panel';
const AUTO_URL = 'https://vetsync4.vetu1.com/?vetsync-panel=1';
const USERSCRIPT_VERSION = '2.1.17';
const userscriptMeta = `// ==UserScript==
// @name         VetSync 처치표 자동 열기
// @namespace    https://github.com/chansvet
// @version      ${USERSCRIPT_VERSION}
// @description  VetSync 화면에 채혈·주사 목록 버튼을 추가합니다. 조회만 하고 차트는 수정하지 않습니다.
// @match        https://vetsync4.vetu1.com/*
// @run-at       document-start
// @inject-into  auto
// @noframes
// @grant        none
// @updateURL    ${USERSCRIPT_BASE}/vetsync-auto.meta.js
// @downloadURL  ${USERSCRIPT_BASE}/vetsync-auto.user.js
// ==/UserScript==`;
const userscript = userscriptMeta + `

(() => {
  const TRIGGER = 'vetsync-panel-auto-open';
  const STARTED_AT = 'vetsync-panel-auto-open-at';
  const AUTH_RETRY = 'vetsync-panel-auth-retry';
  const WAIT_LIMIT_MS = 15 * 60 * 1000;
  if (new URL(location.href).searchParams.get('vetsync-panel') === '1') {
    sessionStorage.setItem(TRIGGER, '1');
    sessionStorage.setItem(STARTED_AT, String(Date.now()));
  };
  const launchPanel = (buttonOnly) => {
    if (buttonOnly) window.__VETSYNC_BUTTON = true;
    else delete window.__VETSYNC_BUTTON;
${stripped.split('\n').map((line) => '    ' + line).join('\n')}
  };
  const ready = () => document.body && !location.pathname.startsWith('/login') && localStorage.getItem('auth-storage');
  const timer = setInterval(() => {
    const autoOpen = sessionStorage.getItem(TRIGGER) === '1';
    if (!autoOpen) {
      if (!ready()) return;
      clearInterval(timer);
      launchPanel(true);
      return;
    }
    const startedAt = Number(sessionStorage.getItem(STARTED_AT)) || Date.now();
    if (Date.now() - startedAt > WAIT_LIMIT_MS) {
      clearInterval(timer);
      sessionStorage.removeItem(TRIGGER);
      sessionStorage.removeItem(STARTED_AT);
      return;
    }
    if (!ready()) return;

    sessionStorage.removeItem(TRIGGER);
    sessionStorage.removeItem(STARTED_AT);
    clearInterval(timer);
    launchPanel(false);

    const watchAuth = setInterval(() => {
      const panel = document.getElementById('vsp');
      if (!panel) {
        clearInterval(watchAuth);
        return;
      }
      const message = panel.textContent || '';
      const expired = /접속이 만료됐습니다|로그인이 안 되어 있습니다|서버 응답 401|병원 접근 오류\(403\)/.test(message);
      if (expired) {
        clearInterval(watchAuth);
        if (sessionStorage.getItem(AUTH_RETRY) !== '1') {
          sessionStorage.setItem(AUTH_RETRY, '1');
          sessionStorage.setItem(TRIGGER, '1');
          sessionStorage.setItem(STARTED_AT, String(Date.now()));
          location.reload();
        } else {
          sessionStorage.removeItem(AUTH_RETRY);
        }
        return;
      }
      if (message && !message.includes('불러오는 중')) {
        sessionStorage.removeItem(AUTH_RETRY);
        clearInterval(watchAuth);
      }
    }, 300);
  }, 300);
})();
`;
fs.writeFileSync('vetsync-auto.user.js', userscript);
fs.writeFileSync('vetsync-auto.meta.js', userscriptMeta + '\n');

const page = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VetSync 인턴 패널 설치</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px 20px 60px; font: 16px/1.6 -apple-system, BlinkMacSystemFont,
         "Apple SD Gothic Neo", "Segoe UI", sans-serif; color: #111827; background: #f9fafb; }
  main { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; margin: 0 0 28px; }
  section { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
            padding: 20px 22px; margin-bottom: 18px; }
  h2 { font-size: 17px; margin: 0 0 12px; }
  ol { margin: 0; padding-left: 20px; }
  li { margin-bottom: 8px; }
  .drag { display: inline-block; background: #0f766e; color: #fff; text-decoration: none;
          padding: 12px 22px; border-radius: 10px; font-weight: 700; margin: 6px 0 12px; }
  .secondary { background: #232a2e; }
  textarea { width: 100%; height: 90px; font: 12px/1.4 ui-monospace, Menlo, monospace;
             border: 1px solid #d1d5db; border-radius: 10px; padding: 10px;
             background: #f9fafb; box-sizing: border-box; }
  button { font: inherit; font-weight: 600; padding: 10px 18px; border: 0; border-radius: 10px;
           background: #0f766e; color: #fff; margin-top: 10px; }
  .note { color: #6b7280; font-size: 14px; }
</style>
</head>
<body>
<main>
  <h1>VetSync 인턴 패널</h1>
  <p class="sub">오늘 채혈과 주사를 조회합니다. 차트를 바꾸지 않습니다.</p>

  <section>
    <h2>자동 업데이트 · 한 번만 설치</h2>
    <p>북마크를 교체하지 않아도 됩니다. 평소 VetSync를 열면 오른쪽 아래에 <b>목록</b> 버튼이 생깁니다.</p>
    <ol>
      <li>병원 컴퓨터 Chrome에서는 <a href="https://www.tampermonkey.net/">Tampermonkey</a>를 한 번 설치합니다.</li>
      <li>아이폰 Safari에서는 <a href="https://apps.apple.com/app/userscripts/id1463298887">Userscripts 앱</a>을 설치하고 Safari 확장 프로그램에서 켭니다.</li>
      <li>아래 파일을 한 번 등록합니다. 확장 프로그램이 주기적으로 새 배포본을 확인합니다.</li>
    </ol>
    <a class="drag secondary" href="vetsync-auto.user.js">자동 업데이트 파일 열기</a>
    <button id="download-js">JS 파일 다운로드</button>
    <textarea id="auto-url" readonly>${AUTO_URL}</textarea>
    <button id="copy-auto">전용 주소 복사</button>
    <p class="note">홈 화면에 추가한 Safari 웹앱에서는 확장 프로그램이 실행되지 않습니다. 아이폰은 일반 Safari에서 사용하고, 업데이트가 즉시 안 보이면 Userscripts의 새로고침을 누르세요.</p>
  </section>

  <section>
    <h2>확장 설치가 어려울 때 · 북마크 방식</h2>
    <p>아래 버튼을 북마크바로 끌어다 놓거나, 아이폰에서는 아래 주소를 복사해 북마크에 등록하세요.</p>
    <a id="bookmarklet-link" class="drag" href="PLACEHOLDER">VetSync 패널</a>
    <p class="note">북마크릿은 VetSync 보안정책상 외부 최신 파일을 자동으로 불러올 수 없습니다. 이 방식은 업데이트할 때마다 아래 주소를 다시 교체해야 합니다.</p>
  </section>

  <section>
    <h2>컴퓨터 Chrome · 사용법</h2>
    <ol>
      <li>VetSync에 로그인합니다.</li>
      <li>북마크바의 <b>VetSync 패널</b>을 누릅니다.</li>
      <li>채혈 또는 주사 탭을 누릅니다. 주소를 다시 입력할 필요는 없습니다.</li>
    </ol>
  </section>

  <section>
    <h2>아이폰 Safari · 북마크 방식</h2>
    <ol>
      <li>아래 <b>주소 복사</b>를 누릅니다.</li>
      <li>Safari에서 아무 페이지나 북마크에 추가합니다. 이름은 <b>VetSync 패널</b>로 합니다.</li>
      <li>북마크 목록에서 <b>편집</b>을 누르고 방금 만든 북마크를 엽니다.</li>
      <li>주소 칸을 전부 지우고 복사한 것을 붙여넣습니다.</li>
      <li>이후에는 VetSync에 로그인하고 북마크의 <b>VetSync 패널</b>을 누릅니다.</li>
    </ol>
    <textarea id="code" readonly></textarea>
    <button id="copy">주소 복사</button>
  </section>

  <section>
    <h2>안 될 때</h2>
    <p class="note">VetSync 화면이 아닌 곳에서 누르면 안내창이 뜹니다. 로그인이 풀렸으면 다시 로그인한 뒤 누르세요. 접속 토큰은 15분마다 갱신되므로 화면을 열어둔 채로 쓰면 문제없습니다.</p>
  </section>
<p><a href="rollback/">이전 버전 1.0.22로 복구</a></p>
</main>
<script>
  const url = document.getElementById('bookmarklet-link').getAttribute('href');
  document.getElementById('code').value = url;
  document.getElementById('copy-auto').onclick = async (e) => {
    document.getElementById('auto-url').select();
    try { await navigator.clipboard.writeText('${AUTO_URL}'); e.target.textContent = '복사됨'; }
    catch (_) { e.target.textContent = '길게 눌러 복사하세요'; }
  };
  document.getElementById('download-js').onclick = async (e) => {
    try {
      const response = await fetch('vetsync-auto.user.js?download=' + Date.now());
      if (!response.ok) throw new Error('download failed');
      const blob = new Blob([await response.text()], { type: 'application/javascript' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'vetsync-auto.user.js';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      e.target.textContent = '다운로드됨';
    } catch (_) {
      e.target.textContent = '다운로드 실패';
    }
  };
  document.getElementById('copy').onclick = async (e) => {
    document.getElementById('code').select();
    try { await navigator.clipboard.writeText(url); e.target.textContent = '복사됨'; }
    catch (_) { e.target.textContent = '길게 눌러 복사하세요'; }
  };
</script>
</body>
</html>
`.replace('PLACEHOLDER', url.replace(/"/g, '&quot;'));

fs.writeFileSync('bookmarklet-install.html', page);
fs.writeFileSync('index.html', page);
// Chrome 확장으로도 같은 코드를 내보낸다. 화면 구석에 버튼을 띄우는 모드로 켜 둔다.
const extDir = 'vetsync-extension';
fs.mkdirSync(extDir, { recursive: true });
fs.writeFileSync(
  extDir + '/content.js',
  '// build-bookmarklet.js 가 생성한 파일이다. 직접 고치지 말고 vetsync-panel.src.js 를 고칠 것.\n' +
    'window.__VETSYNC_BUTTON = true;\n' +
    stripped + '\n'
);
fs.writeFileSync(
  extDir + '/manifest.json',
  JSON.stringify(
    {
      manifest_version: 3,
      name: 'VetSync 인턴 패널',
      version: '1.0.0',
      description: '입원 차트에서 아침 채혈 목록과 오후 주사 목록을 뽑아 보여준다. 조회만 한다.',
      content_scripts: [
        {
          matches: ['https://vetsync4.vetu1.com/*'],
          js: ['content.js'],
          run_at: 'document_idle',
          world: 'MAIN',
        },
      ],
    },
    null,
    2
  ) + '\n'
);

console.log('bookmarklet 길이:', url.length, '자 / 자동실행 파일:', userscript.length, '자');
console.log('확장 생성:', extDir + '/manifest.json, ' + extDir + '/content.js');
