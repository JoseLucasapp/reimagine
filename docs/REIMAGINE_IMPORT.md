# Reimagine CRE XLSX Import

## What this imports

The import script reads the exported Google Sheets XLSX and imports:

- `Home` -> `brands`
- `Biz Dev` -> `prospects`
- `Space Requirements` -> `space_requirements`
- brand transaction sheets and `One-Off Deals` -> `deals`
- deal final document hyperlinks -> `deal_documents`
- deal notes/update notes -> `deal_notes`
- `Activity Log` -> `prospect_activity_logs`

The import is idempotent. It uses `source_key` and Supabase upserts, so running it again updates existing imported rows instead of duplicating them.

## 1. Confirm Supabase schema support

Run `supabase/import-support.sql` in the Supabase SQL Editor if it has not already been applied.

## 2. Install dependencies

```bash
npm install
```

## 3. Add import environment variables

Copy `.env.import.example` to `.env.import` and fill:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Use the Supabase service role key only locally/server-side. Never add it as `VITE_*`.

## 4. Put the XLSX in the project

Recommended path:

```text
imports/Reimagine CRE _ Real Estate Dashboard.xlsx
```

## 5. Dry run

```bash
npm run import:reimagine -- --file "./imports/Reimagine CRE _ Real Estate Dashboard.xlsx" --dry-run
```

Expected approximate counts for the current workbook:

```text
Brands parsed: 79
Prospects parsed: 1549
Space requirements parsed: 36
Deals parsed: 786
Documents with real URL parsed: 2192
Deal notes parsed: 776
Activity logs parsed: 100
```

## 6. Apply import

```bash
npm run import:reimagine -- --file "./imports/Reimagine CRE _ Real Estate Dashboard.xlsx" --apply
```

## 7. Validate in Supabase

```sql
select 'brands' as table_name, count(*) from public.brands
union all select 'deals', count(*) from public.deals
union all select 'prospects', count(*) from public.prospects
union all select 'space_requirements', count(*) from public.space_requirements
union all select 'deal_documents', count(*) from public.deal_documents
union all select 'deal_notes', count(*) from public.deal_notes;

select d.*
from public.deals d
left join public.brands b on b.id = d.brand_id
where b.id is null;

select *
from public.deal_documents
where file_path is null
   or file_path = ''
   or file_path in ('Link', 'Map', 'Letter', 'Flyer', 'Demo', 'Signed Lease', 'N/A');
```

## 8. Check the app

After importing, reload the app and verify:

- Brands page shows imported brands.
- Deals page shows the imported deal name when available.
- Deal detail title uses the imported deal name.
- Deal documents show real hyperlinks.
- Biz Dev contains imported prospects.
- Space Requirements contains imported rows with normalized SF values and preserved raw values.
