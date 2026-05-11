<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project context — Bookmark Manager (toy)

> 한국어 안내 + 영어 정책 (혼합 정책, docs/16 §5.11.3).

## Stack
- Next.js 16 / React 19 / TypeScript 5
- Drizzle ORM 0.45 + @libsql/client (SQLite via libsql)
- drizzle-kit 0.31 for migrations
- Vercel deploy target

## Always-on policies

### Layering (docs/10)
- DB code lives in `lib/db/` only
- Pages/components import via `lib/db/queries.ts` (when introduced) or `lib/db/client.ts`
- Reverse imports (`lib/db/*` importing from `app/*`) are forbidden

### Database (docs/13, docs/14)
- All PKs are surrogate. UUID for externally-exposed IDs (bookmarks, users, collections), INTEGER autoincrement for internal-only (tags)
- All FKs use ON DELETE CASCADE (personal-data isolation domain)
- All schemas satisfy 3NF. No JSON/array columns for searchable data
- Use Drizzle `mode: "timestamp"` for dates (Date ↔ unix epoch sec auto-conversion)
- Use Drizzle `mode: "boolean"` (when introduced)
- `PRAGMA foreign_keys = ON` is always explicit on connection (libsql defaults to ON, but make it environment-proof — verified in scratch Phase 2-①)

### Server Actions (docs/10, docs/12)
- All mutations are Server Actions, not Route Handlers (until external clients are needed)
- File-level `"use server"` directive
- Re-validate every input on the server (HTML5 validation can be bypassed)
- User identity comes from the session, never from a client-supplied argument
- Filter every query by `user_id` (IDOR defense)
- Call `revalidatePath` BEFORE `redirect` (redirect throws and skips later code)

### Code organization
- DB client / secrets: `import "server-only"` guard at top of file
- Environment variables: `.env.local` (gitignored), fail-fast guard in code
- Never hardcode secrets

## Open decisions (docs/13 §1.3)

These are intentionally undecided. Don't pick them without raising the question:

- Q7 — share link permissions detail — decide at v4
- Q8 — `updated_at` column — decide at v2
- Q10 — user memo column — decide at v2~v3
- Q12 — tag color/icon — decide at v3+

## Known traps to avoid

- `driver: "turso"` is deprecated — use `dialect: "turso"` (drizzle-kit 0.31+)
- `dotenv` does NOT auto-load `.env.local` — `config({ path: ".env.local" })` is required for any non-Next.js context (e.g. drizzle.config.ts)
- Adding NOT NULL columns without DEFAULT breaks existing rows — always provide default or migrate data first
- Renaming columns may be detected as DROP+ADD by drizzle-kit — review SQL after generate
- Inside `db.transaction(async (tx) => ...)`, use `tx` not `db`
- N+1 in lists — use Drizzle Relational Queries (`with: { ... }`) or explicit JOIN
- See docs/13 §9 for the full 34-trap catalog

## Verification cycle (docs/16 §4.2)

When in doubt about ORM/DB behavior:

1. Suspect any "always X" / "this is the standard" claim without version info
2. Verify in `scratch/` (Node + tsx) or `playground/` (Deno + Jupyter)
3. Record findings in `docs/09-scratch-log.md`
4. Update relevant policy doc (docs/08, docs/14, etc.)

## Code comment policy (docs/16 §7.4)

Add `// NOTE:` comments at:
- Intentional decisions (why this option, not that)
- Trap avoidance (why this code shape matters)
- Future-revisit candidates (TODO/FIXME)
- Cross-references to docs

Don't add NOTE for self-evident code.

## Documentation map

When in doubt, check the relevant doc rather than guessing:

| Topic | Doc |
|---|---|
| Project overview / scope | docs/01 |
| Tech stack rationale | docs/02 |
| DB schema (current state) | docs/03 |
| Roadmap v1~v5 | docs/04 |
| Methodology / self-eval | docs/05~06 |
| Data layer tools / pitfalls | docs/07~08 |
| Scratch learnings (truth source) | docs/09 |
| Layer / folder rules | docs/10 |
| ORM comparison (JPA / MyBatis / Drizzle) | docs/11 |
| Rendering / Server Action / form | docs/12 |
| Data modeling decisions | docs/13 |
| Relational model basics | docs/14 |
| Operations / runbook / migration ops | docs/15 |
| AI collaboration (this meta) | docs/16 |

## Tone

- Honest. Acknowledge uncertainty, mark `// FIXME` or `// TODO` openly.
- No filler. State decisions; explain only when non-obvious.
- Prefer evidence (scratch experiment, EXPLAIN output, type definition) over confident assertions.