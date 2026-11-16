import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { Database } from './database';

const databaseMock = {
  query: jest.fn(),
  transaction: jest.fn(),
  onModuleDestroy: jest.fn(),
};

describe('API auth and request validation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
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

  it('rejects unauthenticated access to protected resources', async () => {
    await request(app.getHttpServer()).get('/api/missions').expect(401);
    expect(databaseMock.query).not.toHaveBeenCalled();
  });

  it('validates login input before reaching the database', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(databaseMock.query).not.toHaveBeenCalled();
  });
});
