import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

describe('Auth and org isolation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject missing token', async () => {
    const res = await app.getHttpServer().inject({
      method: 'GET',
      url: '/api/missions',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should allow login for valid user', async () => {
    const res = await app.getHttpServer().inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.result).toHaveProperty('accessToken');
  });
});
