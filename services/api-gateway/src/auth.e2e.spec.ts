import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from './app.module';
import { Database } from './database';

const JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';

const databaseMock = {
  query: jest.fn(),
  transaction: jest.fn(),
  onModuleDestroy: jest.fn(),
};

function accessToken(userId: string, orgId: string) {
  return sign(
    { orgId, tokenUse: 'access' },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: '5m',
      issuer: 'iow-altitude-app',
      audience: 'iow-altitude-api',
    },
  );
}

describe('API auth and tenant isolation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Database)
      .useValue(databaseMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => databaseMock.query.mockReset());

  it('rejects unauthenticated access without querying the database', async () => {
    await request(app.getHttpServer()).get('/api/missions').expect(401);
    expect(databaseMock.query).not.toHaveBeenCalled();
  });

  it('rejects a token with an invalid signature', async () => {
    await request(app.getHttpServer())
      .get('/api/missions')
      .set('Authorization', 'Bearer invalid.token.value')
      .expect(401);
    expect(databaseMock.query).not.toHaveBeenCalled();
  });

  it('validates login input before reaching the database', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(databaseMock.query).not.toHaveBeenCalled();
  });

  it('lists only records queried for the authenticated organization', async () => {
    const actorId = '00000000-0000-4000-8000-000000000001';
    const orgId = '00000000-0000-4000-8000-000000000002';
    databaseMock.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: actorId, org_id: orgId, email: 'user@example.com', roles: ['operator'] }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'mission-1', org_id: orgId, title: 'Scoped mission' }],
      });

    const response = await request(app.getHttpServer())
      .get('/api/missions')
      .set('Authorization', `Bearer ${accessToken(actorId, orgId)}`)
      .expect(200);

    expect(response.body).toEqual([{ id: 'mission-1', org_id: orgId, title: 'Scoped mission' }]);
    expect(databaseMock.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE org_id = $1'),
      [orgId],
    );
  });

  it('returns not found for a record outside the authenticated organization', async () => {
    const actorId = '00000000-0000-4000-8000-000000000001';
    const orgId = '00000000-0000-4000-8000-000000000002';
    const otherOrgRecordId = '00000000-0000-4000-8000-000000000099';
    databaseMock.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: actorId, org_id: orgId, email: 'user@example.com', roles: ['operator'] }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await request(app.getHttpServer())
      .get(`/api/missions/${otherOrgRecordId}`)
      .set('Authorization', `Bearer ${accessToken(actorId, orgId)}`)
      .expect(404);

    expect(databaseMock.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE org_id = $1 AND id = $2'),
      [orgId, otherOrgRecordId],
    );
  });
});
