# VetSync 인턴 패널

VetSync 입원 차트에서 아침 채혈 목록과 오후 주사 목록을 읽기 전용으로 정리하는 개인용 도구다.
차트 수정 요청은 보내지 않으며, 로그인된 VetSync 페이지 안에서만 실행된다.

## 생성

```sh
node build-bookmarklet.js
```

`vetsync-panel.src.js`에서 아래 파일을 생성한다.

- `index.html`: 설치 안내 페이지
- `vetsync-panel.bookmarklet.txt`: 예전 방식의 전체 북마크 주소. 현재는 설치 페이지의 자동 업데이트 북마크를 한 번만 등록하는 방식을 권장한다.
- `vetsync-panel.latest.js`: 자동 업데이트 북마크가 매번 불러오는 최신 패널 코드.
- `vetsync-auto.user.js`, `vetsync-auto.meta.js`: Tampermonkey/Userscripts용 자동 업데이트 파일. 일반 VetSync 화면에 목록 버튼을 추가한다.
- `vetsync-extension/`: Chrome 확장 프로그램 파일

## 검사

```sh
node test-vetsync-panel.js
node test-vetsync-auto.js
```
