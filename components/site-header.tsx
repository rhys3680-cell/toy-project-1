import { SignOutButton } from "@/app/sign-out-button";

// NOTE: 사이트 공통 헤더. 두 가지 자리 변동:
//   - 제목 영역: 페이지에 따라 <h1> (홈) 또는 <Link to "/"> (다른 페이지)
//   - 우측 액션 슬롯: 페이지별 추가 버튼 (예: 홈의 "+ 추가")
// composition으로 풂 — props로 받기보다 children으로 받음 (docs/25 §7.3).
//
// UserMenu (아바타 + 이름 + 로그아웃)는 항상 같으니 헤더 내부에 박힘.
// v3에 컬렉션 페이지 추가 시 *세 번째 복사* 없이 이 컴포넌트 그대로 사용.

type SiteHeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  /** 제목 영역. 보통 <h1> 또는 <Link>. */
  title: React.ReactNode;
  /** 우측 부가 액션 슬롯. 없으면 사용자 정보만 보임. */
  actions?: React.ReactNode;
};

export function SiteHeader({ user, title, actions }: SiteHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
        {title}
        <div className="flex items-center gap-3">
          {actions}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: SiteHeaderProps["user"] }) {
  return (
    <div className="flex items-center gap-2">
      {user.image && (
        // NOTE: GitHub 아바타. img 사용 이유는 OG 썸네일과 동일 — 임의 외부 도메인.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-7 rounded-full border border-border"
        />
      )}
      <span className="text-sm text-foreground">
        {user.name ?? user.email}
      </span>
      <SignOutButton />
    </div>
  );
}