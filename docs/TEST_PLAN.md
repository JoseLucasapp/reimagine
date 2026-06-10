# Reimagine IQ — Test Plan

## Automated checks

Run:

```bash
npm install
npm run check
```

Expected gates:

1. `npm run lint` — ESLint with explicit `any` blocked.
2. `npm run typecheck` — strict TypeScript project references.
3. `npm run test` — Vitest suite.
4. `npm run build` — production Vite build.

## Manual smoke test

1. Start with `npm run dev`.
2. Login with the approved prototype credentials:
   - Username: `Reimagine`
   - Password: `Imagine#12345`
3. Validate desktop navigation:
   - Dashboard
   - Brands
   - Deals
   - Prospects
   - Map
   - Space Requirements
   - One-Off Deals
   - Tour Book Generator
   - Settings
4. Validate role switch in Settings:
   - Admin sees all sections.
   - Franchisor sees brand/deal level access.
   - Franchisee sees deal-level access only.
5. Validate mobile width:
   - Sidebar/bottom nav usable.
   - Tables do not block page scroll.
   - Tour Book generator controls remain reachable.
6. Optional Supabase smoke:
   - Fill `.env.local` with Supabase URL and anon key.
   - Create a Supabase user with `user_metadata.role` as `admin`, `franchisor`, or `franchisee`.
   - Login by email/password.
