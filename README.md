# VetSync 인턴 패널

VetSync 입원 차트에서 아침 채혈 목록과 오후 주사 목록을 읽기 전용으로 정리하는 개인용 도구다.
차트 수정 요청은 보내지 않으며, 로그인된 VetSync 페이지 안에서만 실행된다.

## 생성

```sh
node build-bookmarklet.js
```

`vetsync-panel.src.js`에서 아래 파일을 생성한다.

- `index.html`: 설치 안내 페이지
- `vetsync-panel.bookmarklet.txt`: Safari/Chrome 북마크 주소. VetSync 보안정책상 북마크릿은 업데이트마다 다시 설치해야 한다.
- `vetsync-auto.user.js`, `vetsync-auto.meta.js`: Tampermonkey/Userscripts용 자동 업데이트 파일. 일반 VetSync 화면에 목록 버튼을 추가한다.
- `vetsync-extension/`: Chrome 확장 프로그램 파일

## 주사 준비 기록

주사 탭의 시간 선택으로 특정 시간의 처치와 앰플·주사기 집계를 볼 수 있다.
환자 이름 옆 체크는 환자 전체의 **주사 준비 완료**이며 VetSync 원본 차트를 수정하지 않는다.
시간 필터와 무관하게 전체 처치의 준비 기록을 저장한다. 완료된 처치는 흐리게 표시하고,
완료 후 추가되거나 변경된 처치는 체크를 유지한 채 선명하게 표시한다.
기록은 같은 브라우저의 병원·조회 날짜별로 저장된다. 기기 간 동기화는 하지 않는다.
준비 이후 용량·경로·희석·시간이 바뀌거나 처치가 제외되어도 체크는 유지하고,
기존 준비 내용과 현재 처치를 함께 표시한다. 해당 주사의 `변경 확인`은 실제 준비물을
확인한 뒤 누른다. 목록 상단의 `변경 확인`과 준비 기록은 서로 독립적이다.

## 검사

```sh
node test-vetsync-panel.js
node test-vetsync-auto.js
```
