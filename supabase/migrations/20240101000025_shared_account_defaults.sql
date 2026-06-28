-- Shared-account category defaults, effective-dated and household-shared.
-- Each "save as default" writes one row per (user, effective_from period).
-- The active default for any period is the most recent row with
-- effective_from <= that period, so history stays intact and new defaults
-- apply from the period they were saved forward.
CREATE TABLE IF NOT EXISTS shared_account_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL, -- budget period 'YYYY-MM'
  category_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, effective_from)
);

ALTER TABLE shared_account_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_account_defaults_select_own"
  ON shared_account_defaults FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "shared_account_defaults_insert_own"
  ON shared_account_defaults FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "shared_account_defaults_update_own"
  ON shared_account_defaults FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Partners can read each other's defaults (household-shared)
CREATE POLICY "shared_account_defaults_select_partner"
  ON shared_account_defaults FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_connections pc
      WHERE pc.status = 'active'
      AND (
        (pc.user1_id = (SELECT auth.uid()) AND pc.user2_id = shared_account_defaults.user_id)
        OR
        (pc.user2_id = (SELECT auth.uid()) AND pc.user1_id = shared_account_defaults.user_id)
      )
    )
  );
