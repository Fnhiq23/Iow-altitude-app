import { BadRequestException } from '@nestjs/common';
import { ResourcesService } from './resources.service';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let db: any;

  beforeEach(() => {
    db = { query: jest.fn() };
    service = new ResourcesService(db);
  });

  it('should deny update with no valid field', async () => {
    db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'm-1', org_id: 'org-1', status: 'draft' }] });

    await expect(
      service.update(
        { id: 'u-1', orgId: 'org-1', email: 'admin@example.com', roles: ['org_admin'] },
        'missions',
        'm-1',
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
