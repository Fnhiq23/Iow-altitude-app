import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ResourcesService } from './resources.service';
import type { Actor } from './security';

const actor: Actor = {
  id: '00000000-0000-4000-8000-000000000001',
  orgId: '00000000-0000-4000-8000-000000000002',
  email: 'admin@example.com',
  roles: ['org_admin'],
};

describe('ResourcesService', () => {
  let service: ResourcesService;
  let client: { query: jest.Mock };
  let db: { query: jest.Mock; transaction: jest.Mock };

  beforeEach(() => {
    client = { query: jest.fn() };
    db = {
      query: jest.fn(),
      transaction: jest.fn(async (work: (client: PoolClient) => Promise<unknown>) => work(client as unknown as PoolClient)),
    };
    service = new ResourcesService(db as never);
  });

  it('scopes reads by actor organization', async () => {
    db.query.mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(service.get(actor, 'missions', 'mission-id')).rejects.toThrow(NotFoundException);
    expect(db.query.mock.calls[0][1]).toEqual([actor.orgId, 'mission-id']);
    expect(db.query.mock.calls[0][0]).toContain('org_id = $1 AND id = $2');
  });

  it('writes creation and audit in the same transaction', async () => {
    const created = { id: 'mission-1', org_id: actor.orgId, status: 'draft' };
    client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [created] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await expect(service.create(actor, 'missions', { title: 'Inspection' })).resolves.toEqual(created);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][0]).toContain('INSERT INTO audit_logs');
  });

  it('does not allow direct mission status changes through generic update', async () => {
    await expect(
      service.update(actor, 'missions', 'mission-1', { status: 'completed' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('locks the mission and atomically audits a valid status transition', async () => {
    const current = { id: 'mission-1', status: 'draft', org_id: actor.orgId };
    const updated = { ...current, status: 'scheduled' };
    client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [current] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [updated] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await expect(service.transitionMission(actor, 'mission-1', 'scheduled')).resolves.toEqual(updated);
    expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[2][0]).toContain('INSERT INTO audit_logs');
  });
});
