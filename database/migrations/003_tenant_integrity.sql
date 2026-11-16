-- Enforce that tenant-scoped relations cannot cross organization boundaries.
-- This migration intentionally fails if existing data violates these invariants;
-- inspect and repair such rows before retrying it.

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_id_org ON users(id, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_id_org ON roles(id, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_missions_id_org ON missions(id, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_id_org ON assets(id, org_id);

ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_user_org
  FOREIGN KEY (user_id, org_id) REFERENCES users(id, org_id);
ALTER TABLE user_roles
  ADD CONSTRAINT fk_user_roles_role_org
  FOREIGN KEY (role_id, org_id) REFERENCES roles(id, org_id);

ALTER TABLE missions
  ADD CONSTRAINT fk_missions_assignee_org
  FOREIGN KEY (assignee_id, org_id) REFERENCES users(id, org_id);
ALTER TABLE missions
  ADD CONSTRAINT fk_missions_creator_org
  FOREIGN KEY (created_by, org_id) REFERENCES users(id, org_id);

ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_mission_org
  FOREIGN KEY (mission_id, org_id) REFERENCES missions(id, org_id);
ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_asset_org
  FOREIGN KEY (asset_id, org_id) REFERENCES assets(id, org_id);
ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_reporter_org
  FOREIGN KEY (reporter_id, org_id) REFERENCES users(id, org_id);
ALTER TABLE incidents
  ADD CONSTRAINT fk_incidents_assignee_org
  FOREIGN KEY (assignee_id, org_id) REFERENCES users(id, org_id);

ALTER TABLE attachments
  ADD CONSTRAINT fk_attachments_uploader_org
  FOREIGN KEY (uploader_id, org_id) REFERENCES users(id, org_id);

ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_user_org
  FOREIGN KEY (user_id, org_id) REFERENCES users(id, org_id);

ALTER TABLE asset_maintenance ADD COLUMN org_id UUID;
UPDATE asset_maintenance maintenance
SET org_id = assets.org_id
FROM assets
WHERE maintenance.asset_id = assets.id;
ALTER TABLE asset_maintenance ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_org_asset
  ON asset_maintenance(org_id, asset_id, performed_at DESC);
ALTER TABLE asset_maintenance
  ADD CONSTRAINT fk_asset_maintenance_asset_org
  FOREIGN KEY (asset_id, org_id) REFERENCES assets(id, org_id);
ALTER TABLE asset_maintenance
  ADD CONSTRAINT fk_asset_maintenance_performer_org
  FOREIGN KEY (performed_by, org_id) REFERENCES users(id, org_id);
