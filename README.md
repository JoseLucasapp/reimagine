# Reimagine IQ Portal

Commercial real estate SaaS portal for Reimagine CRE. The application replaces the spreadsheet-based workflow with a typed React/TypeScript portal for Dashboard, Brands, Deals, Prospects/BizDev, Tour Book generation, role-based access and Take Action flows.

The visual implementation keeps the uploaded Lovable/prototype UI as the source of truth and adds production-oriented engineering around it: strict TypeScript, linting, tests, Supabase-ready infrastructure, clean domain/application/infrastructure boundaries and verification scripts.

## Stack

- React 18 + Vite
- TypeScript with strict type checking
- Tailwind CSS + shadcn/Radix primitives
- Vitest + Testing Library setup
- Supabase-ready REST infrastructure with typed repositories

## Local setup

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:8080
```

Prototype/demo login remains available:

```text
Username: Reimagine
Password: Imagine#12345
```

Supabase email/password login is also supported when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured and the username field receives an email address.

## Environment

Copy `.env.example` to `.env.local` when connecting to Supabase:

```bash
cp .env.example .env.local
```

Required variables for Supabase mode:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Without those variables the app automatically falls back to the typed demo repositories, which keeps the approved prototype flow testable locally.

## Scripts

```bash
npm run dev           # run local development server
npm run build         # typecheck + production build
npm run preview       # preview production build
npm run lint          # strict ESLint, zero warnings allowed
npm run lint:fix      # auto-fix lint issues
npm run typecheck     # TypeScript project references check
npm run format        # formatting via ESLint auto-fix
npm run format:check  # formatting/lint check with zero warnings
npm run test          # Vitest test suite
npm run test:watch    # Vitest watch mode
npm run check         # lint + typecheck + production build
```

## Architecture

```text
src/domain             # business entities and permission rules
src/application        # session and repository selection/use-case boundary
src/infrastructure     # Supabase and demo repository implementations
src/pages              # route-level screens from the approved prototype
src/components         # reusable UI and feature components
src/data               # typed demo/prototype data
supabase/schema.sql    # database schema, indexes and RLS policies
```

See `docs/ARCHITECTURE.md` and `docs/TEST_PLAN.md` for implementation details and QA coverage.

## Supabase

The SQL bootstrap lives in:

```text
supabase/schema.sql
```

It defines role/stage/status enums, core tables, indexes and row-level security policies for profiles, brands, deals, prospects, tour books and action items.

## Validation performed

The delivered package was validated with:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run check
```

Notes:

- `npm run check` covers lint, typecheck and production build.
- `npm run test` is intentionally separate because Vitest is faster and more predictable as a dedicated test command in local/CI workflows.
- The production build currently emits a non-fatal Vite chunk-size warning because this prototype is still bundled as a single large app. The build succeeds.
