# 보안 설정 및 배포 순서

이 변경은 학생 제출 자료를 삭제하거나 `Submissions` 시트를 초기화하지 않습니다. 새 `Settings` 시트에 채점 기준과 학생 접속 기간만 저장합니다.

## 1. 비밀번호 해시 만들기

프로젝트 폴더의 PowerShell에서 다음 명령을 실행합니다.

```powershell
npm.cmd run hash-password
```

새 교사 비밀번호를 두 번 입력한 뒤 출력되는 `scrypt$...` 한 줄을 복사합니다. 원래 비밀번호는 출력되거나 코드에 저장되지 않습니다.

## 2. 통신용 비밀키 만들기

```powershell
npm.cmd run generate-secrets
```

출력되는 `GAS_API_SECRET`과 `SESSION_SECRET`을 안전한 곳에 잠시 보관합니다. GitHub에 올리지 않습니다.

## 3. Apps Script 업데이트

1. 사용 중인 Google Sheets에서 **확장 프로그램 → Apps Script**로 이동합니다.
2. 앱의 관리자 대시보드에서 **구글 시트 실시간 연동 → 스크립트 코드 복사**를 누르고 기존 Apps Script 코드를 교체합니다.
3. Apps Script의 **프로젝트 설정 → 스크립트 속성**에 `GAS_API_SECRET`을 추가하고 2단계에서 만든 같은 값을 넣습니다.
4. **배포 → 배포 관리 → 기존 웹 앱의 수정(연필) → 새 버전 → 배포**를 선택합니다.
5. 기존 웹 앱의 `/exec` URL을 복사합니다. 새 배포를 만들 필요는 없습니다.

## 4. Vercel 환경 변수 설정

Vercel 프로젝트의 Settings → Environment Variables에서 다음 값을 등록합니다. 각 항목의 환경은 **Production과 Preview**에 적용합니다.

| 이름 | 값 | 형식 |
|---|---|---|
| `GAS_WEB_APP_URL` | Apps Script의 `/exec` URL | 서버 전용 |
| `GAS_API_SECRET` | 2단계에서 만든 값 | Secret |
| `SESSION_SECRET` | 2단계에서 만든 값 | Secret |
| `ADMIN_PASSWORD_HASH` | 1단계에서 만든 `scrypt$...` 값 | Secret |
| `GEMINI_API_KEY` | 기존 Gemini API 키 | Secret |

예전 `NEXT_PUBLIC_GAS_URL`은 새 설정 확인 후 삭제할 수 있습니다.

## 5. 재배포와 확인

1. Vercel에서 최신 `main` 배포를 **Redeploy**합니다.
2. `/api/health`를 열어 `gas`, `adminPassword`, `session`이 모두 `true`인지 확인합니다.
3. 교사 로그인 후 채점 기준을 저장하고 다른 브라우저에서 다시 로그인하여 유지되는지 확인합니다.
4. 학생 접속 기간을 짧게 시험 설정하여 기간 전·후 로그인이 차단되는지 확인합니다.
5. 학생 한 명으로 작성 내용을 저장하고 `Submissions`의 기존 행이 유지·갱신되는지 확인합니다.

학생의 Google 아이디는 `Roster` 시트에만 저장하며, 해당 학생의 Suno 안내 화면에서만 보여 줍니다. 개인정보 중복 저장을 피하기 위해 `Submissions`에는 기록하지 않습니다.
