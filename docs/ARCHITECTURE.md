# Reimagine IQ — Architecture

## Goal

Reimagine IQ is a commercial real estate SaaS portal for Reimagine CRE. The UI in this repo preserves the approved Lovable/Figma prototype and wraps it with a stricter engineering baseline: typed domain models, role policies, Supabase persistence, linting, type checking, and tests.

## Front-end stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/Radix primitives
- React Router for the portal routes
- TanStack Query is installed for future remote data fetching workflows
- Vitest + Testing Library setup for unit/component tests

## Source of truth

The existing Lovable implementation remains the source of visual fidelity. The current work avoids changing layouts outside the requested engineering hardening and keeps the approved modules intact:

- Dashboard
- Brands
- Deals
- Prospects / Biz Dev
- Tour Book Generator
- Role-based portals: Admin, Franchisor, Franchisee
- Take Action drawer

## Layering

```txt
src/domain              Business types and permission rules
src/application         Session helpers, runtime data refresh, and use-case boundary
src/infrastructure      Supabase Auth/PostgREST client and repositories
src/components          Reusable UI pieces
src/pages               Route-level screens from the approved prototype
src/data                Runtime data containers populated from Supabase
supabase/schema.sql     Database schema, indexes, enums, and RLS policies
```

## Supabase strategy

The portal requires Supabase credentials through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

There is no local mock fallback in production runtime. If Supabase is not configured, the app blocks authenticated routes and shows a configuration error instead of rendering fake data.

The Supabase layer uses typed REST wrappers over Supabase Auth/PostgREST. This keeps the dependency surface small while preserving explicit data mapping between snake_case database rows and camelCase UI models.

## Runtime data refresh

The approved Lovable UI imports runtime arrays from `src/data`. Those arrays are now populated from Supabase after authentication. Mutations update the arrays and notify a small external-store subscription in `src/application/data/runtimeStore.ts`, so list pages such as Deals, Brands and Dashboard re-render immediately after create/update operations.

## Quality gates

The intended pre-merge command is:

```bash
npm run check
```

It runs lint, typecheck, and production build. Tests can be run with:

```bash
npm run test
```
