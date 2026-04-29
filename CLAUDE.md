# 네이버 블로그 제작 요청 앱 — CLAUDE.md

## 프로젝트 개요

고방 블로그 마케팅 서비스의 신청 폼 + 랜딩페이지.  
이벤트 기간 중 고시원/원룸 지점주가 블로그 글 작성을 신청하는 앱.

---

## 배포

| 대상 | URL | 방법 |
|------|-----|------|
| 신청 폼 | https://gobangmkt.github.io/blog_request/ | GitHub Pages (main 브랜치 push 시 자동) |
| 랜딩페이지 | https://landing-nf1.vercel.app | Vercel (`landing/` 폴더 기준) |

- **랜딩 재배포**: `cd landing && npx vercel --prod`
- **신청 폼 배포**: `git push origin main` 하면 자동 반영 (수 분 소요)

---

## 주요 파일

```
index.html          신청 폼 (메인 페이지)
landing/
  index.html        랜딩페이지 (React CDN + Babel Standalone, 빌드 불필요)
  shared.jsx        공용 컴포넌트
  variant-a.jsx     현재 사용 중인 랜딩 variant
  colors_and_type.css  디자인 토큰
  vercel.json       Vercel 정적 배포 설정
gas-code/Code.gs    Google Apps Script 서버 코드
```

---

## 기술 스택

- **신청 폼**: 순수 HTML + Vanilla JS (프레임워크 없음)
- **랜딩**: React 18 (CDN) + Babel Standalone (브라우저 컴파일, 빌드 없음)
- **백엔드**: Google Apps Script (GAS)
- **폰트**: Pretendard (Google Fonts CDN)

---

## GAS API

```js
var GAS_URL = 'https://script.google.com/macros/s/AKfycbygEzqWKlYa1EgStmNY1wxvIL23TDSPec1YMAAOnkPEIu1CcpwkyOfCDph5-RHSAnuD/exec';
```

### API actions
| action | 설명 |
|--------|------|
| `checkAccess` | 이벤트 기간/마감 여부 확인 + 상태 배너 데이터 반환 |
| `checkPlaceUrl` | 지점 URL 중복 신청 여부 확인 |
| `fetchPlaceInfo` | 지점 URL로 OG 정보(이미지·제목·설명) 가져오기 |
| `checkKeyword` | 키워드 사용 가능 여부 + 남은 일수 확인 |
| `submitForm` | 최종 신청 데이터 제출 |

> GAS 재배포 시 `index.html`의 `GAS_URL` 변수 업데이트 필요

---

## 신청 폼 주요 구조 (index.html)

### 화면 상태
- `loadingScreen` — 초기 로딩 (현재는 즉시 숨김)
- `offScreen` — 이벤트 마감/접근 불가 시 표시
- `form-area` — 메인 폼 (기본 표시)
- `successScreen` — 신청 접수 완료 화면
- `modalOverlay` — 최종 확인 모달 (개인정보 동의 포함)
- `templateModal` — 템플릿 유형 안내 모달

### 로딩 전략
`checkAccess`를 백그라운드에서 호출. 폼은 즉시 노출.  
접근 불가 판정 시 폼 숨기고 `offScreen` 표시.  
(GAS 콜드 스타트 지연 방지를 위해 이 방식 사용)

### 동의 항목 (3개 모두 체크해야 제출 가능)
1. `agreeToggle` — 노출 순위 변동 가능성 동의
2. `agreeToggle2` — 대상자 선정 후 결제 완료 시 작업 시작 동의
3. `privacyAgree` — 개인정보 수집 동의 (최종 확인 모달 안에 위치)

### 최종 확인 모달
- 입력 내용 요약 표시
- 개인정보 수집 동의 (접기/펼치기)
- `privacyAgree` 체크해야 "동의하고 신청 완료하기" 버튼 활성화

### 키워드 힌트
사용 불가 키워드 입력 시:  
`"00일 뒤 사용 가능해요"` + `"다른 키워드를 사용해보세요. 예) 강남고시원, 강남원룸텔 등"`

---

## 커스텀 토글 체크박스 구조

폼 전체에서 사용하는 체크박스 패턴:

```html
<div class="toggle-wrap">
  <input type="checkbox" id="someToggle" class="toggle-input">
  <span class="toggle-slider"></span>
</div>
```

> 일반 `<input type="checkbox">` 단독 사용 시 시각적 체크 표시가 안 됨.  
> 반드시 `toggle-input` + `toggle-slider` 조합으로 사용할 것.

---

## 로컬 개발

```bash
# 랜딩페이지
cd landing
node server.js      # 또는 "시작 5500.bat" 더블클릭
# → http://localhost:5500

# 신청 폼 (index.html)
# 브라우저에서 직접 파일 열기 또는 Live Server 사용
```
