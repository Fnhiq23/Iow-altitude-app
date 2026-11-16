import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from './database';
import { Actor } from './security';

const RESOURCE_CONFIG = {
  missions: {
    table: 'missions',
    fields: ['title', 'mission_type', 'priority', 'planned_start_at', 'planned_end_at', 'location_text', 'assignee_id', 'status'],
  },
  assets: {
    table: 'assets',
    fields: ['name', 'asset_type', 'model', 'status', 'maintenance_status', 'serial_number'],
  },
  incidents: {
    table: 'incidents',
    fields: ['mission_id', 'asset_id', 'type', 'severity', 'description', 'assignee_id', 'status'],
  },
} as const;

type Kind = keyof typeof RESOURCE_CONFIG;

@Injectable()
export class ResourcesService {
  constructor(private readonly db: Database) {}

  private async logWithClient(client: any, actor: Actor, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await client.query(
      `INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, old_value_json, new_value_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actor.orgId, actor.id, action, entityType, entityId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
    );
  }

  async list(kind: Kind, actor: Actor, status?: string) {
    const table = RESOURCE_CONFIG[kind].table;
    const params: unknown[] = [actor.orgId];
    const where = status ? ' AND status = $2' : '';
    const result = await this.db.query(
      `SELECT * FROM ${table} WHERE org_id = $1${where} ORDER BY created_at DESC LIMIT 200`,
      status ? [actor.orgId, status] : [actor.orgId]
    );
    return result.rows;
  }

  async get(kind: Kind, actor: Actor, id: string) {
    const table = RESOURCE_CONFIG[kind].table;
    const result = await this.db.query(`SELECT * FROM ${table} WHERE org_id = $1 AND id = $2`, [actor.orgId, id]);
    if (!result.rowCount) throw new NotFoundException('Record not found');
    return result.rows[0];
  }

  async create(kind: Kind, actor: Actor, input: Record<string, any>) {
    return this.db.withTransaction(async (client) => {
      const config = RESOURCE_CONFIG[kind];
      const columns: string[] = ['org_id'];
      const values: unknown[] = [actor.orgId];
      const placeholders: string[] = ['$1'];

      for (const field of config.fields) {
        const value = input[field];
        if (value === undefined) continue;
        columns.push(field);
        values.push(value);
        placeholders.push(`$${values.length}`);
      }

      if (kind === 'missions') {
        columns.push('created_by');
        values.push(actor.id);
        placeholders.push(`$${values.length}`);
      }

      if (kind === 'incidents') {
        columns.push('reporter_id');
        values.push(actor.id);
        placeholders.push(`$${values.length}`);
      }

      if (kind === 'missions' && !input.status) {
        columns.push('status');
        values.push('draft');
        placeholders.push(`$${values.length}`);
      }

      if (kind === 'incidents' && !input.status) {
        columns.push('status');
        values.push('open');
        placeholders.push(`$${values.length}`);
      }

      const result = await client.query(
        `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );

      await this.logWithClient(client, actor, 'create', kind, result.rows[0].id, null, result.rows[0]);
      return result.rows[0];
    });
  }

  async update(kind: Kind, actor: Actor, id: string, input: Record<string, any>) {
    return this.db.withTransaction(async (client) => {
      const config = RESOURCE_CONFIG[kind];
      const oldValue = await this.get(kind, actor, id);
      const setFields = config.fields.filter((field) => input[field] !== undefined);
      if (!setFields.length) throw new BadRequestException('No valid update field supplied');

      const values: unknown[] = [actor.orgId, id];
      const assignments = setFields.map((field) => {
        values.push(input[field]);
        return `${field} = $${values.length}`;
      });

      assignments.push('updated_at = NOW()');

      const result = await client.query(
        `UPDATE ${config.table} SET ${assignments.join(', ')} WHERE org_id = $1 AND id = $2 RETURNING *`,
        values
      );

      await this.logWithClient(client, actor, 'update', kind, id, oldValue, result.rows[0]);
      return result.rows[0];
    });
  }

  async transitionMission(actor: Actor, id: string, status: string) {
    return this.db.withTransaction(async (client) => {
      const allowed: Record<string, string[]> = {
        draft: ['scheduled', 'canceled'],
        scheduled: ['in_progress', 'canceled'],
        in_progress: ['paused', 'completed', 'canceled'],
        paused: ['in_progress', 'canceled'],
        completed: [],
        canceled: [],
      };

      const current = await this.get('missions', actor, id);
      if (!allowed[current.status]?.includes(status)) {
        throw new BadRequestException(`Cannot transition mission from ${current.status} to ${status}`);
      }

      const result = await client.query(
        'UPDATE missions SET status = $3, updated_at = NOW() WHERE org_id = $1 AND id = $2 RETURNING *',
        [actor.orgId, id, status]
      );

      await this.logWithClient(client, actor, 'status_change', 'missions', id, { status: current.status }, { status });
      return result.rows[0];
    });
  }

  async maintenance(actor: Actor, assetId: string, payload: { maintenance_type: string; note: string }) {
    return this.db.withTransaction(async (client) => {
      await this.get('assets', actor, assetId);
      const result = await client.query(
        `INSERT INTO asset_maintenance (asset_id, maintenance_type, note, performed_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [assetId, payload.maintenance_type, payload.note, actor.id]
      );

      await this.logWithClient(client, actor, 'maintenance', 'assets', assetId, null, result.rows[0]);
      return result.rows[0];
    });
  }

  async audit(actor: Actor, entityType?: string, entityId?: string) {
    const params: unknown[] = [actor.orgId];
    let where = 'org_id = $1';
    if (entityType) { params.push(entityType); where += ` AND entity_type = $${params.length}`; }
    if (entityId) { params.push(entityId); where += ` AND entity_id = $${params.length}`; }

    const result = await this.db.query(
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    return result.rows;
  }
}
