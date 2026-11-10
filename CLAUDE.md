# VetSync 인턴 패널

이 저장소는 GitHub `chansvet/vetsync-panel`과 연결되어 있고 GitHub Pages로 배포된다.
2026년 11월부터 Claude만 수정한다. 그래도 작업 전에 `git pull`로 최신 상태를 확인한다.

## 먼저 읽을 것

- `README.md`: 기능과 생성 파일 설명
- `HANDOFF.md`: 41일치 실제 차트로 검증한 분류 규칙과 함정. 규칙을 바꾸기 전에 반드시 읽는다.
- `V2.md`: 2차 개편 메모

## 원본과 생성물

원본은 `vetsync-panel.src.js` 하나다. 나머지는 `node build-bookmarklet.js`가 만든다.
`index.html`, `bookmarklet-install.html`, `vetsync-panel.bookmarklet.txt`,
`vetsync-auto.user.js`, `vetsync-auto.meta.js`, `vetsync-extension/`은 직접 고치지 않는다.

## 수정 절차

1. `git pull`
2. `vetsync-panel.src.js` 수정
3. `node build-bookmarklet.js`
4. 테스트: `node test-vetsync-panel.js`, `node test-dose.js`, `node test-flk-ui.js`, `node test-vetsync-auto.js`, `node test-recognition.js`
5. 유저스크립트 자동 업데이트를 위해 `@version`을 올린다 (build-bookmarklet.js 안)
6. 커밋 후 `git push`. Pages 반영까지 1~2분 걸린다.

## 실제 데이터 검증

VetSync API는 vetsync4.vetu1.com 페이지 안에서만 호출된다(CORS, CSP). 로컬 서버나
외부 스크립트를 페이지에 주입할 수 없다. 검증은 로그인된 페이지에서 직접 콘솔로 한다.
GET만 보낸다. 차트를 수정하는 요청은 절대 보내지 않는다.
