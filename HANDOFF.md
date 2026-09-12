# VetSync 인턴 도구 인수인계

이 문서는 새 AI 대화를 시작할 때 맨 처음 붙여넣는 용도다. 여기 적힌 규칙과 함정은
2026년 8월 1일부터 9월 10일까지 41일치 실제 차트 데이터로 검증한 결과다.
임의로 바꾸면 이미 해결한 버그가 다시 들어간다.

## 무엇을 하는 도구인가

동물병원 입원 관리 시스템 VetSync(https://vetsync4.vetu1.com)에서 인턴 업무 두 가지를
자동으로 뽑는다.

1. **아침 채혈 목록.** 그날 오전 9시에 예정된 혈액검사를 환자별로 정리한다.
   출근해서 입원장 앞에 적어놓는 용도다.
2. **오후 주사 목록.** 오후 3~4시에 돌려서 그날 17시부터 다음날 15시까지 나갈
   주사를 뽑는다. 미리 시린지를 준비하는 용도다.

## 파일 구성

- `vetsync-panel.src.js` — 채혈과 주사를 탭으로 넘겨 보는 통합 패널. 북마클릿 원본이다.
- `build-bookmarklet.js` — 위 원본을 북마크에 넣을 수 있는 한 줄 주소로 만들고
  설치용 HTML을 생성한다. `node build-bookmarklet.js` 로 돌린다.
- `bookmarklet-install.html` — 생성된 설치 안내 페이지. 컴퓨터는 드래그, 아이폰은 복사 후 붙여넣기.
- `vetsync-auto.user.js` — 아이폰 Safari의 Userscripts 확장용 자동실행 파일. 전용 URL로
  VetSync를 열었을 때만 패널을 자동으로 띄운다.
- `vetsync-bloodwork.js` — 채혈만 뽑는 콘솔 전용 스크립트.
- `vetsync-injections.js` — 주사만 뽑는 콘솔 전용 스크립트.

패널과 개별 스크립트는 같은 규칙을 쓴다. 규칙을 고치면 세 파일을 모두 고쳐야 한다.

## API와 인증

VetSync는 화면 뒤에서 REST API를 쓴다. 조회는 전부 GET이라 차트를 건드릴 위험이 없다.
쓰기 요청은 절대 보내지 않는다.

```
GET https://api-vetsync4.vetu1.com/api/v1/charts?date=YYYY-MM-DD
GET https://api-vetsync4.vetu1.com/api/v1/charts/{chartId}
```

헤더 두 개가 필요하다.

```
Authorization: Bearer <토큰>
X-Hospital-Id: 24
```

토큰은 `localStorage['auth-storage']` 안의 `state.accessToken` 에 있다.
**유효기간이 15분이고 세션 중에 계속 회전한다.** 그래서 실행할 때마다 다시 읽어야 한다.
한 번 읽어서 변수에 담아두고 오래 쓰면 401이 난다. 401이 나면 페이지를 새로고침하면 된다.

이 API는 다른 도메인에서 호출할 수 없다. CORS가 막혀 있어서 GitHub Pages 같은 곳에
올려도 동작하지 않는다. 반드시 vetsync4.vetu1.com 페이지 안에서 실행해야 한다.
브라우저는 다른 도메인의 localStorage를 읽을 수 없으므로 토큰도 가져올 수 없다.

## 아이폰 원터치 실행

Safari Userscripts와 단축어를 이용한 자동실행은 실험적 기능이다. 단축어는
`https://vetsync4.vetu1.com/?vetsync-panel=1` 을 Safari로 연다. 실행 신호는 해당 Safari 탭의
`sessionStorage`에 최대 15분만 보관한다. Userscripts가 Safari의 로그인 페이지 저장소에 접근하지 못하면
자동실행할 수 없다.

홈 화면에 추가한 웹앱은 Safari 확장 프로그램을 실행하지 않으며, GitHub Pages도 VetSync 로그인 저장소를
읽을 수 없다. 따라서 아이폰에서 지원하는 정상 사용 경로는 VetSync에 Safari로 로그인한 뒤, 같은 Safari에서
`javascript:` 북마크를 직접 누르는 방식이다. 자동실행이 실패해도 화면 구석 버튼이나 별도 실행 페이지를
전제로 안내하지 않는다.

자동실행 파일도 `build-bookmarklet.js`가 `vetsync-panel.src.js`에서 생성한다. 판정 규칙을
수정할 때는 `USERSCRIPT_VERSION`을 올린 뒤 `node build-bookmarklet.js`를 실행한다.
북마클릿, 자동실행 파일, 업데이트 확인 파일이 함께 갱신된다.

## 응답 구조

`/charts?date=` 는 그날 차트 목록을 준다. 각 항목에 `chartId`, `patient`(이름, 병원환자번호,
품종 등), `cageLabel`, `discharged` 가 들어 있다.

`/charts/{chartId}` 는 차트 하나의 전체 내용을 준다. 구조는 이렇다.

```
sections[]           section 이 FIXED / FLUID / DIET / TREATMENT 중 하나
  rows[]             처치 항목 한 줄
    displayName      항목 이름. 주치의가 자유롭게 쓴 텍스트다.
    instructionText  항목에 붙은 지시사항. 대부분 null 이다.
    measurementRole  체온은 TEMPERATURE
    cells[]          시간대별 칸
      hourSlot       0~23
      status         PLANNED / COMPLETED / IN_PROGRESS / SKIPPED / NO_PLAN
      resultSlots[]  입력된 값
dischargedAt         퇴원 처리 시각. 퇴원 안 했으면 null
```

주사와 처치는 `TREATMENT` 섹션에 있다. 수액과 수혈은 `FLUID` 섹션이라 자연히 분리된다.

카테고리 정보(`mainCategory`, `subCategory`)는 대부분 null 이라 쓸 수 없다.
항목 이름을 직접 해석해야 한다.

## 반드시 지켜야 할 함정 다섯 가지

### 1. NO_PLAN 셀은 오더가 아니다

`cells` 배열에는 오더가 없는 빈칸도 `NO_PLAN` 상태로 들어온다. 셀이 있다고 오더로 세면
없는 처치가 목록에 나온다. 실제 준비 대상은 `PLANNED`, `COMPLETED`, `IN_PROGRESS`다.
`SKIPPED`와 `CANCELLED`는 취소 칸으로 읽어 준비 시간과 구분해 표시한다.

### 2. 퇴원 플래그는 조회 시점 상태다

`discharged` 는 지금 퇴원 상태인지를 뜻한다. 오후에 퇴원한 환자도 아침 9시에는 입원 중이었고
채혈을 했다. 그러니 `dischargedAt` 이 그 처치 시각보다 늦으면 목록에 넣어야 한다.
이걸 놓치면 9월 7일에 10마리 중 5마리, 9월 9일에 7마리 중 3마리가 빠진다.

### 3. 약어와 숫자가 붙어서 적힌다

`SAM22`, `metro15`, `pheno2`, `famo1` 처럼 띄어쓰기가 없는 표기가 흔하다.
정규식에 `\bSAM\b` 만 쓰면 `SAM22` 를 놓친다. `SAM\s*\d|\bSAM\b` 처럼 둘 다 잡아야 한다.

### 4. 짧은 약어는 단어 경계가 필요하다

`ALT` 를 경계 없이 찾으면 `Dalteparin` 안의 alt 가 걸려서 항혈전제가 혈액검사로 분류된다.
`\bALT\b` 처럼 감싸야 한다. ALP, ALB, BUN, CREA, phos 도 마찬가지다.

### 5. 오타와 변형 표기가 많다

`Datle`(Dalteparin), `eosmeprazole`, `chloropheniramine`, `tranexamic acie`,
`cefotaxime 50mg/k` 같은 것들이 실제로 있다. 새 표기를 발견하면 정규식에 추가한다.

## 채혈 목록 규칙

- 오전 9시 오더만 본다.
- 체온은 전해질이 포함된 오더에만 적는다. `가스`, `gas` 도 전해질로 친다.
- 체온 값은 조회 시점 기준 가장 최근 기록을 쓴다. 그날 기록이 없으면 전날 마지막 값을 쓴다.
- 특이사항 칸에는 혈액검사 항목 자체에 적힌 지시만 넣는다. 없으면 체온만 넣는다.
  차트 상단의 환자 주의사항은 넣지 않는다.
- 혈액검사 오더 없이 간이혈당만 걸린 환자는 목록에서 뺀다.
- 환자 이름 옆에 종을 적는다. API의 `patient.species` 가 DOG 이면 강아지, CAT 이면 고양이다.

항목 이름에 채혈 지시가 섞여 들어오는 경우가 있다. `CBC 팔 채혈, 지혈 오래`,
`혈검(전해질, 신4, CK, 양측 후지 lactate 각각 측정)` 같은 것이다. 이때는 그 문구를
특이사항 칸으로 옮긴다.

## 주사 목록 규칙

- 대상 시간은 그날 17시부터 다음날 15시까지, 양쪽 포함이다.
- 단발성 주사만 넣는다. CRI, 수액, 수혈은 뺀다.
  CRI가 `cri` 라는 글자 없이 `furosemide 0.7mg/kg/hr` 처럼 시간당 속도로만 적히기도 한다.
- 약물명은 처치표 원문 그대로 쓴다. 정식 일반명으로 바꾸지 않는다.
- 표기는 `[약물이름] [용량] [IV/SC/IM]` 순서다. 처치표에 안 적혀 있으면 빈칸으로 둔다.
  숫자만 있고 단위가 없으면 숫자만 쓰고 mpk 로 단정하지 않는다.
- 환자 이름 옆에는 같은 이름을 구분할 수 있도록 병원 환자번호와 품종을 함께 표시한다.
- 주사 목록은 환자 이름 뒤 괄호 안에 체중, 환자번호, 품종 순으로 표시한다.
  차트에서 가장 최근에 입력된 체중을 사용하며 체중 행과 환자 정보의 체중 필드를 차례로 확인한다.
  값이 없으면 `- kg`로 표시한다. 예: `뽀삐 (5.2 kg · #257008 · 푸들)`.
- 환자별로 묶고 그 안에서 약별로 시간을 모은다. `SAM 22 (17시, 내일 1시, 내일 9시)` 형식이다.
- 조건부 처치는 맨 아래 따로 모은다.
- BID의 정규 시간은 21시·9시, TID는 17시·1시·9시다. 각 빈도의 정규 시간이 아닌 시간은
  밑줄을 쳐서 눈에 띄게 한다. SID는 시간이 매번 다르므로 시간 밑줄 판정을 하지 않는다.
  처치명과 지시사항의 BID/TID/SID, q12h/q8h/q24h 표기를 먼저 읽고, 표기가 없으면 목록에 잡힌
  투여 횟수 2회/3회/1회로 각각 BID/TID/SID를 보완 판정한다.
  예외 시간은 굵게+밑줄로 표시한다. 복사한 글에서는 `**__`, `__**`로 감싼다.
- 투여 경로가 SC 또는 IM으로 명시된 주사는 `SC` 또는 `IM` 글자만 굵게+밑줄로 표시한다.
- 주사 목록은 날짜별로 마지막 확인 기준을 브라우저 `localStorage`에 저장한다. 다시 불러왔을 때
  달라진 용량·경로·시간·특이사항, 새 처치, 미연장→연장 표시는 변경된 부분만 주황색으로 표시한다.
  취소되거나 퇴원으로 사라진 처치는 주황색 취소선으로 남긴다. `변경 확인`을 누르면 현재 목록이
  새로운 기준이 된다. 화면의 주황색은 `O0/O1`, 취소선은 `X0/X1` 자리표시자로 렌더링한다.
  차트의 `SKIPPED`/`CANCELLED` 칸은 취소선 없이 회색 테두리의 `제외: [시간]`으로 표시한다.
  이전 확인 이후 오더에서 사라진 시간·약물에만 주황색 취소선을 사용한다.
  미연장 차트 예측에는 제외 칸을 복사하지 않는다.
- 자동 감시는 없다. 주사 탭을 열거나 `새로 확인`을 누를 때 최신 차트를 조회한다.
  변경된 환자의 이름 줄에 `처치 업데이트`를 한 번 표시한다. 조회만으로는 기준을 바꾸지 않고
  `변경 확인`을 눌러야 저장된 기준을 갱신한다. 같은 PC와 브라우저에서 날짜별 기준을 유지한다.
  그날 처음 주사 탭을 열면 목록을 새 기준으로 저장하고 `오늘 첫 확인 · 기준 목록 저장됨`을 표시한다.
  자정이 지나 날짜가 바뀌면 전날 기준과 비교하지 않고 다시 첫 확인으로 처리한다.
  변경이 있으면 변경 배너에 기준 목록의 확인 시각과 현재 조회 시각을 함께 표시한다.
- 채혈과 주사 목록은 기본적으로 환자 이름순이다. 화면의 정렬 버튼으로 장순을 선택하면
  B → A → ICU → C → D 순으로 정렬하고, 같은 장에서는 장 번호 숫자순, 환자 이름순으로 정렬한다.

### 빼는 것

- Metronidazole 과 인슐린 계열 전부. 우리가 주는 게 아니거나 미리 뽑지 않는다.
  인슐린은 상품명으로도 적힌다. Glargine, 휴물린, 란투스, 프로진크, PZI, vetsulin.
- 시술용 진정제와 항암제. medetomidine, midazolam, vincristine, local injection.
  현장에서 준비하는 것들이다.
- Mannitol, NAC, 20% 포도당, 피하수액. 수액에 가깝다.
- 약 이름 없이 분류만 적힌 줄. 스테로이드, 이뇨제, 심장약, 식욕촉진제, 추가약,
  입원약, 1번약, 진정제, 항혈전제 같은 것들이다.
  항혈전제는 그렇게만 적혀 있으면 경구약이다. Dalteparin 처럼 약 이름이 적혀 있으면 주사다.

### 넣는 것 중 헷갈리는 것

- `tra 4` 는 tramadol 이다.
- `Meto` 는 metoclopramide 다. Metronidazole 을 뜻하는 `Metro` 와 다르다.
- Leve, Pheno 같은 항경련제는 주사로 친다.

### 용량 표기 처리

- 괄호 안에 용량을 넣는 경우가 있다. `famo (1) IV`, `cepha (30) IV`.
- 화살표로 용량 변경을 표시한다. `Famo 0.5 -> 1mpk iv` 는 현재 용량이 1mpk 다.
- 한 줄에 약이 둘일 때가 있다. `Iron dextran 10mpk IM, Hydroxocobalamin 1mg/dog IM`.
  쉼표로 나눠서 각각 한 줄로 만든다.

### 차트 미연장 처리

오후 3~4시에는 다음날 차트가 아직 연장되지 않은 환자가 많다. 그때는 오늘 차트의
0시부터 15시까지 오더를 그대로 다음날로 복사해서 보여준다. `미연장`은 이름과 분리된 상태 표시로
강조하고, 연장됐을 때는 `연장` 상태를 노란색 형광펜 배경으로 표시한다.

```
솜이 (#257008 · 말티즈) A장-7
  [미연장]
  Meropenem 8.5mpk IV (17시, 내일 1시, 내일 9시) [tid]
```

과거 날짜로는 항상 차트가 연장된 뒤라 이 경로가 검증되지 않는다. 실제로 오후에
돌려봐야 확인할 수 있다.

## 고칠 때 확인하는 방법

AI는 병원 시스템에 접속할 수 없다. 검증은 직접 해야 한다.

1. Chrome에서 VetSync에 로그인한다.
2. 개발자도구 Console 탭을 연다.
3. 고친 코드를 붙여넣고 실행한다.
4. 결과를 복사해서 AI에게 붙여넣고 이상한 부분을 같이 확인한다.

새 표기를 놓치고 있는지 훑어보려면 이 조각을 콘솔에서 돌린다.
날짜 범위 안의 모든 처치 항목 이름을 모아서, 분류 규칙이 무엇을 잡고 무엇을 놓치는지 보여준다.

```js
(async () => {
  const H = {
    Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('auth-storage')).state.accessToken,
    'X-Hospital-Id': '24',
  };
  const get = async (p) => (await fetch('https://api-vetsync4.vetu1.com/api/v1' + p, { headers: H })).json();
  const USED = ['PLANNED', 'COMPLETED', 'IN_PROGRESS', 'SKIPPED', 'CANCELLED'];
  const names = new Set();
  for (const d of ['2026-09-08', '2026-09-09', '2026-09-10']) {   // 보고 싶은 날짜로 바꾼다
    const list = await get('/charts?date=' + d);
    const details = await Promise.all(list.items.map((c) => get('/charts/' + c.chartId)));
    details.forEach((x) =>
      (x.sections || []).filter((s) => s.section === 'TREATMENT')
        .flatMap((s) => s.rows || [])
        .forEach((r) => {
          if ((r.cells || []).some((c) => USED.includes(c.status))) names.add(r.displayName.trim());
        })
    );
  }
  console.log([...names].sort().join('\n'));
})();
```

## 새 대화를 시작할 때

이 문서 전체를 붙여넣고, 고치려는 파일도 같이 올린다. 그리고 이렇게 말하면 된다.

> 이 문서에 적힌 규칙과 함정을 지켜서 고쳐줘. 규칙을 바꿔야 할 것 같으면
> 먼저 물어봐. 나는 병원 컴퓨터에서 콘솔로 돌려보고 결과를 붙여넣을 수 있어.

ChatGPT를 쓴다면 프로젝트를 하나 만들고 이 문서를 프로젝트 지시사항에 넣어두면
매번 붙여넣지 않아도 된다. 코드 파일은 프로젝트에 업로드해두면 된다.
