# Bookmark Manager

> 개발자용 북마크 매니저 — 기술 블로그·문서·영상 링크를 태그로 정리하고 검색.
> React/Next.js 학습 + 포트폴리오 목적의 토이 프로젝트.

## 스크린샷

<!-- TODO: 카드 UI 스크린샷 추가. v1 완성 시점에 갱신. -->
_곧 추가 예정._

## 주요 기능

### 구현 완료 (v1 진행 중)
- **북마크 추가** — URL 붙여넣기 → OG 메타데이터 자동 추출(제목/설명/썸네일)
- **목록** — 최신순 카드 뷰, 썸네일 + 제목 + 2줄 설명
- **삭제** — 확인 다이얼로그 후 즉시 반영(`revalidatePath`)
- **SSRF 방어** — 외부 fetch 시 사설 IP / 클라우드 메타데이터 / `javascript:`·`file:` 프로토콜 차단

### 예정 (v1 완성)
- 태그 입력/표시
- 텍스트 검색(제목·URL·태그)
- GitHub OAuth 로그인
- Vercel 배포

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Server Components, Server Actions) |
| 언어 | TypeScript 5 |
| UI | React 19, Tailwind CSS v4 |
| ORM | Drizzle ORM 0.45 |
| DB | SQLite via `@libsql/client` (로컬 파일 / Turso 배포) |
| HTML 파싱 | node-html-parser |

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

### 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | libsql 연결 문자열. 로컬: `file:./local.db`, Turso: `libsql://...` |
| `DATABASE_AUTH_TOKEN` | (배포 환경) Turso 인증 토큰 |

`.env.local`은 gitignore. 커밋 금지.

## 프로젝트 구조

```
app/
  page.tsx                  목록(홈)
  bookmarks/
    new/                    추가 폼 + Server Action
    actions.ts              삭제 Server Action
    delete-button.tsx       Client Component (window.confirm)
lib/
  db/
    client.ts               libsql + Drizzle 초기화
    schema.ts               테이블 정의
    queries.ts              조회 함수 레이어
  url-guard.ts              SSRF 방어 (사설 IP / 메타데이터 차단)
  og.ts                     OG 메타 fetch + 파싱
```

## 보안 정책 (v1 범위)

- 모든 폼 입력은 서버에서 재검증(HTML5 검증은 우회 가능)
- 저장될 URL은 http/https 화이트리스트(XSS 방어 — `<a href>` 렌더 대상)
- 외부 fetch 전 사설 IP / 클라우드 메타데이터 차단(SSRF 방어)
- 외부 fetch 5초 타임아웃, 256KB 응답 크기 제한
- DB 클라이언트는 `import "server-only"` 가드

## 라이선스

학습용 토이 프로젝트. 별도 라이선스 명시 없음.