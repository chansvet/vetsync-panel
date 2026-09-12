# VetSync 인턴 패널

VetSync 입원 차트에서 아침 채혈 목록과 오후 주사 목록을 읽기 전용으로 정리하는 개인용 도구다.
차트 수정 요청은 보내지 않으며, 로그인된 VetSync 페이지 안에서만 실행된다.

## 생성

```sh
node build-bookmarklet.js
```

`vetsync-panel.src.js`에서 아래 파일을 생성한다.

- `index.html`: 설치 안내 페이지
- `vetsync-panel.bookmarklet.txt`: Safari/Chrome 북마크 주소
- `vetsync-auto.user.js`, `vetsync-auto.meta.js`: Userscripts용 자동실행 파일
- `vetsync-extension/`: Chrome 확장 프로그램 파일

## 검사

```sh
node test-vetsync-panel.js
node test-vetsync-auto.js
```
