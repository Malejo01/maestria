# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

MaestrIA (formerly "Malejo Math") is a Next.js 16 (App Router, React 19, TypeScript) platform that generates and manages AI-assisted educational quizzes for any subject and level (Primario/Secundario/Superior). Two roles with distinct experiences: **ALUMNO** (student) and **DOCENTE** (teacher). See [README.md](README.md) for the full architecture writeup (stack, data model, roles/flows, question-type engine, pedagogy personalization) — read it first, it is kept up to date and this file does not repeat it.

**Read [docs/roadmap.md](docs/roadmap.md) at the start of every session.** It is the canonical record of project state: what phase the work is in, what is blocked and on what, what was already decided and why, and the operational lessons already paid for. README describes how the system is built; the roadmap describes where it stands and what comes next. Treat it as ground truth over inference from the code — several items are complete in the roadmap but deliberately unreferenced anywhere in the repo, and at least one is the reverse (see its "Lecciones operativas" entry on describing files that were never written: verify before assuming). Keep it updated when a phase item lands.

## Commands

```bash
npm run dev          # dev server
npm run build         # production build
npm run lint            # ESLint
npm run test           # vitest run (all tests, single run)
npm run test:watch     # vitest watch mode
```

Run a single test file: `npx vitest run lib/normalize-questions.test.ts`
Run a single migration: `npx tsx scripts/run-migration-017.ts` (migrations are numbered SQL files in `scripts/*.sql`, applied manually via their runner — there is no migration framework).

## Environments — read before running anything in `scripts/`

Every script under `scripts/` that writes to Postgres goes through [scripts/lib/db-target.ts](scripts/lib/db-target.ts). Do not add a script that calls `neon(process.env.DATABASE_URL)` directly — that is the exact pattern this replaced.

- **No flag** → `.env.local`, which is **production**. The script will demand you type the Neon project id before it writes anything.
- **`--env=staging`** → `.env.staging.local`.
- **`CONFIRM_PRODUCTION=<project-id>`** is the non-interactive equivalent, for CI.

Which environment a database *is* comes from the `deployment_env` row (migration 017), never from the hostname or the env file — a cloned Neon branch inherits the row saying `'production'`, so the table also stores `origin_host` to tell a real production from an unflipped clone. An unknown or missing marker is treated as production. Full rationale in [docs/staging.md](docs/staging.md#3-correr-migraciones).

Staging must never hold real personal data: `markEnvironment()` refuses to label a branch `staging` while any un-anonymized email survives, and [scripts/anonymize-staging.ts](scripts/anonymize-staging.ts) is a required step of the branch-refresh procedure, not a cleanup nicety. Note it nulls `accounts.access_token`/`refresh_token`/`id_token` — those are live Google credentials that a naive clone copies straight into a lower-trust environment.

Migration numbering is enforced by [tests/migrations.test.ts](tests/migrations.test.ts) (duplicates fail, new gaps fail; 012 is a known accepted gap). Backups are covered in [docs/backups.md](docs/backups.md).

Tests live next to the code they cover (`lib/*.test.ts`) plus `tests/curriculum.test.ts`. Vitest config: [vitest.config.ts](vitest.config.ts) (node env, `@/` alias to repo root).

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs `npm test` then `npm run build` on push/PR to `main`/`master` — a change isn't done until both pass.

## Architecture notes not obvious from a single file

- **Auth boundary**: never call `auth()` directly in route handlers — use [lib/auth-session.ts](lib/auth-session.ts)'s `getViewer()`, which unifies a real NextAuth session and a guest session (cookie-signed, no account) behind one `Viewer` shape. Guests exist so a student can join an aula with just a name. `getTeacherViewer()` re-reads the role from the DB (not the JWT) since the JWT caches role and a teacher who just switched roles shouldn't need to sign out. Route protection (redirect unauthenticated, block ALUMNO from `/teacher` and `/api/teacher/*`) happens in [proxy.ts](proxy.ts) (Next middleware), not per-route.
- **No ORM**: [lib/db.ts](lib/db.ts) exports a lazily-initialized `sql` tagged-template client (`@neondatabase/serverless`). All queries are raw SQL. `DATABASE_URL` must be set or `sql()` throws on first use.
- **Question type system is a discriminated union**, not a plugin architecture — see the doc comment on `QuestionType` in [lib/types.ts](lib/types.ts). Adding a new question type touches exactly four places: the union in `lib/types.ts`, a Zod schema in the quiz-generation route, a component in `components/quiz-answer-inputs/`, and a case in [lib/moodle-export.ts](lib/moodle-export.ts)'s GIFT builder. `short_answer` is the odd one out — it's graded by AI (`/api/quiz/grade-short-answer`), not exact match.
- **Legacy data compat**: quiz answers written before migration 013 only have the legacy `options`/`selected_answer`/`correct_answer` columns and implicitly default to `question_type: 'multiple_choice'`; anything after uses the polymorphic `answer_payload` column. [lib/normalize-questions.ts](lib/normalize-questions.ts) and [lib/question-migration.ts](lib/question-migration.ts) exist specifically to keep pre-extended-types data working with the current engine — don't "clean up" call sites that look redundant without checking these.
- **Question dedup** ([lib/question-dedup.ts](lib/question-dedup.ts)) uses a lexical signature + numeric signature so the same exercise reworded or retyped isn't served twice to a student.
- **Pedagogy personalization** ([lib/education-context.ts](lib/education-context.ts)) is the single place that turns (nivel, grado, materia) into the system prompt driving Gemini generation — age-appropriate vocabulary, subject-specific distractor strategy, feedback tone, anti-hallucination/curriculum-scope rules. Changes to "how questions feel" for a given level almost always belong here, not scattered across generation routes.
- **Classrooms/aulas model**: one classroom = one teacher program (`teacher_programs`), joined by code. Assignments carry an availability window (`opensAt`/`dueAt`) and attempt cap; `AssignmentState` in `lib/types.ts` enumerates how that resolves for a given student (`disponible`/`programada`/`vencida`/`sin_intentos`/`cerrada`). Server-side computation for this lives in [lib/classrooms-server.ts](lib/classrooms-server.ts); [lib/classrooms.ts](lib/classrooms.ts) has the shared/client-safe pieces.
- **Path alias**: `@/*` maps to the repo root (see `components.json` and `vitest.config.ts`), consistent with shadcn/ui conventions — `@/components`, `@/lib`, `@/hooks`.
- **shadcn/ui**: style "new-york", Tailwind CSS 4 with CSS variables, base color neutral, icons from `lucide-react`. Generated primitives live in `components/ui/`; treat these as vendored — prefer composing over rewriting them.
