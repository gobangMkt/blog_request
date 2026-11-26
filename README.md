# 네이버 블로그 제작 요청 앱

## 개요

고방 블로그 마케팅 서비스의 **신청 폼**. 이벤트 기간 중 고시원/원룸 지점주가 블로그 글 작성을 신청하는 앱. repo `gobangMkt/blog_request`.

## 폼 구성

루트 `index.html`은 `15만원-여름특가/`로 리다이렉트한다. 상품별로 독립 폴더 + 독립 GAS 프로젝트로 운영된다.

| 폴더 | 상품 | 성격 | 비고 |
|------|------|------|------|
| `15만원-여름특가/` | 여름특가 15만원 (정가 30만 · 50%) | 신규 포함 | 일반 공개 신청폼 |
| `addon-direct-pay/` | 고급형 150,000원 직접결제 | 원장 전용 | 결제 뒤 제출. 상세 `addon-direct-pay/README.md` |

- 11.26 삭제: 10만원 CRM 폼(`10만원-CRM판매/`·`r10/`, 마지막 접수 07.07)과 옛 상세 랜딩(`15만원-여름특가/landing/`, landing-two-tau-94.vercel.app). 코드는 git 이력에 있다.
- 상품 소개 페이지는 `https://blog-gobangposting-detail.vercel.app`(이 repo 밖).

## 코어

### 공통 핵심 기능
- **신청 폼**: 지점 URL 입력(형식 검사) → OG 정보 자동 조회 → 키워드 90일 선점 체크 → 동의 후 제출. 지점 URL 중복 신청은 막지 않음
- **백엔드**(`gas-code/Code.gs`): 구글 시트(신청 내역/완료 내역) 기록, 알림톡 발송, 키워드 선점 체크, 같은 지점 10분 내 재제출(더블클릭) 차단

## 실행 / 배포

### 로컬 개발
```bash
# 신청 폼: 해당 폴더의 form.html 또는 index.html을 브라우저/Live Server로 열기
```

### 배포 (폼별)
| 대상 | 방법 |
|------|------|
| 신청 폼 | `git push origin main` → GitHub Pages 자동 반영 (수 분) |
| GAS | `cd <폼>/gas-code` → `clasp push --force` → `clasp deploy --deploymentId <운영ID> -d "<설명>"` (exec URL 유지) |

### 시크릿 / 설정 (값은 GAS 스크립트 속성에 귀속 — 본 문서 미기재)
- `INBOX_TOKEN`: 신청관리(인박스) 운영자 토큰. **스크립트 속성에 직접 설정.**
- `GAS_URL`: 각 폼 `form.html`/`index.html`에 박힌 exec URL. GAS 재배포 시 deploymentId 유지하면 갱신 불필요.

## 배포링크
| 대상 | URL |
|------|-----|
| 신청 폼(루트→15만원) | https://gobangmkt.github.io/blog_request/ |
| GitHub repo | https://github.com/gobangMkt/blog_request |
