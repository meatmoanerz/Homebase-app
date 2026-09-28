-- Fakturor är unika per kort och period (ccm_invoices_card_period_key).
-- Den gamla UNIQUE (user_id, period) låg kvar i live-DB efter
-- 20260924150000_credit_cards och blockerar faktura för kort nr 2 samma period.
ALTER TABLE public.ccm_invoices DROP CONSTRAINT IF EXISTS ccm_invoices_user_id_period_key;
DROP INDEX IF EXISTS public.ccm_invoices_user_id_period_key;
