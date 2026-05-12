import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// NOTE: 전역 not-found 화면. Server Component에서 `notFound()`를 던지거나
// URL이 어떤 라우트에도 매치되지 않을 때 Next.js가 렌더.
//
// error.tsx와의 분리:
//   - error.tsx: 시스템 에러(throw) — Client Component 필수, "다시 시도" reset 함수
//   - not-found.tsx: 의도된 404 — 우리가 데이터를 찾지 못한 정상 분기
// IDOR 방어상 *다른 사용자의 컬렉션 id*도 여기로 떨어짐 (존재 자체 누출 방지).
//
// 이 파일이 없으면 Next.js 기본 404가 렌더되며 React 19 dev에서 일부 경고가
// 발생할 수 있음 (script 태그 렌더링 관련). 디자인 토큰 정합도 깨짐.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            찾을 수 없습니다
          </h1>
          <p className="text-sm text-muted-foreground">
            이동하려는 페이지나 컬렉션이 존재하지 않거나 접근 권한이 없습니다.
          </p>
          <Button asChild>
            <Link href="/">홈으로</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}