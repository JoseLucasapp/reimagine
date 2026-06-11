# Reimagine IQ Portal

Commercial real estate SaaS portal for Reimagine CRE. The application replaces the spreadsheet-based workflow with a typed React/TypeScript portal for Dashboard, Brands, Deals, Prospects/BizDev, Tour Book generation, role-based access and Take Action flows.

The visual implementation keeps the uploaded Lovable/prototype UI as the source of truth and adds production-oriented engineering around it: strict TypeScript, linting, tests, Supabase persistence, clean domain/application/infrastructure boundaries and verification scripts.

## Stack

- React 18 + Vite
- TypeScript with strict type checking
- Tailwind CSS + shadcn/Radix primitives
- Vitest + Testing Library setup
- Supabase REST/Auth infrastructure with typed data mapping

## Local setup

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:8080
```

## Supabase configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The app now requires Supabase. It does not fall back to local mock/demo data when these variables are missing.

Run the SQL files in Supabase SQL Editor in this order:

```text
supabase/schema.sql
supabase/default-account.sql
```

Default seeded account:

```text
Username: Reimagine
Password: Imagine#12345
```

The username is resolved to `reimagine@reimaginecre.local` for Supabase Auth.

## Scripts

```bash
npm run dev           # run local development server
npm run build         # production build
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
src/application        # session, runtime data refresh and use-case boundary
src/infrastructure     # Supabase Auth/PostgREST client and repositories
src/pages              # route-level screens from the approved prototype
src/components         # reusable UI and feature components
src/data               # runtime data containers populated from Supabase
supabase/schema.sql    # database schema, indexes and RLS policies
```

See `docs/ARCHITECTURE.md` and `docs/TEST_PLAN.md` for implementation details and QA coverage.

## Validation performed

The delivered package was validated with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

Notes:

- `npm run check` covers lint, typecheck and production build.
- `npm run test` is intentionally separate because Vitest is faster and more predictable as a dedicated test command in local/CI workflows.
- The production build currently emits a non-fatal Vite chunk-size warning because this prototype is still bundled as a single large app. The build succeeds.
