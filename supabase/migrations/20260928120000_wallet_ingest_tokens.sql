-- Per-device tokens for the iPhone Wallet "Transaktion" shortcut.
-- Only the SHA-256 hash of each token is stored. Service role only.
CREATE TABLE IF NOT EXISTS public.wallet_ingest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  cardholder TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_ingest_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_ingest_tokens FROM anon, authenticated;
