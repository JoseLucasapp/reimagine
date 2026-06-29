# Reimagine CRE Test Plan

## Automated Checks

Run after installing Node/npm in the environment:

```bash
npm run lint
npm run typecheck
npm run build
npm test -- --passWithNoTests
```

Optional import validation:

```bash
npm run import:reimagine -- --file "./imports/Reimagine CRE _ Real Estate Dashboard.xlsx" --dry-run
```

Run `--apply` only against the intended Supabase project.

## Manual Smoke Test

1. Confirm account creation is blocked.
   - Visit `/create-account`, `/signup`, and `/register`.
   - Expected: no public registration UI or signup flow is exposed.

2. Login as an admin profile.
   - Expected: lands on `/`.
   - Verify Dashboard, Brands, Deals, Map, Biz Dev, Space Requirements, One-Off Deals, Tour Book Generator, Settings.
   - Verify imported deals, brands, documents, notes, and dashboard metrics are visible.

3. Login as a brand profile with `profiles.role = 'brand'` and `profiles.brand_id`.
   - Expected: lands on `/brand`.
   - Verify only that brand's deals and brand action items appear.
   - Verify `/brands`, `/bizdev`, and unrelated brand detail URLs are denied.
   - Verify `/map` only shows that brand's city pins.

4. Login as a deal profile with `profiles.role = 'deal'` and `profiles.deal_id`.
   - Expected: lands on `/deal`.
   - Verify no deal selector appears.
   - Verify only the assigned deal appears.
   - Verify direct navigation to another `/deals/:id` shows access denied.
   - Verify global `/map` is denied by navigation/route guard.

5. Test `jjhill4@yahoo.com`.
   - Create/invite the Auth user first.
   - Apply the SQL setup in `supabase/team-access-and-role-scope.sql` for Golf TRK Southlake.
   - Expected: user sees only Golf TRK Southlake.

6. Test Take Action.
   - Ensure Reimagine team profiles have real `profiles.email`.
   - Ensure `accounting@reimagine.com` exists in Auth/profiles.
   - As brand user: create and resolve a brand-level action.
   - As deal user: create and resolve a deal-level action.
   - Expected: recipients display name and email, and rows persist in `brand_action_items` or `take_action_items`.

7. Test documents.
   - As admin, open a deal and manage documents.
   - Add a document URL.
   - Upload a file to `deal-documents`.
   - Mark a deal Signed with Signed LOI and Signed Lease links/uploads.
   - Reload and verify saved document URLs persist.

8. Test AI.
   - Generate a deal AI summary.
   - Generate Dashboard follow-up queue.
   - Temporarily simulate provider failure/quota issue.
   - Expected: page does not crash and template/fallback state is visible.

9. Test Settings.
   - Change password with current password verification.
   - Logout.
   - For admin only, verify preview mode is labeled as preview and does not change the persisted `profiles.role`.
