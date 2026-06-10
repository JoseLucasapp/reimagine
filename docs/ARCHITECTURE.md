# Reimagine IQ — Architecture

## Goal

Reimagine IQ is a commercial real estate SaaS portal for Reimagine CRE. The UI in this repo preserves the approved Lovable/Figma prototype and wraps it with a stricter engineering baseline: typed domain models, role policies, Supabase-ready persistence, linting, type checking, and tests.

## Front-end stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/Radix primitives
- React Router for the portal routes
- TanStack Query already installed for future remote data fetching
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
src/application         App-level factories and session helpers
src/infrastructure      Supabase and demo-data adapters
src/components          Reusable UI pieces
src/pages               Route-level screens from the approved prototype
src/data                Prototype/demo seed data used when Supabase env is absent
supabase/schema.sql     Database schema, indexes, enums, and RLS policies
```

## Supabase strategy

The portal supports two runtime modes:

1. **Prototype/demo mode** — default when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are empty. This keeps the approved prototype login working with `Reimagine / Imagine#12345`.
2. **Supabase mode** — enabled when both variables are present. The login form can authenticate Supabase email/password users and stores the access token in session storage.

The Supabase layer is intentionally dependency-light and uses typed REST wrappers over Supabase Auth/PostgREST. That keeps the current package lock stable and avoids pulling new dependencies only for a client wrapper.

## Quality gates

The intended pre-merge command is:

```bash
npm run check
```

It runs lint, typecheck, tests, and production build.
