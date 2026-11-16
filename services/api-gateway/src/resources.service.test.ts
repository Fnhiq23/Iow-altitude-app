import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourcesService } from './resources.service';
import { Actor } from './security';

const actor: Actor = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'operator@example.test',
  roles: ['org_admin'],
};

function createHarness(options: { existingRows?: any[]; failAudit?: boolean } = {}) {
  const statements: string[] = [];
  let committed = false;
  let rolledBack = false;

  const client = {
    async query(sql: string): Promise<any> {
      statements.push(sql);

      if (sql.includes('INSERT INTO audit_logs') && options.failAudit) {
        throw new Error('audit insert failed');
      }

      if (sql.includes('INSERT INTO missions')) {
        return { rows: [{ id: 'mission-1', status: 'draft' }], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO asset_maintenance')) {
        return { rows: [{ id: 'maintenance-1' }], rowCount: 1 };
      }

      if (sql.includes('UPDATE missions')) {
        return { rows: [{ id: 'mission-1', status: 'scheduled' }], rowCount: 1 };
      }

      if (sql.includes('SELECT * FROM missions WHERE org_id = $1 AND id = $2')) {
        const target = options.existingRows?.find((row) => row.id === 'mission-1');
        return { rows: target ? [target] : [], rowCount: target ? 1 : 0 };
      }

      if (sql.includes('SELECT * FROM assets WHERE org_id = $1 AND id = $2')) {
        const target = options.existingRows?.find((row) => row.id === 'asset-1');
        return { rows: target ? [target] : [], rowCount: target ? 1 : 0 };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  const db = {
    async query(): Promise<any> {
      return { rows: options.existingRows ?? [], rowCount: (options.existingRows ?? []).length };
    },
    async withTransaction<T>(operation: (transactionClient: typeof client) => Promise<T>): Promise<T> {
      try {
        const result = await operation(client);
        committed = true;
        return result;
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
  };

  return {
    service: new ResourcesService(db as any),
    statements,
    get committed() { return committed; },
    get rolledBack() { return rolledBack; },
  };
}

test('mission creation commits business row and audit log together', async () => {
  const harness = createHarness();
  const result = await harness.service.create('missions', actor, { title: 'Survey' });

  assert.equal(result.id, 'mission-1');
  assert.equal(harness.statements.length, 2);
  assert.match(harness.statements[0], /INSERT INTO missions/);
  assert.match(harness.statements[1], /INSERT INTO audit_logs/);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
});

test('audit failure rolls back mission creation', async () => {
  const harness = createHarness({ failAudit: true });

  await assert.rejects(() => harness.service.create('missions', actor, { title: 'Survey' }), /audit insert failed/);
  assert.equal(harness.committed, false);
  assert.equal(harness.rolledBack, true);
});

test('illegal mission transition is rejected without writes', async () => {
  const harness = createHarness({ existingRows: [{ id: 'mission-1', status: 'completed' }] });

  await assert.rejects(() => harness.service.transitionMission(actor, 'mission-1', 'canceled'));
  assert.deepEqual(harness.statements, []);
  assert.equal(harness.rolledBack, true);
});

test('cross-organization update is rejected without writes or audit', async () => {
  const harness = createHarness();

  await assert.rejects(() => harness.service.update('missions', actor, 'other-org-mission', { title: 'Changed' }), /Record not found/);
  assert.deepEqual(harness.statements, []);
  assert.equal(harness.rolledBack, true);
});

test('asset maintenance records maintenance and audit in one transaction', async () => {
  const harness = createHarness({ existingRows: [{ id: 'asset-1' }] });
  await harness.service.maintenance(actor, 'asset-1', { maintenance_type: 'inspection', note: 'Routine check' });

  assert.equal(harness.statements.length, 2);
  assert.match(harness.statements[0], /INSERT INTO asset_maintenance/);
  assert.match(harness.statements[1], /INSERT INTO audit_logs/);
  assert.equal(harness.committed, true);
  assert.equal(harness.rolledBack, false);
});
