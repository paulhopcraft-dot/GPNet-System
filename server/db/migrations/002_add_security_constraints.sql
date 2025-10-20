-- ========================================
-- GPNet Security Migration
-- File: server/db/migrations/002_add_security_constraints.sql
-- ========================================

BEGIN;

-- 1. CREATE USER_INVITES TABLE
CREATE TABLE IF NOT EXISTS user_invites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL DEFAULT 'user',
  token VARCHAR NOT NULL UNIQUE,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'cancelled')),
  created_by VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_org ON user_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);

-- 2. CREATE WEBHOOK_FORM_MAPPINGS TABLE
CREATE TABLE IF NOT EXISTS webhook_form_mappings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id VARCHAR NOT NULL UNIQUE,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_type VARCHAR NOT NULL,
  webhook_password VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_form_mappings_form_id ON webhook_form_mappings(form_id);
CREATE INDEX IF NOT EXISTS idx_webhook_form_mappings_org ON webhook_form_mappings(organization_id);

-- 3. ADD UNIQUE CONSTRAINTS FOR MULTI-TENANCY
ALTER TABLE workers DROP CONSTRAINT IF EXISTS workers_email_org_unique;
ALTER TABLE workers ADD CONSTRAINT workers_email_org_unique 
  UNIQUE (email, organization_id);

ALTER TABLE client_users DROP CONSTRAINT IF EXISTS client_users_email_org_unique;
ALTER TABLE client_users ADD CONSTRAINT client_users_email_org_unique 
  UNIQUE (email, organization_id);

-- 4. ADD INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_org ON workers(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org_status ON tickets(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_workers_org_email ON workers(organization_id, email);

COMMIT;