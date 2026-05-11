# Bookmark Manager

> 개발자용 북마크 매니저 — 기술 블로그·문서·영상 링크를 태그로 정리하고 검색.
> React/Next.js 학습 + 포트폴리오 목적의 토이 프로젝트.

**Live**: https://toy-project-1-omega.vercel.app

## 스크린샷

![홈 화면 — 카드 목록, 검색, 즐겨찾기/읽음 토글](snapshot/image.png)

## 주요 기능

### v1 MVP
- **GitHub OAuth 로그인** — Better Auth + DB 세션
- **북마크 추가** — URL 붙여넣기 → OG 메타데이터 자동 추출(제목/설명/썸네일)
- **목록 / 삭제** — 최신순 카드 뷰, 확인 다이얼로그 + IDOR 방어
- **태그** — 쉼표 구분 입력, 사용자별 태그 풀
- **검색** — 제목/URL/태그 LIKE 매치 (M:N 검색은 EXISTS 서브쿼리)
- **SSRF 방어** — 외부 fetch 시 사설 IP / 클라우드 메타데이터 / `javascript:`·`file:` 프로토콜 차단
- **3층 방어** — proxy(쿠키) + page(세션 검증) + Server Action(세션 + user 스코프)

### v2 UX 개선
- **태그 칩 클릭 필터링** — URL 쿼리 동기화 (`?tag=react`), 검색 키워드와 AND 결합
- **즐겨찾기 / 읽음 토글** — `useOptimistic`으로 즉시 UI + 실패 시 자동 롤백
- **페이지네이션** — 20개 단위, 검색/필터와 결합 (`?q=...&tag=...&page=N`)
- **토스트 + Error Boundary** — sonner + `useActionState` + `app/error.tsx`
- **키보드 단축키** — `/` 검색 포커스, `n` 새 북마크, `Esc` 검색 클리어

### 인프라
- **회귀 테스트** — vitest로 NULL UNIQUE / IDOR / SSRF / CASCADE / 페이징 / 토글 박제 (62 통과)
- **디자인 시스템** — shadcn/ui (Button/Input/Card/Label) + next-themes (OS 자동 다크 모드) + SiteHeader 추출

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Server Components, Server Actions) |
| 언어 | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Radix + cva) |
| 상태 / 폼 | `useActionState`, `useFormStatus`, `useTransition`, `useOptimistic` |
| ORM | Drizzle ORM 0.45 |
| DB | SQLite via `@libsql/client` (로컬 파일 / Turso 배포) |
| 인증 | Better Auth v1.6 + GitHub OAuth (DB 세션) |
| HTML 파싱 | node-html-parser |
| 테마 | next-themes (system 모드 — OS 자동 다크) |
| 토스트 | sonner |
| 테스트 | vitest (단위 + DB 통합, 62 케이스) |
| 배포 | Vercel + Turso |

## 빠른 시작

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경 변수
cp .env.example .env.local
# 필요 시 DATABASE_URL 수정

# 3. DB 마이그레이션
pnpm db:migrate

# 4. 개발 서버
pnpm dev
# http://localhost:3000
```

### 테스트

```bash
pnpm test         # watch
pnpm test:run     # 1회 실행
pnpm test:ui      # vitest UI
```

### 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | libsql 연결 문자열. 로컬: `file:./local.db`, Turso: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | (배포) Turso 인증 토큰 |
| `BETTER_AUTH_SECRET` | 쿠키 서명/암호화 키. `npx @better-auth/cli@latest secret`으로 생성. dev/prod 분리 필수 |
| `BETTER_AUTH_URL` | 서버 측 baseURL. 콜백 URL 생성에 사용 |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | 클라이언트 측 baseURL. 누락 시 prod에서 CORS 차단 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App. dev/prod 별도 등록 |

`.env.local`은 gitignore. 커밋 금지.

## 프로젝트 구조

```
app/
  page.tsx                      목록(홈) — 인증 가드 + 검색 + 필터 + 페이지네이션
  login/page.tsx                GitHub 로그인 (Client)
  error.tsx                     전역 Error Boundary
  layout.tsx                    ThemeProvider + Toaster + KeyboardShortcuts
  theme-provider.tsx            next-themes wrapper
  keyboard-shortcuts.tsx        글로벌 keydown handler
  sign-out-button.tsx           로그아웃 (Client)
  bookmarks/
    new/                        추가 폼 + Server Action (useActionState)
    actions.ts                  삭제 + 토글 Server Actions
    delete-button.tsx           Client (useTransition + try/catch)
    flag-button.tsx             ★ / ✓ 토글 (useOptimistic)
  api/auth/[...all]/            Better Auth handler
components/
  ui/                           shadcn/ui — Button/Input/Card/Label
  site-header.tsx               공통 헤더 (composition: title/actions slot)
lib/
  auth.ts                       Better Auth 서버 인스턴스
  auth-client.ts                Better Auth 클라이언트
  utils.ts                      cn() = clsx + tailwind-merge
  db/                           Drizzle (client + schema + queries)
  url-guard.ts                  SSRF 방어
  og.ts                         OG 메타 fetch + 파싱
  tags.ts                       parseTagInput
proxy.ts                        1차 가드 (Next.js 16의 middleware.ts)
tests/                          vitest — 단위 + DB 통합
drizzle/                        마이그레이션 SQL
```

## 보안 정책

- **3층 방어**: proxy(쿠키) → page(세션 검증) → Server Action(세션 + user 스코프)
- 모든 폼 입력은 서버에서 재검증 (HTML5 우회 가능)
- 저장될 URL은 http/https 화이트리스트 (XSS 방어 — `<a href>` 렌더 대상)
- 외부 fetch 전 SSRF 가드: 사설 IP / 클라우드 메타데이터 차단, 5초 타임아웃, 256KB 응답 제한
- IDOR 방어: 모든 SELECT/UPDATE/DELETE에 `user_id = session.user.id`
- `import "server-only"` 가드: DB 클라이언트, auth 인스턴스, SSRF 가드 등
- 회귀 테스트: NULL UNIQUE / IDOR / SSRF / CASCADE를 vitest로 박제

## 에러 처리 정책

- **사용자 입력 검증 실패** → Server Action이 `return { error }` → `useActionState` → toast
- **시스템 에러** (DB 다운, 외부 fetch 실패) → throw → `app/error.tsx` (전체 화면 + 재시도)

분류 기준: *사용자가 즉시 고칠 수 있는가*가 yes면 toast, no면 error boundary.

## 라이선스

학습용 토이 프로젝트. 별도 라이선스 명시 없음.