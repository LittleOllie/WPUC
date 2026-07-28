-- Development-only sample wallets (clearly fake addresses).
-- Import via Admin → Bulk Import after deployment. Do NOT commit real production lists.

INSERT INTO whitelist_wallets (
  wallet_address,
  wallet_address_normalised,
  status,
  is_active,
  wl_spots,
  source
) VALUES
  ('0x1111111111111111111111111111111111111111', '0x1111111111111111111111111111111111111111', 'unconfirmed', true, 1, 'dev-sample'),
  ('0x2222222222222222222222222222222222222222', '0x2222222222222222222222222222222222222222', 'confirmed', true, 1, 'dev-sample'),
  ('0x3333333333333333333333333333333333333333', '0x3333333333333333333333333333333333333333', 'needs_review', true, 2, 'dev-sample'),
  ('0x4444444444444444444444444444444444444444', '0x4444444444444444444444444444444444444444', 'removed', false, 1, 'dev-sample')
ON CONFLICT (wallet_address_normalised) DO NOTHING;
