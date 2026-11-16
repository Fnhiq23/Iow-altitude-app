import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let db: any;

  beforeEach(() => {
    db = {
      query: jest.fn(),
      transaction: jest.fn(),
    };

    service = new AuthService(db);
    process.env.JWT_SECRET = '1234567890abcdef1234567890abcdef';
  });

  it('should reject invalid credentials', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await expect(service.login('bad@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
