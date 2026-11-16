import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
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
    client: PoolClient,
    actor: Actor,
    action: string,
    entityType: ResourceKind,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await client.query(
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
        oldValue == null ? null : JSON.stringify(oldValue),
        newValue == null ? null : JSON.stringify(newValue),
      ],
    );
  }

  async list(actor: Actor, kind: ResourceKind, status?: string) {
    const table = RESOURCE_CONFIG[kind].table;
    const params: unknown[] = [actor.orgId];
    let where = 'org_id = $1';

    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
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

    if (!result.rowCount) throw new NotFoundException('Record not found');
    return result.rows[0];
  }

  async create(actor: Actor, kind: ResourceKind, input: Record<string, unknown>) {
    const config = RESOURCE_CONFIG[kind];
    const columns = ['org_id'];
    const values: unknown[] = [actor.orgId];

    for (const field of config.fields) {
      const value = input[field];
      if (value !== undefined) {
        columns.push(field);
        values.push(value);
      }
    }

    if (kind === 'missions') {
      columns.push('created_by');
      values.push(actor.id);
    } else if (kind === 'incidents') {
      columns.push('reporter_id');
      values.push(actor.id);
    }

    if (kind === 'missions' && input.status === undefined) {
      columns.push('status');
      values.push('draft');
    } else if (kind === 'incidents' && input.status === undefined) {
      columns.push('status');
      values.push('open');
    }

    const placeholders = values.map((_, index) => `$${index + 1}`);
    return this.db.transaction(async (client) => {
      const result = await client.query<QueryResultRow>(
        `INSERT INTO ${config.table} (${columns.join(', ')})
         VALUES (${placeholders.join(', ')}) RETURNING *`,
        values,
      );
      const created = result.rows[0];
      await this.logAudit(client, actor, 'create', kind, created.id, null, created);
      return created;
    });
  }

  async update(actor: Actor, kind: ResourceKind, id: string, input: Record<string, unknown>) {
    const config = RESOURCE_CONFIG[kind];
    const setFields = config.fields.filter((field) => input[field] !== undefined);
    if (!setFields.length) throw new BadRequestException('No valid update field supplied');

    return this.db.transaction(async (client) => {
      const current = await this.findForUpdate(client, actor, kind, id);
      const values: unknown[] = [actor.orgId, id];
      const assignments = setFields.map((field) => {
        values.push(input[field]);
        return `${field} = $${values.length}`;
      });
      assignments.push('updated_at = NOW()');

      const result = await client.query<QueryResultRow>(
        `UPDATE ${config.table}
         SET ${assignments.join(', ')}
         WHERE org_id = $1 AND id = $2
         RETURNING *`,
        values,
      );
      const updated = result.rows[0];
      await this.logAudit(client, actor, 'update', kind, id, current, updated);
      return updated;
    });
  }

  async transitionMission(actor: Actor, id: string, nextStatus: string) {
    const allowedMap: Record<string, string[]> = {
      draft: ['scheduled', 'canceled'],
      scheduled: ['in_progress', 'canceled'],
      in_progress: ['paused', 'completed', 'canceled'],
      paused: ['in_progress', 'canceled'],
      completed: [],
      canceled: [],
    };

    return this.db.transaction(async (client) => {
      const current = await this.findForUpdate(client, actor, 'missions', id);
      if (!allowedMap[current.status]?.includes(nextStatus)) {
        throw new BadRequestException(
          `Cannot transition mission from ${current.status} to ${nextStatus}`,
        );
      }

      const result = await client.query<QueryResultRow>(
        `UPDATE missions SET status = $3, updated_at = NOW()
         WHERE org_id = $1 AND id = $2 RETURNING *`,
        [actor.orgId, id, nextStatus],
      );
      const updated = result.rows[0];
      await this.logAudit(
        client,
        actor,
        'status_change',
        'missions',
        id,
        { status: current.status },
        { status: nextStatus },
      );
      return updated;
    });
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
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return result.rows;
  }

  private async findForUpdate(
    client: PoolClient,
    actor: Actor,
    kind: ResourceKind,
    id: string,
  ) {
    const table = RESOURCE_CONFIG[kind].table;
    const result = await client.query<QueryResultRow>(
      `SELECT * FROM ${table} WHERE org_id = $1 AND id = $2 FOR UPDATE`,
      [actor.orgId, id],
    );
    if (!result.rowCount) throw new NotFoundException('Record not found');
    return result.rows[0];
  }
}
