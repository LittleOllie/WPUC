# Blackwater Labs Whitelist System

Complete whitelist wallet management and confirmation for the Blackwater Labs site (`ratzilla2/`).

## Feature overview

- **Public checker** at `/whitelist` — users enter one wallet address; the server returns only that wallet’s status (never the full list).
- **Public confirmation** — unconfirmed wallets can be marked confirmed via `manual_check` (address entry only; not cryptographic proof).
- **Admin area** at `/admin` — authenticated dashboard for wallet CRUD, bulk import, audit log, and CSV export.
- **Supabase backend** — PostgreSQL with Row Level Security, Edge Functions for public endpoints, Supabase Auth for admins.

## Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/whitelist` | Public | Check whitelist status and confirm wallet |
| `/admin/login` | Public | Admin sign-in |
| `/admin` | Admin | Dashboard with stats and recent activity |
| `/admin/wallets` | Admin | Searchable wallet table and detail modal |
| `/admin/import` | Admin | CSV upload / paste with preview |
| `/admin/audit` | Admin | Full audit log |
| `/admin/export` | Admin | Filtered CSV export |

## Database

Migration: `supabase/migrations/001_whitelist_schema.sql`

Tables:

- `whitelist_wallets` — wallet records (unique on `wallet_address_normalised`)
- `import_batches` — bulk import metadata
- `audit_events` — operational audit trail
- `admin_profiles` — links Supabase Auth users to admin role
- `rate_limit_entries` — IP rate limiting for public Edge Functions

Statuses: `unconfirmed`, `confirmed`, `needs_review`, `removed`

Confirmation methods: `manual_check`, `wallet_signature` (reserved), `admin`

## Environment variables

See `.env.example`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Edge Functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set in Supabase dashboard — never in frontend code).

## Setup

### 1. Create Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration:
   ```bash
   cd ratzilla2
   supabase link --project-ref YOUR_REF
   supabase db push
   ```
3. Deploy Edge Functions:
   ```bash
   supabase functions deploy check-wallet
   supabase functions deploy confirm-wallet
   ```

### 2. Configure frontend

Copy `.env.example` to `.env.local` and fill in URL + anon key.

### 3. Create the first admin account

1. In Supabase Dashboard → **Authentication** → **Users** → **Add user** (email + password).
2. Copy the new user’s UUID.
3. In **SQL Editor**, run:
   ```sql
   INSERT INTO admin_profiles (id, email, is_admin)
   VALUES ('USER-UUID-HERE', 'admin@yourdomain.com', true);
   ```
4. Sign in at `https://blackwater-labs.com/admin/login`.

### 4. Import the ~900 wallet list

1. Sign in to `/admin/import`.
2. Set batch name (e.g. `Original WL Import`).
3. Upload CSV or paste addresses (one per line, or CSV with `wallet_address` column).
4. Click **Preview Import** — review valid/invalid/duplicate counts.
5. Click **Commit** — only new wallets are inserted; existing records are skipped by default.

Optional dev sample: `data/dev-whitelist-sample.txt` (fake addresses only).

**Never commit real production wallet lists to git.**

### 5. Add an individual wallet

`/admin/wallets` → **Add Wallet** → enter address, spots, source, notes.

### 6. Export confirmed wallets

`/admin/export` → select **Confirmed only** → **Download CSV**.

## Public confirmation flow

1. User visits `/whitelist`.
2. Enters submitted EVM wallet address → **Check Whitelist**.
3. If found and unconfirmed → **Confirm This Wallet**.
4. Backend records `confirmation_method = manual_check` and audit event `wallet_confirmed_public`.

Wording states the visitor confirmed the wallet — not that ownership was cryptographically verified.

## Status behaviour

| Status | Public checker | Admin visible |
|--------|----------------|---------------|
| `unconfirmed` | Found, can confirm | Yes |
| `confirmed` | Found, already confirmed | Yes |
| `needs_review` | Found (same as active) | Yes |
| `removed` / inactive | Not found | Yes, restorable |

## Security

- RLS blocks public direct table access.
- Public checks/confirmations go through Edge Functions + `public_lookup_wallet` / `public_confirm_wallet` RPC (service role only).
- Rate limiting: 30 checks/min and 15 confirmations/min per IP.
- Admin routes guarded client-side and server-side (RLS + `is_whitelist_admin()`).
- CSV exports sanitise formula-injection prefixes.
- No service role key in browser bundle.

## Wallet signature verification (future)

Architecture supports `confirmation_method = wallet_signature`:

1. User connects wallet matching listed address.
2. Backend issues one-time nonce (add `verification_nonces` table).
3. User signs `buildVerificationMessage(nonce)` from `lib/wallet.ts`.
4. Edge Function verifies signature, invalidates nonce, sets `wallet_signature`.

No Web3 dependencies added in v1; database and method enum are ready.

## Email notifications

Extension point: `src/features/whitelist/lib/notifications.ts`

No email provider wired by default. Dashboard shows recent activity instead.

## Deployment

1. Set `VITE_SUPABASE_*` in your build environment (GitHub Actions secret or local `.env.local`).
2. `npm run publish` as usual for GitHub Pages.
3. Ensure Supabase Edge Functions CORS allows your domain (default `*` in functions).

Existing pages (`/`, `/infection`, `/containment`) are unchanged except a **Check Your Whitelist** link on the landing page.

## Tests

```bash
cd ratzilla2
npm test
npm run typecheck
```

Covers wallet normalisation/validation, CSV import preview, duplicate detection, and CSV export sanitisation.

## Files changed (summary)

- `src/App.tsx` — routes
- `src/main.tsx` — whitelist CSS
- `src/pages/*` — public + admin pages
- `src/features/whitelist/**` — feature module
- `src/styles/whitelist.css` — Blackwater-themed styles
- `supabase/migrations/001_whitelist_schema.sql`
- `supabase/functions/check-wallet/`, `confirm-wallet/`
- `docs/WHITELIST.md` (this file)

## Limitations

- Manual confirmation does not prove wallet ownership.
- Admin CRUD uses Supabase client + RLS (requires live Supabase project).
- Bulk import runs in browser batches (100 rows/chunk); suitable for ~900+ rows.
- Email notifications not implemented (extension point only).

## Recommended next step

Add `wallet-signature` Edge Function + optional `wagmi`/`viem` connect flow on `/whitelist`, storing nonces in Supabase and upgrading `confirmation_method` to `wallet_signature`.
