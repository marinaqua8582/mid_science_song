# Apps Script 배포 절차 — 수업 동시성 개선

이 작업에서는 운영 Sheets 조회·수정, Apps Script 배포, main 병합, Production 배포를 수행하지 않았다.

## 배포 대상 구분

- `deployment/Code.gs`: Apps Script 편집기에 반영할 실제 서버 코드. 새 웹 앱 버전 배포가 필요하다.
- `src/data/gasScript.ts`: 위 코드를 앱에서 제공하는 복사본. Apps Script에 TypeScript 파일 자체를 붙여넣지 않는다.
- `api/**`, `src/**`, `vercel.json`: Vercel에서 빌드할 앱 코드. GAS 코드만 바꾸어서는 UI·로그인 IP 제한·HTTP 오류 변환이 적용되지 않는다.
- `tests/**`: 로컬 합성 시험용. 운영 Sheets나 실제 Gemini로 연결하지 않는다.

## 별도 시험 환경

1. 실제 학생 자료를 복사하지 않은 빈 테스트 Sheets에 합성 Roster 25명을 만든다.
2. 별도 Apps Script 프로젝트에 `deployment/Code.gs`를 넣고 테스트용 `GAS_API_SECRET`을 설정한다.
3. 웹 앱 새 버전을 배포한다. 기존 구조와 동일하게 Vercel 서버가 secret을 보내고, 웹 앱 접근은 모든 사용자로 설정한다. URL과 secret을 공개하지 않는다.
4. 격리된 Vercel Preview 환경에 테스트 `GAS_WEB_APP_URL`, `GAS_API_SECRET`, `SESSION_SECRET`을 설정한다. Production 환경 변수는 바꾸지 않는다.
5. Gemini를 실제 호출하려면 해당 테스트 프로젝트 키를 서버에만 설정한다. 실제 프로젝트의 모델 사용 가능 여부, RPM·TPM·일일 제한과 요금 티어를 AI Studio에서 확인한다. 코드의 학생별 10회/30분은 프로젝트 RPM이 아니다.
6. 이 환경에서 실 Apps Script 지연·할당량·잠금 경쟁을 25명으로 추가 측정한다. 로컬 결과는 이 측정을 대체하지 않는다.

## 승인 후 운영 전환 절차

1. main 병합 전 브랜치 시험 결과와 변경 내용을 검토한다. Production 자동 배포가 main에 연결되어 있다면 GAS 연결 준비가 끝날 때까지 병합하지 않는다.
2. 기존 GAS 배포를 즉시 덮어쓰지 말고, 같은 프로젝트에 **새 배포 ID/URL**로 새 버전을 만든다. 기존 Production은 기존 배포 URL/버전을 계속 사용하게 한다. 새 버전 코드만 저장하고 기존 배포 버전은 변경하지 않는다.
3. 새 Vercel 릴리스의 `GAS_WEB_APP_URL`을 새 GAS URL로 연결한다. 기존 secret을 유지한다. GAS 신규 배포는 스스로 저장을 실행하지 않는다.
4. Sheets 직접 명단 수정이 필요한 경우 다음 설치형 트리거를 등록한다. `invalidateClassroomCachesOnEdit` → 스프레드시트에서/수정 시, `invalidateClassroomCachesOnChange` → 스프레드시트에서/변경 시. 앱의 명단 추가·수정·삭제는 코드 자체에서 관련 캐시를 무효화한다.
5. 테스트 통과 및 배포 승인 후 새 Vercel 릴리스를 Production으로 전환한다. 화면을 새로고침하도록 안내한다. 이전 화면의 requestId 없는 요청은 새 API에서 ID를 부여하지만, 클라이언트 재시도·버튼 비활성화는 새 화면에서 적용된다.
6. 별도로 운영 최종 확인을 수행한다면 **2학년 5반 25번 김과학, 26번 이삼진만** 사용한다. 다른 학생 자료 및 전체 명단/제출 조회 화면을 열지 않는다. 이번 작업에서는 이 두 계정에도 접근하지 않았다.

## 데이터 형식과 주의점

- Canonical 제출 시트의 21열(U), Legacy 제출 시트의 19열(S)에 `_requestJournal`이 추가된다. 실제 운영에서는 최초 저장 때 헤더와 저장 기록이 생긴다. 이 열은 공개 학생 API에서 반환하지 않는다.
- 처리 기록과 제출 내용은 같은 `setValues`/`appendRow`에 쓰고 `SpreadsheetApp.flush()` 이후 잠금을 해제한다. 최근 100개 ID는 성공 응답을 재사용하며, 제거된 오래된 ID는 영구 watermark보다 오래된 요청으로 거부한다. 캐시만으로 멱등성을 판단하지 않는다.
- 활성 제출 탭·형식·행 인덱스는 5분 캐시이며, 행 번호를 쓰기 전에 학생 키를 다시 확인한다. 캐시 유실 또는 행 수 변경 때 인덱스를 재구성한다. 수업 중 직접 정렬·행 삭제·외부 스크립트 쓰기는 피하고, 직접 변경 시 위 트리거가 동작하는지 확인한다.
- 기존 중복 행을 자동 삭제하거나 병합하지 않는다. 이미 존재하는 중복 자료의 정리는 별도 검토가 필요하다.
- Legacy 시트는 원래 학년 열이 없어 2학년만 허용한다. 다른 학년은 Canonical 시트를 사용해야 한다.
- 롤백 시 Vercel 릴리스와 GAS URL을 함께 이전 조합으로 되돌린다. 제출 데이터 및 `_requestJournal` 열을 삭제하지 않는다. 롤백된 이전 코드에는 이번 동시성 개선이 없다.

## 재현 명령

```powershell
npm install
npm run build
npm run lint
npm run test:classroom
```

브라우저 검증은 Playwright와 Edge가 필요하다. 프로젝트 의존성을 저장하지 않고 로컬에만 설치할 수 있다.

```powershell
npm install --no-save playwright
$env:RUN_BROWSER_TESTS='1'
npm run test:classroom
```

Playwright가 별도 제공되는 실행 환경에서는 `PLAYWRIGHT_MODULE`에 해당 모듈 경로를 지정할 수 있다. Edge가 없으면 테스트의 `channel: 'msedge'`에 맞는 브라우저를 설치한다. 시험은 로컬 서버만 접근하고 브라우저의 외부 URL 요청을 차단한다. 결과는 `test-results/classroom-concurrency.json`에 기록한다.

참고: [Apps Script CacheService](https://developers.google.com/apps-script/reference/cache/), [Gemini 오류와 백오프](https://ai.google.dev/gemini-api/docs/troubleshooting), [프로젝트별 Gemini 제한 확인](https://ai.google.dev/gemini-api/docs/rate-limits).
