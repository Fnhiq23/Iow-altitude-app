-- 001_init.sql
-- Initial schema for the low-altitude operations coordination MVP.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  code VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  mission_type VARCHAR(100) NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'normal',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  planned_start_at TIMESTAMPTZ,
  planned_end_at TIMESTAMPTZ,
  location_text TEXT,
  region_geojson JSONB,
  assignee_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(100) NOT NULL,
  model VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'available',
  maintenance_status VARCHAR(50) NOT NULL DEFAULT 'normal',
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  mission_id UUID REFERENCES missions(id),
  asset_id UUID REFERENCES assets(id),
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  reporter_id UUID REFERENCES users(id),
  assignee_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  target_type VARCHAR(100) NOT NULL,
  target_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploader_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  old_value_json JSONB,
  new_value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_missions_org_status ON missions(org_id, status);
CREATE INDEX idx_assets_org_status ON assets(org_id, status);
CREATE INDEX idx_incidents_org_status ON incidents(org_id, status);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs(org_id, entity_id);
CREATE INDEX idx_attachments_target ON attachments(target_type, target_id);
