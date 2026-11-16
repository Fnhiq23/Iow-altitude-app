import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from './database';
import type { Actor } from './security';

type ResourceKind = 'missions' | 'assets' | 'incidents';

const RESOURCE_CONFIG: Record<ResourceKind, { table: string; fields: string[] }> = {
  missions: {
    table: 'missions',
    fields: [
      'title',
      'mission_type',
      'priority',
      'planned_start_at',
      'planned_end_at',
      'location_text',
      'assignee_id',
      'status',
      'description',
    ],
  },
  assets: {
    table: 'assets',
    fields: [
      'name',
      'asset_type',
      'model',
      'status',
      'maintenance_status',
      'serial_number',
      'metadata_json',
    ],
  },
  incidents: {
    table: 'incidents',
    fields: [
      'mission_id',
      'asset_id',
      'type',
      'severity',
      'description',
      'assignee_id',
      'status',
      'resolved_at',
    ],
  },
};

@Injectable()
export class ResourcesService {
  constructor(private readonly db: Database) {}

  private async logAudit(
    actor: Actor,
    action: string,
    entityType: ResourceKind,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await this.db.query(
      `INSERT INTO audit_logs (
        org_id, user_id, action, entity_type, entity_id,
        old_value_json, new_value_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        actor.orgId,
        actor.id,
        action,
        entityType,
        entityId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
      ],
    );
  }

  async list(actor: Actor, kind: ResourceKind, status?: string) {
    const table = RESOURCE_CONFIG[kind].table;
    const params: unknown[] = [actor.orgId];
    let where = 'org_id = $1';

    if (status) {
      params.push(status);
      where += ' AND status = $' + params.length;
    }

    const result = await this.db.query(
      `SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );

    return result.rows;
  }

  async get(actor: Actor, kind: ResourceKind, id: string) {
    const table = RESOURCE_CONFIG[kind].table;
    const result = await this.db.query(
      `SELECT * FROM ${table} WHERE org_id = $1 AND id = $2`,
      [actor.orgId, id],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Record not found');
    }

    return result.rows[0];
  }

  async create(
    actor: Actor,
    kind: ResourceKind,
    input: Record<string, unknown>,
  ) {
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

    if (kind === 'missions' && input.status === undefined) {
      columns.push('status');
      values.push('draft');
      placeholders.push(`$${values.length}`);
    }

    if (kind === 'incidents' && input.status === undefined) {
      columns.push('status');
      values.push('open');
      placeholders.push(`$${values.length}`);
    }

    const result = await this.db.query(
      `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values,
    );

    const created = result.rows[0];
    await this.logAudit(actor, 'create', kind, created.id, null, created);
    return created;
  }

  async update(
    actor: Actor,
    kind: ResourceKind,
    id: string,
    input: Record<string, unknown>,
  ) {
    const config = RESOURCE_CONFIG[kind];
    const current = await this.get(actor, kind, id);
    const setFields = config.fields.filter((field) => input[field] !== undefined);

    if (!setFields.length) {
      throw new BadRequestException('No valid update field supplied');
    }

    const values: unknown[] = [actor.orgId, id];
    const assignments: string[] = [];

    for (const field of setFields) {
      values.push(input[field]);
      assignments.push(`${field} = $${values.length}`);
    }

    assignments.push('updated_at = NOW()');

    const result = await this.db.query(
      `UPDATE ${config.table}
       SET ${assignments.join(', ')}
       WHERE org_id = $1 AND id = $2
       RETURNING *`,
      values,
    );

    const updated = result.rows[0];
    await this.logAudit(actor, 'update', kind, id, current, updated);
    return updated;
  }

  async transitionMission(actor: Actor, id: string, nextStatus: string) {
    const current = await this.get(actor, 'missions', id);
    const allowedMap: Record<string, string[]> = {
      draft: ['scheduled', 'canceled'],
      scheduled: ['in_progress', 'canceled'],
      in_progress: ['paused', 'completed', 'canceled'],
      paused: ['in_progress', 'canceled'],
      completed: [],
      canceled: [],
    };

    if (!allowedMap[current.status]?.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition mission from ${current.status} to ${nextStatus}`,
      );
    }

    const result = await this.db.query(
      `UPDATE missions
       SET status = $3, updated_at = NOW()
       WHERE org_id = $1 AND id = $2
       RETURNING *`,
      [actor.orgId, id, nextStatus],
    );

    await this.logAudit(
      actor,
      'status_change',
      'missions',
      id,
      { status: current.status },
      { status: nextStatus },
    );

    return result.rows[0];
  }

  async audit(actor: Actor, entityType?: string, entityId?: string) {
    const params: unknown[] = [actor.orgId];
    let where = 'org_id = $1';

    if (entityType) {
      params.push(entityType);
      where += ` AND entity_type = $${params.length}`;
    }

    if (entityId) {
      params.push(entityId);
      where += ` AND entity_id = $${params.length}`;
    }

    const result = await this.db.query(
      `SELECT *
       FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      params,
    );

    return result.rows;
  }
}
